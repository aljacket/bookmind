## Context

`generateAmazonLink` lives at `src/utils/isbnUtils.ts:19` and unconditionally returns `https://www.amazon.com/s?k={isbn}`. Google Books links are returned as-is from the API in `src/services/googleBooks/googleBooksApi.ts:30`. Both links are computed during `processRecommendations` in `HomePage.vue` and persisted as fields on the `BookRecommendation` type, then re-read from IndexedDB on subsequent page loads.

The app language store (`src/stores/language.ts`) already reads `navigator.language` once at boot to seed the user's chosen language (en/es/it). The country half of the locale string (e.g. `IT` from `it-IT`) is currently discarded.

We don't have geo-IP, region pickers, or any other location signal — and the user has explicitly chosen to keep it that way for now.

## Goals / Non-Goals

**Goals:**
- Pick the right Amazon TLD for the user with high probability and zero infra.
- Prefer canonical product URLs (`/dp/{ISBN10}`) over search URLs when we have the ISBN10.
- Make links self-correct when the user changes app language (no stale persisted links).
- Keep all logic in pure helpers that are trivially unit-testable.

**Non-Goals:**
- Affiliate tags. The user has no Amazon Associates account; revisit when there's traffic.
- Geo-IP detection or a region picker UI.
- Server-side link verification (CORS-blocked from the browser, low ROI).
- Cross-edition matching ("the Italian translation of the same book"). The recommended book's ISBN is the source of truth; we route to whichever Amazon store sells *that* ISBN.
- A full Amazon TLD coverage matrix. We support a small whitelist (IT, ES, FR, DE, GB, plus US/COM fallback).

## Decisions

### Decision 1: Region detection chain
**Choice:** A three-step fallback inside a single pure function `detectStoreCountry()`:
1. Read `navigator.language`. If it contains a country code (regex `[a-z]{2}-([A-Z]{2})`), use it.
2. Else, map the app language to a likely country: `it → IT`, `es → ES`, `en → US`.
3. If the resolved country isn't in the Amazon TLD whitelist, fall back to `US`.

**Why:** The user picked "browser locale" as the primary signal. `navigator.language` is the only reliable signal we have without infrastructure, and the country-code suffix is correct ~95% of the time when present. The app-language fallback handles the (rare) case where `navigator.language` returns just `en` or `it`. The final whitelist filter prevents pointing a Norwegian user at `amazon.no` (which doesn't exist; we'd 404) — defaulting them to `.com` is safer.

**Alternatives considered:**
- Trust `navigator.language` blindly → can resolve to `NO`/`KR`/etc. without an Amazon store, breaking the link.
- Add a manual region picker → user explicitly rejected the friction in the proposal Q&A.

### Decision 2: Amazon TLD whitelist
**Choice:** Hard-coded map in `bookLinks.ts`:

```
IT → amazon.it
ES → amazon.es
FR → amazon.fr
DE → amazon.de
GB → amazon.co.uk
default → amazon.com
```

**Why:** Covers the three localized app languages (en/es/it) plus the two big European stores users in the EU may have configured (`fr-FR`, `de-DE`). Anyone outside these five lands on `.com` which always works. The list is small enough to stay in a hand-written object; expanding it later is one line per entry. Avoiding a sprawling 30-country map keeps the code reviewable.

### Decision 3: URL form preference (Amazon)
**Choice:** Try in this order, return the first that's possible:
1. `https://www.amazon.<tld>/dp/{ISBN10}` — direct product page, canonical.
2. `https://www.amazon.<tld>/dp/{ISBN10_DERIVED_FROM_ISBN13}` — derive ISBN10 from ISBN13 via the existing utility.
3. `https://www.amazon.<tld>/s?k={ISBN13}` — search fallback when ISBN13 is the only thing we have and it's not derivable (i.e., not 978-prefixed).
4. `''` — no link, button hidden.

**Why:** `/dp/{ISBN10}` is the most useful form — it lands on the actual product page with Buy Now, price, reviews. Search is a fallback because it can return ambiguous or empty results. ISBN13 → ISBN10 conversion is loss-less for any 978-prefixed ISBN13 (the vast majority), and the utility for it already exists and is currently unused. The 979-prefix case (newer ISBN13s without an ISBN10 equivalent) drops to the search URL.

**Alternatives considered:**
- Always use the search URL → simpler, but we already store ISBN10 most of the time and the product page is much more useful.
- Use the `gp/product/{ISBN10}` form → equivalent to `/dp/`; `/dp/` is shorter and standard.

