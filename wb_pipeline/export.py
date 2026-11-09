"""Export dashboard tables, reports and auditable run summaries."""

import hashlib
import json
import os
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


def _export_root(config: Config) -> Path:
    return Path(os.path.commonpath([config.paths.parquet_dir.resolve(), config.paths.csv_dir.resolve()]))


def _manifest_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def _build_manifest(config: Config, run_id: str, exported_at: str,
                    problems: list[str] | None = None) -> dict:
    root = _export_root(config)
    paths = list(config.paths.parquet_dir.glob("*.parquet"))
    paths += list(config.paths.csv_dir.glob("*.csv"))
    summary = config.paths.csv_dir / "run_summary.json"
    if summary.is_file():
        paths.append(summary)
    files = []
    with duckdb.connect() as connection:
        for path in paths:
            if not path.is_file():
                continue
            format = path.suffix[1:]
            rows = None
            try:
                if format == "parquet":
                    rows = connection.execute(f"select count(*) from read_parquet({_literal(path)})").fetchone()[0]
                elif format == "csv":
                    rows = connection.execute(
                        f"select count(*) from read_csv({_literal(path)}, header = true, all_varchar = true)").fetchone()[0]
            except duckdb.Error as exc:
                if problems is None:
                    raise
                problems.append(f"Cannot count rows for {_manifest_path(path, root)}: {exc}")
            digest = hashlib.sha256()
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            files.append({"path": _manifest_path(path, root), "format": format, "rows": rows,
                          "bytes": path.stat().st_size, "sha256": digest.hexdigest()})
    return {"run_id": run_id, "exported_at": exported_at, "generator": "wb_pipeline export",
            "files": sorted(files, key=lambda entry: entry["path"])}


def write_manifest(config: Config, run_id: str, exported_at: str) -> dict:
    manifest = _build_manifest(config, run_id, exported_at)
    payload = json.dumps(manifest, indent=2) + "\n"
    for directory in (config.paths.parquet_dir, config.paths.csv_dir):
        (directory / "manifest.json").write_text(payload, encoding="utf-8", newline="\n")
    return manifest


def check_manifest(config: Config) -> list[str]:
    root = _export_root(config)
    problems = []
    manifests = {}
    contents = {}
    for directory in (config.paths.parquet_dir, config.paths.csv_dir):
        path = directory / "manifest.json"
        if not path.is_file():
            problems.append(f"Manifest file missing: {_manifest_path(path, root)}")
            continue
        try:
            contents[path] = path.read_bytes()
            manifest = json.loads(contents[path])
            if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
                raise ValueError("expected a manifest object with a files list")
            if any(not isinstance(entry, dict) or not isinstance(entry.get("path"), str)
                   for entry in manifest["files"]):
                raise ValueError("expected file entries with paths")
            manifests[path] = manifest
        except (OSError, ValueError) as exc:
            problems.append(f"Cannot read manifest {_manifest_path(path, root)}: {exc}")
    if len(contents) == 2 and len(set(contents.values())) != 1:
        problems.append("The two manifest files differ from each other")
    source = manifests.get(config.paths.csv_dir / "manifest.json")
    if source is None:
        source = manifests.get(config.paths.parquet_dir / "manifest.json")
    if source is None:
        return problems
    summary_path = config.paths.csv_dir / "run_summary.json"
    if summary_path.is_file():
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            summary = None
        if isinstance(summary, dict):
            for field in ("run_id", "exported_at"):
                listed, actual = source.get(field), summary.get(field)
                if listed != actual:
                    problems.append(f"{_manifest_path(summary_path, root)}: {field} mismatch: manifest {listed!r}, summary {actual!r}")
    try:
        current = _build_manifest(config, source["run_id"], source["exported_at"], problems)
    except (KeyError, OSError, duckdb.Error) as exc:
        problems.append(f"Cannot recompute manifest: {exc}")
        return problems
    actual_files = {entry["path"]: entry for entry in current["files"]}
    for path, manifest in manifests.items():
        before = len(problems)
        label = _manifest_path(path, root)
        listed_files = {entry["path"]: entry for entry in manifest["files"]}
        for name in sorted(listed_files.keys() - actual_files.keys()):
            problems.append(f"{label}: listed file missing on disk: {name}")
        for name in sorted(actual_files.keys() - listed_files.keys()):
            problems.append(f"{label}: file on disk not listed: {name}")
        for name in sorted(listed_files.keys() & actual_files.keys()):
            for field in ("format", "rows", "bytes", "sha256"):
                listed, actual = listed_files[name].get(field), actual_files[name][field]
                if listed != actual:
                    problems.append(f"{label}: {name} {field} mismatch: listed {listed!r}, actual {actual!r}")
        for field in ("run_id", "exported_at", "generator"):
            if manifest.get(field) != current[field]:
                problems.append(f"{label}: {field} mismatch: listed {manifest.get(field)!r}, actual {current[field]!r}")
        names = [entry["path"] for entry in manifest["files"]]
        if names != sorted(set(names)):
            problems.append(f"{label}: file paths must be sorted and unique")
        if manifest != current and len(problems) == before:
            problems.append(f"{label}: manifest content differs from files on disk")
    return problems


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
    with (config.paths.csv_dir / "run_summary.json").open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(summary, stream, indent=2)
        stream.write("\n")
    manifest = write_manifest(config, run_id, summary["exported_at"])
    summary["manifest_files"] = len(manifest["files"])
    return summary
