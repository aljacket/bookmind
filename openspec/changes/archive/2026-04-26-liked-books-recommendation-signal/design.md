## Context

The reading list (`src/views/ReadingListPage.vue` + IndexedDB store `readingList` in `src/services/indexedDB/userPreferences.ts`) currently stores a flat `BookRecommendation[]` per user. The home page's heart icon (`src/views/HomePage.vue:62-84`) toggles add/remove. There is no notion of having actually finished a book or having liked it.

The recommendation backend (`bookmind-server/main.py`) consumes only `{ lang, transcript }` (2-3 turn chat). `bookmind-server/prompts.py:build_recommendation_prompt` formats the transcript into a single prompt; there is no extension point for prior reading history.

We want to add a personal taste signal — books the reader has read and liked — and feed it into the recommendation prompt without breaking the privacy stance established in the prior change (no server-side persistence of user content, transcript-only request).

## Goals / Non-Goals

**Goals:**
- Let users mark saved books as `read` (vs default `to-read`) and, on `read` books, toggle a `liked` flag.
- Use `read + liked` books as an additional grounding signal for the recommendation LLM.
- Stay 100% client-side for storage (extend the existing IndexedDB store, no Firestore).
- Preserve the no-persistence privacy guarantee on the backend (`liked_books` is request-scoped only).
- Bundle the deferred i18n cleanup from the prior change so we don't carry dead strings forward.

**Non-Goals:**
- No "disliked" or 3-state rating — explicitly chose binary like in the proposal Q&A.
- No `to-read` signal sent to the recommender (aspirational books are noise, not taste).
- No clarifier-endpoint changes — clarifier stays transcript-only and short.
- No backfill of `read`/`liked` from external sources (Goodreads etc.).
- No multi-device sync — keeping IndexedDB-local is fine for MVP; cross-device sync is a future capability.
- No new auth/permissions — per-user keying via the existing Firebase auth UID continues unchanged.

## Decisions

### Decision 1: Extend `BookRecommendation` vs. introduce a `SavedBook` wrapper
**Choice:** Extend the existing `BookRecommendation` type with two new optional fields, `status?: 'to-read' | 'read'` and `liked?: boolean`. Default `status='to-read'`, `liked=false`.

**Why:** The IndexedDB `readingList` store already serializes `BookRecommendation`. Wrapping in a separate `SavedBook` type would force a migration of every read site (Home, Reading List page, recommendation rendering). Optional fields on the existing type are forward-compatible: code that doesn't care about status keeps working, code that does treats absent values as `to-read` / `false`.

**Alternatives considered:**
- New `SavedBook = { book: BookRecommendation, status, liked, savedAt }` wrapper — cleaner separation but forces a one-shot migration of consumers. Overkill for two fields.
- Two separate IndexedDB stores (`toRead` and `read`) — over-models the state machine; transitions between states would be expensive (delete + insert).

### Decision 2: Schema migration for existing reading-list entries
**Choice:** Lazy migration on read. When `getReadingList()` returns entries, normalize each: missing `status` → `'to-read'`, missing `liked` → `false`. No schema version bump, no upfront write.

**Why:** Existing users already have flat `BookRecommendation[]` in IndexedDB. Lazy normalization avoids an upgrade-handler in `indexedDB.open()` and keeps the change small. Writes (`addToReadingList`, status/liked toggles) write the new shape going forward.

**Risk:** if a future migration needs an actual versioned upgrade, we'll have heterogeneous records to handle. Mitigation: when the normalize-on-read sees an old shape, it can opportunistically rewrite that record to the new shape so the store self-heals over time. Not strictly required for this change.

### Decision 3: `liked_books` payload shape and cap
**Choice:** Send `liked_books: { title: string, author: string }[]`, capped at the **20 most-recently saved** liked books, sorted newest-first. Cap is enforced client-side.

