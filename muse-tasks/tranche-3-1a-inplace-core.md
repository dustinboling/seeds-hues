# Tranche 3.1a — In-place filter core on /variety (+ FilterStrip A3 finish)

Source: `backlog-2026-11-21/tranche-3/SPEC.md` §2 (normative in full) and §9 row 2 (this build's split). Quinn's design gate on the Tranche 3 spec PASSED after amendments A-1…A-7. **PB-2 is RULED (Dustin, 2026-11-22): Hue is multi-select** — independent toggles, OR within Hue, AND across every other group, one remover chip per selected hue, per-option counts per §2.4.5. Build to the multi-select design, not the single-select fallback.

## Scope — one surface, the complete model

This build proves the in-place core on `/variety` only (SPEC §9: the core is the tranche's engineering risk; a core defect must be found once, on one surface). In scope:

- **The enhancement layer (§2.5):** `BrowseFilters` becomes the enhanced filter component — server-rendered links with `aria-current="true"` as the floor; after hydration, buttons with `aria-pressed` per §2.5.8, stable keys (no chip remounts across state changes), one history entry per deliberate change, Back/Forward restoring state in place, page reset to 1 on any filter change, last-selection-wins fetch discipline, and §2.5.6's failure path (prior results/counts/URL stand, control reverts, one `role="alert"` error line with the applied row). Pagination stays true navigation (§2.5.5). No page-view beacon fires on a local change (§2.5.7).
- **The counts payload (§2.4 + §2.5.6):** server-computed per-option counts, from the same payload as the results they describe — first paint and every in-place update consume the identical contract, so SSR and in-place can never disagree. Zero-count options render their `0` and stay operable (§2.4.3).
- **Multi-select Hue (§2.4.5, §2.5.8, §2.6.1):** Hue's buttons are independent toggles (any number pressed, none = All). A hue's count is the result total **if that hue were toggled** from its current state, other groups held. Hue's "All" chip clears the set; its count is the total under the other groups alone. The applied row carries one remover per selected hue. The URL keeps the existing `color_family` parameter name (encoding of the set is yours; the name is not new). Every other group stays single-select.
- **Applied row + Clear All (§2.6)** on `/variety`: `.chip-filter.chip-removable` per active group (one per hue under multi-select), accessible names starting "Remove…", Clear All resetting all groups in one action/entry/announcement, row absent when nothing is active, zero-results state inside the results region with the row visible and focus per §2.6.3. The no-JS floor is server-rendered: removers and Clear All are working links (§2.6.4).
- **FilterStrip finish — Ada A3 (§2.7), the one shared-component change:** strip list padding `px-1.5 py-1.5`, `scroll-padding-inline: 3rem`, chevron buttons 44px (`h-11 w-11`). Nothing else in FilterStrip changes.
- **Announcement (§2.5.9):** `/variety`'s count line (`#variety-results-count`) already complies — verify it stays a persistent, never-remounted live region through the swap; do not regress it.

## Out of scope — later builds, do not touch their behavior

- `/`, `/crop`, `/search`, `/crop/[slug]`, `/seller` keep today's link behavior exactly (3.1b spreads the core). The enhancement must be opt-in per surface so those pages render and behave as today; the A3 strip finish above is the only cross-surface change, and it is registered.
- The sort control (§5.2) is Item 3.4's build, not this one — but the core you build is the layer it will ride (§2.5.1 names it a local-scope control); do not build the control itself.
- `SellerFilterSection.tsx` (variety detail): **no change** — regression-checked only (§8, 3.1-I).
- Home and `/crop` count-line repairs (§2.5.9) and their empty states (§2.6.3) belong to 3.1b. The Small Farm legend does not move, drop, or duplicate (§2.3).

## Proof (the gate will re-run all of it, real browser, 390px first)

SPEC §8, scoped to this build: **3.1-A** (in-place drive on `/variety`: no document load, scroll/focus preserved, ≤400ms swaps, exactly one history entry per tap, Back/Forward in place), **3.1-B** (no beacon on local changes; pagination still fires it), **3.1-C** (counts reconcile against fresh server loads, ≥6 options incl. one 0-count and every "All"; rapid two-group change ends consistent), **3.1-D** (applied row + Clear All, in-place and JS-off), **3.1-E** (zero-results recovery + focus), **3.1-F** (A3 rendered proof: full focus ring unclipped at 390px, chevrons 44×44 computed), **3.1-G** (exactly one announcement per change from a pre-existing region), **3.1-H** (no-JS floor: every chip a working link, correct server-rendered state), **3.1-I** (the exemplar regression), **3.1-K** (forced-failure path per §2.5.6), plus whole-tranche **T-A** (suite green; every new test fails on pre-build code — non-vacuity both directions), **T-B** (rendered differences exactly the §7 register items for Item 3.1 on `/variety` + the A3 finish — nothing else, on any surface), **T-C** (no price in any rendered surface or in the new payload — enumerate the payload's fields in the PR body).

State the non-vacuity runs (new tests FAIL on current main, PASS on your branch) in the PR body.

## Discipline (standing, from prior tranche lessons)

- No scratch or fixture files anywhere in the tree. ESLint per file group as you go; strict narrowing in tests; expected values in tests DERIVED from source data, never hardcoded counts that drift.
- Finish discipline (bought by Tranche 3.5's cancelled run): run the full `npm run verify` once, as the last act. If verify fails, fix only failures in files this task touched, re-run verify once more, and finish. If a failure sits in files this task did not touch, do not chase it — finish with the PR body reporting the failure verbatim and the files it sits in. Do not iterate beyond two verify runs.
- The PR body carries the standard accounting: files changed, verify counts (files/tests, branch vs merge-base), the proof results, the payload field list (T-C), and the non-vacuity statement. The rendered-change confirmation may claim only what is literally true.
- US spelling. No prices anywhere. Nothing outside this item's scope.
