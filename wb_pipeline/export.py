"""Export dashboard tables, reports and auditable run summaries."""

import json
from pathlib import Path

import duckdb

from .client import utc_now
from .config import Config


def layer_counts(connection: duckdb.DuckDBPyConnection) -> dict[str, int]:
    tables = connection.execute("""
        select table_schema, table_name from information_schema.tables
        where table_schema in ('raw', 'staging', 'marts', 'reporting')
        order by table_schema, table_name
    """).fetchall()
    return {f"{schema}.{table}": connection.execute(
        f'select count(*) from "{schema}"."{table}"').fetchone()[0] for schema, table in tables}


def _literal(path: Path) -> str:
    return "'" + path.as_posix().replace("'", "''") + "'"


def export(config: Config, run_id: str | None = None) -> dict:
    config.paths.parquet_dir.mkdir(parents=True, exist_ok=True)
    config.paths.csv_dir.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(config.paths.duckdb_path)) as connection:
        if run_id is None:
            result = connection.execute("select run_id from raw.runs where status = 'success' order by started_at desc limit 1").fetchone()
            if result is None:
                raise ValueError("No successful run is available to export")
            run_id = result[0]
        tables = [("marts", name) for name in ("dim_country", "dim_indicator", "fct_indicator_year")]
        reports = ("rpt_missing_data", "rpt_completeness_by_country_indicator", "rpt_yoy_change",
                   "rpt_latest_year_comparison", "rpt_latest_available_per_country", "rpt_income_group_by_year")
        tables += [("reporting", name) for name in reports]
        tables += [("raw", "runs")]
        for schema, table in tables:
            name = "run_summary" if table == "runs" else table
            order = "run_id" if table == "runs" else "all"
            query = f"select * from {schema}.{table} order by {order}"
            parquet = _literal(config.paths.parquet_dir / f"{name}.parquet")
            connection.execute(f"copy ({query}) to {parquet} (format parquet, compression zstd)")
            if schema == "reporting":
                csv = _literal(config.paths.csv_dir / f"{name}.csv")
                connection.execute(f"copy ({query}) to {csv} (format csv, header true, null '')")
        row = connection.execute("select started_at, finished_at, status from raw.runs where run_id = ?", [run_id]).fetchone()
        if row is None:
            raise ValueError(f"Unknown run {run_id}")
        summary = {"run_id": run_id, "started_at": row[0].isoformat(),
                   "finished_at": row[1].isoformat() if row[1] else None, "status": row[2],
                   "counts": layer_counts(connection), "exported_at": utc_now()}
    with (config.paths.csv_dir / "run_summary.json").open("w", encoding="utf-8") as stream:
        json.dump(summary, stream, indent=2)
        stream.write("\n")
    return summary