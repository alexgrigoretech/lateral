import json
from pathlib import Path

import duckdb
import pytest

from wb_pipeline.config import Config


def test_dbt_build_passed(warehouse: Config) -> None:
    result = json.loads(Path("dbt/target/run_results.json").read_text(encoding="utf-8"))
    assert result["results"]
    assert all(row["status"] in {"success", "pass", "warn"} for row in result["results"])


def test_spine_complete(connection) -> None:
    assert connection.execute("select count(*) from marts.fct_indicator_year").fetchone()[0] == 252
    assert connection.execute("""
        select count(*) from raw.config_spine s
        full join marts.fct_indicator_year f using (country_iso3, indicator_code, year)
        where s.config_sha256 is null or f.status is null
    """).fetchone()[0] == 0


def test_missing_status_semantics(connection) -> None:
    rows = connection.execute("""
        select country_iso3, indicator_code, year, status, value, source_page_id
        from marts.fct_indicator_year where status <> 'present' order by country_iso3
    """).fetchall()
    assert len(rows) == 2
    assert rows[0][:5] == ("BRA", "NY.GDP.PCAP.CD", 2024, "not_returned", None)
    assert rows[0][5] is None
    assert rows[1][:5] == ("ZAF", "SP.DYN.LE00.IN", 2024, "null_value", None)
    assert rows[1][5] is not None


def test_trimmed_metadata(connection) -> None:
    assert connection.execute("select region_name from marts.dim_country where country_iso3 = 'BRA'").fetchone()[0] == "Synthetic region"


def test_yoy_does_not_skip_gap(connection) -> None:
    row = connection.execute("""
        select yoy_status, pct_change, prior_year from reporting.rpt_yoy_change
        where country_iso3 = 'ZAF' and indicator_code = 'SP.DYN.LE00.IN' and year = 2024
    """).fetchone()
    assert row == ("current_missing", None, 2023)


def test_yoy_zero_and_missing(tmp_path: Path) -> None:
    sql = Path("dbt/models/reporting/rpt_yoy_change.sql").read_text(encoding="utf-8")
    sql = sql.replace("{{ ref('fct_indicator_year') }}", "marts.fct_indicator_year")
    with duckdb.connect(str(tmp_path / "yoy.duckdb")) as connection:
        connection.execute("create schema marts")
        connection.execute("""
            create table marts.fct_indicator_year as
            select 'BRA' as country_iso3, 'TEST.VALUE' as indicator_code, y as year, v as value
            from (values (2018, 0.0), (2019, 10.0), (2020, null), (2021, 20.0)) t(y, v)
        """)
        rows = connection.execute(f"select year, prior_year, yoy_status, pct_change from ({sql}) order by year").fetchall()
    assert rows == [(2018, None, "first_year", None), (2019, 2018, "prior_zero", None),
                    (2020, 2019, "current_missing", None), (2021, 2020, "prior_missing", None)]


def test_latest_year_and_nonadditive_shares(connection) -> None:
    rows = connection.execute("""
        select indicator_code, min(year), max(year), count(*)
        from reporting.rpt_latest_year_comparison group by indicator_code
    """).fetchall()
    assert len(rows) == 4 and all(row[1:] == (2024, 2024, 9) for row in rows)
    assert connection.execute("""
        select count(*) from reporting.rpt_latest_year_comparison
        where indicator_code in ('NY.GDP.PCAP.CD', 'SP.DYN.LE00.IN') and share_of_total is not null
    """).fetchone()[0] == 0
    assert connection.execute("""
        select sum(share_of_total) from reporting.rpt_latest_year_comparison where indicator_code = 'SP.POP.TOTL'
    """).fetchone()[0] == pytest.approx(1)


def test_weighted_average_and_partial_coverage(connection) -> None:
    actual = connection.execute("""
        select population_weighted_avg from reporting.rpt_income_group_by_year
        where indicator_code = 'NY.GDP.PCAP.CD' and year = 2024 and income_level_code = 'UMC'
    """).fetchone()[0]
    expected = connection.execute("""
        select sum(f.value * p.value) / sum(p.value) filter (where f.value is not null)
        from marts.fct_indicator_year f
        join marts.fct_indicator_year p on f.country_iso3 = p.country_iso3 and f.year = p.year
        join marts.dim_country c on c.country_iso3 = f.country_iso3
        where f.indicator_code = 'NY.GDP.PCAP.CD' and p.indicator_code = 'SP.POP.TOTL'
          and f.year = 2024 and c.income_level_code = 'UMC'
    """).fetchone()[0]
    assert actual == pytest.approx(expected)


def test_all_exports_and_summary(warehouse: Config) -> None:
    parquet = sorted(warehouse.paths.parquet_dir.glob("*.parquet"))
    csv = sorted(warehouse.paths.csv_dir.glob("*.csv"))
    assert len(parquet) == 10 and len(csv) == 6
    summary = json.loads((warehouse.paths.csv_dir / "run_summary.json").read_text(encoding="utf-8"))
    assert summary["status"] == "success"
    assert summary["finished_at"] is not None
    assert summary["counts"]["marts.fct_indicator_year"] == 252
    with duckdb.connect(str(warehouse.paths.duckdb_path)) as connection:
        path = str(warehouse.paths.parquet_dir / "fct_indicator_year.parquet").replace("'", "''")
        assert connection.execute(f"select count(*) from read_parquet('{path}')").fetchone()[0] == 252

def test_missing_weight_and_all_missing_aggregate(tmp_path: Path) -> None:
    sql = Path("dbt/models/reporting/rpt_income_group_by_year.sql").read_text(encoding="utf-8")
    for table in ("fct_indicator_year", "dim_country", "dim_indicator"):
        sql = sql.replace("{{ ref('" + table + "') }}", "marts." + table)
    with duckdb.connect(str(tmp_path / "weights.duckdb")) as connection:
        connection.execute("create schema marts")
        connection.execute("""
            create table marts.dim_country as
            select country_iso3, 'SYN' as income_level_code, 'Synthetic group' as income_level_name
            from (values ('BRA'), ('CAN')) t(country_iso3);
            create table marts.dim_indicator as
            select indicator_code, is_additive from (values
                ('SP.POP.TOTL', true), ('SP.DYN.LE00.IN', false), ('NY.GDP.MKTP.CD', true)
            ) t(indicator_code, is_additive);
            create table marts.fct_indicator_year as
            select country_iso3, indicator_code, 2024 as year, value from (values
                ('BRA', 'SP.POP.TOTL', null), ('CAN', 'SP.POP.TOTL', 100.0),
                ('BRA', 'SP.DYN.LE00.IN', 60.0), ('CAN', 'SP.DYN.LE00.IN', 80.0),
                ('BRA', 'NY.GDP.MKTP.CD', null), ('CAN', 'NY.GDP.MKTP.CD', null)
            ) t(country_iso3, indicator_code, value)
        """)
        rows = connection.execute(sql).fetchall()
        indexed = {row[0]: row for row in rows}
    assert indexed["SP.DYN.LE00.IN"][9] is None
    assert indexed["NY.GDP.MKTP.CD"][6] is None