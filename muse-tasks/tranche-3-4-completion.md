# Completion brief — Tranche 3.4: verify-and-complete (repair of run 45188077840)

## Provenance

Item 3.4's governing brief is `muse-tasks/tranche-3-4-home-sort-search.md` — **READ IT FIRST; it remains the specification in full** (SPEC §5, PB-1 ruled (b), register B-5/B-6/B-8, checks 3.4-A…F). The first build run (45188077840) ran on it: the builder finished its turn and the workflow pushed its work to `muse/wip-45188077840` pre-gate, exactly as designed — but the workflow's verify gate was **cancelled by the 60-minute job timeout** about 7 minutes in. That is a timeout, NOT a gate failure: no test result exists for this work yet. The WIP branch (34 files, +1849/−154: home composition, `SortChips`, SearchBox repair, ranking, did-you-mean, and the test suite incl. the fold-in contract tests) is your starting point — **do not rebuild any of it from scratch**.

## Your job — verify, fix, complete

1. **Run `npm run verify` in `v2/` in full and make it pass.** Fix every failure with the smallest correct change, staying strictly inside the governing brief's scope fence (rendered differences remain exactly B-5/B-6/B-8). Lint as you go; refs never accessed during render; fixtures typed with the app's exported types. If a failure is in the new 3.4 tests themselves, judge from the SPEC which side is wrong — the spec governs, not the first draft of either the code or the test.
2. **Re-prove the deliverable exists (the governing brief's lesson 1).** From the app's own render tests / a local render, confirm: home renders Recently above Browse with exactly the computed top-12 crops at rest and the cap lifting under a filter; `/variety?sort=availability` orders by the §5.2.2 tier rule and the count line's phrase follows the sort; loading `/search?q=zinnia` renders results with the suggestion panel closed and no mount fetch. If any proof fails, the fix is in scope.
3. **Close the fold-in (governing brief item 8).** The contract tests for both browse routes appear present (`tests/contract/browse-crop.test.ts`, `browse-sellers.test.ts`) — verify they are real handler-level tests and pass; complete or repair if not. Check the `v2/lib/validators/` comment that cites a nonexistent pin file: name the real pin or drop the citation, if the first build did not already.
4. **Leave your work uncommitted.** The workflow's WIP and PR steps handle branching and commits; a fully-committed tree trips the no-changes guard and loses the run.

## PR body hygiene

Provenance (the governing brief + this completion brief + the timeout-cancelled first run 45188077840, stated plainly), Build accounting (verify summary + diff census), the payload field enumeration (T-C), any machinery change flagged with its reason, the fold-in's final disposition, and a Gate record section for Quinn's verdict.
