# Tranche 3.1b — Filter parity spread: home, /crop, /search, crop detail, seller cloud (Item 3.1b)

## Provenance

Tranche 3 SPEC §2 (filter model parity) + §9 build split row 4: "Spread: home, `/crop`, `/search` groups, crop-detail rebuild onto `BrowseFilters` (UX-04), seller cloud — mechanical per-surface application of a gate-proven core." Design gate PASS (with the delta re-gate on amendments A-1…A-7); all six of Dustin's Tranche 3 rulings are in `backlog-2026-11-21/tranche-3/DECISIONS.md` (PB-2 = multi-select Hue is the one that binds this build, via SPEC §2.4.5).

Item 3.1a — the in-place core on `/variety` — has SHIPPED (PR #49, merged e9106a1; Quinn re-drive PASS, record `QUINN-GATE-tranche-3-1a-pr49.md`): the enhanced `BrowseFilters`, the §2.5.6 update payload with per-option counts, the applied row, and the FilterStrip A3 finish (3.1-F) are live and gate-proven on `/variety`. **This build extends that same machinery to the remaining §2.2 surfaces. It does not build a second system, and it does not change `/variety`'s behavior.**

Base: current `main` (post-3.1a). Read before building: SPEC §2 in full (`backlog-2026-11-21/tranche-3/SPEC.md`), §7's register, §8's Item 3.1 checks, and the shipped 3.1a implementation on `/variety` (your pattern source).

## What to build (SPEC §2.8 per-file list, the rows not already shipped)

1. **Home — `v2/app/page.tsx`.** The count line renders **unconditionally** as a persistent live region (`aria-live="polite"`, `aria-atomic="true"`; at rest it reads the unfiltered crop total, e.g. "124 crops") — its current conditional mount is a defect this item closes (§2.5.9). Add the designed filtered-empty state (§2.6.3, register B-12). Filters consume the enhanced component with per-option counts (§2.4) and the applied row (§2.6).
2. **Crop index — `v2/app/crop/page.tsx`.** The count line gains the live-region attributes; add the designed filtered-empty state (B-12); enhanced component + counts + applied row.
3. **Search — `v2/app/search/page.tsx`.** Groups become `["season", "method", "lifeCycle", "hue"]` — **Life cycle is added** (register B-11; §2.2's settled table — Sellers is NOT added, per the recorded interpretation). Enhanced component; applied row (its Clear All link carries `q`, §2.6.4); counts. The results `<h2 id="results-title">` remains the live region.
4. **Crop detail — `v2/app/crop/[slug]/page.tsx`.** The hand-rolled filter rows are **deleted**, not restyled. Rebuild onto `BrowseFilters`/`FilterStrip` with groups `["sellers", "hue", "series"]`, mapping the crop model's existing state shape onto the shared component **without changing URL parameters** — `color_family`, `series`, `has_sellers` keep their names and meanings. Hue chips gain swatch dots; inline group labels become the eyebrow legends (register B-3). The existing count line (`#crop-results-count`) and empty states are preserved. Season / Sowing method / Life cycle stay header facts, never one-option filters (§2.2).
5. **Seller index — `v2/components/seller/StateFilter.tsx`.** Cloud layout, counts, and glyphs **unchanged** (the sanctioned counted-cloud exception, §2.3). The chips join the in-place enhancement so the seller grid updates in place; the applied row follows §2.6.2's bounded exception: the single State remover shows, Clear All is omitted there ("All states" remains the reset).
6. **Shared machinery.** Extend the shipped 3.1a in-place layer and its §2.5.6 payload (results + total + per-option counts + applied set, atomically, one request per deliberate change) to these surfaces — first paint and updates consume the same payload so SSR and in-place can never disagree. Per-option counts follow §2.4 exactly, including §2.4.5's toggle semantics for multi-select Hue and the zero-count rule (a 0 renders and stays operable).

## Contracts that bind (SPEC §2.5/§2.6 — observables, not intentions)

- In-place updates after hydration: no document navigation, no route skeleton, no repaint of header/hero/strips; scroll position unmoved; the activated control keeps focus and stays mounted (stable keys — no remounting chips).
- Budgets: selected dress in the same frame; results ≤ ~400ms (Doherty) with prior results held until the swap; **no spinner, no skeleton**; past 1s, `aria-busy="true"` on the results region is the only permitted addition (the F6 pattern 3.1a shipped).
- URL/history: existing query parameter names unchanged; one deliberate change = exactly one history entry; re-tapping the active option is a no-op; Back/Forward restore state in place; a filter change resets pagination to page 1; pagination itself stays true navigation (§2.5.5).
- Bookkeeping: in-place changes fire **no** page-view analytics and no `ViewBeacon` (§2.5.7).
- Semantics: SSR/no-JS floor = links with `aria-current="true"`; after hydration, `aria-pressed` buttons (independent toggles for Hue); no element carries both; selected state never by color alone; targets stay 44px.
- Announcements: each surface's count line is a persistent live region, present before any change, announcing exactly once per deliberate change (§2.5.9).
- Failure path (§2.5.6, register B-13): on a failed update, prior results, counts, and URL stand; the control's selected state reverts to the last good state; exactly one in-place error line with `role="alert"` appears with the applied row ("That filter didn't apply — you're still seeing the previous results. Try again." — the shipped 3.1a wording stands); not repeated per retry.
- Applied row (§2.6): removers labeled `"{Group}: {Value}"` with accessible names `"Remove the {Group} filter, {Value}"` (the forms Quinn's F2 gate pinned on 3.1a — do not improvise variants); Clear All ("Clear all filters") resets every group in one action, one history entry, one announcement; the row never renders empty; the no-JS floor server-renders removers and Clear All as working links (§2.6.4).
- Zero-results (§2.6.3): the designed empty state renders inside the results region with the applied row visible above it and Clear All offered in place; if the producing action unmounts the activated control, focus lands on the applied row's Clear All.

## Scope fence — what this build must NOT do

- `/variety` and `/variety/[slug]`: no behavior change. `SellerFilterSection.tsx` is **not touched** (regression-checked only, §8 check 3.1-I).
- **No sort control** (§5.2 / register B-6 is Item 3.4) — do not add one anywhere, including `/crop/[slug]`.
- **No home composition change** (§5.1 is Item 3.4): section order, the Recently restocked placement, and the resting-grid cap do not change. Of register B-5, only its count-line clauses land here.
- **No SearchBox change** (§5.3 / register B-8 is Item 3.4): the box's mount behavior, suggestion states, and copy are untouched.
- **The Small Farm legend does not move** (§2.3): on every surface it keeps its current placement — neither drop it, duplicate it, nor relocate it. (Its relocation assignment is a separate open call, not this build.)
- FilterStrip geometry (B-4 / 3.1-F) already landed in 3.1a — touch `FilterStrip` only where the enhancement strictly requires it, with no visual change beyond §2.7's shipped values.
- No price appears in any payload or on any surface (whole-tranche check T-C): enumerate the update payload's fields in the PR's change list; there is no price field.
- **Change register (T-B):** this build's rendered differences are exactly B-1 and B-2 (on the newly covered surfaces), B-3, B-5's count-line clauses, B-11, B-12, and B-13. A difference outside that set is a defect until reverted or carried back as a register amendment.

## Gate

Quinn build gate with real-browser drives (SPEC §8), scoped to the new surfaces: 3.1-A repeated on `/`, `/crop`, `/search` (with a query), `/crop/zinnia`, and `/seller` (State cloud) under the same measured conditions as `/variety`; 3.1-B (no beacon on in-place changes; pagination still fires it); 3.1-C counts reconcile on `/crop/zinnia`; 3.1-D applied row + Clear All incl. the JS-off link floor; 3.1-E zero-results incl. the new home and `/crop` states; 3.1-G announcements on home and `/crop`; 3.1-H no-JS floor on every §2.2 surface; 3.1-I exemplar regression; 3.1-J model-parity census (Life cycle present on `/search`, absent-as-filter on `/crop/[slug]`, crop Hue swatch dots, group order identical everywhere); 3.1-K failure path spot-checked on one new surface; T-A non-vacuity (every new test fails against pre-build code); T-B register audit; T-C no prices. Full verify green.

## Finish discipline

Run the repo's full verify yourself before finishing and leave the tree clean (the workflow re-runs it as the PR gate). Keep commits to the brief's scope.

## PR body hygiene

Provenance (this brief + the SPEC sections), Build accounting (verify summary + diff census), the payload field enumeration (T-C), and a Gate record section for Quinn's verdict.

## Addendum — re-dispatch after run 45115938520 (2026-11-22, coordinator #16)

The first dispatch of this brief (run 45115938520) **failed the workflow's verify gate on a single ESLint error and produced no PR**; the runner's work was discarded, so this re-dispatch starts again from `main`. The failure, from the run's gate log:

- `v2/components/ui/useInPlaceBrowse.ts` (the shared in-place browse hook the build created), line ~136–137: **error — Cannot access refs during render** (react-hooks). The code mirrored the hook's config into a ref during render (`const configRef = useRef({...})` followed by a render-phase `.current` access) so popstate handlers could read latest values through stable identities. React refs may only be accessed outside render (event handlers, effects).

Fix direction (mechanism is yours, the lint gate is not negotiable): keep handler identities stable WITHOUT touching `.current` during render — e.g. update the mirror inside `useEffect`, or restructure so the handlers close over an effect-maintained ref, or drop the mirror and re-subscribe the popstate listener when its dependencies change. Whatever pattern you choose, `npm run verify` must pass in full.

**Finish discipline, restated with emphasis:** the failed run evidently finished without running the repo's full verify itself — the gate's ESLint step was the first full check the code ever met, and because lint runs first, typecheck and the test suite never ran at all. Before you finish, run `npm run verify` (lint + typecheck + vitest) in `v2/` yourself and fix everything it reports. A run that ends with the gate as its first verification has failed its brief even if the gate passes.
