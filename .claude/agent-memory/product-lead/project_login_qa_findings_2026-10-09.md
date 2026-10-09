---
name: login-qa-findings-2026-10-09
description: Where the /login QA findings from card #51 (09/10/2026) were filed on #46/#47, and why meta description / robots.txt were left out
metadata:
  type: project
---
Operator asked (2026-10-09) to file the /login findings from #51's last comment into existing cards, no new cards, no moves.

- #47 (design system): contrast of link color = token primary-600 `#d4620e` in tailwind.config.js (3.78:1 on white); text-link touch targets ≥44 px (also covers "Just show me the books" on /preferences, already noted on #46).
- #46 (audit): /login language select without accessible name; no `<main>` on Login/Register/ForgotPassword (exists only in Home, Preferences, ReadingList); login logo 285×197 px too small for DPR 3 (logo is also the LCP element).
- Left out, reported to operator: meta description and robots.txt — web/SEO only, irrelevant to the Capacitor app; repo has no firebase.json / web hosting (checked 2026-10-09).

**Why:** design-token / shared-component fixes belong to #47; per-screen defects to #46.
**How to apply:** if web hosting is ever added, the SEO items need their own card. /login Lighthouse baseline (A11y 82, BP 96, SEO 83, LCP 4924 ms dev) is in the #46 comment for comparison.
