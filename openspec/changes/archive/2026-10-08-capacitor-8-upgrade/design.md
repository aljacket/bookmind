## Context

### Scope (operator decisions, 2026-10-07)

1. **Android only.** Xcode is not installed and its installation is postponed. All iOS work (regenerating `ios/` with SPM, iOS deployment target 15, UIScene lifecycle, `SystemBars.setStyle` and `UIViewControllerBasedStatusBarAppearance` for iOS, iPhone/iPad verification) is card #55 "Upgrade Capacitor 8 — piattaforma iOS (Xcode 26, SPM)", with its own OpenSpec change.
2. **SPM is confirmed for iOS.** Recorded below for #55; it is not work for this change.
3. **No Play target-API extension**: no build has ever been submitted to Google Play.
4. **Android Studio** will be updated by the operator to Otter 2025.2.1+ and Android SDK Platform 36 installed. AVDs `Pixel_9_API_36` and `Pixel_Tablet_API_36` already exist.
5. **Android back button / `@capacitor/app`** belongs to card #45. This change only records the baseline behaviour and compares it after the upgrade; it does not fix it.

### External requirements for this change (all checked 2026-10-07)

| Requirement                     | Value                                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Google Play target API          | New apps and updates must target **API 36** since **31 Aug 2026**. An extension to **1 Nov 2026** can be requested from Play Console; not needed here (nothing submitted yet).                                                                                                                                                                                                                               | https://support.google.com/googleplay/android-developer/answer/11926878    |
| Capacitor 6 → 7                 | Node 20+, **JDK 21**, Android Studio Ladybug 2024.2.1+, minSdk 23, compile/target 35, AGP 8.7.2, Gradle 8.11.1, google-services 4.4.2, `navigation` in `configChanges`. CLI: `npm i -D @capacitor/cli@latest-7` then `npx cap migrate`.                                                                                                                                                                      | https://capacitorjs.com/docs/updating/7-0                                  |
| Capacitor 7 → 8                 | **Node 22+**, Android Studio **Otter 2025.2.1+**, minSdk **24**, compile/target **36**, AGP **8.13.0**, Gradle **8.14.3**, google-services **4.4.4**, `density` in `configChanges`, `=` Gradle property syntax, `android.adjustMarginsForEdgeToEdge` removed in favour of System Bars. CLI: `npm i -D @capacitor/cli@latest` then `npx cap migrate`.                                                         | https://capacitorjs.com/docs/updating/8-0                                  |
| `cap migrate` behaviour         | Takes **no platform argument**. iOS steps run when `@capacitor/ios` is a dependency **and** `ios/` exists: they bump the `project.pbxproj` deployment target to 15.0, rewrite the Podfile platform (non-SPM projects) and apply the UIScene migration. Android steps are gated the same way on `@capacitor/android`. It does not run `pod install`. At the end it runs `npx cap sync` for **all** platforms. | https://github.com/ionic-team/capacitor/blob/main/cli/src/tasks/migrate.ts |
| Android 15 (targetSdk 35)       | Apps are edge-to-edge by default on Android 15 devices when targeting API 35.                                                                                                                                                                                                                                                                                                                                | https://developer.android.com/about/versions/15/behavior-changes-15        |
| Android 16 (targetSdk 36)       | The edge-to-edge opt-out (`windowOptOutEdgeToEdgeEnforcement`) is disabled. Orientation, resizability and aspect-ratio restrictions are ignored on smallest width ≥ 600dp; the opt-out `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` is temporary. Predictive back is on by default: `onBackPressed()` is not called and `KEYCODE_BACK` is not dispatched.                                                 | https://developer.android.com/about/versions/16/behavior-changes-16        |
| System Bars plugin              | Bundled with `@capacitor/core` 8. `insetsHandling: "css"` (the default) injects `--safe-area-inset-{top,bottom,left,right}` on Android, working around a bug in Android WebView < 140. Recommended pattern: `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`. Style `LIGHT` means dark content on a light background. The `style` config key applies on Android at launch.                        | https://capacitorjs.com/docs/apis/system-bars                              |
| Status Bar plugin on Android 16 | `overlaysWebView` and `backgroundColor` have no effect at targetSdk 36.                                                                                                                                                                                                                                                                                                                                      | https://capacitorjs.com/docs/apis/status-bar                               |
| `viewport-fit=cover`            | Makes the page lay out to the full size of the screen; `env(safe-area-inset-*)` is then used to pad content selectively.                                                                                                                                                                                                                                                                                     | https://webkit.org/blog/7929/designing-websites-for-iphone-x/              |

