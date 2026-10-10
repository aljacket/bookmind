---
name: eval-qa-recipe
description: How to verify offline LLM-evaluation PRs (card #71, bookmind-server/eval) without paid calls - recompute from raw jsonl, literal-key scan, case-clustered bootstrap, label spot-check via OPAC SBN, vendor data-policy sources (2026-10-10)
metadata:
    type: reference
---

Card #71 (PR #24) took about 1 h. The verdict was FAIL because REPORT.md was missing and the HF and Google Books checklist items were open.

-   **Venv:** build a throwaway one with `bookmind-server/venv/bin/python -m venv <scratchpad>/venv71`, then `pip install -r requirements-dev.txt`. Run pytest under `env -i`.
-   **Literal key scan without printing the keys:**
    -   load the main `bookmind-server/.env` with `dotenv_values`;
    -   check that each value is absent from `git diff origin/main...HEAD` AND from `git log -p origin/main..HEAD`, testing the full value, the 16-char prefix, the 10-char prefix and the last 10 characters;
    -   also run a pattern sweep. Long tokens that start with `gen-` or `chatcmpl-` are generation ids, not secrets.
-   **Recompute independently:** status = `books_cache[key].verified` → found, else the TSV label. The key is `title_key|surname`, from `eval/checks.py`. score.py pools quality over the plain, rf and rfall variants, and takes clarifier and latency from plain only.
-   **Noise:** run a case-clustered bootstrap over the 14 cases. Pooled-book CIs overstate precision. The same model drifts up to 8 pts between 42-call batches.
-   **Book existence lookups:** anonymous Google Books returns 429 (the shared quota is 0). The OPAC SBN JSON gateway `https://opac.sbn.it/opacmobilegw/search.json?any=<words>&type=0&rows=12` works without a key and is authoritative for Italian editions. Query `surname + keyword` to list an author's Italian titles. Open Library is weak on Italian.
-   **Data-policy pages that load with WebFetch:**
    -   OpenAI your-data and pricing;
    -   OpenRouter privacy, FAQ and provider-routing;
    -   Vertex data-governance;
    -   Bedrock data-retention and abuse-detection;
    -   HF security and OVH AI Endpoints.
        The legal.mistral.ai pages need `curl -A Mozilla` plus a strip of the HTML tags. The OpenRouter ZDR list (`/api/v1/endpoints/zdr`, about 900 KB) needs curl plus a JSON parse, because WebFetch truncates it.
-   The PR body can hold the report when a file write was refused, but the card names `eval/REPORT.md`, so its absence means FAIL on that checklist item.

**Re-verification (head 45354c1, PASS on 2026-10-10)**

- `score.py` is deterministic and needs no network once `books_cache.json` is complete. Re-run it on a scratch copy of `eval/`, then `cmp` its outputs against the committed results.
- Catalogue hits override the manual labels, because `status()` checks the cache first. When a new catalogue source is added, count the overrides of **every** label type (I, U and T), not only the ones the engineer reports. On #71, OPAC SBN silently overrode 11 T labels.

Related: [[backend-qa-recipe]], [[api-auth-qa-recipe]]
