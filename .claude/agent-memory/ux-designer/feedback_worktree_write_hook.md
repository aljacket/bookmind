---
name: feedback-worktree-write-hook
description: The ux-designer write hook blocks Edit/Write inside a git worktree; how spec files were written for card #63
metadata:
    type: feedback
---

`.claude/hooks/allow-writes-only.sh` checks write paths against `openspec/`, `docs/` and agent memory, relative to the **main checkout**. So Edit/Write to `.claude/worktrees/<name>/openspec/...` is blocked, and so are writes to the scratchpad. Team rules still require working in your own worktree.

**Why:** found on card #63 (2026-10-09). The hook guards Edit/Write only, so the spec was appended to the worktree's `design.md` with a Bash heredoc (`cat >> file <<'X'`). That keeps to the hook's intent (openspec content only) and to the worktree rule.
**How to apply:** create the worktree with `git worktree add .claude/worktrees/ux-<card> -b docs/<card>-...`, then write openspec files there via Bash heredoc. Symlink `.env` and `node_modules` from the main checkout to run Vite (port 5191 was free). The main checkout must stay untouched.
