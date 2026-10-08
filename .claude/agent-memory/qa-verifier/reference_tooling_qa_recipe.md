---
name: tooling-qa-recipe
description: How to verify BookMind tooling-only PRs (lint/scripts/config) fast - ESLint JSON tally, probe files, non-mutation proof, mutating commands in a throwaway copy, main baseline worktree; ~15 min total (card #57, 2026-10-08)
metadata:
    type: reference
---

Worked for card #57 (lint scripts, 2026-10-08), whole round ~15 min, no emulator needed:

-   **Rule/file tally**: `npx eslint . --ext <exts> --ignore-path .gitignore -f json > out.json`, then a small `node -e` that counts `ruleId`s, errors and lists `filePath`s (proves which paths are linted/excluded better than timing).
-   **Exclusions**: drop the same error probe (`if (x = 2) {}`, gives `no-cond-assign`/`no-constant-condition`/`no-empty` as errors) as `.ts` and `.js` in each excluded dir, run `npm run lint`, expect exit 0; the same probe in `src/` is the control (exit 1). `mkdir -p` creates dirs that did not exist in the worktree (e.g. `bookmind-server/venv`): rmdir them afterwards.
-   **Non-mutation**: `git status --porcelain` + `git diff | shasum` before/after, plus `touch marker; ...; find . -path ./node_modules -prune -o -newer marker -print` (catches ignored-file writes that git status misses).
-   **Mutating commands (`lint:fix`, formatters)**: `rsync -a --exclude node_modules --exclude .env` the worktree into the scratchpad, symlink `node_modules`, run there, shasum probes and the synced `android/app/src/main/assets/public` before/after. Never in the QA worktree.
-   **Main baseline**: second detached worktree on `origin/main` with `node_modules` symlinked from the PR worktree (same deps unless package-lock changed); remove the symlink before `git worktree remove`.
-   **Boot sanity**: `npx vite preview --port 4175 --strictPort` in background (4173/4174 may be taken by other sessions); first `new_page` can race the server (ERR_CONNECTION_REFUSED) — just retry. Fake user via Pinia as in [[android-qa-environment]].
-   `.claude/` edits by agents get reformatted by the `format-file.sh` hook (YAML frontmatter too), which is why item "no reformatting" checks need `git diff --numstat` + `git diff --check`.
