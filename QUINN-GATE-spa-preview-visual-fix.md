# QUINN GATE — SPA preview visual fix (PR #84, branch muse/45751502048, HEAD 0c7f00f)

Gate: Quinn Assurance (independent; did not build this work). Date: 2026-11-25 (PT).
Gate object: PR #84 in github.com/dustinboling/seeds-hues — "Preview visual fix — tab bar port, preflight parity, missing component CSS".
Acceptance source: `muse-tasks/spa-preview-visual-fix.md` (read in the pre-materialized worktree `~/workspace/seeds-hues-visualfix-wt`).
Method: suites reproduced in the worktree; starting-red executed on the pre-fix tree; app built and served locally (`npm run serve`, port 8931, `SEEDS_API_BASE=https://seeds.hues.flowers/api/v1`, live catalog data — the same harness as the diagnosis sweep); rendered sweep at 390×844 and 1280×900 saved to `~/workspace/seeds-hues-preview-fix/sweep2/` (`quinn-report.json` + 36 PNGs + drive captures); screenshots personally viewed; a human-interaction drive run in Chromium (Playwright) against the served app.

## VERDICT: FAIL

One in-scope Major defect (F1) fails the brief's headline acceptance criterion on the four browse surfaces that carry filter strips, at both viewports. One Critical pre-existing defect (F2), outside this PR's diff but exposed by this gate's first real-browser filter drive, is carried as a hard blocker for preview acceptance and cutover. Severity, evidence, coverage, and verdict are kept on separate axes throughout this record.

---

## 1. What was reproduced (evidence: directly observed, my own runs)

- **`npm run verify` in `app/` — GREEN.** lint + typecheck + vitest, exit 0. Final counts from the complete run log: **72 test files passed / 1,461 tests passed** (includes the two new files: `tests/dom/tabbar.test.tsx` 14 tests, `tests/unit/css-coverage.test.ts` 3 tests). Build (`npm run build` + `build:server`) exit 0; PWA post-build proof passed.
- **Starting-red DISCRIMINATION — PROVEN by my own execution.** Method: `git archive HEAD~1` (6457714, the pre-fix tree) extracted to a scratch copy, ONLY the two new test files added, `node_modules` linked from the worktree. Result: **2 files failed — 16 tests failed / 1 passed of 17** (the single pass is the empty-allowlist exactness check, which is trivially true on any tree). The tab-bar tests fail on the placeholder shell; the CSS-coverage test fails with the unstyled-class list. The new tests discriminate.
- **Root verify chain:** there is no root `package.json` verify; the v2 chain was not run — justified exclusion: the PR diff touches **zero** `v2/` files (verified from the diffstat: 39 files, all under `app/`).

## 2. Findings

### F1 — MAJOR (in scope). Filter-strip routes still overflow horizontally at the root; the brief's zero-overflow criterion fails on 8 of 36 route×viewport combinations.

- **Standard violated:** the brief's Acceptance, verbatim: "Rendered at 390×844 and 1280×900, every route … zero horizontal overflow (scrollWidth == clientWidth)".
- **Evidence (measured, Chromium, coordinate space: DOM CSS pixels via `documentElement.scrollWidth − clientWidth`, viewport 390×844 / 1280×900, deviceScaleFactor 2, scroll position 0):**
  - Phone: `/variety` **+1255**, `/crop/snapdragon` **+915**, `/seller/geoseed` **+5603**, `/search?q=zinnia` **+1148**.
  - Desktop: `/variety` **+429**, `/crop/snapdragon` **+89**, `/seller/geoseed` **+4777**, `/search?q=zinnia` **+322**.
  - The other 28 combinations measure **0** (see §3 table).
  - This is real root scrollability, not a metric artifact: `window.scrollTo(500, 0)` moves `window.scrollX` to 500 on all four phone routes. On desktop the routes carry a horizontal scrollbar.
