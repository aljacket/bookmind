---
name: backend-qa-recipe
description: How to verify BookMind backend (bookmind-server) PRs over real HTTP without Firebase/LLM - auth emulator stub, non-emulator RS256 path, fake Firestore gRPC, LLM stub, main baseline compare, mutations (card #60, 2026-10-09)
metadata:
    type: reference
---

Card #60 (auth/quota/CORS/llm.py) took ~40 min. Python is `bookmind/bookmind-server/venv/bin/python`. The worktrees have no venv, so run it from there.

-   **Worktree**: the PR branch is usually locked in the engineer's `.claude/worktrees/agent-*`, so use `git worktree add --detach ../bookmind-qa-<n> <headOid>`. Add a second detached worktree on `origin/main` for the baseline.
-   **Shell traps**: zsh does not word-split `$VAR` (`set -- $pf` and `$T args` fail), so put loops in a `bash` script file. The bare `python3` hung for 2 minutes (probably an Xcode stub), so always use the venv python with `< /dev/null`. There is no `timeout` binary.
-   **Isolate env**: `env -i PATH=/usr/bin:/bin HOME=$HOME CLOUDSDK_CONFIG=<empty dir> ...`. There is no gcloud ADC on this Mac. `load_dotenv` finds no `.env` in the worktrees.
-   **Auth emulator stub**: `FIREBASE_AUTH_EMULATOR_HOST` plus a stub for `POST .../accounts:lookup` (disabled: `disabled: true`; revoked: `validSince` > iat; deleted: no `users`), with unsigned `alg: none` tokens. Caveat: in emulator mode firebase_admin skips the signature AND **expiry** checks, so an expired token gives 200 there. It is not a bug.
-   **Non-emulator path** (expired or forged → 401, cert or Auth outage → 503): generate an RSA key and a self-signed cert. Patch `firebase_admin._token_gen.ID_TOKEN_CERT_URI` and `_user_mgt.UserManager.ID_TOOLKIT_URL` to a local stub. Use `credentials.Certificate` with `token_uri` on the stub, then set `auth._app`.
-   **Firestore without the emulator**: use a real `google.cloud.firestore.Client(project, AnonymousCredentials())` with `client._firestore_api_internal = fake` (begin_transaction, batch_get_documents, commit, rollback). Patch `FirestoreQuotaStore._get_client` and `quota._utcnow` in a launcher that runs `uvicorn.run(main.app)`, with an admin HTTP port for the clock, outage toggles and the doc dump (`doc.fields[x]._pb.WhichOneof("value_type")`). Not covered this way: real contention between concurrent requests.
-   **LLM stub**: an OpenAI-compatible `/v1/chat/completions` that logs bodies to JSONL. Point the PR at it with `LLM_BASE_URL`, and `main` with `OPENAI_BASE_URL` (the SDK reads it). Then compare client responses and LLM bodies case by case.
-   **Mutations**: copy the `*.py` files, `pytest.ini` and `tests` into the scratchpad, `sed` one mutation at a time, and run pytest. Never mutate in the QA worktree.
-   The Trello list for PASS is literally "Review & Merge".

Related: [[tooling-qa-recipe]], [[evidence-harness]]
