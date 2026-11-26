# QUINN GATE — SPA preview visual fix REPAIR (PR #85, branch muse/45764032799, HEAD aae7312) — DELTA RE-GATE of the PR #84 FAIL

Gate: Quinn Assurance (independent; did not build this work). Date: 2026-11-25 (PT).
Gate object: PR #85 in github.com/dustinboling/seeds-hues — "Preview visual fix — REPAIR: filter-strip root overflow (Quinn gate F1)", successor to PR #84 (contains PR #84's full tree plus the repair). Worktree: `~/workspace/seeds-hues-visualfix-wt` (pre-materialized, HEAD aae7312; PR #84's tip 0c7f00f in its ancestry).
Prior gate: `QUINN-GATE-spa-preview-visual-fix.md` — FAIL on F1 (Major, filter-strip root overflow). This re-gate returns on F1 only. F2 (Critical, pre-existing, browser filter tap does not filter) is out of this PR's scope, is NOT a return condition here, and is carried in §5. F3 (Minor, builder accounting) is judged on substance in §6.
Method: suites reproduced in the worktree; the new guard's starting-red executed by me on a scratch archive of the pre-repair tree; app built and served locally (`npm run serve`, `SEEDS_API_BASE=https://seeds.hues.flowers/api/v1`, live catalog data — same harness as the first gate); full rendered sweep 18 routes × 390×844 and 1280×900 saved to `~/workspace/seeds-hues-preview-fix/sweep3/` (`quinn3-report.json` + 36 PNGs + 1 shop-card element capture); a dedicated strip-function probe and a shop-card-footer probe run against the same serve; screenshots personally viewed. Severity, evidence, coverage, and verdict are kept on separate axes throughout.

## VERDICT: PASS WITH NOTES

F1's return condition is met in full, on rendered evidence: every one of the 36 route×viewport combinations measures scrollWidth == clientWidth, and the filter strips still scroll internally with their fades and chevrons intact — the containment did not kill the strip. No new defect was found in scope. The notes (§7) are informational: the diff carries the repair brief document alongside the two claimed files; F2 stands unchanged and still blocks preview acceptance/cutover as its own lane item; the standing Chromium/CDN fidelity caveats are unchanged. This PASS covers PR #85's diff only — it is not a preview-acceptance or cutover verdict (F2 governs those).

---

## 1. Suite reproduction (evidence: directly observed, my own runs)

- **`npm run verify` in `app/` — GREEN, exit 0.** lint + typecheck + vitest: **73 test files passed / 1,465 tests passed** — exactly the expected delta over the first gate's 72 / 1,461 (the +1 file / +4 tests are the new containment guard). The shipped `tests/unit/css-coverage.test.ts` is in the suite and passed (also re-run standalone by me: 3/3 green — the unstyled-class accounting remains **0**, empty allowlist).
- **Build:** `npm run build` + `build:server` exit 0; PWA post-build proof passed.

## 2. Guard discrimination — PROVEN by my own execution

