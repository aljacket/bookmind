---
name: card44-launch-change
description: Card #44 launch change (account deletion, Cloud Run, privacy) — PR #16, cards #60-#71, operator decisions of 2026-10-09 (limit 10, europe-west1, Blaze 10€, Italy-only, IT+EN policy, provider eval #71)
metadata:
    type: project
---

On 2026-10-09 I reviewed the launch change for card #44 and renamed it to `openspec/changes/account-deletion-and-launch/` (PR https://github.com/aljacket/bookmind/pull/16, branch docs/launch-change-review-2026-10, worktree ../bookmind-pl-44).

Findings recorded in design.md R1-R10:

-   Client quota is dead code, so today there is no limit at all.
-   The April sweep would wipe the reading list after a plain logout; it now uses a `pendingDeletion` marker.
-   `/privacy` became a Hosting redirect; quota counters got a TTL; `check_revoked=True`.
-   2026 additions: Apple 5.1.2(i) AI consent and Play AI-content reporting.

Cards in Idee: #60 backend token/quota/CORS + `llm.py`, #61 Dockerfile/DEPLOY.md/firebase.json, #62 app token + 401/429, #63 in-app deletion, #64 /delete-account + privacy links, #65 AI consent, #66 POST /reports, #67 report UI, #68 icon/splash, #69 signed AAB, #70 store listing, #71 LLM provider evaluation. Later: #72 data export (Idee, from #63 decisions).

Operator decisions, 2026-10-09 (design.md "Operator decisions (resolved 2026-10-09)"):

-   limit 10 calls/day
-   Firestore `europe-west1`
-   Blaze with a 10 €/month budget alert, Cloud Run `--min 0 --max 2`, frugal runbook (Blaze only because real cost is about zero)
-   AI reporting in scope
-   proposed legal copy OK; Iubenda IT+EN only
-   **Italy only**: listing it-IT, no EN translation (my choice)
-   no ZDR
-   #18 postponed, comment added, card stays in Idee
-   #39/#40/#41 archived

Added that day:

-   Decision 10: the provider sits behind env config (`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` with fallback to `OPENAI_API_KEY`, `LLM_EXTRA_BODY`). #71 evaluates OpenAI vs OpenRouter/HF with pinned providers. The p95 threshold for /recommendations is ≤ 15 s.
-   Decision 11: Italy-only distribution. Closed testing follows production countries, so testers need Play country = Italy.

The provider choice blocks the #65 copy and the Iubenda third-party list, but not #60-#62.

**Why:** #44 is the operator's store-readiness pick. The 12-tester / 14-day closed test is the longest timeline item, and the policy and the provider decision sit on its critical path.

**How to apply:**

-   Before promoting #60-#71, check that PR #16 is merged.
-   Suggested Pronto order (WIP 3): #60, #71, #61. Next come #62, #63 and #66. #64 and #65 come later; #65 only after the #71 decision.
-   #71 decided 2026-10-10 (OpenAI gpt-6-luna), recorded in PR #25; see [[card71-provider-decision]].
-   #61 and #54 both write firebase.json.

See [[external-requirements]].