- **Mechanism (pinpointed by live mutation probes on `/variety`, each from a fresh reload):** every beyond-viewport element on `/variety`, `/search`, and `/crop/snapdragon` sits inside a `.filter-strip-list` scroll container (overflow-x: auto) — there are no unclipped offenders — yet the root still inflates. Setting `overflow-x: hidden` on `.filter-strip` collapses document scrollWidth 1645 → 390; setting the list's `display` from flex to block also collapses it to 390; setting `overflow-x: hidden` on the list itself changes nothing. The flex strip scroller's scrollable overflow propagates to the root in Chromium despite the intermediate scroll container; the containment the design intends (strip scrolls, page does not) is not achieved. The maker is not asked to take my mechanism as the fix — it is recorded so the return starts from evidence, and any fix must be re-proven rendered, per route.
- **Severity reasoning:** Major, not Critical — all content renders correctly and every task remains completable (contrast the pre-fix state, where content was clipped and unstyled); but the failed criterion is the headline acceptance line of a PR whose entire purpose is closing the overflow defect Dustin failed the preview for, it fails on the flagship browse surfaces at both viewports, and there is no user workaround. Usability rating (Nielsen): **3 — major** (frequency: every visit to a browse surface; impact: page can be dragged/scrolled sideways, desktop shows a horizontal scrollbar; persistence: constant).
- **Boundary:** propagation was proven in Chromium (the diagnosis sweep's engine, whose +32px findings matched Dustin's phone report). Whether WebKit/Safari propagates the same way on Dustin's iPhone was not testable from this VM and is **not assumed** either way; the brief's criterion is stated in sweep terms and fails on those terms.

### F2 — CRITICAL (out of scope for this PR's diff; pre-existing; hard blocker for preview acceptance / cutover). In a real browser, tapping a browse filter chip does not filter.

- **Discovered by:** this gate's human-interaction drive (§4), the first real-browser drive of the in-place browse flow; prior slice gates proved this flow at jsdom + HTTP fidelity only.
- **Evidence chain, link by link (entered → constructed → transmitted → received → rendered):**
  - Entered: on `/variety` (phone 390×844, touch context), tapped the Hue group's **White** chip.
  - Constructed/transmitted: URL became `/variety?color_family=white` with no full reload (a window marker survived); the app issued `GET /variety/index.pageContext.json?color_family=white`.
  - Received: that request returned **200 with `"total": 831`** — the unfiltered catalog (verified by direct fetch of the same URL). The first broken link is the pageContext response itself.
  - Rendered (after 12 s settle): count line still "831 varieties, alphabetical. Page 1 of 35", the Hue group's pressed chip is still **All**, no applied-filters row exists, first card unchanged. The user is told nothing went wrong; the URL claims a filter the page does not show (visibility-of-status failure, Nielsen heuristic 1).
  - Control: full-page SSR of the identical URL is **correct** — title "White — flower seed varieties", filtered set (125 total; 24 items on page 1 in JSON-LD), matching production's response to the same URL. The defect is specific to the client-navigation data path.
- **Not caused by PR #84:** the diff's component changes are CSS imports, added class names, and one class rename (`chip-filter` → `guide-tab` on guide tabs); browse logic, the `+data.ts` hook (which reads `pageContext.urlParsed.searchOriginal`), and the serve layer are Slice 4-era code, untouched. Filed here per the rule that a serious defect found outside the assigned scope is reported, not buried.
- **Severity reasoning:** Critical as a product defect — filtering the catalog is a core task of the directory, and it fails silently for every real-browser user of the SPA. Usability rating (Nielsen): **4 — catastrophe** for the filter flow (task blocked, failure invisible to the user). It does not add a second reason to return PR #84's diff (F1 already does); its return condition is separate: **the preview must not be represented as finished, and cutover must not proceed, until the filter flow is fixed and re-driven in a real browser.**
- **Fidelity boundary:** proven in the app's own Node serve (`server/serve.ts`) — the program's standing test harness, and the harness both sweeps used. The deployed Worker preview was not re-driven at this gate (no deployment in scope); the data hook is shared code but the serve's edge-cache layer is serve-specific, so which layer drops the query is **unproven** — the Worker path is named unchecked, not assumed clean and not assumed broken.

