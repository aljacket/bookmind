## Context

BookMind today is a Vue 3 + Capacitor app with a thin FastAPI backend (`bookmind-server/main.py`) that proxies two LLM calls to OpenAI. The backend is **stateless**: no database, no logs persisted, no user data on the server side. All user-derived state — reading list, last recommendations, daily call counter — lives in the browser/device IndexedDB (`BookMindDB`, three object stores: `userPreferences`, `apiCalls`, `readingList`). Firebase Auth handles the account itself (email/password only — no Google/Apple/Facebook providers); Firestore is initialized in `services/firebase/config.ts` but never read or written. The Vite frontend already supports a `VITE_API_BASE_URL` env var (`src/services/api/axios.ts`). The previous proposal (`2026-04-26-conversational-recommendation`) deliberately deferred Play-Store launch concerns ("app icon, splash screen, privacy policy text, store listing assets, signed Android build") to a follow-up — this is that follow-up, narrowed to the items that actually block submission.

## Goals / Non-Goals

**Goals:**
- Make the backend reachable from real Android devices in production with predictable cost and a hard quota that survives anyone running `curl` against the public URL.
- Comply with Google Play's account-deletion requirements (in-app flow + public web URL) without inventing a new sub-product (a separate marketing site, a CMS, etc.).
- Give EU users a privacy policy that names OpenAI as a sub-processor, the US transfer, the GDPR rights, and the way to exercise them — written carefully enough that the Italian Garante would have nothing to flag.
- Make account deletion **self-healing**: any partial-state failure (network drop, force-quit, multi-device) eventually converges to "no orphan data on any device, no orphan account in Firebase".
- Keep the per-session OpenAI cost the same as today (~$0.001) and the worst-case monthly server cost under €5 at projected launch traffic (low hundreds of MAU).

**Non-Goals:**
- Custom domain (`bookmind.app`, etc.). The default Firebase Hosting URL (`bookmind-xxx.web.app`) is what we paste into Play Console v1 — buying a domain is a follow-up.
- Migrating the chat transcript or reading-list to Firestore. The privacy posture established by `conversational-recommendation` (no server-side persistence of the conversation) is preserved. The only Firestore writer this change introduces is the daily quota counter — no user content.
- iOS App Store launch. The same web/account-deletion infrastructure will serve iOS later, but Apple-specific flows (sign-in-with-Apple, App Store privacy nutrition labels) are out of scope.
- The "feedback / petitions" feature surfaced during exploration. It ships only after the store launch yields users; pre-launch it would speak to nobody.
- Replacing IndexedDB with a remote sync. Multi-device data divergence is handled at startup by the auto-heal sweep, not by introducing cloud state for the reading list.
- Content moderation, abuse reporting, in-app purchase plumbing. None are required for v1.

## Decisions

### Decision 1: Cloud Run (europe-west1) for the backend

The FastAPI service deploys as a containerized Cloud Run service in the same GCP project that already hosts Firebase, in `europe-west1` (Belgium).

**Why this over alternatives:**
- *vs. Render / Railway:* the free tiers either spin down (Render free) or expire (Railway). Cloud Run's free tier is permanent and our projected traffic (60k requests/month at 1k users × 2 calls/day) sits at ~3% of the 2M-request monthly free allowance — meaning €0/month for the foreseeable future. Render at "always-on" is €7/mo; Cloud Run at the same usage is €0.
- *vs. Vercel / Netlify Functions:* the OpenAI recommendation call can run 5–8s and approaches the 10-second hard timeout on those platforms' free tiers. Cloud Run's default request timeout is 60s.
- *vs. Fly.io:* comparable cold-start, but free tier deprecated; €5/mo minimum and a separate billing account for an ecosystem we'd otherwise leave untouched.
- *vs. running on a VM:* the backend is stateless and per-request — exactly what serverless container platforms are for. No reason to manage a VM.
- *Region choice:* `europe-west1` keeps user data in the EU for the Firebase ID token verification step (audit-friendly) and gives Italian users low-latency. OpenAI itself is in the US, so the LLM hop is unavoidably transatlantic, but our part of the system stays in-region.

Cold start is 1–3 seconds for a Python container; the existing `ProcessingPage.vue` already hides comparable latency during the chat → recommendations transition. Acceptable.

### Decision 2: Server-side auth + quota gated on Firebase ID token

Both `/recommendations/clarify` and `/recommendations` require an `Authorization: Bearer <Firebase ID token>` header. The backend verifies the token using `firebase-admin` (already in `requirements.txt`) and enforces a per-UID daily cap of 10 calls in Firestore at `quotas/{uid}/day/{YYYY-MM-DD}`.

