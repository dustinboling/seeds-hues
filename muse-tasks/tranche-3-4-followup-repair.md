# Follow-up repair brief — Tranche 3.4 gate findings F-4 + F-5 (Clear All / sort, SearchBox aria-expanded)

## Provenance

Quinn's build gate on PR #57 (Tranche 3.4) returned FAIL on two paperwork grounds (both cured: register amendment B-14 + the PR-body rewrite) and raised two Minor behavior findings, **F-4** and **F-5**, which did not block that PR. Coordinator #19 ruled on F-4 (2026-11-23, recorded in PR #57's body and the gate record): SPEC §2.6 makes sort an ordering, not a filter, and Clear All resets filter *groups* — so the shopper's chosen sort must survive Clear All. This brief is that ruling's build, plus F-5, dispatched immediately after PR #57 shipped. SPEC refs: §2.6.1/§2.6.2 (Clear All), §5.2 (the sort control), §5.3.3 (the visible notice row).

## The work — all of it, nothing else

1. **F-4 — Clear All preserves the active sort.** `clearAllFilters()` (`v2/lib/browse.ts`) and `clearCropDetailFilters()` (`v2/lib/crop-detail.ts`) currently return `sort: "name"`. Change both so Clear All resets every filter group to All **and leaves the state's `sort` exactly as the shopper set it** (absent sort stays absent — do not materialize `sort=name` into the URL or state). The count line keeps stating the true order after a Clear All, per §5.2.3. The builders' comments claiming the reset is intentional are removed/corrected — the decided behavior is the opposite. Every consumer of these two functions inherits the fix; verify no other clear path (applied-row removers are per-group and unaffected; the seller cloud's "All states" reset has no sort and is unaffected).
2. **F-5 — SearchBox `aria-expanded` tells the truth in the notice state.** In `v2/components/search/SearchBox.tsx`, `aria-expanded` is currently `open && results.length > 0`, so when a typed query returns zero suggestions (or the fetch fails) and the panel opens showing the visible message row, the combobox reports collapsed while its listbox is on screen. Make `aria-expanded` reflect the panel's actual visibility in every state (suggestions, notice, failure), with no other change to the component's behavior or ARIA pattern.

## Tests (T-A — non-vacuity is binding)

- New/updated tests pin: on both clear paths, Clear All with `sort=availability` active (and with `sort=recent`) leaves the sort untouched while all groups reset; Clear All at the resting default leaves state byte-equivalent to today. **These tests must fail against the shipped PR #57 code** — Quinn verifies both directions.
- A DOM test asserts `aria-expanded="true"` in the zero-suggestion notice state (and the failure state), and its correct value in the closed and suggestions states.
- Run `npm run verify` after each test file and in full before ending; iterate until it exits 0.

## Scope fence

Rendered/behavior differences are exactly the two finding cures (the F-4 behavior returns to SPEC §2.6's letter; F-5 is an ARIA state correction with no visual change). No other component, copy, token, or payload changes. No price anywhere (T-C). If a third clear path or a second `aria-expanded` writer exists, it is in scope only to the extent it implements the same two behaviors — flag it in the PR body.

## Lessons fenced from this programme's history (binding)

1. **A green workflow gate does not mean the deliverable exists** — prove from the rendered/test surface that Clear All under a non-default sort keeps the sort, on both surfaces, before ending.
2. Lint as you go; refs never accessed during render; fixtures typed with the app's exported types.
3. **Leave your work uncommitted.** The workflow's WIP and PR steps handle branching and commits.

## PR body hygiene

Provenance (this brief + Quinn's PR #57 gate record + the coordinator's F-4 ruling), Build accounting (verify summary + diff census), the payload statement (no payload changes; T-C), and a Gate record section for Quinn's verdict.
