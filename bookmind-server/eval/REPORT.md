# LLM provider evaluation (card #71)

Card #71 (https://trello.com/c/m1uSVVvt), OpenSpec change `account-deletion-and-launch`, Decision 10.

Offline evaluation of the LLM provider: a harness in `bookmind-server/eval/`, a fixed synthetic test set, the raw answers of every run, and the findings below (revised on 2026-10-10 after the QA verdict). **No production code changed**: `llm.py`, `main.py` and `prompts.py` are untouched; nothing was deployed; the default provider is unchanged.

## Decision

Recorded on 2026-10-10 from the operator's choices (the product-lead records it in the design):

- **Model: `gpt-6-luna` on OpenAI direct, reasoning off** (route A below). The `llm.py` change it needs (`max_completion_tokens`, and a per-call `response_format` for `/recommendations`) is a separate card created by the product-lead. It is not part of this PR.
- **Checklist item 3, Hugging Face: out of scope, not run.** The token in `bookmind-server/.env` had no "Make calls to Inference Providers" permission (HTTP 403) and the account is not PRO. The same open models served by another host (DeepInfra, through OpenRouter) were not better (section 5).
- **Checklist item 4, Google Books: the substitute is accepted.** Open Library, OPAC SBN, Wikidata and Wikipedia plus manual labels (section 3).
- **Checklist item 5, blind rating by the operator: skipped by the operator.** The sheet is kept in `eval/results/blind/` in case it is wanted later.

## What changed after QA

- Merged `origin/main`; full suite green (191 passed in a fresh venv with `requirements-dev.txt`).
- Book labels: the 39 "real book by another author" rows moved from invented (I) to wrong title or author (T), so "invented" now means "no such book"; two QA spot-check errors and the Hemingway note ("Festa mobile") fixed; OPAC SBN added as a catalogue source (free, no key) and run over every book no catalogue had found: it found 52 more and overturned 7 of my labels (4 invented, 3 unsure). All existence and invented figures below are recomputed.
- Added the case-clustered bootstrap (`eval/results/bootstrap.json`), documented that p95 is interpolated and that some latencies rest on fewer than 42 calls.
- No paid call was made.

## 1. Recommendation

**Keep OpenAI as the recipient and move from `gpt-4o-mini` to `gpt-6-luna` with reasoning off.** It is the best price/quality point in the test and adds no recipient and no new country of processing. One small backend card is needed first (section 6), because `llm.py` cannot call the model as it is today. Until then `gpt-4o-mini` keeps working unchanged and already passes every threshold of Decision 10.

| | `gpt-4o-mini` (today) | **`gpt-6-luna`, reasoning off** |
|---|---|---|
| Books that exist (catalogues + manual labels) | 73.8 % | **84.3 %** |
| Books invented (no such book, definition in section 3) | 14.8 % | **6.4 %** |
| Answers with 3 of 3 books existing | 51.6 % | **64.8 %** |
| Clarifier passes all four checks | 97.6 % | **100 %** |
| `/recommendations` accepted by the unchanged parser | 100 % | 97.6 % plain (one stray `</final>` in 42), **100 % with `response_format: json_object`** |
| p50 / p95 `/recommendations` | 1.84 s / 2.32 s | 2.52 s / 2.92 s (41 accepted calls) |
| Cost per chat (clarify + recommendations) | $0.00019 | **$0.00016** |
| Cost per user per day, quota full (10 calls = 5 chats) | $0.0010 | **$0.0008** |
| Cost per month, 100 users at full quota every day | $2.88 | **$2.46** |
| Data: recipient, country, retention | OpenAI, US, abuse-monitoring logs up to 30 days, no training by default | same |

**How firm is the gap?** Case-clustered bootstrap (the 14 cases are resampled, because the 3 runs of a case are not independent; 10 000 resamples, seed 71; `eval/results/bootstrap.json`):

- Books that exist: `gpt-6-luna` minus `gpt-4o-mini` = **+10.3 points, 95 % CI [+0.3, +19.5]**. The sign is likely, the size uncertain; the interval touches zero.
- Books invented: **-8.4 points, 95 % CI [-12.4, -4.8]**. **This is the robust gap.**
- `gpt-6-luna` versus Mistral Small: exist +6.3 [-4.5, +16.9] (within noise), invented -8.9 [-15.7, -3.3].
- The same model moves by up to about 8 points between its own 42-call variants (for `gpt-4o-mini`, plain 69.8 % against `rf` 77.8 % before the labels were corrected), so differences of a few points are noise.

