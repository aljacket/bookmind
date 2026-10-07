#!/bin/bash
# app-engineer Stop hook: do not let the agent finish while the type-check fails.
# TODO: add `npx vitest run` once src/views/__test__/LoginPage.spec.js is fixed (it fails on main).
input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
cwd=$(jq -r '.cwd // empty' <<<"$input"); cd "${cwd:-$CLAUDE_PROJECT_DIR}" || exit 0
# Nothing changed relative to main: nothing to verify.
if git diff --quiet origin/main -- src 2>/dev/null && [ -z "$(git status --porcelain -- src)" ]; then exit 0; fi
if [ ! -d node_modules ]; then
  echo "node_modules missing in $(pwd): run 'npm ci' and then 'npm run type-check' before finishing." >&2; exit 2
fi
if ! out=$(npm run -s type-check 2>&1); then
  echo "Type-check fails. Fix it before finishing:" >&2; echo "$out" | tail -40 >&2; exit 2
fi
exit 0
