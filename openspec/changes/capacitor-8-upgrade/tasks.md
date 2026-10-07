Owner: `app-engineer` (worktree), except where marked **Operator**. Scope is Android only; iOS is card #55. Card #50 checklist items are noted as `[card N]`. Every tick needs evidence in the PR (command output, a screenshot, or a file/line).

Standing rule for every section (design.md D3): never run `npx cap sync ios`, `npx cap add ios`, `npm run ios:build`, `npm run ios:run` or a platform-less `npx cap sync`. Always use `npx cap sync android`.

## 0. Prerequisites (Operator)

-   [ ] 0.1 **Operator**: Android Studio updated to Otter 2025.2.1 or newer (Capacitor 8 minimum). Evidence: version string in the PR. Not blocking for CLI builds (design.md, Risks).
-   [ ] 0.2 **Operator**: Android SDK Platform 36 installed (Android Studio → SDK Manager → SDK Platforms → Android 16 / API 36). Evidence: `ls "$ANDROID_HOME/platforms"` lists `android-36`. Needed before section 3; AGP may download it otherwise (design.md D2).

## 1. Baseline on Capacitor 6 (before any change)

-   [ ] 1.1 Create the worktree/branch from `main` and record the base commit SHA (used as `<base>` below). Symlink `.env` from the main checkout (do not copy it). `npm ci`.
-   [ ] 1.2 `npm run type-check`, `npm run lint` (must leave no diff), `npx vitest run` and `npm run build-only` all pass on the untouched code. Record the output.
-   [ ] 1.3 Build the current Android project with **JDK 17** (the SDKMAN Temurin on `PATH`; Gradle 8.2.1 does not run on 21): `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)`. Install on `Pixel_9_API_36`.
-   [ ] 1.4 On that baseline install, record the backend URL used (`10.0.2.2` setup), and take screenshots of Login, Home, Preferences chat, Recommendations, Reading List. Write down **what system back does** on Home and on Preferences (exit app / previous route / nothing). Observation only: the fix is card #45; copy the finding there too.
-   [ ] 1.5 Browser baseline: screenshots of Home, Preferences, Reading List and the open menu at 360 px and 1280 px wide (`npm run dev`), for task 4.5.

## 2. Checkpoint A: Capacitor 6 → 7 `[card 2]`

