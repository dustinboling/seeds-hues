# Completion brief — Item 3.1b-1, repair 2: the missing routes, home, /search, and the existence census

You are CONTINUING a build, not starting one. This run checks out branch `muse/45139011503` (via `start_from`) — the accumulated Item 3.1b-1 build (PR #50). The governing documents remain in force in full: `muse-tasks/tranche-3-1b1-browse-surfaces.md` including its 2026-11-22 addendum, and `muse-tasks/tranche-3-1b1-repair-1.md`. This brief covers what Quinn's gate found missing. Change nothing she approved.

## Quinn's verdict on PR #50: FAIL — the item is not built (record `QUINN-GATE-tranche-3-1b1-pr50.md`, main c34925f)

What she verified PASS, and you must not rework: the generalized machinery and the snapshot contract (flat `InPlaceSnapshot`, payload fields direct); the census repair from repair 1 (a faithful exception-follows-the-machinery — it rides unchanged); the /crop surface code; all five addendum pins; T-C (no prices); the /variety regression (N-D1 holds). Her verify reproduction was exact: 69 files / 1,174 tests, all passing — and the item still failed, for these reasons:

- **F1 BLOCKER — /crop in-place filtering cannot complete.** `CropBrowse` fetches `/api/browse/crops`, but no such route exists (only `/api/browse/varieties`). Proven by source route table, by HTTP (crops → 404, search → 404, varieties control → 200), and by a real-Chromium drive: every filter tap on /crop takes the §2.5.6 failure path. The service layer exists (`catalog.browseCrops`, validators, payload guards); the endpoint was never written. `lib/api/browse-route.ts` is imported by no route.
- **F2 CRITICAL — Home was never rebuilt.** `v2/app/page.tsx` is byte-identical to the build's base. No unconditional count line (the conditional mount §2.5.9 calls a defect is still there), chips are plain links with no counts, no applied row. None of B-1/B-2/B-5-clauses/B-12 landed.
- **F3 CRITICAL — /search was never rebuilt.** Page likewise untouched: no Life cycle group (B-11 absent), no counts, no applied row. `catalog.browseSearch` and its validators exist, consumed by nothing.
- **F4 MAJOR (process) — the build added zero new tests**, so no test could see F1–F3: the suite has no census that a named endpoint exists or that a named surface consumes the machinery. Two green workflow gates certified an incomplete build.

Her path back to PASS, verbatim in substance: "(a) add the two missing routes on the existing plumbing, (b) build home + /search onto the machinery per brief items 2 and 4, (c) add the F4 census-style tests. The machinery, the census repair, and the /crop surface code need no rework."

## The work

1. **Routes.** Add `v2/app/api/browse/crops/route.ts` and `v2/app/api/browse/search/route.ts`, built on the existing `lib/api/browse-route.ts` plumbing and the existing service methods (`catalog.browseCrops`, `catalog.browseSearch`) and validators, mirroring `v2/app/api/browse/varieties/route.ts` in shape, error behavior, and payload contract (§2.5.6: results + total + per-option counts + applied set, atomically). No price field anywhere (T-C).
2. **Home — `v2/app/page.tsx`** (original brief item 2). The count line renders **unconditionally** as a persistent live region (`aria-live="polite"`, `aria-atomic="true"`; at rest it reads the unfiltered crop total, e.g. "124 crops"). Add the designed filtered-empty state (§2.6.3, register B-12). Filters consume the shared machinery with per-option counts (§2.4) and the applied row (§2.6), mirroring how `CropBrowse` consumes it. **No composition change:** section order, the Recently restocked placement, and the resting-grid cap do not change — of register B-5, only its count-line clauses land here. Every shipped pin on this page stays pinned (motif divider between hero and Browse by crop; hero line; divider-stem-mini classes).
3. **/search — `v2/app/search/page.tsx`** (original brief item 4). Groups become `["season", "method", "lifeCycle", "hue"]` — **Life cycle is added** (register B-11; Sellers is NOT added). Shared machinery + per-option counts + applied row; its Clear All link carries `q` (§2.6.4). The results `<h2 id="results-title">` remains the live region.
4. **The F4 existence/consumption census (new tests, in the `tranche-2-3-chips.test.ts` static-census tradition).** Add tests that would have failed this build at the workflow gate:
   - **Route existence:** for every `/api/browse/*` path a browse component fetches (each `API_PATH` in the browse layer), a route file exists at the corresponding `app/api/browse/*/route.ts`.
   - **Surface consumption:** each 3.1b-1 surface — home (`app/page.tsx`), /crop index, /search (`app/search/page.tsx`) — actually renders a browse component that consumes the shared machinery (not merely imports a type).
   These tests must **fail against the pre-completion tree** (PR #50's head) and pass on yours — Quinn will verify non-vacuity. Write them as source censuses over the real files, in the established style; do not mock the filesystem into vacuity.

All of the original brief's binding contracts (§2.5/§2.6 observables: in-place semantics, budgets, URL/history, no beacons, announcements, failure path, applied-row forms, zero-results) apply to the new surfaces exactly as written there. The scope fence stands: no sort, no SearchBox change, no home composition change, Small Farm legend unmoved, `/crop/[slug]` and `/seller` untouched (3.1b-2), `SellerFilterSection.tsx` untouched, /variety behavior unchanged.

## Completeness checklist — self-verify before you finish

The prior build ended with two surfaces unbuilt and nobody noticed. Before ending your turn, check each line against the tree, not against your memory of the turn:

- [ ] Both route files exist and return 200-shaped payloads for valid params (exercise them, don't just compile them).
- [ ] `app/page.tsx` renders the machinery (count line at rest, counted chips, applied row) — grep your own diff for the file.
- [ ] `app/search/page.tsx` renders the machinery with the Life cycle group present.
- [ ] The F4 census tests exist, and you have watched them fail against the pre-completion tree (e.g. by running them with the new routes/pages temporarily reverted in a scratch checkout, or by construction from PR #50's file list) and pass on your tree.
- [ ] `npm run verify` exits 0 in full.

## Finish discipline

This dispatch runs with a raised step budget — spend it on building ALL of the above and verifying, per the standing discipline: `npx eslint .` after each new file; verify after each test file; full `npm run verify` green before ending your turn; typed fixtures only; **leave your work uncommitted** (the workflow's steps handle branching and commits).

## PR body hygiene

Provenance: the original brief + addendum + repair 1 + this completion brief + Quinn's FAIL record (`QUINN-GATE-tranche-3-1b1-pr50.md`), and the `start_from` branch (`muse/45139011503`, PR #50 — this PR supersedes it). Build accounting: the accumulated diff census vs the merge-base, the F4 census tests enumerated by name, the payload field enumeration (T-C), and a Gate record section for Quinn's re-gate verdict.
