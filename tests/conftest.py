"""Offline test configuration and explicitly synthetic source fixtures."""

from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest

from wb_pipeline.config import Config, Paths, load_config


@pytest.fixture(autouse=True)
def offline_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WB_OFFLINE_GUARD", "1")


@pytest.fixture
def fixture_dir() -> Path:
    return Path(__file__).parent / "fixtures" / "synthetic"


@pytest.fixture
def config(tmp_path: Path) -> Config:
    base = load_config()
    return replace(base, paths=Paths(tmp_path / "raw", tmp_path / "warehouse.duckdb",
                                    tmp_path / "dashboard", tmp_path / "outputs"))


@pytest.fixture(scope="session")
def warehouse(tmp_path_factory: pytest.TempPathFactory, dbt_in_process: None) -> Config:
    from wb_pipeline.cli import run_pipeline
    import os
    from unittest.mock import patch

    root = tmp_path_factory.mktemp("fixture_warehouse")
    base = load_config()
    configured = replace(base, paths=Paths(root / "raw", root / "warehouse.duckdb",
                                          root / "dashboard", root / "outputs"))
    with patch.dict(os.environ, {"WB_OFFLINE_GUARD": "1"}):
        run_pipeline(configured, Path(__file__).parent / "fixtures" / "synthetic")
    return configured


@pytest.fixture
def connection(warehouse: Config):
    import duckdb
    with duckdb.connect(str(warehouse.paths.duckdb_path)) as handle:
        yield handle

def record_live_fixtures(directory: Path | None = None) -> list[Path]:
    """Explicit recording utility, never run as a test fixture."""
    from wb_pipeline.client import WorldBankClient, page_filename

    target = directory or Path(__file__).parent / "fixtures" / "live_2026-11-08"
    if target.exists() and any(target.iterdir()):
        raise ValueError("Fixture recording already exists; refusing a second pass")
    config = load_config()
    client = WorldBankClient(config.api, "record-fixtures")
    collected = []
    try:
        collected.append(("countries", "countries", client.countries(config.countries)))
        for indicator in config.indicators:
            collected.append(("observations", indicator.code, client.observations(
                config.countries, indicator.code, config.years.start, config.years.end)))
            collected.append(("indicators", indicator.code, client.indicator_metadata(indicator.code)))
        target.mkdir(parents=True, exist_ok=True)
        paths = []
        for entity, slug, pages in collected:
            for page in pages:
                path = target / page_filename(entity, slug, page.page)
                with path.open("w", encoding="utf-8", newline="") as stream:
                    stream.write(page.body)
                paths.append(path)
        return paths
    finally:
        client.close()


@pytest.fixture(scope="session")
def dbt_in_process() -> Iterator[None]:
    """Run real dbt builds while sharing imported modules across test warehouses."""
    import json
    import logging
    import os
    from unittest.mock import patch

    from dbt.cli.main import dbtRunner
    from dbt_common.events.base_types import EventMsg

    from wb_pipeline.transform import dbt_vars

    def build(config: Config, run_id: str, docs: bool = False) -> None:
        project = Path(__file__).resolve().parents[1] / "dbt"
        log = logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": run_id})

        def log_event(event: EventMsg) -> None:
            if event.info.level != "debug":
                for line in event.info.msg.splitlines():
                    level = {"warn": logging.WARNING, "error": logging.ERROR}.get(event.info.level, logging.INFO)
                    log.log(level, "dbt %s", line)

        command = ["docs", "generate"] if docs else ["build"]
        command += ["--project-dir", str(project), "--profiles-dir", str(project),
                    "--vars", json.dumps(dbt_vars(config)), "--no-use-colors", "--log-level", "none"]
        with patch.dict(os.environ, {
            "DUCKDB_PATH": str(config.paths.duckdb_path),
            "DBT_SEND_ANONYMOUS_USAGE_STATS": "false",
            "DO_NOT_TRACK": "1",
        }):
            result = dbtRunner(callbacks=[log_event]).invoke(command)
        if not result.success:
            detail = result.exception or "see dbt/target/run_results.json"
            raise RuntimeError(f"dbt build failed: {detail}") from result.exception

    with patch("wb_pipeline.cli.transform", build):
        yield