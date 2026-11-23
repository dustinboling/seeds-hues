# Tranche 3.1b-2 — Crop detail rebuild + seller State cloud (Item 3.1b, part 2)

## Provenance

Tranche 3 SPEC §2 (filter model parity) + §9 build split row 4. Item 3.1b was split into two sequential builds after the unsplit build failed the workflow verify gate four times on mechanical errors (record: `backlog-2026-11-21/PROGRAM.md`, coordinators #16–#17). **Part 1 (3.1b-1) has SHIPPED**: the shared in-place machinery, generalized into `v2/components/ui/` (`InPlaceBrowse` + the browse snapshot contract), with home, the /crop index, and /search rebuilt onto it. **This brief is part 2: the crop detail rebuild and the seller State cloud** — the last two §2.2 surfaces. It consumes the shipped machinery; it does not build a second system, and it does not change the behavior of any surface 3.1a or 3.1b-1 shipped.

Base: current `main` (includes 3.1b-1). Pattern sources: the shipped machinery in `v2/components/ui/`, its consumers on home / /crop / /search (3.1b-1), and `/variety` (3.1a). All six of Dustin's Tranche 3 rulings are in `backlog-2026-11-21/tranche-3/DECISIONS.md`; PB-2 (multi-select Hue) binds the crop detail Hue group.

## What to build

1. **Crop detail — `v2/app/crop/[slug]/page.tsx`.** The hand-rolled filter rows are **deleted**, not restyled. Rebuild onto the shared machinery (`BrowseFilters`/`FilterStrip` as generalized by 3.1b-1) with groups `["sellers", "hue", "series"]`, mapping the crop model's existing state shape onto the shared component **without changing URL parameters** — `color_family`, `series`, `has_sellers` keep their names and meanings. Hue chips gain swatch dots; inline group labels become the eyebrow legends (register B-3). The existing count line (`#crop-results-count`) and the existing empty states are preserved. Season / Sowing method / Life cycle stay header facts, never one-option filters (§2.2).
2. **Seller index — `v2/components/seller/StateFilter.tsx`.** Cloud layout, counts, and glyphs **unchanged** (the sanctioned counted-cloud exception, §2.3). The chips join the in-place enhancement so the seller grid updates in place; the applied row follows §2.6.2's bounded exception: the single State remover shows, Clear All is omitted there ("All states" remains the reset).

Per-option counts follow §2.4 exactly, including §2.4.5's toggle semantics for multi-select Hue and the zero-count rule (a 0 renders and stays operable). First paint and in-place updates consume the same §2.5.6 payload (results + total + per-option counts + applied set, atomically, one request per deliberate change), so SSR and in-place can never disagree.

**Machinery consumption rule:** build on the 3.1b-1 machinery as shipped. If a machinery change proves strictly necessary for these two surfaces, keep it surface-generic (no crop- or seller-specific branches in the shared layer), keep every existing consumer's behavior identical, and flag the change and its reason in the PR body — Quinn will judge it as part of the scope audit.

## Contracts that bind (SPEC §2.5/§2.6 — observables, not intentions)

- In-place updates after hydration: no document navigation, no route skeleton, no repaint of header/hero/strips; scroll position unmoved; the activated control keeps focus and stays mounted (stable keys — no remounting chips).
- Budgets: selected dress in the same frame; results ≤ ~400ms (Doherty) with prior results held until the swap; **no spinner, no skeleton**; past 1s, `aria-busy="true"` on the results region is the only permitted addition (the F6 pattern).
- URL/history: existing query parameter names unchanged; one deliberate change = exactly one history entry; re-tapping the active option is a no-op; Back/Forward restore state in place; a filter change resets pagination to page 1; pagination itself stays true navigation (§2.5.5).
- Bookkeeping: in-place changes fire **no** page-view analytics and no `ViewBeacon` (§2.5.7).
- Semantics: SSR/no-JS floor = links with `aria-current="true"`; after hydration, `aria-pressed` buttons (independent toggles for Hue); no element carries both; selected state never by color alone; targets stay 44px. The census rule stands: `chip-removable` renders on links everywhere except the one registered exception (the shared in-place component's hydrated removers) — do not introduce a button remover anywhere else.
- Announcements: each surface's count line is a persistent live region, present before any change, announcing exactly once per deliberate change (§2.5.9).
- Failure path (§2.5.6, register B-13): on a failed update, prior results, counts, and URL stand; the control's selected state reverts to the last good state; exactly one in-place error line with `role="alert"` appears with the applied row ("That filter didn't apply — you're still seeing the previous results. Try again." — the shipped wording stands); not repeated per retry.
- Applied row (§2.6): removers labeled `"{Group}: {Value}"` with accessible names `"Remove the {Group} filter, {Value}"` (the forms Quinn's F2 gate pinned on 3.1a — do not improvise variants); Clear All ("Clear all filters") resets every group in one action, one history entry, one announcement — **except** on the seller State cloud, where §2.6.2's exception applies (single State remover, no Clear All). The row never renders empty; the no-JS floor server-renders removers and Clear All as working links (§2.6.4).
- Zero-results (§2.6.3): the designed empty state renders inside the results region with the applied row visible above it and Clear All offered in place; if the producing action unmounts the activated control, focus lands on the applied row's Clear All.

## Scope fence — what this build must NOT do

- No behavior change on `/variety`, home, `/crop` index, or `/search` (3.1a / 3.1b-1 surfaces — regression-checked only, §8 check 3.1-I). `SellerFilterSection.tsx` is **not touched**.
- **No sort control** (§5.2 / register B-6 is Item 3.4) — do not add one anywhere, including `/crop/[slug]`.
- No SearchBox change (§5.3 / register B-8 is Item 3.4).
- **The Small Farm legend does not move** (§2.3): on every surface it keeps its current placement — neither drop it, duplicate it, nor relocate it.
- FilterStrip geometry (B-4 / 3.1-F) is shipped — touch `FilterStrip` only where the enhancement strictly requires it, with no visual change beyond §2.7's shipped values.
- No price appears in any payload or on any surface (whole-tranche check T-C): enumerate the update payload's fields in the PR's change list; there is no price field.
- **Change register (T-B):** this build's rendered differences are exactly B-2 (on the newly covered surfaces), B-3, B-5's count-line clauses, B-12, and B-13. A difference outside that set is a defect until reverted or carried back as a register amendment.

## Lessons fenced from the five failed runs of this item (binding)

1. **Lint as you go:** run `npx eslint .` in `v2/` immediately after writing each new file. Two runs of this item died on single lint errors (react-hooks refs-during-render; one unused symbol) that were written early and met only at the gate. Refs are never accessed during render.
2. **Type your fixtures:** test objects use the app's exported types at the point of declaration (never loose literals into typed functions); enum arrays `as const`; callee arity matched exactly. One run died on five such errors, all in its own test files.
3. **Shipped pins are contracts:** before restructuring a shipped surface, run its existing test files and note what they pin (a run of part 1 broke the motif divider placement, Tranche 1.4's hero/Recent dates, and the SSR chip census by rebuilding home carelessly). The surfaces you touch here carry their own pins — the crop count line, the State cloud's layout/counts/glyphs.
4. **Run `npm run verify` after each test file and in full before ending your turn; iterate until it exits 0.** Ending your turn with verify red in any file — tests included — ends the run as a failure.
5. **Leave your work uncommitted.** The workflow's WIP and PR steps handle branching and commits; a fully-committed tree trips the workflow's no-changes guard and loses the run.

Flow note: the workflow pushes a `muse/wip-<run_id>` branch before its verify gate (CI repair loop, Quinn-gated). If your gate goes red, the branch survives and a repair dispatch continues it — a safety net, not a license: the finish discipline above stands unchanged.

## Gate

Quinn build gate with real-browser drives (SPEC §8), scoped to the new surfaces: 3.1-A on `/crop/zinnia` and `/seller` (State cloud) under the same measured conditions as `/variety`; 3.1-B (no beacon on in-place changes; pagination still fires it); 3.1-C counts reconcile on `/crop/zinnia`; 3.1-D applied row + Clear All incl. the §2.6.2 seller form and the JS-off link floor; 3.1-E zero-results on the new surfaces; 3.1-G announcements; 3.1-H no-JS floor on both surfaces; 3.1-I exemplar regression (incl. /variety and one 3.1b-1 surface); 3.1-J model-parity census (Life cycle absent-as-filter on `/crop/[slug]`, crop Hue swatch dots, group order identical everywhere); 3.1-K failure path spot-checked on one new surface; T-A non-vacuity (every new test fails against pre-build code); T-B register audit; T-C no prices. Full verify green.

## PR body hygiene

Provenance (this brief + the SPEC sections), Build accounting (verify summary + diff census), the payload field enumeration (T-C), any machinery change flagged with its reason, and a Gate record section for Quinn's verdict.
