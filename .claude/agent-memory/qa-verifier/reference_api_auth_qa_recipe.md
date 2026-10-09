---
name: api-auth-qa-recipe
description: How to verify BookMind API-client cards (Bearer token, timeouts, 401/429, CORS Origin) on web and Android without touching production or config - stub, CDP interceptor, real-backend no-token CORS probe, device driving pitfalls (card #62, 2026-10-09)
metadata:
    type: reference
---

Proven on card #62 (PR #19), full round ~2 h, mostly because of emulator instability:

-   **Sessions**: the Pixel_9_API_36 AVD holds a real Firebase session (operator test account), so it is the only place a real ID token gets sent. Pixel_Tablet_API_36 has none: use the Pinia fake user there. Then no `Authorization` header is sent, which is expected. Never tap "Accedi di nuovo" on the Pixel 9: it signs out the operator's session and there is no password to sign back in. Test sign-out on the tablet or in the browser.
-   **Never point the real backend at a real token**: it would write quota docs to the production Firestore. A real backend without a token is safe: `bookmind-server/venv/bin/python -m uvicorn main:app --port 8011` from the worktree with `OPENAI_API_KEY=dummy`. Then `curl -H 'Origin: https://localhost'` proves the 401 carries `access-control-allow-origin`, and the OPTIONS preflight proves `Authorization` is allowed.
-   **Stub**: Node http on 127.0.0.1:8000 with `/__mode?clarify=ok|429|401|500|503|hang&recs=...&mark=tag`. It logs the Origin and whether `authorization` is present, and decodes only aud/iss/exp from the JWT (never print the token). In `hang` mode, log `res.on('close')` timing: that is the client timeout measured server-side.
-   **Device network**: `adb reverse tcp:8000` alone fails with `net::ERR_CLEARTEXT_NOT_PERMITTED` (from `network_security_config`). What works without changing files: a background CDP session (`Fetch.enable` on `http://localhost:8000/*`) that forwards each paused request to the stub with **the WebView's own headers** (Origin, Authorization, Sec-Fetch-\*), then answers with `Fetch.fulfillRequest`. The stub then logs the real WebView `Origin` = `https://localhost`. The interceptor dies when the app restarts: restart it.
-   **Timeouts in the browser**: on a Vite dev server, `await import('/src/services/api/axios.ts')` in the page gives the live module, so you can time `api.post` (default) against `fetchClarifier` (override) with the stub in `hang` mode.
-   **Device driving pitfalls**: (1) the screen can be off (black screencap, taps ignored): `input keyevent KEYCODE_WAKEUP`. (2) A system "isn't responding" dialog swallows taps: find "Wait" with `uiautomator dump` and loop until the focused window is not "Not Responding". If it comes back, cold-boot with `-no-snapshot`. (3) Never use BACK to close the IME on /preferences, because it leaves the app when the IME is already hidden. Use the CDP `document.activeElement.blur()`. (4) Taps on Send are ignored while the textarea is disabled (awaiting): poll `!textarea.disabled` before the next step. A Node driver with one CDP socket plus `execSync` adb taps was reliable. Shell scripts that call `dev.mjs` per step were not.
-   **Rotation on the tablet**: `accelerometer_rotation` goes back to 1 by itself. Set it to 0 again, then set `user_rotation 3` for portrait, and wait for `cur=1600x2560`.
-   The operator merged PR #19 during QA. Check with `git diff <head> origin/main -- src`. If the PR is already merged, a PASS card goes to "Da rilasciare" (the board's entry policy), not to Review & Merge.

Related: [[evidence-harness]], [[android-qa-environment]], [[keyboard-composer-preexisting]]
