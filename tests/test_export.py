"""Offline verification of export manifests and their command line checks."""

from collections import Counter
from dataclasses import replace
import hashlib
import json
import os
from pathlib import Path
import shutil

import duckdb
import pytest

from wb_pipeline.cli import main
from wb_pipeline.config import Config
from wb_pipeline.export import check_manifest, write_manifest


@pytest.fixture
def copied_export(warehouse: Config, tmp_path: Path) -> Config:
    root = tmp_path / "copied'exports"
    paths = replace(warehouse.paths, duckdb_path=root / "absent.duckdb",
                    parquet_dir=root / "parquet", csv_dir=root / "outputs")
    shutil.copytree(warehouse.paths.parquet_dir, paths.parquet_dir)
    shutil.copytree(warehouse.paths.csv_dir, paths.csv_dir)
    config = replace(warehouse, paths=paths)
    summary = json.loads((paths.csv_dir / "run_summary.json").read_text(encoding="utf-8"))
    write_manifest(config, summary["run_id"], summary["exported_at"])
    return config


def test_manifest_copies_are_identical(warehouse: Config) -> None:
    parquet = warehouse.paths.parquet_dir / "manifest.json"
    csv = warehouse.paths.csv_dir / "manifest.json"
    assert parquet.is_file() and csv.is_file()
    assert parquet.read_bytes() == csv.read_bytes()
    assert parquet.read_bytes().endswith(b"\n")
    for path in (parquet, csv, warehouse.paths.csv_dir / "run_summary.json"):
        assert b"\r" not in path.read_bytes()


def test_manifest_lists_only_exported_files(warehouse: Config) -> None:
    manifest = json.loads((warehouse.paths.csv_dir / "manifest.json").read_text(encoding="utf-8"))
    assert list(manifest) == ["run_id", "exported_at", "generator", "files"]
    assert manifest["generator"] == "wb_pipeline export"
    files = manifest["files"]
    assert len(files) == 17
    assert Counter(entry["format"] for entry in files) == {"parquet": 10, "csv": 6, "json": 1}
    names = [entry["path"] for entry in files]
    assert names == sorted(names)
    assert all(Path(name).name != "manifest.json" and "\\" not in name for name in names)
    summary = json.loads((warehouse.paths.csv_dir / "run_summary.json").read_text(encoding="utf-8"))
    assert manifest["run_id"] == summary["run_id"]
    assert manifest["exported_at"] == summary["exported_at"]