-   [ ] 2.1 `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (JDK 21) for every Gradle run from here on.
-   [ ] 2.2 `npm i -D @capacitor/cli@latest-7`, then `npx cap migrate`. Paste the full migrator output in the PR. iOS-step and iOS-sync failures are expected (design.md D3).
-   [ ] 2.3 Restore `ios/` (design.md D3): `git restore --source=<base> --staged --worktree -- ios && git clean -fd -- ios`, then `git diff --exit-code <base> -- ios` exits 0 and `git status --porcelain -- ios` prints nothing. Paste both.
-   [ ] 2.4 Verify that `@capacitor/{core,android,ios,cli}` all resolve to 7.6.9 (or the current `latest-7`) in `package-lock.json`, and that the Android files match the 7.0 guide: minSdk 23, compile/target 35, AGP 8.7.2, Gradle 8.11.1, google-services 4.4.2, `navigation` in `configChanges`. Apply by hand any step the migrator skipped.
-   [ ] 2.5 `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` succeeds, and the APK installs and launches on `Pixel_9_API_35` to the login screen. Status-bar overlap here is expected (design.md Risks). Commit: `chore(capacitor): migrate to Capacitor 7`.

## 3. Checkpoint B: Capacitor 7 → 8 on Android `[card 3]`

-   [ ] 3.1 `npm i -D @capacitor/cli@latest`, then `npx cap migrate`. Paste the output. Set `package.json` to `^8.5.3` for all four Capacitor packages, `@capacitor/ios` included (design.md D3, D5). Confirm the lockfile resolves one identical 8.5.x version, and that `rm -rf node_modules && npm ci` succeeds without `--legacy-peer-deps`.
-   [ ] 3.2 Restore `ios/` exactly as in 2.3 and paste the two checks.
-   [ ] 3.3 Verify the Android files against the 8.0 guide: `variables.gradle` has exactly the 8.0 block (minSdk 24, compile/target 36, androidx versions, `cordovaAndroidVersion = '14.0.1'`). AGP 8.13.0, google-services 4.4.4, Gradle 8.14.3. `namespace = ` / `compileSdk = ` / `ignoreAssetsPattern = ` use the `=` syntax. `configChanges` includes `navigation|density`. `network_security_config.xml` and its manifest reference are unchanged.
-   [ ] 3.4 Confirm the manifest/resources contain none of: `windowOptOutEdgeToEdgeEnforcement`, `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`, `android:screenOrientation`, `enableOnBackInvokedCallback="false"`, `adjustMarginsForEdgeToEdge` (grep output in the PR).
-   [ ] 3.5 `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` succeeds. Say whether Android SDK Platform 36 came from task 0.2 or was auto-downloaded. Evidence that the APK has `targetSdkVersion 36` and `minSdkVersion 24` (merged manifest or `aapt2 dump badging`). Commit: `chore(capacitor): migrate Android to Capacitor 8 / API 36`.

## 4. System Bars and safe areas `[card 4]`

-   [ ] 4.1 `index.html` viewport includes `viewport-fit=cover`.
-   [ ] 4.2 `capacitor.config.ts` has `plugins.SystemBars = { insetsHandling: 'css', style: 'LIGHT' }`. No `SystemBars.setStyle()` call in `src/main.ts` (that is the iOS half, card #55) and no `@capacitor/status-bar`.
-   [ ] 4.3 `src/index.css` defines `--bm-safe-{top,right,bottom,left}` with the `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` chain. The chain appears nowhere else.
-   [ ] 4.4 Apply the tokens exactly as design.md D4 lists: `Header.vue` (top + sides), `App.vue` status-bar scrim, `Footer.vue` (bottom), `Menu.vue` overlay (all four), `PreferencesPage.vue` `<main>` (bottom). No other visual changes.
-   [ ] 4.5 Browser check at 360 px and 1280 px wide (`npm run dev`): the layout is identical to the 1.5 baseline, since all tokens resolve to 0. Before/after screenshots. Commit: `feat(native): handle safe areas with System Bars`.

## 5. Device verification `[card 5]`

-   [ ] 5.1 Android phone, `Pixel_9_API_36` (gesture navigation): every scenario in `specs/native-shell/spec.md` under "Content is never obscured by system bars on Android" and "Android status bar icons are legible", with screenshots: header, scrolled scrim, chat composer, footer, menu portrait + landscape, keyboard open, device in dark theme.
-   [ ] 5.2 Android tablet, `Pixel_Tablet_API_36`: launch in landscape and portrait; rotate during the chat and confirm the transcript and the unsent input survive (no reload); menu and header clear the system bars. Screenshots.
-   [ ] 5.3 **Fallback only if the API 36 AVDs are unavailable**: run 5.1/5.2 on `Pixel_9_API_35` plus an API 35 tablet AVD. That verifies install, launch and edge-to-edge insets (enforced on Android 15 for target ≥ 35). It does **not** verify the Android 16-only behaviour: predictive back, ignored orientation locks on sw600dp, or the removed edge-to-edge opt-out. List those as UNVERIFIED in the PR and on the card. On 2026-10-07 `Pixel_9_API_36` and `Pixel_Tablet_API_36` already exist on the operator's Mac.

## 6. Regression `[card 6]`

-   [ ] 6.1 On `Pixel_9_API_36` with a test account: log in → preferences chat (including the clarifier turn) → recommendations shown → save one book to the reading list → mark it read/liked → kill and relaunch → still signed in and the book is still in the list. Compare against the baseline screenshots from 1.4.
-   [ ] 6.2 System back on Home and on Preferences (Android 16 phone) matches the behaviour recorded in 1.4. If it differs, record it on cards #50 and #45; do not patch it with a plugin or the opt-out.

## 7. Quality gates `[card 7]`

-   [ ] 7.1 `npm run type-check` passes.
-   [ ] 7.2 `npm run lint` passes and leaves no unrelated diff.
-   [ ] 7.3 `npx vitest run` passes.
-   [ ] 7.4 `npm run build` and `npx cap sync android` pass.
-   [ ] 7.5 `ios/` unchanged on the final branch: `git diff --exit-code <base> -- ios` exits 0 (design.md D3).
-   [ ] 7.6 No secrets in the diff: no `.env`, certs, keystores or `google-services.json`. The PR description separates hand-written files from regenerated ones, states the exact Capacitor version and the Android Studio version used, and says that `ios/` is intentionally left on Capacitor 6 and not buildable until card #55 (use `npm run android:build`, not `ios:*` or a platform-less `cap sync`).
-   [ ] 7.7 PR opened, link commented on card #50, a one-line note on card #55 that `ios/` is now out of sync with `@capacitor/ios` 8.5.x and waits for regeneration, card #50 moved to "Verifica QA".
