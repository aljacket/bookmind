#!/bin/bash
# app-engineer Stop hook: do not let the agent finish while the type-check fails.
# Runs vue-tsc directly (not `npm run`), so an edited package.json script cannot neuter the gate.
# TODO: add vitest once src/views/__test__/LoginPage.spec.js is fixed (card #53; it fails on main).
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
project=$(realpath "$CLAUDE_PROJECT_DIR")
cwd=$(realpath "$(jq -r '.cwd // empty' <<<"$input")" 2>/dev/null)
# The agent's worktree must be the project or inside it; anything else fails closed.
case "$cwd" in "$project"|"$project"/*) ;; *) cwd="$project" ;; esac
cd "$cwd" || { echo "verify-app: cannot enter $cwd" >&2; exit 2; }
# Nothing changed relative to main: nothing to verify.
if git diff --quiet origin/main -- src 2>/dev/null && [ -z "$(git status --porcelain -- src)" ]; then exit 0; fi
if [ ! -x node_modules/.bin/vue-tsc ]; then
  echo "node_modules missing in $(pwd): run 'npm ci' and then the type-check before finishing." >&2; exit 2
fi
if ! out=$(node_modules/.bin/vue-tsc --build --force 2>&1); then
  echo "Type-check fails. Fix it before finishing:" >&2; echo "$out" | tail -40 >&2; exit 2
fi
exit 0
