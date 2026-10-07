#!/bin/bash
# PreToolUse(Edit|Write|NotebookEdit) for restricted agents: allow writes only to paths matching
# the extended regex in $1 (e.g. '/(openspec|docs)/'). Paths containing '..' are always refused.
# Usage: allow-writes-only.sh <regex> <agent-name>
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
case "$f" in *'/../'*|*'/..'|'../'*|'..') echo "Blocked: path traversal in $f" >&2; exit 2 ;; esac
printf '%s' "$f" | grep -qE "$1" && exit 0
echo "Blocked: $2 may only write to paths matching $1" >&2
exit 2
