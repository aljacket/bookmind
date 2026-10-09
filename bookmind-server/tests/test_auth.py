"""Token verification: every failure is a 401 and the LLM provider is never called."""

import pytest

import auth
from tests.conftest import CLARIFY_BODY, RECOMMEND_BODY, bearer

ENDPOINTS = [
    ("/recommendations/clarify", CLARIFY_BODY),
    ("/recommendations", RECOMMEND_BODY),
]

fb = auth.firebase_auth


@pytest.mark.parametrize("path,body", ENDPOINTS)
def test_missing_authorization_header_is_401(client, fake_llm, quota_store, path, body):
    response = client.post(path, json=body)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert fake_llm.calls == []
    assert quota_store.docs == {}


@pytest.mark.parametrize("path,body", ENDPOINTS)
@pytest.mark.parametrize(
    "header",
    ["Bearer", "Bearer ", "Basic dXNlcjpwYXNz", "valid-token-uid-1", "Token valid-token-uid-1"],
)
def test_malformed_authorization_header_is_401(client, fake_llm, path, body, header):
    response = client.post(path, json=body, headers={"Authorization": header})
    assert response.status_code == 401
    assert fake_llm.calls == []


@pytest.mark.parametrize("path,body", ENDPOINTS)
def test_invalid_token_is_401(client, fake_llm, quota_store, path, body):
    response = client.post(path, json=body, headers=bearer("garbage"))
    assert response.status_code == 401
    assert fake_llm.calls == []
    assert quota_store.docs == {}


@pytest.mark.parametrize("path,body", ENDPOINTS)
@pytest.mark.parametrize(
    "error",
    [
        fb.ExpiredIdTokenError("Token expired", cause=None),
        fb.RevokedIdTokenError("The Firebase ID token has been revoked."),
        fb.UserNotFoundError("No user record found for the given identifier"),
        fb.UserDisabledError("The user record is disabled."),
    ],
    ids=["expired", "revoked", "deleted-user", "disabled-user"],
)
def test_expired_revoked_deleted_or_disabled_user_is_401(
    client, fake_auth, fake_llm, quota_store, path, body, error
):
    fake_auth.errors["unexpired-token-of-gone-user"] = error
    response = client.post(path, json=body, headers=bearer("unexpired-token-of-gone-user"))
    assert response.status_code == 401
    assert fake_llm.calls == []
    assert quota_store.docs == {}


def test_revocation_checking_is_always_enabled(client, fake_auth):
    client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer())
    assert [call["check_revoked"] for call in fake_auth.calls] == [True]


@pytest.mark.parametrize("path,body", ENDPOINTS)
def test_firebase_outage_fails_closed_with_503(client, fake_auth, fake_llm, path, body):
    fake_auth.errors["t"] = fb.CertificateFetchError("certs unreachable", cause=None)
    response = client.post(path, json=body, headers=bearer("t"))
    assert response.status_code == 503
    assert fake_llm.calls == []


def test_unauthenticated_request_is_rejected_before_body_validation(client, fake_llm):
    response = client.post("/recommendations", json={"lang": "en"})
    assert response.status_code == 401
    assert fake_llm.calls == []


def test_scheme_is_case_insensitive(client):
    response = client.post(
        "/recommendations/clarify",
        json=CLARIFY_BODY,
        headers={"Authorization": "bearer valid-token-uid-1"},
    )
    assert response.status_code == 200