npm registry on 2026-10-07: `@capacitor/core` `latest` = **8.5.3**, `latest-7` = **7.6.9**, `next` = 9.0.0-alpha.8. `@capacitor/cli@8` declares `engines.node >= 22.0.0`. Peer dependencies: `@capacitor/ios@6.1.2` requires `@capacitor/core ^6.1.0`, `@capacitor/ios@7.6.9` requires `^7.6.0`, `@capacitor/ios@8.5.3` requires `^8.5.0`. Card #50 said 8.5.2; the registry has since moved to 8.5.3.

### Recorded for card #55 (iOS, not in scope here; checked 2026-10-07)

| Requirement            | Value                                                                                                                                                                                        | Source                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Apple upload toolchain | Since **28 Apr 2026**, uploads must be built with **Xcode 26+** against the **iOS/iPadOS 26 SDK**.                                                                                           | https://developer.apple.com/news/upcoming-requirements/                                              |
| Capacitor 7 → 8 (iOS)  | Xcode 26+, iOS deployment target **15.0**. The CLI creates **SPM** iOS projects by default.                                                                                                  | https://capacitorjs.com/docs/updating/8-0                                                            |
| Capacitor 8.4 → 8.5    | iOS adopts the **UIScene lifecycle**: `SceneDelegate.swift`, `UIApplicationSceneManifest` in Info.plist, a scene-configuration hook in AppDelegate. The guide says Xcode 27 will require it. | https://capacitorjs.com/docs/updating/8-5                                                            |
| iOS dependency manager | Capacitor recommends SPM. A never-hand-edited project can be migrated by deleting `ios/` and running `npx cap add ios --packagemanager SPM`. **Operator confirmed SPM on 2026-10-07.**       | https://capacitorjs.com/docs/ios/spm, https://capacitorjs.com/docs/getting-started/environment-setup |
| CocoaPods trunk        | Becomes permanently read-only on **2 Dec 2026** (test read-only run planned for 1–7 Nov 2026).                                                                                               | https://blog.cocoapods.org/CocoaPods-Specs-Repo/                                                     |
| System Bars on iOS     | The `style` config key is Android-only; iOS needs `SystemBars.setStyle()` at runtime and `UIViewControllerBasedStatusBarAppearance = YES`.                                                   | https://capacitorjs.com/docs/apis/system-bars                                                        |

What #55 inherits from this change: the four Capacitor packages already at 8.5.x in `package.json`, the safe-area tokens and System Bars config in the web layer, and an untouched Capacitor 6 `ios/` tree to delete and regenerate. Facts for #55 from the repo: `ios/` has only ever been touched by commit d7d3fc0 "install capacitor"; Info.plist has iPhone portrait + landscape L/R and iPad all four orientations, `UIViewControllerBasedStatusBarAppearance = true`, legacy `UIRequiredDeviceCapabilities = armv7`; `TARGETED_DEVICE_FAMILY = "1,2"`.

### Repo state (read 2026-10-07, `main` @ e0db7f4)

