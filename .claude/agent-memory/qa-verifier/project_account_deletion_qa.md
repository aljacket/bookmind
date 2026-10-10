---
name: account-deletion-qa
description: Card #63 (in-app account deletion, PR #26) QA history - two FAIL rounds then PASS on 2026-10-11 at 76274d5; what was judged acceptable, leftovers for ux/#55, step 8 for the operator
metadata:
    type: project
---

History of PR #26:

-   **Round 1** (091ae02): FAIL. The Pixel 9 landscape IME (108 px) clipped the field and Delete, and Back during "in progress" closed the app.
-   **Round 2** (b3dca66): FAIL. The app-wide Back handler did `history.back`, so Back looped `/processing` ↔ Home. On main, Back always exits the app.
-   **Round 3** (76274d5, 2026-10-11): **PASS**, card moved to Review & Merge, step 9 ticked. Back exits on the first press from every route. The dialog's Back closes it when idle and is ignored while the deletion is in progress. The "tight" layout applies below 300 px only: at 870×336 the spec's sticky bars are back; at 108 px the field is visible, Delete is one swipe away, and Go submits.

Judgements I made:

-   "field visible, Delete one scroll away, Go submits" meets the intent of §13 at 108 px. ux should reword that §13 item.
-   At 870×336 with 200 % text, Cancel shows 71 of 96 px. Not blocking.

Leftovers:

-   #55 must run `npx cap sync ios` to add `pod 'CapacitorApp'`.
-   Spec gaps: an offline relaunch after an interrupted deletion clears the marker without wiping; Android `navigator.onLine` is always true (manifest has no ACCESS_NETWORK_STATE).
-   Step 8 (Firebase Console) is the operator's.

**Why:** a likely follow-up QA round (#64 reuses the dialog body; #65 adds the consent row to the same menu card).
**How to apply:** re-run the Back loop test (procloop) and the Pixel 9 landscape IME probe on any change to the dialog or to `services/backButton.ts`. The Pixel 9 AVD has the main APK installed.

Related: [[firebase-auth-stub-cdp]], [[keyboard-composer-preexisting]]
