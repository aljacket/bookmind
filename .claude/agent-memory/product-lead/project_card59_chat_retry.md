---
name: card59-chat-retry
description: Card #59 (Idee, 2026-10-08) — Preferences chat retry after /recommendations or /clarify error is dead; product decision = roll back the failed turn; backend transcript limits
metadata:
  type: project
---
Card #59 https://trello.com/c/8H2muB6N. The bug was found by QA on PR #4 and was already on main with Capacitor 6.

Cause (read on main fc6d231): `handleSubmit` increments `userTurnCount` and appends the message before the request. Only turns 1-3 are handled, and the catch blocks never roll back. After a /recommendations failure, the next Send makes the turn 4 and no request goes out.

Backend constraint: `/clarify` takes exactly 2 turns and `/recommendations` takes 2-3 (bookmind-server/main.py `Field(min_length, max_length)`). So a retry must resend the same transcript.

My product decision:
- Roll back the failed turn and restore the text into the textarea. Send then resends the same request.
- No new i18n key, because `chat_error` already says "try again". No ux-designer.
- Announce the error with role=alert or aria-live.

The 20 px skip link is out of scope. It goes to #47 (the touch-target rule) and #46 (the per-screen audit); the finding is commented on #46.

**Why:** the operator wanted a retry that works, with clear copy decided against the existing keys.
**How to apply:** if the operator questions "rollback vs a Retry button", the trade-off is that a button needs new i18n keys in 3 languages and a design for the 44 px target. See [[card57-lint]] for #58.
