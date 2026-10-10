# Deploying BookMind to production (operator runbook)

Written for card #61. The operator runs every command; nothing here is run by an agent. Docs checked on 2026-10-09: if a command fails or a flag has moved, trust the linked page over this file.

What you end up with: the backend on **Cloud Run (`europe-west1`)**, Firestore in **`europe-west1`**, the web build and the privacy redirects on **Firebase Hosting** (default `*.web.app` domain), and a **10 EUR/month budget alert**.

## 0. Cost posture: nothing else is created

| Resource                        | Setting                                                              | Why it is (almost) free                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run                       | service-level `--min 0` and `--max 2`, 512 MiB, 1 vCPU            | Nothing runs while idle. Free tier: 2 M requests, 180 000 vCPU-s, 360 000 GiB-s per month.                                |
| Firestore                       | one database, one collection (`llmQuota`, LLM and report counters), TTL deletes old documents | Free tier: 1 GiB, 50 000 reads / 20 000 writes per day.                                                                   |
| Secret Manager                  | one secret, one version                                              | Free tier: 6 active versions, 10 000 accesses per month.                                                                  |
| Cloud Build + Artifact Registry | used by `gcloud run deploy --source`                                 | Free tier: 2 500 build-minutes, 0.5 GB of images. Each deploy leaves an image: delete old ones now and then (section 10). |
| Firebase Hosting                | default domain                                                       | Spark-level product; no custom domain (card #18 is postponed).                                                            |

Free-tier numbers: https://docs.cloud.google.com/free/docs/free-cloud-features (a billing account is required). That page does not say whether `europe-west1` is covered by the Cloud Run free tier, so the budget alert in section 2 is the safety net, not an assumption. Cloud Run and Secret Manager need the Firebase **Blaze** plan: https://firebase.google.com/pricing

**Not created, on purpose:** no minimum instances (`--min` stays 0), no load balancer, no VPC connector, no Cloud NAT, no paid monitoring or alerting, no custom domain, no second environment, no Cloud Armor. If a step asks for any of these, stop.

## 1. Tools, project and variables

Install the Google Cloud CLI (`gcloud`) and the Firebase CLI (`npm install -g firebase-tools`), then:

```bash
gcloud auth login
firebase login
```

**How to run the blocks.** Every block below works when pasted into an interactive `zsh` (the macOS default, where `#` comments are not allowed on the command line) or `bash`: the blocks contain no `# comments`, the explanations are in the text around them. Guards that must stop a block (placeholders still in place, unexpected upload list) are `if ... else ... fi`, so they stop the block without closing your terminal. Keep the same shell for the whole runbook, because the variables below are used throughout.

Fill the values once. `PROJECT_ID` is the Firebase project id, which is also the GCP project id. Run this block from the repo root, so that `REPO_ROOT` is right:

```bash
export REPO_ROOT="$(pwd)"
export PROJECT_ID=REPLACE_WITH_FIREBASE_PROJECT_ID
export REGION=europe-west1
export SERVICE=bookmind-server
export SA_NAME=bookmind-api
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if [ "${PROJECT_ID#REPLACE}" != "$PROJECT_ID" ]; then
  echo "STOP: set PROJECT_ID to your real project id, then run this block again."
else
  gcloud config set project "$PROJECT_ID"
fi
```

Put the same project id in `.firebaserc` (it ships with `REPLACE_WITH_FIREBASE_PROJECT_ID`).

## 2. Blaze plan and the 10 EUR budget alert

1. Upgrade to **Blaze** in the Firebase console (Usage and billing > Modify plan) and link the billing account. This is the only way to enable Cloud Run and Secret Manager.
2. Find the billing account id and create the alert-only budget:

```bash
gcloud billing accounts list
```

Copy the billing account id (it looks like `0X0X0X-0X0X0X-0X0X0X`) into the next block:

```bash
export BILLING_ACCOUNT_ID=REPLACE_WITH_BILLING_ACCOUNT_ID
if [ "${BILLING_ACCOUNT_ID#REPLACE}" != "$BILLING_ACCOUNT_ID" ]; then
  echo "STOP: set BILLING_ACCOUNT_ID, then run this block again."
else
  gcloud billing budgets create \
    --billing-account="$BILLING_ACCOUNT_ID" \
    --display-name="bookmind-10-eur-per-month" \
    --budget-amount=10EUR \
    --threshold-rule=percent=0.5 \
    --threshold-rule=percent=0.9 \
    --threshold-rule=percent=1.0 \
    --filter-projects="projects/${PROJECT_ID}"
fi
```

-   Reference: https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create (the currency suffix must match the billing account's currency; if it is not EUR, drop `EUR` and set the number you consider equivalent). Needs the Billing Account Costs Manager or Administrator role: https://docs.cloud.google.com/billing/docs/how-to/budgets
-   If gcloud offers to enable the Cloud Billing Budget API, answer yes.
-   **A budget only sends alerts. It never stops spending.** Spend is bounded by the service-level `--max 2` and by the per-user daily quota, not by this budget. Check in Billing > Budgets that the budget exists and that your email is among the recipients.

## 3. Enable the APIs (enabling is free)

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

## 4. Firestore in europe-west1 (the location is permanent)

```bash
gcloud firestore databases create --location=europe-west1 --type=firestore-native
```

Reference: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/databases/create . Choose the location carefully: it cannot be changed later. If a `(default)` database already exists (for example created from the Firebase console), check its location in the console before running the command: the command fails on an existing database, and a wrong location is permanent.

**TTL policy** (without it the `llmQuota` documents are never deleted). The `list` command must show `expireAt` for the collection group `llmQuota`:

```bash
gcloud firestore fields ttls update expireAt --collection-group=llmQuota --enable-ttl
gcloud firestore fields ttls list
```

References: https://firebase.google.com/docs/firestore/ttl and https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/update . Firestore deletes expired documents "typically within 24 hours" after expiry, so a counter lives at most about 72 h. Each collection group has one TTL field.

**Lock the database for clients.** The repo ships `firestore.rules` (deny everything). The backend uses the Admin SDK, which bypasses security rules ("The server client libraries bypass all Cloud Firestore Security Rules": https://firebase.google.com/docs/firestore/security/get-started ), so the quota keeps working, and a signed-in user cannot edit their own counter from the app:

```bash
cd "$REPO_ROOT"
firebase deploy --only firestore --project "$PROJECT_ID"
```

## 5. Service account with the minimum roles

The service runs as its own service account, never as the default Compute Engine one (which carries the broad Editor role).

```bash
gcloud iam service-accounts create "$SA_NAME" --display-name="BookMind API (Cloud Run)"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/firebaseauth.viewer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/logging.logWriter"
```

The first binding (`roles/datastore.user`) is for the quota counters, the second (`roles/firebaseauth.viewer`) for the lookup done by `verify_id_token(check_revoked=True)`, the third (`roles/logging.logWriter`) for `POST /reports` (card #66), which writes each report to its own Cloud Logging log through the API. **If the service is already deployed, run the third binding before you deploy the version with `/reports`**; without it every report answers `503 Report service unavailable`. The secret-level role is granted in section 6, after the secret exists.

| Role                                 | Granted on                    | Needed for                                                                                                                                                                                                                                                                                                           | Official source                                                                                                                                    |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles/datastore.user`               | project                       | read and write the `llmQuota` documents, including transactions. "Read/write access to data in a Firestore database. Intended for application developers and service accounts."                                                                                                                                      | https://docs.cloud.google.com/firestore/docs/security/iam                                                                                          |
| `roles/secretmanager.secretAccessor` | the secret `LLM_API_KEY` only | Cloud Run reads the key at instance start.                                                                                                                                                                                                                                                                           | https://docs.cloud.google.com/run/docs/configuring/services/secrets and https://docs.cloud.google.com/secret-manager/docs/manage-access-to-secrets |
| `roles/logging.logWriter`            | project                       | `POST /reports` writes one entry per report to the log `ai-content-report` with the Cloud Logging API. "Provides the permissions to write log entries." (permission `logging.logEntries.create`, checked 2026-10-09). The role grants no read access. | https://docs.cloud.google.com/logging/docs/access-control                                                                                          |
| `roles/firebaseauth.viewer`          | project                       | `check_revoked=True` asks the Firebase Auth backend for the user's status ( https://firebase.google.com/docs/auth/admin/manage-sessions ). The role is "Read-only access to Authentication resources" and holds `firebaseauth.users.get` ( https://firebase.google.com/docs/projects/iam/roles-predefined-product ). | see the caveat below                                                                                                                               |

**Caveat on `roles/firebaseauth.viewer`:** the docs list the role and its permission, but none of the pages says in so many words that the revocation lookup needs exactly `firebaseauth.users.get`. The smoke test (section 8) proves it: a valid token must return `200`. If it returns `503` and the Cloud Run log says `Token verification unavailable: <ErrorName>`, this role is the first thing to re-check. Do not "fix" it by granting Editor or Owner.

Signature verification of ID tokens uses Google's public keys and needs no role. Cloud Run's own request and stdout logs are written by the platform and need no role from this service account; only the `ai-content-report` entries (written through the API) need `roles/logging.logWriter`.

The person deploying needs permission to deploy and to act as this service account: `roles/run.admin` (or `roles/run.sourceDeveloper`), `roles/iam.serviceAccountUser` on it, and `roles/serviceusage.serviceUsageConsumer` ( https://docs.cloud.google.com/run/docs/deploying-source-code ). A project Owner already has all of that. If the source build fails with a permission error on Cloud Build, the same page tells you to grant `roles/run.builder` to the Compute Engine default service account.

## 6. The LLM key in Secret Manager

The value is typed at a hidden prompt: it never appears on a command line, in the shell history or in this repo.

```bash
gcloud secrets create LLM_API_KEY --replication-policy=automatic

printf 'LLM API key (hidden): '; read -rs LLM_KEY_VALUE; echo
printf '%s' "$LLM_KEY_VALUE" | gcloud secrets versions add LLM_API_KEY --data-file=-
unset LLM_KEY_VALUE

gcloud secrets add-iam-policy-binding LLM_API_KEY \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor"
```

References: https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets , https://docs.cloud.google.com/secret-manager/docs/add-secret-version . The service is pinned to version `1` (below): environment variables are read when an instance starts, and pinning avoids a surprise when a new version is added. To rotate the key, add a version and deploy with `--set-secrets LLM_API_KEY=LLM_API_KEY:2`.

## 7. Deploy the backend

Create the non-secret configuration in a file **outside the repo** (the key is not in it):

```bash
cat > "$HOME/bookmind-prod-env.yaml" <<EOF
FIREBASE_PROJECT_ID: "${PROJECT_ID}"
DAILY_LLM_CALL_LIMIT: "10"
DAILY_REPORT_LIMIT: "20"
# Production origins only: Firebase Hosting (both default domains) and the Capacitor app origins
# (Android WebView https://localhost, iOS capacitor://localhost). Never http://localhost* or 10.0.2.2.
CORS_ALLOWED_ORIGINS: "https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com,https://localhost,capacitor://localhost"
# LLM provider: decided by card #71. Fill in both lines below. For OpenAI directly, delete the LLM_BASE_URL line.
LLM_BASE_URL: "REPLACE_WITH_PROVIDER_BASE_URL"
LLM_MODEL: "REPLACE_WITH_MODEL_NAME"
EOF
```

Open that file and fill `LLM_BASE_URL` and `LLM_MODEL` (for OpenAI directly, delete the `LLM_BASE_URL` line). If the provider needs router options, add `LLM_EXTRA_BODY` as a JSON string (see `README.md`, "LLM provider").

The next block deploys only if all of these hold, and otherwise prints why it stopped and does nothing:

-   `PROJECT_ID` is set to a real value;
-   the env file exists and has no `REPLACE_` value left;
-   the source upload is **exactly** these eight files: `Dockerfile`, `auth.py`, `llm.py`, `main.py`, `prompts.py`, `quota.py`, `reports.py`, `requirements.txt`. `bookmind-server/.gcloudignore` is an allowlist (everything is ignored except these files), so a credential file dropped into that folder under any name is never uploaded. `gcloud meta list-files-for-upload` shows what gcloud would send.

```bash
cd "$REPO_ROOT/bookmind-server"
export ENV_FILE="$HOME/bookmind-prod-env.yaml"
UPLOAD_LIST=$(gcloud meta list-files-for-upload | LC_ALL=C sort)
EXPECTED_LIST=$(printf '%s\n' Dockerfile auth.py llm.py main.py prompts.py quota.py reports.py requirements.txt | LC_ALL=C sort)
if [ "${PROJECT_ID#REPLACE}" != "$PROJECT_ID" ] || [ -z "$PROJECT_ID" ]; then
  echo "STOP: PROJECT_ID is not set (section 1). Nothing was deployed."
elif [ ! -f "$ENV_FILE" ]; then
  echo "STOP: $ENV_FILE does not exist (previous block). Nothing was deployed."
elif grep -n REPLACE_ "$ENV_FILE"; then
  echo "STOP: fill the lines listed above in $ENV_FILE. Nothing was deployed."
elif [ "$UPLOAD_LIST" != "$EXPECTED_LIST" ]; then
  echo "STOP: the source upload would contain these files, not the expected eight:"
  echo "$UPLOAD_LIST"
else
  gcloud run deploy "$SERVICE" \
    --source . \
    --region "$REGION" \
    --service-account "$SA_EMAIL" \
    --min 0 \
    --max 2 \
    --memory 512Mi --cpu 1 --timeout 60 \
    --env-vars-file "$ENV_FILE" \
    --set-secrets LLM_API_KEY=LLM_API_KEY:1 \
    --allow-unauthenticated
fi
```

-   `--allow-unauthenticated` is deliberate: the app calls the API from a phone with no Google identity. Protection is the Firebase ID token check plus the daily quota, both inside the service (`auth.py`, `quota.py`). If the command is refused by an organisation policy, stop and ask; do not work around it.
-   `--min 0` is the **service-level** minimum: the first request after idle pays a cold start (seconds). Accepted by the operator on 2026-10-09.
-   `--max 2` is the **service-level** maximum: it caps parallel instances and so the cost of a traffic spike. Do not use the revision-level flags `--min-instances` / `--max-instances` here: Google recommends the service-level setting for capping a service, and says revision-level scaling "is only available for services that previously had the feature configured" ( https://docs.cloud.google.com/run/docs/configuring/max-instances , https://docs.cloud.google.com/run/docs/configuring/min-instances ).
-   The build uses the `Dockerfile` in `bookmind-server/` (Cloud Build builds for the right CPU type; if you ever build the image on an Apple-silicon Mac for Cloud Run, add `--platform linux/amd64`).
-   Flag reference: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy , container contract (port 8080): https://docs.cloud.google.com/run/docs/container-contract

**Read the cap back.** The deploy block can have succeeded without the spend cap being in place, so check it. This reads the service as Cloud Run stores it and fails visibly unless the service-level annotations are `maxScale` 2 and `minScale` 0 or unset (and no revision-level setting undoes them):

```bash
cd "$REPO_ROOT/bookmind-server"
gcloud run services describe "$SERVICE" --region "$REGION" --format export | python3 scripts/check_cloud_run_scaling.py
```

The last line must be `OK: service-level scaling is min 0 / max 2`. On a `FAIL` line, run `gcloud run services update "$SERVICE" --region "$REGION" --min 0 --max 2` and read the cap back again. The human-readable cross-check is `gcloud run services describe "$SERVICE" --region "$REGION"`, which shows `Scaling: Auto (Min: 0, Max: 2)` ( https://docs.cloud.google.com/run/docs/configuring/max-instances ). If that line is right and only the script complains, the script could not read the export: report it, do not skip the check.

Record the service URL (it is also printed at the end of the deploy). `VITE_API_BASE_URL` of the production app build must be this URL:

```bash
export API_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
echo "$API_URL"
```

Change a setting without a code release, for example the limit:

```bash
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars DAILY_LLM_CALL_LIMIT=20
```

`DAILY_REPORT_LIMIT` (reports per user per UTC day, default 20) is changed the same way.

## 8. Post-deploy checks

(Section 7 already ended with the scaling read-back: do not continue if it said `FAIL`.)

### 8.1 Smoke test: 401, 200, 429, CORS

Create a **dedicated test user** in Firebase console > Authentication > Add user (email and password). Do not use the store reviewers' account: this test uses up its daily quota. The Web API key is the `VITE_FIREBASE_API_KEY` of the app (Firebase console > Project settings > General). The block below signs in with the Firebase Auth REST API ("Sign in with email / password", https://firebase.google.com/docs/reference/rest/auth ) and keeps the ID token in memory only (valid for about an hour).

```bash
export FIREBASE_WEB_API_KEY=REPLACE_WITH_WEB_API_KEY
printf 'Test user email: '; read -r SMOKE_EMAIL; export SMOKE_EMAIL
printf 'Test user password (hidden): '; read -rs SMOKE_PASSWORD; export SMOKE_PASSWORD; echo

ID_TOKEN=$(python3 - <<'PY'
import json, os, urllib.request
req = urllib.request.Request(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + os.environ["FIREBASE_WEB_API_KEY"],
    data=json.dumps({"email": os.environ["SMOKE_EMAIL"], "password": os.environ["SMOKE_PASSWORD"], "returnSecureToken": True}).encode(),
    headers={"Content-Type": "application/json"},
)
print(json.load(urllib.request.urlopen(req))["idToken"])
PY
)
unset SMOKE_PASSWORD
[ -n "$ID_TOKEN" ] && echo "token ok" || echo "sign-in failed"

BODY='{"lang":"en","transcript":[{"role":"user","content":"something hopeful"},{"role":"user","content":"I loved Sapiens"}]}'
```

| #   | Command                                                                                                                                                                     | Expected                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API_URL/recommendations/clarify" -H 'Content-Type: application/json' -d "$BODY"`                                        | `401` (no token)                                                                       |
| 2   | `curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API_URL/recommendations/clarify" -H 'Authorization: Bearer not-a-token' -H 'Content-Type: application/json' -d "$BODY"` | `401` (invalid token)                                                                  |
| 3   | `curl -s -X POST "$API_URL/recommendations/clarify" -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' -d "$BODY"`                                    | `200` and `{"question": "..."}` (the first request may take a few seconds: cold start) |

A `503 Authentication service unavailable` on 2 or 3 means the service account cannot reach Firebase Auth (section 5 caveat); `503 Quota service unavailable` means Firestore (database missing, or `roles/datastore.user` missing); `500` or `502` on 3 means the LLM provider settings or the secret.

Then the limit. Call 3 above already used one of the 10 daily calls, so in this loop calls 1 to 9 are `200` and call 10 is `429`:

```bash
for i in $(seq 1 10); do
  printf 'call %s -> ' "$i"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API_URL/recommendations/clarify" \
    -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' -d "$BODY"
done
```

Expected: `200` for the first nine, `429` for the tenth (the 11th call of the day). Read the headers of a refused call: `curl -si -X POST ... | head -n 12` shows `429`, `retry-after: <seconds to UTC midnight>` and `{"detail":"Daily limit reached"}`. (If the test user already called today, the `429` comes earlier. The counter resets at 00:00 UTC.) In the Firestore console, `llmQuota/<uid>_<YYYY-MM-DD>` must show `count: 10` and an `expireAt` of the day after tomorrow, 00:00 UTC.

Reports (card #66). `POST /reports` has its own counter, so it works even when the LLM limit above is used up. Send one report, then look for it in Logs Explorer:

```bash
curl -si -X POST "$API_URL/reports" -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"kind":"clarifier","lang":"en","content":"Smoke test, please ignore","reason":"other"}' | head -n 1
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API_URL/reports" -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"kind":"clarifier","lang":"en","content":"x","reason":"other","uid":"someone"}'
```

Expected: `HTTP/2 204`, then `422` (a field that is not allowed). In Google Cloud console > Logging > Logs Explorer, the query `logName="projects/PROJECT_ID/logs/ai-content-report"` (replace `PROJECT_ID`) shows one `WARNING` entry with `kind`, `lang`, `content` and `reason` and nothing else (no user id). If the first call answers `503 Report service unavailable`, the Cloud Run log says `Report log unavailable: <ErrorName>`: re-check `roles/logging.logWriter` (section 5) first. There is nothing to clean up: the entry expires with the log retention.

CORS: the Hosting origin is allowed, localhost is not (the first answer carries `access-control-allow-origin`, the second does not):

```bash
curl -si -X OPTIONS "$API_URL/recommendations" -H "Origin: https://${PROJECT_ID}.web.app" \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: authorization,content-type' | grep -iE '^HTTP|access-control-allow-origin'
curl -si -X OPTIONS "$API_URL/recommendations" -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' | grep -iE '^HTTP|access-control-allow-origin'
```

Expected: `200` with `access-control-allow-origin: https://<project>.web.app`, then `400` with no `access-control-allow-origin`.

When done, delete the test user in the Authentication console and `unset ID_TOKEN`.

### 8.2 Concurrency check on real Firestore (closes the gap left by card #60)

Card #60's tests ran the quota transaction against a fake Firestore, so they could not show how the real database resolves two requests of the same user racing for the last allowed call. This script does, with the production code path (`quota.FirestoreQuotaStore`). It writes only synthetic documents `llmQuota/quotacheck-*` (never a real user's counter), calls no LLM, deletes them when it ends, and gives them an `expireAt` one hour ahead so TTL removes them if it is interrupted.

```bash
cd "$REPO_ROOT/bookmind-server"
gcloud auth application-default login
venv/bin/python scripts/check_quota_concurrency.py --project "$PROJECT_ID"
```

(`application-default login` is a one-time sign-in with your own account, which needs Firestore access; a project Owner has it. `venv` is the backend virtualenv with `requirements.txt` installed; see `README.md`. If Google complains about a missing quota project, run `gcloud auth application-default set-quota-project "$PROJECT_ID"` and retry.)

What it does: 5 rounds in which **two simultaneous requests** from the same user compete for a limit of 1 (exactly one must win each round), then 20 simultaneous requests against a limit of 5 (at most 5 may win and the stored count must equal the number allowed). Expected end of output:

```
ok   pair  limit=1 requests=2 allowed=1 refused=1 errors=0 stored_count=1     (x5)
ok   burst limit=5 requests=20 allowed=5 refused=15 errors=0 stored_count=5
PASS
```

Exit code `0` is PASS, `1` is FAIL. **A FAIL means the quota lets extra calls through: do not open the service to testers, and report it.** A few `errors` in the burst are not a failure (a transaction that ran out of retries under heavy contention is refused, which the API answers with `503`, never with an extra LLM call). Run it again if you change `quota.py`.

## 9. Firebase Hosting (web build, `/delete-account`, `/privacy`)

`firebase.json` publishes `dist/` with an SPA rewrite to `/index.html`, plus two 301 redirects: `/privacy` goes to the Italian Iubenda policy, `/privacy/en` to the English one. **The two destinations are placeholders: the Iubenda URLs do not exist yet.** Open `firebase.json` and replace them with the full public policy URLs Iubenda gives you:

-   `REPLACE_WITH_IUBENDA_IT_POLICY_URL` in the `/privacy` redirect;
-   `REPLACE_WITH_IUBENDA_EN_POLICY_URL` in the `/privacy/en` redirect.

The production `.env` (repo root) must have `VITE_API_BASE_URL=<the Cloud Run URL>` and the `VITE_FIREBASE_*` values. The next block builds and deploys only if `PROJECT_ID` is set and no `REPLACE_WITH` is left in `firebase.json` or `.firebaserc`; otherwise it lists the offending lines and does nothing, so a pasted block can never publish a redirect to a placeholder.

```bash
cd "$REPO_ROOT"
if [ "${PROJECT_ID#REPLACE}" != "$PROJECT_ID" ] || [ -z "$PROJECT_ID" ]; then
  echo "STOP: PROJECT_ID is not set (section 1). Nothing was deployed."
elif grep -n REPLACE_WITH firebase.json .firebaserc; then
  echo "STOP: fill the placeholders listed above. Nothing was deployed."
else
  npm run build && firebase deploy --only hosting --project "$PROJECT_ID"
fi
```

Then check the three URLs (also open them in a private browser window):

```bash
curl -sI "https://${PROJECT_ID}.web.app/privacy" | grep -iE '^HTTP|^location'
curl -sI "https://${PROJECT_ID}.web.app/privacy/en" | grep -iE '^HTTP|^location'
curl -s -o /dev/null -w '%{http_code}\n' "https://${PROJECT_ID}.web.app/delete-account"
```

Expected: the first two print `301` and a `location:` header with the Italian and the English Iubenda policy URL respectively; the third prints `200` (the SPA rewrite).

How Hosting resolves this (https://firebase.google.com/docs/hosting/full-config ): redirects are checked first, then files, then rewrites; a `source` of `/privacy` does not match `/privacy/en`, which is why both are listed explicitly. The URL for Play Console and App Store Connect is `https://<project-id>.web.app/privacy`. If Iubenda is ever dropped, only the redirect destinations change. The privacy URLs can go live later than the backend: this step does not block sections 1 to 8.

`firebase.json` is shared with card #54 (Firebase Emulator Suite adds an `emulators` section). The top-level sections (`hosting`, `firestore`, `emulators`) do not depend on each other: whoever merges second keeps both.

## 10. Housekeeping and rollback

-   Old images: `gcloud run deploy --source` stores each build in Artifact Registry (repository `cloud-run-source-deploy`). The free tier is 0.5 GB. List with `gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy` and delete old ones in the console (Artifact Registry) when you pass about 0.3 GB.
-   Logs: written by Cloud Run to Cloud Logging (first 50 GiB per month free, default retention at no cost). They never contain the key or tokens: the code logs error class names only. The one exception by design is the log `ai-content-report`: it holds the AI text that users reported (at most 1000 characters each) and a reason, with no user id. It stays in the `_Default` bucket for its 30-day retention (https://docs.cloud.google.com/logging/quotas , checked 2026-10-09) and is read in Logs Explorer (`README.md`, "Reports of AI content").
-   Take the API offline (it cannot spend anything while gone): `gcloud run services delete "$SERVICE" --region "$REGION"`. `llmQuota` documents expire by themselves.
-   Back to a previous Cloud Run revision: Cloud Run console > Revisions > Manage traffic. Moving traffic to another revision does not change the service-level `--max 2`.
-   Roll Hosting back to the previous release (for example after a wrong redirect): Firebase console > Hosting & Serverless > Hosting > Release history, hover over the previous release, click the three-dot menu and choose **Roll back**. It creates a new release that serves the earlier version. Source: https://firebase.google.com/docs/hosting/manage-hosting-resources (the page documents no CLI rollback command).

## Placeholders you must fill (nothing here is guessed)

| Where                      | Placeholder                                                                | Source                                                                |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `.firebaserc` and shell    | `REPLACE_WITH_FIREBASE_PROJECT_ID`                                         | Firebase console > Project settings                                   |
| shell                      | `REPLACE_WITH_BILLING_ACCOUNT_ID`                                          | `gcloud billing accounts list`                                        |
| `~/bookmind-prod-env.yaml` | `LLM_BASE_URL`, `LLM_MODEL`                                                | provider chosen after card #71                                        |
| shell                      | `REPLACE_WITH_WEB_API_KEY`                                                 | Firebase console > Project settings (same as `VITE_FIREBASE_API_KEY`) |
| `firebase.json`            | `REPLACE_WITH_IUBENDA_IT_POLICY_URL`, `REPLACE_WITH_IUBENDA_EN_POLICY_URL` | Iubenda, once the policies exist                                      |
