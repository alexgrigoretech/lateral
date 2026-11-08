from pathlib import Path

import pytest
import yaml

from wb_pipeline.config import Config, load_config


def write_config(tmp_path: Path, change) -> Path:
    data = yaml.safe_load(Path("config/pipeline.yaml").read_text(encoding="utf-8"))
    change(data)
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


@pytest.mark.parametrize("section", [None, "api", "paths", "years", "indicator"])
def test_unknown_keys_rejected(tmp_path: Path, section: str | None) -> None:
    def change(data):
        target = data if section is None else data["indicators"][0] if section == "indicator" else data[section]
        target["typo"] = 1
    with pytest.raises(ValueError, match="unknown keys"):
        load_config(write_config(tmp_path, change))


@pytest.mark.parametrize("country", ["US", "usa", "USAA", 123])
def test_bad_iso3_rejected(tmp_path: Path, country: object) -> None:
    with pytest.raises(ValueError, match="ISO3"):
        load_config(write_config(tmp_path, lambda data: data.update(countries=[country])))


@pytest.mark.parametrize("section,key,value", [
    ("years", "end", 2010), ("api", "per_page", 0), ("api", "max_retries", -1),
    ("api", "timeout_s", 0), ("api", "backoff", -1), ("years", "start", True)
])
def test_invalid_ranges_rejected(tmp_path: Path, section: str, key: str, value: object) -> None:
    with pytest.raises(ValueError):
        load_config(write_config(tmp_path, lambda data: data[section].update({key: value})))


def test_default_config_and_hash() -> None:
    config = load_config()
    assert len(config.countries) == 9
    assert len(config.indicators) == 4
    assert config.years.start == 2018 and config.years.end == 2024
    assert config.api.per_page == 1000
    assert len(config.sha256) == 64
    assert config == load_config()


def test_config_accepts_utf8_bom(tmp_path: Path) -> None:
    path = tmp_path / "bom.yaml"
    path.write_text(Path("config/pipeline.yaml").read_text(encoding="utf-8-sig"), encoding="utf-8-sig")
    assert path.read_bytes().startswith(b"\xef\xbb\xbf")
    assert load_config(path) == load_config()

@pytest.mark.parametrize("override", [False, True])
def test_cli_output_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], override: bool) -> None:
    from wb_pipeline import cli

    captured: list[Config] = []

    def fake_run(config: Config, *args: object) -> dict:
        captured.append(config)
        return {"status": "success"}

    monkeypatch.setattr(cli, "run_pipeline", fake_run)
    arguments = ["run"]
    if override:
        arguments += ["--duckdb-path", str(tmp_path / "custom.duckdb"), "--export-dir", str(tmp_path / "exports")]
    assert cli.main(arguments) == 0
    assert capsys.readouterr().out.strip() == '{"status": "success"}'
    assert len(captured) == 1
    paths = captured[0].paths
    base = load_config().paths
    if override:
        assert paths.duckdb_path == tmp_path / "custom.duckdb"
        assert paths.parquet_dir == tmp_path / "exports" / "parquet"
        assert paths.csv_dir == tmp_path / "exports" / "outputs"
        assert paths.raw_dir == base.raw_dir
    else:
        assert paths == base