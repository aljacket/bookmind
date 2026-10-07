#!/bin/bash
# Engineer agents' PreToolUse(Edit|Write|NotebookEdit): an agent must not rewrite the hooks,
# settings, agent definitions or skills that gate its own work. Its own memory stays writable.
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
# Agent worktrees live in .claude/worktrees/<name>/: judge the path relative to the worktree root.
case "$f" in */.claude/worktrees/*/*) f="/${f#*/.claude/worktrees/*/}" ;; esac
case "$f" in
  */.claude/agent-memory/*) exit 0 ;;
  */.claude/*)
    echo "Blocked: $f is Claude Code configuration that gates this agent's work. Report the change you need to the operator." >&2
    exit 2 ;;
esac
exit 0
