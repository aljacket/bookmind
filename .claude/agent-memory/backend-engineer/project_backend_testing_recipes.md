---
name: backend-testing-recipes
description: How to run and verify bookmind-server without Firebase/Firestore emulators or real LLM, and tool-sandbox quirks seen on card #60
metadata:
    type: project
---

Card #60 (PR #17) built auth.py / quota.py / llm.py with 75 pytest tests. What is non-obvious:

-   Firebase Emulator Suite is NOT installed (no `firebase` CLI); downloading it needs operator approval. Firestore transaction code is tested through the real `google-cloud-firestore` Client with `client._firestore_api_internal` replaced by a tiny fake gapic server (tests/test_quota_firestore.py).
-   `FIREBASE_AUTH_EMULATOR_HOST` makes real `firebase_admin.verify_id_token` accept unsigned tokens (`alg: none`) and skip expiry/signature checks, then `check_revoked` calls `http://HOST/identitytoolkit.googleapis.com/v1/projects/PID/accounts:lookup`. A stdlib stub for that endpoint gives a genuine end-to-end auth run (no users in response = deleted user = 401).
-   Without ADC on the dev machine, `verify_id_token` raises DefaultCredentialsError: the endpoints answer 503 (fail closed), not 401. Local runs need `GOOGLE_APPLICATION_CREDENTIALS`, gcloud ADC, or the Auth emulator env var.
-   Production-vs-emulator trap: emulator mode accepts expired tokens; do not conclude expiry is unchecked in prod.
-   `importlib.reload(main)` in tests rebuilds the app to re-read CORS env at import time.

**Sandbox quirk:** the worktree guard refuses Bash commands it cannot prove are not git-related (variables as command names, `sed` with `$p`, `printf` with leading `-r`, `cd ..` then git). Use full literal paths, the Write tool for small files, and plain separate commands. `npm run trello` takes ~15 s per call: loop over `--check` in the background or with a long timeout.
