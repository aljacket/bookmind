### Requirement: Locale-aware Amazon TLD selection
The system SHALL select the Amazon top-level domain for purchase links by deriving a country code from the user's environment, in this priority order:
1. The country segment of `navigator.language` (e.g. `it-IT` → `IT`).
2. The app language as a fallback when no country segment is present (`it` → `IT`, `es` → `ES`, `en` → `US`).
3. A safe default of `US` when the resolved country has no Amazon storefront in the supported whitelist.

The supported whitelist SHALL be: `IT → amazon.it`, `ES → amazon.es`, `FR → amazon.fr`, `DE → amazon.de`, `GB → amazon.co.uk`, default → `amazon.com`.

#### Scenario: Browser locale with country code maps to local store
- **WHEN** `navigator.language === 'it-IT'`
- **THEN** the resolved Amazon base URL is `https://www.amazon.it`

#### Scenario: Browser locale without country falls back to app language
- **WHEN** `navigator.language === 'es'` and the app language is `es`
- **THEN** the resolved Amazon base URL is `https://www.amazon.es`

#### Scenario: Unsupported country defaults to .com
- **WHEN** `navigator.language === 'nl-NL'` (Netherlands, not in whitelist)
- **THEN** the resolved Amazon base URL is `https://www.amazon.com`

#### Scenario: English with US country goes to .com
- **WHEN** `navigator.language === 'en-US'`
- **THEN** the resolved Amazon base URL is `https://www.amazon.com`

#### Scenario: English with UK country goes to .co.uk
- **WHEN** `navigator.language === 'en-GB'`
- **THEN** the resolved Amazon base URL is `https://www.amazon.co.uk`

### Requirement: Amazon link prefers direct product page
For a given book, the system SHALL build the Amazon URL in the following priority order:
1. `https://www.amazon.<tld>/dp/<ISBN10>` when the book has an `isbn10`.
2. `https://www.amazon.<tld>/dp/<ISBN10>` where ISBN10 is derived from a 978-prefixed `isbn13` via the existing `convertISBN13ToISBN10` utility.
3. `https://www.amazon.<tld>/s?k=<ISBN13>` (search by ISBN13) when only a 979-prefixed `isbn13` is available.
4. Empty string (`''`) when neither identifier is present, in which case the link UI SHALL be hidden.

#### Scenario: ISBN10 present uses product page
- **WHEN** a book has `isbn10 = '0241988519'` and the resolved TLD is `it`
- **THEN** the Amazon URL is `https://www.amazon.it/dp/0241988519`

#### Scenario: ISBN10 derived from 978-prefixed ISBN13
- **WHEN** a book has `isbn13 = '9780241988510'` and no `isbn10`
- **THEN** the Amazon URL uses ISBN10 derived from the ISBN13 (`/dp/0241988519`-form), not the search URL

#### Scenario: 979-prefixed ISBN13 falls back to search
- **WHEN** a book has only `isbn13 = '9791234567896'` (979 prefix, no ISBN10 equivalent)
- **THEN** the Amazon URL is `https://www.amazon.<tld>/s?k=9791234567896`

#### Scenario: No identifiers hides the link
- **WHEN** a book has neither `isbn10` nor `isbn13`
- **THEN** the helper returns an empty string and the Amazon button is not rendered

### Requirement: Google Books canonical URL with locale hint
The system SHALL build Google Books links from the book's `googleBooksId` using the canonical form `https://books.google.com/books?id=<googleBooksId>&hl=<lang>`, where `lang` is the current app language (`en` / `es` / `it`). The system SHALL NOT use the `infoLink` returned by the Google Books API.

#### Scenario: Canonical Google Books URL is used
- **WHEN** a book has `googleBooksId = 'abc123'` and the app language is `it`
- **THEN** the Google Books URL is `https://books.google.com/books?id=abc123&hl=it`

#### Scenario: Missing googleBooksId hides the link
- **WHEN** a book has no `googleBooksId`
- **THEN** the helper returns an empty string and the Google Books button is not rendered

### Requirement: Links derived at render, not persisted
The system SHALL NOT persist `amazonLink` or `googleBooksLink` on saved books or recommendations. Both URLs SHALL be computed at render time from the persisted identifiers (`isbn10`, `isbn13`, `googleBooksId`) and the current locale. The `BookRecommendation` interface SHALL NOT declare these fields.

#### Scenario: Language change updates link without rewriting storage
- **WHEN** a saved book is rendered, then the app language changes from `en` to `it`, then the same book is rendered again
- **THEN** the Amazon TLD reflects the new locale (`amazon.it`) without any IndexedDB write between the two renders

#### Scenario: Type interface excludes link fields
- **WHEN** any code references the `BookRecommendation` type
- **THEN** TypeScript does not expose `amazonLink` or `googleBooksLink` as properties; consumers must call the link helpers explicitly

#### Scenario: Legacy stored records are tolerated
- **WHEN** a record loaded from IndexedDB happens to contain stale `amazonLink` / `googleBooksLink` JSON keys (written by an earlier version)
- **THEN** the keys are ignored at the type layer and the helpers compute fresh URLs from the persisted identifiers