**Runner-up: `mistral-small-2603` pinned to Mistral's EU endpoint (via OpenRouter).** 78.2 % of books exist (14.7 % invented), clarifier 95.2 %, p50 / p95 1.77 s / 2.78 s (on the 20 accepted calls only, not 42), $0.00024 per chat, $3.58 per month. The strongest option if the launch story must be "EU company, EU hosting": Mistral AI is French and the pinned endpoint is on OpenRouter's zero-data-retention list. Catch: without `response_format: json_object` it wraps the JSON in markdown fences and the parser rejects 52 % of answers (100 % accepted with `json_object`), so it needs the same `llm.py` card. A direct Mistral account (no OpenRouter) would remove one recipient; not tested, no Mistral key.

Two more routes, both measured:

- **No-code fallback in the EU: `gemini-3.1-flash-lite` pinned to Google Vertex EU (via OpenRouter).** The only candidate that works with environment variables alone: 100 % JSON, 100 % clarifier, fastest (p95 1.64 s), but 72.8 % of books exist (13.0 % invented) and $7.45 per month (2.6 times the baseline). Recipients: OpenRouter and Google.
- **Quality tier: `gpt-6-sol`, reasoning off, OpenAI direct.** 92.1 % of books exist, 1.6 % invented, 81.0 % of answers with 3 of 3 existing, p95 3.36 s, but $0.0156 per user per day and $46.94 per month at 100 users at full quota (about 19 times `gpt-6-luna`). Same card, same recipient.

## 2. Shortlist

Prices are USD per 1M tokens, copied on 2026-10-09 from the pages named. "Pinned" is the exact `LLM_EXTRA_BODY` (OpenRouter) or model suffix (Hugging Face) used, so the recipient list stays finite. All OpenRouter pins also carry `allow_fallbacks: false`, `data_collection: "deny"` and `zdr: true`.

| Id | Model | Router | Pinned provider | In / out | Price source |
|---|---|---|---|---|---|
| `openai-gpt-4o-mini` | `gpt-4o-mini` (baseline) | OpenAI direct | OpenAI | 0.15 / 0.60 | https://developers.openai.com/api/docs/pricing |
| `openai-gpt-6-luna-noreason` | `gpt-6-luna`, `reasoning_effort: none` | OpenAI direct | OpenAI | 0.10 / 0.50 | same |
| `openai-gpt-6-sol-noreason` | `gpt-6-sol`, `reasoning_effort: none` (reference) | OpenAI direct | OpenAI | 2.00 / 10.00 | same |
| `or-mistral-small-2603-eu` | `mistralai/mistral-small-2603` | OpenRouter | `mistral/eu` (Mistral AI, EU hosting) | 0.165 / 0.66 | https://openrouter.ai/mistralai/mistral-small-2603 and `/api/v1/models/<id>/endpoints` |
| `or-claude-haiku-5.5-bedrock-eu-noreason` | `anthropic/claude-haiku-5.5`, `reasoning: {effort: none}` | OpenRouter | `amazon-bedrock/eu-west-1` | 0.11 / 0.55 | https://openrouter.ai/anthropic/claude-haiku-5.5 |
| `or-gemini-3.1-flash-lite-vertex-eu` | `google/gemini-3.1-flash-lite` | OpenRouter | `google-vertex/eu` | 0.275 / 1.65 | https://openrouter.ai/google/gemini-3.1-flash-lite |
| `or-mistral-large-2512-eu` | `mistralai/mistral-large-2512` (reference) | OpenRouter | `mistral/eu` | 0.55 / 1.65 | https://openrouter.ai/mistralai/mistral-large-2512 |
| `hf-gpt-oss-120b-ovhcloud` (not run) | `openai/gpt-oss-120b:ovhcloud` | Hugging Face | OVHcloud AI Endpoints | 0.09 / 0.47 | https://router.huggingface.co/v1/models (live listing) |
| `hf-llama-3.3-70b-ovhcloud` (not run) | `meta-llama/Llama-3.3-70B-Instruct:ovhcloud` | Hugging Face | OVHcloud AI Endpoints | 0.74 / 0.74 | same |