-   `package.json`: `@capacitor/{core,android,ios,cli}` `^6.1.2`. Installed version is 6.1.2. No Capacitor plugins other than core, and no Cordova plugins. Scripts `ios:build` / `ios:run` run `npx cap sync ios`; `android:build` runs `npx cap sync android`.
-   `capacitor.config.ts`: `appId: 'com.bookmind.app'`, `appName: 'bookmind'`, `webDir: 'dist'`, no `plugins`/`server`/`android`/`ios` blocks. Defaults (scheme/hostname) are kept, so the WebView origin does not change and IndexedDB/Firebase persistence survives.
-   `index.html` viewport is `width=device-width, initial-scale=1.0`, without `viewport-fit=cover`. No `safe-area`/`env()` usage exists anywhere in `src/`.
-   `android/variables.gradle`: minSdk 22, compile 34, target 34, plus the Capacitor 6 androidx versions. `android/build.gradle`: AGP 8.2.1, google-services 4.4.0. Wrapper: Gradle 8.2.1. `capacitor.build.gradle`: Java 17. No Kotlin. `AndroidManifest.xml` `configChanges` has no `navigation`/`density` and no `screenOrientation`. It references a **custom `network_security_config.xml`** (commits 8a8d8f0 and 8dffaea), which allows user certificates for `10.0.2.2` so the dev backend can be reached from the emulator. `MainActivity` is a bare `BridgeActivity`. No `google-services.json`.
-   `ios/`: CocoaPods project. `ios/App/Podfile` loads `../../node_modules/@capacitor/ios/scripts/pods_helpers` and the `Capacitor`/`CapacitorCordova` pods from `../../node_modules/@capacitor/ios`, `platform :ios, '13.0'`. Its build output, `App/App/public`, `capacitor.config.json` and `config.xml` are git-ignored by `ios/.gitignore`.
-   Layout: `Header.vue` is in normal flow (not sticky), `bg-white px-6 py-4`. `Footer.vue` is `py-8 mt-auto`, used on Home and Reading List only. `Menu.vue` overlay is `fixed inset-0 z-40 py-16`; its toggle button is `z-50` inside the header. `PreferencesPage.vue` is a `min-h-screen flex-col` with the chat composer at the bottom and **no footer**. Login/Register/ForgotPassword/Processing are centred `min-h-screen` pages without a header. `App.vue` only hosts the `router-view` transition.
-   Tests: `src/views/__test__/LoginPage.spec.js` (Vitest). Scripts: `type-check` (vue-tsc), `lint` (eslint `--fix`), `build` (type-check + vite build).

### Local toolchain (operator's Mac, checked 2026-10-07)

| Tool                  | Found                                                                                                                                                        | Needed                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Node                  | v22.23.2, npm 10.9.8                                                                                                                                         | ≥ 22 ✔                                                       |
| Java on `PATH`        | **Temurin 17.0.9 via SDKMAN** (`/usr/libexec/java_home` finds none)                                                                                          | JDK 21 for Cap 7/8 ✘. Use the Android Studio JBR.             |
| Android Studio        | **2024.2 (Ladybug)**, JBR 21.0.3 at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`                                                            | Otter 2025.2.1+ for Cap 8. Operator will update (decision 4). |
| Android SDK platforms | **android-34 only**; build-tools 33/34/35; no `cmdline-tools`                                                                                                | `platforms;android-36`. Operator will install (decision 4).   |
| System images / AVDs  | android-35 and android-36 (`google_apis_playstore`, plus `ps16k` for 36). AVDs `Pixel_9_API_35`, `Pixel_9_API_36`, `Pixel_Tablet_API_36` (2560×1600 @320dpi) | ✔                                                            |
| Xcode / CocoaPods     | Neither installed (`xcode-select -p` → CommandLineTools)                                                                                                     | Not needed for this change (iOS is #55)                       |
| macOS                 | 26.5                                                                                                                                                         | ✔                                                            |

## Goals / Non-Goals

**Goals:**

-   An Android debug build on Capacitor 8.5.x that meets Play's API 36 requirement, verified on the Android 16 phone and tablet emulators.
-   Use the official migration path (`npx cap migrate`) wherever it applies, so `android/` stays template-shaped and future upgrades remain cheap.
-   Minimal, correct safe-area handling on the existing layout, so nothing collides with system UI once edge-to-edge is enforced. The same CSS is what iOS will rely on in #55.
-   Zero functional regressions in login, preferences chat, recommendations and reading list on Android.
-   Leave `ios/` exactly as it is on `main`, so #55 starts from a known state.

**Non-Goals:**

-   Anything iOS: regenerating or building `ios/`, SPM, deployment target, UIScene, iOS status-bar style, iPhone/iPad verification (card #55).
-   Vite / Vue / vue-tsc / TypeScript upgrades (card #48). Tailwind changes. The adaptive design system, breakpoints, sticky headers or any visual redesign (card #47).
-   Release signing, keystores, `versionCode`/`versionName` policy, AAB upload, store listings, the app display name (`bookmind` lowercase) and icon redesign.
-   Adding `@capacitor/app` or any other plugin to change Android back-button behaviour (card #45).
-   Capacitor 9 (alpha on npm today). Not for launch.
-   Making the 7.x checkpoint shippable or pixel-correct.

## Decisions

### D1. Two checkpoints, one PR

Go 6 → 7 → 8 on one branch. **Checkpoint A** (Capacitor 7.6.9) is its own commit and must produce a green `assembleDebug` that launches on `Pixel_9_API_35`. **Checkpoint B** (Capacitor 8.5.3) follows as a separate commit. Safe-area work is a third commit. Everything lands as one PR against card #50.

-   _Why not 6 → 8 directly?_ The official guides are written step by step. Each `cap migrate` assumes the previous major. A failed jump gives no way to tell whether the 7 or the 8 delta broke the build. The intermediate build costs about 15 minutes and isolates the failure.
-   _Why not two PRs?_ 7.x is never released, and a merged 7.x `main` would ship nothing and still need the 8 PR before any store upload. Commits give the same bisectability without an extra QA/merge cycle on the operator's queue (the operator's review time is the bottleneck).
-   _Cost:_ a large diff, mostly generated (Gradle files, lockfile). The PR description must list the hand-written changes separately from regenerated ones.

### D2. Android: migrate in place

Run `npx cap migrate` at each checkpoint and then diff the result against the values in the Context table. Where the migrator could not complete a step, apply that step by hand, exactly as the guide shows.

-   _Why in place:_ `android/` carries a hand-made `network_security_config.xml` and its manifest reference, which the dev backend loop on the emulator depends on. Regenerating would drop them.
-   Expected end state: `variables.gradle` holds exactly the Capacitor 8 block (minSdk 24, compile/target 36, androidx versions as in the 8.0 guide, `cordovaAndroidVersion = '14.0.1'`). AGP is `8.13.0`, google-services `4.4.4`, Gradle wrapper `8.14.3-all`. `namespace = "com.bookmind.app"` and the other properties use the `=` syntax. `configChanges` ends with `|uiMode|navigation|density`. No `windowOptOutEdgeToEdgeEnforcement`, no `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`, no `android:screenOrientation`, no `enableOnBackInvokedCallback="false"`.
-   Gradle must run on JDK 21: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`. The SDKMAN JDK 17 on `PATH` will fail (Capacitor 7+ needs JDK 21). The **baseline** build of the current Capacitor 6 project (task 1.3) is the exception: run it with JDK 17, because Gradle 8.2.1 predates Java 21 support.
-   Android SDK Platform 36 is installed by the operator (task 0.2). If it is still missing when the engineer reaches checkpoint B, AGP may download it on the first build (licences are accepted); say in the PR which of the two happened.