- Method: `git archive 0c7f00f` (PR #84's tip, the pre-repair tree) extracted to a scratch copy, ONLY `app/tests/unit/filter-strip-containment.test.ts` added, `node_modules` linked from the worktree.
- **Pre-repair tree: 2 failed / 2 passed** — the failures are precisely the two repair rules: (1) `.filter-strip-list` must establish a containing block; (2) a narrow max-width media query must stack `.shop-card-footer`. This matches the maker's claimed starting-red exactly.
- **PR #85 tree: 4/4 passed** (standalone re-run by me, and inside the full verify).
- The guard discriminates: it is red on exactly the tree that rendered the overflow and green on the repaired tree.

## 3. Rendered sweep — F1 return condition (evidence: measured, Chromium, DOM CSS pixels via `documentElement.scrollWidth − clientWidth`, deviceScaleFactor 2, scroll position 0)

All 18 routes × both viewports, served from the PR #85 tree with live API data (sweep3):

| Route | Phone (390×844) | Desktop (1280×900) |
|---|---|---|
| home `/` | 0 | 0 |
| `/variety` | **0** (was +1255) | **0** (was +429) |
| `/variety/snapdragon-cool-crimson` | 0 | 0 |
| `/variety/dahlia-seed-aa-giant-flowered` | 0 | 0 |
| `/crop` | 0 | 0 |
| `/crop/snapdragon` | **0** (was +915) | **0** (was +89) |
| `/seller` | 0 | 0 |
| `/seller/geoseed` | **0** (was +5603) | **0** (was +4777) |
| `/search?q=zinnia` | **0** (was +1148) | **0** (was +322) |
| `/series/snapdragon-chantilly` | 0 | 0 |
| `/state/oregon` | 0 | 0 |
| `/account` | 0 | 0 |
| `/add-your-farm` | 0 | 0 |
| `/report` | 0 | 0 |
| `/about` | 0 | 0 |
| `/admin/sign-in` | 0 | 0 |
| `/admin` | 0 | 0 |
| 404 (`/no-such-page-sweep`) | 0 | 0 |

**36/36 combinations at scrollWidth == clientWidth.** Statuses 200 throughout except the deliberate 404 route (404, correct). Placeholders (`[data-placeholder]`): none on any route. The full sweep was re-run, not only the four strip routes — no neighbor route picked up displaced overflow, which is the regression this re-gate was specifically charged to watch for.

## 4. Strip function — containment did not kill the strip (evidence: measured, live probe on the served app)

On each strip route, every `.filter-strip-list` was probed: internal scrollWidth vs clientWidth, programmatic `scrollLeft` advance, fade and chevron-button presence.

- **Phone:** `/variety` — 4 of 6 strips overflow internally and advance (e.g. Hue strip 1656/370, scrollLeft → 120); `/crop/snapdragon` — 2 of 4 (1316/370 → 120); `/seller/geoseed` — 4 of 6 (widest 6004/370 → 120); `/search` — 3 of 4 (1549/370 → 120). Every internally-overflowing strip carries 1 fade + 2 chevron buttons, visible.
- **Desktop:** each route retains at least one internally scrollable strip that advances (e.g. `/variety` Hue 1656/1132 → 120; `/seller/geoseed` 6004/1132 → 120); strips whose content fits the wider measure correctly show no fades/buttons and do not scroll — the component's designed state logic (`canLeft`/`canRight`), unchanged.
- Root stayed at viewport width throughout (390/390, 1280/1280) while strip internals scrolled — the exact behavior the design intends: strip scrolls, page does not. The strip internal widths (1656, 6004) match the magnitudes that previously leaked to the root, confirming the same content is now contained rather than removed or clipped away.
- Mechanism note: the maker's refinement of my first-gate mechanism (the chips' `sr-only` count spans, absolutely positioned with their containing block on the `.filter-strip` wrapper outside the scroller) is consistent with all rendered evidence at this gate — `position: relative` on the list collapses the root overflow to zero on every strip route while leaving strip internals byte-for-byte the same widths. I did not independently re-probe the spans' offsetParent; the fix's rendered behavior is what this gate certifies.

## 5. F2 — carried, untouched (scope confirmation only)

`git diff 0c7f00f..HEAD` touches no data-path file: no pageContext, loader, hook, serve-layer, or browse-logic file appears in the diff (see §6). The client-navigation filter defect therefore stands exactly as recorded in the first gate — Critical, pre-existing, briefed as its own lane item. Per this re-gate's charter it is not re-litigated here; it continues to block representing the preview as finished and blocks cutover until it is fixed and re-driven in a real browser.

## 6. Diff scope and code read

`git diff 0c7f00f..HEAD --stat` — 3 files:

- `app/src/templates.css` (+23) — the entire code change, read line by line: (1) `position: relative` added to `.filter-strip-list` with an explanatory comment, no offsets — layout-neutral as claimed; (2) `@media (max-width: 440px)` stacking `.shop-card-footer` (`flex-direction: column; align-items: stretch`). Nothing else in the stylesheet changed.
- `app/tests/unit/filter-strip-containment.test.ts` (+153, new) — the guard proven in §2.
- `muse-tasks/spa-preview-visual-fix-repair.md` (+112) — the repair brief document itself, committed as a blob for the dispatch (the same in-tree brief pattern PR #84 used). Not app code; named here for exactness against the "only 2 files" shorthand — the claim is accurate for the app tree.

No `v2/` files, no data-path files, no component files. Unstyled-class accounting: **0** (css-coverage guard green in-suite and standalone; §1).

## 7. Personally viewed (screenshots, sweep3) and the shop-card footer judgment

Personally viewed: phone — home, `/variety`, `/crop/snapdragon`, `/seller/geoseed`, `/search`, plus a targeted element capture of a shop card on the GeoSeed page; desktop — `/variety`.

- **Tab bar (regression check):** phone home and every viewed phone route show the bar with **five icons + labels** (Home / Crops / Varieties / Sellers / Search), active state correct per route (Home on `/`, Varieties on `/variety`, Crops on `/crop/snapdragon`, Sellers on `/seller/geoseed`, Search on `/search`). Measured on `/seller`: phone bar 390×65 CSS px, 5 links; desktop bar `display: none`, 0×0 — absent at desktop, as required. Desktop `/variety` shows the top nav instead.
- **Strips:** on phone `/variety` and `/search` the strips render as styled single-line chip rows with counts, right-edge chevron buttons and fades, all inside the viewport; on desktop `/variety` the Hue strip runs to the right edge with its chevron and fade — the strip bands are visually unchanged in form from the pre-repair gate's screenshots (the maker's pixel-identical claim was not independently pixel-diffed by me; visual equivalence in the viewed bands is what I certify).
- **Stacked shop-card footer (below 440px) — judged against the brief's mandate (shop measures exactly 0): met, with no visual objection.** Measured on `/seller/geoseed` at 390px: footer computed `flex-direction: column`; the visit pill (x 33–174 CSS px) sits fully inside its card (x 16–191); root 390/390. At desktop the same footer computes `row` — side-by-side preserved outside the bleed zone. In the viewed card capture, the footer reads as a deliberate stack — "Report a problem" link above a full-width "Visit shop →" pill, both inside the card's bounds, spacing consistent with the card's other rows. Nothing about it reads as breakage.
- Home carries the full live figures (831 varieties · 124 crops · updated Nov 25, 2026) — no recurrence of the first gate's transient reduced-summary capture.

