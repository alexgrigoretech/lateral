"""Paged HTTP and fixture transport with content identity."""

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import random
import re
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter

from .config import API


class WorldBankError(RuntimeError):
    """Base ingestion error."""


class ResponseShapeError(WorldBankError):
    """The response is not a World Bank data page."""


class RetryExhausted(WorldBankError):
    """Transient failures exhausted the retry budget."""


class OfflineGuardError(WorldBankError):
    """A real network connection was attempted in offline mode."""


class GuardedAdapter(HTTPAdapter):
    def get_connection_with_tls_context(self, *args: Any, **kwargs: Any) -> Any:
        if os.environ.get("WB_OFFLINE_GUARD") == "1":
            raise OfflineGuardError("WB_OFFLINE_GUARD prohibits real HTTP")
        return super().get_connection_with_tls_context(*args, **kwargs)

    def get_connection(self, *args: Any, **kwargs: Any) -> Any:
        if os.environ.get("WB_OFFLINE_GUARD") == "1":
            raise OfflineGuardError("WB_OFFLINE_GUARD prohibits real HTTP")
        return super().get_connection(*args, **kwargs)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._]+", "_", value)


def page_filename(entity: str, slug: str, page: int) -> str:
    return f"{entity}__{slugify(slug)}__p{page}.json"


@dataclass(frozen=True)
class Page:
    request_url: str
    page: int
    pages: int
    total: int
    lastupdated: str | None
    fetched_at: str
    body: str
    body_sha256: str
    http_status: int = 200

    @property
    def page_id(self) -> str:
        return hashlib.sha256((self.request_url + self.body_sha256).encode("utf-8")).hexdigest()

    @property
    def rows(self) -> list[dict]:
        return json.loads(self.body)[1]


def parse_page(url: str, body: str, expected_page: int) -> Page:
    try:
        data = json.loads(body)
        if not isinstance(data, list) or len(data) != 2:
            raise ValueError("expected a two element array")
        meta, rows = data
        if not isinstance(meta, dict) or not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError("expected metadata and a list of records")
        page, pages, total = (int(meta[key]) for key in ("page", "pages", "total"))
        if page != expected_page or page < 1 or pages < page or total < 0:
            raise ValueError("inconsistent pagination")
    except (ValueError, TypeError, KeyError) as exc:
        raise ResponseShapeError(f"Invalid API page at {url}: {exc}") from exc
    return Page(url, page, pages, total, meta.get("lastupdated"), utc_now(), body,
                hashlib.sha256(body.encode("utf-8")).hexdigest())


class WorldBankClient:
    def __init__(self, api: API, run_id: str, offline_fixtures: Path | None = None) -> None:
        self.api = api
        self.offline_fixtures = Path(offline_fixtures) if offline_fixtures is not None else None
        self.session = requests.Session()
        self.session.mount("https://", GuardedAdapter())
        self.log = logging.LoggerAdapter(logging.getLogger(__name__), {"run_id": run_id})

    def close(self) -> None:
        self.session.close()

    def _get(self, url: str) -> str:
        for attempt in range(self.api.max_retries + 1):
            try:
                self.log.info("fetch url=%s attempt=%s", url, attempt + 1)
                response = self.session.get(url, timeout=self.api.timeout_s)
                if response.status_code == 429 or response.status_code >= 500:
                    raise requests.HTTPError(f"HTTP {response.status_code}", response=response)
                response.raise_for_status()
                response.encoding = "utf-8"
                return response.text
            except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
                if isinstance(exc, requests.HTTPError) and exc.response is not None:
                    status = exc.response.status_code
                    if status != 429 and status < 500:
                        raise WorldBankError(f"HTTP {status} at {url}") from exc
                if attempt == self.api.max_retries:
                    raise RetryExhausted(f"Failed after {attempt + 1} attempts at {url}: {exc}") from exc
                delay = self.api.backoff * 2 ** attempt
                self.log.warning("retry error=%s delay_s=%.3f", exc, delay)
                time.sleep(delay + random.uniform(0, delay / 4))
        raise AssertionError("Unreachable retry state")

    def fetch(self, entity: str, slug: str, endpoint: str, params: dict | None = None) -> list[Page]:
        pages: list[Page] = []
        page_no = 1
        while True:
            query = {"format": "json", "per_page": self.api.per_page, **(params or {}), "page": page_no}
            url = requests.Request("GET", f"{self.api.base_url.rstrip('/')}/{endpoint}", params=query).prepare().url
            if self.offline_fixtures is not None:
                path = self.offline_fixtures / page_filename(entity, slug, page_no)
                body = path.read_text(encoding="utf-8")
                self.log.info("fixture path=%s", path)
            else:
                body = self._get(url)
            page = parse_page(url, body, page_no)
            if pages and (page.pages != pages[0].pages or page.total != pages[0].total):
                raise ResponseShapeError(f"Pagination changed during request at {url}")
            pages.append(page)
            if page_no == page.pages:
                return pages
            page_no += 1

    def countries(self, countries: tuple[str, ...]) -> list[Page]:
        return self.fetch("countries", "countries", f"country/{';'.join(countries)}")

    def observations(self, countries: tuple[str, ...], code: str, start: int, end: int) -> list[Page]:
        return self.fetch("observations", code, f"country/{';'.join(countries)}/indicator/{code}",
                          {"date": f"{start}:{end}"})

    def indicator_metadata(self, code: str) -> list[Page]:
        return self.fetch("indicators", code, f"indicator/{code}")