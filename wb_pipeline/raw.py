"""Append source content once and record each run's sightings."""

from datetime import datetime, timezone
import logging
from pathlib import Path
import secrets
from typing import Any

import duckdb

from . import __version__
from .client import Page, WorldBankClient, page_filename, utc_now
from .config import Config


def initialize(connection: duckdb.DuckDBPyConnection) -> None:
    connection.execute("create schema if not exists raw")
    connection.execute("""
        create table if not exists raw.runs (
            run_id varchar primary key, started_at timestamptz, finished_at timestamptz,
            status varchar, config_sha256 varchar, pipeline_version varchar,
            source_lastupdated_max varchar, notes varchar
        );
        create table if not exists raw.api_pages (
            page_id varchar primary key, run_id varchar, entity varchar, request_url varchar,
            page_no integer, pages integer, total integer, source_lastupdated varchar,
            fetched_at timestamptz, http_status integer, body_sha256 varchar, body json
        );
        create table if not exists raw.page_sightings (
            page_id varchar, run_id varchar, fetched_at timestamptz,
            primary key (page_id, run_id)
        );
        create table if not exists raw.country_rows (
            country_iso3 varchar, country_iso2 varchar, name varchar, region_code varchar,
            region_name varchar, income_level_code varchar, income_level_name varchar,
            lending_type varchar, capital_city varchar, latitude varchar, longitude varchar,
            page_id varchar, row_index integer, run_id varchar,
            fetched_at timestamptz, ingested_at timestamptz,
            primary key (page_id, row_index)
        );
        create table if not exists raw.indicator_meta_rows (
            indicator_code varchar, name varchar, unit varchar, source_note varchar,
            source_organization varchar, page_id varchar, row_index integer, run_id varchar,
            fetched_at timestamptz, ingested_at timestamptz,
            primary key (page_id, row_index)
        );
        create table if not exists raw.observation_rows (
            country_iso3 varchar, country_iso2 varchar, country_name varchar,
            indicator_code varchar, indicator_name varchar, year varchar, value double,
            unit varchar, obs_status varchar, decimal varchar,
            page_id varchar, row_index integer, run_id varchar,
            fetched_at timestamptz, ingested_at timestamptz,
            primary key (page_id, row_index)
        );
        create table if not exists raw.config_spine (
            country_iso3 varchar, indicator_code varchar, year integer, config_sha256 varchar,
            primary key (country_iso3, indicator_code, year)
        )
    """)


def _insert_once(connection: duckdb.DuckDBPyConnection, table: str, columns: list[str],
                 values: list[Any], keys: list[str]) -> None:
    placeholders = ", ".join("?" for _ in values)
    condition = " and ".join(f"{key} = ?" for key in keys)
    key_values = [values[columns.index(key)] for key in keys]
    connection.execute(
        f"insert into raw.{table} ({', '.join(columns)}) select {placeholders} "
        f"where not exists (select 1 from raw.{table} where {condition})",
        values + key_values,
    )