## 8. Coverage ledger

- **Population:** 18 routes × 2 viewports = 36 rendered combinations; the full `app/` suite (73 files / 1,465 tests); the complete diff vs PR #84's tree.
- **Strata / structured sample:** all 18 sweep routes at both viewports (every template family, incl. zero-seller variety, shop, state, series, admin sign-in, admin wall, 404); every filter strip on all 4 strip routes at both viewports probed for internal scroll function (20 strip instances); the guard test executed on both trees (red pre-repair, green repaired); the css-coverage guard re-run standalone.
- **Personally viewed (not just metrics):** phone — home, variety list, crop detail, seller shop, search, one shop-card element capture (6); desktop — variety list (1). The remaining 30 screenshots were captured and metric-checked (overflow, placeholders, status, title, tab-bar links) but not eyeballed.
- **Random/adversarial addition:** the deliberate 404 route (in the sweep set); the footer probe's cross-viewport direction check (column at 390, row at 1280) as a boundary check on the 440px media query's scope.
- **Exclusions, with reasons:** F2's filter flow was not re-driven (charter: scope confirmation only — the diff touches no data-path file); the production v2 spot-check the maker mentioned (v2 `/variety` at 1754) was not performed — v2 parity is not this gate's criterion, the brief's zero-overflow criterion is; signed-in admin interior (no credentials held; `/admin` presents the sign-in wall, no overflow); WebKit/Safari rendering (no access from this VM — unchanged caveat from the first gate); image pixels themselves (the image CDN is unreachable from this VM's Chromium, so artwork renders as alt-text frames in local screenshots, exactly as in sweeps 1–2; image layout boxes verified constrained, image content not); a pixel-diff of strip bands pre/post (visual equivalence certified instead, §7).
- **Evaluator structure:** single evaluator, Quinn; no cold second rater commissioned for this delta re-gate — per the evaluator-effect literature a single pass finds roughly a third to two-fifths of problems; this verdict rests primarily on deterministic rendered measurements (36/36 sweep, strip probes), which are not evaluator-dependent.
- **Residual risk:** visual detail in the 30 metric-only screenshots; WebKit-specific rendering of the new containment; any defect class that only appears with real image pixels loaded; F2 and everything downstream of it (owned by its own lane item, not this gate).

## 9. Notes (the WITH NOTES in the verdict — none is a defect against this PR)

- **N1 (transparency):** the branch diff vs PR #84's tree is 3 files, not 2 — the third is the repair brief document (`muse-tasks/spa-preview-visual-fix-repair.md`), process documentation in the established in-tree pattern. The maker's "only 2 files" is accurate for the app tree.
- **N2 (carried condition):** F2 (Critical) is unchanged by this PR and still blocks preview acceptance and cutover; this PASS must not be read as clearing either.
- **N3 (fidelity):** all rendered evidence is Chromium against the local Node serve with live API data — the program's standing harness, same as the first gate. The deployed Worker preview was not part of this gate.
- **F3 closure on substance:** the accounting the first gate found unfiled is established independently here — starting-red reproduced by me (§2), unstyled-class accounting 0 (§1, §6), and the repair's two CSS rules are the whole code change (§6). The coordinator's append of this run's accounting to PR #85's body is a pre-merge paperwork step, not a gate condition.
