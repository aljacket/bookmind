## MODIFIED Requirements

### Requirement: AI transparency disclosure

The chat view SHALL display a static, non-AI-generated one-line disclosure stating that the conversation is sent to the third-party AI provider named in the privacy policy, that no user profile is built, and that messages are not stored on BookMind's servers. The disclosure SHALL NOT claim that nothing is stored anywhere, and SHALL be consistent with the retention stated in the privacy policy. The disclosure SHALL be localized in en/es/it.

#### Scenario: Disclosure is visible during the chat

-   **WHEN** the chat view is rendered (at any turn from opener through recommendations)
-   **THEN** the disclosure line is visible without requiring a click or expansion

#### Scenario: Disclosure text is hard-coded

-   **WHEN** the chat view renders the disclosure
-   **THEN** its text is sourced from a static i18n dictionary in the frontend, not from any LLM call

#### Scenario: Disclosure does not overclaim

-   **WHEN** the `ai_transparency` string is read in en, es and it
-   **THEN** none of them states or implies that the messages are stored nowhere; each scopes the "not stored" claim to BookMind's servers

## ADDED Requirements

### Requirement: Quota and session errors are explained in the chat

When the recommendation API returns 429, the chat SHALL show a localized "daily limit reached" message. When it returns 401, it SHALL show a localized "session expired, sign in again" message. In both cases the failed turn SHALL be rolled back so that its text is restored in the input.

#### Scenario: Daily limit

-   **WHEN** `/recommendations` returns 429
-   **THEN** the chat shows the localized daily-limit message, the turn counter is not advanced, and the user's text is back in the input

#### Scenario: Expired session

-   **WHEN** `/recommendations/clarify` returns 401
-   **THEN** the chat shows the localized session message with a way to sign in again

### Requirement: LLM provider and model come from configuration

The backend SHALL make every LLM call through a single module that reads the OpenAI-compatible base URL (`LLM_BASE_URL`; when unset, the OpenAI default), the model (`LLM_MODEL`, default `gpt-4o-mini`), the API key (`LLM_API_KEY`, falling back to `OPENAI_API_KEY`), an optional JSON object of extra request fields (`LLM_EXTRA_BODY`, for router options such as provider pinning or model options such as `reasoning_effort`), the name under which the output token limit is sent (`LLM_TOKEN_LIMIT_PARAM`: `max_tokens` by default, or `max_completion_tokens`), and whether `/recommendations` asks for a JSON object response (`LLM_JSON_MODE`, on by default) from the environment. `/recommendations/clarify` SHALL never ask for a JSON object response. The module SHALL NOT select request parameters from a list of model names. Switching to another OpenAI-compatible provider or model SHALL require only environment changes. No other backend module SHALL call the provider SDK directly.

#### Scenario: Default configuration

-   **WHEN** only `OPENAI_API_KEY` is set
-   **THEN** `/recommendations/clarify` and `/recommendations` call OpenAI with model `gpt-4o-mini` and send the token limit as `max_tokens`, as before this change
-   **AND** only `/recommendations` adds `response_format` of type `json_object`

#### Scenario: Alternative provider by environment

-   **WHEN** `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY` point to another OpenAI-compatible endpoint
-   **THEN** both endpoints send their requests to that base URL with that model, and their request and response bodies are unchanged

#### Scenario: Model that requires max_completion_tokens

-   **WHEN** `LLM_MODEL` is `gpt-6-luna`, `LLM_TOKEN_LIMIT_PARAM` is `max_completion_tokens` and `LLM_EXTRA_BODY` is `{"reasoning_effort": "none"}`
-   **THEN** both endpoints send the same token limits as `max_completion_tokens`, send no `max_tokens`, and include `reasoning_effort` set to `none`

#### Scenario: JSON mode off

-   **WHEN** `LLM_JSON_MODE` is `false`
-   **THEN** neither endpoint sends `response_format`
