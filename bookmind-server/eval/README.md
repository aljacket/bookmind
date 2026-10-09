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
Variants: `plain` (production request), `rf` (`response_format: json_object` on `/recommendations`
only), `rfall` (on both endpoints, which is what `LLM_EXTRA_BODY` alone can do).

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

-   Book existence: Google Books could not be used (anonymous quota is 0). The cascade is Open Library,
    Wikidata, Wikipedia, then a manual review (`book_review.tsv`, labels R real, T real but wrong title,
    I invented, U unsure, by the backend-engineer agent from its own knowledge). Add
    `GOOGLE_BOOKS_API_KEY` and run `score.py --refresh-books` to use Google Books first.
-   When new books appear, `score.py` writes the ones nobody has labelled to `results/review_todo.json`;
    they count as not existing until labelled.
-   Latency is measured from the machine that runs the script, not from Cloud Run.
-   `blind_key.json` maps the blind labels to models: do not open it before rating.
