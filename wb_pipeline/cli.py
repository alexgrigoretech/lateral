"""Command line lifecycle for ingestion, dbt and exports."""

import argparse
from dataclasses import replace
import json
import logging
from pathlib import Path

from .client import utc_now
from .config import Config, load_config
from .export import export
from .raw import finish_run, ingest, start_run
from .transform import transform


def run_pipeline(config: Config, offline_fixtures: Path | None = None,
                 skip_dbt: bool = False, ingest_only: bool = False) -> dict:
    run_id = start_run(config)
    log = logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": run_id})
    log.info("run started")
    try:
        ingest(config, run_id, offline_fixtures)
        if not skip_dbt and not ingest_only:
            transform(config, run_id)
        finish_run(config, run_id, "success")
        if not skip_dbt and not ingest_only:
            summary = export(config, run_id)
        else:
            from .export import layer_counts
            import duckdb

            with duckdb.connect(str(config.paths.duckdb_path)) as connection:
                summary = {"run_id": run_id, "counts": layer_counts(connection), "finished_at": utc_now()}
        log.info("run complete counts=%s", summary["counts"])
        return summary
    except Exception as exc:
        finish_run(config, run_id, "failed", str(exc))
        log.exception("run failed")
        raise


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s run_id=%(run_id)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="World Bank indicators pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("run", "ingest", "transform", "export"):
        sub = commands.add_parser(name)
        sub.add_argument("--config", type=Path, default=Path("config/pipeline.yaml"))
        sub.add_argument("--duckdb-path", type=Path)
        sub.add_argument("--export-dir", type=Path)
        if name in ("run", "ingest"):
            sub.add_argument("--offline-fixtures", type=Path)
            sub.add_argument("--skip-dbt", action="store_true")
        if name == "transform":
            sub.add_argument("--docs", action="store_true")
    args = parser.parse_args(argv)
    try:
        config = load_config(args.config)
        paths = config.paths
        if args.duckdb_path is not None:
            paths = replace(paths, duckdb_path=args.duckdb_path.resolve())
        if args.export_dir is not None:
            directory = args.export_dir.resolve()
            paths = replace(paths, parquet_dir=directory / "parquet", csv_dir=directory / "outputs")
        config = replace(config, paths=paths)
        if args.command in ("run", "ingest"):
            summary = run_pipeline(config, args.offline_fixtures, args.skip_dbt, args.command == "ingest")
        elif args.command == "transform":
            transform(config, "transform", args.docs)
            summary = {"command": "docs" if args.docs else "transform", "status": "success"}
        else:
            summary = export(config)
        print(json.dumps(summary, sort_keys=True))
        return 0
    except Exception as exc:
        logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": "cli"}).error("%s", exc)
        return 1