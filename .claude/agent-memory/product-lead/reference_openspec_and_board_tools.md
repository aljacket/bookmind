---
name: openspec-and-board-tools
description: OpenSpec CLI conventions in this repo and limits of the Trello board script
metadata:
  type: reference
---
- OpenSpec CLI 1.4.1, schema spec-driven; openspec/config.yaml has no context or rules.
- `openspec validate <change> --strict`; `openspec list` counts `- [ ]` lines; `openspec show <change> --json --deltas-only`.
- Delta format: `## ADDED|MODIFIED|REMOVED Requirements` → `### Requirement:` with SHALL → `#### Scenario:` with WHEN/THEN.
- Archive path: `openspec/changes/archive/YYYY-MM-DD-<name>/`. Do not put temporary constraints in spec deltas.
- A PostToolUse hook runs prettier on .md after Write/Edit (rewrites checkboxes harmlessly).
- `npm run trello` cannot rename checklist items; the main session can via the Trello REST API.
- `npm run trello` has no attachment support. Attachments work with a throwaway node script in the scratchpad: multipart POST to `/1/cards/<shortLink>/attachments`, credentials read from `.mcp.json` (`mcpServers.trello.env`) and never printed. Delete the script afterwards. Done for #56 on 2026-10-08.
- The product-lead Write/Edit hook blocks paths outside openspec/, docs/ and agent memory, scratchpad included. Write temp card files (desc, checklist) with a Bash heredoc in the scratchpad.
- Idee cards carry no OpenSpec change (e.g. #53, #56). The change is written when the card is promoted to Pronto.
- `npm run trello` cannot add checklist items to an existing card. Done on 2026-10-09 with a throwaway scratchpad node script (POST `/checklists/<id>/checkItems`, creds from `.mcp.json`, never printed), deleted afterwards.
- `npm run trello -- <n>` still reads archived cards (e.g. #51), and shows the list they were in when archived.
