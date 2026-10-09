Each section is one Trello card and one PR. The owner is in brackets. **Operator** marks steps only the operator can do: billing, consoles, deploys, legal text, keys. Every tick needs evidence in the PR (command output, a test name, a screenshot, or a file/line). The acceptance checklist on each card is authoritative; the tasks below are the implementation plan behind it.

Suggested order: 1 → 10 → 2 → (operator section 0) → 3 → 4 → 7 → 5 → 6 → 8.

-   Section 10 (provider evaluation) runs in parallel with sections 1 to 3 and blocks none of them.
-   Section 6 (consent copy) and operator step 0.5 (Iubenda) wait for its decision.
-   The ux-designer specs for sections 4, 5, 6 and 8 can be written while sections 1 to 3 are in progress.

## 0. Operator prerequisites (no card; see the closing comment on #44)

-   [x] 0.1 **Operator**: decide the open questions in `design.md`. Done on 2026-10-09; see "Operator decisions (resolved 2026-10-09)".
-   [ ] 0.2 **Operator**: enable the Blaze plan on the Firebase project and set a Cloud Billing budget of 10 € per month (alerts only).
-   [ ] 0.3 **Operator**: create the Firestore database in `europe-west1` (permanent).
-   [ ] 0.4 **Operator**: deploy the backend.
    -   Create the `LLM_API_KEY` secret in Secret Manager. Its value is the OpenAI key unless #71 decides otherwise.
    -   Deploy Cloud Run with `bookmind-server/DEPLOY.md`, using `--min 0 --max 2`.
    -   Apply the TTL policy and run the smoke test.
    -   Record the service URL.
-   [ ] 0.5 **Operator**, after the #71 decision: publish the privacy policy.
    -   Generate and approve the Iubenda policy in IT and EN from the data inventory in `design.md`. It names the chosen LLM provider.
    -   Put both policy URLs into `firebase.json`.
    -   Run `firebase deploy --only hosting`.
    -   Open `/privacy`, `/privacy/en` and `/delete-account` in a private window.
-   [ ] 0.6 **Operator**: set up Play Console for Italy.
    -   Countries/regions: Italy only.
    -   Store listing: default language it-IT, no translations in v1.
    -   Closed testers must have their Play country set to Italy, or the closed track is unsynced.
-   [ ] 0.7 **Operator**: provide the keys for #71: an OpenRouter key, possibly with a low credit cap, and a fine-grained HF token with "Make calls to Inference Providers" plus credits. Both go in the local `bookmind-server/.env` only.

## 1. Backend: token, quota, CORS (card #60, `backend-engineer`)

