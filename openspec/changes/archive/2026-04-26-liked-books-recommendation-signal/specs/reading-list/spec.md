## ADDED Requirements

### Requirement: Saved book status
Each entry in the reading list SHALL carry a `status` field of either `to-read` (default) or `read`. New entries created from any save action default to `to-read`.

#### Scenario: New save defaults to to-read
- **WHEN** the user adds a book to the reading list (e.g., via the heart icon on a recommendation card)
- **THEN** the persisted entry has `status = 'to-read'` and `liked = false`

#### Scenario: Status can be toggled
- **WHEN** the user toggles a saved book's status on the Reading List page
- **THEN** the persisted entry's `status` flips between `to-read` and `read`, and the change is visible immediately without a page reload

#### Scenario: Legacy entries normalize to to-read
- **WHEN** the reading list is read from IndexedDB and an entry is missing the `status` field (saved before this capability shipped)
- **THEN** the entry is treated as `to-read` and rendered accordingly; no error or visual gap is shown

### Requirement: Liked flag on read books
A saved book with `status = 'read'` SHALL also carry a `liked` boolean flag (default `false`). The flag SHALL only be modifiable when the book is in the `read` state. Switching a book back to `to-read` SHALL reset `liked` to `false`.

#### Scenario: Liking a read book
- **WHEN** the user taps the heart-on-read affordance for a book whose status is `read`
- **THEN** the entry's `liked` toggles between `true` and `false`, and the icon reflects the new state

#### Scenario: Liked control hidden on to-read books
- **WHEN** a card's status is `to-read`
- **THEN** no heart-for-liked control is visible on that card (only the status toggle and the existing remove control)

#### Scenario: Reverting to to-read clears liked
- **WHEN** the user changes a `read + liked = true` book back to `to-read`
- **THEN** `liked` is reset to `false` so a future re-read state starts fresh

### Requirement: Per-user persistence in IndexedDB
The reading list including `status` and `liked` SHALL be persisted in the existing IndexedDB `readingList` store, keyed per Firebase auth user (`${userId}_readingList`). No book records SHALL be written to Firestore or any server-side store.

#### Scenario: Records stay client-side
- **WHEN** the user saves, toggles status, or toggles liked on any book
- **THEN** the change is written only to IndexedDB; no network request is fired to a backend persistence endpoint

#### Scenario: Records are isolated per user
- **WHEN** a different Firebase user signs in on the same device
- **THEN** they see their own reading list; the prior user's saved books are not visible

### Requirement: Liked books are sent as a recommendation signal
When the user requests new recommendations, the frontend SHALL include the user's liked books as an optional `liked_books` array on the `POST /recommendations` request. Each entry SHALL contain only `title` and `author`. The array SHALL be capped at the 20 most-recently saved liked books, ordered newest-first. When the user has zero liked books, the field SHALL be omitted (not sent as an empty array).

#### Scenario: Liked books are included
- **WHEN** the user has at least one `read + liked` book and triggers `fetchRecommendations`
- **THEN** the request body contains `liked_books: [{ title, author }, ...]` capped at 20 entries, newest first

#### Scenario: No liked books, field omitted
- **WHEN** the user has zero `read + liked` books and triggers `fetchRecommendations`
- **THEN** the request body does not include the `liked_books` key at all

#### Scenario: Liked books carry only title and author
- **WHEN** the recommendation request is constructed
- **THEN** each entry in `liked_books` contains only `title` and `author`; no `isbn`, `thumbnailUrl`, `reason`, or other metadata is sent

### Requirement: Liked-books transparency
The AI transparency disclosure shown in the chat view SHALL state that, in addition to the conversation, the user's liked books are sent to OpenAI in the request and not stored server-side. The disclosure SHALL remain a static, non-AI-generated string and SHALL be localized in en/es/it.

#### Scenario: Disclosure mentions liked books
- **WHEN** the chat view renders the transparency note
- **THEN** the note explicitly states that liked books are part of the request payload and are not stored on the server
