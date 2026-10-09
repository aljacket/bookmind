"""POST /reports: auth, one anonymous log entry, 422 without side effects, own daily limit."""

import json
import logging
import sys
import types
from datetime import datetime, timezone

import pytest

import quota
import reports
from tests.conftest import CLARIFY_BODY, REPORT_BODY, VALID_TOKEN, bearer

URL = "/reports"
UID_1 = "uid-1"  # the UID FakeFirebaseAuth returns for VALID_TOKEN


def post(client, body=None, token=VALID_TOKEN):
    return client.post(URL, json=REPORT_BODY if body is None else body, headers=bearer(token))


def all_logged_text(caplog) -> str:
    return "\n".join(record.getMessage() for record in caplog.records)


# --- a valid report -------------------------------------------------------------------------------


def test_valid_report_returns_204_and_writes_one_entry(client, report_sink, fake_llm):
    response = post(client)
    assert response.status_code == 204
    assert response.content == b""
    assert report_sink.entries == [
        {
            "kind": "recommendation",
            "lang": "en",
            "content": REPORT_BODY["content"],
            "reason": "offensive",
        }
    ]
    assert fake_llm.calls == []  # a report never reaches the LLM provider


def test_entry_has_exactly_four_fields_and_no_uid(client, report_sink):
    post(client)
    (entry,) = report_sink.entries
    assert set(entry) == {"kind", "lang", "content", "reason"}
    assert UID_1 not in json.dumps(entry)


@pytest.mark.parametrize("kind", ["clarifier", "recommendation"])
@pytest.mark.parametrize("lang", ["en", "es", "it"])
@pytest.mark.parametrize("reason", ["offensive", "inaccurate", "other"])
def test_every_allowed_value_is_accepted(client, report_sink, kind, lang, reason):
    body = {"kind": kind, "lang": lang, "content": "Text", "reason": reason}
    assert post(client, body).status_code == 204
    assert report_sink.entries == [{"kind": kind, "lang": lang, "content": "Text", "reason": reason}]


def test_content_of_exactly_1000_characters_is_accepted(client, report_sink):
    body = {**REPORT_BODY, "content": "x" * 1000}
    assert post(client, body).status_code == 204
    assert len(report_sink.entries[0]["content"]) == 1000


def test_nothing_that_identifies_the_user_reaches_the_logs(client, caplog, report_sink):
    caplog.set_level(logging.DEBUG)
    post(client)
    text = all_logged_text(caplog)
    assert UID_1 not in text
    assert VALID_TOKEN not in text
    assert UID_1 not in json.dumps(report_sink.entries)


def test_two_reports_are_two_entries(client, report_sink):
    post(client)
    post(client)
    assert len(report_sink.entries) == 2


# --- 422: nothing is logged and nothing is counted ------------------------------------------------


def assert_rejected_without_effects(client, body, quota_store, report_sink):
    response = post(client, body)
    assert response.status_code == 422
    assert report_sink.entries == []
    assert quota_store.docs == {}


def test_content_over_1000_characters_is_422(client, quota_store, report_sink):
    assert_rejected_without_effects(
        client, {**REPORT_BODY, "content": "x" * 1001}, quota_store, report_sink
    )


@pytest.mark.parametrize("content", ["", "   ", "\n\t"])
def test_blank_content_is_422(client, quota_store, report_sink, content):
    assert_rejected_without_effects(client, {**REPORT_BODY, "content": content}, quota_store, report_sink)


@pytest.mark.parametrize(
    "extra",
    [
        {"transcript": [{"role": "user", "content": "I want something hopeful"}]},
        {"uid": "uid-1"},
        {"user_id": "uid-1"},
        {"email": "someone@example.com"},
        {"liked_books": [{"title": "Sapiens", "author": "Harari"}]},
    ],
    ids=["transcript", "uid", "user_id", "email", "liked_books"],
)
def test_fields_that_are_not_allowed_are_422(client, quota_store, report_sink, extra):
    assert_rejected_without_effects(client, {**REPORT_BODY, **extra}, quota_store, report_sink)


@pytest.mark.parametrize(
    "change",
    [
        {"kind": "chat"},
        {"kind": "Clarifier"},
        {"kind": None},
        {"lang": "fr"},
        {"reason": "spam"},
        {"reason": "free text that could hold anything"},
        {"content": None},
        {"content": 123},
    ],
)
def test_values_outside_the_allowed_sets_are_422(client, quota_store, report_sink, change):
    assert_rejected_without_effects(client, {**REPORT_BODY, **change}, quota_store, report_sink)


