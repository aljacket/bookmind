## Why

Today the saved-books feature ("reading list") is a flat collection — there's no way to record which books the user has actually finished, or which they enjoyed. As a result, the recommender only sees the in-flight chat transcript and ignores the strongest taste signal we already have: the user's reading history. Adding read/liked tracking lets the AI ground recommendations in books the reader has personally validated, and gives the user a more useful library page in return. Bundled with this we also retire the stale i18n keys left over from the deprecated dropdown preferences form (flagged as cleanup follow-up in change `2026-04-26-conversational-recommendation`, task 7.1).

## What Changes

- Extend each saved book with a status (`to-read` | `read`) and, on `read` books, a binary `liked` flag (default unliked).
- Update `ReadingListPage.vue` so each card exposes a status toggle ("Da leggere" / "Letto") and, when `read`, a heart icon for `liked`.
- Persist the new fields in the existing IndexedDB `readingList` store (per-user keying preserved). No Firebase usage added.
- Frontend recommendation service collects the user's `read + liked` books (title + author only, capped at 20 most-recent) and sends them as an optional `liked_books` field on `POST /recommendations`.
- Backend `RecommendationRequest` accepts the new optional `liked_books` array; `build_recommendation_prompt` injects them as a "Books the reader has loved" section so the model can ground reasons against real taste signals. Clarifier endpoint is unchanged.
- Server-side persistence guarantee preserved: `liked_books` is read in-flight only, never written to disk, log, or DB.
- **Cleanup**: remove stale i18n keys for the old preferences form from `en.json`/`es.json`/`it.json` (`favorite_genre`, genre/length/period/complexity/purpose/learning-goal options, `remaining_calls_warning`). Verified unused in current codebase.

## Capabilities

### New Capabilities
- `reading-list`: tracking saved books with read/to-read status and a liked flag, including the contract for surfacing them as a recommendation signal.

### Modified Capabilities
- `conversational-recommendation`: the recommendation request gains an optional `liked_books` field that the recommendation prompt builder consumes; transcript-only behavior remains the default when the field is absent.

## Impact

- **Frontend**:
  - `src/types/userPreferences.ts` — add `ReadStatus`, `liked` to `BookRecommendation` (or to a wrapping `SavedBook` type).
  - `src/services/indexedDB/userPreferences.ts` — schema migration for the `readingList` store: existing entries default to `to-read` with `liked=false`.
  - `src/views/ReadingListPage.vue` — status toggle and heart UI per card.
  - `src/services/recommendations/bookRecommendation.ts` — read liked books from IndexedDB and include in `fetchRecommendations` payload.
  - `src/locales/{en,es,it}.json` — new keys for read status / liked label; remove stale form keys.
- **Backend**:
  - `bookmind-server/main.py` — extend `RecommendationRequest` with `liked_books: list[LikedBook] | None`; pass through to prompt builder.
  - `bookmind-server/prompts.py` — `build_recommendation_prompt` accepts `liked_books` and renders a "Books the reader has loved" section when non-empty.
- **No changes** to: clarifier endpoint, Firebase, auth flow, recommendation response shape.
