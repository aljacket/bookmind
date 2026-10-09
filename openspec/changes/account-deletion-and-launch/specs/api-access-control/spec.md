## ADDED Requirements

### Requirement: Recommendation API requires a Firebase ID token

`POST /recommendations/clarify`, `POST /recommendations` and `POST /reports` SHALL require an `Authorization: Bearer <Firebase ID token>` header verified with `firebase-admin` with revocation checking enabled (`check_revoked=True`). A missing, malformed, expired or revoked token, or a token of a deleted or disabled user, SHALL return HTTP 401 before any OpenAI call is made.

#### Scenario: No token

-   **WHEN** a client posts a valid body to `/recommendations` without an `Authorization` header
-   **THEN** the response is 401 and OpenAI is not called

#### Scenario: Token of a deleted user

-   **WHEN** a client posts with an unexpired ID token whose Firebase user has been deleted
-   **THEN** the response is 401 and OpenAI is not called

#### Scenario: Valid token

-   **WHEN** a client posts a valid body with a valid ID token and the user is under the daily limit
-   **THEN** the request is processed exactly as before this change

### Requirement: Daily per-user quota on LLM calls

The backend SHALL count every call to `/recommendations/clarify` and `/recommendations` per UID per UTC day in Firestore, and SHALL increment the count before calling OpenAI. When the count has reached `DAILY_LLM_CALL_LIMIT` (environment variable, default 10), the request SHALL return HTTP 429 without calling OpenAI.

#### Scenario: Limit reached

-   **WHEN** a user who has already made `DAILY_LLM_CALL_LIMIT` calls today sends another one
-   **THEN** the response is 429 and OpenAI is not called

#### Scenario: New UTC day

-   **WHEN** the same user calls again after 00:00 UTC
-   **THEN** the call is counted against the new day and succeeds

### Requirement: Quota records expire

Every quota document SHALL carry an `expireAt` timestamp no later than 48 hours after the start of the UTC day it counts. A Firestore TTL policy on that field SHALL delete expired documents. No other server-side record SHALL be keyed by UID.

#### Scenario: Counter carries an expiry

-   **WHEN** a quota document is created
-   **THEN** it has an `expireAt` field set to the start of the next UTC day plus 24 hours

### Requirement: CORS origins come from configuration

The allowed CORS origins SHALL be read from the `CORS_ALLOWED_ORIGINS` environment variable. The production value SHALL contain only the Firebase Hosting origins and the Capacitor app origins, and SHALL NOT contain any `http://localhost` or `10.0.2.2` origin.

#### Scenario: Unknown origin

-   **WHEN** a browser preflight comes from an origin that is not in `CORS_ALLOWED_ORIGINS`
-   **THEN** the response carries no `Access-Control-Allow-Origin` header for that origin
