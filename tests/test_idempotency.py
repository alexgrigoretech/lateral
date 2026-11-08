from dataclasses import replace
from pathlib import Path

import duckdb
import yaml

from wb_pipeline.cli import run_pipeline
from wb_pipeline.config import Config, load_config


def counts(config: Config) -> tuple[int, ...]:
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        return tuple(connection.execute(f"select count(*) from {table}").fetchone()[0] for table in (
            "raw.api_pages", "raw.observation_rows", "marts.fct_indicator_year", "raw.page_sightings", "raw.runs"
        ))


def test_second_run_is_idempotent(warehouse: Config, fixture_dir: Path) -> None:
    config = warehouse
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        first_run_id = connection.execute("select run_id from raw.runs").fetchone()[0]
    before = counts(config)
    second = run_pipeline(config, fixture_dir)
    after = counts(config)
    assert first_run_id != second["run_id"]
    assert before[:3] == after[:3] == (9, 251, 252)
    assert after[3] - before[3] == before[0]
    assert before[4] == 1 and after[4] == 2
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        assert connection.execute("select count(*) from raw.runs where status = 'success'").fetchone()[0] == 2
        assert connection.execute("select min(fetched_at) >= (select max(started_at) from raw.runs) from staging.stg_observations").fetchone()[0]


def test_tenth_country_is_configuration_only(config: Config, fixture_dir: Path, tmp_path: Path, dbt_in_process: None) -> None:
    data = yaml.safe_load(Path("config/pipeline.yaml").read_text(encoding="utf-8"))
    data["countries"].append("FRA")
    path = tmp_path / "ten_countries.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    expanded = replace(load_config(path), paths=config.paths)
    run_pipeline(expanded, fixture_dir)
    with duckdb.connect(str(expanded.paths.duckdb_path)) as connection:
        assert connection.execute("select count(*) from marts.fct_indicator_year").fetchone()[0] == 280
        assert connection.execute("select count(*) from marts.dim_country").fetchone()[0] == 10
        assert connection.execute("select count(*) from marts.fct_indicator_year where country_iso3 = 'FRA' and status = 'not_returned'").fetchone()[0] == 28