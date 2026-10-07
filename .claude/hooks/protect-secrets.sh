#!/bin/bash
# PreToolUse(Edit|Write): refuse to write files that hold secrets.
# Exit 2 blocks the tool call and shows the reason to Claude.
f=$(jq -r '.tool_input.file_path // empty')
name=$(basename "$f")
case "$name" in
  .env.example) exit 0 ;;
  .env|.env.*|*.pem|*.key|*.jks|*.keystore|.mcp.json|google-services.json|GoogleService-Info.plist)
    echo "Blocked: $name holds secrets and must not be written by Claude. Ask the operator to edit it." >&2
    exit 2 ;;
esac
exit 0
