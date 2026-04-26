## 1. Region detection helper

- [x] 1.1 `src/utils/storeRegion.ts` created. `detectStoreCountry(appLang)` parses `navigator.language` country segment, falls back to `APP_LANG_TO_COUNTRY[appLang]`, and only ever returns a country in the whitelist (`StoreCountry` union).
- [x] 1.2 `amazonTldFor(country)` helper exported alongside, plus the typed `AMAZON_TLDS` map (`IT→it`, `ES→es`, `FR→fr`, `DE→de`, `GB→co.uk`, `US→com`).

## 2. Link builders

- [x] 2.1 `src/utils/bookLinks.ts` created. `buildAmazonLink({isbn10?, isbn13?}, country)` returns: `/dp/{ISBN10}` if present → derived ISBN10 from 978-prefixed ISBN13 (via `convertISBN13ToISBN10`) → search URL for non-derivable ISBN13 → empty string. The 978-prefix check guards the conversion utility (which itself returns the input unchanged for non-978).
- [x] 2.2 `buildGoogleBooksLink({googleBooksId?}, lang)` returns canonical `https://books.google.com/books?id={id}&hl={lang}`, empty when no id.
- [x] 2.3 Helpers are pure: only import `convertISBN13ToISBN10` and `amazonTldFor`. No Vue/Pinia/i18n imports.

## 3. Type and storage cleanup

- [x] 3.1 `amazonLink` and `googleBooksLink` removed from `BookRecommendation`. `isbn10`, `isbn13`, `googleBooksId` retained.
- [x] 3.2 Inline comment added in `src/types/userPreferences.ts` documenting that legacy IndexedDB records may still carry these keys and that links are now derived at render time.

## 4. Google Books service

- [x] 4.1 `getBookDetails` no longer returns `googleBooksLink`. It now returns `googleBooksId` from `response.data.items[0].id` (Google Books API V1 surfaces the volume id at that level — confirmed against the official response shape).
- [x] 4.2 Return type narrowed to a typed `GoogleBookDetails` interface exported from the module.

## 5. HomePage

- [x] 5.1 `processRecommendations` no longer enriches with `amazonLink` / `googleBooksLink`; spreads `bookDetails` (which now includes `googleBooksId`) into the recommendation.
- [x] 5.2 Template now uses `amazonLinkFor(recommendation)` / `googleBooksLinkFor(recommendation)` for both `v-if` and `:href`. A `storeCountry` `computed` recomputes when the language changes.
- [x] 5.3 Imports updated: `detectStoreCountry`, `buildAmazonLink`, `buildGoogleBooksLink`, `useLanguageStore`. Removed `generateAmazonLink` import.

## 6. ReadingListPage

- [x] 6.1 Mirrored: same imports, same `storeCountry` computed, same `amazonLinkFor` / `googleBooksLinkFor` helpers wired to the template.

## 7. Cleanup

- [x] 7.1 `generateAmazonLink` deleted from `src/utils/isbnUtils.ts`. `convertISBN13ToISBN10` retained (now used by `buildAmazonLink`).
- [x] 7.2 Grep across `src/`: no remaining references to `generateAmazonLink`, `book.amazonLink`, `recommendation.amazonLink`, `book.googleBooksLink`, or `recommendation.googleBooksLink`. Only the new `amazonLinkFor`/`googleBooksLinkFor` helpers and the documentation comment match the old strings.

## 8. Verification

- [x] 8.1 `npm run type-check` runs clean (`vue-tsc --build --force` exits 0).
- [x] 8.2 Manual smoke test of Home page and Reading List across browser locales (it-IT / es-ES / en-US / en-GB / nl-NL). **User-confirmed 2026-04-26.**
- [x] 8.3 Retro-compat verified against legacy IndexedDB records that still carry the old `amazonLink` / `googleBooksLink` JSON keys. **User-confirmed 2026-04-26.**
- [x] 8.4 Spot-check that an ISBN13 `978...` produces a `/dp/{ISBN10}` URL (not search). **User-confirmed 2026-04-26.**
