# eval/ - offline LLM provider evaluation (card #71)

Harness, test set and raw data behind the provider decision in OpenSpec change
`account-deletion-and-launch`, Decision 10. It is **not** part of the container image (the Docker and
gcloud ignore files are allowlists) and it makes real paid API calls only when `run_eval.py` is run.
The findings and the recommendation are in the description of the pull request that introduced this
folder.

## What it does

`run_eval.py` drives the real `/recommendations/clarify` and `/recommendations` endpoints through
FastAPI's `TestClient`, with the unchanged `prompts.py`, `llm.py` and parser, configured through
`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` and `LLM_EXTRA_BODY`. Only auth and quota are stubbed. One
process runs one candidate from `candidates.json` over the 14 synthetic cases of `cases.json`.
Variants: `plain` (no `response_format` anywhere, `LLM_JSON_MODE=false`: the request before card #73),
`rf` (`llm.py` default, `json_object` on `/recommendations` only; only that endpoint is run), `prod`
(the same configuration as `rf`, with both endpoints run: the production request since card #73),
`rfall` (`json_object` on both endpoints, forced through `LLM_EXTRA_BODY`). A candidate with
`"token_limit_param": "max_completion_tokens"` in `candidates.json` runs with
`LLM_TOKEN_LIMIT_PARAM` set, exactly as in production. The raw files of #71 were recorded when this
was a rename inside the harness (the old `llm.py` could not do it); they stay as they are.

`check_rerun.py` checks a `--variants prod` run against the acceptance criteria of card #73 (0 HTTP
errors, 100 % of `/recommendations` accepted by the parser, clarifier passing in at least 13 of 14
cases, p95 <= 15 s) and prints the spend; `--smoke` is for a few-case run. The card #73 re-run is in
`results/rerun-73/`:

```bash
$PY eval/run_eval.py --candidate openai-gpt-6-luna-noreason --runs 1 --variants prod --out eval/results/rerun-73 --max-usd 0.03 --global-cap-usd 0.05
$PY eval/run_eval.py --candidate openai-gpt-4o-mini --runs 1 --variants prod --cases it-giallo,en-cozy,es-corto --out eval/results/rerun-73 --max-usd 0.01 --global-cap-usd 0.05
$PY eval/check_rerun.py --raw eval/results/rerun-73 --candidate openai-gpt-6-luna-noreason
```

`score.py` reads `results/raw/*.jsonl` and writes `results/summary.md`, `results/summary.json` and
`results/unverified_books.md`: quality checks (`checks.py`), book existence (`books.py` and
`book_review.tsv`), JSON acceptance by the production parser, latency percentiles and cost.
`blind.py` builds and joins the operator's blind rating sheet.

## Running it

```bash
cd bookmind-server
PY=/path/to/bookmind-server/venv/bin/python
$PY eval/run_eval.py --candidate openai-gpt-6-luna-noreason --runs 3 --env-file /path/to/bookmind-server/.env
$PY eval/score.py --env-file /path/to/bookmind-server/.env
$PY -m pytest tests/test_eval_harness.py
```

Keys are read from the env file (`OPENAI_API_KEY`, `OPENROUTER_KEY`, `HUGGINGFACE_KEY`, optional
`GOOGLE_BOOKS_API_KEY`); only the variable named by the candidate's `key_env` is used. Nothing is
printed, and everything written to disk passes through a redaction step. Spend is capped per process
(`--max-usd`, default 0.40) and across all raw files (`--global-cap-usd`, default 1.50).

To add a candidate, add an entry to `candidates.json` with its price and pin (OpenRouter:
`provider.only` + `allow_fallbacks: false` + `data_collection: "deny"` + `zdr: true`; Hugging Face: the
`:provider` suffix of the model id). A test checks that every candidate is pinned and priced.

## Limits to keep in mind

-   Book existence: Google Books could not be used (anonymous quota is 0; the substitute was accepted
    by the operator). The cascade is Open Library, OPAC SBN (`score.py --recheck-sbn` re-asks it for
    unfound books), Wikidata, Wikipedia, then a manual review (`book_review.tsv`, labels R real, T real
    but wrong title or author, I invented = no such book, U unsure, by the backend-engineer agent from
    its own knowledge). Add `GOOGLE_BOOKS_API_KEY` and run `score.py --refresh-books` to use Google
    Books first.
-   `score.py` also writes `results/bootstrap.json`: case-clustered bootstrap of the existence and
    invented gaps (resampling the 14 cases), which is the honest uncertainty of the model comparison.
    Latency percentiles are linear interpolations over the HTTP 200 calls only.
-   When new books appear, `score.py` writes the ones nobody has labelled to `results/review_todo.json`;
    they count as not existing until labelled.
-   Latency is measured from the machine that runs the script, not from Cloud Run.
-   `blind_key.json` maps the blind labels to models: do not open it before rating.
