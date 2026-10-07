#!/bin/bash
# PostToolUse(Edit|Write): eslint --fix + prettier on the file Claude just wrote.
# Never blocks: formatting problems are reported, not enforced.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$f" ] && [ -f "$f" ] || exit 0
bin="$CLAUDE_PROJECT_DIR/node_modules/.bin"
case "$f" in
  */node_modules/*|*/dist/*|*/android/*|*/ios/*) exit 0 ;;
  *.vue|*.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs|*.mts|*.cts)
    (cd "$CLAUDE_PROJECT_DIR" && "$bin/eslint" --fix --no-error-on-unmatched-pattern "$f") >/dev/null 2>&1
    "$bin/prettier" --write --ignore-unknown "$f" >/dev/null 2>&1 ;;
  *.json|*.css|*.html|*.md|*.yaml|*.yml)
    "$bin/prettier" --write --ignore-unknown "$f" >/dev/null 2>&1 ;;
esac
exit 0
