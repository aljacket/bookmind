---
name: project-ui-patterns
description: BookMind UI patterns the ux-designer has specified (dialog vs bottom-sheet rule, inline report action, destructive/success colours, error box, menu danger zone) and their approval status
metadata:
    type: project
---

Patterns from card #63 (merged, PR #26, operator resolved its open points on 2026-10-09):

-   **Dialog presentation**: full-screen when width < 600 **or** height < 480 (landscape phones count as compact height). Otherwise a centred modal, `min(560px, 100vw-48px)`, rounded-2xl, scrim ink-900/50. Teleport to body at `z-[60]`, because the menu is z-40 and the hamburger is z-50. Implemented in `DeleteAccountDialog.vue` (inert on `#app`, matchMedia, useBackButton, keyboard inset).
-   **Destructive colour**: Tailwind default `red-700`. No custom `danger` token.
-   **Success colour**: the `sage` scale (sage-50 bg, sage-200 border, sage-700/800 text).
-   **Error display**: an always-mounted `role="alert"` box (the `PreferencesPage.vue` pattern), with an action button of at least 44 px.
-   **Menu "danger zone"**: its own card below Logout, 24 px gap, 48 px rows. #65's "Withdraw AI consent" sits above "Delete account".
-   **Copy tone**: destructive, legal and trust/safety flows are plain and calm. The chat's playful voice is not used there.

Patterns added by card #67 (spec 2026-10-12, branch `feat/card-67-ai-content-reporting`, not yet merged):

-   **Short choice without a text field** (e.g. report reasons): modal **bottom sheet** when width < 600 or height < 480, max width 640 px, inset by safe-left/right, no drag handle until #45; centred 480 px dialog otherwise. Long or form-like content still uses the #63 full-screen rule.
-   **Inline secondary action under content** ("Report"): text button, 16 px icon + `text-sm text-ink-600`, `min-h-11 min-w-11`, `-ml-2` on cards so the icon aligns with the text edge. After success it becomes a non-interactive sage "done" marker of the same height.
-   **Radio rows**: whole `<label>` row is the target, `min-h-14`, `accent-ink-900`, selected `border-ink-900 bg-ink-50`, no preselection for reports.

**Why:** these keep later cards consistent, so they are not re-decided each time.
**How to apply:** reuse these rules in new specs. When #67 merges, drop the "not yet merged" note. Known gap noted on #67: Home heart and reading-list star/heart buttons are 20×20 px (below 44), not yet a card.