### Decision 4: Google Books URL form
**Choice:** Build canonically as `https://books.google.com/books?id={googleBooksId}&hl={lang}` where `lang` is the app language. Ignore the `infoLink` returned by the API and stop surfacing it from `getBookDetails`.

**Why:** `infoLink` is opaque — it can be `play.google.com/books/reader?id=...`, `books.google.com/books?...`, or another shape depending on Google's response, which makes it unreliable. The canonical `?id=` form is stable and `hl` localizes the metadata page. Since we already persist `googleBooksId`, no new data is needed.

**Note:** The Google Books *API* does also accept an `&country=` parameter for sale-availability, but it's not strictly necessary for a metadata link. We pass only `hl`. `googleBooksId` is currently NOT explicitly stored by `getBookDetails` — task 4 covers adding it (it's already on the API response as `id` at the same level as `volumeInfo`).

### Decision 5: Stop persisting `amazonLink` and `googleBooksLink`
**Choice:** Remove both fields from the `BookRecommendation` interface. Templates derive the URL on render via helpers that take `(book, regionCountry, lang)` and return a string. Existing IndexedDB records may still have these JSON keys; they are simply ignored at read time.

**Why:** The user can change language at any time; persisted links would be wrong until the record is rewritten. Deriving on render is cheap (it's string concatenation) and keeps the data model honest — what we actually need to persist is the identifier (ISBN, googleBooksId), not the formatted link. Migration-free because we don't need to clean up the old keys: TypeScript ignores extra runtime properties on typed reads.

**Risk:** A future contributor might wonder why old JSON has `amazonLink`. Mitigated by an inline comment in the type file noting the deprecation; if the project ever does a real schema migration, those keys can be stripped then.

### Decision 6: No HTTP verification
**Choice:** Don't ping any URL to confirm it 200s. Build URLs against Amazon's/Google's stable URL contract instead.

**Why:** From the browser, Amazon CORS-blocks any HEAD/GET; we'd need a backend proxy. The proxy adds latency, costs, and a new failure mode. The actual failure modes ("Amazon doesn't sell this ISBN in this region") aren't surfaced via HEAD anyway — Amazon returns 200 with "no results" or "currently unavailable" — so the verification doesn't even catch the bug we'd want it to catch. Better to construct conservatively (search URL fallback) and accept that some 5% of links may land on a less-relevant page.

## Risks / Trade-offs

- **[Risk] Browser locale country and physical location disagree.** A user travelling abroad with `it-IT` set still hits `amazon.it`. → Accepted; this is what the user asked for ("dipendendo da dove si è connessi" interpreted as "browser-configured locale", confirmed in proposal Q&A).
- **[Risk] Whitelist is incomplete (e.g. NL, PL, JP, AU users default to `.com`).** → Accepted as scope limit. Adding entries is mechanical (one line per country); we can grow the list when we see traffic from a region.
- **[Risk] `/dp/{ISBN10}` lands on a deleted listing.** → Mitigated by the search-URL fallback at the helper layer when ISBN10 isn't usable. Beyond that, this is a real-world long tail we can't fix without server-side scraping.
- **[Trade-off] Existing IndexedDB records keep stale `amazonLink`/`googleBooksLink` keys until the record is overwritten.** → Accepted; storage waste is negligible (~150 bytes per book), and they're invisible to the type-checked code.
- **[Trade-off] No affiliate tag = no monetization yet.** → Accepted by design. The helpers are structured so a future change can plumb a tag through with a 5-line patch (env var → query param).

## Migration Plan

1. Add helpers (`storeRegion.ts`, `bookLinks.ts`).
2. Update `getBookDetails` to surface `googleBooksId` and stop returning `googleBooksLink`.
3. Update `HomePage.vue` `processRecommendations` to drop link enrichment.
4. Update both view templates to call helpers.
5. Remove `amazonLink`/`googleBooksLink` from the type.
6. Delete `generateAmazonLink` from `isbnUtils.ts`.
7. Type-check, manual smoke in en/es/it with browser locale set to it-IT, es-ES, en-US, en-GB, and a non-whitelisted locale (e.g. nl-NL) to confirm `.com` fallback.

Rollback is a `git revert`; no data migration to undo.

## Open Questions

- Should the `book-links` capability also cover a future affiliate tag, or should affiliate be its own change later? → Leaving as a separate future change; this one stays scoped.
- Should we offer a manual "Force `.com`" override per user? → Out of scope until we have evidence users want it.
