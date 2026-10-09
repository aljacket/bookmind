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
2. `reauthenticateWithCredential` with the password. A "Forgot password?" link goes to the existing reset flow.
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
-   **Forgotten password blocks reauthentication.** Mitigation: a "Forgot password?" link in the dialog and on the web page, and the privacy contact email in the policy as the last resort.
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
