from dataclasses import replace
import json
from pathlib import Path

import pytest
import requests
import responses

from wb_pipeline.client import OfflineGuardError, ResponseShapeError, RetryExhausted, WorldBankClient, parse_page
from wb_pipeline.config import Config


def body(page: int = 1, pages: int = 1) -> str:
    return json.dumps([{"page": page, "pages": pages, "total": pages, "per_page": "1"}, [{"id": f"test-{page}"}]])


@responses.activate
def test_paging_stops_at_pages(config: Config) -> None:
    client = WorldBankClient(config.api, "test")
    for number in range(1, 4):
        responses.get(f"{config.api.base_url}/country/BRA", body=body(number, 3),
                      match=[responses.matchers.query_param_matcher({
                          "format": "json", "per_page": str(config.api.per_page), "page": str(number)
                      })])
    pages = client.countries(("BRA",))
    assert [page.page for page in pages] == [1, 2, 3]
    assert len(responses.calls) == 3
    assert pages[0].rows == [{"id": "test-1"}]
    client.close()


@responses.activate
@pytest.mark.parametrize("status", [429, 503])
def test_retries_then_success(config: Config, status: int, monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps = []
    monkeypatch.setattr("wb_pipeline.client.time.sleep", sleeps.append)
    monkeypatch.setattr("wb_pipeline.client.random.uniform", lambda a, b: 0)
    client = WorldBankClient(replace(config.api, backoff=0.5), "test")
    url = f"{config.api.base_url}/country/BRA"
    responses.get(url, status=status)
    responses.get(url, status=status)
    responses.get(url, body=body())
    assert len(client.countries(("BRA",))) == 1
    assert len(responses.calls) == 3
    assert sleeps == [0.5, 1.0]
    client.close()


@responses.activate
@pytest.mark.parametrize("failure", [503, 429, requests.Timeout("timeout"), requests.ConnectionError("connection")])
def test_retry_exhaustion(config: Config, failure: object) -> None:
    client = WorldBankClient(replace(config.api, max_retries=2, backoff=0), "test")
    options = {"status": failure} if isinstance(failure, int) else {"body": failure}
    responses.get(f"{config.api.base_url}/country/BRA", **options)
    with pytest.raises(RetryExhausted, match="3 attempts"):
        client.countries(("BRA",))
    assert len(responses.calls) == 3
    client.close()


@responses.activate
def test_error_shaped_200(config: Config) -> None:
    client = WorldBankClient(config.api, "test")
    error = (Path(__file__).parent / "fixtures" / "error.json").read_text(encoding="utf-8")
    responses.get(f"{config.api.base_url}/country/BRA", body=error)
    with pytest.raises(ResponseShapeError):
        client.countries(("BRA",))
    assert len(responses.calls) == 1
    client.close()


@pytest.mark.parametrize("payload", ["{}", "[{}, []]", '[{"page": 2, "pages": 1, "total": 0}, []]', "invalid"])
def test_bad_shape(payload: str) -> None:
    with pytest.raises(ResponseShapeError):
        parse_page("https://example.invalid", payload, 1)


def test_content_identity() -> None:
    page = parse_page("https://example.invalid/a", body(), 1)
    same = parse_page(page.request_url, page.body, 1)
    changed = parse_page(page.request_url, body().replace("test-1", "test-2"), 1)
    other_url = parse_page("https://example.invalid/b", page.body, 1)
    assert page.page_id == same.page_id
    assert page.page_id != changed.page_id
    assert page.page_id != other_url.page_id


def test_offline_guard_blocks_real_request(config: Config) -> None:
    client = WorldBankClient(config.api, "test")
    with pytest.raises(OfflineGuardError):
        client.countries(("BRA",))
    client.close()


def test_recorded_paged_variant(config: Config) -> None:
    directory = Path(__file__).parent / "fixtures" / "paged"
    client = WorldBankClient(config.api, "test", directory)
    pages = client.observations(("BRA",), "SP.POP.TOTL", 2018, 2024)
    assert [page.page for page in pages] == [1, 2, 3]
    assert sum(len(page.rows) for page in pages) == 7
    client.close()

@responses.activate
def test_fixture_retry_sequence(config: Config) -> None:
    sequence = json.loads((Path(__file__).parent / "fixtures" / "retry_sequence.json").read_text(encoding="utf-8"))
    client = WorldBankClient(replace(config.api, backoff=0), "test")
    for step in sequence:
        response_body = step["body"] if isinstance(step["body"], str) else json.dumps(step["body"])
        responses.get(f"{config.api.base_url}/country/BRA", status=step["http_status"], body=response_body)
    assert client.countries(("BRA",))[0].total == 0
    assert len(responses.calls) == 2
    client.close()