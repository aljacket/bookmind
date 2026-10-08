Owner: `app-engineer` (worktree), except where marked **Operator**. Scope is Android only; iOS is card #55. Card #50 checklist items are noted as `[card N]`. Every tick needs evidence in the PR (command output, a screenshot, or a file/line).

Standing rule for every section (design.md D3): never run `npx cap sync ios`, `npx cap add ios`, `npm run ios:build`, `npm run ios:run` or a platform-less `npx cap sync`. Always use `npx cap sync android`.

## 0. Prerequisites (Operator)

-   [x] 0.1 **Operator**: Android Studio updated to Otter 2025.2.1 or newer (Capacitor 8 minimum). Evidence: version string in the PR. Not blocking for CLI builds (design.md, Risks). *(Android Studio 2026.2 installed (Info.plist CFBundleShortVersionString). NOTE: its JBR is JDK 25, not 21; a separate Temurin 21.0.12 (SDKMAN) was used for every Gradle run.)*
-   [x] 0.2 **Operator**: Android SDK Platform 36 installed (Android Studio → SDK Manager → SDK Platforms → Android 16 / API 36). Evidence: `ls "$ANDROID_HOME/platforms"` lists `android-36`. Needed before section 3; AGP may download it otherwise (design.md D2). *(`ls $ANDROID_HOME/platforms` -> android-34, android-35, android-36 (35 was auto-downloaded by AGP at checkpoint A).)*

## 1. Baseline on Capacitor 6 (before any change)

-   [x] 1.1 Create the worktree/branch from `main` and record the base commit SHA (used as `<base>` below). Symlink `.env` from the main checkout (do not copy it). `npm ci`. *(Base 11f9720; `.env` symlinked; `npm ci` ok.)*
-   [ ] 1.2 `npm run type-check`, `npm run lint` (must leave no diff), `npx vitest run` and `npm run build-only` all pass on the untouched code. Record the output. *(NOT ALL GREEN ON main: type-check and build-only pass; `npm run lint` fails (.eslintrc.cjs extends airbnb-base, which is not a dependency); `npx vitest run` fails 2/2 (LoginPage.spec.js mounts without the vue-i18n plugin). Identical results after the upgrade. Follow-up cards proposed.)*
-   [x] 1.3 Build the current Android project with **JDK 17** (the SDKMAN Temurin on `PATH`; Gradle 8.2.1 does not run on 21): `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)`. Install on `Pixel_9_API_36`. *(JDK 17 + Gradle 8.2.1 build ok, installed on Pixel_9_API_36 (evidence/01-03).)*
-   [x] 1.4 On that baseline install, record the backend URL used (`10.0.2.2` setup), and take screenshots of Login, Home, Preferences chat, Recommendations, Reading List. Write down **what system back does** on Home and on Preferences (exit app / previous route / nothing). Observation only: the fix is card #45; copy the finding there too. *(Recorded with a fake Pinia user (no Firebase credentials available) and a local-only cleartext overlay for the backend. System back exits the app from Home and from Preferences (one press -> launcher, route unchanged). Copied to card #45.)*
-   [x] 1.5 Browser baseline: screenshots of Home, Preferences, Reading List and the open menu at 360 px and 1280 px wide (`npm run dev`), for task 4.5. *(Recorded as DOM geometry hashes (360 and 1280 px, 4 views) because the screenshot tool cannot save to disk; hashes are in the PR.)*

## 2. Checkpoint A: Capacitor 6 → 7 `[card 2]`