### F3 — MINOR (accounting / evidence). The brief's PR-summary accounting is not filed in the tree.

- The brief requires the PR summary to state (a) the new tests' starting-red results, (b) components adjusted for box-sizing fallout, (c) the final unstyled-class accounting. No builder summary exists anywhere in the worktree (tree searched). Whether the coordinator appended one to the GitHub PR body could not be checked from this gate (no GitHub read in scope) and is stated as unchecked rather than assumed absent there.
- The underlying properties are independently established at this gate, so this does not block on substance: starting-red reproduced by me (§1); unstyled-class accounting reproduced two ways (§5); box-sizing fallout — the diff's component edits are class additions/imports, and every non-strip route renders at its correct geometry in the sweep, so no fallout symptom was observed rendered.

### Trivial observations (not defects against the brief)

- T1: `scroll-padding-bottom` remains `calc(5rem + safe-area)` at ≥768px while the tab bar is hidden. Layout clearance correctly drops at ≥768px (footer padding 6rem → 2rem, shell.css), so no content is padded for a bar that isn't there; only the focus scroll-into-view offset retains the allowance. Cosmetic at most.
- T2: on `/seller/geoseed`, `a.shop-card-visit` rects reach right=393 at a 390 viewport (3px unclipped) — an independent 3px contributor, subsumed in F1's shop figure.
- Evidence caveat (not a finding): the sweep's first home screenshot captured a transient reduced API summary (85 varieties · Nov 20); a recapture minutes later and the SSR HTML both show the full live data (831 varieties · 124 crops · updated Nov 25, 2026), matching sweep1. The home route's visual checks (eyebrow wrap, tab bar, overflow 0) are unaffected.

## 3. Rendered sweep results (sweep2, my serve of the PR tree, live API data)

Statuses: 200 on all routes except the deliberate 404 route (404, correct). Placeholders (`[data-placeholder]`): **none on any route**. Tab bar links on every route: `Home|Crops|Varieties|Sellers|Search`.

| Route | Phone overflow | Desktop overflow |
|---|---|---|
| home `/` | 0 | 0 |
| `/variety` | **+1255 (F1)** | **+429 (F1)** |
| `/variety/snapdragon-cool-crimson` | 0 | 0 |
| `/variety/dahlia-seed-aa-giant-flowered` | 0 | 0 |
| `/crop` | 0 | 0 |
| `/crop/snapdragon` | **+915 (F1)** | **+89 (F1)** |
| `/seller` | 0 | 0 |
| `/seller/geoseed` | **+5603 (F1)** | **+4777 (F1)** |
| `/search?q=zinnia` | **+1148 (F1)** | **+322 (F1)** |
| `/series/snapdragon-chantilly` | 0 | 0 |
| `/state/oregon` | 0 | 0 |
| `/account` | 0 | 0 |
| `/add-your-farm` | 0 | 0 |
| `/report` | 0 | 0 |
| `/about` | 0 | 0 |
| `/admin/sign-in` | 0 | 0 |
| `/admin` | 0 | 0 |
| 404 (`/no-such-page-sweep`) | 0 | 0 |

