"""CORS origins come from CORS_ALLOWED_ORIGINS; the default is today's local dev list."""

import importlib

import pytest
from fastapi.testclient import TestClient

import main

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "authorization,content-type",
}


@pytest.fixture
def reload_app(monkeypatch):
    """Rebuild `main.app` after setting the environment, then restore the default app."""

    def _reload(cors_origins=None) -> TestClient:
        if cors_origins is None:
            monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
        else:
            monkeypatch.setenv("CORS_ALLOWED_ORIGINS", cors_origins)
        importlib.reload(main)
        return TestClient(main.app)

    yield _reload
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    importlib.reload(main)


def preflight(client: TestClient, origin: str):
    return client.options(
        "/recommendations", headers={"Origin": origin, **PREFLIGHT_HEADERS}
    )


def test_default_origins_are_the_current_dev_list(reload_app):
    reload_app(None)
    assert main.get_cors_origins() == [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "http://10.0.2.2:8000",
        "https://10.0.2.2:8000",
        "http://10.0.2.2",
        "https://10.0.2.2",
    ]


def test_default_allows_local_dev_origin(reload_app):
    client = reload_app(None)
    response = preflight(client, "http://localhost:5173")
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_origins_are_read_from_the_environment(reload_app):
    client = reload_app(" https://bookmind.web.app , capacitor://localhost,,")
    assert main.get_cors_origins() == ["https://bookmind.web.app", "capacitor://localhost"]

    allowed = preflight(client, "https://bookmind.web.app")
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "https://bookmind.web.app"
    assert "authorization" in allowed.headers["access-control-allow-headers"].lower()


def test_production_value_does_not_allow_localhost(reload_app):
    client = reload_app("https://bookmind.web.app,capacitor://localhost")
    for origin in ("http://localhost:5173", "http://10.0.2.2", "http://localhost"):
        assert "access-control-allow-origin" not in preflight(client, origin).headers


def test_preflight_from_unknown_origin_gets_no_allow_origin_header(reload_app):
    client = reload_app("https://bookmind.web.app")
    response = preflight(client, "https://evil.example")
    assert "access-control-allow-origin" not in response.headers
    assert response.status_code == 400


def test_credentials_are_not_allowed(reload_app):
    client = reload_app("https://bookmind.web.app")
    response = preflight(client, "https://bookmind.web.app")
    assert "access-control-allow-credentials" not in response.headers


def test_blank_environment_value_falls_back_to_default(reload_app):
    reload_app("   ")
    assert "http://localhost:5173" in main.get_cors_origins()
