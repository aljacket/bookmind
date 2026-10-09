## Context

BookMind is a Vue 3 + Capacitor 8 app. Android targets API 36 (card #50, archived as `2026-10-08-capacitor-8-upgrade`). iOS is not buildable yet (card #55). A thin FastAPI backend (`bookmind-server/main.py`) proxies two calls to OpenAI `gpt-4o-mini`. Firebase Auth handles accounts, using email/password only (`LoginPage.vue`, `RegisterPage.vue`; `RegisterPage` also stores a display name). Firestore is initialised in `src/services/firebase/config.ts` but never read or written. All user-derived state lives on the device in IndexedDB (`BookMindDB` v3, stores `userPreferences`, `apiCalls` and `readingList`, keys prefixed with `${uid}_`).

This change was written on 2026-04-28. It was reviewed on 2026-10-09 for card #44 against `main` b8a13b6 and against the store rules re-checked that day (see "Sources"). The operator decided the open questions on 2026-10-09; they are recorded in "Operator decisions (resolved 2026-10-09)" below, and Decisions 10 and 11 were added as a result.

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
-   Custom domain or new app name (#18). Postponed by the operator on 2026-10-09. v1 uses the default `<project-id>.web.app`, and the policy itself is hosted by Iubenda.
-   Distribution outside Italy (Decision 11), and an English or Spanish store listing.
-   Migrating the reading list or the chat to Firestore. The client still never writes to Firestore.
-   Sign in with Apple. Apple 4.8 applies only to third-party or social login.
-   Launcher icon, splash, signed release AAB, store listing assets. Each has its own card.
-   The feedback/petitions feature, content moderation beyond receiving reports, in-app purchases.

## Decisions

### Decision 1: Cloud Run (europe-west1) for the backend

The FastAPI service runs as a container on Cloud Run in `europe-west1`, in the GCP project behind the existing Firebase project. The LLM API key (`LLM_API_KEY`, Decision 10) is read from Secret Manager. Settings decided by the operator on 2026-10-09:

-   minimum instances **0**. Cold starts are accepted, so nothing is billed while the service is idle.
-   maximum instances **2**, so that a traffic spike cannot become a bill spike.
-   a Cloud Billing budget of **10 € per month**, alerting at the default thresholds.

The runbook stays frugal: no other paid resources, no `min-instances`, and no paid monitoring. The budget only sends alerts and never stops spending (Sources). Spend is bounded by the per-user quota and by the instance cap.

**Why:** the service is stateless and request-scoped. The Cloud Run free tier (2 M requests, 180 000 vCPU-s, 360 000 GiB-s per month) is far above the expected launch traffic. Cloud Run, Secret Manager and Cloud Functions all require the Firebase **Blaze** plan, and the Google Cloud free tier requires a billing account (Sources). The alternatives considered in April (Render, Railway, Vercel/Netlify functions, Fly.io, a VM) were rejected for the reasons recorded there: spin-down, a 10 s function timeout, or a separate billing ecosystem. Those reasons were not re-verified and are not load-bearing.

Cold start (one to a few seconds for a Python image) falls inside the existing `ProcessingPage.vue` loading state and the 30 s client timeout. `min-instances=1` is not used: the operator chose Blaze only because real cost at launch traffic is about zero.

### Decision 2: Firebase ID token + per-UID daily quota with expiring counters

-   `POST /recommendations/clarify`, `POST /recommendations` and `POST /reports` require `Authorization: Bearer <Firebase ID token>`. The backend verifies it with `firebase_admin.auth.verify_id_token(token, check_revoked=True)`, using Application Default Credentials on Cloud Run. Revocation checking also rejects the still-unexpired tokens of a deleted user, at the cost of one Auth lookup per request, which is small next to the OpenAI call. A missing or invalid token returns **401** before any OpenAI call.
-   Quota: a Firestore document `llmQuota/{uid}_{YYYY-MM-DD}` (UTC day) with `count` and `expireAt` fields, incremented in a transaction **before** the OpenAI call. When `count` has already reached `DAILY_LLM_CALL_LIMIT` (env, default **10**, decided by the operator on 2026-10-09), the request returns **429** and the LLM provider is not called. Clarify and recommendations both count, so one full chat costs 2. A failed OpenAI call is not refunded; the limit absorbs retries, including the retry flow from card #59.
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
2. `reauthenticateWithCredential` with the password. A "Forgot password?" action in the dialog sends the password-reset email to the signed-in address without leaving the dialog (operator decision 2026-10-09, UX spec section 5: `/forgot-password` is `guestOnly`).
3. Write the marker `bookmind.pendingDeletion = <uid>` to `localStorage`.
4. `deleteUser(currentUser)`. Firebase Auth is the source of truth.
5. `wipeUserData(uid)` removes every key with the prefix `${uid}_` from all three IndexedDB stores (reading list, last recommendations, call counters, consent flag).
6. Clear the marker, `signOut`, clear the auth store, and redirect to `/login?deleted=1`. The login page shows a localized confirmation that the account was deleted.

If step 4 fails, nothing is deleted, the marker is cleared and the error is shown. If the app dies between steps 4 and 6, the **startup sweep** in `main.ts` finds the marker after Firebase Auth has initialised and no user is signed in, runs `wipeUserData(marker)`, and clears the marker.

**Changed from April (R2):** the April sweep wiped every local entry whenever no user was signed in. After a normal logout that would delete the reading list, which exists only on the device. The marker limits the sweep to a UID whose deletion actually started on this device. If the account is deleted from another device or from the web, data left on this device stays local to the user's own device and never reaches BookMind's servers. This is accepted and stated in the policy.

**Why cloud-first:** if `deleteUser` fails, both sides stay intact. The reverse order can leave a live account with an empty reading list.

### Decision 5: Privacy policy hosted by Iubenda, `/privacy` as a stable redirect

The operator subscribes to Iubenda and generates the policy in **Italian and English only** (decided 2026-10-09; there is no ES version, because the first market is Italy, see Decision 11). The policy is generated from the data inventory below. `firebase.json` has two redirects (301), each using a policy ID the operator supplies:

-   `/privacy` → the Italian policy. This is the URL declared in Play Console.
-   `/privacy/en` → the English policy.

-   The Play Console and App Store Connect privacy URL is `https://<project-id>.web.app/privacy`. It is a URL BookMind controls, and it shows the full policy text, which is public, not a PDF and not geofenced.
-   Inside the app, a "Privacy policy" link appears on Login, Register and in the Menu. It opens `VITE_PRIVACY_POLICY_URL` (the Italian policy) when the UI language is `it`, and `VITE_PRIVACY_POLICY_URL_EN` for `en` and `es`. On native it opens the URL in the system browser or an in-app browser, and the user can return to the app.
-   If Iubenda is ever dropped, only the redirect target changes.

**Why not a Vue page with the embed (April):** it loads a third-party script in the app, needs a fallback snapshot that goes stale, and adds a route to maintain. The redirect meets every Play and Apple requirement with no app code. Iubenda vs a hand-written policy or another vendor is the operator's legal choice. April's rationale (an Italian-native vendor with maintained templates) still stands.

### Decision 6: Menu entry, not a Settings page

"Delete account" and "Withdraw AI consent" are added to `Menu.vue` in a separate "danger zone" below logout. Apple asks for deletion to be easy to find, "typically" in account settings. The menu is the app's only settings surface, so this qualifies. The full-screen menu layout is the ux-designer's call.

### Decision 7: CORS from the environment

`CORS_ALLOWED_ORIGINS` is a comma-separated environment variable. Its local default reproduces today's dev list, and production sets the list from Decision 3.

### Decision 8: Explicit AI consent before the first call to the AI provider (new)

Apple 5.1.2(i): "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." Play's Prominent Disclosure rule follows the same pattern (disclosure in the app, an affirmative action, and navigating away is not consent). It applies when data use may fall outside what users expect.

-   On `/preferences`, before the first message can be sent, a consent panel states:
    -   what is sent (the chat messages and the titles and authors of liked books)
    -   to whom: the LLM provider in production, by name and country. With a router (OpenRouter, Hugging Face), this means the router and the pinned upstream provider. The default is OpenAI, US, until #71 decides otherwise.
    -   why (to generate the recommendations)
    -   retention (not stored on BookMind's servers; kept by the provider for its stated period, which for OpenAI is up to 30 days for abuse monitoring)
    -   a link to the privacy policy
-   The panel has two explicit buttons: accept and decline. Nothing is sent until the user accepts.
-   The decision is stored per UID and per device in IndexedDB (`${uid}_aiConsent = { granted, at, version }`). `version` is a constant in code; raising it asks again when the disclosure changes materially.
-   Declining keeps the chat disabled with a short explanation. The reading list and the rest of the app keep working.
-   "Withdraw AI consent" in the menu sets `granted = false`. The next visit to the chat shows the panel again.
-   `AiTransparencyNote.vue` stays visible during the chat. Its copy is corrected: "nothing stored" becomes "not stored on BookMind's servers" (MODIFIED requirement in `conversational-recommendation`). The operator approves the final wording in all three languages, using the copy proposed in #44 as the starting point (decided 2026-10-09).
-   **Dependency:** the recipient named in this panel, in the transparency note and in the Iubenda third-party list must be the provider decided after the evaluation in #71 (Decision 10). Card #65 enters Pronto only after that decision. The ux-designer spec can be written earlier.

### Decision 9: In-app reporting of AI output (new)

The Play AI-Generated Content policy names "text-to-text conversational generative AI chatbots, in which interacting with the chatbot is a central feature of the app" and requires "in-app user reporting or flagging features". BookMind's chat qualifies. The operator confirmed on 2026-10-09 that AI reporting is in scope for v1 (#66, #67).

-   A "Report" action appears on the clarifier question and on each recommendation card. The user picks a reason (offensive, inaccurate, other) and confirms, without leaving the app.
-   `POST /reports` (auth required, its own per-UID limit `DAILY_REPORT_LIMIT`, default 20) takes `{kind: "clarifier"|"recommendation", lang, content (≤1000 chars, the AI text only), reason}`. It writes one structured Cloud Logging entry (`severity=WARNING`, `logName` containing `ai-content-report`) **without the UID and without the transcript**, and returns 204.
-   Reports are kept for the `_Default` log bucket retention of 30 days (Sources) and are read in Logs Explorer. No new datastore. The privacy policy states this.

**Why logs instead of Firestore:** the volume is tiny, nothing needs querying across users, and logs expire on their own. A recommendation `reason` can paraphrase the user's words, so the entry deliberately carries no identifier.

### Decision 10: The LLM provider sits behind configuration and is evaluated before the consent copy is final (new, 2026-10-09)

The operator wants to know whether a better, cheaper or more accurate model exists before committing to OpenAI. Card #71 runs the evaluation. Its outcome must not hold up #60 to #62, so a later switch has to cost nothing but configuration:

-   Every LLM call goes through one backend module (`bookmind-server/llm.py`). That module reads three settings from the environment:
    -   the OpenAI-compatible base URL, `LLM_BASE_URL`. When it is unset, the OpenAI default applies.
    -   the model, `LLM_MODEL`, default `gpt-4o-mini`.
    -   the key, `LLM_API_KEY`, which falls back to `OPENAI_API_KEY` so existing local `.env` files keep working.
    -   optionally, `LLM_EXTRA_BODY`, a JSON object merged into every request. It carries router-specific options that the OpenAI SDK does not model, such as OpenRouter's `provider` routing object.
-   OpenRouter and Hugging Face Inference Providers both expose OpenAI-compatible chat-completion endpoints (Sources), so the existing `openai` SDK serves all three. This is built in #60 and deployed through the runbook in #61. No code outside `llm.py` imports the SDK.
-   **Evaluation (#71, backend-engineer, offline, no production code).** The baseline is `gpt-4o-mini` on OpenAI. It is compared with 3 to 5 models chosen when the evaluation runs, from the current OpenRouter and Hugging Face catalogs. All of them use the unchanged prompts from `prompts.py` and the same fixed test set: at least 12 synthetic cases, mostly Italian, some English and Spanish, and 2 off-topic cases.
    -   Quality: three books per answer, in the right language, with reasons that cite the user's words. Each book must exist, checked by title and author against Google Books. Books already marked as read must not come back. The clarifier must ask one question of fewer than 25 words that is not about genre. The operator also rates at least 5 cases blind.
    -   Cost: measured tokens × listed price, plus any credit-purchase fee. It is reported per chat, per user per day at the full quota of 10 calls, and per month for 100 daily active users.
    -   Latency: p50 and p95 per model and endpoint. The p95 of `/recommendations` should be **≤ 15 s**, which leaves room for a cold start inside the 30 s client timeout. A model above that is flagged, not automatically excluded.
    -   JSON: no parse failures by the current parser on recommendations across all runs, with `response_format` `json_object` where the route supports it.
    -   Data handling: for each route, the retention, training use, country of processing, and ZDR or data-collection options, each with its official link.
-   **Recipients must be finite and stable.** A router forwards each request to an upstream provider whose data policy varies. Every candidate is therefore tested and, if chosen, deployed with the provider pinned:

    -   on OpenRouter, `provider.only` with `allow_fallbacks: false`, plus `data_collection: "deny"` and/or `zdr: true`;
    -   on Hugging Face, the `model:provider` suffix.

    If a router is chosen, the policy and the consent name both the router and the pinned provider.

-   **Order.** The operator decides from the #71 report, and the product-lead records the decision here. Only after that are the consent and transparency copy (#65) and the Iubenda third-party list (operator step 0.5) finalised, because Apple 5.1.2(i) and the policy must name the actual recipient. If the decision is to switch, a small follow-up card changes only deployment configuration and the runbook.

**Rough cost today (estimate, to be replaced by #71's measurements):** at the verified `gpt-4o-mini` price ($0.15 per 1M input tokens, $0.60 per 1M output tokens), assume about 2 000 input and 500 output tokens per chat. That is about $0.0006 per chat, or about $0.003 per user per day at the full quota. Cost is not the deciding factor at launch traffic. Quality, latency, JSON reliability and data handling are.

### Decision 11: First market is Italy only (new, 2026-10-09)

The operator chose the simplest possible launch.

-   **Play distribution:** the production countries/regions are **Italy** only. Testing tracks follow production by default. Internal testing ignores country targeting. Closed testing **does** follow it: closed testers must have a Play country of Italy, or the operator unsyncs the closed track's countries (Sources). This matters for the 12-tester / 14-day closed test.
-   **Store listing:** the default language is **Italian (it-IT)**, and there is **no English translation for v1**. Graphics come from the default language when a translation has no localized graphics, so one set of assets suffices (Sources). An English listing can be added later without a release.
-   **Data safety** is one global form per app, regardless of country (Sources). Choosing Italy changes nothing in the form. It is filled once from the inventory below.
-   **The app's UI languages stay en/it/es.** No code is removed. The policy exists in IT and EN, and Spanish UI users get the English policy (Decision 5).
-   The App Store (#55) is out of scope here. When it comes, the same Italy-first choice is the default proposal.

## Data inventory (draft for the privacy policy, Play Data safety and App Store privacy details)

The operator confirms every row, with legal advice if needed. Under Play's definitions, "collected" means the data leaves the device, and a transfer to a service provider that processes data on BookMind's behalf is not "sharing" (Sources).

| Data                                                        | Leaves device to                                                                                         | Purpose                  | Retention                                                                                                                                   | Linked to user                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Email, display name, password hash                          | Firebase Auth (Google)                                                                                   | Account                  | Until account deletion                                                                                                                      | Yes                                                   |
| Firebase UID                                                | BookMind backend; Firestore `llmQuota`                                                                   | Auth, quota              | Counter ≤ ~72 h (TTL)                                                                                                                       | Yes                                                   |
| Chat messages (≤3 × 500 chars), liked books (title, author) | BookMind backend (memory only) → LLM provider (default OpenAI, US; final recipient per #71, Decision 10) | Generate recommendations | BookMind: not stored. OpenAI API: up to 30 days for abuse monitoring, not used for training by default. Another provider: its stated policy | Sent without UID; tied to BookMind's provider account |
| Reported AI text + reason                                   | Cloud Logging                                                                                            | Moderation               | 30 days                                                                                                                                     | No                                                    |
| IP address, user agent, request metadata                    | Cloud Run request logs                                                                                   | Operations, security     | 30 days (`_Default` bucket)                                                                                                                 | Not by BookMind                                       |
| Book title/ISBN lookups                                     | Google Books API (direct from the device)                                                                | Covers and links         | Google's terms                                                                                                                              | No                                                    |
| Reading list, last recommendations, consent flag            | Never (IndexedDB on the device)                                                                          | App features             | Until the user deletes the account or the app data                                                                                          | n/a (not collected)                                   |

All traffic uses HTTPS. Cloud Run and Firebase serve TLS only. The Android base network config already sets `cleartextTrafficPermitted="false"`.

## Risks / Trade-offs

-   **Cloud Run service account cannot reach Firestore or the secret** → every call returns 500. Mitigation: the runbook lists the IAM grants, and the post-deploy smoke test calls the API with a real token: no token → 401, valid → 200, then 429 after the limit.
-   **Store reviewers delete the demo account** while testing deletion. Mitigation: the operator keeps the reviewer credentials in Play "App access" and in App Review notes up to date, and recreates the account after each review.
-   **The reviewer exhausts the daily quota.** 10 calls is 5 full chats. If that proves tight, it is an env change, not a release.
-   **Cold starts with `min-instances 0`.** The first request after idle pays the container start. This is accepted (operator, 2026-10-09). The 30 s client timeout and #71's latency threshold leave room for it.
-   **The budget alert does not cap spend.** It only notifies. The main variable cost is the LLM provider, bounded by quota × users and by `--max 2`. The operator may also set a spending limit in the provider's own console, if it offers one. OpenRouter credits are prepaid.
-   **Closed testers outside Italy cannot install the closed test** while the closed track is synced to Italy-only production. Mitigation: recruit testers whose Play country is Italy, or unsync the closed track (Decision 11).
-   **Provider switch after #65 has merged.** If #71 lands late and recommends a different provider, the consent `version` constant is raised, users are asked again, and the policy is updated. This is the reason #65 waits for #71.
-   **Forgotten password blocks reauthentication.** Mitigation: a "Forgot password?" action in the dialog that sends the reset email (and a reset path on the web page, #64), and the privacy contact email in the policy as the last resort.
-   **TTL is not instant.** Firestore deletes expired documents "typically within 24 hours". The privacy policy states the upper bound, not the target.
-   **Users decline AI consent.** The core feature is then unavailable. This is accepted: it is what 5.1.2(i) requires, and the panel explains it.
-   **The CORS origin of the Android WebView differs from expectations.** Mitigation: the API client card verifies the actual `Origin` header on the API 36 emulator against the production CORS list before the operator deploys.
-   **`firebase.json` merge conflict with #54.** Mitigation: noted on both cards. The second card to merge keeps both sections.
-   **OpenAI model lifecycle.** `gpt-4o-mini` is not listed as deprecated (checked 2026-10-09). The model is an env setting (Decision 10).

## Migration Plan

The app is pre-launch with no production users. The work merges card by card (see `tasks.md`); the store submission happens after everything below is green.

1. Backend protection merges (tests use mocked token verification and an in-memory or emulator Firestore).
2. **Operator**:
    - enables Blaze with a budget of 10 € per month;
    - creates the Firestore database in `europe-west1` (the location is permanent);
    - runs the deploy runbook with `--min 0 --max 2`;
    - applies the TTL policy;
    - records the Cloud Run URL.
3. API client merges. The production build points `VITE_API_BASE_URL` at the Cloud Run URL.
4. Account deletion, public routes and the privacy link, AI consent, and AI reporting merge in the order in `tasks.md`.
5. **Operator**:
    - The provider is decided from #71.
    - The Iubenda policy is generated in IT and EN, naming that provider, and approved.
    - The policy IDs go into `firebase.json`, then `firebase deploy --only hosting`.
    - `/privacy`, `/privacy/en` and `/delete-account` are checked in a private browser window.
6. **Operator**: Play Console.
    - Countries/regions: Italy only.
    - Store listing: default language it-IT.
    - App content: privacy URL `/privacy`, Data safety with the deletion URL, App access credentials, content rating, target audience, ads = none.
    - Closed test if the account requires it, with testers whose Play country is Italy (Decision 11).
7. End-to-end on a clean Android install: register → consent → chat → recommendations → report → save → delete the account in the app → the Firebase user is gone, the device has no residual data, and the API returns 401 with the old token.
8. **Rollback**: before submission, revert the merge commits. Scale Cloud Run to zero or delete it. The `llmQuota` documents expire by themselves.

## Operator decisions (resolved 2026-10-09)

| #   | Question                       | Decision (2026-10-09)                                                                                                                                                                                         | Where it lands                                 |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Daily limit                    | `DAILY_LLM_CALL_LIMIT` = **10** calls per user per UTC day (about 5 chats).                                                                                                                                   | Decision 2, #60                                |
| 2   | Firestore location (permanent) | **`europe-west1`**, the same region as Cloud Run.                                                                                                                                                             | Migration plan, #61 runbook, operator step 0.3 |
| 3   | Billing                        | **Blaze: yes.** Budget alert **10 € per month**. Cloud Run `--max 2`, `--min 0` (cold starts accepted). Blaze was chosen only because real cost at launch traffic is about zero, so the runbook stays frugal. | Decision 1, #61                                |
| 4   | AI reporting                   | **In scope** for v1.                                                                                                                                                                                          | Decision 9, #66, #67                           |
| 5   | Legal copy, Iubenda            | Proceed with the proposed copy (consent panel, transparency note, deletion texts, privacy contact). The operator approves the final wording on each card. Iubenda policy in **IT + EN only**, no ES.          | Decisions 5 and 8, #63, #64, #65               |
| 6   | Market                         | **Italy only** first. Play distribution limited to Italy. Store listing in Italian only (product-lead's choice: no EN translation in v1).                                                                     | Decision 11, #70                               |
| 7   | OpenAI ZDR / EU residency      | **No** for v1. The 30-day retention is disclosed instead.                                                                                                                                                     | Decision 8, data inventory                     |
| 8   | Custom domain (#18)            | **Postponed.** The policy is on Iubenda, behind redirects on the default `*.web.app` Hosting domain, and `/delete-account` is on the same domain. #18 stays in Idee.                                          | Non-goals, Decision 3                          |
| 9   | Obsolete cards #39, #40, #41   | Archived by the operator.                                                                                                                                                                                     | —                                              |
| 10  | LLM provider (new)             | **To be decided** from the #71 evaluation. Does not block #60 to #62. Blocks the final copy of #65 and the Iubenda third-party list.                                                                          | Decision 10, #71                               |
| 11  | #63 deletion UX (new)          | Copy approved as drafted; "Forgot password?" sends the reset email from the dialog; no haptics (#45); no data export in v1 (own Idee card); AI retention line follows #71 through the shared constant.        | UX spec section 14, #63                        |

Prices for Iubenda were not re-verified. The operator checks them at purchase time.

## Sources (checked 2026-10-09)

| Requirement                                                                                                                                      | URL                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Play account deletion: in-app path + web link in Data safety, delete associated data, disclose retention                                         | https://support.google.com/googleplay/android-developer/answer/13327111                                                             |
| Play Data safety: privacy policy required, "collect"/"share", service providers, ephemeral processing, deletion questions                        | https://support.google.com/googleplay/android-developer/answer/10787469                                                             |
| Play User Data policy: policy link in Console **and** in the app, public, non-geofenced, not a PDF, retention/deletion; Prominent Disclosure     | https://support.google.com/googleplay/android-developer/answer/10144311                                                             |
| Play AI-Generated Content: in-app reporting/flagging                                                                                             | https://support.google.com/googleplay/android-developer/answer/13985936                                                             |
| Play App access: reviewer login credentials                                                                                                      | https://support.google.com/googleplay/android-developer/answer/15748846                                                             |
| Play: new personal accounts (after 2023-11-13) need 12 testers opted in for 14 days of closed testing before production                          | https://support.google.com/googleplay/android-developer/answer/14151465                                                             |
| Play listing assets: 512×512 icon, 1024×500 feature graphic, ≥2 screenshots                                                                      | https://support.google.com/googleplay/android-developer/answer/9866151                                                              |
| Play: new apps must publish as AAB (since Aug 2021); Play App Signing, upload key kept by the developer                                          | https://developer.android.com/guide/app-bundle · https://support.google.com/googleplay/android-developer/answer/9842756             |
| Apple App Review Guidelines 5.1.1(i), 5.1.1(v), 5.1.2(i), 4.8, 2.4.1, 4.2                                                                        | https://developer.apple.com/app-store/review/guidelines/                                                                            |
| Apple: offering account deletion (find it easily, delete the whole record, tell timing and retention, reauth allowed)                            | https://developer.apple.com/support/offering-account-deletion-in-your-app/                                                          |
| Google Cloud free tier (Cloud Run, Firestore, Secret Manager; billing account required)                                                          | https://docs.cloud.google.com/free/docs/free-cloud-features                                                                         |
| Firebase plans (Cloud Run, Secret Manager on Blaze; Hosting on Spark)                                                                            | https://firebase.google.com/pricing                                                                                                 |
| Firestore TTL policies                                                                                                                           | https://firebase.google.com/docs/firestore/ttl                                                                                      |
| Cloud Logging retention (`_Default` 30 days, configurable)                                                                                       | https://docs.cloud.google.com/logging/quotas                                                                                        |
| OpenAI API data controls (30-day abuse-monitoring retention, no training by default, ZDR, EU residency)                                          | https://developers.openai.com/api/docs/guides/your-data                                                                             |
| OpenAI deprecations (`gpt-4o-mini` not listed)                                                                                                   | https://developers.openai.com/api/docs/deprecations                                                                                 |
| OpenAI API pricing (`gpt-4o-mini` $0.15 / $0.60 per 1M tokens; 10% uplift on regional endpoints for models released on or after 2026-03-05)      | https://developers.openai.com/api/docs/pricing                                                                                      |
| OpenRouter provider routing (`only`, `allow_fallbacks`, `data_collection`, `zdr`, `require_parameters`, `response_format` handling)              | https://openrouter.ai/docs/features/provider-routing                                                                                |
| OpenRouter ZDR (OpenRouter does not retain prompts unless the user opts in) and per-provider data policies                                       | https://openrouter.ai/docs/features/zdr · https://openrouter.ai/docs/features/privacy-and-logging                                   |
| OpenRouter FAQ (OpenAI-compatible, no inference markup, 5.5% Stripe credit fee, metadata only by default)                                        | https://openrouter.ai/docs/faq                                                                                                      |
| Hugging Face Inference Providers (OpenAI-compatible `router.huggingface.co/v1`, `:provider` / `:fastest` / `:cheapest` suffixes)                 | https://huggingface.co/docs/inference-providers/index                                                                               |
| Hugging Face Inference Providers security (bodies not stored, logs 30 days, upstream provider policies apply) and pricing (no markup, PRO $2/mo) | https://huggingface.co/docs/inference-providers/en/security · https://huggingface.co/docs/inference-providers/pricing               |
| Firestore locations (`europe-west1` supported; location cannot be changed)                                                                       | https://firebase.google.com/docs/firestore/locations                                                                                |
| Cloud Run min instances (default 0, `--min`) and max instances (`--max`)                                                                         | https://docs.cloud.google.com/run/docs/configuring/min-instances · https://docs.cloud.google.com/run/docs/configuring/max-instances |
| Cloud Billing budgets (alerts only, default 50/90/100%; spend caps are a separate feature)                                                       | https://docs.cloud.google.com/billing/docs/how-to/budgets                                                                           |
| Play: distribute to specific countries (testing tracks synced with production by default; internal testing not country-targeted)                 | https://support.google.com/googleplay/android-developer/answer/7550024                                                              |
| Play: store listing translations (graphics fall back to the default language)                                                                    | https://support.google.com/googleplay/android-developer/answer/9844778                                                              |
| Play Data safety: one global form per package, not per region                                                                                    | https://support.google.com/googleplay/android-developer/answer/10787469                                                             |

## UX spec: in-app account deletion (card #63, task 4.1)

Written by the ux-designer on 2026-10-09 against `main` 7f552ba. This section is the source of truth for the menu entry, the deletion dialog, the post-deletion landing and the startup-sweep UI. It covers the in-app flow only. The public `/delete-account` page (card #64) reuses the dialog body described here, and its own layout is specified on #64.

### What the current screen looks like (checked 2026-10-09, Chrome DevTools, 360×780, 780×360, 1200×800)

-   `Menu.vue` is a full-screen overlay (`fixed inset-0 bg-ink-50 z-40`) with one centred column, `max-w-sm` (384 px), at every width. The top card holds the language select, Preferences and Reading List. The bottom card holds Logout, pushed down with `justify-between`.
-   Measured tap targets at 360 px: Preferences and Reading List are **40 px** high (`py-2` + 20 px icon), below the 44 pt / 48 dp baseline. Logout is 56 px. The new entry must not copy the 40 px rows. Fixing the two existing rows is outside #63; it is noted for the product-lead.
-   At 780×360 (landscape phone) the overlay scrolls: content is 454 px in a 360 px viewport, and Logout starts at y = 334. Anything added below Logout is reached by scrolling. That is acceptable: the overlay is already a scroll container.
-   There is no dialog component in the app yet, no `@capacitor/haptics`, and no Capacitor Keyboard plugin. `AndroidManifest.xml` sets no `windowSoftInputMode`.
-   Errors follow two patterns: `ErrorAlert.vue` (red-50 box with a left border) and the inline chat error in `PreferencesPage.vue`, which keeps a mounted `role="alert"` live region and offers a "Sign in again" action of at least 44 px (`min-h-11`) for an expired session (#62). This spec reuses the second pattern.
-   `/forgot-password` is `guestOnly`. A signed-in user who navigates there is redirected to `/`. See "Forgot password" below: the dialog cannot simply route to it.

### Requirements this spec answers to (checked 2026-10-09)

| Source                                                                                                                                               | What it asks of the in-app flow                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple, Offering account deletion in your app — https://developer.apple.com/support/offering-account-deletion-in-your-app/                            | Easy to find, "typically" in account settings. Delete the whole account record. Deactivation alone is insufficient. No phone, email or support-chat detour outside regulated industries. Reauthentication is allowed, but an app that makes deletion "unnecessarily difficult" fails review. Tell people what is retained, and confirm when deletion is complete.                                                          |
| Apple App Review Guidelines 5.1.1(v) — https://developer.apple.com/app-store/review/guidelines/                                                      | "If your app supports account creation, you must also offer account deletion within the app."                                                                                                                                                                                                                                                                                                                              |
| Google Play, Understanding Google Play's app account deletion requirements — https://support.google.com/googleplay/android-developer/answer/13327111 | Users can start deletion of the account and its data from inside the app. The path is "prominent (for example, within the account settings or a similar section)". Retention practices are disclosed clearly. A web link is required in addition (card #64).                                                                                                                                                               |
| WAI-ARIA APG, Dialog (Modal) pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/                                                        | Focus trapped in the dialog, Escape closes, focus on a static element at the top when content is long, focus the least destructive action when the action is irreversible, focus returns to the invoking element.                                                                                                                                                                                                          |
| Android, window size classes — https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes                             | Width: compact < 600, medium 600–839, expanded 840–1199, large ≥ 1200. Height: compact < 480.                                                                                                                                                                                                                                                                                                                              |
| Firebase JS SDK 10.14.1 error codes (`node_modules/@firebase/auth`, the version in `package.json`)                                                   | `INVALID_LOGIN_CREDENTIALS` maps to `auth/invalid-credential` (projects with email enumeration protection, the default since 2023-09-15 per https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection). Older projects get `auth/wrong-password`. Also `auth/too-many-requests`, `auth/network-request-failed`, `auth/requires-recent-login`, `auth/user-mismatch`, `auth/missing-password`. |

### Flow at a glance

```
Menu ──tap "Delete account"──▶ Deletion dialog (idle)
                                 │  reads what is deleted / kept
                                 │  types password ──▶ "Delete account"
                                 ▼
                               In progress  (reauth → marker → deleteUser → wipe → signOut)
                    ┌────────────┼──────────────────────────────┐
                    ▼            ▼                              ▼
           wrong password   offline / too many /          success
           (field error)    generic (error box)     menu closes, router.replace
           nothing deleted  nothing deleted          ──▶ /login?deleted=1 with the
                    └──── stays in dialog ────┘          "Account deleted" banner
```

One screen, one decision, one password. There is no second "Are you sure?" step and no "type DELETE" field: the password already is the deliberate act, and Apple warns against making deletion unnecessarily difficult.

### 1. Menu entry

Placement (design Decision 6): a third card in `Menu.vue`, below the Logout card, inside the same bottom `w-full max-w-sm px-4` column.

| Property                    | Value                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Gap above the card          | 24 px (`mt-6`), wider than any other gap in the menu, so the card reads as separate from Logout                                                 |
| Card                        | Same as the Logout card: `bg-white rounded-xl shadow-lg`                                                                                        |
| Row                         | `<button type="button">`, full width, `min-h-12` (48 px), `py-3 px-6`, `flex items-center`, left-aligned, label wraps instead of truncating     |
| Icon                        | Trash outline, 20×20 (`w-5 h-5 mr-2`), `aria-hidden="true"`                                                                                     |
| Label                       | i18n `delete_account_menu`, `text-red-700` (#b91c1c on white, 6.5:1). Same font size and weight as Logout                                       |
| Pressed                     | `active:bg-red-50`, also `hover:bg-red-50` for pointer users. Hover is never the only affordance                                                |
| Focus                       | `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600`                                                                      |
| Meaning not by colour alone | The word "Delete" and the trash icon carry the meaning; the red is reinforcement                                                                |
| Card #65                    | "Withdraw AI consent" goes into this same card, **above** "Delete account", separated by a 1 px `border-ink-100` divider. Non-destructive first |

Behaviour: tapping opens the deletion dialog **over** the open menu. The menu stays open underneath, so Cancel returns the user exactly where they were. The dialog must stack above the hamburger button (`z-50`): teleport it to `body` with `z-[60]`.

The entry exists in every authenticated screen that renders `Header` (Home, Preferences, Reading List). It is never rendered when signed out, because the menu itself is not.

### 2. Deletion dialog: presentation per window class

The dialog is one component (`DeleteAccountDialog.vue`, task 4.4) with two presentations chosen by **available width and height**, never by device type or orientation:

| Condition                                                                                           | Presentation             |
| --------------------------------------------------------------------------------------------------- | ------------------------ |
| width < 600 px, **or** height < 480 px (compact width, or compact height such as a landscape phone) | **Full-screen dialog**   |
| width ≥ 600 px **and** height ≥ 480 px (medium, expanded, large)                                    | **Centred modal dialog** |

CSS: `@media (min-width: 600px) and (min-height: 480px)` switches to the centred presentation. The landscape phone at 780×360 is medium width but compact height, so it gets the full-screen presentation: a centred box with a keyboard open would leave about 150 px of usable height.

Why full-screen on compact: the dialog holds a text field and roughly a screen of explanation. A small centred box on a 360 px phone with the keyboard open would hide either the explanation or the button. This is the Material "full-screen dialog" pattern for compact windows; the centred box is the standard dialog for larger windows.

#### 2a. Full-screen (compact)

```
┌──────────────────────────────────┐ ← safe-area top
│ [×]                              │  top bar 56 px, close 48×48 at left
├──────────────────────────────────┤
│ Delete your account?             │  h2, Playfair, text-2xl
│ This permanently deletes …       │  lead, text-base ink-700
│                                  │
│ ┌ Deleted now ─────────────────┐ │  group 1
│ │ • Your account: email, …     │ │
│ │ • On this device: reading …  │ │
│ └──────────────────────────────┘ │
│ ┌ Kept for a limited time ─────┐ │  group 2
│ │ • Usage counter … 3 days     │ │
│ │ • Messages … provider … days │ │
│ │ • Server logs … 30 days      │ │
│ │ • Other devices …            │ │
│ └──────────────────────────────┘ │
│ Details: Privacy policy ↗        │  only once #64 has merged
│                                  │
│ Account  name@example.com        │
│ Enter your password to confirm   │  visible label
│ [••••••••••••               ]    │  .form-input, 48 px min
│ field error (if any)             │
│ Forgot password?                 │  link, 44 px target
│ reset status (if any)            │
│ ┌ error box (role=alert) ──────┐ │  mounted always, visible on error
│ └──────────────────────────────┘ │
├──────────────────────────────────┤  sticky action bar, border-t ink-200
│ [      Delete account       ]    │  destructive, 48 px
│ [          Cancel           ]    │  secondary, 48 px
└──────────────────────────────────┘ ← safe-area bottom or keyboard
```

-   Container: `fixed inset-0 z-[60] bg-white flex flex-col`. It covers the whole window including the system-bar areas, and every edge clears the safe areas:
    -   top bar `pt-[var(--bm-safe-top)]`, height 56 px below it.
    -   body and action bar `pl-[calc(1rem+var(--bm-safe-left))] pr-[calc(1rem+var(--bm-safe-right))]`.
    -   action bar `pb-[calc(0.75rem+max(var(--bm-safe-bottom),var(--bm-kb-inset,0px)))]` (see "Keyboard").
-   Body: `flex-1 overflow-y-auto overscroll-contain`, `pt-2 pb-6`, `space-y-5`. Text column capped at `max-w-prose` so a 599 px window does not produce over-long lines.
-   Action bar: `border-t border-ink-200 bg-white pt-3`, two buttons stacked `space-y-3`. "Delete account" on top, "Cancel" below it, nearest the thumb.
-   Close (×): 48×48, `aria-label` = i18n `delete_account_close`. It behaves as Cancel.
-   Enter animation: slide up 16 px plus fade, 200 ms ease-out. Exit 150 ms. With `prefers-reduced-motion: reduce`, fade only.

#### 2b. Centred modal (medium, expanded, large)

```
            scrim ink-900/50 covers the window
      ┌────────────────────────────────────────────┐
      │ Delete your account?                   [×] │  header px-6 pt-6
      │────────────────────────────────────────────│
      │ (same body as compact, px-6)               │  scrolls inside
      │                                            │
      │────────────────────────────────────────────│
      │             [ Cancel ] [ Delete account ]  │  footer px-6 py-4, right-aligned
      └────────────────────────────────────────────┘
```

-   Width `min(560px, 100vw - 48px)`. Height grows with content up to `calc(100dvh - 48px - var(--bm-safe-top) - var(--bm-safe-bottom))`, then the body scrolls and header and footer stay fixed.
-   Box: `bg-white rounded-2xl border border-ink-200 shadow-xl`, centred with `place-items-center`, offset by the safe areas.
-   The h2 title sits in the header next to the close button (48×48, top-right), so the body starts with the lead paragraph.
-   Footer: a row, `justify-end gap-3`. "Cancel" on the left, "Delete account" on the right. Each button `min-h-12`, `px-6`, width from content (`w-auto`, not the `w-full` of `CTAButton`). If the labels do not fit on one row (200 % text), the row wraps and both buttons become full width, "Delete account" on top.
-   The same 560 px box is used at 840 and 1200 px. A destructive confirmation is modal at every size; it does not become a side panel.
-   Enter: fade plus scale 0.95 → 1, 150 ms, matching the menu's `fade` transition. Reduced motion: fade only.
-   Scrim tap = Cancel, only in the idle and error states.

### 3. Dialog content

Order in the body, both presentations:

1.  **Title** (h2, `font-serif text-2xl text-ink-900`): `delete_account_title`.
2.  **Lead** (`text-base text-ink-700`): `delete_account_lead`. This is the `aria-describedby` target.
3.  **Group "Deleted now"**: heading `delete_account_deleted_heading` (`text-sm font-semibold text-ink-800`, an `h3`), then a `ul` with two items: `delete_account_deleted_account` and `delete_account_deleted_device`. Panel `bg-red-50 border border-red-100 rounded-xl p-4`, list text `text-sm text-ink-700`, trash icon 16 px `text-red-700` before the heading.
4.  **Group "Kept for a limited time"**: heading `delete_account_kept_heading`, then a `ul` with four items: `delete_account_kept_counter`, `delete_account_kept_ai`, `delete_account_kept_logs`, `delete_account_kept_other_devices`. Panel `bg-ink-50 border border-ink-200 rounded-xl p-4`, clock icon 16 px `text-ink-500`.
5.  **Privacy policy link** (`delete_account_policy` + link text `privacy_policy`): rendered only when the privacy-link work of #64 has merged and `VITE_PRIVACY_POLICY_URL` is set. Opens in the system browser on native. If #64 is not merged when #63 ships, the line is omitted. It is not a blocker.
6.  **Account line** (`text-sm text-ink-600`): `delete_account_signed_in_as` with the email in `font-medium text-ink-800`, `break-all` so a long address wraps at 320 px.
7.  **Password field**:
    -   A visible `<label for>` with `delete_account_password_label`. It is not `sr-only` as on Login: the label must stay readable while the user types.
    -   `<input type="password" autocomplete="current-password" enterkeyhint="go" class="form-input">`, at least 48 px high.
    -   For password managers, a visually hidden `<input type="email" autocomplete="username" readonly>` holding the account email, placed before the password field, `tabindex="-1"` and `aria-hidden="true"`.
    -   Field error below the input: `text-sm text-red-700`, `id` referenced by the input's `aria-describedby`. The input gets `aria-invalid="true"` and `border-red-400` while the error shows.
8.  **"Forgot password?"** (`forgot_password`, existing key): a `<button type="button">` styled as a link (`text-accent-700 underline underline-offset-2`), `min-h-11` (44 px) by padding, not by font size. See "Forgot password" below.
9.  **Error box**: a `<div role="alert">` that is always mounted, empty when there is no error, as in `PreferencesPage.vue`. When filled: `bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm`, plus an optional action button `min-h-11`.

Action labels: "Delete account" is `delete_account_confirm` and "Cancel" is `delete_account_cancel`. The verb is the same as the menu entry, so the user always presses the thing they asked for.

Destructive button: `bg-red-700 text-white` (6.5:1), `active:bg-red-800`, `hover:bg-red-800`, focus ring `ring-2 ring-offset-2 ring-red-600`, `rounded-lg font-medium text-sm`, `min-h-12`. Cancel uses the existing `CTAButton variant="secondary"` look. **Token note:** no token change. The app already uses Tailwind's default `red` scale for every error (`ErrorAlert.vue`, the chat error). This spec stays on that scale and does not add a `danger` token.

### 4. States

| State                       | Trigger                                                                                                         | What the user sees                                                                                                                                                                           | Focus / announcements                                                                                          | Data                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Idle**                    | Dialog opened                                                                                                   | Content as above. Both buttons enabled, field empty                                                                                                                                          | Focus on the title (`tabindex="-1"`), not on the field, so the keyboard does not cover the explanation on open | Untouched                                                                                                                                                            |
| **Empty password**          | "Delete account" with an empty field                                                                            | Field error `delete_account_error_empty`. No network call                                                                                                                                    | Focus moves to the field                                                                                       | Untouched                                                                                                                                                            |
| **Offline (pre-check)**     | `navigator.onLine === false` at submit                                                                          | Error box `delete_account_error_offline`. No call. The box clears by itself on the `online` event                                                                                            | Announced by `role="alert"`; focus stays on the button                                                         | Untouched                                                                                                                                                            |
| **In progress**             | Valid submit                                                                                                    | "Delete account" shows a 16 px spinner plus `delete_account_in_progress`, keeps its width. Field, link, Cancel and × are disabled. Escape, scrim tap and the Android back button are ignored | `aria-busy="true"` on the dialog; a polite live region announces `delete_account_in_progress` once             | Sequence of design Decision 4 runs                                                                                                                                   |
| **Wrong password**          | `auth/invalid-credential`, `auth/wrong-password` or `auth/missing-password` from `reauthenticateWithCredential` | Field error `delete_account_error_wrong_password`; the field keeps its value, selected                                                                                                       | Focus to the field, text selected                                                                              | Nothing deleted, marker never written                                                                                                                                |
| **Too many attempts**       | `auth/too-many-requests`                                                                                        | Error box `delete_account_error_too_many`, with a "Forgot password?" reminder in the text                                                                                                    | `role="alert"`                                                                                                 | Nothing deleted                                                                                                                                                      |
| **Network failure**         | `auth/network-request-failed` at any step before `deleteUser` resolves                                          | Error box `delete_account_error_offline`                                                                                                                                                     | `role="alert"`, focus back to "Delete account"                                                                 | Nothing deleted; marker cleared                                                                                                                                      |
| **Reauthentication needed** | `auth/requires-recent-login` from `deleteUser` (unlikely, since reauth runs just before)                        | Field cleared; field error `delete_account_error_reauth`                                                                                                                                     | Focus to the field                                                                                             | Nothing deleted; marker cleared                                                                                                                                      |
| **Session gone**            | `auth/user-token-expired`, `auth/user-mismatch`, `auth/user-not-found`, or no `currentUser`                     | Error box `delete_account_error_session` plus the action `chat_error_session_action` ("Sign in again", existing key), which signs out and goes to `/login`                                   | `role="alert"`; the action is the next focus stop                                                              | Nothing deleted locally (Decision 4: no marker, no wipe)                                                                                                             |
| **Generic failure**         | Any other error before `deleteUser` resolves                                                                    | Error box `delete_account_error_generic`                                                                                                                                                     | `role="alert"`, focus back to "Delete account"                                                                 | Nothing deleted; marker cleared                                                                                                                                      |
| **Success**                 | `deleteUser` resolved                                                                                           | No success state inside the dialog. The dialog and the menu close and `router.replace('/login?deleted=1')` runs (`replace`, so Back cannot return to an authenticated screen)                | See section 6                                                                                                  | Wipe ran. If the wipe threw, the marker is **kept** so the startup sweep retries, and the user still lands on the confirmation, because the account no longer exists |

After any error the dialog returns to an editable state. "Nothing was deleted" is said explicitly in every error that can occur before `deleteUser` succeeds, because the user's real question at that moment is "is my account gone or not?".

Cancel, × and Escape (idle and error states only) close the dialog without side effects and clear the password field from memory.

### 5. Forgot password (decided 2026-10-09: option A, in-dialog reset email)

`/forgot-password` is `guestOnly`, so a signed-in user who navigates there is bounced to `/`. The operator chose option A on 2026-10-09: the dialog sends the reset email itself. `/forgot-password` stays `guestOnly` and the router does not change. The `account-management` spec scenarios "Forgotten password" and "Password-reset email cannot be sent" were rewritten to match.

Behaviour:

-   "Forgot password?" calls the same Firebase function as `ForgotPasswordPage.vue`, `sendPasswordResetEmail(auth, currentUser.email)`. The user types nothing, and the dialog, the menu and the route stay as they are.
-   A status line sits directly under the link: a `<p aria-live="polite">` that is always mounted and empty when there is nothing to say. It is separate from the deletion error box, so a reset message never replaces a deletion error and vice versa.
-   Sending the reset email does not touch the password field, its error, or the deletion error box, and it never deletes anything.

States of the "Forgot password?" action:

| State                   | Trigger                                                                                   | What the user sees                                                                                                                                                                                  | Focus / announcements                                        |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Idle**                | Dialog opened                                                                             | Link enabled, status line empty                                                                                                                                                                     | —                                                            |
| **Offline (pre-check)** | `navigator.onLine === false` at tap                                                       | Status line `delete_account_reset_error` in `text-sm text-red-700`. No request is sent                                                                                                              | Announced by the polite live region; focus stays on the link |
| **Sending**             | Tap while online                                                                          | The link shows a 16 px spinner after its label (`aria-hidden`), is `disabled` with `aria-busy="true"`, and keeps its width. The status line is cleared. "Delete account", Cancel and × stay enabled | Focus stays on the link                                      |
| **Sent**                | `sendPasswordResetEmail` resolved                                                         | Status line `delete_account_reset_sent` with the account email (`text-sm text-sage-700`, email in `font-medium break-all`). The link is enabled again, so the user can resend                       | Announced politely                                           |
| **Error**               | Any rejection (`auth/network-request-failed`, `auth/too-many-requests` or any other code) | Status line `delete_account_reset_error` in `text-sm text-red-700`. The link is enabled again                                                                                                       | Announced politely                                           |

-   A new tap replaces the previous status line, so only one message shows at a time.
-   While the **deletion** is in progress (section 4), the link is disabled as already stated there. If a reset request is still in flight when the deletion succeeds, its result is ignored.
-   No new copy: the action reuses the approved keys `forgot_password`, `delete_account_reset_sent` and `delete_account_reset_error`. For `auth/too-many-requests` the generic error text ("check your connection") is accepted for v1.

The public `/delete-account` page (#64) has its own sign-in form. Before sign-in the visitor is a guest, so #64 decides its reset path there (`/forgot-password` works for guests). Once signed in, the page reuses this dialog body, option A included.

### 6. Where the user lands: `/login?deleted=1`

-   `LoginPage.vue` reads `deleted=1` once on mount, keeps it in component state, then runs `router.replace({ query: {} })`, so a reload or Back does not show the banner again.
-   **Banner**, the first element inside the login card, above the logo, `mb-6`:
    -   `bg-sage-50 border border-sage-200 rounded-xl p-4`.
    -   A check-circle icon, 20 px, `text-sage-600`, `aria-hidden`.
    -   Heading `delete_account_done_title` (`text-sm font-semibold text-sage-800`, `tabindex="-1"`) and body `delete_account_done_body` (`text-sm text-sage-800`).
    -   Container `role="status"`. On mount, focus moves to the heading, so screen readers read the confirmation first and Apple's "provide a confirmation when the deletion is complete" is met for every user.
-   The banner stays until the user leaves the page. It has no close button, so there is nothing to tap by mistake.
-   The language stays the one the user had: the `language` key in `localStorage` is not per-UID and is not wiped.
-   No haptics (out of scope, section 10).

### 7. Startup sweep: what the user sees

The sweep (Decision 4, task 4.5) runs before the app mounts, so it has no UI of its own. Two UX rules:

-   If the sweep wiped data for a marked UID, the first route is `/login?deleted=1`. The user who was interrupted mid-deletion then still gets the confirmation.
-   If a user is signed in and the marker holds that same UID, the deletion never reached Firebase. The marker is cleared silently and the app opens normally. Nothing tells the user their account was deleted, because it was not.

### 8. Focus management and screen readers

-   Dialog element: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = the title, `aria-describedby` = the lead. `role="alertdialog"` is not used: the dialog contains a form and a full explanation, not a short alert.
-   While the dialog is open, the rest of the app (the `#app` root, menu included) gets the `inert` attribute, so neither touch, Tab nor a screen-reader swipe can reach it.
-   Initial focus: the title (`tabindex="-1"`, no visible focus ring on programmatic focus). Per the APG, long content means focus on a static element at the top. On a phone it also keeps the keyboard closed until the user chooses the field.
-   Tab order: × → (links in content) → password → Forgot password → Delete account → Cancel, trapped and wrapping both ways. In the centred presentation × comes first in DOM order too, even though it is drawn top-right.
-   Escape closes, except while in progress.
-   On close without deletion, focus returns to the "Delete account" row in the menu.
-   On success, focus goes to the confirmation heading on `/login` (section 6).
-   Live regions: the error box (`role="alert"`, always mounted), the progress text (`aria-live="polite"`), and the reset status (`aria-live="polite"`).
-   The buttons' accessible names are their visible labels. The spinner is `aria-hidden`.

### 9. Keyboard (on-screen)

-   **Must stay visible above the keyboard while the password field is focused:** the password field and the "Delete account" button. On compact, the sticky action bar sits directly on top of the keyboard.
-   The app has no Keyboard plugin, and Android 15+ draws edge-to-edge, so the WebView may not resize when the keyboard opens. The dialog therefore measures the keyboard itself:
    -   `--bm-kb-inset` = `max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)`, updated on `visualViewport` `resize` and `scroll` while the dialog is open.
    -   The action bar's bottom padding uses `max(safe-bottom, --bm-kb-inset)` (section 2a). In the centred presentation, the box's max-height subtracts it.
    -   If the WebView does resize, the inset computes to 0 and nothing doubles up.
-   On focus, the field calls `scrollIntoView({ block: 'center' })` after the keyboard animation, using the `visualViewport` resize event rather than a fixed timeout.
-   The keyboard's Go/Enter key submits the form, which is the same as pressing "Delete account".
-   A hardware keyboard on a tablet gets the full Tab and Escape behaviour from section 8.

### 10. Haptics (out of scope for #63, decided 2026-10-09)

The operator decided on 2026-10-09 that #63 adds no haptics: `@capacitor/haptics` is not installed and is not added by this card. Haptic feedback belongs to card #45 (native feel), which may revisit the deletion confirmation and the error states. The flow is complete without it, and the acceptance checklist has no haptics item.

### 11. Reflow, orientation, text size

-   It works at 320 px wide with 200 % text: no horizontal scroll, every label wraps, the buttons grow in height, and the body scrolls between the fixed top bar and action bar.
-   It works in portrait and landscape at every class. Landscape phones (height < 480) get the full-screen presentation.
-   Every text uses `rem`; nothing has a fixed height except the 48 px minimums.

### 12. Copy (en / it / es): approved by the operator on 2026-10-09

The operator approved every string below as drafted on 2026-10-09 (card #63 step 6), including the 30-day technical-logs line and the other-devices line. Any later change to a string needs the operator's approval again. The retention lines must match the Iubenda policy word for word on the numbers.

-   `{provider}` and `{days}` in `delete_account_kept_ai` are interpolated from one constant, shared with the #65 consent copy. The default is OpenAI and 30 until #71 decides (Decision 10).
-   The "3 days" counter line comes from Decision 2: TTL expiry plus up to 24 h, about 72 h at most.
-   The "30 days" log line comes from the data inventory row for Cloud Run request logs.

Tone is plain and serious. This dialog deliberately does not use the chat's playful voice ("Something glitched on my end").

| Key                                   | en                                                                                                                                                   | it                                                                                                                                                                | es                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete_account_menu`                 | Delete account                                                                                                                                       | Elimina account                                                                                                                                                   | Eliminar cuenta                                                                                                                                                       |
| `delete_account_close`                | Close                                                                                                                                                | Chiudi                                                                                                                                                            | Cerrar                                                                                                                                                                |
| `delete_account_title`                | Delete your account?                                                                                                                                 | Eliminare il tuo account?                                                                                                                                         | ¿Eliminar tu cuenta?                                                                                                                                                  |
| `delete_account_lead`                 | This permanently deletes your BookMind account. You can't undo it.                                                                                   | Il tuo account BookMind verrà eliminato definitivamente. Non potrai annullare l'operazione.                                                                       | Tu cuenta de BookMind se eliminará de forma permanente. No podrás deshacerlo.                                                                                         |
| `delete_account_deleted_heading`      | Deleted now                                                                                                                                          | Eliminati subito                                                                                                                                                  | Se elimina ahora                                                                                                                                                      |
| `delete_account_deleted_account`      | Your account: email, name and password.                                                                                                              | Il tuo account: email, nome e password.                                                                                                                           | Tu cuenta: email, nombre y contraseña.                                                                                                                                |
| `delete_account_deleted_device`       | On this device: your reading list, your latest recommendations and this account's app settings.                                                      | Su questo dispositivo: la tua lista di lettura, gli ultimi consigli e le impostazioni dell'app per questo account.                                                | En este dispositivo: tu lista de lectura, tus últimas recomendaciones y los ajustes de la app de esta cuenta.                                                         |
| `delete_account_kept_heading`         | Kept for a limited time                                                                                                                              | Conservati per un periodo limitato                                                                                                                                | Se conserva durante un tiempo limitado                                                                                                                                |
| `delete_account_kept_counter`         | Your daily usage counter on our server is removed automatically within 3 days.                                                                       | Il contatore di utilizzo giornaliero sul nostro server viene rimosso automaticamente entro 3 giorni.                                                              | Tu contador de uso diario en nuestro servidor se borra automáticamente en un plazo de 3 días.                                                                         |
| `delete_account_kept_ai`              | BookMind doesn't store the messages you sent for recommendations. The AI provider ({provider}) may keep them for up to {days} days to prevent abuse. | BookMind non conserva i messaggi che hai inviato per ricevere consigli. Il fornitore di IA ({provider}) può conservarli fino a {days} giorni per prevenire abusi. | BookMind no guarda los mensajes que enviaste para recibir recomendaciones. El proveedor de IA ({provider}) puede conservarlos hasta {days} días para prevenir abusos. |
| `delete_account_kept_logs`            | Technical server logs (such as your IP address) are deleted after 30 days.                                                                           | I log tecnici del server (come l'indirizzo IP) vengono cancellati dopo 30 giorni.                                                                                 | Los registros técnicos del servidor (como tu dirección IP) se borran a los 30 días.                                                                                   |
| `delete_account_kept_other_devices`   | If you used BookMind on another device, the reading list there stays on that device until you delete the app or its data.                            | Se hai usato BookMind su un altro dispositivo, la lista di lettura lì resta su quel dispositivo finché non elimini l'app o i suoi dati.                           | Si usaste BookMind en otro dispositivo, la lista de lectura de ese dispositivo se queda allí hasta que elimines la app o sus datos.                                   |
| `delete_account_policy`               | Details are in the {link}.                                                                                                                           | I dettagli sono nell'{link}.                                                                                                                                      | Los detalles están en la {link}.                                                                                                                                      |
| `delete_account_signed_in_as`         | Account: {email}                                                                                                                                     | Account: {email}                                                                                                                                                  | Cuenta: {email}                                                                                                                                                       |
| `delete_account_password_label`       | Enter your password to confirm                                                                                                                       | Inserisci la password per confermare                                                                                                                              | Introduce tu contraseña para confirmar                                                                                                                                |
| `delete_account_confirm`              | Delete account                                                                                                                                       | Elimina account                                                                                                                                                   | Eliminar cuenta                                                                                                                                                       |
| `delete_account_cancel`               | Cancel                                                                                                                                               | Annulla                                                                                                                                                           | Cancelar                                                                                                                                                              |
| `delete_account_in_progress`          | Deleting your account…                                                                                                                               | Eliminazione dell'account in corso…                                                                                                                               | Eliminando tu cuenta…                                                                                                                                                 |
| `delete_account_error_empty`          | Enter your password.                                                                                                                                 | Inserisci la password.                                                                                                                                            | Introduce tu contraseña.                                                                                                                                              |
| `delete_account_error_wrong_password` | That password is incorrect. Nothing was deleted. Try again, or reset your password.                                                                  | La password non è corretta. Non è stato eliminato nulla. Riprova o reimposta la password.                                                                         | La contraseña no es correcta. No se ha eliminado nada. Inténtalo de nuevo o restablece tu contraseña.                                                                 |
| `delete_account_error_too_many`       | Too many attempts. Nothing was deleted. Wait a few minutes and try again, or reset your password.                                                    | Troppi tentativi. Non è stato eliminato nulla. Attendi qualche minuto e riprova, oppure reimposta la password.                                                    | Demasiados intentos. No se ha eliminado nada. Espera unos minutos y vuelve a intentarlo, o restablece tu contraseña.                                                  |
| `delete_account_error_offline`        | You're offline. Nothing was deleted. Connect to the internet and try again.                                                                          | Sei offline. Non è stato eliminato nulla. Connettiti a Internet e riprova.                                                                                        | No tienes conexión. No se ha eliminado nada. Conéctate a internet y vuelve a intentarlo.                                                                              |
| `delete_account_error_reauth`         | For your security, enter your password again. Nothing was deleted.                                                                                   | Per sicurezza, inserisci di nuovo la password. Non è stato eliminato nulla.                                                                                       | Por seguridad, vuelve a introducir tu contraseña. No se ha eliminado nada.                                                                                            |
| `delete_account_error_session`        | Your session has expired. Nothing was deleted. Sign in again, then come back here to delete your account.                                            | La sessione è scaduta. Non è stato eliminato nulla. Accedi di nuovo, poi torna qui per eliminare l'account.                                                       | Tu sesión ha caducado. No se ha eliminado nada. Inicia sesión de nuevo y vuelve aquí para eliminar tu cuenta.                                                         |
| `delete_account_error_generic`        | Something went wrong. Nothing was deleted. Try again.                                                                                                | Qualcosa è andato storto. Non è stato eliminato nulla. Riprova.                                                                                                   | Algo ha fallado. No se ha eliminado nada. Vuelve a intentarlo.                                                                                                        |
| `delete_account_reset_sent`           | We sent a link to {email}. Set a new password, then come back here to delete your account.                                                           | Abbiamo inviato un link a {email}. Imposta una nuova password, poi torna qui per eliminare l'account.                                                             | Hemos enviado un enlace a {email}. Crea una contraseña nueva y vuelve aquí para eliminar tu cuenta.                                                                   |
| `delete_account_reset_error`          | We couldn't send the email. Check your connection and try again.                                                                                     | Non siamo riusciti a inviare l'email. Controlla la connessione e riprova.                                                                                         | No hemos podido enviar el email. Comprueba la conexión y vuelve a intentarlo.                                                                                         |
| `delete_account_done_title`           | Account deleted                                                                                                                                      | Account eliminato                                                                                                                                                 | Cuenta eliminada                                                                                                                                                      |
| `delete_account_done_body`            | Your BookMind account and its data on this device have been deleted.                                                                                 | Il tuo account BookMind e i suoi dati su questo dispositivo sono stati eliminati.                                                                                 | Tu cuenta de BookMind y sus datos en este dispositivo se han eliminado.                                                                                               |

Existing keys reused: `forgot_password` and `chat_error_session_action`. `privacy_policy` comes from #64. In `it`, `delete_account_policy` assumes the #64 link text "informativa sulla privacy" (feminine, takes "nell'"). If #64 picks a different noun, the preposition changes with it.

### 13. Acceptance checklist (for the app-engineer and the qa-verifier)

Viewports: 360×780, 600×960, 840×1200, 1200×800 (DevTools), 780×360 landscape, 320×640 with 200 % text, plus `Pixel_9_API_36` and `Pixel_Tablet_API_36`.

**Menu entry**

-   [ ] "Delete account" is in its own card below Logout, 24 px gap, red-700 label with a trash icon, at all four widths.
-   [ ] The row's hit box is ≥ 48 px high and full card width (measured with `getBoundingClientRect`).
-   [ ] At 780×360 the entry is reachable by scrolling the menu.
-   [ ] There is a visible pressed state on touch (`active:bg-red-50`) and a visible keyboard focus ring.

**Presentation**

-   [ ] At 360×780, 320×640 and 780×360, the dialog is full-screen. Top bar, body and action bar clear `--bm-safe-*` on all four edges (on the emulator, nothing sits under the status bar, the navigation bar or a cut-out).
-   [ ] At 600×960, 840×1200 and 1200×800, the dialog is a centred box 560 px wide (or 100vw − 48 px if narrower) with a scrim, rounded-2xl.
-   [ ] Nothing scrolls horizontally at 320 px with 200 % text. Buttons wrap, and the body scrolls between a fixed top bar and action bar.
-   [ ] Every interactive element in the dialog is ≥ 44×44 px: ×, field, Forgot password, Delete account, Cancel, Sign in again.

**Content**

-   [ ] Title, lead, "Deleted now" (2 items), "Kept for a limited time" (4 items), account email, labelled password field, Forgot password, Delete account and Cancel are present in en, it and es with the approved copy.
-   [ ] `{provider}` and `{days}` come from the same constant as the #65 consent copy.

**States**

-   [ ] Empty password: field error, no network request (DevTools Network panel shows no request).
-   [ ] Wrong password: field error, user still signed in, IndexedDB unchanged, `bookmind.pendingDeletion` absent.
-   [ ] Offline (DevTools Offline, and airplane mode on the emulator): the offline message is shown and nothing is deleted.
-   [ ] In progress: spinner and text show, all controls are disabled, and Escape, scrim tap and Android back do not close the dialog.
-   [ ] Success: lands on `/login` (the query is removed after mount) with the sage "Account deleted" banner as the first element of the card. Back does not return to an authenticated screen.
-   [ ] An app kill between `deleteUser` and the wipe (simulated in a unit test or by a breakpoint) leads to `/login?deleted=1` on relaunch, with the banner.

**Accessibility**

-   [ ] `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` are set. The app root is `inert` while the dialog is open.
-   [ ] Focus lands on the title on open, Tab and Shift+Tab wrap inside the dialog, Escape closes it (idle and error only), and focus returns to the menu row on cancel.
-   [ ] Errors are announced: TalkBack reads the error text without the user moving focus.
-   [ ] On `/login?deleted=1`, TalkBack reads "Account deleted…" first.

**Keyboard**

-   [ ] On `Pixel_9_API_36` portrait, with the password field focused, both the field and "Delete account" are fully visible above the keyboard (screenshot).
-   [ ] The same check at 780×360 landscape on the emulator (screenshot).
-   [ ] Enter/Go on the keyboard submits.

**Forgot password** (section 5)

-   [ ] Tapping "Forgot password?" online sends one `sendPasswordResetEmail` request for the signed-in address (Network panel: one `accounts:sendOobCode` call). The dialog stays open, the route does not change, and the status line shows `delete_account_reset_sent` with the email.
-   [ ] While the request is in flight, the link is disabled with a spinner, and a second tap sends nothing.
-   [ ] Offline (DevTools Offline): the tap sends no request and shows `delete_account_reset_error`.
-   [ ] A failed request (DevTools request blocking on `sendOobCode`) shows `delete_account_reset_error`, and the link is enabled again.
-   [ ] In every case above the user is still signed in, IndexedDB is unchanged, and `bookmind.pendingDeletion` is absent.
-   [ ] TalkBack reads the sent and error status lines without the user moving focus.

### 14. Operator decisions (resolved 2026-10-09)

1.  **Copy and tone** (section 12): approved as drafted in en, it and es, including the 30-day technical-logs line and the other-devices line.
2.  **Forgot password**: option A. The dialog sends the reset email, and `/forgot-password` stays `guestOnly`. Section 5 has the states, and the `account-management` spec scenarios match.
3.  **Haptics**: none in #63. They belong to card #45 (native feel). See section 10.
4.  **Data export before deletion**: not in v1, since neither store requires it. The operator wants it later, so it is its own card in Idee and is not part of this change.
5.  **AI retention line**: approved now with `{provider}` and `{days}` read from the constant shared with #65. It follows the #71 decision automatically, with no new copy approval needed for a provider or days change.
