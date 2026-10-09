"""Shared fixtures.

No test talks to the network, to Firebase or to a real LLM: token verification, Firestore and the
LLM provider are all simulated. Production Firestore is never touched.
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pytest
from fastapi.testclient import TestClient

import auth
import llm
import main
import quota

CONFIG_ENV_VARS = [
    "LLM_BASE_URL",
    "LLM_MODEL",
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "LLM_EXTRA_BODY",
    "DAILY_LLM_CALL_LIMIT",
    "CORS_ALLOWED_ORIGINS",
]

VALID_TOKEN = "valid-token-uid-1"

CLARIFY_BODY = {
    "lang": "en",
    "transcript": [
        {"role": "user", "content": "I want something hopeful"},
        {"role": "user", "content": "Loved Sapiens"},
    ],
}

RECOMMEND_BODY = {
    "lang": "en",
    "transcript": [
        {"role": "user", "content": "I want something hopeful"},
        {"role": "user", "content": "Loved Sapiens"},
        {"role": "user", "content": "Something short"},
    ],
    "liked_books": [{"title": "Sapiens", "author": "Yuval Noah Harari"}],
}

LLM_RECOMMENDATIONS_JSON = json.dumps(
    {"b": [{"t": "Title A", "a": "Author A", "r": "Because you said hopeful"}]}
)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Start every test with no provider/quota/CORS configuration from the developer's shell."""
    for name in CONFIG_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    llm._client_for.cache_clear()
    yield
    llm._client_for.cache_clear()


class FakeLLM:
    """Replaces `llm.chat` and records every call, so tests can assert it was not called."""

    def __init__(self) -> None:
        self.calls: List[dict] = []
        self.clarify_reply = "Do you want a short read?"
        self.recommend_reply = LLM_RECOMMENDATIONS_JSON

    def __call__(self, messages, *, temperature, max_tokens) -> str:
        self.calls.append(
            {"messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        )
        return self.clarify_reply if max_tokens == 80 else self.recommend_reply


class InMemoryQuotaStore:
    """Same contract as FirestoreQuotaStore, backed by a dict."""

    def __init__(self) -> None:
        self.docs: Dict[str, dict] = {}

    def try_consume(self, doc_id: str, limit: int, expire_at: datetime) -> bool:
        doc = self.docs.get(doc_id)
        count = doc["count"] if doc else 0
        if count >= limit:
            return False
        self.docs[doc_id] = {"count": count + 1, "expireAt": expire_at}
        return True


class FakeFirebaseAuth:
    """Replaces `firebase_admin.auth.verify_id_token`: maps a token string to a UID or an error."""

    def __init__(self) -> None:
        self.users: Dict[str, str] = {VALID_TOKEN: "uid-1", "valid-token-uid-2": "uid-2"}
        self.errors: Dict[str, Exception] = {}
        self.calls: List[dict] = []

    def __call__(self, token, app=None, check_revoked=False, clock_skew_seconds=0):
        self.calls.append({"token": token, "check_revoked": check_revoked})
        if token in self.errors:
            raise self.errors[token]
        if token in self.users:
            return {"uid": self.users[token], "iss": "fake"}
        raise auth.firebase_auth.InvalidIdTokenError("Decoding Firebase ID token failed")


@pytest.fixture
def fake_llm(monkeypatch) -> FakeLLM:
    fake = FakeLLM()
    monkeypatch.setattr(main.llm, "chat", fake)
    return fake


@pytest.fixture
def fake_auth(monkeypatch) -> FakeFirebaseAuth:
    fake = FakeFirebaseAuth()
    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", fake)
    monkeypatch.setattr(auth, "get_firebase_app", lambda: object())
    return fake


@pytest.fixture
def quota_store() -> InMemoryQuotaStore:
    return InMemoryQuotaStore()


@pytest.fixture
def now(monkeypatch):
    """A controllable UTC clock for the quota module."""
    state = {"now": datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc)}
    monkeypatch.setattr(quota, "_utcnow", lambda: state["now"])
    return state


@pytest.fixture
def client(fake_auth, fake_llm, quota_store, now) -> TestClient:
    main.app.dependency_overrides[quota.get_quota_store] = lambda: quota_store
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def bearer(token: Optional[str] = VALID_TOKEN) -> dict:
    return {"Authorization": f"Bearer {token}"}
