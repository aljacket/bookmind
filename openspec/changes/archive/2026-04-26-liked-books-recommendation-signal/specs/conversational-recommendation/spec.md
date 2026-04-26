## ADDED Requirements

### Requirement: Optional liked-books context on recommendation requests
The `POST /recommendations` endpoint SHALL accept an optional `liked_books` field on the request body, structured as a list of `{ title: string, author: string }` items. When present and non-empty, the recommendation prompt builder SHALL render a "Books the reader has previously loved" section before the transcript. When absent or empty, the endpoint SHALL behave exactly as before. The clarifier endpoint (`POST /recommendations/clarify`) SHALL NOT accept this field — it remains transcript-only.

#### Scenario: Liked books are rendered in the prompt
- **WHEN** the request body includes `liked_books: [{title: "Klara and the Sun", author: "Kazuo Ishiguro"}, ...]`
- **THEN** the recommendation prompt sent to the LLM contains a labelled section listing the titles and authors before the transcript

#### Scenario: Empty or absent liked_books leaves prompt unchanged
- **WHEN** the request omits `liked_books` or sends an empty list
- **THEN** the recommendation prompt is identical to the prior transcript-only prompt; no empty section header is rendered

#### Scenario: Reasons may cite liked books
- **WHEN** liked-books context is present in the prompt
- **THEN** the system prompt allows each `reason` to cite either the transcript or a liked book (e.g., "since you loved X, try Y") instead of being restricted to transcript-only grounding

#### Scenario: Clarifier endpoint rejects liked_books
- **WHEN** a client posts `liked_books` to `/recommendations/clarify`
- **THEN** the field is ignored or rejected by Pydantic; the clarifier prompt remains transcript-only

### Requirement: Liked-books are not persisted server-side
The backend SHALL NOT write the `liked_books` payload to any datastore, log file, or third-party system beyond the in-flight LLM request. The privacy guarantee that applies to the transcript SHALL apply identically to liked books.

#### Scenario: Liked books not written to disk
- **WHEN** a recommendation request including `liked_books` is handled
- **THEN** the handler does not write any liked-books content to a database, file, or persistent log; only operational metadata (timestamp, status, latency, count) may be logged
