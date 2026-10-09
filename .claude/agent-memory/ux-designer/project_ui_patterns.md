---
name: project-ui-patterns
description: BookMind UI patterns the ux-designer has specified (dialog presentation rule, destructive/success colours, error box, menu danger zone) and their approval status
metadata:
    type: project
---

Patterns specified for card #63 (PR #23, 2026-10-09). On 2026-10-09 the operator resolved the spec's open points (copy approved, in-dialog reset email, no haptics in #63 — haptics belong to #45, data export is a separate Idee card) and did not object to these patterns. They are settled once PR #23 is merged; check the merged design.md (UX spec sections 5, 10, 14) if in doubt.

-   **Dialog presentation**: full-screen when width < 600 **or** height < 480 (landscape phones count as compact height). Otherwise a centred modal, `min(560px, 100vw-48px)`, rounded-2xl, scrim ink-900/50. Teleport to body at `z-[60]`, because the menu is z-40 and the hamburger is z-50.
-   **Destructive colour**: Tailwind default `red-700` (bg or text). No custom `danger` token, because the app already uses the default red scale for errors.
-   **Success colour**: the `sage` scale (sage-50 bg, sage-200 border, sage-800 text).
-   **Error display**: a `role="alert"` box that is always mounted (the `PreferencesPage.vue` pattern from #59/#62), with an action button of at least 44 px.
-   **Menu "danger zone"**: its own card below Logout, separated by a 24 px gap, with 48 px rows. #65's "Withdraw AI consent" sits above "Delete account" in that card.
-   **Copy tone**: destructive and legal flows are plain and serious. The chat's playful voice is not used there.

**Why:** these keep later cards consistent (#64 `/delete-account`, #65 consent panel, #67 report picker), so they are not re-decided each time.
**How to apply:** reuse these rules in new specs. Once the operator approves or changes them, update this file and drop the "proposed" note.