**Why this over alternatives:**
- *vs. only client-side limit (current state):* anyone with the public Cloud Run URL can run `curl` in a loop and burn the OpenAI bill. At gpt-4o-mini rates a million-call overnight loop is ~€200. This is the single most expensive way to fail at launch.
- *vs. an API-key shared with the frontend:* doesn't help — the key is shippable and extractable. Per-user identity is the only thing that meaningfully bounds abuse.
- *vs. IP-based rate limiting:* anonymous, easily NATed, doesn't bind to actual users. Worth adding as defense-in-depth via Cloud Run's built-in throttling, but not the primary control.
- *vs. Redis / Memorystore:* introduces a stateful dependency for what amounts to a few small writes per user per day. Firestore is already initialized in the app, has a generous free tier (50k reads + 20k writes/day), and the per-UID counter pattern is its sweet spot.
- *Why 10 calls/day?* The current client limit is 2/day. Server-side we want a hard ceiling that absorbs legitimate retries (network blips, the user re-running with different mood phrasing) without being a per-session cost amplifier. 10 is comfortably above any genuine usage pattern and 5x below the abuse threshold that would matter financially.

The client-side IndexedDB counter stays in place as a UX nicety ("you have 1 call left today") but is no longer a security boundary. If a user manages to bypass it, the server still rejects past 10.

### Decision 3: Firebase Hosting deploys the existing Vue app — three birds, one build

The same Vite build (`dist/`) deploys to Firebase Hosting. No separate landing site, no separate web app for the delete flow.

**Why:**
- *Public web requirement (Play Store):* satisfied by `/delete-account` route being publicly reachable.
- *Privacy policy URL (Play Store + Iubenda embed):* satisfied by `/privacy` route being publicly reachable.
- *Marketing presence:* satisfied as a side effect — `bookmind-xxx.web.app` is now a usable URL we can post in app store descriptions.
- *Cost / complexity:* `firebase init hosting` is a 2-minute setup, deploys are `firebase deploy --only hosting`. No new tech stack, no second codebase, no new domain.
- *Auth state:* the Firebase Auth SDK uses `browserLocalPersistence` (set in `services/firebase/config.ts`) — the web build "remembers" a user across visits exactly like the Android app does, which is what makes the web `/delete-account` flow ergonomic for users who don't have the app installed but were already logged in via web.

The router needs two changes: `/delete-account` and `/privacy` must be **public routes** (the existing auth guard at `router/index.ts:57` redirects unauthenticated users to `/login` — we must whitelist these two paths).

### Decision 4: Cloud-first deletion order with auto-heal at startup

The deletion sequence is:

1. `reauthenticateWithCredential` (handles `auth/requires-recent-login` and validates the password)
2. `deleteUser` on the Firebase Auth user — **the cloud is the source of truth**
3. `wipeUserData(uid)` on local IndexedDB (best-effort — failure here is logged but not surfaced)
4. `authStore.clearUser()` and redirect to `/login?deleted=1`

If the user closes the app or loses network between steps 2 and 3, IndexedDB has orphaned data keyed by a UID that no longer exists in Firebase. The **auto-heal sweep** at app startup handles this: in `main.ts`, on `onAuthStateChanged`, if Firebase reports `user === null`, we list the keys in each IndexedDB object store, parse the `userId` prefix, and wipe any entries whose UID does not match any currently-authenticated user (which is, by definition, all of them when `user === null`).

