# Quinn Gate — Item 3.1b-1 (Tranche 3), PR #50

**Verdict: FAIL**

**Target:** PR #50, head `8ff481d` — the shared in-place browse machinery generalized, plus home, /crop index, /search rebuilt onto it (brief `muse-tasks/tranche-3-1b1-browse-surfaces.md` incl. the 2026-11-22 addendum; repair brief `muse-tasks/tranche-3-1b1-repair-1.md`; SPEC §2 parity clauses B-1…B-13 as quoted in the briefs — the tranche-3 SPEC.md file itself is absent from the repo tree, only `DECISIONS.md` is present; judged against the brief, which quotes the SPEC's clauses verbatim).

**One-line summary:** The repair at the PR's tip is correct, the generalized machinery is sound, and /variety is unharmed — but the item itself is not built. Home and /search were never rebuilt (their page files are byte-identical to the build's base), and /crop — the one surface that was rebuilt — fetches an endpoint that does not exist, so every in-place filter change on /crop fails. A green suite certified all of this twice, because no test in the build checks that a surface consumes the machinery or that a named endpoint exists.

Four axes, kept separate per the gate standard: **Severity** (per finding, below) · **Evidence** (directly observed — my own verify run, source audit, HTTP responses, and a real-browser drive of the built branch; nothing below rests on the maker's claims) · **Coverage** (ledger at the end) · **Verdict** (this line).

---

## Findings (vital few first)

### F1 — BLOCKER: /crop in-place filtering cannot complete — `GET /api/browse/crops` is 404; the route was never created

- **Object:** `v2/components/crop/CropBrowse.tsx` fetches `API_PATH = "/api/browse/crops"`; `v2/app/api/browse/` contains only `varieties/route.ts`. No crops route, no search route, anywhere in the tree (route table enumerated from source).
- **Browser evidence (real Chromium, local build of the PR head, 390px):** on `/crop`, tapping the "Cool Season Hardy Annuals" chip issued `GET /api/browse/crops?season=cool` → **404** → the §2.5.6 failure path fired: prior results stand (124 crops), URL unchanged, control state reverted, exactly one `role="alert"` line — *"That filter didn't apply — you're still seeing the previous results. Try again."* Every deliberate filter change on this surface takes this path; there is no other outcome available to a JavaScript user.
- **Independent HTTP evidence:** `curl` against the same server: `/api/browse/crops?season=spring` → 404 (HTML not-found page); `/api/browse/search?q=zinnia` → 404; control `/api/browse/varieties?season=spring` → 200 JSON.
- **Expected vs actual:** the brief requires /crop to consume the shared machinery with first paint and updates on the same payload. The service layer exists (`catalog.browseCrops`, validators, payload guards — all present and unit-green); the endpoint that serves it was never written. The shared plumbing file `lib/api/browse-route.ts` is imported by no route — dead code anticipating the missing routes.
- **Severity:** Blocker. The core task of the item on this surface — filter the crop index in place — cannot be completed in the shipped (hydrated) product. Nielsen 4 (frequency: every attempt; impact: task impossible in place; persistence: every time). The SSR/no-JS floor still works (links navigate to server-rendered filtered pages), which is a workaround outside the shipped interaction, not a completion of it.
- **Irony recorded because it matters for the fix:** B-13, the failure path, is the only new behavior a /crop user can ever see — and it behaves exactly to spec (see §5). The machinery is right; its endpoint is absent.

### F2 — CRITICAL: Home was not rebuilt — none of B-1 / B-2 / B-5-count-line / B-12 landed on `/`

- **Object:** `v2/app/page.tsx` — **absent from the build diff** (byte-identical to merge-base `16810ec` and to current main).
- **Render evidence (390px, at rest):** `data-testid="filter-result"` count line **absent** (its mount is still conditional on active filters — the exact defect §2.5.9 / brief item 2 says this item closes); chips are 6 plain links with **no per-option counts** ("All", "Cool Season Hardy Annuals", …); **no applied row**; 0 `button.chip-filter` (no in-place layer exists to hydrate).
- **Expected vs actual:** brief item 2 requires the unconditional persistent live-region count line, the designed filtered-empty state, per-option counts, and the applied row on home. None is present. This is not a partial landing; the surface is untouched.

### F3 — CRITICAL: /search was not rebuilt — B-11 (Life cycle) absent; no counts, no applied row, no in-place layer

- **Object:** `v2/app/search/page.tsx` — likewise absent from the build diff; it still hardcodes `lifeCycle: null` and passes `groups={["season", "method", "hue"]}`.
- **Render evidence (390px, `/search?q=zinnia`):** results title live region present ("51 results for "zinnia""); filter legends are **Season / Sowing method / Hue — no Life cycle group**; chips are 20 links, no counts; no applied row.
- The service/validator layer for search exists (`catalog.browseSearch`, search payload schema, `lib/browse` search helpers) — built, unit-green, and consumed by nothing: no route, no page wiring.

### F4 — MAJOR (process, chronic): T-A non-vacuity is unsatisfiable — the build added no tests, and the suite has no existence/consumption census

- The build diff (vs merge-base) touches exactly two test files: the census repair (F-item judged in §3) and nothing else. **Zero new tests** accompany 1,300+ lines of new machinery and service code. Brief gate item T-A ("every new test fails against pre-build code") has no new tests to apply to.
- This is the mechanism of the escape, and it is chronic, not sporadic: the workflow verify gate certifies the suite; the suite proves the machinery's internals and the surfaces' *old* pins, but contains no check that (a) a route file exists for each `/api/browse/*` path a component fetches, or (b) a named surface's page actually renders the shared component. F1–F3 are invisible to that suite by construction — the same absence-of-evidence shape as the BusyForm escape, one level up (there, handler tests couldn't see browser form construction; here, unit tests can't see a missing route).
- **Recommendation to the coordinator (not a fix I am making):** the repair brief for this item should include census-style tests in the tranche-2-3-chips.test.ts tradition — a static census asserting each `API_PATH` named in a browse component has a route, and each 3.1b-1 surface's page renders its browse component — so this class fails the workflow gate next time instead of reaching Quinn.

### Note (not a defect): `BrowseFilters.tsx` was touched, contrary to a literal reading of the fence list

The diff changes `BrowseFilters.tsx` (+30/−…): `ChipCount` and `BrowseFilters` gain an optional `unit` prop defaulting to `"varieties"` — the previously hardcoded word. Default-preserving: every pre-existing surface renders identically (verified in the /variety drive and the /crop SSR floor, where the sr-only counts read "52 crops" only because the new machinery passes `unit="crops"` explicitly). The brief's own fence named `FilterStrip`, not `BrowseFilters`, and the per-surface unit is required by §2.4.2's announcement rule. Recorded so the coordinator sees the touch; judged within the machinery generalization, not a fence break.

### Accounting note: the `PROGRAM.md −7` in the diff vs current main is a base-divergence artifact

The branch forked at `16810ec`, before coordinator note #17 landed on main (`f01efec`). The naive diff vs `origin/main` (17 files, +1304/−552) shows #17's lines as deleted; the build never touched the file (vs merge-base the build is 14 v2 files + the carried repair brief). A merge will not remove #17. Judge scope from the merge-base diff, as this record does.

---

## Item-by-item gate results

### 1. Verify reproduction — PASS (as a reproduction; it proves the suite, not the item)

In the pre-materialized worktree (`8ff481d`), `npm install` then `npm run verify`: **exit 0 — 69 test files / 1,174 tests, all passing**, exactly reproducing the repair run's workflow gate. Lint and typecheck green. This confirms the counts in the handoff to the letter — and, per F4, confirms only what the suite covers.

### 2. Scope & contract audit — FAIL (scope incomplete; contracts sound where built)

- **Registered change set:** present and correct for the machinery generalization (InPlaceBrowse, in-place.ts, browse.ts, catalog service, validators, browse-route plumbing) and the /crop index. **Missing from the change set:** `app/page.tsx` (home), `app/search/page.tsx` (/search), `app/api/browse/crops/route.ts`, `app/api/browse/search/route.ts`, any home/search browse components. Fences respected where work exists: no sort work, no home composition change, no SearchBox change, `/crop/[slug]` and `/seller` untouched, `SellerFilterSection.tsx` untouched, Small Farm legend neither dropped, duplicated, nor moved (rendered once, under the Sellers strip, in both the SSR `BrowseFilters` form and the hydrated `InPlaceFilters` form).
- **Snapshot contract (brief §3 / T-C):** PASS. `InPlaceSnapshot<S, P>` in `lib/in-place.ts` is a flat interface — `state`, `counts`, `items`, `total`, `page` sit directly on the snapshot; no consumer reads a nested `.payload` (grep: zero hits in components/app); no surface declares its own snapshot shape (CropBrowse/VarietyBrowse both alias the shared type).
- **Trap classes:** no disabled fieldset (the hydrated form's `<fieldset>` carries no `disabled`); no no-JS POST anywhere in the browse layer (no `<form>` in InPlaceBrowse/CropBrowse/VarietyBrowse); /variety's in-place path preserved (drive, §5); BrowseFilters — see the Note above.
- **T-C (no prices):** PASS. The payload core is `{ items, total, counts }` (+ `page`/`pages` echoes in the wire shape); `CropListItem` carries slug/commonName/latinName/varietyCount/media. No price field in any payload or on any surface in the diff.

### 3. The census judgment — PASS: a faithful exception-follows-the-machinery, not a weakening

My independent call, from source and render:

- `InPlaceBrowse.tsx` renders **both** remover forms from one component: the SSR/no-JS `<Link>` (line ~493) and the hydrated `<button>` (line ~481), both `chip-filter chip-removable`, both with the pinned accessible name. This is precisely the dual form SPEC §2.6 mandates and the 3.1a exception described.
- `VarietyBrowse.tsx` renders **no remover** (grep: zero `chip-removable` in the file; it composes `InPlaceAppliedRow`). Leaving its census entry in place would have registered an exception for a file that no longer needs one — the repair correctly removed it, keeping the exception naming *exactly* the files that carry the machinery.
- **No other file gained a button remover:** the only other `chip-removable` uses in the tree are the admin listing list's `<a>` links (unchanged, link-form). The census's default — `["a", "Link"]` everywhere else — is unbroadened: no wildcard, no second file.
- The workflow gate of run 45133498406 already proved the census fails without the move (the verbatim failure is quoted in the repair brief); on this branch the census file passes in my full verify run and in a targeted re-run (3 files / 49 tests with the motif and 1.4 pins, all green).
- The replacement comment records the move in the original's voice and states the invariant ("everywhere else a remover is still a link").

Had this repair arrived alone, it would pass. It does not rescue the PR, because the PR's subject is the item, not only the repair.

### 4. Shipped-behavior pins (the addendum's five fences) — all PASS

1. **Motif divider:** render-verified — `data-testid="home-motif"` present on home and positioned between the hero and "Browse by crop" (DOM order check in the drive); `motif-divider.test.ts` green.
2. **Tranche 1.4 hero line + Recent friendly dates:** `tranche-1-4.test.ts` green in the full run and the targeted re-run; hero headline render-verified ("Find where to buy any flower seed").
3. **SSR removable chips as links:** render-verified on /crop SSR — the applied row's remover is an `<a>` with `aria-label="Remove the Season filter, Cool Season Hardy Annuals"`, Clear All an `<a href="/crop">`; census green.
4. **`catalog.browseCrops` exists and serves the surfaces:** present (`lib/services/catalog.ts`), consumed by the /crop page's first paint (SSR render shows its counts: "All (124)", "Cool Season Hardy Annuals (52)"). It serves first paint; the in-place endpoint that would serve updates is F1.
5. **`divider-stem-mini mt-1`:** present verbatim in home card markup (`app/page.tsx` line 119); suite assertions green.

### 5. Rendered-difference audit + browser drive (usability pass)

**Environment:** the PR head served locally (`next dev`, local D1 state from the PR #49 gate worktree), driven in real Chromium (Playwright headless shell) at 390px and 1280px. Dev-mode timing is slower than production; every state reported below is a settled state, and the 404 is a missing route file, independent of serving mode. **Evaluator structure: single evaluator (Quinn); no cold second rater was commissioned for this gate** — the FAIL rests on absence/breakage facts established by byte-identity, HTTP status, and DOM state, not on rated impressions, so no severity rating here depends on a second rater. My one timing observation (an optimistic pending state visible before a slow dev-mode 404 landed) resolved on the instrumented re-drive and is not a finding.

**Flow 1 — /crop, goal: "Narrow the crop list to one season" (390px).** Page loads with the persistent count line ("124 crops in the directory, alphabetical.", `aria-live="polite"`, `aria-atomic="true"` — §2.5.9 satisfied on this surface), counted chips, correct SSR floor. After hydration the chips are buttons; tapping one fires the fetch → 404 → failure path (F1). **The user can never complete this goal in place.** Feedback quality of the failure itself is to spec: prior results held, no spinner/skeleton, state reverts, one clear alert in plain language with a next step ("Try again"). Usability severity: Nielsen 4 for the flow (see F1). Zero state: the designed empty state exists in code (`data-testid="crop-empty"`, `EMPTY_CROP_BROWSE`, Clear filters offered in place, applied row above) but could not be render-driven — no season×method combination in the local data yields zero (all counts > 0); recorded as code-verified, render-unproven.

**Flow 2 — Home, goal: "See how many crops fit a season, and narrow the grid" (390px).** There is nothing to drive: at rest there is no count line, chips carry no counts, and every chip is a plain navigation link (the pre-3.1 behavior). The mandated B-1/B-2/B-5-clause differences are absent (F2). No regression vs main — the surface is byte-identical to it — but the item's home deliverable does not exist.

**Flow 3 — /search, goal: "Filter zinnia results by life cycle" (390px).** Impossible: the Life cycle group is not on the page (F3). The results title live region works as before; chips are links without counts; no applied row. Pre-item behavior, unchanged.

**Flow 4 — /variety regression (390px + 1280px).** Goal: "Narrow varieties to two hues, then turn the page." Multi-select Hue toggles update in place: URL gains `?color_family=white,blush`, count line announces "135 varieties · White · Blush, alphabetical. Page 1 of 6.", applied row shows both removers as hydrated `<button>`s with Clear all, no alert, no reload. At 1280px, the page-2 link soft-navigates and renders page 2's items with "Page 2 of 33" — **the N-D1 fix from PR #49 still holds** on the generalized machinery. No usability findings on this surface.

**Change-register conformance (T-B):** on /crop, the rendered differences are within B-1/B-2/B-12/B-13 as designed (where they can manifest at all). On home and /search the register fails in the other direction: mandated differences B-1, B-2, B-5-clauses, B-11, B-12 are **missing**, which the brief defines as defects of this item. No out-of-register difference was found anywhere in the diff or the renders.

### 6. What would make this pass

A repair dispatch that (a) adds `app/api/browse/crops/route.ts` and `app/api/browse/search/route.ts` on the existing `browse-route.ts` plumbing and service methods, (b) builds the home and /search surfaces onto the shared machinery per brief items 2 and 4 (unconditional count line + zero state + counts + applied row on home; Life cycle group + counts + applied row with `q`-carrying Clear All on /search), and (c) adds the F4 census-style tests so the workflow gate can see this class. The machinery, the census repair, and the /crop surface code need no rework that this gate found — the missing pieces attach to them as designed.

---

## Coverage ledger

- **Population:** the brief's gate list for 3.1b-1 — 3.1-A drives on `/`, `/crop`, `/search`; 3.1-B beacons; 3.1-D applied row incl. JS-off floor; 3.1-E zero states; 3.1-G announcements on home + /crop; 3.1-H no-JS floor; 3.1-I exemplar regression; 3.1-J parity census; 3.1-K failure path; T-A/T-B/T-C; full verify; the census judgment; the five addendum pins.
- **Checked:** full verify reproduced (69/1,174 green); merge-base diff audited file by file; snapshot contract and trap classes from source; census from source + suite + the prior run's quoted failure; all five pins by test and (1, 3, 4) by render; browser drives of all four surfaces at 390px and /variety paging at 1280px; HTTP status of all three browse endpoints; /crop SSR floor incl. applied-row link forms and counted chips; /variety soft-nav paging (N-D1).
- **Partial:** /crop zero state — code-verified, not render-driven (no zero-yielding filter combination exists in the local data). 3.1-B (no beacon on in-place change) — not separately instrumented: on /crop no in-place change can succeed (F1), on home/search no in-place layer exists; the hook source fires no beacon and /variety's behavior is unchanged from the gated 3.1a build. Announcements on home (3.1-G) — moot, the live region itself is absent (F2).
- **Exclusions:** `/crop/[slug]` and `/seller` (Item 3.1b-2, fenced out of this item and untouched in the diff); production deployment (pre-merge gate); 320px spot check and reduced-motion/enlarged-text states (no new animation or layout in the diff; the verdict turns on absence, which is viewport-independent).
- **Residual risk:** because home and /search are byte-identical to main, the class of defect this coverage could still miss there is nil for regression and total for delivery — both stated plainly above. For /crop's SSR floor and /variety, a defect could still hide in production-mode timing (dev server used here); the coordinator's post-merge live verification remains the backstop, as with every gate.

**Gate record filed by Quinn Assurance, 2026-11-23. Verdict: FAIL — do not merge. The census repair is approved on its own merits and should ride the item's repair dispatch unchanged.**
