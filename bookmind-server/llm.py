"""The only module that talks to the LLM provider.

Every call to a language model goes through `chat()`. The provider is chosen by environment
variables, so moving to another OpenAI-compatible endpoint (OpenRouter, Hugging Face Inference
Providers, ...) needs no code change:

- ``LLM_BASE_URL``   OpenAI-compatible base URL. Unset or empty: the OpenAI default.
- ``LLM_MODEL``      Model name. Default ``gpt-4o-mini``.
- ``LLM_API_KEY``    API key. Falls back to ``OPENAI_API_KEY``.
- ``LLM_EXTRA_BODY`` Optional JSON object merged into every request body, for router options the
                     OpenAI SDK does not model (for example OpenRouter's ``provider`` object).

No other backend module imports the ``openai`` SDK.
"""

import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

from openai import OpenAI

DEFAULT_MODEL = "gpt-4o-mini"


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


@lru_cache(maxsize=4)
def _client_for(base_url: Optional[str], api_key: str) -> OpenAI:
    # base_url=None makes the SDK use OPENAI_BASE_URL or the OpenAI default.
    return OpenAI(api_key=api_key, base_url=base_url)


def chat(
    messages: List[Dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
) -> str:
    """Send one chat completion and return the stripped text of the first choice ('' if empty)."""
    client = _client_for(_get_base_url(), _get_api_key())
    extra_body = _get_extra_body()
    kwargs: Dict[str, Any] = {}
    if extra_body:
        kwargs["extra_body"] = extra_body
    response = client.chat.completions.create(
        model=get_model(),
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **kwargs,
    )
    return (response.choices[0].message.content or "").strip()
