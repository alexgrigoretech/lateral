"""Strict configuration shared by ingestion, transformations and exports."""

from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any

import yaml


@dataclass(frozen=True)
class Indicator:
    code: str
    label: str
    category: str


@dataclass(frozen=True)
class Years:
    start: int
    end: int


@dataclass(frozen=True)
class API:
    base_url: str
    per_page: int
    timeout_s: float
    max_retries: int
    backoff: float


@dataclass(frozen=True)
class Paths:
    raw_dir: Path
    duckdb_path: Path
    parquet_dir: Path
    csv_dir: Path


@dataclass(frozen=True)
class Config:
    countries: tuple[str, ...]
    indicators: tuple[Indicator, ...]
    years: Years
    api: API
    paths: Paths
    consistency_tolerance: float = 0.01

    @property
    def sha256(self) -> str:
        payload = json.dumps(asdict(self), sort_keys=True, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _keys(value: Any, expected: set[str], context: str, optional: set[str] | None = None) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be a mapping")
    optional = optional or set()
    unknown = value.keys() - expected - optional
    missing = expected - value.keys()
    if unknown or missing:
        raise ValueError(f"{context}: unknown keys {sorted(unknown)}, missing keys {sorted(missing)}")
    return value


def _number(value: Any, context: str, minimum: float, integer: bool = False) -> None:
    import math

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{context} must be numeric")
    if not math.isfinite(value) or value < minimum or (integer and not isinstance(value, int)):
        raise ValueError(f"Invalid {context}: {value}")


def load_config(path: str | Path = "config/pipeline.yaml", root: Path | None = None) -> Config:
    root = (root or Path.cwd()).resolve()
    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = root / config_path
    with config_path.open(encoding="utf-8-sig") as stream:
        data = yaml.safe_load(stream)
    _keys(data, {"countries", "indicators", "years", "api", "paths"}, "config", {"consistency_tolerance"})
    countries = data["countries"]
    if not isinstance(countries, list) or not countries:
        raise ValueError("countries must be a nonempty list")
    if any(not isinstance(c, str) or not re.fullmatch(r"[A-Z]{3}", c) for c in countries):
        raise ValueError("countries must contain uppercase ISO3 codes")
    if len(set(countries)) != len(countries):
        raise ValueError("countries must be unique")
    if not isinstance(data["indicators"], list) or not data["indicators"]:
        raise ValueError("indicators must be a nonempty list")
    indicators = []
    for item in data["indicators"]:
        _keys(item, {"code", "label", "category"}, "indicator")
        if not isinstance(item["code"], str) or not re.fullmatch(r"[A-Z0-9_]+(?:\.[A-Z0-9_]+)+", item["code"]):
            raise ValueError("Invalid indicator code")
        if not isinstance(item["label"], str) or not item["label"].strip():
            raise ValueError("Indicator label must be nonempty")
        if item["category"] not in {"population", "economy", "health"}:
            raise ValueError("Invalid indicator category")
        indicators.append(Indicator(**item))
    if len({i.code for i in indicators}) != len(indicators):
        raise ValueError("Indicator codes must be unique")
    years = Years(**_keys(data["years"], {"start", "end"}, "years"))
    for name in ("start", "end"):
        _number(getattr(years, name), f"years.{name}", 1, integer=True)
    if years.start > years.end or years.end > 9999:
        raise ValueError("Invalid year range")
    api = API(**_keys(data["api"], {"base_url", "per_page", "timeout_s", "max_retries", "backoff"}, "api"))
    if not isinstance(api.base_url, str) or not api.base_url.startswith("https://"):
        raise ValueError("api.base_url must use https")
    _number(api.per_page, "api.per_page", 1, integer=True)
    _number(api.timeout_s, "api.timeout_s", 0.001)
    _number(api.max_retries, "api.max_retries", 0, integer=True)
    _number(api.backoff, "api.backoff", 0)
    path_values = _keys(data["paths"], {"raw_dir", "duckdb_path", "parquet_dir", "csv_dir"}, "paths")
    paths = {}
    for name, value in path_values.items():
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"paths.{name} must be a nonempty string")
        paths[name] = (root / value).resolve()
    tolerance = data.get("consistency_tolerance", 0.01)
    _number(tolerance, "consistency_tolerance", 0)
    if tolerance > 1:
        raise ValueError("consistency_tolerance must be at most 1")
    return Config(tuple(countries), tuple(indicators), years, api, Paths(**paths), tolerance)
