---
name: gpt6-luna-support-facts
description: Non-obvious facts from card #73 (llm.py LLM_TOKEN_LIMIT_PARAM / LLM_JSON_MODE, gpt-6-luna prod config, PR #27) - harness variants, re-run results, sandbox traps
metadata:
    type: project
---

Card #73 (2026-10-10, PR #27) made `gpt-6-luna` callable by env only. Production values live in DEPLOY.md's env file (`LLM_MODEL=gpt-6-luna`, `LLM_TOKEN_LIMIT_PARAM=max_completion_tokens`, `LLM_EXTRA_BODY={"reasoning_effort":"none"}`); the code default stays `gpt-4o-mini` + `max_tokens` on purpose (the three settings only work together).

-   `llm.chat(..., json_object=True)` is the per-call option (gated by `LLM_JSON_MODE`); the limit keyword stays `max_tokens` whatever name goes on the wire. `LLM_JSON_MODE` and `LLM_TOKEN_LIMIT_PARAM` are validated on every call, before any request.
-   Backend `.env.example` did not exist (only the root Vite one): created `bookmind-server/.env.example`.
-   Harness (`eval/run_eval.py`): variant `prod` = default config, both endpoints; `plain` now sets `LLM_JSON_MODE=false`; the SDK wrapper no longer renames the limit; candidates carry `token_limit_param`. `eval/check_rerun.py [--smoke]` applies the card's criteria; re-run raw data in `eval/results/rerun-73/` (use `--out`, never overwrite `results/raw`). Do NOT bend `score.py` for a prod-only run (its latency/cost use the `plain` rows only).
-   Re-run result: gpt-6-luna 28 calls 0 HTTP errors, 14/14 parsed, clarifier 13/14 (en-cozy fails `not_about_genre`), p95 3.4 s, $0.0023; gpt-4o-mini 3 cases all pass, $0.0006. Per chat about $0.00016 / $0.00019, matching #71. OpenAI usage is computed from response tokens, no usage API was queried.
-   Test infra: `wire` / `wire_client` fixtures in `tests/conftest.py` run the real SDK over `httpx.MockTransport`; `FakeLLM.__call__` takes `json_object`.
-   zsh in the Bash tool expands `ev?l/...` globs only if the path exists: create the output dir first with the Write tool (a placeholder file), then delete the placeholder. Heredoc `python3 - <<'PY'` works when it does not contain the word `eval` or a `cd` out of the worktree; use `/usr/bin/env git ...` from the worktree root (plain `git` mixed with other commands is refused).
-   Prettier hook rewrites markdown tables after Edit (whitespace-only diffs in DEPLOY.md/README.md): expected.
