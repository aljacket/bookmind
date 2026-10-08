---
name: card56-tablet-keyboard
description: Card #56 (Idee) — chat textarea hidden by keyboard on tablet landscape, pre-existing defect split out of #50 by operator decision on 2026-10-08
metadata:
  type: project
---
On 2026-10-08 the operator moved QA defect 2 of #50 out of #50 into card #56 (Idee, https://trello.com/c/n48v6t5b). Defect: on Pixel_Tablet_API_36 landscape, PreferencesPage textarea is fully under the keyboard (viewport 408 px, textarea 555–621 px) until the first character is typed. Same on main with Capacitor 6. Defect 1 (phone, Send hidden from turn 2) stays in #50 / PR #4.

**Why:** pre-existing and not caused by the upgrade, and #50 is store-blocking, so the operator did not let it grow.
**How to apply:** #56 starts only after #50 merges. Step 2 is a QA re-check on main, because the defect-1 fix may already cover the tablet. Write the OpenSpec change (likely a MODIFIED keyboard scenario in `native-shell`) only if the defect still reproduces. The attached screenshots show the state *after* typing, not the hidden state. Related: [[operator-decisions-2026-10-07]].
