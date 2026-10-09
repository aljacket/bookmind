"""llm.py is the only module that calls the provider; the provider comes from the environment.

The OpenAI SDK runs for real here: only the HTTP transport is replaced, so the tests assert on the
request that would go over the wire (URL, Authorization header, JSON body).
"""

import json
from pathlib import Path
from typing import List

import httpx
import openai
import pytest

import llm

MESSAGES = [
    {"role": "system", "content": "sys"},
    {"role": "user", "content": "hello"},
]


class Wire:
    def __init__(self) -> None:
        self.requests: List[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-1",
                "object": "chat.completion",
                "created": 0,
                "model": "x",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": "  an answer \n"},
                    }
                ],
            },
        )

    @property
    def last_body(self) -> dict:
        return json.loads(self.requests[-1].content)


@pytest.fixture
def wire(monkeypatch) -> Wire:
    wire = Wire()
    real_openai = openai.OpenAI

    def build(**kwargs):
        return real_openai(
            **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(wire.handler))
        )

    monkeypatch.setattr(llm, "OpenAI", build)
    return wire


def call():
    return llm.chat(MESSAGES, temperature=0.3, max_tokens=80)


def test_default_configuration_is_openai_gpt_4o_mini(wire, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "key-from-openai-var")
    assert call() == "an answer"  # stripped
    request = wire.requests[0]
    assert str(request.url) == "https://api.openai.com/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer key-from-openai-var"
    assert wire.last_body == {
        "model": "gpt-4o-mini",
        "messages": MESSAGES,
        "temperature": 0.3,
        "max_tokens": 80,
    }


def test_changing_only_the_environment_changes_base_url_and_model(wire, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "key-from-openai-var")
    call()
    default_body = wire.last_body
    default_url = str(wire.requests[-1].url)

    monkeypatch.setenv("LLM_BASE_URL", "https://router.example/api/v1")
    monkeypatch.setenv("LLM_MODEL", "some-vendor/some-model")
    monkeypatch.setenv("LLM_API_KEY", "key-for-router")
    call()

    assert default_url == "https://api.openai.com/v1/chat/completions"
    request = wire.requests[-1]
    assert str(request.url) == "https://router.example/api/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer key-for-router"
    # Same body apart from the model.
    assert wire.last_body == {**default_body, "model": "some-vendor/some-model"}


def test_llm_api_key_wins_over_openai_api_key(wire, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "old")
    monkeypatch.setenv("LLM_API_KEY", "new")
    call()
    assert wire.requests[-1].headers["authorization"] == "Bearer new"


def test_blank_variables_count_as_unset(wire, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    monkeypatch.setenv("LLM_BASE_URL", "  ")
    monkeypatch.setenv("LLM_MODEL", "")
    call()
    assert str(wire.requests[-1].url).startswith("https://api.openai.com/v1/")
    assert wire.last_body["model"] == "gpt-4o-mini"


def test_extra_body_is_merged_into_the_request(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    extra = {"provider": {"only": ["acme"], "allow_fallbacks": False}}
    monkeypatch.setenv("LLM_EXTRA_BODY", json.dumps(extra))
    call()
    assert wire.last_body["provider"] == extra["provider"]
    assert wire.last_body["messages"] == MESSAGES


@pytest.mark.parametrize("raw", ["{not json", "[1, 2]", '"text"'])
def test_invalid_extra_body_is_a_config_error_without_a_request(wire, monkeypatch, raw):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_EXTRA_BODY", raw)
    with pytest.raises(llm.LLMConfigError):
        call()
    assert wire.requests == []


def test_missing_api_key_is_a_config_error_that_names_no_secret(wire):
    with pytest.raises(llm.LLMConfigError, match="LLM_API_KEY"):
        call()
    assert wire.requests == []


def test_empty_content_returns_empty_string(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    wire.handler = lambda request: httpx.Response(
        200,
        json={
            "id": "c",
            "object": "chat.completion",
            "created": 0,
            "model": "x",
            "choices": [
                {"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": None}}
            ],
        },
    )
    llm._client_for.cache_clear()
    assert call() == ""


def test_no_other_backend_module_imports_the_provider_sdk():
    server_dir = Path(__file__).resolve().parent.parent
    offenders = []
    for path in server_dir.glob("*.py"):
        if path.name == "llm.py":
            continue
        text = path.read_text()
        if "import openai" in text or "from openai" in text:
            offenders.append(path.name)
    assert offenders == []
