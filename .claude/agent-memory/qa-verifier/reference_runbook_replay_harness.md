---
name: runbook-replay-harness
description: How to prove an operator runbook (DEPLOY.md) works when pasted into the operator's zsh and that its guards stop deploys - expect + bracketed paste + stub CLIs, three scenarios; card #61 round 2 PASS (2026-10-09)
metadata:
    type: reference
---

Card #61 round 2 (head eb7818b, 2026-10-09): PASS, moved to Review & Merge. Round 1 had FAILed on revision-level scaling, the denylist ignore files, trailing `#` comments under zsh and guards that did not stop anything.

-   **Stubs** (`zr/stubs.zsh` in the scratchpad): zsh functions `gcloud`, `firebase`, `npm` and `curl` that append their arguments to `$HOME/calls.log`.
    -   They return canned output for `meta list-files-for-upload` (an env flag adds `key.json`), `--format export` (a sample YAML) and `value(status.url)`.
    -   With `--data-file=-` they consume stdin and log only its length.
    -   A `python3 -` stub returns a fake token. The repo copy also gets a fake `venv/bin/python`.
-   **Driver**: a Python generator writes an `expect` script that:
    -   spawns `zsh -f -i` (the operator's `interactivecomments` is OFF);
    -   sources the stubs;
    -   pastes each extracted block with bracketed paste (`\033[200~ ... \033[201~\r`);
    -   answers `read` prompts with a regex anchored on `\n`. Without the anchor, expect matches the echoed paste buffer and types the "hidden" value early, so it gets echoed.
    -   Marker lines must not start with `=` (zsh equals expansion).
-   **Scenarios**: run each in an rsync copy of the worktree with `HOME` set to a temporary dir.

    -   placeholders left: every guard must print STOP and `calls.log` must have no deploy;
    -   all filled: exactly one `run deploy --min 0 --max 2` and one `firebase deploy --only hosting`;
    -   bad upload list: STOP.

    Then diff `git status` before and after (stray files) and grep the transcript for the fake secrets.

-   **Cloud Run scaling annotations** (documented, checked 2026-10-09):
    -   service level: `run.googleapis.com/maxScale` / `minScale` in the Service `metadata.annotations`;
    -   revision level: `autoscaling.knative.dev/*` in `spec.template.metadata.annotations`;
    -   the human-readable cross-check is `Scaling: Auto (Min, Max)` in `services describe`.
-   **Open observation (not blocking)**: the setup blocks without a guard pass no `--project`, so they act on whatever project gcloud currently has selected if the operator ignores the STOP in section 1.

**Reused on #73 (2026-10-10).** Write a minimal version in about 5 minutes:

- extract the blocks with awk;
- `gen.py` writes the `.exp` file, pasting the exports, the env heredoc and the guarded deploy;
- the only stub is `gcloud`;
- the scenarios are placeholder, filled and stale `REPLACE_`.

Then parse the generated YAML with `yaml.safe_load`. A run takes about 2 minutes, so put it in the background.

Related: [[deploy-config-qa-recipe]], [[backend-qa-recipe]]
