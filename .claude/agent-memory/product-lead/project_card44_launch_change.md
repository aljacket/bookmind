---
name: card44-launch-change
description: Card #44 (2026-10-09) review of the launch change (account deletion, Cloud Run, privacy) — PR #16, cards #60-#70, findings and open operator decisions
metadata:
    type: project
---

On 2026-10-09 I reviewed the launch change for card #44 and renamed it to `openspec/changes/account-deletion-and-launch/` (PR https://github.com/aljacket/bookmind/pull/16). Before the review it had only proposal + design; the specs folder was empty and there was no tasks.md.

Findings on main b8a13b6, all recorded in design.md R1-R10:

-   The client quota (`incrementApiCallCount` / `getRemainingCalls`) is never called, so there is no limit today.
-   The April auto-heal sweep would have wiped a logged-out user's reading list. Replaced by a `pendingDeletion` marker.
-   `/privacy` is now a Hosting 301 redirect to Iubenda.
-   Firestore `llmQuota/{uid}_{day}` gets TTL `expireAt`.
-   The token is verified with `check_revoked=True`.
-   New 2026 items: Apple 5.1.2(i) consent before third-party AI, and Play AI-Generated Content in-app reporting.
-   Launcher icon and splash are still the Capacitor defaults.

Cards created in Idee (suggested order): #60 backend token/quota/CORS, #61 Dockerfile/DEPLOY.md/firebase.json, #62 app token + 401/429, #63 in-app deletion, #64 /delete-account + privacy links, #65 AI consent, #66 POST /reports, #67 report UI, #68 icon/splash, #69 signed AAB, #70 store listing assets.

Open operator decisions:

-   daily limit (proposed 10)
-   Firestore location (proposed europe-west1)
-   AI reporting in scope (recommended yes)
-   legal copy / Iubenda plan
-   ZDR (recommended no for v1)
-   domain (#18)
-   archive #39/#40/#41

**Why:** #44 was the operator's pick for store readiness. The 12-tester / 14-day closed-test rule for personal Play accounts is the longest timeline item.
**How to apply:** when promoting #60-#70, check that PR #16 is merged and the decisions above are recorded. #61 and #54 both write firebase.json. #66/#67 are dropped together if the operator says AI reporting is out of scope. See [[external-requirements]].
