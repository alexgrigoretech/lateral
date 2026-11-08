"""Execute dbt with the same configuration and warehouse as ingestion."""

import json
import logging
import os
from pathlib import Path
import subprocess
import sys

from .config import Config


def dbt_vars(config: Config) -> dict:
    return {
        "year_start": config.years.start,
        "year_end": config.years.end,
        "consistency_tolerance": config.consistency_tolerance,
        "indicators": [{"code": i.code, "label": i.label, "category": i.category} for i in config.indicators],
    }


def transform(config: Config, run_id: str, docs: bool = False) -> None:
    project = Path(__file__).resolve().parents[1] / "dbt"
    env = os.environ.copy()
    env["DUCKDB_PATH"] = str(config.paths.duckdb_path)
    env["DBT_SEND_ANONYMOUS_USAGE_STATS"] = "false"
    env["DO_NOT_TRACK"] = "1"
    command = [sys.executable, "-m", "dbt.cli.main"]
    command += ["docs", "generate"] if docs else ["build"]
    command += ["--project-dir", str(project), "--profiles-dir", str(project),
                "--vars", json.dumps(dbt_vars(config)), "--no-use-colors"]
    log = logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": run_id})
    with subprocess.Popen(command, cwd=project.parent, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace") as process:
        assert process.stdout is not None
        for line in process.stdout:
            log.info("dbt %s", line.rstrip())
        code = process.wait()
    if code:
        raise RuntimeError(f"dbt exited with code {code}")