-   [ ] 1.1 `auth.py`: FastAPI dependency that verifies the bearer token with `check_revoked=True`, returns 401 on any failure, and exposes the UID.
-   [ ] 1.2 `quota.py`: Firestore transaction on `llmQuota/{uid}_{YYYY-MM-DD}` (UTC) with `count` and `expireAt` = next UTC day start + 24 h. Raise 429 at `DAILY_LLM_CALL_LIMIT` (default 10) before OpenAI is called.
-   [ ] 1.3 Wire both into `/recommendations/clarify` and `/recommendations`. Request and response bodies unchanged.
-   [ ] 1.4 CORS from `CORS_ALLOWED_ORIGINS` (local default = today's dev list), `allow_credentials=False`.
-   [ ] 1.5 `tests/` with mocked token verification and Firestore: 401 (missing, invalid, deleted user), 200, 429, day rollover, CORS preflight. `requirements-dev.txt`.
-   [ ] 1.6 README: environment variables, `Authorization` header, 401/429.
-   [ ] 1.7 `llm.py`: the only module that calls the provider SDK. It reads `LLM_BASE_URL` (unset = OpenAI), `LLM_MODEL` (default `gpt-4o-mini`) `LLM_API_KEY` (falling back to `OPENAI_API_KEY`) and an optional `LLM_EXTRA_BODY` JSON object, which is merged into each request for router options. Tests show that changing only the environment changes the base URL and the model, and that the bodies stay the same.

## 2. Backend: container, Cloud Run runbook, Hosting config (card #61, `backend-engineer`)

-   [ ] 2.1 `Dockerfile` and `.dockerignore` (no `.env`, `*.pem`, `venv`). Build the image, and show that it answers 401 without a token.
-   [ ] 2.2 `DEPLOY.md`, frugal:
    -   Firestore database creation in `europe-west1`.
    -   Artifact Registry and Cloud Run in `europe-west1` with `--min 0 --max 2`.
    -   The `LLM_API_KEY` secret in Secret Manager, with `LLM_BASE_URL` and `LLM_MODEL` as plain env vars.
    -   A service account with minimal roles, each with its official doc link.
    -   Production `CORS_ALLOWED_ORIGINS`.
    -   The TTL policy command.
    -   A budget alert of 10 € per month.
    -   The post-deploy curl smoke test.
    -   No other paid resources.
-   [ ] 2.3 `firebase.json` (hosting `dist/`, SPA rewrite, 301 `/privacy` → Iubenda IT placeholder and `/privacy/en` → Iubenda EN placeholder) and `.firebaserc`. Note the #54 `emulators` merge in the PR.

## 3. App: authenticated API client (card #62, `app-engineer`)

-   [ ] 3.1 Axios request interceptor adds `Authorization: Bearer <await auth.currentUser.getIdToken()>` to backend calls.
-   [ ] 3.2 30 s timeout for the recommendation calls.
-   [ ] 3.3 Map 429 and 401 to new i18n keys (en/it/es) in `PreferencesPage.vue`, reusing the #59 rollback.
-   [ ] 3.4 Remove `incrementApiCallCount` and `getRemainingCalls`. Keep the `apiCalls` store.
-   [ ] 3.5 `.env.example` documents the production `VITE_API_BASE_URL`.
-   [ ] 3.6 Emulator run against the local protected backend. Record the WebView `Origin` header for the production CORS list.

## 4. App: in-app account deletion (card #63, `ux-designer` → `app-engineer`)

-   [ ] 4.1 **ux-designer**: menu entry and dialog spec (all states, phone and tablet), appended to this `design.md`.
-   [ ] 4.2 `wipeUserData(uid)` in `userPreferences.ts` with unit tests.
-   [ ] 4.3 `src/services/account/deleteAccount.ts`: reauthenticate → marker → `deleteUser` → wipe → sign out → `/login?deleted=1`.
-   [ ] 4.4 `src/components/account/DeleteAccountDialog.vue` and the `Menu.vue` entry, with the in-dialog "Forgot password?" reset email (UX spec section 5).
-   [ ] 4.5 Startup sweep in `main.ts` driven by the `bookmind.pendingDeletion` marker. Unit tests prove a plain logout keeps the reading list.
-   [ ] 4.6 i18n en/it/es, with the deletion and retention text approved by the operator on 2026-10-09 (UX spec section 12).
-   [ ] 4.7 Emulator verification on phone and tablet, using the operator's test account or the #54 emulators.

## 5. App: public `/delete-account` and privacy links (card #64, `ux-designer` → `app-engineer`)

-   [ ] 5.1 **ux-designer**: placement of the privacy links and the `/delete-account` layout.
-   [ ] 5.2 `src/views/DeleteAccountPage.vue` as a public route (neither `requiresAuth` nor `guestOnly`) with its own sign-in. Reuse the section 4 flow.
-   [ ] 5.3 "Privacy policy" link on Login, Register and in the Menu. It points at `VITE_PRIVACY_POLICY_URL` (IT) when the UI language is `it`, and at `VITE_PRIVACY_POLICY_URL_EN` otherwise. Both are documented in `.env.example`. On Android it opens, and back returns to the app.
-   [ ] 5.4 Router tests for the public route. Screenshot of the route in a private browser window.

## 6. App: explicit AI consent and corrected disclosure (card #65, `ux-designer` → `app-engineer`)

This section starts after the #71 provider decision (design Decision 10). Task 6.1 can be done earlier.

-   [ ] 6.1 **ux-designer**: consent panel, declined state and withdraw entry (phone and tablet).
-   [ ] 6.2 Consent gate in `PreferencesPage.vue`. Test that no API call happens without consent.
-   [ ] 6.3 `${uid}_aiConsent = { granted, at, version }` in IndexedDB. An older version counts as not granted.
-   [ ] 6.4 "Withdraw AI consent" menu entry.
-   [ ] 6.5 `ai_transparency` copy in en/it/es without "nothing stored", approved by the operator.
-   [ ] 6.7 The consent panel and the transparency note name the recipient decided in #71, by name and country. With a router, they name both the router and the pinned provider. The names match the Iubenda third-party list.
-   [ ] 6.6 `wipeUserData` covers the consent key (or a note in the PR if section 4 is not merged yet).

## 7. Backend: `POST /reports` (card #66, `backend-engineer`)

-   [ ] 7.1 Authenticated endpoint. Pydantic model accepts only `kind`, `lang`, `content` (≤1000) and `reason`. Returns 204.
-   [ ] 7.2 One structured log entry with no UID and no transcript. `DAILY_REPORT_LIMIT` (default 20) through the quota module.
-   [ ] 7.3 Tests: 401, 204 plus the captured log, 422, 429. README: Logs Explorer filter.

## 8. App: report AI content (card #67, `ux-designer` → `app-engineer`)

-   [ ] 8.1 **ux-designer**: "Report" action on the clarifier question and on each recommendation card, the reason picker, confirmation and error states, with targets ≥ 44 px.
-   [ ] 8.2 Call `POST /reports` with the AI text only. Show a localized confirmation or an error with retry. The user never leaves the app.
-   [ ] 8.3 Emulator verification on phone and tablet.

## 9. End-to-end before submission (`qa-verifier`, after sections 1–8 and the operator steps)

-   [ ] 9.1 Clean install on `Pixel_9_API_36` against production (Play country Italy): register → consent → chat → recommendations → report → save → delete the account in the app. The Firebase user is gone, IndexedDB holds no keys for the UID, and the old token gets 401.
-   [ ] 9.2 `/privacy` (IT), `/privacy/en` (EN) and `/delete-account` open in a private window without a redirect to `/login`.
-   [ ] 9.3 Unauthenticated `curl` to the production API gets 401. The 11th call of the day gets 429.

## 10. LLM provider evaluation (card #71, `backend-engineer`; offline, no production code)

-   [ ] 10.1 Shortlist: the `gpt-4o-mini` baseline plus 3 to 5 candidates via OpenRouter and HF, each with a pinned provider and its price link and date.
-   [ ] 10.2 `bookmind-server/eval/`: a script using the unchanged `prompts.py` and a fixed, versioned test set (at least 12 synthetic cases, mostly Italian, 2 off-topic). Keys come from `.env` only.
-   [ ] 10.3 At least 3 runs per case and endpoint, scored on the criteria in design Decision 10: quality (with Google Books existence check and operator blind rating of 5 or more cases), cost, latency p50/p95, JSON reliability and data handling.
-   [ ] 10.4 `bookmind-server/eval/REPORT.md` with a comparison table, a recommendation, and the exact recipients to name in #65 and in the policy.
-   [ ] 10.5 **Operator**: decides. **product-lead**: records the decision in design Decision 10 and in the decisions table.
