# Deploying BookMind to production (operator runbook)

Written for card #61. The operator runs every command; nothing here is run by an agent. Docs checked on 2026-10-09: if a command fails or a flag has moved, trust the linked page over this file.

What you end up with: the backend on **Cloud Run (`europe-west1`)**, Firestore in **`europe-west1`**, the web build and the privacy redirects on **Firebase Hosting** (default `*.web.app` domain), and a **10 EUR/month budget alert**.

## 0. Cost posture: nothing else is created

| Resource                        | Setting                                                              | Why it is (almost) free                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Cloud Run                       | `--min-instances 0`, `--max-instances 2`, 512 MiB, 1 vCPU            | Nothing runs while idle. Free tier: 2 M requests, 180 000 vCPU-s, 360 000 GiB-s per month.                                |
| Firestore                       | one database, one collection (`llmQuota`), TTL deletes old documents | Free tier: 1 GiB, 50 000 reads / 20 000 writes per day.                                                                   |
| Secret Manager                  | one secret, one version                                              | Free tier: 6 active versions, 10 000 accesses per month.                                                                  |
| Cloud Build + Artifact Registry | used by `gcloud run deploy --source`                                 | Free tier: 2 500 build-minutes, 0.5 GB of images. Each deploy leaves an image: delete old ones now and then (section 10). |
| Firebase Hosting                | default domain                                                       | Spark-level product; no custom domain (card #18 is postponed).                                                            |

Free-tier numbers: https://docs.cloud.google.com/free/docs/free-cloud-features (a billing account is required). That page does not say whether `europe-west1` is covered by the Cloud Run free tier, so the budget alert in section 2 is the safety net, not an assumption. Cloud Run and Secret Manager need the Firebase **Blaze** plan: https://firebase.google.com/pricing

**Not created, on purpose:** no `--min-instances`, no load balancer, no VPC connector, no Cloud NAT, no paid monitoring or alerting, no custom domain, no second environment, no Cloud Armor. If a step asks for any of these, stop.

## 1. Tools, project and variables

Install the Google Cloud CLI (`gcloud`) and the Firebase CLI (`npm install -g firebase-tools`), then:

```bash
gcloud auth login
firebase login
```

Fill the values once and keep the same shell for the rest of the runbook (run this block from the repo root, so `REPO_ROOT` is right):

```bash
export REPO_ROOT="$(pwd)"
export PROJECT_ID=REPLACE_WITH_FIREBASE_PROJECT_ID     # the Firebase project id, also the GCP project id
export REGION=europe-west1
export SERVICE=bookmind-server
export SA_NAME=bookmind-api
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID"
```

Put the same project id in `.firebaserc` (it ships with `REPLACE_WITH_FIREBASE_PROJECT_ID`).

## 2. Blaze plan and the 10 EUR budget alert

1. Upgrade to **Blaze** in the Firebase console (Usage and billing > Modify plan) and link the billing account. This is the only way to enable Cloud Run and Secret Manager.
2. Find the billing account id and create the alert-only budget:

```bash
gcloud billing accounts list
export BILLING_ACCOUNT_ID=REPLACE_WITH_BILLING_ACCOUNT_ID     # e.g. 0X0X0X-0X0X0X-0X0X0X

gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="bookmind-10-eur-per-month" \
  --budget-amount=10EUR \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --filter-projects="projects/${PROJECT_ID}"
```

-   Reference: https://docs.cloud.google.com/sdk/gcloud/reference/billing/budgets/create (the currency suffix must match the billing account's currency; if it is not EUR, drop `EUR` and set the number you consider equivalent). Needs the Billing Account Costs Manager or Administrator role: https://docs.cloud.google.com/billing/docs/how-to/budgets
-   If gcloud offers to enable the Cloud Billing Budget API, answer yes.
-   **A budget only sends alerts. It never stops spending.** Spend is bounded by `--max-instances 2` and by the per-user daily quota, not by this budget. Check in Billing > Budgets that the budget exists and that your email is among the recipients.

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

**TTL policy** (without it the `llmQuota` documents are never deleted):

```bash
gcloud firestore fields ttls update expireAt --collection-group=llmQuota --enable-ttl
gcloud firestore fields ttls list        # llmQuota / expireAt must be listed
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

# Firestore read/write for the quota counters
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/datastore.user"

# Firebase Auth lookup done by verify_id_token(check_revoked=True)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/firebaseauth.viewer"
```

(The secret-level role is granted in section 6, after the secret exists.)

| Role                                 | Granted on                    | Needed for                                                                                                                                                                                                                                                                                                           | Official source                                                                                                                                    |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles/datastore.user`               | project                       | read and write the `llmQuota` documents, including transactions. "Read/write access to data in a Firestore database. Intended for application developers and service accounts."                                                                                                                                      | https://docs.cloud.google.com/firestore/docs/security/iam                                                                                          |
| `roles/secretmanager.secretAccessor` | the secret `LLM_API_KEY` only | Cloud Run reads the key at instance start.                                                                                                                                                                                                                                                                           | https://docs.cloud.google.com/run/docs/configuring/services/secrets and https://docs.cloud.google.com/secret-manager/docs/manage-access-to-secrets |
| `roles/firebaseauth.viewer`          | project                       | `check_revoked=True` asks the Firebase Auth backend for the user's status ( https://firebase.google.com/docs/auth/admin/manage-sessions ). The role is "Read-only access to Authentication resources" and holds `firebaseauth.users.get` ( https://firebase.google.com/docs/projects/iam/roles-predefined-product ). | see the caveat below                                                                                                                               |

**Caveat on `roles/firebaseauth.viewer`:** the docs list the role and its permission, but none of the pages says in so many words that the revocation lookup needs exactly `firebaseauth.users.get`. The smoke test (section 8) proves it: a valid token must return `200`. If it returns `503` and the Cloud Run log says `Token verification unavailable: <ErrorName>`, this role is the first thing to re-check. Do not "fix" it by granting Editor or Owner.

Signature verification of ID tokens uses Google's public keys and needs no role. Cloud Run's own logs need no role from this service account.

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
# Production origins only: Firebase Hosting (both default domains) and the Capacitor app origins
# (Android WebView https://localhost, iOS capacitor://localhost). Never http://localhost* or 10.0.2.2.
CORS_ALLOWED_ORIGINS: "https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com,https://localhost,capacitor://localhost"
# LLM provider: decided by card #71. Fill in both lines below. For OpenAI directly, delete the LLM_BASE_URL line.
LLM_BASE_URL: "REPLACE_WITH_PROVIDER_BASE_URL"
LLM_MODEL: "REPLACE_WITH_MODEL_NAME"
EOF
```

If the provider needs router options, add `LLM_EXTRA_BODY` as a JSON string (see `README.md`, "LLM provider"). Then, from `bookmind-server/`:

```bash
cd "$REPO_ROOT/bookmind-server"
grep -n REPLACE "$HOME/bookmind-prod-env.yaml" && echo "FILL THE LINES ABOVE FIRST (delete LLM_BASE_URL for OpenAI)"
gcloud meta list-files-for-upload      # must NOT list .env, venv, *.pem, tests

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi --cpu 1 --timeout 60 \
  --env-vars-file "$HOME/bookmind-prod-env.yaml" \
  --set-secrets LLM_API_KEY=LLM_API_KEY:1 \
  --allow-unauthenticated
```

-   `--allow-unauthenticated` is deliberate: the app calls the API from a phone with no Google identity. Protection is the Firebase ID token check plus the daily quota, both inside the service (`auth.py`, `quota.py`). If the command is refused by an organisation policy, stop and ask; do not work around it.
-   `--min-instances 0` means the first request after idle pays a cold start (seconds). Accepted by the operator on 2026-10-09.
-   `--max-instances 2` caps parallel instances and so the cost of a traffic spike.
-   The build uses the `Dockerfile` in `bookmind-server/` (Cloud Build builds for the right CPU type; if you ever build the image on an Apple-silicon Mac for Cloud Run, add `--platform linux/amd64`).
-   Flag reference: https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy , container contract (port 8080): https://docs.cloud.google.com/run/docs/container-contract

Record the service URL (it is also printed at the end of the deploy). `VITE_API_BASE_URL` of the production app build must be this URL:

```bash
export API_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
echo "$API_URL"
```

Change a setting without a code release, for example the limit:

```bash
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars DAILY_LLM_CALL_LIMIT=20
```

## 8. Post-deploy checks

### 8.1 Smoke test: 401, 200, 429, CORS

Create a **dedicated test user** in Firebase console > Authentication > Add user (email and password). Do not use the store reviewers' account: this test uses up its daily quota. The Web API key is the `VITE_FIREBASE_API_KEY` of the app (Firebase console > Project settings > General).

```bash
export FIREBASE_WEB_API_KEY=REPLACE_WITH_WEB_API_KEY
printf 'Test user email: '; read -r SMOKE_EMAIL; export SMOKE_EMAIL
printf 'Test user password (hidden): '; read -rs SMOKE_PASSWORD; export SMOKE_PASSWORD; echo

# Sign in with the Firebase Auth REST API and keep the ID token in memory (valid for about an hour).
# https://firebase.google.com/docs/reference/rest/auth  ("Sign in with email / password")
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
gcloud auth application-default login      # your own account, once; it needs Firestore access (Owner has it)
venv/bin/python scripts/check_quota_concurrency.py --project "$PROJECT_ID"
```

(`venv` is the backend virtualenv with `requirements.txt` installed; see `README.md`. If Google complains about a missing quota project, run `gcloud auth application-default set-quota-project "$PROJECT_ID"` and retry.)

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

Check that nothing is left, build the app against the production API, and deploy:

```bash
cd "$REPO_ROOT"
grep -n "REPLACE_WITH" firebase.json .firebaserc && echo "FILL THE PLACEHOLDERS ABOVE FIRST"

# the production .env must have VITE_API_BASE_URL=<the Cloud Run URL> and the VITE_FIREBASE_* values
npm run build
firebase deploy --only hosting --project "$PROJECT_ID"
```

(`grep` printing nothing means every placeholder is filled.) Then, in a private browser window:

```bash
curl -sI "https://${PROJECT_ID}.web.app/privacy"    | grep -iE '^HTTP|^location'     # 301 -> Iubenda IT
curl -sI "https://${PROJECT_ID}.web.app/privacy/en" | grep -iE '^HTTP|^location'     # 301 -> Iubenda EN
curl -s -o /dev/null -w '%{http_code}\n' "https://${PROJECT_ID}.web.app/delete-account"   # 200 (SPA rewrite)
```

How Hosting resolves this (https://firebase.google.com/docs/hosting/full-config ): redirects are checked first, then files, then rewrites; a `source` of `/privacy` does not match `/privacy/en`, which is why both are listed explicitly. The URL for Play Console and App Store Connect is `https://<project-id>.web.app/privacy`. If Iubenda is ever dropped, only the redirect destinations change. The privacy URLs can go live later than the backend: this step does not block sections 1 to 8.

`firebase.json` is shared with card #54 (Firebase Emulator Suite adds an `emulators` section). The top-level sections (`hosting`, `firestore`, `emulators`) do not depend on each other: whoever merges second keeps both.

## 10. Housekeeping and rollback

-   Old images: `gcloud run deploy --source` stores each build in Artifact Registry (repository `cloud-run-source-deploy`). The free tier is 0.5 GB. List with `gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy` and delete old ones in the console (Artifact Registry) when you pass about 0.3 GB.
-   Logs: written by Cloud Run to Cloud Logging (first 50 GiB per month free, default retention at no cost). They never contain the key or tokens: the code logs error class names only.
-   Take the API offline (it cannot spend anything while gone): `gcloud run services delete "$SERVICE" --region "$REGION"`. `llmQuota` documents expire by themselves.
-   Back to a previous revision: Cloud Run console > Revisions > Manage traffic.

## Placeholders you must fill (nothing here is guessed)

| Where                      | Placeholder                                                                | Source                                                                |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `.firebaserc` and shell    | `REPLACE_WITH_FIREBASE_PROJECT_ID`                                         | Firebase console > Project settings                                   |
| shell                      | `REPLACE_WITH_BILLING_ACCOUNT_ID`                                          | `gcloud billing accounts list`                                        |
| `~/bookmind-prod-env.yaml` | `LLM_BASE_URL`, `LLM_MODEL`                                                | provider chosen after card #71                                        |
| shell                      | `REPLACE_WITH_WEB_API_KEY`                                                 | Firebase console > Project settings (same as `VITE_FIREBASE_API_KEY`) |
| `firebase.json`            | `REPLACE_WITH_IUBENDA_IT_POLICY_URL`, `REPLACE_WITH_IUBENDA_EN_POLICY_URL` | Iubenda, once the policies exist                                      |
