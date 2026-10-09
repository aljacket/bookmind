---
name: logging-endpoint-qa-recipe
description: How to verify BookMind endpoints that write to Cloud Logging (POST /reports, card #66) - real google-cloud-logging over REST to a local stub, throwaway venvs instead of the shared one, dependency-bump check, instrumentation-entry facts (2026-10-09)
metadata:
  type: reference
---

Card #66 (PR #22, POST /reports) was a PASS on 2026-10-09 after about 50 minutes.

**Shared venv**
-   Another agent may be using `bookmind-server/venv`. Never install into it.
-   Build two throwaway venvs from `/opt/homebrew/bin/python3.13` with `< /dev/null`:
    -   A: install `requirements.txt` + `requirements-dev.txt` fresh. This matches the Docker image.
    -   B: install the shared venv's `pip freeze`, then `pip install -r requirements.txt`, then diff the two freezes. This shows what the operator's upgrade will bump.

**Real logging client without ADC**
-   In the launcher, patch `google.cloud.logging.Client` to call the real Client with `credentials=AnonymousCredentials()`, `_use_grpc=False` and `client_options={"api_endpoint": "http://127.0.0.1:<stub>"}`.
-   The stub receives `POST /v2/entries:write` with `{"entries": [...]}`. Give it modes ok, 403, 503 and hang.
-   Set `K_SERVICE`, `K_REVISION` and `K_CONFIGURATION` to get the `cloud_run_revision` resource. No metadata hang was seen.
-   Without ADC the real sink raises `DefaultCredentialsError`, which proves the 503 path.

**Instrumentation facts (google-cloud-logging 3.17.0, released 2026-10-01)**
-   `Logger.log_struct` prepends one diagnostic entry per process. The only gate is the private flag `google.cloud.logging_v2._instrumentation_emitted`.
-   The public `logger.batch()` + `commit()` writes no diagnostic entry (measured: 1 entry against 2).
-   `log_struct` attaches no trace or httpRequest. Only the handlers do.

**Harness traps**
-   A query string `+00:00` decodes to a space: use `%2B`.
-   An unquoted bash heredoc that generates an expect script expands `$mode`: escape it.
-   `echo =====` fails in zsh (equals expansion).
-   The Write tool is blocked outside the memory dir: write scratch files with Bash heredocs.
-   Mutation copies need `scripts/` too, because `tests/test_cloud_run_scaling_check.py` imports it.

**Reuse**
-   Fake Firestore: extract `FakeFirestoreServer` from `tests/test_quota_firestore.py` into the scratchpad and patch `store._get_client`.
-   Auth stub, Docker decoys and the zsh replay work as in [[backend-qa-recipe]], [[deploy-config-qa-recipe]] and [[runbook-replay-harness]].

**Privacy point to re-check on #63/#65**
-   Cloud Run request logs keep remoteIp, userAgent and the timestamp of each POST /reports for 30 days.
-   A report is therefore "not linked to the account", not fully anonymous.
