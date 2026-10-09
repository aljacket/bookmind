## ADDED Requirements

### Requirement: Users can report AI-generated content in the app

Each AI-generated item shown to the user (the clarifier question and each recommendation's reason) SHALL offer a "Report" action. The action SHALL let the user choose a reason (offensive, inaccurate, other) and send the report without leaving the app, and SHALL confirm receipt.

#### Scenario: Report a recommendation

-   **WHEN** the user reports a recommendation as offensive
-   **THEN** a request is sent to `POST /reports` and a localized confirmation is shown, without navigating away from the recommendations

#### Scenario: Report fails

-   **WHEN** `POST /reports` fails
-   **THEN** a localized error is shown and the user can try again

### Requirement: Reports are logged without identifying the user

`POST /reports` SHALL require a valid ID token and SHALL be limited per UID per day by `DAILY_REPORT_LIMIT` (default 20). It SHALL accept only `kind` (`clarifier` or `recommendation`), `lang`, `content` (at most 1000 characters) and `reason`. It SHALL write one structured log entry that contains neither the UID nor the conversation transcript, SHALL NOT persist the report in any datastore, and SHALL return 204.

#### Scenario: Valid report

-   **WHEN** an authenticated client posts a valid report
-   **THEN** the response is 204 and exactly one log entry is written, containing kind, lang, content and reason, and no UID

#### Scenario: Oversized content

-   **WHEN** `content` is longer than 1000 characters
-   **THEN** the response is 422 and nothing is logged
