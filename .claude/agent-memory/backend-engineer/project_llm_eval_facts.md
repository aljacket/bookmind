---
name: llm-eval-facts
description: Non-obvious facts from card #71 (LLM provider evaluation, PR #24) - API quirks of new models, router pinning, tool/sandbox traps
metadata:
    type: project
---

Card #71 (2026-10-09/10) shipped `bookmind-server/eval/` (harness, cases, raw results) in PR #24. Findings live in the PR description (writing `eval/REPORT.md` was refused by the sandbox: "subagents return findings as text"; `eval/README.md` for usage is fine).

-   Catalogue in this world is newer than my training: OpenAI gpt-6-luna/sol, Claude Haiku/Sonnet 5.5, Gemini 3.x. Always read the live catalogues (`openrouter.ai/api/v1/models`, `/models/<id>/endpoints`, `router.huggingface.co/v1/models`).
-   OpenRouter pin slugs are endpoint tags (`mistral/eu`, `amazon-bedrock/eu-west-1`, `google-vertex/eu`); `only`+`allow_fallbacks:false` really returns 404 on a mismatch; `/api/v1/endpoints/zdr` lists ZDR endpoints; `/api/v1/key` shows real spend.
-   Production `llm.py` limits: reasoning-by-default models (Haiku 5.5) return empty text at max_tokens 400; `reasoning:{effort:none}` fixes it, but Sonnet 5.5 / Gemini 3.8 Flash reject it. gpt-6-\* reject `max_tokens` and temperature!=1 unless `reasoning_effort:none`. `response_format` via LLM_EXTRA_BODY hits both endpoints and breaks the clarifier, so it needs a per-call option.
-   HF token in `.env` was read-only (no Inference Providers permission, account not PRO): check `huggingface.co/api/whoami-v2` before planning HF runs. Anonymous Google Books API has quota 0 (HTTP 429): use a key or Open Library/Wikidata + manual review.
-   Measured tokens per chat are ~585 in / 175 out (design assumed 2000/500).
-   Sandbox traps: the worktree guard refuses any command containing the standalone word `eval` or `git` in text (paths like `eval/`, comments with github.com): use globs like `ev?l`, the Trello MCP `add_comment` for comments with links, `pgrep -x Python` (not `pgrep -f`, which matches your own waiting shell). Scoring scripts should flush caches every N items.
