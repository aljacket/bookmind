## 1. Frontend types and storage

- [x] 1.1 In `src/types/userPreferences.ts`, extend `BookRecommendation` with `status?: 'to-read' | 'read'` and `liked?: boolean`. Export a `ReadStatus` type alias. Also added `savedAt?: number` to support recency sort in 3.1.
- [x] 1.2 In `src/services/indexedDB/userPreferences.ts`, add a `normalizeSavedBook(entry)` helper that fills missing `status` (→ `'to-read'`) and `liked` (→ `false`). Apply it inside `getReadingList()` before returning. Also fills missing `savedAt` (→ `0`).
- [x] 1.3 Added `setReadingListItemStatus(userId, book, status)` and `setReadingListItemLiked(userId, book, liked)` functions, keyed by `{title, author}` (consistent with existing identity in `addToReadingList`/`removeFromReadingList` — `googleBooksId` is not always present). The `liked` setter no-ops with a warn if the book is `to-read`. The status setter clears `liked` to `false` when transitioning to `to-read`.
- [x] 1.4 `addToReadingList` now stamps new entries with `status: 'to-read'`, `liked: false`, `savedAt: Date.now()`.

## 2. Frontend UI — Reading List page

- [x] 2.1 In `src/views/ReadingListPage.vue`, added a status pill toggle ("Da leggere" / "Letto") on each card; bound to `setReadingListItemStatus`. Pill is emerald when `read`, ink-grey when `to-read`, with check/circle icons.
- [x] 2.2 Like control rendered only when `status === 'read'`; bound to `setReadingListItemLiked`. Used a **star icon** (filled amber when liked, outline ink-grey otherwise) instead of a second heart — semantically clearer for "rate this read book" and immediately differentiates from the home-page save-heart.
- [x] 2.3 Visual differentiation achieved via icon swap: amber star (rating) vs. accent-coloured heart (save). No risk of confusion.
- [x] 2.4 Optimistic UI: toggles flip card state immediately; on error the prior state is restored and the list is reloaded from IndexedDB. No toast library introduced (out of scope) — `console.error` + reload is the rollback path.

## 3. Frontend recommendation service

- [x] 3.1 Added `getLikedBooksForRecommendation(userId)` in `src/services/recommendations/bookRecommendation.ts` — reads list, filters `status === 'read' && liked === true`, sorts by `savedAt` desc, slices to top 20, maps to `{ title, author }`. Cap exposed as `LIKED_BOOKS_PROMPT_CAP = 20`.
- [x] 3.2 `fetchRecommendations` now takes an optional `userId`, calls the helper when provided, includes `liked_books` only when non-empty (field is fully omitted when empty). Updated the only caller (`PreferencesPage.vue:239`) to pass `authStore.user.uid`.
- [x] 3.3 `fetchClarifier` unchanged — payload remains `{ lang, transcript }`.

## 4. Backend — request model and prompt builder

- [x] 4.1 `LikedBook(BaseModel)` defined in `bookmind-server/main.py` with `title`/`author` ≤200 chars. `RecommendationRequest.liked_books: List[LikedBook] | None = None` with `max_length=20`.
- [x] 4.2 Handler maps `request.liked_books` to a list of dicts and passes them to `build_recommendation_prompt(..., liked_books=...)`.
- [x] 4.3 `build_recommendation_prompt` extended with optional `liked_books` parameter; renders a localized "Books the reader has previously loved" section (en/es/it via `_LANG_LABELS["loved_books_label"]`) before the transcript when non-empty. When empty/None, the returned string is byte-identical to the prior implementation.
- [x] 4.4 `RECOMMENDATION_SYSTEM_PROMPT` rewritten to instruct the model that `reason` may cite either the transcript or a book from the loved-books list, with explicit framing that loved-books are a taste signal (not a strict template) and the transcript is primary.
- [x] 4.5 `ClarifyRequest` has no `liked_books` field; Pydantic v2 default `extra="ignore"` silently drops the field if a client posts it. The clarifier handler reads only `request.lang` and `request.transcript`.

## 5. Backend — privacy verification

- [x] 5.1 Audit complete: `request.liked_books` flows handler → list-comprehension to dicts → `build_recommendation_prompt`. No `open(`, `write`, `db.`, no logger statements touching the field. Operational metadata logging unchanged from prior change.
- [x] 5.2 No new imports/dependencies in `main.py` or `prompts.py`. No new env vars.

## 6. Frontend — transparency disclosure

- [x] 6.1 No template change required — the component already renders `t('ai_transparency')`. Update is purely textual via 6.2.
- [x] 6.2 `ai_transparency` updated in en/it/es to mention that liked books are also part of the OpenAI request and not stored server-side.

## 7. i18n — new keys + stale-key cleanup

- [x] 7.1 Added in en/es/it: `status_to_read`, `status_read`, `mark_as_read`, `mark_as_to_read`, `like_book`, `unlike_book`. (Used `like_book`/`unlike_book` for action tooltips instead of a generic `liked_label` noun, since the UI never renders a static "Liked" label.)
- [x] 7.2 All listed stale form keys removed from `en.json`, `es.json`, `it.json`.
- [x] 7.3 Verified by grep across `src/**/*.vue` and `src/**/*.ts`: no removed key is referenced. The few apparent matches (e.g., "long" inside `chat_input_too_long`) are substring false positives, not key references.

## 8. Verification

- [x] 8.1 `npm run type-check` runs clean (`vue-tsc --build --force` exits 0 with no diagnostics).
- [x] 8.2 Manual smoke test: save → mark as read → like → new recommendation flow with `liked_books` in payload. **User-confirmed 2026-04-26.**
- [x] 8.3 Manual locale walkthrough in en/es/it of Reading List page and chat view (transparency note). **User-confirmed 2026-04-26.**
- [x] 8.4 Token-count / cost check on a flow with liked books. **User-confirmed 2026-04-26.**
- [x] 8.5 Privacy spot-check with backend running — no `liked_books` content in server log. **User-confirmed 2026-04-26.**
