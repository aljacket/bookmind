#!/bin/bash
# PreToolUse(Edit|Write|NotebookEdit): refuse to write files that hold secrets.
# Exit 2 blocks the tool call and shows the reason to Claude.
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
name=$(basename "$f")
case "$name" in
  .env.example) exit 0 ;;
  .env|.env.*|.envrc|*.pem|*.key|*.p12|*.pfx|*.jks|*.keystore|*.mobileprovision|id_rsa*|id_ed25519*|.npmrc|.netrc|.mcp.json|credentials.json|serviceAccountKey*.json|google-services.json|GoogleService-Info.plist)
    echo "Blocked: $name holds secrets and must not be written by Claude. Ask the operator to edit it." >&2
    exit 2 ;;
esac
exit 0