**Why:** The LLM only needs title+author to ground a "the reader has loved..." sentence; sending full metadata (ISBN, thumbnail) wastes tokens. A 20-item cap keeps the prompt under ~400 added tokens worst case (well within `gpt-4o-mini`'s 8k context budget) and keeps the cost target (~$0.001/session) intact. Most-recent-first because recent likes are stronger signals of current taste than likes from years ago.

**Alternatives considered:**
- No cap → unbounded prompt growth as a user accumulates likes; eventually breaks budget.
- Send full `BookRecommendation` objects → wastes tokens with thumbnails/ISBNs the model doesn't need.

### Decision 4: Where to inject `liked_books` in the prompt
**Choice:** `build_recommendation_prompt` adds a new section between the system prompt header and the transcript: `"Books the reader has previously loved:"` followed by a bulleted list. Omitted entirely when `liked_books` is empty/None.

**Why:** Keeping it as a labelled section before the transcript makes it obvious to the model that these are *prior* signals (not part of the current conversation), which prevents the model from "citing" a liked book as if the user mentioned it in chat. The system prompt is already updated to instruct the model to ground reasons in either the transcript *or* the liked-books list — so a reason like "since you loved X, try Y" is now valid.

### Decision 5: Privacy — no server-side logging of `liked_books`
**Choice:** Treat `liked_books` exactly like `transcript`: request-scoped only, never written to disk/DB/log. Update the `AiTransparencyNote.vue` copy to mention that liked books are also sent in-flight only.

**Why:** Consistent with the existing privacy commitment from `2026-04-26-conversational-recommendation`. Liked books reveal more about the user than chat transcripts do (long-term taste vs. one-session mood), so the same guarantee must hold.

### Decision 6: Bundle the i18n cleanup in this change
**Choice:** Remove the stale form keys from `en.json` / `es.json` / `it.json` as part of the same change, and add the new keys for read-status and liked-label here.

**Why:** Both touch the same files; doing them together avoids a follow-up PR with a 3-line diff per locale. Verified zero references in `src/` so the removal is mechanical.

## Risks / Trade-offs

- **[Risk] Lazy migration leaves heterogeneous shapes in IndexedDB indefinitely.** → Mitigation: normalize-on-read rewrites old entries when found (Decision 2). After one full read of the list, all entries are normalized.
- **[Risk] Liked-books context could push the model to recommend books too similar to what the user already loved (filter bubble).** → Mitigation: the prompt explicitly says "use these as a taste signal, not as a strict template — the user's current chat is the primary input." Tweak in prompt language, not code.
- **[Risk] User accumulates 50+ liked books over time, prompt grows.** → Mitigation: 20-item cap (Decision 3). Most-recent-first means stale likes drop out naturally.
- **[Trade-off] No "disliked" signal means the model has no way to learn what to avoid.** → Accepted per proposal Q&A (binary keeps UI simpler). Easy to add later as a 3-state if recommendation quality demands it.
- **[Trade-off] Per-device only (IndexedDB).** → Accepted: cross-device sync is its own capability and would require Firestore + auth-keyed records.

## Migration Plan

1. Type changes (frontend) — add optional fields, no break.
2. IndexedDB read path — normalize-on-read.
3. UI in `ReadingListPage.vue` — status toggle + heart on read items.
4. Frontend recommendation service — read liked books from IndexedDB, include in `fetchRecommendations` payload.
5. Backend — add `liked_books` to `RecommendationRequest`, pass through to prompt builder.
6. Prompt builder — render the optional "books loved" section.
7. i18n cleanup — remove old form keys, add new status/liked keys.
8. Smoke-test the full flow per locale (en/es/it).

No rollback complexity: removing the field on the backend is backwards-compatible (frontend already treats it as optional).

## Open Questions

- Is "Letto" / "Da leggere" the right Italian label or should it be "Già letto" / "Da leggere"? Will let the in-locale review during implementation settle this.
- Should the heart icon on a `read` book be visually different from the heart icon on the home page (which means "save")? Probably yes — different colors or a filled vs. outline star — but defer to implementation taste.