@pytest.mark.parametrize("missing", ["kind", "lang", "content", "reason"])
def test_missing_field_is_422(client, quota_store, report_sink, missing):
    body = {k: v for k, v in REPORT_BODY.items() if k != missing}
    assert_rejected_without_effects(client, body, quota_store, report_sink)


def test_non_object_body_is_422(client, quota_store, report_sink):
    assert_rejected_without_effects(client, ["kind"], quota_store, report_sink)


# --- 429: its own daily limit ---------------------------------------------------------------------


def test_default_limit_is_20_and_the_21st_report_is_429(client, report_sink):
    for _ in range(20):
        assert post(client).status_code == 204
    response = post(client)
    assert response.status_code == 429
    assert response.json() == {"detail": "Daily report limit reached"}
    assert int(response.headers["retry-after"]) > 0
    assert len(report_sink.entries) == 20  # the refused report was not logged


def test_limit_is_read_from_DAILY_REPORT_LIMIT(client, report_sink, monkeypatch):
    monkeypatch.setenv("DAILY_REPORT_LIMIT", "2")
    assert post(client).status_code == 204
    assert post(client).status_code == 204
    assert post(client).status_code == 429
    assert len(report_sink.entries) == 2


def test_limit_zero_refuses_every_report(client, report_sink, monkeypatch):
    monkeypatch.setenv("DAILY_REPORT_LIMIT", "0")
    assert post(client).status_code == 429
    assert report_sink.entries == []


def test_users_have_independent_report_counters(client, report_sink, monkeypatch):
    monkeypatch.setenv("DAILY_REPORT_LIMIT", "1")
    assert post(client, token=VALID_TOKEN).status_code == 204
    assert post(client, token=VALID_TOKEN).status_code == 429
    assert post(client, token="valid-token-uid-2").status_code == 204
    assert len(report_sink.entries) == 2


def test_new_utc_day_starts_from_zero(client, report_sink, now, monkeypatch):
    monkeypatch.setenv("DAILY_REPORT_LIMIT", "1")
    now["now"] = datetime(2026, 10, 9, 23, 59, tzinfo=timezone.utc)
    assert post(client).status_code == 204
    assert post(client).status_code == 429
    now["now"] = datetime(2026, 10, 10, 0, 1, tzinfo=timezone.utc)
    assert post(client).status_code == 204


def test_reports_do_not_consume_the_llm_quota(client, quota_store, fake_llm, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "1")
    for _ in range(5):
        assert post(client).status_code == 204
    # The one LLM call of the day is still available.
    response = client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer())
    assert response.status_code == 200
    assert len(fake_llm.calls) == 1


def test_llm_calls_do_not_consume_the_report_limit(client, report_sink, monkeypatch):
    monkeypatch.setenv("DAILY_LLM_CALL_LIMIT", "3")
    monkeypatch.setenv("DAILY_REPORT_LIMIT", "1")
    for _ in range(3):
        assert client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert post(client).status_code == 204
    assert len(report_sink.entries) == 1


def test_report_counter_document(client, quota_store, now):
    post(client)
    assert list(quota_store.docs) == ["uid-1_2026-10-09_reports"]
    doc = quota_store.docs["uid-1_2026-10-09_reports"]
    assert doc["count"] == 1
    # Same expiry rule as the LLM counter, so the existing Firestore TTL policy deletes it.
    assert doc["expireAt"] == datetime(2026, 10, 11, 0, 0, tzinfo=timezone.utc)


def test_report_and_llm_documents_cannot_collide():
    now = datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc)
    llm_id = quota.quota_document_id("uid-1", now)
    report_id = quota.report_quota_document_id("uid-1", now)
    assert llm_id == "uid-1_2026-10-09"
    assert report_id == "uid-1_2026-10-09_reports"
    # An LLM id always ends with a date, a report id always with "_reports".
    tricky = quota.quota_document_id("uid-1_2026-10-09_reports", now)
    assert tricky != report_id and not tricky.endswith("_reports")


@pytest.mark.parametrize("raw,expected", [("5", 5), (" 7 ", 7), ("0", 0), ("abc", 20), ("-1", 20), ("", 20)])
def test_report_limit_from_environment(monkeypatch, raw, expected):
    monkeypatch.setenv("DAILY_REPORT_LIMIT", raw)
    assert quota.get_daily_report_limit() == expected


def test_report_limit_default_is_20(monkeypatch):
    monkeypatch.delenv("DAILY_REPORT_LIMIT", raising=False)
    assert quota.get_daily_report_limit() == 20


