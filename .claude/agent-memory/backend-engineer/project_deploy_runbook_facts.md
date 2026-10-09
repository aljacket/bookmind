---
name: deploy-runbook-facts
description: Non-obvious facts from card #61 (Dockerfile, DEPLOY.md, firebase.json) - what was verified, what the docs do NOT say, local Docker recipes
metadata:
    type: project
---

Card #61 (2026-10-09) shipped `bookmind-server/Dockerfile`, `.dockerignore`, `.gcloudignore`, `DEPLOY.md`, `scripts/check_quota_concurrency.py`, root `firebase.json`, `.firebaserc`, `firestore.rules`.

-   Docker Desktop is installed but the daemon may be off: `open -g -a Docker` then wait ~45 s. Allowed (starting an installed app is not installing it).
-   `gcloud run deploy --source` reads `.gcloudignore`, not `.dockerignore` (docs never mention `.dockerignore`), so both files exist and must stay in sync.
-   Firebase hosting redirect `source: "/privacy"` does NOT match `/privacy/en`; list both, most specific first. Redirects beat files beat rewrites.
-   Docs gaps (stated honestly in DEPLOY.md): no page says the `check_revoked` lookup needs exactly `roles/firebaseauth.viewer` (`firebaseauth.users.get`); no page says what default rules a gcloud-created Firestore gets (hence the shipped deny-all `firestore.rules`); the Cloud Run free-tier page does not mention europe-west1; Firebase Auth REST sign-in section could not be extracted by WebFetch (page is 400 KB).
-   The real-Firestore concurrency check is a script the operator runs (`--project` required); its logic is tested with an atomic and a racy in-memory store. The fake gapic server in test_quota_firestore.py is NOT contention-aware, so never run concurrent threads through it.
-   Sandbox: the worktree guard refuses compound commands that mention git or assign HOME/vars; split into plain commands. Scratch dir is under /private/tmp/claude-501/.../scratchpad.
