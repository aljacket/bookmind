#!/bin/bash
# PreToolUse(Edit|Write|NotebookEdit) for restricted agents: allow writes only under the given
# project-relative prefixes. Anything outside the project, or containing '..', is refused.
# Usage: allow-writes-only.sh <agent-name> <prefix>...   e.g. product-lead openspec/ docs/
agent=$1; shift
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
case "$f" in *'/../'*|*'/..'|'../'*|'..') echo "Blocked: path traversal in $f" >&2; exit 2 ;; esac
root=$(cd "$CLAUDE_PROJECT_DIR" && pwd -P)
case "$f" in
  "$CLAUDE_PROJECT_DIR"/*) rel=${f#"$CLAUDE_PROJECT_DIR"/} ;;
  "$root"/*) rel=${f#"$root"/} ;;
  *) echo "Blocked: $f is outside the project" >&2; exit 2 ;;
esac
for prefix in "$@"; do
  case "$rel" in "$prefix"*) exit 0 ;; esac
done
echo "Blocked: $agent may only write under: $*" >&2
exit 2
