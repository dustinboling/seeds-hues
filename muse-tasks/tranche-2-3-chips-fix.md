# Tranche 2.3 (successor build) — Chip split, with the F-1 min-width cure

This brief supersedes `muse-tasks/tranche-2-3-chips.md`. The first 2.3 build (PR #35) FAILED Quinn's gate on a single Major finding and was closed unmerged. Build the FULL 2.3 change set again from current main (which already contains items 2.1 and 2.2 as shipped), exactly as the original brief and SPEC §4 specify, PLUS the F-1 cure below. Everything in the original brief still applies: scope, the §4 readings, the registered rendered changes (R-3, R-4, R-5 only), the traps, and the discipline lessons (no scratch files anywhere in the tree; strict narrowing in tests; ESLint per file group as you go; the full `npm run verify` as the literal last act before finishing; expected values in tests DERIVED from the source files, never hardcoded counts).

## The F-1 cure (Quinn gate record QUINN-GATE-tranche-2-3-pr35.md, finding F-1)

Root cause: SPEC §4.2's table defines `.chip-filter` with minimum height only and drops `.tap` without mentioning the minimum WIDTH `.tap` carried (`min-width: 44px`). The first build followed the table literally, so filter chips lost the 44px minimum width: measured "All" chips 44 → 42.17px (BrowseFilters) and 44 → 43.44px (admin lists) — an unregistered rendered change in a closed register.

The cure, exactly:

1. `.chip-filter` carries `min-width: var(--size-target)` alongside `min-height: var(--size-target)`. Filter chips render at minimum 44px in BOTH dimensions, as they did before the split.
2. tokens.json's chip component tokens record the min-width alongside the min-height (same bookkeeping standard as the rest of the token file).
3. The new test file pins the min-width (class-level and/or computed) so this regression cannot recur silently; the pin must fail if the min-width declaration is removed.
4. Amend the SPEC itself: in `backlog-2026-11-21/tranche-2/SPEC.md` §4.2's chip table, the `.chip-filter` row names the minimum width alongside the minimum height, so the spec record matches the built truth. No §5 change: with the cure, the rendered difference set is exactly R-3 + R-4 + R-5 again.

## Done criteria (in addition to the original brief's)

- Quinn's §6 checks for item 2.3 (2.3-A…2.3-F + T-A/T-B/T-C) can all pass, with T-B's rendered difference set exactly R-3 + R-4 + R-5 — in particular, filter-chip widths measure identical before/after at 390px and 820px, public and admin.
- The PR body carries the standard accounting (grep counts where the original brief asks for them, existing-test pin changes enumerated, verify counts, the rendered-change confirmation).
