---
name: firebase-auth-stub-cdp
description: How to QA Firebase-Auth flows (sign-in, reauth, deleteUser, sendOobCode, startup sweep) on web and Android with no source/config change - identitytoolkit stub + CDP Fetch interception, fresh browser contexts, device pitfalls (card #63, 2026-10-10)
metadata:
    type: reference
---

Proven on card #63 (account deletion, PR #26). Full round ~4 h; the emulators cost most of it.

-   **No temp code needed**: the engineer patched `connectAuthEmulator` in. I didn't have to: a Node stub on 127.0.0.1:9199 implements `accounts:signInWithPassword|lookup|delete|sendOobCode` + securetoken `/token` (unsigned JWT `alg:none` with `sub`=uid; Firebase 10 accepts it), with `/__users?add=email,pw,uid`, `/__delete?email=`, `/__mode?signin=|del=|oob=<FIREBASE_ERROR_MESSAGE>&delay=ms&oobDelay=ms`. Error messages map to codes: `INVALID_LOGIN_CREDENTIALS`→invalid-credential, `TOO_MANY_ATTEMPTS_TRY_LATER`, `CREDENTIAL_TOO_OLD_LOGIN_AGAIN`→requires-recent-login, `USER_NOT_FOUND`, `INTERNAL_ERROR`→generic, `RESET_PASSWORD_EXCEED_LIMIT`→too-many-requests.
-   **Interception**: CDP `Fetch.enable` on `*identitytoolkit.googleapis.com*` and `*securetoken.googleapis.com*`, then forward to the stub and `Fetch.fulfillRequest` with CORS headers. Preflights are paused too, so count only POSTs. `Fetch.failRequest InternetDisconnected` gives `auth/network-request-failed` while `navigator.onLine` stays true. `Network.emulateNetworkConditions offline` gives a real offline.
-   **Web isolation**: Firebase persists the session in IndexedDB, so every scenario needs a fresh context. Use the browser WS `Target.createBrowserContext` + `Target.createTarget`, then connect to the page WS from `/json/list`. Log in by driving the form (native value setter + `input` event + submit click).
-   **Device**: the same Fetch interception works in the Android WebView. It needs no cleartext overlay and no rebuild for a stub: plain `npm run build` (prod .env) → `cap sync android` → `assembleDebug`. The interceptor dies on relaunch. A CDP `Runtime.evaluate` hangs while the app is in the background.
-   **Tap offsets** (WebView bounds from `uiautomator dump`, class android.webkit.WebView): tablet with the PR APK is edge-to-edge (top 0, innerHeight 800). Pixel 9 portrait top 142. Pixel 9 landscape (rotation 1): left 142 + top 137, viewport 870×336.
-   **Pixel 9 soft keyboard**: the AVD has `hw.keyboard=yes` and `show_ime_with_hard_keyboard=0`, so no IME shows. Set it to 1 for the test and restore it to 0. The WebView takes 5-10 s to resize on this host: poll ~10 s before measuring. With the IME open, portrait leaves 533 px and landscape leaves 108 px.
-   **Escape trap**: `input keyevent 111` (ESC) reaches the page and closes dialogs. Hide the IME with CDP `document.activeElement.blur()`.
-   **Android Back** without `@capacitor/app` finishes the activity, even with web history.
-   **Airplane mode** does not change `navigator.onLine`: the manifest lacks ACCESS_NETWORK_STATE.
-   **TalkBack** is installed on the API 36 images. Enable it with `settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService` + `accessibility_enabled 1`, and disable it with `null`/0. Speech isn't in logcat. The green focus box in a screencap is the usable evidence. A notification-permission prompt appears on first enable: answer "Don't allow" with a double tap.
-   **Host 8 GB**: boot with `-memory 2048 -cores 2 -no-snapshot`. A "Process system isn't responding" loop that Wait doesn't clear means a cold reboot. Close extra chrome-devtools MCP pages first. Run one emulator at a time, and never build while one runs.

-   **node_modules trap (2026-10-10)**: the main checkout's `node_modules` is stale. It has Capacitor 6.1.2 while the lockfile pins 8.5.3. Symlinking it is fine for vitest/type-check/vite (firebase, vue and vite match), but `cap sync` then rewrites the gradle files to JDK 17 and the APK is wrong. Always `npm ci` in the QA worktree before an Android build. It took 7 s from the cache.
-   **Back-button baseline**: without `@capacitor/app`, Android Back exits the app from every route. Compare any Back change against the main APK. Use real taps for navigation: CDP `.click()` and `router.push` entries are skippable by Chrome. Note, though, that a JS `history.back()` still lands on entries that timers pushed.
-   **Other agents' emulators**: the engineer may boot `Pixel_Tablet_API_36` in parallel. Use `adb -s`/`ANDROID_SERIAL` (`adb -s <serial> emu avd name` maps serials to AVDs). Two emulators on 8 GB kill one of them.

Related: [[evidence-harness]], [[android-qa-environment]], [[api-auth-qa-recipe]]