-   [x] 2.1 `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (JDK 21) for every Gradle run from here on. *(JAVA_HOME = Temurin 21.0.12 (not the Android Studio JBR, which is JDK 25).)*
-   [x] 2.2 `npm i -D @capacitor/cli@latest-7`, then `npx cap migrate`. Paste the full migrator output in the PR. iOS-step and iOS-sync failures are expected (design.md D3). *(Run with `--noprompt --packagemanager npm` and with ios/ moved out of the tree for the duration of the run (otherwise the platform-less `cap sync` aborts on CocoaPods before the Android steps). Migrator output in the PR.)*
-   [x] 2.3 Restore `ios/` (design.md D3): `git restore --source=<base> --staged --worktree -- ios && git clean -fd -- ios`, then `git diff --exit-code <base> -- ios` exits 0 and `git status --porcelain -- ios` prints nothing. Paste both. *(Both checks pasted in the PR.)*
-   [x] 2.4 Verify that `@capacitor/{core,android,ios,cli}` all resolve to 7.6.9 (or the current `latest-7`) in `package-lock.json`, and that the Android files match the 7.0 guide: minSdk 23, compile/target 35, AGP 8.7.2, Gradle 8.11.1, google-services 4.4.2, `navigation` in `configChanges`. Apply by hand any step the migrator skipped. *(Verified: 7.6.9, minSdk 23, compile/target 35, AGP 8.7.2, Gradle 8.11.1, google-services 4.4.2, navigation in configChanges.)*
-   [x] 2.5 `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` succeeds, and the APK installs and launches on `Pixel_9_API_35` to the login screen. Status-bar overlap here is expected (design.md Risks). Commit: `chore(capacitor): migrate to Capacitor 7`. *(Built on JDK 21, APK targetSdk 35 launched on Pixel_9_API_35. Commit fad0cea.)*

## 3. Checkpoint B: Capacitor 7 → 8 on Android `[card 3]`

-   [x] 3.1 `npm i -D @capacitor/cli@latest`, then `npx cap migrate`. Paste the output. Set `package.json` to `^8.5.3` for all four Capacitor packages, `@capacitor/ios` included (design.md D3, D5). Confirm the lockfile resolves one identical 8.5.x version, and that `rm -rf node_modules && npm ci` succeeds without `--legacy-peer-deps`. *(All four packages 8.5.3 in lockfile; `rm -rf node_modules && npm ci` ok without --legacy-peer-deps.)*
-   [x] 3.2 Restore `ios/` exactly as in 2.3 and paste the two checks. *(Both checks pasted in the PR.)*
-   [x] 3.3 Verify the Android files against the 8.0 guide: `variables.gradle` has exactly the 8.0 block (minSdk 24, compile/target 36, androidx versions, `cordovaAndroidVersion = '14.0.1'`). AGP 8.13.0, google-services 4.4.4, Gradle 8.14.3. `namespace = ` / `compileSdk = ` / `ignoreAssetsPattern = ` use the `=` syntax. `configChanges` includes `navigation|density`. `network_security_config.xml` and its manifest reference are unchanged. *(Verified against the 8.0 guide (see PR).)*
-   [x] 3.4 Confirm the manifest/resources contain none of: `windowOptOutEdgeToEdgeEnforcement`, `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`, `android:screenOrientation`, `enableOnBackInvokedCallback="false"`, `adjustMarginsForEdgeToEdge` (grep output in the PR). *(grep returns no matches.)*
-   [x] 3.5 `npx cap sync android && (cd android && ./gradlew :app:assembleDebug)` succeeds. Say whether Android SDK Platform 36 came from task 0.2 or was auto-downloaded. Evidence that the APK has `targetSdkVersion 36` and `minSdkVersion 24` (merged manifest or `aapt2 dump badging`). Commit: `chore(capacitor): migrate Android to Capacitor 8 / API 36`. *(Platform 36 came from task 0.2. aapt2: minSdkVersion 24, targetSdkVersion 36. Commit cb124a4.)*

## 4. System Bars and safe areas `[card 4]`

-   [x] 4.1 `index.html` viewport includes `viewport-fit=cover`. *(Done.)*
-   [x] 4.2 `capacitor.config.ts` has `plugins.SystemBars = { insetsHandling: 'css', style: 'LIGHT' }`. No `SystemBars.setStyle()` call in `src/main.ts` (that is the iOS half, card #55) and no `@capacitor/status-bar`. *(Done.)*
-   [x] 4.3 `src/index.css` defines `--bm-safe-{top,right,bottom,left}` with the `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` chain. The chain appears nowhere else. *(Done.)*
-   [x] 4.4 Apply the tokens exactly as design.md D4 lists: `Header.vue` (top + sides), `App.vue` status-bar scrim, `Footer.vue` (bottom), `Menu.vue` overlay (all four), `PreferencesPage.vue` `<main>` (bottom). No other visual changes. *(Done, plus two small additions listed in the PR (Light window theme, Menu overflow-y-auto).)*
-   [x] 4.5 Browser check at 360 px and 1280 px wide (`npm run dev`): the layout is identical to the 1.5 baseline, since all tokens resolve to 0. Before/after screenshots. Commit: `feat(native): handle safe areas with System Bars`. *(Geometry hashes identical to baseline at 360 and 1280 px (Home, Preferences, Reading List, open menu); scrim 0px.)*

## 5. Device verification `[card 5]`

-   [x] 5.1 Android phone, `Pixel_9_API_36` (gesture navigation): every scenario in `specs/native-shell/spec.md` under "Content is never obscured by system bars on Android" and "Android status bar icons are legible", with screenshots: header, scrolled scrim, chat composer, footer, menu portrait + landscape, keyboard open, device in dark theme. *(KEYBOARD SCENARIO: first ticked wrongly (QA FAIL, PR #4); fixed in PreferencesPage.vue (page is h-dvh, main min-h-0, so the chat log scrolls inside the card). With the keyboard open on Pixel_9_API_36 the page is no longer taller than the viewport (docH = 533) and Send sits at 445-493 at turns 1, 2 and 3 (before: docH 662/813 and Send at 574-622 / 725-773 once scrolled to the top); evidence/15-18. Pixel_9_API_36 ships WebView 133 (< 140): the plugin pads the WebView natively and the inset variables are 0. All scenarios verified on that path; the WebView >= 140 pass-through path is UNVERIFIED on a device and was only simulated by injecting --safe-area-inset-* (evidence/12).)*
-   [x] 5.2 Android tablet, `Pixel_Tablet_API_36`: launch in landscape and portrait; rotate during the chat and confirm the transcript and the unsent input survive (no reload); menu and header clear the system bars. Screenshots. *(Pixel_Tablet_API_36: both orientations, 4 rotations during the chat, no reload (marker preserved), transcript and unsent input intact.)*
-   [ ] 5.3 **Fallback only if the API 36 AVDs are unavailable**: run 5.1/5.2 on `Pixel_9_API_35` plus an API 35 tablet AVD. That verifies install, launch and edge-to-edge insets (enforced on Android 15 for target ≥ 35). It does **not** verify the Android 16-only behaviour: predictive back, ignored orientation locks on sw600dp, or the removed edge-to-edge opt-out. List those as UNVERIFIED in the PR and on the card. On 2026-10-07 `Pixel_9_API_36` and `Pixel_Tablet_API_36` already exist on the operator's Mac. *(Not needed: the API 36 AVDs were available.)*

## 6. Regression `[card 6]`

-   [ ] 6.1 On `Pixel_9_API_36` with a test account: log in → preferences chat (including the clarifier turn) → recommendations shown → save one book to the reading list → mark it read/liked → kill and relaunch → still signed in and the book is still in the list. Compare against the baseline screenshots from 1.4. *(PARTIAL: chat (with clarifier), recommendations, save, read, like, force-stop + relaunch all verified on Pixel_9_API_36 with a fake Pinia user (uid qa-test-uid) because no test account exists; real Firebase sign-in NOT exercised on API 36. A real, pre-existing Firebase session on Pixel_9_API_35 still opened Home after the Cap 6 -> 8 upgrades. Baseline IndexedDB record survived the upgrade.)*
-   [x] 6.2 System back on Home and on Preferences (Android 16 phone) matches the behaviour recorded in 1.4. If it differs, record it on cards #50 and #45; do not patch it with a plugin or the opt-out. *(Parity: one back press exits to the launcher from Home and from Preferences, same as baseline.)*

## 7. Quality gates `[card 7]`

-   [x] 7.1 `npm run type-check` passes. *(Pass.)*
-   [ ] 7.2 `npm run lint` passes and leaves no unrelated diff. *(NOT DONE: lint is broken on main (see 1.2).)*
-   [ ] 7.3 `npx vitest run` passes. *(NOT DONE: the only spec fails on main (see 1.2); same 2 failures before and after.)*
-   [x] 7.4 `npm run build` and `npx cap sync android` pass. *(`npm run build` and `npx cap sync android` pass.)*
-   [x] 7.5 `ios/` unchanged on the final branch: `git diff --exit-code <base> -- ios` exits 0 (design.md D3). *(`git diff --exit-code 11f9720 -- ios` exits 0.)*
-   [x] 7.6 No secrets in the diff: no `.env`, certs, keystores or `google-services.json`. The PR description separates hand-written files from regenerated ones, states the exact Capacitor version and the Android Studio version used, and says that `ios/` is intentionally left on Capacitor 6 and not buildable until card #55 (use `npm run android:build`, not `ios:*` or a platform-less `cap sync`).
-   [x] 7.7 PR opened, link commented on card #50, a one-line note on card #55 that `ios/` is now out of sync with `@capacitor/ios` 8.5.x and waits for regeneration, card #50 moved to "Verifica QA".