Why these. On 2026-10-09 the catalogues held 458 OpenRouter and 127 Hugging Face models, many unknown to me (my own knowledge ends in June 2026). I took cheap non-reasoning or switchable models from four vendors and always chose an EU-hosted endpoint when the router offers one (OVHcloud and Mistral are French; Bedrock `eu-west-1` is Ireland; Vertex `eu`). `gpt-6-luna` is the same recipient as today with a newer model. Chinese-hosted models were left out on purpose (data location).

Credit fee, included in the costs: OpenRouter charges 5.5 % on card purchases of credits, $0.80 minimum, and no markup on inference (https://openrouter.ai/docs/faq, 2026-10-09). Hugging Face passes provider prices through with no markup (https://huggingface.co/docs/inference-providers/pricing, 2026-10-09); free accounts have no included credits, PRO accounts get $2 a month. OpenAI adds nothing, but its regional (EU) processing costs 10 % more for models released after 2026-03-05.

## 3. Method

- **Real code path.** `eval/run_eval.py` drives the real FastAPI endpoints `/recommendations/clarify` and `/recommendations` through `TestClient`, so the unchanged `prompts.py`, `llm.py` (configured with `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_EXTRA_BODY`) and the unchanged parser of `main.py` are exercised. Only Firebase auth and the quota are stubbed. A wrapper around the SDK's `create()` records tokens, served model and provider and the raw text, and adds a 90 s per-call timeout to protect the budget. Disclosed deviations: for the `gpt-6-*` candidates the wrapper renames `max_tokens` to `max_completion_tokens` (a change `llm.py` will need); the `rf` variant puts `response_format` on `/recommendations` only (a per-call option `llm.py` lacks today). `max_tokens` is the production 80 / 400.
- **Test set.** `eval/cases.json`: 14 synthetic cases (9 Italian, 3 English, 2 Spanish; 2 off-topic, one a prompt-injection attempt), 9 of them with an already-loved book list. No real user data.
- **Repetitions.** 3 runs per case and endpoint: 42 clarify and 42 recommendation calls per candidate in the production request ("plain"), plus 42 recommendation calls with `response_format: json_object` ("rf") and, for the main candidates, 84 calls with `json_object` on both endpoints ("rfall"). Raw answers: `eval/results/raw/*.jsonl` (no keys or headers; scanned for the literal key values and key patterns: none).
- **Quality checks** (`eval/checks.py`, heuristics, tested in `tests/test_eval_harness.py`): three books; language (stop-word vote); every reason shares a word stem with the reader's text or loved books (off-topic cases excluded); no book already marked as read; clarifier with exactly one question mark, fewer than 25 words, plain text, not about genre (off-topic excluded), right language; **every book exists**. Quality is judged on every answer the production parser accepted, whatever the variant.
- **Book existence, and why it is a hybrid.** The card asks for Google Books. Anonymous Google Books calls fail with HTTP 429 (the shared project quota is 0, checked 2026-10-09), and the only key on this machine is the app's frontend key, which I did not take. `eval/books.py` therefore asks, in this order, Open Library, OPAC SBN (the Italian national library catalogue, no key; added after QA), Wikidata and Wikipedia (it, en, es). Together they find 426 of the 957 distinct books (44.5 %), because Italian translations are poorly catalogued. The rest were **labelled by hand by me, from my own knowledge, one label per distinct title and author** (`eval/book_review.tsv`; 583 rows, of which 52 were later found by OPAC SBN and are superseded, so about 531 labels count). A label belongs to the book, not to the model that produced it, so the review cannot favour a candidate. Definitions:
  - **exists**: found in a catalogue, or labelled R (real, title as given or the official one);
  - **real book, wrong title or author**: labelled T (the book exists but the title is mangled or not the official translation, or the author is wrong; 39 of the 139 T rows are wrong-author);
  - **invented**: labelled I, meaning no book with that title exists; "real book by another author" is T, not I (relabelled after QA);
  - **unsure** (U): not recognised, counted as not existing and not as invented.

  Errors in the labels: a QA spot-check of 40 random labels against OPAC SBN and Open Library found 2 that changed existence (5 %, 95 % CI about 1 to 17 %); OPAC SBN then overturned 7 of the 583 labels (4 invented and 3 unsure became found), and I corrected the two spot-check errors and one note. This is a judgement, not a lookup: a 5 % label error moves the luna-minus-baseline gap by less than 1 point, but treat all existence figures as plus or minus 5 points. A Google Books key would replace it: `python eval/score.py --refresh-books`.
- **Cost** is measured tokens times the listed price (times 1.055 for OpenRouter). Per chat = one clarify plus one recommendation call; per user per day = 5 chats (the quota is 10 calls); per month = 100 users every day for 30 days.
- **Latency** is the time of the whole HTTP call to the endpoint, from the operator's Mac (time zone CEST; the card asks for Italy, I could not verify the network location), HTTP 200 calls only. The p95 is a linear interpolation between order statistics over those calls, not the "second-slowest call": the number of calls is 42 for most candidates, but **20 for Mistral Small, 41 for `gpt-6-luna`, 39 for Haiku** (the others failed the parser). Production runs in Cloud Run `europe-west1`, so expect small differences. Five candidates ran at the same time from the same machine.
- **Provider pinning was verified.** OpenRouter's docs do not describe `only` together with `allow_fallbacks: false`, so I tested it: a request pinned to a provider that does not serve the model returns HTTP 404 ("No allowed providers are available") instead of falling back (not stored in the committed artefacts), and every call of every OpenRouter candidate was served by the same provider and model (`served_by` in `results/summary.json`; the provider name only, not the region). The three pinned endpoints appear in OpenRouter's ZDR list (https://openrouter.ai/api/v1/endpoints/zdr, 2026-10-09). OpenRouter's generation record does not expose the region, so "EU" rests on the endpoint tag in OpenRouter's catalogue.

## 4. Results

Sample: 14 cases x 3 runs, so 42 calls per cell (126 books). The rubric score (mean of five checks) is 92 to 98 for everything that works, because three books, language, no repeated book and cited words are easy. **Existence is what separates the models, and the invented rate is the steadier of the two.**

Full tables for every candidate and variant: `eval/results/summary.md`. Per-book labels: `eval/book_review.tsv`; books not found in a catalogue, per candidate: `eval/results/unverified_books.md`.

| Route and model | Books exist | Invented | 3/3 exist | Clarifier | JSON accepted: plain / json_object | p50 / p95 recommend | $ per chat | $ per user-day | $ per month, 100 users |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI `gpt-4o-mini` (baseline) | 73.8 % | 14.8 % | 51.6 % | 97.6 % | 100 / 100 % | 1.84 / 2.32 s | 0.00019 | 0.0010 | 2.88 |
| OpenAI `gpt-6-luna`, reasoning off | 84.3 % | 6.4 % | 64.8 % | 100 % | 97.6 / 100 % | 2.52 / 2.92 s (41 calls) | 0.00016 | 0.0008 | 2.46 |
| OpenAI `gpt-6-sol`, reasoning off (ref.) | 92.1 % | 1.6 % | 81.0 % | 92.9 % | 100 / not run | 2.95 / 3.36 s | 0.00313 | 0.0156 | 46.94 |
| OpenRouter, Mistral EU: `mistral-small-2603` | 78.2 % | 14.7 % | 54.8 % | 95.2 % | 47.6 / 100 % | 1.77 / 2.78 s (20 calls) | 0.00024 | 0.0012 | 3.58 |
| OpenRouter, Mistral EU: `mistral-large-2512` (ref.) | 78.4 % | 14.7 % | 58.8 % | 57.1 % (a) | 0 / 81.0 % (a) | not measurable (a) | 0.00076 | 0.0038 | 11.40 |
| OpenRouter, Vertex EU: `gemini-3.1-flash-lite` | 72.8 % | 13.0 % | 50.8 % | 100 % | 100 / 100 % | 1.39 / 1.64 s | 0.00050 | 0.0025 | 7.45 |
| OpenRouter, Bedrock EU: `claude-haiku-5.5`, reasoning off | 65.0 % | 24.9 % | 37.7 % | 71.4 % (b) | 92.9 / 97.6 % (c) | 2.43 / 3.15 s (39 calls) | 0.00033 | 0.0016 | 4.93 |
| Hugging Face, OVHcloud: `gpt-oss-120b`, `Llama-3.3-70B` | not run (out of scope) | | | | | | | | |
| *Proxy, not the candidate route:* `gpt-oss-120b` on DeepInfra via OpenRouter | 73.5 % | 17.9 % | 50.0 % | 71.4 % | 66.7 / 61.9 % | 8.99 / 13.72 s | 0.00009 | 0.0005 | 1.37 |
| *Proxy, not the candidate route:* `Llama-3.3-70B` on DeepInfra via OpenRouter | 67.9 % | 20.6 % | 47.6 % | 76.2 % | 100 / 100 % | 13.38 / 47.04 s | 0.00014 | 0.0007 | 2.17 |

"Exist" and "invented" do not add up to 100 %: the rest is real books with a wrong title or author, and unsure ones.

(a) Mistral Large answered HTTP 429 "temporarily rate-limited upstream" on 43 of 126 calls, in two separate runs; its quality figures come from the calls that succeeded (34 answers) and the clarifier score counts the 429s as failures. (b) 12 of 42 questions had 25 words or more. (c) 3 of 42 answers were cut at the 400-token limit (`finish_reason: length`).

Threshold of Decision 10, p95 of `/recommendations` at or under 15 s: every shortlisted candidate passes (worst 3.15 s). The only calls over the 30 s client timeout were 6 of the Llama proxy on DeepInfra. Zero parse errors on recommendations across all runs: only the baseline (0 of 126 calls), Gemini Flash-Lite (0 of 126) and `gpt-6-sol` (0 of 42) pass with the production request; `gpt-6-luna` and Mistral Small pass with `json_object`.

Quality notes from reading the outputs:

- All models answered in the right language and tied reasons to the reader's words.
- Repeats of an already-loved book: 0 to 1.6 % of answers.
- On the prompt-injection case no model printed its system prompt. On off-topic cases most still "recommended" books tied to the off-topic question (for example a Python book for "write me a Python function") instead of saying the question is off-topic as the prompt asks; only Haiku did.
- Typical failures: invented titles under a real author, a real title under the wrong author, and real books under a translated title that does not exist (for example "Pensare veloce, pensare lento"; the Italian title is "Pensieri lenti e veloci"). At least four answers put reason or other free text into the `author` field.

**Blind rating by the operator (checklist step 5): skipped by the operator.** The sheet (`eval/results/blind/blind_sheet.md`, 5 cases, 6 models, 30 outputs) and the joining command (`python eval/blind.py join ...`) remain available.

## 5. Findings that change the plan

1. **Reasoning models break the production limits.** `max_tokens` is 400 for recommendations and 80 for the clarifier, and reasoning tokens count against it. `claude-haiku-5.5` as configured returned an empty answer in 14 of 14 recommendation calls (finish reason `length`, about 368 of 400 tokens spent on reasoning). `reasoning: {"effort": "none"}` in `LLM_EXTRA_BODY` fixes it (configuration only). `claude-sonnet-5.5` and `gemini-3.8-flash` answer HTTP 400 "Reasoning is mandatory for this endpoint": unusable without raising `max_tokens`, so they were dropped (raw evidence kept in `results/raw`).
2. **OpenAI's newest models reject the production request.** `gpt-6-luna` (and `gpt-6-sol`) answer HTTP 400 to `max_tokens` ("use `max_completion_tokens`") and to `temperature` other than 1 while reasoning is on. With `reasoning_effort: none` in `LLM_EXTRA_BODY` the temperature is accepted, so the only code change is `max_tokens` to `max_completion_tokens` for those models. The harness applies that rename in its SDK wrapper only for these candidates (`needs_max_completion_tokens` in `candidates.json`).
3. **`response_format` cannot be set through `LLM_EXTRA_BODY` alone.** That variable is merged into every request. With `json_object` on both endpoints OpenAI answers HTTP 400 to the clarifier ("messages must contain the word 'json'", 0 of 42 pass), and Mistral Small and Gemini return a JSON object instead of a sentence (0 of 42 pass for each). `json_object` is needed only on `/recommendations`, so it must be a per-call option in `llm.py`. Without it, Mistral Small fails the parser 52 % of the time (markdown fences) and `gpt-6-luna` once in 42 (a stray `</final>` tag).
4. **Cost is not a decision factor, and the design estimate was 3 times too high.** Measured tokens per chat are about 585 in and 175 out, not 2 000 in and 500 out: $0.00019 per chat for the baseline (design: $0.0006), $0.0010 per user per day (design: $0.003). Even `gpt-6-sol` is $47 a month for 100 users at full quota every day.
5. **Every small model invents books.** 6 to 25 % of recommended books do not exist (2 % for `gpt-6-sol`), and only 38 to 65 % of answers have all three books existing (81 % for `gpt-6-sol`). The app currently keeps a recommendation even when the Google Books lookup finds nothing (`src/views/HomePage.vue`, `processRecommendations`). That is a product decision outside this card: the product-lead may want to flag or drop books the lookup cannot find, whichever model is chosen.
6. **Open-weight models were not better.** On a non-EU host, `gpt-oss-120b` (a reasoning model, effort low) lost 11 of 42 recommendations to truncation at 400 tokens and had a p95 of 13.7 s; `Llama-3.3-70B` was slower still (p95 47 s) and invented 21 % of books. This says little about OVHcloud's own capacity; the Hugging Face route was declared out of scope instead of measured.
7. **Lifecycle.** The base `gpt-4o-mini` is not on OpenAI's deprecation list on 2026-10-09, but the `gpt-4o` family is being retired (for example `gpt-4o-2024-05-13` on 2026-10-23; https://developers.openai.com/api/docs/deprecations). Moving to a current model removes that risk.

## 6. Follow-up work for the product-lead (not done here: "no production code")

- **Backend card (small), needed for routes A and B.** In `llm.py`: send `max_completion_tokens` instead of `max_tokens` for models that require it (a setting or an automatic retry), add an optional per-call `response_format` so `/recommendations` can use `json_object`, and cover both with tests. For route A the deploy settings are `LLM_MODEL=gpt-6-luna`, `LLM_EXTRA_BODY='{"reasoning_effort": "none"}'` and the existing `LLM_API_KEY`.
- **Optional, instead of or besides `json_object`:** a parser that strips a markdown fence. It would have rescued all 22 Mistral Small failures and the `</final>` one (the diagnostic `lenient_json` in `checks.py` shows this).
- **Design update:** replace the cost estimate in Decision 10 with section 4, and record the decision.

## 7. Data handling and the recipients to name in #65 and in the Iubenda list

I am not a lawyer; this is what the vendors state, from the pages read on 2026-10-09 (QA re-read them on 2026-10-10 and confirmed them). The wording of the consent and of the policy is the operator's.

**A router adds a recipient.** Every route through OpenRouter or Hugging Face has two recipients: the router and the pinned provider. Routes straight to the model vendor have one.

| Route | Recipients | Country of processing | Retention | Used for training | Options |
|---|---|---|---|---|---|
| **A. OpenAI direct** (chosen) | OpenAI | United States by default; Europe (EEA and Switzerland, `eu.api.openai.com`) only for projects approved for abuse-monitoring controls, +10 % price | Abuse-monitoring logs up to 30 days "unless longer retention is required by law" | Not by default | Zero data retention and modified abuse monitoring need OpenAI's prior approval. https://developers.openai.com/api/docs/guides/your-data |
| **B. OpenRouter to Mistral `mistral/eu`** | OpenRouter, Inc. (US; New York law; policy updated 2026-08-31) and Mistral AI (Paris, France) | Mistral: EU by default, US only if the US endpoint is chosen (https://help.mistral.ai/en/articles/347629-can-i-activate-zero-data-retention-zdr, titled "Where do you store my data"). OpenRouter: servers may be in the US or outside the EEA | Mistral: input and output for the time needed, then 30 rolling days for abuse monitoring "unless zero data retention is activated" (https://legal.mistral.ai/terms/privacy-policy). OpenRouter lists `mistral/eu` as a ZDR endpoint. OpenRouter keeps no prompts unless logging is opted in (https://openrouter.ai/docs/faq) | Mistral: not for API data unless the customer opts in (https://legal.mistral.ai/terms/commercial-terms-of-service, section 4.2). OpenRouter: "does not use your Inputs or Outputs for model training" (https://openrouter.ai/privacy) | `provider.only`, `allow_fallbacks: false`, `data_collection: "deny"`, `zdr: true` (https://openrouter.ai/docs/features/provider-routing) |
| **C. OpenRouter to Google Vertex `google-vertex/eu`** | OpenRouter, Inc. and Google (Google Cloud, Vertex AI) | EU endpoint | Google may log prompts for abuse monitoring under the Cloud terms unless an exception is granted; in-memory cache 24 h | "Won't use your data to train or fine-tune any AI/ML models without your prior permission" (https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance) | OpenRouter lists the endpoint as ZDR |
| **D. OpenRouter to Amazon Bedrock `eu-west-1`** (Haiku) | OpenRouter, Inc. and Amazon Web Services | Ireland | Bedrock does not store inputs or outputs by default and the model vendor gets no access; retention only for named models (Haiku 5.5 is not among them) (https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html and `/data-retention.html`) | No | OpenRouter lists the endpoint as ZDR |
| **E. Hugging Face to OVHcloud** (not run) | Hugging Face and OVHcloud | OVHcloud: "hosted and run in the European Union", Gravelines, France | Hugging Face stores no request body or response, logs up to 30 days without user data (https://huggingface.co/docs/inference-providers/en/security). OVHcloud: "zero data retention", only billing data kept | OVHcloud: "Your data is never used to train our models" (https://www.ovhcloud.com/en/public-cloud/ai-endpoints/, https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-capabilities) | Provider pinned with the `model:provider` suffix; billed at provider prices, no markup |

Gaps in the official pages, stated plainly: OpenRouter's privacy policy gives neither the country of incorporation nor a list of sub-processors; I found no OpenAI statement of the EEA contracting entity in the pages read (use https://openai.com/policies/privacy-policy/); Hugging Face's pages read do not say which legal entity operates the router; OVHcloud's pages read do not say whether other sub-processors are involved. The "ZDR" flags on OpenRouter endpoints come from OpenRouter's own list, not from a contract with the vendor.

**Exact recipients to cite, per route**

- A (chosen): "OpenAI" (provider of the language model, United States).
- B: "OpenRouter, Inc." (routing service, United States) and "Mistral AI" (provider of the language model, France, hosting in the EU). With a direct Mistral account: only "Mistral AI".
- C: "OpenRouter, Inc." and "Google" (Google Cloud Vertex AI, EU).
- E: "Hugging Face" and "OVHcloud" (France).

## 8. Not done, and why

- **Hugging Face candidates not run: out of scope by decision.** The fine-grained token had only `repo.content.read`; calls to `router.huggingface.co` answered HTTP 403 ("This authentication method does not have sufficient permissions to call Inference Providers"), and the account is not PRO. The two candidates stay in `candidates.json`; to run them later, give the token "Make calls to Inference Providers", buy a few dollars of credits, and run `python eval/run_eval.py --candidate hf-gpt-oss-120b-ovhcloud --runs 3 --env-file <path to .env>` (same for `hf-llama-3.3-70b-ovhcloud`), then `python eval/score.py`. Expect under $0.10.
- **Google Books not used; the substitute is accepted** (section 3). **Blind rating skipped by the operator.** **Direct vendor routes** (Mistral, Anthropic, Google without OpenRouter) not run: no keys.
- **Spend:** about $0.38 in total. Raw runs, tokens times the listed price: $0.359 ($0.168 OpenAI, $0.190 OpenRouter including the 5.5 % credit fee), plus a first Mistral Large run that was overwritten and the smoke tests. Cross-check: the OpenRouter key's own usage counter reads $0.197 (fee not included). There is no usage API for a normal OpenAI key, so its share is computed. Hugging Face: $0. The QA fixes made no paid call. Far below the $2 ceiling; no run was stopped by the cap.

## Test plan

- [x] `python -m pytest` in `bookmind-server/` with a fresh venv from `requirements-dev.txt`: 191 passed (includes the 19 tests of `tests/test_eval_harness.py`; no network).
- [x] Real runs against OpenAI and OpenRouter (three pinned endpoints, one negative pin test) with the real endpoints and prompts; raw answers committed.
- [x] Secret scan of `eval/` and `tests/`: no literal key value and no key pattern except test fixtures built from pieces; QA repeated it on the whole branch history.

