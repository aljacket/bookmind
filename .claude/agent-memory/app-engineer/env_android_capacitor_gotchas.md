---
name: env-android-capacitor-gotchas
description: Machine/tooling gotchas for Android + Capacitor builds and emulator testing on the operator's Mac (JDK, migrator, hooks, emulators, WebView)
metadata:
    type: project
---

Checked 2026-10-08 on the operator's Mac while doing card #50 (Capacitor 8 / API 36).

-   **JDK**: Android Studio 2026.2's JBR is JDK 25 (not 21). Use Temurin 21: `/Users/alfonsocavalieri/.sdkman/candidates/java/21.0.12-tem` via inline `JAVA_HOME` + `PATH`. Gradle 8.2.1 (Capacitor 6) needs JDK 17 (the PATH default). `ANDROID_HOME=/Users/alfonsocavalieri/Library/Android/sdk` must be set (no `local.properties`).
-   **`npx cap migrate`**: needs `--noprompt --packagemanager npm` (stdin prompts break). It runs a platform-less `cap sync` that aborts on CocoaPods when `ios/` exists, before the Android steps: move `ios/` out of the tree during the run, then restore + `git diff --exit-code <base> -- ios`. It also re-resolves hundreds of lockfile packages and rewrites package.json to 2-space: restore both and use `npm install --package-lock-only` instead.
-   **Pre-existing red on main**: `npm run lint` (airbnb-base not a dependency) and `npx vitest run` (LoginPage.spec.js lacks the i18n plugin). Not caused by feature work; follow-up tasks were spawned.
-   **Hook quirks (worktree-isolated Bash)**: any command containing `git` must be a single simple command (no `&&`, no heredoc with `<`/`{}`; use `git commit -F file`), no `export VAR=$HOME...`, no commands with computed paths in variables. Put multi-step logic in scripts written to the scratchpad and run them. The Write/Edit tools run prettier on repo files (reformats the whole file): use python/sed via Bash for byte-exact edits.
-   **macOS has no `timeout`**; Bash tool blocks `sleep N` chains: poll with a bounded `for` loop. Run Gradle/emulator/long scripts with `run_in_background`.
-   **Emulators**: two AVDs at once plus Gradle starve the host (system_server ANRs). Run one emulator at a time; `./gradlew --stop` before booting. `adb -s emulator-5554 emu kill` to stop. Disable Gboard stylus dialog: `settings put secure stylus_handwriting_enabled 0`. The Pixel_9_API_35 AVD already holds a real Firebase session. AVD WebView is 133 (< 140): System Bars plugin pads natively and `--safe-area-inset-*` are 0.
-   **Driving the WebView without credentials**: `adb forward tcp:9222 localabstract:webview_devtools_remote_<app pid>`, then Chrome DevTools Protocol over WebSocket (node 22 has global WebSocket). Fake user: `#app.__vue_app__.config.globalProperties.$pinia.state.value.auth.user = {uid,...}` then `$router.push`. Reading list is IndexedDB `BookMindDB` keyed by uid.
-   **Dev backend from the emulator**: `network_security_config.xml` forbids cleartext; `http://10.0.2.2:8000` needs a local-only overlay (cleartextTrafficPermitted on the 10.0.2.2 domain-config + capacitor `android.allowMixedContent`). Never commit it. Backend: `bookmind-server/venv/bin/uvicorn main:app` (main checkout venv) with `bookmind-server/.env` symlinked.
-   Chrome DevTools MCP cannot save screenshots to the scratchpad (workspace-root restriction); they land in `~/.claude/projects/.../tool-results/`.