**Acceptance items that PASS, personally viewed in screenshots** (phone unless noted): tab bar present with five real icons + labels on every phone route; active state correct per route — Home on `/`, Varieties on variety list/detail/zero-seller, Crops on crop detail **and** on `/series/…` (v2's `/series*` → Crops rule), Sellers on shop **and** on `/state/oregon` (v2's `/state*` → Sellers rule), Search on `/search`, none on 404. No dashed placeholder boxes anywhere (contrast sweep1's home shot, where all five are visible). Home kicker/eyebrow wraps inside the viewport (pre-fix it ran off the right edge). Header hamburger fully inside the viewport. Browse filters render as styled single-line chip strips with counts, edge fades, and chevron buttons — not fieldset boxes. Shop facts and contact rows render separated and readable ("Location / Clinton, SC", "Varieties listed / 199", phone and email as distinct icon rows — the pre-fix "Clinton, SCSouth Carolina" / "Customer service888-645-2323" run-together is gone). Series facts card rows separated. State plate and 404 art constrained to the layout (pre-fix: 1602px / 882px blowouts). Desktop: tab bar absent (computed `display: none`, measured 0×0 at 1280×900; phone bar measured 390×65 CSS px, link targets 78×64 — ≥44px per the brief and WCAG 2.2 SC 2.5.8 / Apple HIG 44pt).

**Color-disc ruling (the brief's open check): MATCHES PRODUCTION — no defect.** Cool Crimson's header disc renders diagonal-striped in the app because the variety has no color on file: the app's SSR HTML carries `aria-label="Cool Crimson: no color on file"`, and production's own HTML for the same page carries the identical label (production's facts block likewise reads "Hue, Unknown"). The app's `Swatch.tsx` is code-identical to v2's for all three chip kinds (solid hex / mixed conic / hatched none) — the stripes are the designed no-color placeholder in both, not a port error.

## 4. Usability block (human-interaction pass — non-waivable step, run)

Evaluator structure: **single evaluator** (Quinn); no cold second rater was commissioned for this gate — per the evaluator-effect literature a single pass finds roughly a third to two-fifths of problems, and this block is read with that limit. Viewport: phone 390×844, touch context, Chromium, served PR tree with live API data.

- **Flow 1 — "Move between sections using the bottom tab bar."** Steps: landed on `/`, tapped Varieties → Sellers → Search → Crops → Home. Each tap navigated client-side (window marker survived; no full reload), the URL changed, and `aria-current` moved to the tapped tab every time. No friction; state comprehension immediate. **No findings.**
- **Flow 2 — "Narrow the variety list to white varieties."** Steps: on `/variety`, scrolled the Hue strip, tapped **White (125)**. Expected: list narrows to 125, White shows pressed, an applied-filter row offers removal. Actual: URL gained `?color_family=white`; nothing else changed — count, cards, pressed state, and applied row all stayed at the unfiltered state after a 12 s settle, with no error or pending cue. **Finding F2 (Nielsen 4).** The chips' styling itself (this PR's subject) is correct: single-line strip, swipeable (the strip's own scroller moves; chevron buttons are hidden on touch per v2's hover-capable-pointer media rule — by design, fades are the touch affordance), counts visible, pressed styling legible on the groups that do render state.
- **Flow 3 — unhappy path: search with no results.** `/search?q=zzqqx-nonexistent` renders "Not in the catalog yet" with all filter counts at 0 — the dead end is named, not silent, and the search box remains available to retry. **No finding.**
- **Stop points / boundaries:** the admin interior was not driven (no credentials held; `/admin` correctly presents the sign-in wall — screenshot viewed, form inside the viewport, no overflow). Strip chevron buttons were not clickable in the phone context because they are `display: none` on hover-incapable pointers by design; their desktop presence is visible in the desktop screenshots. No bot check was encountered.

Findings summary (usability): 1 × severity-4 (F2), 1 × severity-3 aspect within F1. F2 is named in the verdict conditions above.

## 5. CSS-coverage accounting (independently rerun)

- The shipped guard (`css-coverage.test.ts`, AST extraction + dynamic-family assertions + an **empty** allowlist — no class is excused as a hook/state class, so there is nothing hidden in an allowlist) passes on the PR tree and fails on the pre-fix tree (§1).
- My own independent simple cross-check (different extractor: literal `className` strings vs CSS selectors): PR tree — **555 literal tokens, 622 selectors, 0 missing**; pre-fix tree — **177 missing** of 548 tokens (brief said ~150; the AST count and mine bracket it). The two methods agree on the only question that matters: nothing used is unstyled after the fix.
- Judgment: the accounting is **complete and honest**. Every remaining class token is styled; the intentional-un-styled set is empty and the test fails if an allowlist entry ever goes stale.

## 6. Code read (diff inspected, not only tests)

`TabBar.tsx` and the five tab icons were read against `v2/components/layout/TabBar.tsx` and `v2/components/layout/icons.tsx`: tab order, hrefs, active-match rules (including `/series*` → Crops and `/state*` → Sellers), SVG paths, and geometry values match v2; the active state is rendered from Vike page context, so prerendered HTML carries the correct tab (confirmed in the per-route screenshots). `TabBarPlaceholder` and its `.tabbar-*` CSS are deleted. `tokens.comp.json` gains the five `comp.tabbar.*` roles traced to the v2 rules. Preflight parity is exactly the two measured rules (border-box; media max-width + height auto) at the top of `shell.css`. Component diffs beyond CSS are limited to CSS imports, added class names, and the guide-tab rename noted in F2.

## 7. Coverage ledger

- **Population:** 18 routes × 2 viewports = 36 rendered combinations; the full `app/` test suite (72 files / 1,461 tests); every class token in `app/src` + `app/pages`; the brief's acceptance list.
- **Strata / structured sample:** all 18 sweep routes (every template family in the brief's list, incl. zero-seller variety, shop, state, series, admin sign-in, admin wall, 404); both viewports on all of them; the two new tests executed on both trees (green on PR, red on pre-fix).
- **Personally viewed (not just metrics):** phone — home, variety list, variety detail, variety zero-seller, crop detail, seller shop, search, series, state, admin sign-in, 404 (11); desktop — variety list (1); plus drive captures (filtered variety, empty search) and a home recapture. The remaining screenshots (phone: crop list, seller index, account, add-your-farm, report, about, admin; desktop: the other 17) were captured and metric-checked (overflow, placeholders, tab-bar links, status, title, h1) but not eyeballed.
- **Random/adversarial addition:** the no-results search (unhappy path) and the deliberate 404 route; live mutation probes on the strip CSS (F1 mechanism).
- **Exclusions, with reasons:** v2 verify chain (zero v2 files in the diff); deployed Worker preview (no deployment in this gate's scope — the local serve is the program's standing harness and both diagnosis and this gate used it; the Worker data path is named unchecked under F2); signed-in admin interior (no credentials held); WebKit/Safari rendering (no access from this VM — F1's Safari impact unproven either way); image pixels themselves (the image CDN is unreachable from this VM's Chromium — `ERR_TUNNEL_CONNECTION_FAILED` — so artwork renders as alt-text frames in every local screenshot, exactly as in sweep1; image *layout boxes* were verified constrained, image *content* was not).
- **Evaluator structure:** single evaluator, Quinn; no second rater commissioned (see §4).
- **Residual risk:** defects in the 25 metric-only screenshots' visual detail; WebKit-specific rendering of the strip containment; the Worker preview's data path (F2); and any class of defect that only appears with real image pixels loaded. A clean re-gate after the F1 fix must re-run the full sweep, not only the four failing routes, because containment fixes routinely move overflow to a neighbor.

## 8. Return conditions

1. **F1 (this PR):** strip-carrying routes measure scrollWidth == clientWidth at 390×844 and 1280×900, with the strip still swipeable and its chevrons/fades intact; full 36-combination sweep re-run at re-gate.
2. **F2 (lane, blocking preview acceptance/cutover, not this diff):** a filter tap in a real browser narrows the results, moves the pressed state, and shows the applied-filter row — proven by a browser drive, with the pageContext response carrying the filtered totals; the Worker preview path driven explicitly, not inferred from the Node serve.
3. **F3:** the builder accounting (starting-red, box-sizing fallout, unstyled-class accounting) filed where the gate can read it.

— Quinn Assurance
