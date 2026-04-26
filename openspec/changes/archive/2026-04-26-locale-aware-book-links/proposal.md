## Why

Today every Amazon link points to `https://www.amazon.com/s?k={isbn}` (search on the US store) regardless of the user's region — meaning an Italian user sees `.com` results with USD prices and no Prime eligibility, even though `amazon.it` exists and would convert better. The link is also a search URL, which can return zero results or the wrong edition; we have an unused `convertISBN13ToISBN10` utility that would let us link directly to the canonical product page (`/dp/{ISBN10}`). On top of that, every link is computed once at recommendation time and **persisted** in IndexedDB, so if a user later changes app language the cached `amazonLink` becomes stale — the persistence layer fights the localization.

Google Books is in a similar place: the `infoLink` returned by the API is used as-is, with no locale hint and no canonicalization, so the link can land on `play.google.com` or a low-quality preview depending on Google's mood.

The user explicitly does not want to add affiliate tags yet (no traffic to monetize). Scope is purely **correct routing**: the right store, the right product page, no stale links.

## What Changes

- Introduce a region-detection helper that maps `navigator.language` country code → Amazon TLD, with the app language as a secondary signal and `amazon.com` as the final fallback.
- Replace `generateAmazonLink(isbn)` with a richer `buildAmazonLink({ isbn10, isbn13 }, region)` that prefers `https://www.amazon.<tld>/dp/{ISBN10}` (canonical product page) and falls back to `https://www.amazon.<tld>/s?k={ISBN13}` when only ISBN13 is available. Empty string when neither is present (button hidden).
- Auto-convert ISBN13 → ISBN10 inside the builder using the existing `convertISBN13ToISBN10` utility (currently unused) when ISBN10 is missing but ISBN13 is present.
- Build Google Books links from `googleBooksId` against the canonical `https://books.google.com/books?id={id}&hl={lang}` form, instead of passing through whatever `infoLink` Google returned. `hl` uses the app language.
- Stop persisting `amazonLink` and `googleBooksLink` on saved books and recommendations: the link is derived at render time from the persisted ISBNs / `googleBooksId` + the user's current locale. This keeps links correct after a language switch without a migration.
- Remove `googleBooksLink` and `amazonLink` enrichment from `processRecommendations` (`HomePage.vue`) and from the `getBookDetails` return shape; the templates compute via helpers.
- Drop `amazonLink` and `googleBooksLink` from the `BookRecommendation` interface (legacy fields in stored records are simply ignored on read).
- No HTTP-level URL verification: the URL forms are constructed against Amazon's/Google's stable contract (search URLs always 200, `/dp/{ISBN10}` 200s for any valid ASIN-format ISBN10, Google Books `?id=` 200s for any valid volume ID). HTTP-pinging from the browser is CORS-blocked anyway, and adding a backend HEAD-check per recommendation is out-of-scope for the value it adds.

## Capabilities

### New Capabilities
- `book-links`: locale-aware construction of Amazon and Google Books URLs from the persisted book identifiers (`isbn10`, `isbn13`, `googleBooksId`), driven by the user's browser/app locale.

### Modified Capabilities

(none — `reading-list` and `conversational-recommendation` specs don't currently say anything about purchase-link construction, so this change is additive.)

## Impact

- **New files**:
  - `src/utils/storeRegion.ts` — region detection (browser locale → country → Amazon TLD).
  - `src/utils/bookLinks.ts` — `buildAmazonLink` and `buildGoogleBooksLink` helpers, plus the small TLD whitelist.
- **Frontend modifications**:
  - `src/utils/isbnUtils.ts` — drop the old `generateAmazonLink` (superseded). `convertISBN13ToISBN10` stays.
  - `src/services/googleBooks/googleBooksApi.ts` — stop returning `googleBooksLink` from `getBookDetails`. Keep returning `googleBooksId` (already present implicitly via API but not surfaced — confirm).
  - `src/types/userPreferences.ts` — remove `amazonLink` and `googleBooksLink` from `BookRecommendation`.
  - `src/views/HomePage.vue` — `processRecommendations` no longer enriches with links; template calls `buildAmazonLink`/`buildGoogleBooksLink` with the current language store.
  - `src/views/ReadingListPage.vue` — same: template calls helpers, drops `book.amazonLink`/`book.googleBooksLink`.
- **No backend changes.** No new dependencies, no new env vars.
- **Persisted records**: existing records in IndexedDB may still have stale `amazonLink`/`googleBooksLink` properties — they are simply ignored on read because the type no longer references them. No migration required.
