## Why

BookMind is feature-complete enough for a Google Play Store launch, but the path to production is blocked by three concrete, non-negotiable items: (1) the FastAPI backend only runs on `localhost` — the moment the Android app is installed on a real device, every recommendation request fails; (2) Google Play Store requires both an **in-app account-deletion flow** and a **publicly reachable web URL** that lets users delete their account without re-installing the app, and BookMind has neither; (3) we have no privacy policy, no Data Safety declaration, and no way to honor GDPR rights for our European users — the Italian Garante has been the EU's most active regulator on AI services since the ChatGPT ban of March 2023, and we send user-typed conversations to OpenAI in the US.

A second, hidden risk surfaces from the production deploy itself: today's "2 calls/day" quota lives entirely in IndexedDB on the client. Once the backend has a public URL, anyone can `curl` `/recommendations` directly and burn the OpenAI bill — a single overnight loop costs the project hundreds of euros at gpt-4o-mini rates. The launch must include a server-side rate limit gated on the user's Firebase ID token.

This change addresses all three blockers in one coordinated push so the next decision after merge is "submit to Play Console", not "what else do we still need".

## What Changes

- **Backend (Cloud Run, europe-west1)**: Containerize `bookmind-server` with a `Dockerfile`, deploy to Cloud Run in the same GCP project as Firebase, store `OPENAI_API_KEY` in Secret Manager, expose under an `*.a.run.app` URL, and tighten CORS to only the Firebase Hosting origin and the Capacitor app origin.
- **Server-side authentication and quota**: Require a Firebase ID token on `POST /recommendations/clarify` and `POST /recommendations`; verify it via `firebase-admin` (already in `requirements.txt`); enforce a hard cap of 10 recommendation calls per UID per 24h via a Firestore counter. The IndexedDB-based limit on the client becomes a UX hint, not a security boundary.
- **Frontend account deletion (in-app)**: Add a `Delete account` action at the bottom of `Menu.vue`, opening a modal that asks the user to confirm with their password, then runs cloud-first deletion: `reauthenticateWithCredential` → `deleteUser` → wipe IndexedDB for the deleted UID → `signOut` → redirect to `/login?deleted=1`.
- **Frontend auto-heal**: At app startup, if Firebase reports the user as null but IndexedDB still holds data for some UID, wipe those orphaned entries. This makes the deletion flow self-healing across force-quits, mid-flow crashes, and multi-device deletions.
- **Public web flow (Firebase Hosting)**: Deploy the existing Vite build to Firebase Hosting so `/delete-account` and `/privacy` are reachable from a public URL. The Vue routes `/delete-account` and `/privacy` are added as login-not-required pages; `/delete-account` reuses the same delete-account component as the in-app menu, with its own login form for users who only have web access.
- **Privacy policy via Iubenda**: Subscribe to Iubenda, generate the IT/EN privacy policy declaring Firebase + OpenAI as sub-processors and the US transfer with SCCs, and embed it on a `/privacy` route. The policy URL is what we paste into the Play Console listing form and the Data Safety section.
- **Configuration plumbing**: Switch `VITE_API_BASE_URL` to point at the Cloud Run URL in production builds. Tighten `bookmind-server/main.py` CORS to env-driven origins. Add `firebase.json` for Hosting, with `/delete-account` and `/privacy` routed to `index.html` (SPA fallback).

## Capabilities

### New Capabilities

- `account-management`: Lets a user permanently delete their account and all derived data, both from inside the installed app and from a public web URL. Includes the reauthentication challenge, the cloud-first deletion order, the local-data wipe, and the startup auto-heal that handles partial-deletion edge cases.

### Modified Capabilities

<!-- None — the existing capability specs (conversational-recommendation, reading-list, book-links) are not touched by this change. -->

## Impact

- **Backend (FastAPI)**: `bookmind-server/main.py` gains an auth dependency that verifies the `Authorization: Bearer <Firebase ID token>` header on both recommendation endpoints; new `bookmind-server/quota.py` module reads/writes per-UID daily counters in Firestore; new `bookmind-server/Dockerfile`; CORS origins moved to env. `requirements.txt` already includes `firebase-admin>=5.0.0`, no new Python deps needed.
- **Frontend (Vue 3 + Capacitor)**: New `src/services/account/deleteAccount.ts` orchestrator; new `src/services/account/orphanedDataSweep.ts` for startup auto-heal; new `src/components/account/DeleteAccountDialog.vue`; `src/services/indexedDB/userPreferences.ts` gains `wipeUserData(userId)` that drops the user's keys from all three object stores; `src/components/layout/Menu.vue` gains the new menu entry; `src/main.ts` wires the auto-heal sweep on `onAuthStateChanged`; new public routes `/delete-account` and `/privacy` added to `src/router/index.ts` and excluded from the auth guard.
- **Frontend services**: `src/services/api/axios.ts` already reads `VITE_API_BASE_URL` (no change needed), but a small wrapper is added to attach `Authorization: Bearer <idToken>` to outgoing recommendation calls.
- **Hosting**: New `firebase.json` at repo root configuring Hosting with `dist/` as public dir and SPA rewrites; `package.json` gets a `web:deploy` script (`npm run build && firebase deploy --only hosting`).
- **Compliance**: New `src/views/PrivacyPage.vue` rendering the Iubenda-embedded policy. No app text strings change beyond the new menu entry and the dialog/disclosure copy in `en.json`/`it.json`/`es.json`.
- **Tests / fixtures**: The login-page test (`src/views/__test__/LoginPage.spec.js`) is unaffected. New unit tests cover `wipeUserData` and the auto-heal sweep.
- **No DB migration required** — Firestore is already initialized in `services/firebase/config.ts` but unused; this change is the first writer (the per-UID quota counter document).
- **Out of scope**: app icon, splash screen, store listing screenshots, content rating questionnaire, signed Android build, custom domain (uses default `*.web.app` URL for v1), and the in-app "feedback / petitions" feature explored earlier — that ships in a follow-up change *after* the store launch produces actual users to give feedback.
