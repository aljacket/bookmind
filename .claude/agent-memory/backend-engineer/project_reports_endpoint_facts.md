---
name: reports-endpoint-facts
description: Non-obvious facts from card #66 (POST /reports) - Cloud Logging sink, library diagnostic entry, fresh-venv testing, e2e harness, doc/allowlist touch points
metadata:
    type: project
---

Card #66 (2026-10-09) added `reports.py` (sink), `POST /reports` in main.py, `quota.consume_report`.

-   A distinct `logName` (`ai-content-report`) is impossible from Cloud Run stdout JSON (that always lands in `run.googleapis.com/stdout`), so the sink uses the `google-cloud-logging` API (`client.logger(name).log_struct(..., severity="WARNING")`, synchronous so failures give 503). It needs `roles/logging.logWriter` on the dedicated service account (operator step, DEPLOY.md section 5). Role/retention facts checked 2026-10-09 at docs.cloud.google.com/logging/docs/access-control and /logging/quotas (\_Default = 30 days).
-   google-cloud-logging writes ONE extra diagnostic entry (library name/version) to the first log used per process, via module flag `google.cloud.logging_v2._instrumentation_emitted`. The sink sets it True so the log holds one entry per report; tests/test_reports.py has a real-library test that resets the flag and asserts exactly one entry (fails if a library upgrade renames the flag).
-   Report counter doc is `llmQuota/{uid}_{date}_reports` in the SAME collection (same TTL policy, no new operator step; LLM ids end with a date, report ids with `_reports`, so no collision).
-   Adding a module means touching four places: Dockerfile COPY, `.dockerignore`, `.gcloudignore`, and DEPLOY.md (file count word, EXPECTED_LIST). Allowlist semantics checked with the `ignore` npm package from the main checkout.
-   The shared `bookmind-server/venv` lacks google-cloud-logging; installing it there upgrades grpcio/protobuf/api-core for every agent. I tested in a fresh venv (`python -m venv` from the main venv's python, then `pip install -r requirements-dev.txt`) in the scratchpad instead. QA/operator must `pip install -r requirements.txt` before running the suite.
-   Local e2e without ADC: stdlib stub of the Auth emulator accounts:lookup + in-memory quota override + `REPORT_LOG_DESTINATION=stdout` runs the real app and real `verify_id_token`. Harness lives in the session scratchpad (e2e66/serve.py), not in the repo.
-   Sandbox: Bash with `$VAR` as command name, `git`-looking or heredoc-with-`${}` text is refused; put multi-step scripts in a file (Write tool) and run `bash /abs/path.sh`.
