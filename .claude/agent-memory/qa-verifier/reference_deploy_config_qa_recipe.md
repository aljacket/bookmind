---
name: deploy-config-qa-recipe
description: How to verify BookMind container/runbook/Firebase-config PRs without gcloud or production - Docker context decoys, .gcloudignore emulated with git, fake-ADC for 401 vs 503, smoke-test simulation, zsh paste trap (card #61, 2026-10-09)
metadata:
    type: reference
---

Card #61 (Dockerfile, DEPLOY.md, firebase.json, quota concurrency script) took ~45 min. gcloud and firebase CLIs are NOT installed; Docker Desktop 28 is (daemon was already up).

-   **Build context proof**: plant decoys in the worktree (`.env`, `.env.production`, `x.pem`, `key.json`, `<proj>-firebase-adminsdk-<id>.json` = the default Firebase SA key name, `id_rsa`, `secrets.yaml`, `venv/`), then `docker build -f <scratch>/Dockerfile.ctx .` with `FROM busybox:1.36` + `COPY . /ctx` + `find /ctx -type f`. The context's `.dockerignore` still applies with `-f` outside the context. Engineers tend to pick decoy names that match their own patterns: always add the adminsdk name and `key.json`.
-   **.gcloudignore without gcloud**: rsync the dir to the scratchpad, `cp .gcloudignore .gitignore`, `git init && git add -A && git ls-files` (gitignore syntax is what gcloud documents).
-   **401 vs 503 in the container**: with no ADC every Bearer token gives 503 (firebase_admin loads credentials before decoding). To prove "invalid token -> 401" as on Cloud Run, generate a throwaway RSA key inside the container, write a fake service_account JSON, set `GOOGLE_APPLICATION_CREDENTIALS` and `FIREBASE_PROJECT_ID=demo-...`, hit `main.app` with `TestClient`.
-   **Smoke-test sequence**: replay the runbook's curl sequence with `TestClient` + `dependency_overrides` (fixed uid, in-memory store, `llm.chat` stubbed) to check 200 x N then 429, `Retry-After`, `count` and `expireAt`.
-   **Operator-run Firestore scripts**: monkeypatch `quota.FirestoreQuotaStore` with a fake that records collection/doc ids, run `main()`, assert only `quotacheck-*` ids, nothing left, `openai`/`llm`/`main` not in `sys.modules`. Run without creds with `env -i PATH=/usr/bin:/bin HOME=<empty>` and a fake project id.
-   **zsh paste trap**: the operator's login shell is `/bin/zsh` with `interactivecomments` OFF (checked 2026-10-09). Trailing `# comments` in runbook blocks become arguments (gcloud gets junk args, `*.pem` aborts with "no matches found", `# 301 -> Iubenda` redirects into a stray file). Test with `expect` driving `zsh -f -i`; `zsh -i -c` does NOT reproduce it. `bash -n`/`zsh -n` pass anyway.
-   Extract runbook blocks: `awk '/^```bash/{...}'` into numbered files, then `bash -n` and `zsh -n` each.
-   Docs verification is token-heavy: delegate it to one general-purpose agent with numbered questions (URL + verbatim quote + CONFIRMED/CONTRADICTED/NOT STATED).

-   **Card #61 round 1 = FAIL (2026-10-09)**: re-check on the fix round: service-level `--min 0 --max 2` (the max-instances doc says revision-level scaling is only for services that already had it), an allowlist `.gcloudignore`/`.dockerignore` (re-plant the adminsdk/key.json decoys), runbook usable in zsh, blocking placeholder guards. Gap (a) closed: check_revoked → `accounts:lookup` → `firebaseauth.users.get` (in firebaseauth.viewer). `bookmind-server/scripts/__pycache__/` is not gitignored.

Related: [[backend-qa-recipe]], [[tooling-qa-recipe]]
