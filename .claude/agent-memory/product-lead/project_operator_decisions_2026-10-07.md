---
name: operator-decisions-2026-10-07
description: Operator decisions of 2026-10-07 on card #50 (Capacitor 8) — Android only, iOS to #55, SPM, no Play extension, back button to #45
metadata:
  type: project
---
Decisions taken by the operator on 2026-10-07:
1. Card #50 (Capacitor 6 → 8) is Android only. iOS moves to card #55 (in Idee). Xcode is not installed and is postponed.
2. iOS will use Swift Package Manager: delete ios/ + `npx cap add ios --packagemanager SPM` (ios/ was never hand-edited; only commit d7d3fc0).
3. No Google Play target-API extension: no app has ever been submitted to Play.
4. Operator updated Android Studio (2026.2) and installed SDK Platform 36 + cmdline-tools on 2026-10-07.
5. Android back button / @capacitor/app → card #45, not #50.

Derived decision D3 (in openspec/changes/capacitor-8-upgrade/design.md): @capacitor/ios bumped to ^8.5.3 in lockstep with the other three packages; the iOS changes made by `cap migrate` are reverted (`git diff --exit-code <base> -- ios` is a quality gate); ios/ stays uncompilable until #55.

**Why:** focus on the Play deadline (target API 36) first; iOS needs Xcode the operator does not have yet.
**How to apply:** #55 needs its own OpenSpec change that ADDs iOS requirements to the native-shell capability after the #50 change is archived. See [[mac-toolchain]] and [[external-requirements]].
