---
name: external-requirements
description: Store, platform and tooling requirements verified 2026-10-07/08 with official URLs (Play target API, Apple Xcode, Capacitor migrations, Android 15/16, ESLint support)
metadata:
  type: reference
---
All verified 2026-10-07:
- Google Play: target API 36 for new apps and updates since 2026-08-31; extension possible to 2026-11-01 — https://support.google.com/googleplay/android-developer/answer/11926878
- Apple: uploads require Xcode 26 / iOS 26 SDK since 2026-04-28 — https://developer.apple.com/news/upcoming-requirements/
- Capacitor 6→7 https://capacitorjs.com/docs/updating/7-0 · 7→8 https://capacitorjs.com/docs/updating/8-0 · 8.5 UIScene https://capacitorjs.com/docs/updating/8-5
- `cap migrate` behaviour (no per-platform option, syncs all) — https://github.com/ionic-team/capacitor/blob/main/cli/src/tasks/migrate.ts
- Peer deps: `@capacitor/ios@X` requires `@capacitor/core ^X`. npm tags: latest 8.5.3, latest-7 7.6.9, next 9.0.0-alpha.8.
- System Bars https://capacitorjs.com/docs/apis/system-bars · SPM https://capacitorjs.com/docs/ios/spm
- CocoaPods trunk read-only from 2026-12-02 — https://blog.cocoapods.org/CocoaPods-Specs-Repo/
- Android 15 https://developer.android.com/about/versions/15/behavior-changes-15 · Android 16 https://developer.android.com/about/versions/16/behavior-changes-16

- ESLint (verified 2026-10-08): v8 EOL 2024-10-05, v9 EOL 2026-08-06, v10 is Current and drops eslintrc, needs Node >= 20.19 — https://eslint.org/version-support/ · https://eslint.org/docs/latest/use/migrate-to-10.0.0 · in v8, --ignore-path replaces .eslintignore — https://eslint.org/docs/v8.x/use/configure/ignore · v8 CLI --max-warnings (exit 1 above threshold, default -1) — https://eslint.org/docs/v8.x/use/command-line-interface

Related: [[operator-decisions-2026-10-07]], [[card57-lint]].
