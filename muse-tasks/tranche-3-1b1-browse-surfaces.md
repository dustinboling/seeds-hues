# Tranche 3.1b-1 — Filter parity spread, part 1 of 2: shared machinery + home, /crop, /search (Item 3.1b)

## Provenance and the split

Tranche 3 SPEC §2 (filter model parity) + §9 build split row 4. Item 3.1a — the in-place core on `/variety` — has SHIPPED (PR #49, merged e9106a1; Quinn re-drive PASS, record `QUINN-GATE-tranche-3-1a-pr49.md`). The full 3.1b spread was dispatched four times as one build (runs 45115938520, 45117989214, 45120161154, 45123921589) and failed the workflow's verify gate all four times on mechanical errors — never on the design. The coordinator has therefore split Item 3.1b into two sequential builds. **This brief is part 1: the shared in-place machinery, generalized, plus home, the /crop index, and /search.** Part 2 (crop detail rebuild + the seller State cloud) is a separate later brief and is **out of scope here** — but the machinery you build must be surface-generic so part 2 consumes it without modification.

Read before building: SPEC §2 in full (`backlog-2026-11-21/tranche-3/SPEC.md`), §7's register, §8's Item 3.1 checks, the rulings in `backlog-2026-11-21/tranche-3/DECISIONS.md` (PB-2 = multi-select Hue binds via SPEC §2.4.5), and the shipped 3.1a implementation on `/variety` (your pattern source). Base: current `main`.

## What to build

1. **Shared machinery (extend, don't duplicate).** Generalize the shipped 3.1a in-place layer and its §2.5.6 payload (results + total + per-option counts + applied set, atomically, one request per deliberate change) so home, /crop, and /search consume the same machinery /variety uses. First paint and updates consume the same payload per surface, so SSR and in-place can never disagree. Per-option counts follow §2.4 exactly, including §2.4.5's toggle semantics for multi-select Hue and the zero-count rule (a 0 renders and stays operable).
2. **Home — `v2/app/page.tsx`.** The count line renders **unconditionally** as a persistent live region (`aria-live="polite"`, `aria-atomic="true"`; at rest it reads the unfiltered crop total, e.g. "124 crops") — its current conditional mount is a defect this item closes (§2.5.9). Add the designed filtered-empty state (§2.6.3, register B-12). Filters consume the enhanced component with per-option counts and the applied row (§2.6).
3. **Crop index — `v2/app/crop/page.tsx`.** The count line gains the live-region attributes; add the designed filtered-empty state (B-12); enhanced component + counts + applied row.
4. **Search — `v2/app/search/page.tsx`.** Groups become `["season", "method", "lifeCycle", "hue"]` — **Life cycle is added** (register B-11; §2.2's settled table — Sellers is NOT added, per the recorded interpretation). Enhanced component; applied row (its Clear All link carries `q`, §2.6.4); counts. The results `<h2 id="results-title">` remains the live region.

## The snapshot contract (normative — run 45123921589 died here)

The shared snapshot type exposes the payload's fields **directly**: define `InPlaceSnapshot<S, P>` so that `snapshot.total`, `snapshot.items`, and `snapshot.counts` typecheck in every consumer (a flattened/intersection shape, or an equivalent declaration that puts the payload's fields on the snapshot). Use that one access convention everywhere — no consumer reads through a nested `.payload`, and no consumer declares its own snapshot shape. Twelve of run 4's gate errors were TS2339 "Property 'total' does not exist on type 'InPlaceSnapshot<…>'" across four components because the wrapper type and its consumers disagreed; this contract removes the ambiguity by deciding it here.

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

## Known traps — the four failure classes of the discarded runs (all fenced here)

1. **Refs during render** (run 45115938520, ESLint react-hooks): never access or mutate a ref's `.current` during render — keep handler identities stable via an effect-maintained ref or by re-subscribing listeners on dependency change.
2. **Unused symbols** (run 45117989214, ESLint @typescript-eslint/no-unused-vars): leave no unused imports, types, or variables anywhere in the change set.
3. **Loose test fixtures** (run 45120161154, TS2322/TS2345/TS2554): type every filter/fixture object in tests with the app's exported types at declaration; `as const` for enum arrays; no `readonly` tuples into mutable parameters; match callee arity exactly.
4. **Snapshot seam** (run 45123921589, TS2339 ×12): the snapshot contract above.

## Scope fence — what this build must NOT do

- **Crop detail (`/crop/[slug]`) and the seller index (`/seller`, StateFilter): untouched** — they are part 2. Do not rebuild the crop detail's hand-rolled rows and do not change StateFilter in this build.
- `/variety` and `/variety/[slug]`: no behavior change. `SellerFilterSection.tsx` is **not touched** (regression-checked only, §8 check 3.1-I).
- **No sort control** (§5.2 / register B-6 is Item 3.4). **No home composition change** (§5.1 is Item 3.4): section order, Recently restocked placement, and the resting-grid cap do not change — of register B-5, only its count-line clauses land here. **No SearchBox change** (§5.3 / register B-8 is Item 3.4).
- **The Small Farm legend does not move** (§2.3): neither drop, duplicate, nor relocate it on any surface.
- FilterStrip geometry (B-4 / 3.1-F) already landed in 3.1a — touch `FilterStrip` only where the enhancement strictly requires it, with no visual change beyond §2.7's shipped values.
- No price appears in any payload or on any surface (whole-tranche check T-C): enumerate the update payload's fields in the PR's change list; there is no price field.
- **Change register (T-B):** this build's rendered differences are exactly B-1 and B-2 (on home, /crop, /search), B-5's count-line clauses, B-11, B-12, and B-13. A difference outside that set is a defect until reverted or carried back as a register amendment.

## Gate

Quinn build gate with real-browser drives (SPEC §8), scoped to this part: 3.1-A repeated on `/`, `/crop`, and `/search` (with a query) under the same measured conditions as `/variety`; 3.1-B; 3.1-D; 3.1-E incl. the new home and /crop zero states; 3.1-G announcements on home and /crop; 3.1-H no-JS floor on the covered surfaces; 3.1-I exemplar regression; 3.1-J parity census for the covered surfaces (Life cycle present on /search; group order identical); 3.1-K failure path spot-checked on one covered surface; T-A non-vacuity (every new test fails against pre-build code); T-B register audit; T-C no prices. Full verify green.

## Finish discipline

Run `npx eslint .` in `v2/` immediately after writing each new file, and the full `npm run verify` after each test file — then iterate until verify exits 0 before ending your turn. Four runs of the unsplit brief were discarded by the gate; ending your turn with verify red in any file (tests included) ends the run as a failure. Leave the tree clean; keep commits to this brief's scope.

## PR body hygiene

Provenance (this brief + the SPEC sections), Build accounting (verify summary + diff census), the payload field enumeration (T-C), and a Gate record section for Quinn's verdict.

## Addendum — re-dispatch under the repair-loop flow (2026-11-22, coordinator #17)

This brief's first run (45128133178) also failed the gate — a **fifth failure class**, different from the four fenced above: the builder's home rebuild **broke shipped, gate-proven behavior**, and the suite caught it. The five failures, verbatim from that run's gate output — treat each as a fence for this re-dispatch:

1. `motif-divider.test.ts` — "home hero break: the C3 motif divider sits between the hero and Browse by crop." The shipped homepage hero→browse break (Item MOTIF, PR #48) must survive your home work exactly: the `data-testid="home-motif"` divider stays between the hero and Browse by crop.
2. `tranche-1-4.test.ts` — the home hero line and the Recent list's friendly dates (Tranche 1.4's shipped behavior) must render exactly as today.
3. `tranche-2-3-chips.test.ts` — the chip-filter / chip-removable census: **SSR removable chips render as links, not buttons** (Tranche 2.3's shipped form). The in-place enhancement must not change the server-rendered element type of removable chips.
4. `TypeError: catalog.browseCrops is not a function` — the generalized machinery must expose the browse API the home/crop surfaces consume (`browseCrops` on the catalog service) under the names the existing code and tests call.
5. A missing `divider-stem-mini mt-1` class assertion — the shipped class composition on the wordmark/packet-card mini stem is pinned by test; do not drop it while touching nearby markup.

General rule these five teach: **before restructuring a shipped surface, run its existing test files and note what they pin; the pins are the surface's shipped contract.** Your change register (T-B) already says a rendered difference outside B-1/B-2/B-5-clauses/B-11/B-12/B-13 is a defect — these failures were exactly that, caught by the surfaces' own tests. Run the three named test files against your finished home work specifically, not just the full suite at the end.

Flow note: the workflow now pushes a `muse/wip-<run_id>` branch before its gate (CI repair loop, shipped f8fee49, Quinn PASS WITH NOTES e66f577), so a red gate no longer discards this build — a repair dispatch can continue it. That is a safety net, not a license: the finish discipline above stands unchanged — end your turn with `npm run verify` green in full, and **do not commit your work yourself** (leave it uncommitted in the tree; the workflow's steps handle branching and commits).