def persist_pages(connection: duckdb.DuckDBPyConnection, config: Config, run_id: str,
                  entity: str, slug: str, pages: list[Page]) -> None:
    directory = config.paths.raw_dir / run_id
    directory.mkdir(parents=True, exist_ok=True)
    connection.execute("begin transaction")
    try:
        for page in pages:
            path = directory / page_filename(entity, slug, page.page)
            with path.open("w", encoding="utf-8", newline="") as stream:
                stream.write(page.body)
            _insert_once(connection, "api_pages",
                         ["page_id", "run_id", "entity", "request_url", "page_no", "pages",
                          "total", "source_lastupdated", "fetched_at", "http_status", "body_sha256", "body"],
                         [page.page_id, run_id, entity, page.request_url, page.page, page.pages,
                          page.total, page.lastupdated, page.fetched_at, page.http_status, page.body_sha256, page.body],
                         ["page_id"])
            _insert_once(connection, "page_sightings", ["page_id", "run_id", "fetched_at"],
                         [page.page_id, run_id, page.fetched_at], ["page_id", "run_id"])
            for index, row in enumerate(page.rows):
                provenance = [page.page_id, index, run_id, page.fetched_at, utc_now()]
                suffix = ["page_id", "row_index", "run_id", "fetched_at", "ingested_at"]
                if entity == "countries":
                    columns = ["country_iso3", "country_iso2", "name", "region_code", "region_name",
                               "income_level_code", "income_level_name", "lending_type", "capital_city",
                               "latitude", "longitude"]
                    values = [row.get("id"), row.get("iso2Code"), row.get("name"),
                              row.get("region", {}).get("id"), row.get("region", {}).get("value"),
                              row.get("incomeLevel", {}).get("id"), row.get("incomeLevel", {}).get("value"),
                              row.get("lendingType", {}).get("value"), row.get("capitalCity"),
                              row.get("latitude"), row.get("longitude")]
                    table = "country_rows"
                elif entity == "indicators":
                    columns = ["indicator_code", "name", "unit", "source_note", "source_organization"]
                    values = [row.get(k) for k in ("id", "name", "unit", "sourceNote", "sourceOrganization")]
                    table = "indicator_meta_rows"
                elif entity == "observations":
                    columns = ["country_iso3", "country_iso2", "country_name", "indicator_code",
                               "indicator_name", "year", "value", "unit", "obs_status", "decimal"]
                    values = [row.get("countryiso3code"), row.get("country", {}).get("id"),
                              row.get("country", {}).get("value"), row.get("indicator", {}).get("id"),
                              row.get("indicator", {}).get("value"), row.get("date"), row.get("value"),
                              row.get("unit"), row.get("obs_status"), str(row["decimal"]) if row.get("decimal") is not None else None]
                    table = "observation_rows"
                else:
                    raise ValueError(f"Unknown entity {entity}")
                _insert_once(connection, table, columns + suffix, values + provenance, ["page_id", "row_index"])
        connection.execute("commit")
    except BaseException:
        connection.execute("rollback")
        raise


def start_run(config: Config) -> str:
    config.paths.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + secrets.token_hex(3)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        initialize(connection)
        connection.execute("insert into raw.runs values (?, ?, null, 'running', ?, ?, null, null)",
                           [run_id, utc_now(), config.sha256, __version__])
    return run_id


def finish_run(config: Config, run_id: str, status: str, notes: str | None = None) -> None:
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        connection.execute("""
            update raw.runs set finished_at = ?, status = ?, notes = ?,
                source_lastupdated_max = (
                    select max(p.source_lastupdated) from raw.api_pages p
                    join raw.page_sightings s using (page_id) where s.run_id = ?
                )
            where run_id = ?
        """, [utc_now(), status, notes, run_id, run_id])


def ingest(config: Config, run_id: str, offline_fixtures: Path | None = None) -> None:
    client = WorldBankClient(config.api, run_id, offline_fixtures)
    log = logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": run_id})
    try:
        with duckdb.connect(str(config.paths.duckdb_path)) as connection:
            persist_pages(connection, config, run_id, "countries", "countries", client.countries(config.countries))
            for indicator in config.indicators:
                pages = client.observations(config.countries, indicator.code, config.years.start, config.years.end)
                persist_pages(connection, config, run_id, "observations", indicator.code, pages)
                pages = client.indicator_metadata(indicator.code)
                persist_pages(connection, config, run_id, "indicators", indicator.code, pages)
            connection.execute("begin transaction")
            try:
                connection.execute("delete from raw.config_spine")
                connection.executemany("insert into raw.config_spine values (?, ?, ?, ?)", [
                    (country, indicator.code, year, config.sha256)
                    for country in config.countries for indicator in config.indicators
                    for year in range(config.years.start, config.years.end + 1)
                ])
                connection.execute("commit")
            except BaseException:
                connection.execute("rollback")
                raise
            log.info("ingestion complete")
    finally:
        client.close()