# --- failures fail closed -------------------------------------------------------------------------


def test_quota_store_outage_is_503_and_nothing_is_logged(client, quota_store, report_sink, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("firestore down")

    monkeypatch.setattr(quota_store, "try_consume", boom)
    response = post(client)
    assert response.status_code == 503
    assert report_sink.entries == []


def test_log_write_failure_is_503_without_leaking_the_report(client, report_sink, caplog):
    report_sink.error = RuntimeError("secret detail " + REPORT_BODY["content"])
    caplog.set_level(logging.DEBUG)
    response = post(client)
    assert response.status_code == 503
    assert response.json() == {"detail": "Report service unavailable"}
    text = all_logged_text(caplog)
    assert "RuntimeError" in text  # the error class is logged
    assert "secret detail" not in text
    assert REPORT_BODY["content"] not in text
    assert UID_1 not in text


# --- the sinks ------------------------------------------------------------------------------------


def test_cloud_logging_sink_writes_one_warning_struct_entry(monkeypatch):
    calls = {"clients": [], "loggers": [], "entries": []}

    class FakeLogger:
        def log_struct(self, info, **kwargs):
            calls["entries"].append((info, kwargs))

    class FakeClient:
        def __init__(self, project=None, **kwargs):
            calls["clients"].append(project)

        def logger(self, name):
            calls["loggers"].append(name)
            return FakeLogger()

    fake_module = types.ModuleType("google.cloud.logging")
    fake_module.Client = FakeClient
    import google.cloud

    monkeypatch.setitem(sys.modules, "google.cloud.logging", fake_module)
    monkeypatch.setattr(google.cloud, "logging", fake_module, raising=False)
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "my-project")

    sink = reports.CloudLoggingReportSink()
    entry = {"kind": "clarifier", "lang": "it", "content": "Testo", "reason": "other"}
    sink.write(entry)
    sink.write(entry)

    assert calls["clients"] == ["my-project"]  # client built once, lazily
    assert calls["loggers"] == ["ai-content-report"]
    assert calls["entries"] == [(entry, {"severity": "WARNING"})] * 2


def test_cloud_logging_sink_does_not_touch_google_at_construction():
    reports.CloudLoggingReportSink()  # no credentials needed until the first write


def test_default_sink_is_cloud_logging_and_stdout_is_opt_in(monkeypatch):
    monkeypatch.setattr(reports, "_sink", None)
    assert isinstance(reports.get_report_sink(), reports.CloudLoggingReportSink)
    monkeypatch.setattr(reports, "_sink", None)
    monkeypatch.setenv("REPORT_LOG_DESTINATION", "stdout")
    assert isinstance(reports.get_report_sink(), reports.StdoutReportSink)
    monkeypatch.setattr(reports, "_sink", None)


def test_real_cloud_logging_client_builds_the_expected_entry(monkeypatch):
    """The real google-cloud-logging library, with only the network call replaced."""
    from google.auth.credentials import AnonymousCredentials
    from google.cloud import logging as cloud_logging
    import google.cloud.logging_v2 as logging_v2

    # Fresh process: the library would add its own diagnostic entry to the first log it writes.
    monkeypatch.setattr(logging_v2, "_instrumentation_emitted", False)
    written = []

    class FakeLoggingApi:
        def write_entries(self, entries, **kwargs):
            written.extend(entries)

    real_client = cloud_logging.Client

    def build_client(project=None, **kwargs):
        client = real_client(project=project, credentials=AnonymousCredentials(), _use_grpc=False)
        client._logging_api = FakeLoggingApi()
        return client

    monkeypatch.setattr(cloud_logging, "Client", build_client)
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "my-project")

    entry = {"kind": "recommendation", "lang": "es", "content": "Texto", "reason": "inaccurate"}
    reports.CloudLoggingReportSink().write(entry)

    assert len(written) == 1
    assert written[0]["logName"] == "projects/my-project/logs/ai-content-report"
    assert written[0]["severity"] == "WARNING"
    assert written[0]["jsonPayload"] == entry
    assert set(written[0]) <= {"logName", "resource", "severity", "jsonPayload", "timestamp"}


def test_stdout_sink_prints_one_json_line(capsys):
    reports.StdoutReportSink().write(
        {"kind": "clarifier", "lang": "en", "content": "Text", "reason": "other"}
    )
    lines = capsys.readouterr().out.splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == {
        "logName": "ai-content-report",
        "severity": "WARNING",
        "kind": "clarifier",
        "lang": "en",
        "content": "Text",
        "reason": "other",
    }
