"""The only module that talks to the LLM provider.

Every call to a language model goes through `chat()`. The provider is chosen by environment
variables, so moving to another OpenAI-compatible endpoint (OpenRouter, Hugging Face Inference
Providers, ...) or to another model needs no code change:

- ``LLM_BASE_URL``   OpenAI-compatible base URL. Unset or empty: the OpenAI default.
- ``LLM_MODEL``      Model name. Default ``gpt-4o-mini``.
- ``LLM_API_KEY``    API key. Falls back to ``OPENAI_API_KEY``.
- ``LLM_EXTRA_BODY`` Optional JSON object merged into every request body, for router options the
                     OpenAI SDK does not model (for example OpenRouter's ``provider`` object) or
                     model options such as ``{"reasoning_effort": "none"}``.
- ``LLM_TOKEN_LIMIT_PARAM``
                     Name under which the output token limit is sent: ``max_tokens`` (default) or
                     ``max_completion_tokens`` (OpenAI's newest models reject the first).
- ``LLM_JSON_MODE`` ``true`` (default) or ``false``. When on, a call made with ``json_object=True``
                     sends ``response_format: {"type": "json_object"}``. A call that does not ask
                     for it never sends it.

Request parameters are never chosen from a model name, and a rejected request is never retried
with other parameters: the environment is the single source of truth.

No other backend module imports the ``openai`` SDK.
"""

import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

from openai import OpenAI

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TOKEN_LIMIT_PARAM = "max_tokens"
TOKEN_LIMIT_PARAMS = ("max_tokens", "max_completion_tokens")
_TRUE_WORDS = ("true", "1", "yes", "on")
_FALSE_WORDS = ("false", "0", "no", "off")


class LLMConfigError(RuntimeError):
    """The LLM provider is not configured correctly. The message never contains a secret."""


def _env(name: str) -> Optional[str]:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


def get_model() -> str:
    return _env("LLM_MODEL") or DEFAULT_MODEL


def _get_base_url() -> Optional[str]:
    return _env("LLM_BASE_URL")


def _get_api_key() -> str:
    key = _env("LLM_API_KEY") or _env("OPENAI_API_KEY")
    if not key:
        raise LLMConfigError("Neither LLM_API_KEY nor OPENAI_API_KEY is set")
    return key


def _get_extra_body() -> Optional[Dict[str, Any]]:
    raw = _env("LLM_EXTRA_BODY")
    if raw is None:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMConfigError("LLM_EXTRA_BODY is not valid JSON") from exc
    if not isinstance(parsed, dict):
        raise LLMConfigError("LLM_EXTRA_BODY must be a JSON object")
    return parsed


def _get_token_limit_param() -> str:
    raw = _env("LLM_TOKEN_LIMIT_PARAM")
    if raw is None:
        return DEFAULT_TOKEN_LIMIT_PARAM
    if raw not in TOKEN_LIMIT_PARAMS:
        # The value is not echoed: nothing taken from the environment goes into the message.
        raise LLMConfigError("LLM_TOKEN_LIMIT_PARAM must be max_tokens or max_completion_tokens")
    return raw


def _get_json_mode() -> bool:
    raw = _env("LLM_JSON_MODE")
    if raw is None:
        return True
    word = raw.lower()
    if word in _TRUE_WORDS:
        return True
    if word in _FALSE_WORDS:
        return False
    raise LLMConfigError("LLM_JSON_MODE must be true or false")


@lru_cache(maxsize=4)
def _client_for(base_url: Optional[str], api_key: str) -> OpenAI:
    # base_url=None makes the SDK use OPENAI_BASE_URL or the OpenAI default.
    return OpenAI(api_key=api_key, base_url=base_url)


def chat(
    messages: List[Dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    json_object: bool = False,
) -> str:
    """Send one chat completion and return the stripped text of the first choice ('' if empty).

    ``max_tokens`` is the output token limit. It goes to the provider under the name chosen by
    ``LLM_TOKEN_LIMIT_PARAM`` and never under the other one. ``json_object=True`` asks for a JSON
    object response unless ``LLM_JSON_MODE`` is off. It is a per-call option because the clarifier
    answers in plain text, and OpenAI rejects ``json_object`` there.
    """
    # Read the whole configuration first, so a bad value fails before any request is made.
    api_key = _get_api_key()
    extra_body = _get_extra_body()
    token_limit_param = _get_token_limit_param()
    json_mode = _get_json_mode()
    client = _client_for(_get_base_url(), api_key)
    kwargs: Dict[str, Any] = {token_limit_param: max_tokens}
    if extra_body:
        kwargs["extra_body"] = extra_body
    if json_object and json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(
        model=get_model(),
        messages=messages,
        temperature=temperature,
        **kwargs,
    )
    return (response.choices[0].message.content or "").strip()
