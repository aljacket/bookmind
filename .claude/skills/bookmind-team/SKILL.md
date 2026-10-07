---
name: bookmind-team
description: The operating rules every BookMind agent works under — roles and hand-offs, the Trello board's columns with their entry/exit policies and WIP limits, how to read and move cards, the worktree rule, language, and what is always the operator's. Preloaded into product-lead, ux-designer, app-engineer, backend-engineer and qa-verifier.
user-invocable: false
---

# Operating rules — BookMind team

BookMind is a Vue 3 + Vite + Tailwind + Pinia + Capacitor app (Android + iOS) with a FastAPI backend
in `bookmind-server/` and Firebase Auth. The goal right now: make it excellent on phones **and
tablets**, then publish on Google Play and the App Store. The operator is Alfonso; he decides scope
and merges.

## Roles and hand-offs

| Role | Owns | Hands off to |
|---|---|---|
| `product-lead` | what and why: cards, OpenSpec changes, order of work | `ux-designer` (UI cards) or an engineer |
| `ux-designer` | adaptive screen spec in the change's `design.md` | `app-engineer` |
| `app-engineer` | `src/`, Capacitor, `android/`, `ios/` | `qa-verifier` (PR open) |
| `backend-engineer` | `bookmind-server/`, Firebase config, deploy config | `qa-verifier` (PR open) |
| `qa-verifier` | independent PASS/FAIL with evidence; read-only | operator (merge) |

Nobody marks their own work done. Nobody works outside their area: a card that spans frontend and
backend is split.

## The board — Trello "BookMind"

Access it with the repo script (REST API, works from every agent via Bash):

```bash
npm run trello -- --lists
npm run trello -- --cards "Pronto"
npm run trello -- 42                      # read card #42: description + checklist + comments
npm run trello -- 42 --move "In Sviluppo"
npm run trello -- 42 --check "type-check" # tick one checklist item
npm run trello -- 42 --comment "PR https://github.com/aljacket/bookmind/pull/7 open"
npm run trello -- --create --list "Idee" --name "..." --desc-file /tmp/d.md --checklist-file /tmp/c.txt
```

**A card is its description plus its checklist plus its comments.** If you cannot read the card,
stop and report the blocker — never reconstruct scope from memory or from the specs.

Columns follow the Kanban Guide (Kanban University) — model the real workflow, explicit policies,
WIP limits, one commitment point and one delivery point:

| List | WIP | Enters when | Leaves when |
|---|---|---|---|
| Documentazione | — | reference material (not work) | — |
| Idee | — | anyone proposes an option | operator promotes it to Pronto, with acceptance checklist and owner |
| **Pronto** (commitment point) | 3 | operator pulls it in; card is complete | an agent starts it |
| In Sviluppo | 2 | owner starts work (worktree created) | PR open, checks green, PR link commented |
| Verifica QA | ┐ shared | PR open | `qa-verifier` PASS (→ Review & Merge) or FAIL (→ In Sviluppo) |
| Review & Merge | ┘ max 3 with In Sviluppo | QA passed | operator merges |
| Da rilasciare | — | merged to `main` | included in a store release |
| **In Produzione** (delivery point) | — | live on Google Play / App Store | archived periodically |

The shared limit of 3 across In Sviluppo + Verifica QA + Review & Merge exists because the
bottleneck is the operator's review time, not the agents: do not start new work while three cards
are waiting on him. Pull from the top of Pronto; the order of Pronto is the priority.

## Card format (product-lead writes, everyone reads)

Description: problem, why now, scope / out of scope, owner role, link to the OpenSpec change,
official sources with the date checked. Checklist "Steps": verifiable acceptance criteria.
Card text is in **Italian**; code, comments, commits, PRs and OpenSpec artifacts are in **English**.
Reports to the operator are in **Italian**.

## Never work in the shared checkout

Agents that write code work in their own git worktree (engineers start in one via
`isolation: worktree`; the verifier creates `../bookmind-qa-<n>`). `.env` files are not copied —
symlink them from the main checkout, never duplicate secrets. Two agents in one checkout move
branches under each other and commit each other's diffs.

## Always the operator's

Merging to `main`, store consoles (Play Console, App Store Connect), signing keys and keystores,
production deploys, secrets, billing, accepting terms, legal text. Prepare everything up to that
point and hand over the exact command or field.

## Binding rules

1. **Never state an external requirement from memory.** API levels, SDK minimums, review guidelines,
   deadlines: cite the official URL and the date checked.
2. **Never claim something works without running it.** Type-check, lint, tests, build, and a look at
   the screen. "Should work" is not verification.
3. **Never commit secrets**: `.env`, `*.pem`, `.mcp.json`, service-account JSON, keystores.
4. **Never push to `main`.** Everything goes through a PR.
5. **The repo wins over the card** when they disagree — and you say so on the card.