### D3. iOS: frozen on `main`'s state until card #55

`npx cap migrate` cannot be limited to Android. It runs its iOS steps whenever `@capacitor/ios` is a dependency and `ios/` exists, and finishes with a platform-less `npx cap sync` (Context table, `cap migrate` behaviour). So this change has to decide what happens to `ios/` and to `@capacitor/ios`.

**Decision:** bump `@capacitor/ios` to `^8.5.3` in lockstep with the other three packages, let the migrator run as documented, then **restore `ios/` to the base commit** after each migrator run so the PR contains no change under `ios/`. Never run `npx cap sync ios`, `npx cap add ios`, `npm run ios:build` or `npm run ios:run` in this change, and always pass `android` to `cap sync`. After each restore:

```bash
git restore --source=<base> --staged --worktree -- ios
git clean -fd -- ios          # removes untracked files the migrator added, e.g. SceneDelegate.swift; ignored build output is left alone
git diff --exit-code <base> -- ios && test -z "$(git status --porcelain -- ios)"
```

The last line must succeed at every commit; QA re-runs it on the PR branch.

Consequence, accepted and stated in the PR: from merge until #55 lands, `ios/` is a Capacitor 6 CocoaPods project whose Podfile points at `node_modules/@capacitor/ios`, which is now 8.5.x. It will not `pod install` or build. Nothing is lost: there is no Xcode or CocoaPods on the Mac, nothing has been submitted to the App Store, and #55 deletes `ios/` and regenerates it with `npx cap add ios --packagemanager SPM`, with no further `package.json` change.

Options rejected:

-   _Keep `@capacitor/ios` at `^6.1.2`._ `@capacitor/ios@6.1.2` has the peer dependency `@capacitor/core ^6.1.0` (npm registry, 2026-10-07). With core at 8 that is an unresolvable peer conflict: `npm ci` fails unless every install uses `--legacy-peer-deps`, which would also hide real conflicts. Highest risk.
-   _Remove `@capacitor/ios` from `package.json` for now._ The migrator would skip iOS by itself, but the platform-less `npx cap sync` at the end of `cap migrate` would meet an `ios/` folder with no platform package, which the CLI is not documented to tolerate. It also leaves the Podfile pointing at a path that no longer exists and makes #55 re-add a dependency. More moving parts than a restore that can be checked with one `git diff`.
-   _Let the migrator's iOS edits stay._ It would leave `ios/` half-migrated (deployment target 15 in the pbxproj, Podfile changed, UIScene files added to a CocoaPods project) and unverifiable without Xcode. That is noise in the diff, and #55 throws it away anyway.
-   _Regenerate `ios/` now without building it._ That is #55's work. Without Xcode nobody can verify it, and an unverified regenerated tree would merge as if it were done.

### D4. Safe areas: inset tokens, applied in five places

This is web-layer work. On Android the System Bars plugin feeds it; on iOS `env()` will feed it once #55 lands.

