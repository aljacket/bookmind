---
name: card71-provider-decision
description: #71 outcome 2026-10-10 — OpenAI gpt-6-luna reasoning off; code default stays gpt-4o-mini; follow-ups #73 (llm.py) and #74 (invented books); PR #25
metadata:
  type: project
---

Operator decision 2026-10-10 on #71 (report = PR #24 description, QA recomputed identical): route A, **OpenAI direct, `gpt-6-luna`, `reasoning_effort: none`**. Recipient unchanged: OpenAI, US, logs ≤30 days, no training. Same day: Hugging Face out of scope, Google Books substitute accepted, blind rating skipped. Recorded in design Decision 10 "Outcome" via PR https://github.com/aljacket/bookmind/pull/25 (branch docs/71-llm-provider-decision, worktree ../bookmind-pl-71).

My choices recorded there:
- Code default stays `gpt-4o-mini`; prod values in DEPLOY.md env file (`LLM_MODEL=gpt-6-luna`, `LLM_TOKEN_LIMIT_PARAM=max_completion_tokens`, `LLM_EXTRA_BODY={"reasoning_effort":"none"}`). Reason: the three only work together; forgetting them lowers quality, not consent compliance.
- New settings named in spec: `LLM_TOKEN_LIMIT_PARAM`, `LLM_JSON_MODE` (json_object only on /recommendations). No model-name lists in code.
- OpenAI's your-data page names no default processing country (checked 2026-10-10); "US" in policy/consent rests on OpenAI being a US company.

Cards: #73 llm.py gpt-6-luna support (Idee, placed above #64; needs PR #24 merged; harness rerun cap $0.05). #74 hide/flag/replace books Google Books can't find (Idee, before #70; my proposal = badge). #65 desc + item 7 now name OpenAI; #64 had no provider reference.

**Why:** #65 copy and Iubenda list were blocked on this. A failed #73 rerun means fallback to route B (Mistral EU via OpenRouter) and new recipients.

**How to apply:** finalise #65 copy only after #73's rerun passes. Measured cost ≈585 in / 175 out tokens per chat, ≈$2.46/month at 100 users full quota. See [[card44-launch-change]].
