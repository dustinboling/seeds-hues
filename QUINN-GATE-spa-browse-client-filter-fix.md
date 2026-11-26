# QUINN GATE — SPA browse client-navigation filter fix (PR #86, branch muse/45775891107, HEAD 36fac13)

Gate: Quinn Assurance (independent; did not build this work). Date: 2026-11-26 (PT).
Gate object: PR #86 in github.com/dustinboling/seeds-hues — "Browse client-navigation filter fix", built under brief `muse-tasks/spa-browse-client-filter-fix.md` (bench run 45775891107). This gate is **Stage 1 of return condition 2** from `QUINN-GATE-spa-preview-visual-fix.md` (F2, Critical, pre-existing: a real-browser filter tap on browse surfaces did not filter — the client-navigation `index.pageContext.json` response carried the unfiltered totals while SSR of the identical URL was correct). Stage 2 — the confirmation drive on the deployed Worker preview after merge + redeploy — is the closing step of return condition 2 and follows the merge (see the Stage 2 addendum at the end of this record).

> **Provenance note (tenth conversion coordinator, 2026-11-26):** this record was not committed at merge time. It is reconstructed faithfully from the gate summary Quinn filed in PR #86's Gate record section (appended pre-merge under the C1 mechanism) and the builder accounting appended to the same PR body from run 45775891107's run log. Wording below follows that filed summary; nothing has been added to the Stage 1 sections beyond structure. The Stage 2 addendum is the tenth coordinator's own work and is labelled as such.

## VERDICT: PASS (Stage 1 of return condition 2)

No findings at any severity.

## 1. The fix under gate (from the builder accounting, run 45775891107)

**Root cause:** the serve/Worker edge mock applied the variety-detail cache key — which deliberately ignores every query but `?small_farm=true` — to Vike's client-navigation data URL `/variety/index.pageContext.json`. Quinn's Flow 1 (tab-bar navigation to Varieties) warmed that key with the unfiltered JSON, and the later `?color_family=white` tap was served the same entry: 200 with the unfiltered total. The other layers were exonerated from Vike 0.4.270's own source: `handlePageContextRequestUrl` strips the `/index.pageContext.json` suffix while preserving the query, so `+data.ts` reads the filter correctly — the cold render was always right; only the cache key dropped the query.

**Fix:** `.pageContext.json` paths are bypassed from the edge mock entirely (never served, never stored) in both servers via one shared helper, matching Slice 4's rule that browse indexes stay uncached.

- `app/src/server/edge-cache.ts` — new `isPageContextJsonPath()` helper with the rationale.
- `app/server/serve.ts` and `app/server/worker-handler.ts` — `cacheable` now excludes those paths (header/inline docs updated).
- `app/tests/build/slice4-browse.test.ts` — build-level test: unfiltered warm, then `?color_family=white` asserts total 17 (was 55 when red), then clean-again asserts 55.
- `app/tests/unit/worker.test.ts` — Worker-level test with a query-varying stub render: 3 renders, 0 edge entries.

Diff: 5 files, +83/−7.

## 2. Suite reproduction

- Verify reproduced independently: **73 files / 1,467 tests**, green (the workflow gate summary on the PR records the same figures).

## 3. Mutation discipline

- Disabling the bypass turned both new tests RED (the Worker's filtered fetch served the stored unfiltered body; slice4 `expected 55 to be 17`).
- Starting-red independently confirmed on the pre-fix tree.

## 4. Real-browser drive (Stage 1 — Node serve harness, live API)

Chromium, phone 390×844, touch context, live API, warm-then-tap, no full reloads:

- `/variety`: 831 → tap Hue **White** → pageContext total **125**, matching SSR of the identical URL exactly; **Clear All restored 831 in place**.
- `/crop/snapdragon`: 71 → **5**.
- `/seller/geoseed`: 199 → **57**.
- `/search?q=zinnia`: 51 → **9**.
- Pressed state + applied-filter row correct on every surface; aria-busy observed on all swaps; the visual pending class observed on `/variety`.

## 5. What this PASS does and does not close

This PASS closes Stage 1 of return condition 2 (the fixed build, driven in a real browser on the program's Node-serve harness). Return condition 2 closes only with Stage 2: the same drive against the **deployed Worker preview** after merge + redeploy. Until Stage 2 is recorded, the preview is not represented as finished and Slice 9 cutover does not proceed on the strength of this gate alone.

---

## Stage 2 addendum (tenth conversion coordinator, 2026-11-26 — coordinator evidence, not Quinn's)

- **PR #86 merged** at `88d0e71` (2026-11-26T08:44:34Z); merge-commit Verify SUCCESS.
- **Preview redeployed** from the merged tree (preview worktree reset to `88d0e71`; `npm run build:worker` + `npm run deploy:preview` via the `v2/tmp/cf-run.py` token wrapper): Worker `seeds-hues-preview` version **8bc31250-e2ac-47c8-9ef4-324dba94d441**, superseding 60dcec36 (the pre-F2 build). Preview home answers 200 with `X-Robots-Tag: noindex, nofollow`.
- **Worker-path proof at HTTP fidelity (the defect's own mechanism), warm-then-filtered, pageContext vs SSR of the identical URL:**
  - `/variety`: warm pageContext total **831** → `?color_family=white` pageContext total **125** (`state.hue: ["white"]`) == SSR count line "125 varieties · White, alphabetical. Page 1 of 6."
  - `/crop/snapdragon`: warm **71** → filtered pageContext **5** == SSR count line "5 varieties match, alphabetical" (JSON-LD `numberOfItems: 5`).
  - `/seller/geoseed`: warm **199** → filtered pageContext **28** == SSR count line "28 listings, in stock first" (Hue: White applied).
  - `/search?q=zinnia`: warm **51** → filtered pageContext **2** == SSR filtered count 2.
  - Pre-fix, the same warm-then-filter sequence returned the stored unfiltered body (831 on `/variety`); post-fix every surface's client-navigation payload carries the filtered total. (The Stage 1 browser totals for shop/search — 57 and 9 — were taken with different filter selections; the Stage 2 figures above use Hue White throughout and are internally consistent with SSR, which is the acceptance comparison.)
- **Still outstanding — the interactive half of Stage 2:** the chip-tap drive in a real browser against the deployed Worker (in-place swap with no reload, pressed-state movement, applied-filter row, Clear All in place, pending cue / aria-busy during the swap). This could not be executed from the conversion VM: its headless Chromium (Playwright cache builds, headless shell and full chrome) fails every egress path to the preview with `ERR_TUNNEL_CONNECTION_FAILED` — via the egress proxy with credentials, via the proxy's IPv4 literal, and direct — the same VM/browser limitation long recorded for Cloudflare properties; Quinn's Stage 1 drive ran against the local Node serve for the same reason. The interactive drive is routed to Hue's cloud-browser session, which can reach the workers.dev preview. **Return condition 2 therefore remains open on its interactive leg only; the data-path defect itself is proven fixed on the deployed Worker.**
- Production seeds.hues.flowers verified untouched at the end of Stage 2 work: home 200, `_next/static` present (Next.js), no noindex header.
