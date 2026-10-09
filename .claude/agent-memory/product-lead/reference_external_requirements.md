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

- Store/launch (verified 2026-10-09, full table in openspec/changes/account-deletion-and-launch/design.md "Sources"):
  - Play account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
  - Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
  - User Data (policy link in Console and in the app, no PDF): https://support.google.com/googleplay/android-developer/answer/10144311
  - AI-Generated Content (in-app reporting): https://support.google.com/googleplay/android-developer/answer/13985936
  - App access: https://support.google.com/googleplay/android-developer/answer/15748846
  - Personal accounts created after 2023-11-13 need 12 testers for 14 days: https://support.google.com/googleplay/android-developer/answer/14151465
  - Listing assets (512 icon, 1024x500 feature graphic, >=2 screenshots): https://support.google.com/googleplay/android-developer/answer/9866151
  - AAB required since Aug 2021: https://developer.android.com/guide/app-bundle
  - Apple 5.1.1(i)/(v), 5.1.2(i) (third-party AI consent), 4.8, 2.4.1: https://developer.apple.com/app-store/review/guidelines/
  - Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
  - GCP free tier (needs a billing account): https://docs.cloud.google.com/free/docs/free-cloud-features
  - Blaze is needed for Cloud Run and Secret Manager: https://firebase.google.com/pricing
  - Firestore TTL (~24h after expiry): https://firebase.google.com/docs/firestore/ttl
  - Logging _Default retention 30 days: https://docs.cloud.google.com/logging/quotas
  - OpenAI API retention 30 days, ZDR: https://developers.openai.com/api/docs/guides/your-data
  - gpt-4o-mini not deprecated: https://developers.openai.com/api/docs/deprecations
  - cloud.google.com/run/pricing did not render in WebFetch; use the free-tier page instead.
- LLM providers and launch ops (verified 2026-10-09; full table in the change's design.md "Sources"):
  - OpenAI pricing: gpt-4o-mini $0.15/$0.60 per 1M tokens. Regional endpoints +10% for models released on or after 2026-03-05. https://developers.openai.com/api/docs/pricing
  - OpenRouter: `provider.{only,allow_fallbacks,data_collection,zdr,require_parameters}` https://openrouter.ai/docs/features/provider-routing · OpenRouter keeps no prompts unless you opt in https://openrouter.ai/docs/features/zdr · no inference markup, 5.5% Stripe credit fee, metadata only https://openrouter.ai/docs/faq
  - HF Inference Providers: OpenAI-compatible router.huggingface.co/v1, `model:provider` suffix https://huggingface.co/docs/inference-providers/index · bodies not stored, 30-day logs https://huggingface.co/docs/inference-providers/en/security · free users have no credits, PRO $2/mo https://huggingface.co/docs/inference-providers/pricing
  - Firestore europe-west1 is supported and the location is permanent https://firebase.google.com/docs/firestore/locations
  - Cloud Run `--min` (default 0) and `--max` https://docs.cloud.google.com/run/docs/configuring/min-instances · .../max-instances
  - Budgets are alerts only. Spend caps (which do support Cloud Run) are a separate feature; at the cap, Cloud Run serves 5xx https://docs.cloud.google.com/billing/docs/how-to/budgets · .../budgets-spend-caps
  - Play countries: testing tracks are synced with production by default; internal testing is not country-targeted https://support.google.com/googleplay/android-developer/answer/7550024 · listing graphics fall back to the default language https://support.google.com/googleplay/android-developer/answer/9844778 · Data safety is one global form per package (answer/10787469)

Related: [[operator-decisions-2026-10-07]], [[card44-launch-change]], [[card57-lint]].
