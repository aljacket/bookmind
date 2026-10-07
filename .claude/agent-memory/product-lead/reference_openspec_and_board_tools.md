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
