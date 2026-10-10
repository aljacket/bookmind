## Why

BookMind cannot be submitted to Google Play or the App Store today. This change was first written on 2026-04-28 and was re-checked on 2026-10-09 (card #44) against the current code and the current store rules. Sources and the dates they were checked are in `design.md` → "Sources".

1. **The backend only runs on localhost.** `bookmind-server/main.py` has no container, no deploy configuration and hard-coded dev CORS origins. On a real device every recommendation request fails.
2. **Nothing limits OpenAI spend.** The April text said a 2-calls/day quota existed in IndexedDB. That is wrong on `main` (b8a13b6): `incrementApiCallCount` and `getRemainingCalls` in `src/services/indexedDB/userPreferences.ts` exist but are never called. Once the backend is public, anyone can `curl` `/recommendations` in a loop and spend the OpenAI budget. The backend must verify the Firebase ID token and enforce a quota per user.
3. **No account deletion.** Users can create accounts (Firebase email/password), so Play needs an in-app deletion path plus a public web link declared in Data safety. Apple 5.1.1(v) needs deletion inside the app, and deactivation is not enough.
4. **No privacy policy.** Play needs a privacy policy URL in Play Console and a link inside the app, and the policy must name the app and state retention and deletion. Data safety cannot be completed without it. Apple 5.1.1(i) also needs the link in App Store Connect and inside the app.
5. **New since April: explicit permission before sharing data with a third-party AI.** Apple 5.1.2(i) now requires apps to disclose when personal data is shared "with third-party AI" and to get explicit permission first. The chat sends user-typed text and liked books to OpenAI. Today there is only a passive note, whose copy says "nothing stored". That claim conflicts with OpenAI's default API retention of up to 30 days for abuse monitoring.
6. **New since April: users must be able to report AI-generated content.** Play's AI-Generated Content policy requires apps that generate content with AI to let users report or flag offensive content without leaving the app. The clarifier question and the recommendation reasons are AI-generated text.

## What Changes

-   **Backend protection** (`bookmind-server/`): both recommendation endpoints require `Authorization: Bearer <Firebase ID token>`, verified with `firebase-admin`. A daily quota per UID is kept in Firestore, and its counter documents expire through a TTL field. CORS origins come from an environment variable. Backend tests are added (none exist today).
-   **Deployment** (`bookmind-server/`, repo root): a `Dockerfile`, a Cloud Run deploy runbook (europe-west1, `OPENAI_API_KEY` in Secret Manager, max-instances cap), `firebase.json` Hosting config with SPA rewrites, and the Firestore TTL policy. The operator runs every production deploy.
-   **API client** (`src/services/api/`): attaches the ID token, uses a timeout long enough for a Cloud Run cold start plus the OpenAI call, and maps 401/429 to localized messages. The unused client-side quota functions are removed.
-   **In-app account deletion** (`src/`): a menu entry opens a confirmation dialog. The flow is reauthenticate → `deleteUser` → wipe IndexedDB for that UID → sign out → `/login?deleted=1`. An auto-heal sweep at startup removes orphaned local data.
-   **Public web pages** (Firebase Hosting, same Vite build): `/delete-account`, a public route with its own sign-in that reuses the deletion component, and `/privacy`, a Hosting redirect to the hosted Iubenda policy. Both are reachable without signing in. The privacy link also appears inside the app (Login, Register, Menu).
-   **AI data consent** (new since April): before the first message is sent to the third-party AI provider (OpenAI today), the user gives explicit consent through an affirmative action. The decision is stored per UID and can be withdrawn from the menu. The transparency note's copy is corrected so it no longer says "nothing stored".
-   **AI content reporting** (new since April): each AI-generated item (clarifier question, recommendation reason) has a "Report" action. It posts to a new `POST /reports` endpoint, which writes a structured log entry with no UID and no transcript.
-   **LLM provider behind configuration** (added 2026-10-09): every LLM call goes through one backend module configured by environment variables, so the provider or model can change without a code change. Card #71 evaluates OpenAI against models reachable through OpenRouter and Hugging Face before the consent copy and the policy name the recipient. Outcome on 2026-10-10: OpenAI stays the recipient, and the model moves to `gpt-6-luna` with reasoning off (card #73).
-   **Privacy policy (Iubenda)**: the operator generates and approves the policy in Italian and English only. The change provides the data inventory that the policy, Play Data safety and App Store privacy details are filled from.

## Capabilities

### New Capabilities

-   `account-management`: permanent deletion of the account and its derived data, in the app and from a public web URL, with reauthentication, cloud-first ordering, local wipe and startup auto-heal.
-   `api-access-control`: Firebase ID token verification, daily per-user quota with expiring counters, and environment-driven CORS on the recommendation API.
-   `privacy-and-consent`: public privacy policy URL, in-app privacy link, and explicit, revocable consent before any data is sent to the third-party AI provider.
-   `ai-content-reporting`: in-app reporting of AI-generated content and the backend endpoint that receives reports.

### Modified Capabilities

-   `conversational-recommendation`: the AI transparency disclosure must match the privacy policy, so the "messages are not stored" wording is narrowed to BookMind's own servers. New requirements cover how quota and authentication errors appear in the chat, and that the LLM provider and model come from configuration.

## Impact

-   **Backend**: `bookmind-server/main.py` (auth dependency, CORS from env, `/reports`). New `bookmind-server/auth.py`, `bookmind-server/quota.py`, `bookmind-server/llm.py`, `bookmind-server/Dockerfile`, `bookmind-server/tests/`. `firebase-admin` is already in `requirements.txt`. Test dependencies (`pytest`, `httpx`) are added in a dev requirements file.
-   **Frontend**: `src/services/api/axios.ts`, `src/services/recommendations/bookRecommendation.ts`, `src/services/indexedDB/userPreferences.ts` (`wipeUserData`, dead quota code removed). New `src/services/account/`, `src/components/account/`, `src/views/DeleteAccountPage.vue`. Also `src/components/layout/Menu.vue`, `src/router/index.ts` (public routes), `src/main.ts` (auto-heal), `src/views/PreferencesPage.vue` (consent gate, report action), `src/components/ui/AiTransparencyNote.vue`, and `src/locales/{en,it,es}.json`.
-   **Config**: new root `firebase.json` (Hosting, SPA rewrite, `/privacy` redirect) and `.firebaserc`. Card #54 (Firebase Emulator Suite) edits the same file, so whichever card merges second merges both sections. `.env.example` gains the production variables.
-   **Firestore**: first server-side writer (the quota counters). The client still never writes to Firestore.
-   **Out of scope, own cards**: launcher icon and splash (still the Capacitor defaults), signed release AAB, store listing assets (feature graphic, screenshots, descriptions). Also out of scope: iOS build (#55), iPad layout (#46/#47, Apple 2.4.1), Android back button (#45), custom domain or name (#18), and the feedback/petitions feature.
-   **Launch scope** (operator, 2026-10-09): Italy only on Google Play, with the store listing in Italian. The app keeps its en/it/es UI.
-   **Not needed**: Sign in with Apple. Apple 4.8 applies only to third-party or social login, and BookMind uses only its own email/password accounts. If Facebook login (cards #16/#17/#19) is ever added, 4.8 applies and needs its own change.
