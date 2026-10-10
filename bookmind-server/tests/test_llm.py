"""llm.py is the only module that calls the provider; the provider comes from the environment.

The OpenAI SDK runs for real here (see the `wire` fixture in conftest.py): only the HTTP transport is
replaced, so the tests assert on the request that would go over the wire (URL, Authorization header,
JSON body).
"""

import ast
import json
from pathlib import Path

import pytest

import llm
from tests.conftest import CLARIFY_BODY, LLM_RECOMMENDATIONS_JSON, RECOMMEND_BODY, bearer

MESSAGES = [
    {"role": "system", "content": "sys"},
    {"role": "user", "content": "hello"},
]


def call(**options):
    return llm.chat(MESSAGES, temperature=0.3, max_tokens=80, **options)


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
    monkeypatch.setenv("LLM_TOKEN_LIMIT_PARAM", " ")
    monkeypatch.setenv("LLM_JSON_MODE", "")
    call()
    assert str(wire.requests[-1].url).startswith("https://api.openai.com/v1/")
    assert wire.last_body["model"] == "gpt-4o-mini"
    assert wire.last_body["max_tokens"] == 80


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
    wire.content = None
    assert call() == ""


# -- token limit name (card #73) ---------------------------------------------------------------


def test_token_limit_is_sent_as_max_tokens_by_default(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    call()
    assert wire.last_body["max_tokens"] == 80
    assert "max_completion_tokens" not in wire.last_body


def test_token_limit_param_max_completion_tokens_replaces_max_tokens(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_TOKEN_LIMIT_PARAM", "max_completion_tokens")
    call()
    assert wire.last_body["max_completion_tokens"] == 80
    assert "max_tokens" not in wire.last_body


def test_token_limit_param_max_tokens_can_be_set_explicitly(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_TOKEN_LIMIT_PARAM", "max_tokens")
    call()
    assert wire.last_body["max_tokens"] == 80
    assert "max_completion_tokens" not in wire.last_body


@pytest.mark.parametrize("raw", ["max-tokens", "MAX_TOKENS", "max_completion_tokens,max_tokens", "sk-secret-looking-value"])
def test_invalid_token_limit_param_is_a_config_error_without_secrets(wire, monkeypatch, raw):
    monkeypatch.setenv("LLM_API_KEY", "key-that-must-not-leak")
    monkeypatch.setenv("LLM_TOKEN_LIMIT_PARAM", raw)
    with pytest.raises(llm.LLMConfigError) as error:
        call()
    assert wire.requests == []
    message = str(error.value)
    assert "LLM_TOKEN_LIMIT_PARAM" in message
    assert raw not in message and "key-that-must-not-leak" not in message


# -- JSON mode (card #73) ----------------------------------------------------------------------


def test_json_object_is_sent_only_when_the_call_asks_for_it(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    call()
    assert "response_format" not in wire.last_body
    call(json_object=True)
    assert wire.last_body["response_format"] == {"type": "json_object"}


def test_llm_json_mode_false_switches_it_off_for_every_call(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_JSON_MODE", "false")
    call(json_object=True)
    call()
    assert all("response_format" not in body for body in wire.bodies)


@pytest.mark.parametrize("raw", ["true", "TRUE", "1", "on", "yes"])
def test_llm_json_mode_true_words(wire, monkeypatch, raw):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_JSON_MODE", raw)
    call(json_object=True)
    assert wire.last_body["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("raw", ["false", "FALSE", "0", "off", "no"])
def test_llm_json_mode_false_words(wire, monkeypatch, raw):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_JSON_MODE", raw)
    call(json_object=True)
    assert "response_format" not in wire.last_body


def test_invalid_llm_json_mode_is_a_config_error_even_for_a_plain_call(wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_JSON_MODE", "maybe")
    with pytest.raises(llm.LLMConfigError, match="LLM_JSON_MODE"):
        call()
    assert wire.requests == []


# -- the endpoints, through the real llm.chat (card #73) ---------------------------------------

GPT_6_LUNA_ENV = {
    "LLM_API_KEY": "k",
    "LLM_MODEL": "gpt-6-luna",
    "LLM_TOKEN_LIMIT_PARAM": "max_completion_tokens",
    "LLM_EXTRA_BODY": '{"reasoning_effort": "none"}',
}


def post_both(wire_client, wire):
    wire.content = "Do you want a short read?"
    assert wire_client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer()).status_code == 200
    wire.content = LLM_RECOMMENDATIONS_JSON
    assert wire_client.post("/recommendations", json=RECOMMEND_BODY, headers=bearer()).status_code == 200
    clarify_body, recommend_body = wire.bodies
    return clarify_body, recommend_body


def test_default_configuration_sends_the_same_requests_as_before_plus_json_object(wire_client, wire, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    clarify_body, recommend_body = post_both(wire_client, wire)
    assert {str(r.url) for r in wire.requests} == {"https://api.openai.com/v1/chat/completions"}
    for body in (clarify_body, recommend_body):
        assert body["model"] == "gpt-4o-mini"
        assert "max_completion_tokens" not in body and "reasoning_effort" not in body
    assert (clarify_body["temperature"], clarify_body["max_tokens"]) == (0.3, 80)
    assert (recommend_body["temperature"], recommend_body["max_tokens"]) == (0.7, 400)
    assert "response_format" not in clarify_body
    assert recommend_body["response_format"] == {"type": "json_object"}
    # Nothing else differs from today's request.
    assert set(clarify_body) == {"model", "messages", "temperature", "max_tokens"}
    assert set(recommend_body) == {"model", "messages", "temperature", "max_tokens", "response_format"}


def test_gpt_6_luna_configuration_reaches_both_endpoints(wire_client, wire, monkeypatch):
    for name, value in GPT_6_LUNA_ENV.items():
        monkeypatch.setenv(name, value)
    clarify_body, recommend_body = post_both(wire_client, wire)
    for body in (clarify_body, recommend_body):
        assert body["model"] == "gpt-6-luna"
        assert body["reasoning_effort"] == "none"
        assert "max_tokens" not in body
    assert (clarify_body["temperature"], clarify_body["max_completion_tokens"]) == (0.3, 80)
    assert (recommend_body["temperature"], recommend_body["max_completion_tokens"]) == (0.7, 400)
    assert "response_format" not in clarify_body
    assert recommend_body["response_format"] == {"type": "json_object"}


def test_json_mode_off_sends_no_response_format_from_either_endpoint(wire_client, wire, monkeypatch):
    for name, value in GPT_6_LUNA_ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("LLM_JSON_MODE", "false")
    clarify_body, recommend_body = post_both(wire_client, wire)
    assert "response_format" not in clarify_body and "response_format" not in recommend_body


def test_the_clarifier_never_sends_response_format_whatever_the_configuration(wire_client, wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    for json_mode in ("true", "1", "false"):
        monkeypatch.setenv("LLM_JSON_MODE", json_mode)
        wire.content = "A question?"
        assert wire_client.post("/recommendations/clarify", json=CLARIFY_BODY, headers=bearer()).status_code == 200
    assert all("response_format" not in body for body in wire.bodies)


def test_an_invalid_token_limit_param_makes_the_endpoint_fail_without_calling_the_provider(wire_client, wire, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_TOKEN_LIMIT_PARAM", "oops")
    response = wire_client.post("/recommendations", json=RECOMMEND_BODY, headers=bearer())
    assert response.status_code == 500
    assert response.json() == {"detail": "Recommendation service error"}
    assert wire.requests == []


# -- structure rules (card #73) ----------------------------------------------------------------


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


def test_llm_py_has_no_model_name_list_and_no_retry_loop():
    tree = ast.parse((Path(__file__).resolve().parent.parent / "llm.py").read_text())
    docstrings = {
        id(node.body[0].value)
        for node in ast.walk(tree)
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.ClassDef))
        and node.body
        and isinstance(node.body[0], ast.Expr)
        and isinstance(node.body[0].value, ast.Constant)
    }
    strings = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings
    ]
    # The default model is the only model name in the code.
    assert [s for s in strings if "gpt" in s.lower()] == [llm.DEFAULT_MODEL]
    for family in ("claude", "gemini", "mistral", "llama", "sonnet", "haiku"):
        assert not [s for s in strings if family in s.lower()]
    # No loop, so a rejected request is never sent again with other parameters.
    assert not [n for n in ast.walk(tree) if isinstance(n, (ast.While, ast.For, ast.AsyncFor))]
