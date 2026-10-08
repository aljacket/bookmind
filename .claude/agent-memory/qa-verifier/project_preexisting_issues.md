---
name: keyboard-composer-preexisting
description: BookMind Preferences chat/composer findings from card #50 QA (2026-10-08) - what is pre-existing on main vs regression, plus the h-dvh fix's clipping regression to re-test on any composer change
metadata:
    type: project
---

Found on 2026-10-08 (card #50 QA, two rounds):

-   Pre-existing on `main` (Capacitor 6 too): phone portrait, from turn 2, Send under the keyboard after tapping the textarea (fixed in PR #4 by `h-dvh` + `min-h-0`); tablet landscape textarea under the keyboard until the first keystroke (card #56, which no longer reproduces with PR #4's `h-dvh` except in the error state).
-   **Regression introduced by PR #4's `h-dvh` fix (round-2 FAIL)**: the root is fixed to the viewport and the card is `overflow-hidden`, so when header + AI note + composer don't fit, Send, the "Just show me the books" link and even the textarea get clipped with no page scroll. Seen in phone landscape (870x336 keyboard closed, 108 keyboard open), 640x360, 360x300, tablet landscape + keyboard + error box, and at 200 % text even in 360x640 portrait. `main` scrolls in all of these.
-   Round 3 (dce041f, PASS → Review & Merge): layout `min-h-dvh` root + card `grow shrink-0 overflow-hidden` + log `grow basis-0 min-h-[7rem]` fixed the clipping (the page scrolls when needed). Accepted compromise, logged on #56: on tablet landscape with the keyboard open Send is only 9 px visible right after the tap (399-447 in 408); one swipe reveals it. The spec scenario "Chat input stays reachable with the keyboard open" has WHEN = phone emulator only; its THEN says "visible".
-   With the keyboard open the chat log is tiny (143 px phone, 33 px tablet landscape) and may hide the latest question. The spec says nothing about it: observation only.
-   Pre-existing, not #50: touch targets < 44 px (skip link 20 px high, Toggle menu 40x56, back link 24x24, heart 20x20, login text links 20 px, menu links 40 px; card #47 territory). Root font 200 % at 360 px → ~12 px horizontal overflow on every route. After a failed `/recommendations` call a retry Send sent nothing (fixed by card #59 / PR #13, merged 2026-10-08). SystemBars logs `Error injecting safe area CSS ... 'style'` at cold start.
-   Lint/test on main were fixed by PR #8 (airbnb-base removed) and #7 (LoginPage spec): run ESLint **without --fix** with `--ignore-pattern 'android/**' --ignore-pattern 'ios/**' --ignore-pattern 'openspec/**'` (otherwise it hangs on synced web assets). Baseline on 2026-10-08 was 0 errors / 452 warnings. Card #57 / PR #12 (QA PASS, merged 2026-10-08 as 5048014) makes `npm run lint` verify-only with `ignorePatterns` for android/ios/openspec (451 warnings, ~2.7 s) and adds `lint:fix`: plain `npm run lint` is now safe.

**Why:** the operator judges regressions and pre-existing bugs differently, and the engineer's own check (only tall portrait viewports, short chats) missed the clipping.
**How to apply:** for any Preferences/composer layout change, always test phone landscape with the keyboard closed and open, 200 % text, the error state and long chats, side by side with `main`.
