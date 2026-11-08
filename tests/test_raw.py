from dataclasses import replace
import json
from pathlib import Path

import duckdb
import pytest

from wb_pipeline.cli import run_pipeline
from wb_pipeline.client import WorldBankClient, parse_page
from wb_pipeline.config import Config
from wb_pipeline.raw import finish_run, initialize, persist_pages, start_run


def test_page_persisted_verbatim_once(config: Config, fixture_dir: Path) -> None:
    run_id = start_run(config)
    client = WorldBankClient(config.api, run_id, fixture_dir)
    pages = client.countries(config.countries)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        persist_pages(connection, config, run_id, "countries", "countries", pages)
        persist_pages(connection, config, run_id, "countries", "countries", pages)
        assert connection.execute("select count(*) from raw.api_pages").fetchone()[0] == 1
        assert connection.execute("select count(*) from raw.country_rows").fetchone()[0] == 9
        assert connection.execute("select count(*) from raw.page_sightings").fetchone()[0] == 1
        row = connection.execute("select body, body_sha256, run_id from raw.api_pages").fetchone()
    assert json.loads(row[0]) == json.loads(pages[0].body)
    assert row[1:] == (pages[0].body_sha256, run_id)
    path = config.paths.raw_dir / run_id / "countries__countries__p1.json"
    assert path.read_bytes() == pages[0].body.encode("utf-8")
    finish_run(config, run_id, "success")
    client.close()


def test_transaction_rolls_back_all_pages(config: Config) -> None:
    run_id = start_run(config)
    valid = [{"page": 1, "pages": 2, "total": 2}, [{
        "countryiso3code": "BRA", "indicator": {"id": "SP.POP.TOTL"}, "date": "2020", "value": 100
    }]]
    invalid = [{"page": 2, "pages": 2, "total": 2}, [{
        "countryiso3code": "BRA", "indicator": {"id": "SP.POP.TOTL"}, "date": "2021", "value": "invalid"
    }]]
    pages = [parse_page("https://example.invalid/1", json.dumps(valid), 1),
             parse_page("https://example.invalid/2", json.dumps(invalid), 2)]
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        with pytest.raises(duckdb.Error):
            persist_pages(connection, config, run_id, "observations", "SP.POP.TOTL", pages)
        for table in ("api_pages", "observation_rows", "page_sightings"):
            assert connection.execute(f"select count(*) from raw.{table}").fetchone()[0] == 0


def test_failure_marks_run(config: Config, tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        run_pipeline(config, tmp_path / "missing", skip_dbt=True)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        status, finished, notes = connection.execute("select status, finished_at, notes from raw.runs").fetchone()
    assert status == "failed" and finished is not None and "countries" in notes


def test_fetch_failure_has_no_partial_indicator(config: Config, fixture_dir: Path, tmp_path: Path) -> None:
    import shutil

    directory = tmp_path / "incomplete"
    directory.mkdir()
    shutil.copyfile(fixture_dir / "countries__countries__p1.json", directory / "countries__countries__p1.json")
    paged = Path(__file__).parent / "fixtures" / "paged" / "observations__SP.POP.TOTL__p1.json"
    shutil.copyfile(paged, directory / paged.name)
    with pytest.raises(FileNotFoundError):
        run_pipeline(config, directory, skip_dbt=True)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        assert connection.execute("select count(*) from raw.observation_rows").fetchone()[0] == 0
        assert connection.execute("select status from raw.runs").fetchone()[0] == "failed"

def test_reappearing_content_uses_latest_sighting(config: Config) -> None:
    from wb_pipeline.client import utc_now

    template = [{"page": 1, "pages": 1, "total": 1}, [{
        "countryiso3code": "BRA", "indicator": {"id": "SP.POP.TOTL"}, "date": "2020", "value": 100
    }]]
    first_body = json.dumps(template)
    template[1][0]["value"] = 200
    changed_body = json.dumps(template)
    for body in (first_body, changed_body, first_body):
        run_id = start_run(config)
        page = parse_page("https://example.invalid/observations", body, 1)
        with duckdb.connect(str(config.paths.duckdb_path)) as connection:
            persist_pages(connection, config, run_id, "observations", "SP.POP.TOTL", [page])
        finish_run(config, run_id, "success")
    sql = Path("dbt/models/staging/stg_observations.sql").read_text(encoding="utf-8")
    for table in ("observation_rows", "api_pages", "page_sightings", "runs"):
        sql = sql.replace("{{ source('raw', '" + table + "') }}", "raw." + table)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        assert connection.execute(f"select value from ({sql})").fetchone()[0] == 100
        assert connection.execute("select count(*) from raw.api_pages").fetchone()[0] == 2
        assert connection.execute("select count(*) from raw.observation_rows").fetchone()[0] == 2
        assert connection.execute("select count(*) from raw.page_sightings").fetchone()[0] == 3