1. `index.html`: viewport becomes `width=device-width, initial-scale=1.0, viewport-fit=cover`.
2. `capacitor.config.ts`: `plugins: { SystemBars: { insetsHandling: 'css', style: 'LIGHT' } }`. `insetsHandling` is the default but stated explicitly. `style` applies on Android at launch. (The iOS runtime call `SystemBars.setStyle()` in `src/main.ts` is #55's, because the config `style` key is Android-only.)
3. `src/index.css` (`@layer base`, `:root`): four tokens, the only place the fallback chain is written:
   `--bm-safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));` and the same for `-right`, `-bottom`, `-left`.
4. Apply them:
    - `Header.vue`: `padding-top: calc(1rem + var(--bm-safe-top))`, `padding-left: calc(1.5rem + var(--bm-safe-left))`, `padding-right: calc(1.5rem + var(--bm-safe-right))`. This replaces `py-4`'s top and `px-6`; keep `py-4`'s bottom.
    - `App.vue`: one `aria-hidden` fixed element, `top:0; left:0; right:0; height: var(--bm-safe-top); background: #ffffff` (header white), `z-index: 30`, `pointer-events: none`, rendered outside the route transition. It is invisible on web (height 0). The Menu overlay (z-40) and its toggle (z-50) stay above it.
    - `Footer.vue`: `padding-bottom: calc(2rem + var(--bm-safe-bottom))`.
    - `Menu.vue` overlay: `padding-top: calc(4rem + var(--bm-safe-top))`, `padding-bottom: calc(4rem + var(--bm-safe-bottom))`, `padding-left: var(--bm-safe-left)`, `padding-right: var(--bm-safe-right)`.
    - `PreferencesPage.vue` `<main>`: `padding-bottom: calc(1.5rem + var(--bm-safe-bottom))` so the composer clears the gesture bar.

Use Tailwind arbitrary values (`pt-[calc(1rem+var(--bm-safe-top))]`) or a scoped style, whichever passes lint. On web every token resolves to 0px, so the browser layout is unchanged.

-   _Why tokens rather than the docs' `html { padding: … }`?_ Padding on `html` does not reach `position: fixed` elements (Menu overlay, scrim). Combined with the `min-h-screen` roots it would also make every page scrollable by the inset height. Tokens on the five components fix exactly what collides and leave the layout decisions to card #47.
-   _Why a scrim rather than a sticky header?_ A sticky header is a UX change (card #47). The scrim is the smallest change that stops scrolled text from rendering under the clock.
-   _Why no change to Login/Register/ForgotPassword/Processing?_ They centre narrow content with no header. Their acceptance is covered by the "nothing under a system bar" check. If QA finds a collision there, apply the same tokens to the root `div` padding in that view only.
-   _Keyboard:_ if the "chat input stays reachable with the keyboard open" scenario fails on Android 16, the engineer may fix it **only** with configuration or CSS inside the files listed above, or by adding the official `@capacitor/keyboard@^8` with its documented resize config. Anything beyond that means stop, record evidence on the card, and hand back to product-lead.

### D5. Versions pinned in `package.json`

`"@capacitor/android": "^8.5.3"`, `"@capacitor/core": "^8.5.3"`, `"@capacitor/ios": "^8.5.3"`, `"@capacitor/cli": "^8.5.3"` (devDependency). All four must resolve to the same exact version in `package-lock.json`, and `npm ci` must succeed without `--legacy-peer-deps`. Record that version in the PR description. `@capacitor/ios` is included only for peer-dependency consistency (D3).

## Risks / Trade-offs

-   [Android Studio 2024.2 is below Otter 2025.2.1, the Capacitor 8 minimum] → The operator updates Android Studio and installs SDK Platform 36 (task 0.1/0.2). CLI Gradle builds only need JDK 21 + AGP 8.13 + Gradle 8.14.3, so if the update is not done yet the engineer can still build from the CLI with the existing JBR 21 and must note the Android Studio version in the PR. The JBR path stays the same after the update.
-   [`npx cap migrate` edits `ios/` and its final `cap sync` reports iOS errors (no CocoaPods/Xcode)] → Expected (D3). Paste the migrator output in the PR, restore `ios/`, and continue. If the migrator aborts before the Android steps, apply the Android steps by hand from the guide.
-   [`ios/` is unbuildable between this merge and #55] → Accepted (D3). Nobody can build iOS on this Mac today and nothing is on the App Store. The PR description and a comment on #55 say so.
-   [Someone runs a platform-less `npx cap sync` or `npm run ios:build` after merge] → The iOS half of the sync is expected to fail (no CocoaPods/Xcode) and may rewrite tracked files such as the Podfile. Such a diff must not be committed; discard it with the D3 restore. The PR description says to use `npx cap sync android` / `npm run android:build` until #55.
-   [Enforced edge-to-edge on Android 15 at the 7.x checkpoint makes the header overlap the status bar on `Pixel_9_API_35`] → Expected and not fixed at checkpoint A. Do not add the 7.x-only `adjustMarginsForEdgeToEdge`; it is removed in 8. The fix is D4.
-   [Chat textarea hidden by the keyboard under edge-to-edge] → Explicit scenario; bounded fix in D4.
-   [Predictive back changes what system back does] → The baseline is recorded on Capacitor 6 before any change (task 1.4) and compared after (task 6.2). Do not use the `enableOnBackInvokedCallback="false"` opt-out; it is temporary. If behaviour differs from the baseline, record it on card #50 and #45; the fix is #45's.
-   [The emulator cannot reach the dev backend, so regression flows cannot be run] → Use the existing setup in `network_security_config.xml` (host reachable at `10.0.2.2`, user certificates trusted in debug) and record the exact `VITE_API_BASE_URL` used in the PR. Never commit `.env` or certs.
-   [WebView origin changes and wipes IndexedDB / Firebase session] → Do not set `server.hostname` or `server.androidScheme`. Origins stay the Capacitor defaults. The relaunch scenario in the spec proves persistence. Pre-launch there are no production users, so the blast radius is limited to dev devices.
-   [A large generated diff hides a hand-written mistake] → The PR lists the hand-written files explicitly (D4 list, `package.json`, Android Gradle/manifest edits). QA reviews those, and everything else is checked for template provenance.

## Migration Plan

1. Baseline (Capacitor 6, unchanged code): build and launch on `Pixel_9_API_36`, then record login → chat → recommendations → reading list and the back-gesture behaviour (screenshots in the PR).
2. Checkpoint A: Capacitor 7.6.9 via `npm i -D @capacitor/cli@latest-7` + `npx cap migrate`, restore `ios/` (D3), then Android `assembleDebug` + launch on `Pixel_9_API_35`. Commit.
3. Checkpoint B: Capacitor 8.5.3 via `npm i -D @capacitor/cli@latest` + `npx cap migrate`, restore `ios/` (D3), then Android `assembleDebug` + launch on `Pixel_9_API_36` and `Pixel_Tablet_API_36`. Commit.
4. Safe areas (D4). Commit.
5. Full verification (tasks sections 5–7), then open the PR and move the card to Verifica QA.

**Rollback:** nothing ships until the operator merges, and nothing reaches a store until a separate release card. Before merge, abandon the branch. After merge, `git revert -m 1 <merge>` restores the Capacitor 6 `package.json`/lockfile and the old `android/` tree exactly (fully tracked; generated build output is git-ignored and rebuilt by `npm ci && npx cap sync android`). `ios/` needs nothing, since this change never touched it. Reverting also brings back the Play blocker, so a revert is only a stop-gap. The operator's Android Studio update needs no rollback.

## Open Questions

None blocking. Card #50 checklist item 3 still reads "iOS deployment target ≥ 15"; that part belongs to #55, and the operator should reword the item (product-lead cannot edit checklist text with the board script).
