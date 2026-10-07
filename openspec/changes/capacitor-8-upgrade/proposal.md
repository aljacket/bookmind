## Why

BookMind cannot be submitted to Google Play in its current state. The Android shell targets API 34 on Capacitor 6.1.2, and Google Play has required **API 36 for new apps and app updates since 31 Aug 2026**. Capacitor 6 cannot target API 36; Capacitor 8 is the first major that sets compile/target SDK 36. Moving to API 36 also turns on Android 16 behaviour (enforced edge-to-edge with no opt-out, orientation locks ignored on tablets, predictive back), so the web layout has to start respecting safe areas in the same change.

**Scope is Android only** (operator decision, 2026-10-07). Xcode is not installed on the operator's Mac and its installation is postponed. The iOS half of the Capacitor 8 upgrade (Xcode 26, regenerating `ios/` with Swift Package Manager, the UIScene lifecycle, iPhone/iPad safe-area verification) is card #55 and will get its own OpenSpec change. This change keeps the `ios/` tree untouched (design.md D3).

No Play target-API extension is needed: no build of BookMind has ever been submitted to Google Play, so the first upload will already target API 36 (operator, 2026-10-07).

Sources, all checked 2026-10-07:

-   Google Play target API level: https://support.google.com/googleplay/android-developer/answer/11926878
-   Capacitor 6 → 7: https://capacitorjs.com/docs/updating/7-0
-   Capacitor 7 → 8: https://capacitorjs.com/docs/updating/8-0
-   Android 15 behaviour changes (targetSdk 35): https://developer.android.com/about/versions/15/behavior-changes-15
-   Android 16 behaviour changes (targetSdk 36): https://developer.android.com/about/versions/16/behavior-changes-16
-   Capacitor System Bars: https://capacitorjs.com/docs/apis/system-bars

## What Changes

-   **BREAKING (toolchain)**: upgrade `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` and `@capacitor/cli` from `^6.1.2` to `^8.5.3`, going through Capacitor 7 (`latest-7` = 7.6.9) as a verified intermediate checkpoint. 7.x is never shipped. `@capacitor/ios` is bumped in lockstep only to keep npm's peer dependencies valid; the iOS native project is **not** migrated here (design.md D3).
-   **Android**: migrate the existing `android/` project in place. compileSdk/targetSdk go from 34 to 36, minSdk from 22 to 24, AGP from 8.2.1 to 8.13.0, the Gradle wrapper from 8.2.1 to 8.14.3, google-services from 4.4.0 to 4.4.4, and the Java toolchain to JDK 21. `navigation|density` is added to the activity's `configChanges`. Gradle property syntax moves to `=`. The custom `network_security_config.xml` is kept.
-   **iOS**: **no change in this PR**. `ios/` stays byte-identical to `main` (still the Capacitor 6 CocoaPods project) and is temporarily out of sync with the Capacitor 8 npm packages, so it is not buildable until card #55 regenerates it with SPM. Any edits `npx cap migrate` makes under `ios/` are reverted.
-   **Edge-to-edge / safe areas** (web layer, consumed by the Android WebView now and by iOS in #55): configure the System Bars core plugin (`insetsHandling: "css"`, `style: "LIGHT"` for dark icons on our light UI) and add `viewport-fit=cover`. Safe-area insets are applied to the shared layout pieces and the one screen without a footer: `Header.vue` (top/sides), a status-bar scrim in `App.vue`, `Footer.vue` (bottom), `Menu.vue` overlay (all sides), and the chat composer in `PreferencesPage.vue` (bottom).
-   **No behaviour change for users** beyond content no longer sitting under the status bar, navigation bar or display cutout.

## Capabilities

### New Capabilities

-   `native-shell`: the contract the native wrapper must meet to be publishable and render correctly. This change introduces it with the Android requirements: platform SDK levels, safe-area/edge-to-edge handling, status-bar legibility, tablet orientation and resize behaviour, and preserving the app's flows across the upgrade. Card #55's change adds the iOS requirements to the same capability.

### Modified Capabilities

<!-- None. conversational-recommendation, reading-list and book-links keep their requirements; this change must not alter them (regression-checked in tasks.md section 6). -->

## Impact

-   **Dependencies**: `package.json` / `package-lock.json` (the four Capacitor packages only). Vite, Vue, Tailwind and every other dependency stay as they are.
-   **Android**: `android/variables.gradle`, `android/build.gradle`, `android/app/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`, `android/app/src/main/AndroidManifest.xml`, and the files Capacitor regenerates (`capacitor.build.gradle`, `capacitor.settings.gradle`, `capacitor-cordova-android-plugins/`).
-   **iOS**: none. `ios/` is unchanged; `npm run ios:build` / `ios:run` and any platform-less `npx cap sync` must not be used until #55 (design.md D3).
-   **Web layer**: `index.html`, `capacitor.config.ts`, `src/index.css`, `src/App.vue`, `src/components/layout/Header.vue`, `src/components/layout/Footer.vue`, `src/components/layout/Menu.vue`, `src/views/PreferencesPage.vue`.
-   **Developer machine (operator)**: Android Studio Otter 2025.2.1 or newer and Android SDK Platform 36. Both pending on 2026-10-07; the operator will install them (tasks.md section 0).
-   **Out of scope**: everything iOS (card #55), the Vite/Vue upgrade (card #48), Tailwind changes, the adaptive design system and any redesign (card #47), release signing/keystores, store listings, app name/icon changes, and adding `@capacitor/app` for Android back-button routing (card #45).
