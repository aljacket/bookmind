---
name: card57-lint
description: Card #57 (Idee, 2026-10-08) — non-mutating lint script, exclude android/ios/openspec; D1/D2 decided yes on 2026-10-08 and moved to card #58
metadata:
  type: project
---
Card #57 https://trello.com/c/4lVX0AVc was created in Idee on 2026-10-08 at the operator's request. Owner: app-engineer. It has no OpenSpec change yet.

What I measured on origin/main 5418df6 (2026-10-08):
- `eslint .` with `--ignore-pattern android/** ios/** openspec/**` and no `--fix` takes about 4 s on 39 files. Result: 0 errors and 459 warnings in 17 files.
  - prettier: 416 warnings
  - vue/attributes-order: 25, vue/first-attribute-linebreak: 15, vue/attribute-hyphenation: 2. All are fixable with `--fix`.
  - no-unused-vars: 1, for `authStore` at src/App.vue:4.
- No `.github/workflows` exists, so there is no CI. The "CI" today is the agent gate plus QA.
- The app-engineer cannot edit `.claude/agents/app-engineer.md` because `protect-control-plane.sh` blocks it. Changes to agent docs need an operator commit.

Operator decisions (2026-10-08, comment on #57): D1 yes, D2 yes. Both live in card #58 https://trello.com/c/ueBsQiwo (Idee). #58 runs after #57 merges, with In Sviluppo and Verifica QA empty. It has 3 commits: lint:fix only, then authStore (N/A if #57 fixed it), then `--max-warnings 0` on `lint`.
Re-measured on main fc6d231 (after PR #4): 452 warnings in 15 files (409 prettier, 42 vue/*, 1 authStore).
`vue/attributes-order` and `vue/attribute-hyphenation` are not whitespace-only, so `git diff -w` is not empty. #58 proves "no logic change" by re-running lint:fix on the base, esbuild-transpiling the .ts files, and checking web geometry.

**Why:** `--fix` in `npm run lint` caused the +552/−476 diff of the duplicate PR #6. The root `--ignore-path .gitignore` skips the nested android/ios .gitignore files, so ESLint lints the bundles in cap sync output.
**How to apply:** when promoting #57 or writing the D1 card, check the board for open branches first. Treat the flat-config migration (ESLint 10) as a separate card; see [[external-requirements]].
