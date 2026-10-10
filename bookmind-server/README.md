# bookmind-server

FastAPI backend for the BookMind conversational book recommendation flow.

## Setup

```bash
cd bookmind-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt   # requirements.txt alone is enough to run, not to test
echo "OPENAI_API_KEY=sk-..." > .env
uvicorn main:app --reload
```

From the repo root, `npm run dev` starts both the Vite frontend and `uvicorn` together.

To call the endpoints locally you need Firebase credentials on the machine, because every request verifies an ID token and counts a quota document (see "Authentication" and "Daily quota"). Use either `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account file kept outside the repo, and set `FIREBASE_PROJECT_ID`. Without credentials the endpoints answer `503`, never `200`.

## Tests

```bash
cd bookmind-server
source venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest
```

The tests never call Firebase, Firestore or an LLM: token verification, the quota store and the provider are simulated. They never touch a real Firebase project.

## Container and deployment

The `Dockerfile` builds the production image (Python 3.13, non-root, listens on `$PORT`, default 8080). Only the application modules are copied; `.dockerignore` and `.gcloudignore` are allowlists (everything is ignored except those modules, `requirements.txt` and the `Dockerfile`), so a credential file dropped in this folder under any name never reaches the build context or the `gcloud run deploy --source` upload. If you add a module the app imports, add it to the `Dockerfile` `COPY` line and to both ignore files.

```bash
docker build -t bookmind-server bookmind-server
docker run --rm -p 8080:8080 bookmind-server        # POST /recommendations without a token answers 401
```

Production deployment (Cloud Run, Firestore, Secret Manager, budget alert, Hosting, smoke test) is in [`DEPLOY.md`](DEPLOY.md), the operator runbook. `scripts/check_quota_concurrency.py` (real-Firestore concurrency check) and `scripts/check_cloud_run_scaling.py` (reads back the service-level `--min 0 --max 2` cap) are the operator checks described there.

## Environment variables

| Variable                         | Default                                      | Meaning                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`                 | none                                         | API key for OpenAI. Used when `LLM_API_KEY` is not set.                                                                                                                                    |
| `LLM_API_KEY`                    | `OPENAI_API_KEY`                             | API key for the LLM provider.                                                                                                                                                              |
| `LLM_BASE_URL`                   | unset (OpenAI)                               | OpenAI-compatible base URL, for example an OpenRouter or Hugging Face endpoint.                                                                                                            |
| `LLM_MODEL`                      | `gpt-4o-mini`                                | Model name sent to the provider.                                                                                                                                                           |
| `LLM_EXTRA_BODY`                 | unset                                        | Optional JSON object merged into every request body (router options such as provider pinning, or model options such as `{"reasoning_effort":"none"}`).                                     |
| `LLM_TOKEN_LIMIT_PARAM`          | `max_tokens`                                 | Name under which the output token limit is sent: `max_tokens` or `max_completion_tokens` (OpenAI's newest models reject `max_tokens`). Any other value is a configuration error.           |
| `LLM_JSON_MODE`                  | `true`                                       | `true`: `/recommendations` asks for a JSON object response (`response_format`). `false`: no call does. `/recommendations/clarify` never does, whatever the value.                          |
| `DAILY_LLM_CALL_LIMIT`           | `10`                                         | LLM calls allowed per user per UTC day (`/recommendations/clarify` and `/recommendations` share it). Changing it is a configuration change (a new Cloud Run revision), not a code release. |
| `DAILY_REPORT_LIMIT`             | `20`                                         | Reports allowed per user per UTC day on `POST /reports`. Separate from the LLM limit: a report never uses LLM quota.                                                                       |
| `REPORT_LOG_DESTINATION`         | unset (Cloud Logging)                        | Local development only: `stdout` prints each report as one JSON line instead of calling Cloud Logging. Never set it in production.                                                         |
| `CORS_ALLOWED_ORIGINS`           | local dev list                               | Comma-separated allowed origins. See "CORS".                                                                                                                                               |
| `FIREBASE_PROJECT_ID`            | `GOOGLE_CLOUD_PROJECT`, then the credentials | Firebase project whose ID tokens are accepted and whose Firestore holds the quota.                                                                                                         |
| `GOOGLE_APPLICATION_CREDENTIALS` | none                                         | Local only: path to a service-account file. On Cloud Run the service account is used.                                                                                                      |

Never commit `.env` or a service-account file.

## Endpoints

The two recommendation endpoints require a Firebase ID token (see "Authentication") and take `lang` (one of `en`, `es`, `it`) plus a `transcript` of user messages from the in-app chat. Transcripts are **not** persisted — each request stands alone.

### `POST /recommendations/clarify`

Given the user's first two answers (mood + a loved/disliked book), returns one focused follow-up question generated by the configured model (default `gpt-4o-mini`).

```jsonc
// request
{
  "lang": "en",
  "transcript": [
    { "role": "user", "content": "I want something hopeful after a hard period" },
    { "role": "user", "content": "Loved Sapiens — the way it connected big ideas" }
  ]
}

// response
{ "question": "Do you want a short read for the weekend, or something to sink into for weeks?" }
```

### `POST /recommendations`

Given a transcript of length 2 or 3, returns 3 book recommendations whose `reason` cites or paraphrases the user's own words. The clarifier turn is optional — the user can skip it from the UI.

```jsonc
// request
{
  "lang": "en",
  "transcript": [
    { "role": "user", "content": "I want something hopeful after a hard period" },
    { "role": "user", "content": "Loved Sapiens — the way it connected big ideas" },
    { "role": "user", "content": "Something short, weekend-length" }
  ]
}

// response
[
  { "title": "...", "author": "...", "reason": "..." },
  { "title": "...", "author": "...", "reason": "..." },
  { "title": "...", "author": "...", "reason": "..." }
]
```

### `POST /reports`

Lets a user report offensive, inaccurate or other problematic AI-generated text (Google Play "AI-Generated Content" policy). Requires a Firebase ID token (see "Authentication"). The body accepts **only** these fields and rejects any other with `422`:

```jsonc
// request
{
    "kind": "recommendation", // "clarifier" | "recommendation"
    "lang": "en", // "en" | "es" | "it"
    "content": "...", // the AI-generated text only, 1 to 1000 characters
    "reason": "offensive" // "offensive" | "inaccurate" | "other"
}


// response: 204, no body
```

| Status | When                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `204`  | The report was written to the log.                                                                                                           |
| `401`  | Missing, invalid, expired or revoked token (as above).                                                                                       |
| `422`  | Unknown or missing field, a value outside the allowed sets, or `content` empty or longer than 1000 characters. Nothing is logged or counted. |
| `429`  | The user already sent `DAILY_REPORT_LIMIT` reports today (UTC). Carries `Retry-After`.                                                       |
| `503`  | Firebase Auth, Firestore (the counter) or Cloud Logging cannot be reached. Nothing is reported as received.                                  |

What is stored: one structured Cloud Logging entry, severity `WARNING`, in the log `ai-content-report`, with exactly `kind`, `lang`, `content` and `reason`. **No user id, no transcript, no IP or token** is written by the endpoint, and nothing is saved in Firestore or any other datastore. The only per-user record is the counter `llmQuota/{uid}_{YYYY-MM-DD}_reports` (a number and `expireAt`, deleted by the same TTL policy as the LLM counter), which is not linked to any entry. `content` is the text the AI produced: a recommendation `reason` can paraphrase what the user typed, so treat the log as sensitive and do not export it.

The entry is written through the Cloud Logging API, so the service account needs `roles/logging.logWriter` (`DEPLOY.md`, section 5).

## Reports of AI content

Reports are read by the operator in **Google Cloud console > Logging > Logs Explorer**, with this query (replace `PROJECT_ID`):

```
logName="projects/PROJECT_ID/logs/ai-content-report"
```

Add `severity=WARNING` or a text filter such as `jsonPayload.reason="offensive"` to narrow it down. The same query works with the CLI: `gcloud logging read 'logName="projects/PROJECT_ID/logs/ai-content-report"' --project PROJECT_ID --freshness=30d --limit=50` (a project Owner can read logs).

-   **Retention:** entries live in the `_Default` log bucket, whose default retention is 30 days ( https://docs.cloud.google.com/logging/quotas , checked 2026-10-09). After that a report is gone and nothing needs to be deleted. Nobody can look up the reports of one user, because no entry carries a user id, so a deleted account leaves nothing to remove from this log.
-   **No alert is configured.** Nothing tells you when a report arrives: open Logs Explorer periodically (and before each store release). Creating a log-based alert is an operator decision and is not part of this service.
-   If the retention of `_Default` was changed in the project, the entries live as long as that setting says.

## Prompts

System prompts and the per-language label/instruction strings live in `prompts.py`, separated from the route handlers so adding a fourth language is a single-file change.

The clarifier runs at `temperature=0.3` with an output limit of 80 tokens; the recommendation call runs at `temperature=0.7` with a limit of 400 tokens. The limit is sent as `max_tokens` unless `LLM_TOKEN_LIMIT_PARAM` says `max_completion_tokens`. Measured cost per chat (clarify plus recommendations, about 585 input and 175 output tokens): about $0.0002 on `gpt-4o-mini` and on `gpt-6-luna` (card #71 and #73).

## Authentication

`POST /recommendations/clarify`, `POST /recommendations` and `POST /reports` need the header

```
Authorization: Bearer <Firebase ID token>
```

The token is the one the app gets from `auth.currentUser.getIdToken()`. It is verified with `firebase_admin.auth.verify_id_token(..., check_revoked=True)`, so a token of a deleted or disabled user is rejected even before it expires. Application Default Credentials are used (the service account on Cloud Run).

| Status | When                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`  | No `Authorization` header, not `Bearer <token>`, or a token that is invalid, expired or revoked, or belongs to a deleted or disabled user. The LLM is not called and nothing is counted. |
| `429`  | The user has already made `DAILY_LLM_CALL_LIMIT` calls today (UTC). Carries a `Retry-After` header (seconds to the next UTC midnight). The LLM is not called.                            |
| `503`  | Firebase Auth or Firestore cannot be reached or is misconfigured. The request fails closed: the LLM is not called.                                                                       |
| `422`  | Invalid body (checked after authentication, and not counted against the quota).                                                                                                          |
| `502`  | The model answered with an empty or unusable reply.                                                                                                                                      |
| `500`  | Any other failure while calling the LLM. The body is a generic message; the details are only in the server log.                                                                          |

## Daily quota

Every call to `/recommendations/clarify` and `/recommendations` is counted per Firebase UID per UTC day in Firestore, in a transaction, **before** the LLM is called. A full chat costs 2 calls. A failed LLM call is not refunded. `POST /reports` has its own counter (`DAILY_REPORT_LIMIT`), so reports never use up the LLM quota and the LLM quota never blocks a report.

-   Document: `llmQuota/{uid}_{YYYY-MM-DD}` (UTC day) with `count` and `expireAt`.
-   Report counter: `llmQuota/{uid}_{YYYY-MM-DD}_reports`, same fields, same collection, so the same TTL policy deletes it (no extra operator step). An LLM id always ends with a date and a report id with `_reports`, so they cannot collide.
-   `expireAt` is the start of the next UTC day plus 24 hours. These documents are the only server-side records keyed by user.
-   **One-time operator step:** enable a Firestore TTL policy on the `expireAt` field of the collection group `llmQuota`, otherwise the documents are never deleted. Firestore TTL: https://firebase.google.com/docs/firestore/ttl
-   Firestore must exist in the project (decision: `europe-west1`) and the service account needs the Cloud Datastore User role (`roles/datastore.user`, checked 2026-10-09 at https://docs.cloud.google.com/firestore/docs/security/iam).

## LLM provider

Every LLM call goes through `llm.py`, the only module that imports the `openai` SDK. The provider and the model are chosen with `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_EXTRA_BODY`, `LLM_TOKEN_LIMIT_PARAM` and `LLM_JSON_MODE` (table above), so switching to another OpenAI-compatible provider or model is an environment change, not a code change. `llm.py` holds no list of model names and never retries a rejected request with other parameters.

**Code default vs production.** With only `OPENAI_API_KEY` set the service calls OpenAI `gpt-4o-mini` with `max_tokens`, as before (plus `response_format` of type `json_object` on `/recommendations` only). Production runs `gpt-6-luna` with reasoning off (decision 10 of the OpenSpec change `account-deletion-and-launch`). The code default stays `gpt-4o-mini` on purpose: `gpt-6-luna` needs three settings that only work together, so a different default would make anyone who sets `LLM_MODEL` alone (OpenRouter, local development) get an HTTP 400. The production values are in the env file of `DEPLOY.md`; to use the same model locally, put them in `bookmind-server/.env`:

```bash
LLM_MODEL=gpt-6-luna
LLM_TOKEN_LIMIT_PARAM=max_completion_tokens
LLM_EXTRA_BODY='{"reasoning_effort":"none"}'
```

Why each one (measured in card #71, not documented by OpenAI): `gpt-6-luna` answers HTTP 400 to `max_tokens`; with reasoning on it refuses any `temperature` other than 1, and with `reasoning_effort` `none` it accepts the temperatures the prompts use; `response_format` `json_object` made 42 of 42 `/recommendations` answers parse (one in 42 failed without it), but on `/recommendations/clarify` it is an HTTP 400 on OpenAI, hence `LLM_JSON_MODE` is applied per call.

Example (OpenRouter, pinned provider; replace the values):

```bash
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=<vendor>/<model>
LLM_API_KEY=<key from the secret store>
LLM_EXTRA_BODY='{"provider": {"only": ["<provider>"], "allow_fallbacks": false}}'
```

The offline harness used to compare providers and models (quality, cost, latency, JSON reliability) is in `eval/`: see `eval/README.md`. It is not part of the container image.

## CORS

Allowed origins are read from `CORS_ALLOWED_ORIGINS`, a comma-separated list. When it is unset, the local development list applies (Vite dev server, `localhost`, `capacitor://localhost`, the Android emulator host `10.0.2.2`). Production must set it to the Firebase Hosting origins and the Capacitor app origins only, with no `localhost` or `10.0.2.2` entry. Credentials are not allowed (`allow_credentials=False`): authentication is the bearer header. A preflight from an origin that is not in the list gets no `Access-Control-Allow-Origin` header.
