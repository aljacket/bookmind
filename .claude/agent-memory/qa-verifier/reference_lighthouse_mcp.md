---
name: lighthouse-mcp
description: How to get Lighthouse mobile numbers for BookMind via chrome-devtools MCP - lighthouse_audit has NO performance category, perf comes from a throttled trace + in-page FCP/TBT probe; path limits; /login baseline (card #51, 2026-10-09)
metadata:
    type: reference
---

Proven on card #51 (tooling end-to-end test), about 10 minutes:

-   **Dev server**: `npm run dev:frontend` in the background, poll `curl localhost:5173/login` until 200 (ready in under 2 s). Stop it with TaskStop and confirm 5173 is free.
-   **`lighthouse_audit` (device mobile, mode navigation)** returns only Accessibility, Best Practices, SEO and "Agentic Browsing". **No Performance score.** `outputDirPath` outside the main checkout is refused ("not within workspace roots"), so leave it out and copy the `/var/folders/.../chrome-devtools-mcp-*/report.json|html` files to the scratchpad. Parse the failures with a Node one-liner over `audits` where score < 1.
-   **Performance**: `emulate` with viewport `360x780x3,mobile,touch`, `cpuThrottlingRate 4`, `networkConditions "Slow 4G"`, then `performance_start_trace` (reload + autoStop) for LCP, the LCP breakdown and CLS. FCP/TBT are not in the trace summary: `navigate_page` with an `initScript` that registers longtask and layout-shift PerformanceObservers, then `evaluate_script` reads `first-contentful-paint` and sums (duration - 50) over long tasks after FCP. Reset throttling afterwards (`cpuThrottlingRate 1`, omit networkConditions).
-   **Screenshots**: `take_screenshot filePath` outside the checkout is refused. The inline screenshot gets saved by the harness under `~/.claude/projects/<proj>/<session>/tool-results/mcp-chrome-devtools-blob-*.png`. Copy that file to the scratchpad as evidence. No extra headless Chrome is needed for a single shot.
-   **Caveat**: these are dev-server (unbundled Vite) numbers. Compare branch vs `main` on the same server type, or use `npm run build && npx vite preview` for realistic absolute values.
-   **/login baseline at 360 px, dev server, 2026-10-09**: A11y 82, BP 96, SEO 83. LCP about 4.9 s (load delay 4.3 s, logo image), FCP about 4.9 s, CLS 0 to 0.07, TBT about 0. Failures: link color contrast 3.78 (#d4620e on white), no `<main>`, language `<select>` without a label, no meta description, invalid robots.txt (SPA fallback HTML), low-res logo. Forgot/Register links are 20 px tall (below 44).

Related: [[evidence-harness]], [[android-qa-environment]]
