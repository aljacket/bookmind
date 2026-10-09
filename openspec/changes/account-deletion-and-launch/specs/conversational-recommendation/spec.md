## MODIFIED Requirements

### Requirement: AI transparency disclosure

The chat view SHALL display a static, non-AI-generated one-line disclosure stating that the conversation is sent to OpenAI, that no user profile is built, and that messages are not stored on BookMind's servers. The disclosure SHALL NOT claim that nothing is stored anywhere, and SHALL be consistent with the retention stated in the privacy policy. The disclosure SHALL be localized in en/es/it.

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
