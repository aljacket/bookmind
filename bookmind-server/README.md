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
| `LLM_EXTRA_BODY`                 | unset                                        | Optional JSON object merged into every request body (router options such as provider pinning).                                                                                             |
| `DAILY_LLM_CALL_LIMIT`           | `10`                                         | LLM calls allowed per user per UTC day (`/recommendations/clarify` and `/recommendations` share it). Changing it is a configuration change (a new Cloud Run revision), not a code release. |
| `CORS_ALLOWED_ORIGINS`           | local dev list                               | Comma-separated allowed origins. See "CORS".                                                                                                                                               |
| `FIREBASE_PROJECT_ID`            | `GOOGLE_CLOUD_PROJECT`, then the credentials | Firebase project whose ID tokens are accepted and whose Firestore holds the quota.                                                                                                         |
| `GOOGLE_APPLICATION_CREDENTIALS` | none                                         | Local only: path to a service-account file. On Cloud Run the service account is used.                                                                                                      |

Never commit `.env` or a service-account file.

## Endpoints

Both endpoints require a Firebase ID token (see "Authentication") and take `lang` (one of `en`, `es`, `it`) plus a `transcript` of user messages from the in-app chat. Transcripts are **not** persisted — each request stands alone.

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

## Prompts

System prompts and the per-language label/instruction strings live in `prompts.py`, separated from the route handlers so adding a fourth language is a single-file change.

The clarifier runs at `temperature=0.3, max_tokens=80`; the recommendation call runs at `temperature=0.7, max_tokens=400`. Per-session cost on `gpt-4o-mini` stays around $0.001.

## Authentication

`POST /recommendations/clarify` and `POST /recommendations` need the header

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

Every call to `/recommendations/clarify` and `/recommendations` is counted per Firebase UID per UTC day in Firestore, in a transaction, **before** the LLM is called. A full chat costs 2 calls. A failed LLM call is not refunded.

-   Document: `llmQuota/{uid}_{YYYY-MM-DD}` (UTC day) with `count` and `expireAt`.
-   `expireAt` is the start of the next UTC day plus 24 hours. These documents are the only server-side records keyed by user.
-   **One-time operator step:** enable a Firestore TTL policy on the `expireAt` field of the collection group `llmQuota`, otherwise the documents are never deleted. Firestore TTL: https://firebase.google.com/docs/firestore/ttl
-   Firestore must exist in the project (decision: `europe-west1`) and the service account needs the Cloud Datastore User role (`roles/datastore.user`, checked 2026-10-09 at https://docs.cloud.google.com/firestore/docs/security/iam).

## LLM provider

Every LLM call goes through `llm.py`, the only module that imports the `openai` SDK. The provider is chosen with `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` and `LLM_EXTRA_BODY` (table above), so switching to another OpenAI-compatible provider is an environment change, not a code change. With only `OPENAI_API_KEY` set the service calls OpenAI `gpt-4o-mini`, as before.

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
