## Context

BookMind is a Vue 3 + Capacitor 8 app. Android targets API 36 (card #50, archived as `2026-10-08-capacitor-8-upgrade`). iOS is not buildable yet (card #55). A thin FastAPI backend (`bookmind-server/main.py`) proxies two calls to OpenAI `gpt-4o-mini`. Firebase Auth handles accounts, using email/password only (`LoginPage.vue`, `RegisterPage.vue`; `RegisterPage` also stores a display name). Firestore is initialised in `src/services/firebase/config.ts` but never read or written. All user-derived state lives on the device in IndexedDB (`BookMindDB` v3, stores `userPreferences`, `apiCalls` and `readingList`, keys prefixed with `${uid}_`).

This change was written on 2026-04-28. It was reviewed on 2026-10-09 for card #44 against `main` b8a13b6 and against the store rules re-checked that day (see "Sources").

### What the 2026-10-09 review changed

| #   | April text                                                                                                      | Finding on 2026-10-09                                                                                                                                                                                                      | Now                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R1  | "The 2 calls/day quota lives in IndexedDB; it stays as a UX hint"                                               | `incrementApiCallCount` / `getRemainingCalls` are never called anywhere in `src/`. Today there is no limit at all.                                                                                                         | The server quota is the only quota. The dead client functions are removed. Decision 2.              |
| R2  | The auto-heal sweep wipes all local data whenever Firebase reports no user and no persisted token               | A normal logout produces that same state. At the next launch the sweep would delete a logged-out user's reading list, which exists only on the device.                                                                     | The sweep is driven by a pending-deletion marker. Decision 4.                                       |
| R3  | `/privacy` is a Vue page that embeds the Iubenda widget, with a fallback snapshot in `src/assets/`              | Play requires a public, non-PDF, non-geofenced policy URL and a link inside the app. A Hosting redirect to the hosted Iubenda policy meets both with no Vue page, no third-party script in the app, and no stale snapshot. | `/privacy` is a Firebase Hosting redirect. Decision 5.                                              |
| R4  | (absent)                                                                                                        | Apple 5.1.2(i) now requires disclosure **and explicit permission** before personal data is shared with third-party AI.                                                                                                     | New consent gate. Decision 8.                                                                       |
| R5  | (absent)                                                                                                        | Play's AI-Generated Content policy requires in-app reporting of offensive AI output.                                                                                                                                       | New report action and `POST /reports`. Decision 9.                                                  |
| R6  | "The only Firestore writer is the quota counter, with no user content"                                          | The counter is keyed by UID, which is a user identifier. After account deletion it would stay forever.                                                                                                                     | Counters carry a TTL field. Decision 2.                                                             |
| R7  | The cost figures (Cloud Run free tier, `min-instances` ≈ €10/mo, Iubenda €30–60/yr) were stated without sources | The free tiers were re-checked (see Sources). Prices for `min-instances` and Iubenda were not re-verified.                                                                                                                 | The operator checks prices at purchase time. Open questions.                                        |
| R8  | "iOS App Store launch is out of scope"                                                                          | The in-app deletion, the consent gate and the privacy link are platform-neutral web code and satisfy Apple 5.1.1(v)/(i) and 5.1.2(i) when iOS ships (#55).                                                                 | The non-goal is narrowed to iOS build and App Store Connect work.                                   |
| R9  | The axios timeout was not discussed                                                                             | `src/services/api/axios.ts` uses `timeout: 10000`. A cold start plus the recommendation call can come close to that.                                                                                                       | The timeout is raised for the recommendation calls. Decision 2.                                     |
| R10 | The `specs/account-management/` folder was empty and `tasks.md` was missing                                     | The change could not be validated or applied.                                                                                                                                                                              | Spec deltas for four new capabilities plus one modified capability, and `tasks.md` mapped to cards. |

## Goals / Non-Goals

**Goals:**

-   Make the backend reachable from real devices, with a hard per-user quota that survives anyone calling the public URL directly.
-   Meet Play's account-deletion rules (in-app path, plus a public web link in Data safety) and Apple 5.1.1(v) (in-app deletion) without building a separate web product.
-   Publish a privacy policy that names Firebase/Google and OpenAI, the US transfer, the retention periods and the GDPR rights, and link it from the app.
-   Ask explicit permission before the first message reaches OpenAI (Apple 5.1.2(i)), and keep the in-app disclosure consistent with the policy.
-   Let users report offensive AI output without leaving the app (Play AI-Generated Content).
-   Keep deletion self-healing for interruptions on the same device.

**Non-Goals:**

-   iOS build and App Store Connect setup (#55). The code in this change is shared and already satisfies the Apple items above.
-   Custom domain or new app name (#18). v1 uses the default `<project-id>.web.app`.
-   Migrating the reading list or the chat to Firestore. The client still never writes to Firestore.
-   Sign in with Apple. Apple 4.8 applies only to third-party or social login.
-   Launcher icon, splash, signed release AAB, store listing assets. Each has its own card.
-   The feedback/petitions feature, content moderation beyond receiving reports, in-app purchases.

## Decisions

### Decision 1: Cloud Run (europe-west1) for the backend

The FastAPI service runs as a container on Cloud Run in `europe-west1`, in the GCP project behind the existing Firebase project. `OPENAI_API_KEY` is read from Secret Manager. `--max-instances` is capped (the runbook proposes 2) so that a traffic spike cannot become a bill spike.

**Why:** the service is stateless and request-scoped. The Cloud Run free tier (2 M requests, 180 000 vCPU-s, 360 000 GiB-s per month) is far above the expected launch traffic. Cloud Run, Secret Manager and Cloud Functions all require the Firebase **Blaze** plan, and the Google Cloud free tier requires a billing account (Sources). The alternatives considered in April (Render, Railway, Vercel/Netlify functions, Fly.io, a VM) were rejected for the reasons recorded there: spin-down, a 10 s function timeout, or a separate billing ecosystem. Those reasons were not re-verified and are not load-bearing.

Cold start (one to a few seconds for a Python image) falls inside the existing `ProcessingPage.vue` loading state. `min-instances=1` is not used in v1 because it removes cold starts but costs money (operator decision, Open questions).

### Decision 2: Firebase ID token + per-UID daily quota with expiring counters

-   `POST /recommendations/clarify`, `POST /recommendations` and `POST /reports` require `Authorization: Bearer <Firebase ID token>`. The backend verifies it with `firebase_admin.auth.verify_id_token(token, check_revoked=True)`, using Application Default Credentials on Cloud Run. Revocation checking also rejects the still-unexpired tokens of a deleted user, at the cost of one Auth lookup per request, which is small next to the OpenAI call. A missing or invalid token returns **401** before any OpenAI call.
-   Quota: a Firestore document `llmQuota/{uid}_{YYYY-MM-DD}` (UTC day) with `count` and `expireAt` fields, incremented in a transaction **before** the OpenAI call. When `count` has already reached `DAILY_LLM_CALL_LIMIT` (env, default **10**, an operator decision), the request returns **429** and OpenAI is not called. Clarify and recommendations both count, so one full chat costs 2. A failed OpenAI call is not refunded; the limit absorbs retries, including the retry flow from card #59.
-   `expireAt` = the start of the next UTC day + 24 h. A Firestore TTL policy on `llmQuota.expireAt` deletes the documents, and TTL deletion "typically" happens within 24 h of expiry. A counter therefore lives at most about 72 h, and this retention is stated in the privacy policy. This is how server-side data tied to a UID disappears after account deletion, with no deletion endpoint.
-   The client (`axios.ts`) attaches the token from `auth.currentUser.getIdToken()` and raises the timeout for the recommendation calls to 30 s. It maps 401 to "session expired, sign in again" and 429 to a localized "daily limit reached" message. With the #59 rollback, the failed turn is restored so the user can retry tomorrow without retyping.
-   The dead client quota code (`incrementApiCallCount`, `getRemainingCalls`) is removed. The `apiCalls` store stays in the schema (no IndexedDB version bump) and is still wiped on deletion.

**Why:** a per-user identity is the only control that bounds abuse of a public URL. A shared API key would ship inside the app, and IP limits are easy to evade. Firestore is already provisioned for this project and needs no new dependency (`firebase-admin` is already in `requirements.txt`). A flat collection keyed `{uid}_{day}` keeps the TTL policy to a single collection group.

### Decision 3: Firebase Hosting serves the same Vite build

`firebase.json` at the repo root publishes `dist/` with an SPA rewrite to `/index.html`, plus the `/privacy` redirect (Decision 5). There is no separate site. `/delete-account` is a public route of the same app. Card #54 adds an `emulators` section to the same `firebase.json`, so whichever card merges second keeps both sections.

The web build contains the full app. A user who opens the Hosting URL can use BookMind on the web. That is accepted. The production backend CORS list includes the Hosting origins (`https://<project-id>.web.app`, `https://<project-id>.firebaseapp.com`) and the Capacitor origins (`https://localhost` on Android, `capacitor://localhost` on iOS). It never includes `http://localhost*` or `10.0.2.2`. `allow_credentials` becomes `False`, because auth is a bearer header, not a cookie.

### Decision 4: Cloud-first deletion with a pending-deletion marker

The sequence, shared by the in-app menu and the web page:

1. Show what will be deleted and what is retained, and for how long (Apple asks apps to tell users this; see Sources).
2. `reauthenticateWithCredential` with the password. A "Forgot password?" link goes to the existing reset flow.
3. Write the marker `bookmind.pendingDeletion = <uid>` to `localStorage`.
4. `deleteUser(currentUser)`. Firebase Auth is the source of truth.
5. `wipeUserData(uid)` removes every key with the prefix `${uid}_` from all three IndexedDB stores (reading list, last recommendations, call counters, consent flag).
6. Clear the marker, `signOut`, clear the auth store, and redirect to `/login?deleted=1`. The login page shows a localized confirmation that the account was deleted.

If step 4 fails, nothing is deleted, the marker is cleared and the error is shown. If the app dies between steps 4 and 6, the **startup sweep** in `main.ts` finds the marker after Firebase Auth has initialised and no user is signed in, runs `wipeUserData(marker)`, and clears the marker.

**Changed from April (R2):** the April sweep wiped every local entry whenever no user was signed in. After a normal logout that would delete the reading list, which exists only on the device. The marker limits the sweep to a UID whose deletion actually started on this device. If the account is deleted from another device or from the web, data left on this device stays local to the user's own device and never reaches BookMind's servers. This is accepted and stated in the policy.

**Why cloud-first:** if `deleteUser` fails, both sides stay intact. The reverse order can leave a live account with an empty reading list.

### Decision 5: Privacy policy hosted by Iubenda, `/privacy` as a stable redirect

The operator subscribes to Iubenda and generates the IT/EN policy (and ES, if the plan allows) from the data inventory below. `firebase.json` redirects `/privacy` (301) to the hosted Iubenda URL, using the policy ID the operator supplies.

-   The Play Console and App Store Connect privacy URL is `https://<project-id>.web.app/privacy`. It is a URL BookMind controls, and it shows the full policy text, which is public, not a PDF and not geofenced.
-   Inside the app, a "Privacy policy" link appears on Login, Register and in the Menu. On native it opens the URL in the system browser or an in-app browser, and the user can return to the app.
-   If Iubenda is ever dropped, only the redirect target changes.

**Why not a Vue page with the embed (April):** it loads a third-party script in the app, needs a fallback snapshot that goes stale, and adds a route to maintain. The redirect meets every Play and Apple requirement with no app code. Iubenda vs a hand-written policy or another vendor is the operator's legal choice. April's rationale (an Italian-native vendor with maintained templates) still stands.

### Decision 6: Menu entry, not a Settings page

"Delete account" and "Withdraw AI consent" are added to `Menu.vue` in a separate "danger zone" below logout. Apple asks for deletion to be easy to find, "typically" in account settings. The menu is the app's only settings surface, so this qualifies. The full-screen menu layout is the ux-designer's call.

### Decision 7: CORS from the environment

`CORS_ALLOWED_ORIGINS` is a comma-separated environment variable. Its local default reproduces today's dev list, and production sets the list from Decision 3.

### Decision 8: Explicit AI consent before the first OpenAI call (new)

Apple 5.1.2(i): "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." Play's Prominent Disclosure rule follows the same pattern (disclosure in the app, an affirmative action, and navigating away is not consent). It applies when data use may fall outside what users expect.

-   On `/preferences`, before the first message can be sent, a consent panel states:
    -   what is sent (the chat messages and the titles and authors of liked books)
    -   to whom (OpenAI, US)
    -   why (to generate the recommendations)
    -   retention (not stored on BookMind's servers; kept by OpenAI for up to 30 days for abuse monitoring)
    -   a link to the privacy policy
-   The panel has two explicit buttons: accept and decline. Nothing is sent until the user accepts.
-   The decision is stored per UID and per device in IndexedDB (`${uid}_aiConsent = { granted, at, version }`). `version` is a constant in code; raising it asks again when the disclosure changes materially.
-   Declining keeps the chat disabled with a short explanation. The reading list and the rest of the app keep working.
-   "Withdraw AI consent" in the menu sets `granted = false`. The next visit to the chat shows the panel again.
-   `AiTransparencyNote.vue` stays visible during the chat. Its copy is corrected: "nothing stored" becomes "not stored on BookMind's servers" (MODIFIED requirement in `conversational-recommendation`). The operator approves the final wording in all three languages.

### Decision 9: In-app reporting of AI output (new)

The Play AI-Generated Content policy names "text-to-text conversational generative AI chatbots, in which interacting with the chatbot is a central feature of the app" and requires "in-app user reporting or flagging features". BookMind's chat qualifies. Whether the policy applies is the operator's call (Open questions); the risk-based default is to comply.

-   A "Report" action appears on the clarifier question and on each recommendation card. The user picks a reason (offensive, inaccurate, other) and confirms, without leaving the app.
-   `POST /reports` (auth required, its own per-UID limit `DAILY_REPORT_LIMIT`, default 20) takes `{kind: "clarifier"|"recommendation", lang, content (≤1000 chars, the AI text only), reason}`. It writes one structured Cloud Logging entry (`severity=WARNING`, `logName` containing `ai-content-report`) **without the UID and without the transcript**, and returns 204.
-   Reports are kept for the `_Default` log bucket retention of 30 days (Sources) and are read in Logs Explorer. No new datastore. The privacy policy states this.

**Why logs instead of Firestore:** the volume is tiny, nothing needs querying across users, and logs expire on their own. A recommendation `reason` can paraphrase the user's words, so the entry deliberately carries no identifier.

## Data inventory (draft for the privacy policy, Play Data safety and App Store privacy details)

The operator confirms every row, with legal advice if needed. Under Play's definitions, "collected" means the data leaves the device, and a transfer to a service provider that processes data on BookMind's behalf is not "sharing" (Sources).

| Data                                                        | Leaves device to                             | Purpose                  | Retention                                                                                              | Linked to user                                           |
| ----------------------------------------------------------- | -------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Email, display name, password hash                          | Firebase Auth (Google)                       | Account                  | Until account deletion                                                                                 | Yes                                                      |
| Firebase UID                                                | BookMind backend; Firestore `llmQuota`       | Auth, quota              | Counter ≤ ~72 h (TTL)                                                                                  | Yes                                                      |
| Chat messages (≤3 × 500 chars), liked books (title, author) | BookMind backend (memory only) → OpenAI (US) | Generate recommendations | BookMind: not stored. OpenAI API: up to 30 days for abuse monitoring, not used for training by default | Sent without UID; tied to BookMind's OpenAI organisation |
| Reported AI text + reason                                   | Cloud Logging                                | Moderation               | 30 days                                                                                                | No                                                       |
| IP address, user agent, request metadata                    | Cloud Run request logs                       | Operations, security     | 30 days (`_Default` bucket)                                                                            | Not by BookMind                                          |
| Book title/ISBN lookups                                     | Google Books API (direct from the device)    | Covers and links         | Google's terms                                                                                         | No                                                       |
| Reading list, last recommendations, consent flag            | Never (IndexedDB on the device)              | App features             | Until the user deletes the account or the app data                                                     | n/a (not collected)                                      |

All traffic uses HTTPS. Cloud Run and Firebase serve TLS only. The Android base network config already sets `cleartextTrafficPermitted="false"`.

## Risks / Trade-offs

-   **Cloud Run service account cannot reach Firestore or the secret** → every call returns 500. Mitigation: the runbook lists the IAM grants, and the post-deploy smoke test calls the API with a real token: no token → 401, valid → 200, then 429 after the limit.
-   **Store reviewers delete the demo account** while testing deletion. Mitigation: the operator keeps the reviewer credentials in Play "App access" and in App Review notes up to date, and recreates the account after each review.
-   **The reviewer exhausts the daily quota.** 10 calls is 5 full chats. If that proves tight, it is an env change, not a release.
-   **Forgotten password blocks reauthentication.** Mitigation: a "Forgot password?" link in the dialog and on the web page, and the privacy contact email in the policy as the last resort.
-   **TTL is not instant.** Firestore deletes expired documents "typically within 24 hours". The privacy policy states the upper bound, not the target.
-   **Users decline AI consent.** The core feature is then unavailable. This is accepted: it is what 5.1.2(i) requires, and the panel explains it.
-   **The CORS origin of the Android WebView differs from expectations.** Mitigation: the API client card verifies the actual `Origin` header on the API 36 emulator against the production CORS list before the operator deploys.
-   **`firebase.json` merge conflict with #54.** Mitigation: noted on both cards. The second card to merge keeps both sections.
-   **OpenAI model lifecycle.** `gpt-4o-mini` is not listed as deprecated (checked 2026-10-09). No action now.

## Migration Plan

The app is pre-launch with no production users. The work merges card by card (see `tasks.md`); the store submission happens after everything below is green.

1. Backend protection merges (tests use mocked token verification and an in-memory or emulator Firestore).
2. **Operator**: enables Blaze and a budget alert, creates the Firestore database (location is permanent), runs the deploy runbook, applies the TTL policy, and records the Cloud Run URL.
3. API client merges. The production build points `VITE_API_BASE_URL` at the Cloud Run URL.
4. Account deletion, public routes and the privacy link, AI consent, and AI reporting merge in the order in `tasks.md`.
5. **Operator**: Iubenda policy generated and approved. The policy ID goes into `firebase.json`. `firebase deploy --only hosting`. `/privacy` and `/delete-account` are checked in a private browser window.
6. **Operator**: Play Console App content (privacy URL, Data safety with the deletion URL, App access credentials, content rating, target audience, ads = none). Closed test if the account requires it.
7. End-to-end on a clean Android install: register → consent → chat → recommendations → report → save → delete the account in the app → the Firebase user is gone, the device has no residual data, and the API returns 401 with the old token.
8. **Rollback**: before submission, revert the merge commits. Scale Cloud Run to zero or delete it. The `llmQuota` documents expire by themselves.

## Open Questions (operator decisions)

1. **Daily limit**: 10 LLM calls (≈5 chats) per user per day? A lower free tier (e.g. 2 chats) is possible; the value is an env var.
2. **Firestore location** (permanent): `europe-west1` (same region as Cloud Run, proposed) or the multi-region `eur3`.
3. **Billing**: enable Blaze, plus the budget-alert amount. `min-instances=1` (no cold start, costs money) yes/no.
4. **AI reporting in scope?** Recommended yes (Decision 9).
5. **Legal text**: the consent panel copy, the corrected transparency note, the `/delete-account` page text, and the privacy contact email. The Iubenda plan and modules (price not re-verified), and ES as a third policy language.
6. **OpenAI Zero Data Retention or EU data residency**: both need OpenAI approval, and EU residency adds a 10% price uplift on recent models (Sources). Recommended: not for v1; disclose the 30-day retention instead.
7. **Custom domain / name (#18)**: launching on `*.web.app` means the Play and App Store URLs change if a domain is added later.
8. **Obsolete cards** #39, #40 and #41 ("backend with python", "strutturare meglio gli endpoint", "pubblicare il server online") are superseded by this change's backend cards. Archive them?

## Sources (checked 2026-10-09)

| Requirement                                                                                                                                  | URL                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Play account deletion: in-app path + web link in Data safety, delete associated data, disclose retention                                     | https://support.google.com/googleplay/android-developer/answer/13327111                                                 |
| Play Data safety: privacy policy required, "collect"/"share", service providers, ephemeral processing, deletion questions                    | https://support.google.com/googleplay/android-developer/answer/10787469                                                 |
| Play User Data policy: policy link in Console **and** in the app, public, non-geofenced, not a PDF, retention/deletion; Prominent Disclosure | https://support.google.com/googleplay/android-developer/answer/10144311                                                 |
| Play AI-Generated Content: in-app reporting/flagging                                                                                         | https://support.google.com/googleplay/android-developer/answer/13985936                                                 |
| Play App access: reviewer login credentials                                                                                                  | https://support.google.com/googleplay/android-developer/answer/15748846                                                 |
| Play: new personal accounts (after 2023-11-13) need 12 testers opted in for 14 days of closed testing before production                      | https://support.google.com/googleplay/android-developer/answer/14151465                                                 |
| Play listing assets: 512×512 icon, 1024×500 feature graphic, ≥2 screenshots                                                                  | https://support.google.com/googleplay/android-developer/answer/9866151                                                  |
| Play: new apps must publish as AAB (since Aug 2021); Play App Signing, upload key kept by the developer                                      | https://developer.android.com/guide/app-bundle · https://support.google.com/googleplay/android-developer/answer/9842756 |
| Apple App Review Guidelines 5.1.1(i), 5.1.1(v), 5.1.2(i), 4.8, 2.4.1, 4.2                                                                    | https://developer.apple.com/app-store/review/guidelines/                                                                |
| Apple: offering account deletion (find it easily, delete the whole record, tell timing and retention, reauth allowed)                        | https://developer.apple.com/support/offering-account-deletion-in-your-app/                                              |
| Google Cloud free tier (Cloud Run, Firestore, Secret Manager; billing account required)                                                      | https://docs.cloud.google.com/free/docs/free-cloud-features                                                             |
| Firebase plans (Cloud Run, Secret Manager on Blaze; Hosting on Spark)                                                                        | https://firebase.google.com/pricing                                                                                     |
| Firestore TTL policies                                                                                                                       | https://firebase.google.com/docs/firestore/ttl                                                                          |
| Cloud Logging retention (`_Default` 30 days, configurable)                                                                                   | https://docs.cloud.google.com/logging/quotas                                                                            |
| OpenAI API data controls (30-day abuse-monitoring retention, no training by default, ZDR, EU residency)                                      | https://developers.openai.com/api/docs/guides/your-data                                                                 |
| OpenAI deprecations (`gpt-4o-mini` not listed)                                                                                               | https://developers.openai.com/api/docs/deprecations                                                                     |