def test_manifest_hashes_and_row_counts(warehouse: Config) -> None:
    manifest = json.loads((warehouse.paths.csv_dir / "manifest.json").read_text(encoding="utf-8"))
    root = Path(os.path.commonpath([warehouse.paths.parquet_dir.resolve(), warehouse.paths.csv_dir.resolve()]))
    for entry in manifest["files"]:
        path = root / entry["path"]
        assert entry["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
        assert entry["bytes"] == path.stat().st_size
        if entry["format"] == "parquet":
            assert entry["rows"] == duckdb.read_parquet(str(path)).count("*").fetchone()[0]
        elif entry["format"] == "csv":
            assert isinstance(entry["rows"], int)
            if path.stem == "rpt_missing_data":
                assert entry["rows"] == 2
        else:
            assert entry["rows"] is None


def test_manifest_check_matches(warehouse: Config) -> None:
    assert check_manifest(warehouse) == []


def test_manifest_check_reports_run_id_mismatch(copied_export: Config) -> None:
    summary = json.loads((copied_export.paths.csv_dir / "run_summary.json").read_text(encoding="utf-8"))
    run_id = summary["run_id"] + "-different"
    write_manifest(copied_export, run_id, summary["exported_at"])
    assert any("run_id mismatch" in problem and f"manifest {run_id!r}" in problem
               and f"summary {summary['run_id']!r}" in problem for problem in check_manifest(copied_export))


def test_manifest_paths_do_not_depend_on_cwd(copied_export: Config, tmp_path: Path,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
    path = copied_export.paths.csv_dir / "manifest.json"
    original = json.loads(path.read_text(encoding="utf-8"))
    root = copied_export.paths.parquet_dir.parent
    expected = sorted(file.relative_to(root).as_posix() for directory in
                      (copied_export.paths.parquet_dir, copied_export.paths.csv_dir)
                      for file in directory.iterdir() if file.suffix in {".parquet", ".csv"}
                      or file.name == "run_summary.json")
    assert [entry["path"] for entry in original["files"]] == expected
    assert check_manifest(copied_export) == []
    monkeypatch.chdir(tmp_path)
    assert check_manifest(copied_export) == []
    rewritten = write_manifest(copied_export, original["run_id"], original["exported_at"])
    assert [entry["path"] for entry in rewritten["files"]] == [entry["path"] for entry in original["files"]]


def test_manifest_check_detects_changed_csv(copied_export: Config, capsys: pytest.CaptureFixture[str]) -> None:
    path = copied_export.paths.csv_dir / "rpt_missing_data.csv"
    with path.open("ab") as stream:
        stream.write(b"\n")
    problems = check_manifest(copied_export)
    assert any(path.name in problem and "sha256 mismatch" in problem for problem in problems)
    assert any(path.name in problem and "bytes mismatch" in problem for problem in problems)
    assert main(["manifest", "--check", "--duckdb-path", str(copied_export.paths.duckdb_path),
                 "--export-dir", str(copied_export.paths.parquet_dir.parent)]) == 1
    summary = json.loads(capsys.readouterr().out)
    assert summary == {"command": "manifest-check", "problems": problems, "status": "mismatch"}


def test_manifest_command_rewrites(copied_export: Config, capsys: pytest.CaptureFixture[str]) -> None:
    for directory in (copied_export.paths.parquet_dir, copied_export.paths.csv_dir):
        (directory / "manifest.json").write_text("{}", encoding="utf-8")
    run = json.loads((copied_export.paths.csv_dir / "run_summary.json").read_text(encoding="utf-8"))
    run_id = run["run_id"]
    arguments = ["manifest", "--duckdb-path", str(copied_export.paths.duckdb_path),
                 "--export-dir", str(copied_export.paths.parquet_dir.parent)]
    assert main(arguments) == 0
    assert json.loads(capsys.readouterr().out) == {"command": "manifest", "files": 17, "run_id": run_id}
    manifest = json.loads((copied_export.paths.csv_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["exported_at"] == run["exported_at"]
    assert check_manifest(copied_export) == []
    assert main(arguments + ["--check"]) == 0
    assert json.loads(capsys.readouterr().out) == {"command": "manifest-check", "problems": [], "status": "ok"}
    assert not copied_export.paths.duckdb_path.exists()


@pytest.mark.parametrize("directory", ["parquet_dir", "csv_dir"])
def test_manifest_check_reports_missing_manifest(copied_export: Config, directory: str) -> None:
    path = getattr(copied_export.paths, directory) / "manifest.json"
    path.unlink()
    assert any("Manifest file missing" in problem and path.relative_to(copied_export.paths.parquet_dir.parent).as_posix() in problem
               for problem in check_manifest(copied_export))


def test_manifest_check_reports_missing_csv_manifest_and_parquet(copied_export: Config) -> None:
    manifest = copied_export.paths.csv_dir / "manifest.json"
    parquet = copied_export.paths.parquet_dir / "dim_country.parquet"
    manifest.unlink()
    parquet.unlink()
    problems = check_manifest(copied_export)
    assert any("Manifest file missing: outputs/manifest.json" in problem for problem in problems)
    assert any("listed file missing on disk: parquet/dim_country.parquet" in problem for problem in problems)


def test_manifest_check_reports_missing_export(copied_export: Config) -> None:
    path = copied_export.paths.parquet_dir / "dim_country.parquet"
    path.unlink()
    assert any("listed file missing on disk" in problem and path.name in problem
               for problem in check_manifest(copied_export))


def test_manifest_check_reports_corrupt_parquet(copied_export: Config) -> None:
    path = copied_export.paths.parquet_dir / "dim_country.parquet"
    path.write_bytes(b"invalid parquet")
    problems = check_manifest(copied_export)
    assert any(path.name in problem and "Cannot count rows" in problem for problem in problems)
    for field in ("rows", "bytes", "sha256"):
        assert any(path.name in problem and f"{field} mismatch" in problem for problem in problems)


def test_manifest_check_reports_unlisted_export(copied_export: Config) -> None:
    directory = copied_export.paths.csv_dir
    shutil.copyfile(directory / "rpt_missing_data.csv", directory / "extra.csv")
    nested = directory / "samples-synthetic"
    nested.mkdir()
    shutil.copyfile(directory / "rpt_missing_data.csv", nested / "ignored.csv")
    problems = check_manifest(copied_export)
    assert any("file on disk not listed" in problem and "extra.csv" in problem for problem in problems)
    assert all("ignored.csv" not in problem for problem in problems)


@pytest.mark.parametrize("field,listed", [("rows", -1), ("bytes", -1), ("sha256", "incorrect")])
def test_manifest_check_reports_changed_values(copied_export: Config, field: str, listed: int | str) -> None:
    path = copied_export.paths.csv_dir / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    entry = manifest["files"][0]
    actual = entry[field]
    entry[field] = listed
    for directory in (copied_export.paths.parquet_dir, copied_export.paths.csv_dir):
        (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    assert any(entry["path"] in problem and f"{field} mismatch" in problem
               and f"listed {listed!r}, actual {actual!r}" in problem for problem in check_manifest(copied_export))


def test_manifest_check_reports_different_manifests(copied_export: Config) -> None:
    path = copied_export.paths.parquet_dir / "manifest.json"
    path.write_bytes(path.read_bytes() + b"\n")
    before = path.read_bytes()
    assert "The two manifest files differ from each other" in check_manifest(copied_export)
    assert path.read_bytes() == before