**Why this order over alternatives:**
- *vs. local-first ("wipe IDB, then deleteUser"):* if `deleteUser` fails (network, expired auth), the user has lost their reading list locally but their Firebase account still exists — they re-login and see an empty state, which is the worst possible UX ("I deleted but I can still log in??"). Cloud-first means failures leave both sides intact.
- *vs. requiring a remote tombstone (write `users/{uid}/deleted = true` to Firestore before deleting auth):* over-engineered for our threat model. The cost of an orphan IndexedDB entry on a device the user no longer logs into is zero (it's their device, not our server). The auto-heal sweep at startup is sufficient.
- *vs. atomic transactions:* there is no atomic boundary across Firebase Auth and IndexedDB. The cloud-first + heal-at-startup pattern gets us to eventual consistency, which is the right consistency model when the two sides aren't in the same trust zone.

### Decision 5: Iubenda for the privacy policy

We subscribe to Iubenda's bilingual (IT/EN) privacy policy generator, configure it with the actual data flows (Firebase, OpenAI, IndexedDB), and embed the policy on a `/privacy` route via Iubenda's iframe-or-direct-link snippet. The same Iubenda dashboard is used to generate the cookie/storage notice (none required, since we use only "strictly necessary" auth storage, but the documentation that we determined this is itself useful).

**Why this over alternatives:**
- *vs. hand-written policy:* lower legal risk for a project run by one developer. Iubenda's templates are maintained by a legal team and updated when regulators publish new guidance (the Italian Garante in particular). The cost (~€30-€60/year depending on language count and modules) is a rounding error against a single hour of a privacy lawyer.
- *vs. Termly / similar:* Iubenda is Italy-based and IT-language-native, with localized templates referencing the Garante and Italian DPA contact info correctly. For an app with Italian users, this is the right primary jurisdiction lens.
- *vs. a free template:* the failure mode of a free template is silent — you don't know what's missing until a user complaint or audit reveals it. Paying for a maintained template is the simplest insurance.
- *Embedding strategy:* Iubenda offers a hosted page (we can just link out) or an iframe/inline embed. We use the hosted page (`https://www.iubenda.com/privacy-policy/<id>`) and link to it from `/privacy`, which renders a thin Vue page with Iubenda's "Privacy Policy" widget. This way Iubenda updates propagate without redeploys.

The Data Safety form on Play Console is filled in by hand (it's a Google form, not auto-generated), but the answers map 1:1 to what's declared in the Iubenda policy: email collected (account function), conversation shared with OpenAI (app functionality, not for ads), no analytics, no advertising IDs, encryption in transit, account deletion offered.

### Decision 6: Menu entry, not Settings page

The new "Delete account" action is a menu item in `Menu.vue`, placed just below the existing logout button (the menu's "danger zone" section). No new `/settings` route is created.

**Why:**
- The menu already has all the elements a Settings page would expose (language selector, navigation entries, logout). Adding a Settings route would just split a UI that's coherent today.
- The menu's hamburger reveal already provides the "out of the way" placement that destructive actions benefit from. A user accidentally tapping "Delete account" instead of "Logout" would still be caught by the password-confirmation modal.
- If a future change adds enough settings to warrant a dedicated page (theme, notifications, export, etc.), promoting the menu items to a Settings view is a one-day refactor — unblocked, not blocked, by this design.

### Decision 7: CORS via environment variables, not hard-coded origins

`bookmind-server/main.py` currently hard-codes the dev/Capacitor origins. After this change, `allow_origins` is read from `CORS_ALLOWED_ORIGINS` (comma-separated env var) at startup, with a sensible local default.

**Why:** lets us run the same image in dev (localhost), staging (a separate Cloud Run revision if we ever want one), and prod (Firebase Hosting URL + Capacitor) without code changes. Critically, in prod we **do not allow** localhost — closes a small but real CORS-bypass-via-spoofed-Host class of issue.

## Risks / Trade-offs

- **Risk: Cloud Run cold start on first call of the day feels slow.** A Python container's cold start is 1–3s; combined with the OpenAI call (~3–6s for the recommendation step), the first session of the day after idle could feel sluggish. → Mitigation: the `ProcessingPage.vue` already shows a loading state during the chat → recommendations transition, so the cold-start cost lands inside an existing "we're thinking" UI moment. We accept this for v1; if user feedback flags it, set `min-instances=1` on Cloud Run (~€10/mo for one always-warm instance).

- **Risk: Firestore quota writes incur cost.** At 1k DAU × 2 calls/day = 2k counter writes/day, well under the 20k/day free tier. Firestore reads to enforce the cap are similarly bounded. → Verified at design time; no mitigation needed unless DAU grows 10x.

- **Risk: `firebase-admin` initialization in Cloud Run requires service-account credentials.** Cloud Run can use the default compute service account, which has Firebase access if granted in IAM. Misconfiguring this will cause every recommendation request to fail with a 500. → Mitigation: include the IAM grant in the deploy runbook (tasks 1.4 and 1.5); add an integration test that exercises the auth path against a real Firebase project before the public launch.

- **Risk: User loses password and can't reauthenticate to delete.** Firebase only allows password-based reauthentication — there's no "delete with email link" path on the standard SDK. → Mitigation: the in-app dialog includes a "Forgot password?" link that navigates to the existing forgot-password flow; the user resets, logs back in, then deletes. The web `/delete-account` page mirrors this. We accept that a user who's permanently locked out (lost email access too) can't self-serve, and we add a `support@bookmind.app`-style contact in the privacy policy as the fallback.

- **Risk: The auto-heal sweep wipes data the user *intends* to keep.** Specifically: if the Firebase token expires (e.g. user is offline for a long time) and the SDK reports `user === null` transiently before re-establishing the session, the sweep would wipe live data. → Mitigation: the sweep runs only **after** Firebase Auth has fully initialized and reported `null` synchronously (i.e. no token present at all, not "token failed to refresh"). Implementation guards against this by checking `auth.currentUser === null` *and* the absence of a stored auth token (`browserLocalPersistence` key), not just the auth-state callback.

- **Risk: Iubenda's hosted policy goes down or changes their pricing.** → Mitigation: download a snapshot of the generated policy on subscription and check it into the repo as a fallback HTML at `src/assets/privacy-fallback.html`. Render it if the Iubenda fetch fails. Re-snapshot on every annual renewal.

- **Risk: A Google Play reviewer can't reach `/delete-account` because of an auth guard mistake.** → Mitigation: the route is whitelisted in `router/index.ts`, but we also add an explicit smoke test before submission: open the URL in a private browser window, verify the login form renders without redirect to `/login`. This is in `tasks.md` as a manual pre-submission check.

- **Trade-off: Server-side rate limiting introduces a 1-2 round trip with Firestore on every request.** Adds ~50-100ms to each recommendation call. We accept this — it's invisible relative to the OpenAI call latency, and the cost-protection benefit dwarfs the perceived-speed cost.

- **Trade-off: Embedding Iubenda means a third-party iframe is loaded on `/privacy`.** This is a third-party domain (`iubenda.com`) that the user's browser hits when viewing the policy. It's named in the policy itself as a "service used to publish this notice", which is the standard Iubenda recommendation. Acceptable.

## Migration Plan

The app is pre-launch with no production users. The migration is a coordinated cutover, not a phased rollout:

1. Land backend changes on a feature branch: Dockerfile, env-driven CORS, Firebase ID token dependency, quota module. Test locally with a real Firebase ID token from the dev frontend.
2. Provision Cloud Run + Firestore quotas collection in the existing GCP project. Deploy the backend image. Verify with `curl`:
   - Without Authorization header → 401.
   - With a valid token → 200 once, 200 ten times, 429 on the 11th.
3. Land frontend changes on the same branch: `VITE_API_BASE_URL` switched to the Cloud Run URL in `.env.production`, account-deletion components, auto-heal sweep, public `/delete-account` and `/privacy` routes, Iubenda widget on `/privacy`.
4. `firebase init hosting`, configure `dist/` and SPA rewrites, `firebase deploy --only hosting`. Verify both routes load in a private window.
5. Configure Iubenda: generate the IT/EN privacy policy with the real sub-processor list (Firebase, OpenAI), copy the policy ID into the embed snippet on `/privacy`.
6. Prepare the Play Console listing: paste the public privacy policy URL (`https://bookmind-xxx.web.app/privacy`), paste the account deletion URL (`https://bookmind-xxx.web.app/delete-account`), fill in the Data Safety form using the answers in `tasks.md` section 7.
7. Internal QA: full end-to-end test from a clean Android device install — register, get recommendations, save to reading list, delete account from inside the app, verify Firebase Auth user is gone and the device shows no residual data.
8. **Rollback**: if anything goes wrong post-merge but pre-store-submission, `git revert` the merge commit. The backend Cloud Run service can be scaled to zero (or deleted) and the app re-pointed at `localhost`. The Firestore `quotas` collection is harmless data and can stay or be deleted. Iubenda subscription is annual so isn't lost.

The store submission itself is **not** part of this change — that's a manual step the user takes once everything in this proposal is green.

## Open Questions

- **Custom domain timing**. Is launching with `bookmind-xxx.web.app` acceptable, or do we want to buy `bookmind.app` (or similar) before submission? The Play Store doesn't require a custom domain, but the perception is more polished with one. Defer decision to the user; both paths are supported.
- **Backend region for analytics/observability**. Cloud Run in `europe-west1` writes logs to Cloud Logging in the same region. We have no log-retention or SIEM-style requirement at v1. If the Italian Garante issues a subject access request that asks for backend access logs, the answer is "we don't keep them beyond Cloud Run's default 30 days" — confirmed acceptable, but should be stated in the privacy policy.
- **Iubenda module selection**. Iubenda offers add-ons (cookie consent banner, internal privacy register, DPO appointment). For our cookie-light setup we likely need only the basic Privacy Policy module. Confirm this against the Iubenda configuration wizard before subscribing — could affect the annual cost (€30 vs €60+).
- **OpenAI Zero Data Retention (ZDR)**. OpenAI's API retains request logs for 30 days by default; ZDR is opt-in via support request and requires the org meet certain criteria. If granted, the privacy policy can claim "OpenAI does not retain your messages". Worth pursuing post-launch but not blocking — the default 30-day retention is disclosable and acceptable.
- **Should the per-UID quota be 10/day (this proposal's number) or do we want a separate "free tier" of 2/day matching the current client cap, with the higher cap reserved for a future paid tier?** The proposal goes with 10 to keep abuse contained without throttling real users; product decision deferred.
