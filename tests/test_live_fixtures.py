"""End to end coverage for the recorded World Bank response set."""

from collections.abc import Iterator
from dataclasses import replace
import json
import os
from pathlib import Path
from unittest.mock import patch

import duckdb
import pytest

from wb_pipeline.cli import run_pipeline
from wb_pipeline.config import Config, Paths, load_config


@pytest.fixture(scope="module")
def live_warehouse(tmp_path_factory: pytest.TempPathFactory, dbt_in_process: None) -> Config:
    root = tmp_path_factory.mktemp("live_fixture_warehouse")
    config = replace(load_config(), paths=Paths(root / "raw", root / "warehouse.duckdb",
                                               root / "parquet", root / "outputs"))
    directory = Path(__file__).parent / "fixtures" / "live_2026-11-08"
    with patch.dict(os.environ, {"WB_OFFLINE_GUARD": "1"}):
        run_pipeline(config, directory)
    result = Path("dbt/target/run_results.json").read_text(encoding="utf-8")
    (root / "dbt_run_results.json").write_text(result, encoding="utf-8")
    return config


@pytest.fixture
def live_connection(live_warehouse: Config) -> Iterator[duckdb.DuckDBPyConnection]:
    with duckdb.connect(str(live_warehouse.paths.duckdb_path)) as connection:
        yield connection


def test_live_spine_is_complete_and_present(live_connection) -> None:
    assert live_connection.execute("select count(*) from marts.fct_indicator_year").fetchone()[0] == 252
    assert dict(live_connection.execute(
        "select status, count(*) from marts.fct_indicator_year group by status").fetchall()) == {"present": 252}


def test_live_country_income_groups(live_connection) -> None:
    directory = Path(__file__).parent / "fixtures" / "live_2026-11-08"
    rows = json.loads((directory / "countries__countries__p1.json").read_text(encoding="utf-8"))[1]
    fixture_mapping = {row["id"]: row["incomeLevel"]["id"] for row in rows}
    assert fixture_mapping == {
        "BRA": "UMC", "CAN": "HIC", "DEU": "HIC", "GBR": "HIC", "IND": "LMC",
        "JPN": "HIC", "MEX": "UMC", "USA": "HIC", "ZAF": "UMC",
    }
    actual = live_connection.execute("select country_iso3, income_level_code from marts.dim_country").fetchall()
    assert len(actual) == 9
    assert {row[1] for row in actual} == {"HIC", "UMC", "LMC"}
    assert dict(actual) == fixture_mapping


def test_live_gdp_per_capita_consistency_passed(live_warehouse: Config) -> None:
    result = json.loads((live_warehouse.paths.duckdb_path.parent / "dbt_run_results.json").read_text(encoding="utf-8"))
    checks = [row for row in result["results"] if "assert_gdp_per_capita_consistent" in row["unique_id"].split(".")]
    assert len(checks) == 1
    assert checks[0]["status"] == "pass"


def test_live_latest_year_comparison(live_connection, live_warehouse: Config) -> None:
    rows = live_connection.execute(
        "select country_iso3, indicator_code, year from reporting.rpt_latest_year_comparison").fetchall()
    assert len(rows) == 36
    assert {(country, indicator) for country, indicator, year in rows} == {
        (country, indicator.code) for country in live_warehouse.countries for indicator in live_warehouse.indicators
    }
    assert {year for country, indicator, year in rows} == {2024}


def test_live_income_groups_cover_every_year(live_connection) -> None:
    rows = live_connection.execute(
        "select indicator_code, income_level_code, year from reporting.rpt_income_group_by_year").fetchall()
    assert len(rows) == len(set(rows)) == 84
    assert {row[1] for row in rows} == {"HIC", "UMC", "LMC"}
    assert {row[2] for row in rows} == set(range(2018, 2025))