"""Daily per-user quota: counting, 429 over the limit, new UTC day, expiry field."""

from datetime import datetime, timedelta, timezone

import pytest

import quota
from tests.conftest import CLARIFY_BODY, RECOMMEND_BODY, VALID_TOKEN, bearer

URL_CLARIFY = "/recommendations/clarify"
URL_RECOMMEND = "/recommendations"


def test_default_limit_is_10(monkeypatch):
    monkeypatch.delenv("DAILY_LLM_CALL_LIMIT", raising=False)
    assert quota.get_daily_limit() == 10


@pytest.mark.parametrize("raw,expected", [("3", 3), (" 25 ", 25), ("0", 0), ("abc", 10), ("-4", 10), ("", 10)])
def test_limit_from_environment(monkeypatch, raw, expected):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", raw)
    assert quota.get_daily_limit() == expected


def test_calls_over_the_default_limit_get_429_without_calling_llm(client, fake_llm):
    for _ in range(10):
        assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert len(fake_llm.calls) == 10

    response = client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
    assert len(fake_llm.calls) == 10  # the 11th request never reached the provider


def test_clarify_and_recommendations_share_one_counter(client, fake_llm, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "2")
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_RECOMMEND, json=RECOMMEND_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_RECOMMEND, json=RECOMMEND_BODY, headers=bearer()).status_code == 429
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 429
    assert len(fake_llm.calls) == 2


def test_limit_is_read_from_the_environment_at_request_time(client, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "1")
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 429
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "2")
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200


def test_users_have_independent_counters(client, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "1")
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer(VALID_TOKEN)).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer(VALID_TOKEN)).status_code == 429
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer("valid-token-uid-2")).status_code == 200


def test_new_utc_day_starts_from_zero(client, fake_llm, now, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "2")
    now["now"] = datetime(2026, 10, 9, 23, 59, 59, tzinfo=timezone.utc)
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 429

    now["now"] = datetime(2026, 10, 10, 0, 0, 0, tzinfo=timezone.utc)
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer()).status_code == 429
    assert len(fake_llm.calls) == 4


def test_day_is_computed_in_utc_not_local_time(client, quota_store, now):
    # 23:30 on 9 October in UTC-5 is already 10 October in UTC.
    local = timezone(timedelta(hours=-5))
    now["now"] = datetime(2026, 10, 9, 23, 30, tzinfo=local)
    client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer())
    assert list(quota_store.docs) == ["uid-1_2026-10-10"]


def test_document_id_and_expiry(client, quota_store, now):
    now["now"] = datetime(2026, 10, 9, 13, 45, tzinfo=timezone.utc)
    client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer())
    assert list(quota_store.docs) == ["uid-1_2026-10-09"]
    doc = quota_store.docs["uid-1_2026-10-09"]
    assert doc["count"] == 1
    # start of the next UTC day (10 Oct 00:00) + 24 h
    assert doc["expireAt"] == datetime(2026, 10, 11, 0, 0, tzinfo=timezone.utc)


def test_expiry_is_within_48h_of_the_start_of_the_day_counted():
    day_start = datetime(2026, 10, 9, 0, 0, tzinfo=timezone.utc)
    for hour in (0, 12, 23):
        expire_at = quota.quota_expire_at(day_start.replace(hour=hour, minute=59))
        assert expire_at - day_start <= timedelta(hours=48)


def test_invalid_body_does_not_consume_quota(client, quota_store):
    response = client.post(URL_CLARIFY, json={"lang": "en", "transcript": []}, headers=bearer())
    assert response.status_code == 422
    assert quota_store.docs == {}


def test_quota_store_failure_fails_closed_with_503(client, fake_llm, quota_store, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("firestore down")

    monkeypatch.setattr(quota_store, "try_consume", boom)
    response = client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 503
    assert fake_llm.calls == []


def test_quota_is_counted_before_the_llm_call_and_not_refunded_on_failure(
    client, fake_llm, quota_store, monkeypatch
):
    def failing_llm(messages, *, temperature, max_tokens):
        raise RuntimeError("provider exploded with secret sk-123")

    monkeypatch.setattr("main.llm.chat", failing_llm)
    response = client.post(URL_CLARIFY, json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 500
    assert "sk-123" not in response.text  # provider error text is not leaked to the caller
    assert quota_store.docs["uid-1_2026-10-09"]["count"] == 1
