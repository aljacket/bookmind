---
name: card63-deletion-ux-decisions
description: Operator decisions of 2026-10-09 on the #63 account-deletion UX spec (PR #23) — in-dialog reset email, no haptics, copy approved, data export → card #72, menu 40px rows → #47
metadata:
    type: project
---

The operator decided the open points of the #63 UX spec (PR https://github.com/aljacket/bookmind/pull/23, branch docs/63-account-deletion-ux-spec, commit a066ccd) on 2026-10-09. They are recorded in design.md, UX spec §14, and in row 11 of the operator decisions table:

1. The en/it/es copy is approved as drafted (UX §12), including the 30-day IP-logs line and the other-devices line. Any later edit needs re-approval. Card #63 step 6 is ticked.
2. "Forgot password?" uses option A: `sendPasswordResetEmail` to the signed-in address from inside the dialog, and `/forgot-password` stays guestOnly. The spec scenario "Forgotten password" was rewritten and "Password-reset email cannot be sent" was added. The idle/offline/sending/sent/error states are in UX §5. It reuses the approved keys, so no new copy was needed. For too-many-requests the generic "check your connection" text was accepted for v1.
3. No haptics in #63. They belong to #45 (native feel).
4. Data export is deferred: card **#72** in Idee (https://trello.com/c/QNsK8h6D), with the GDPR art. 20 / 12(3) context verified on EUR-Lex on 2026-10-09. Whether on-device-only data falls under portability is still open for legal.
5. The AI retention line uses `{provider}`/`{days}` from the constant shared with #65, and follows #71 without new approval.

Also on that day:

-   I added a #47 checklist item: the menu rows Preferences and Reading List are 40 px tall (source "UX #63, 09/10/2026").
-   I added 2 items to #63: the in-dialog reset, and UX §13 passed by QA.
-   The ux-designer's memory now lives in the PR #23 branch.

**Why:** these settle what the app-engineer builds for #63, and the UI patterns (dialog rule, red-700, sage) become precedent for #64, #65 and #67.

**How to apply:**

-   #63 sits in "In Sviluppo" but must wait for the PR #23 merge.
-   Tick #63 step 1 once PR #23 merges.
-   #64 still has to decide its reset path for guests before sign-in. Once signed in, it reuses the dialog with option A.

See [[card44-launch-change]].
