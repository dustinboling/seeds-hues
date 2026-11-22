# Tranche 2.3 (second successor build) — Chip split, with the F-1 min-width cure AND the QueueNav flex cure

This brief supersedes `muse-tasks/tranche-2-3-chips-fix.md`. The first 2.3 build (PR #35) FAILED Quinn's gate on one Major (filter chips lost their 44px minimum width) and was closed unmerged. The successor build (PR #36) cured that defect and proved the cure at gate, but introduced ONE new Major of the same class and was FAILED and closed unmerged (gate record `QUINN-GATE-tranche-2-3-pr36.md`). Build the FULL 2.3 change set again from current main (which already contains items 2.1 and 2.2 as shipped), exactly as the original brief (`muse-tasks/tranche-2-3-chips.md`) and SPEC §4 specify, PLUS cure 1 (min-width, carried from the previous fix brief — it was proven correct; keep it exactly) PLUS cure 2 (QueueNav flex, below). Everything in the original brief still applies: scope, the §4 readings, the registered rendered changes (R-3, R-4, R-5 only), the traps, and the discipline lessons (no scratch files anywhere in the tree; strict narrowing in tests; ESLint per file group as you go; the full `npm run verify` as the literal last act before finishing; expected values in tests DERIVED from the source files, never hardcoded counts).

## Cure 1 — F-1 min-width (from QUINN-GATE-tranche-2-3-pr35.md; proven at the PR #36 gate — reproduce exactly)

1. `.chip-filter` carries `min-width: var(--size-target)` alongside `min-height: var(--size-target)`. Filter chips render at minimum 44px in BOTH dimensions, as they did before the split.
2. tokens.json's chip component tokens record the min-width alongside the min-height (same bookkeeping standard as the rest of the token file).
3. The new test file pins the min-width (token level and CSS-rule level) so this regression cannot recur silently; the pins must fail if the min-width declaration is removed.
4. SPEC amendment (already the built truth; keep it): in `backlog-2026-11-21/tranche-2/SPEC.md` §4.2's chip table, the `.chip-filter` row names the minimum width alongside the minimum height ("44px in both dimensions"). No §5 change.

## Cure 2 — QueueNav flex (from QUINN-GATE-tranche-2-3-pr36.md, finding F-1 of that gate)

Root cause: on merge-base, the admin QueueNav anchor carries `chip tap flex min-h-target items-center gap-2`. The `flex` utility makes the anchor a block-level flex box. PR #36's rebuild reduced the anchor to `chip-filter gap-2`; `.chip-filter` is `display: inline-flex`, which is invisible in flex rows but NOT in QueueNav: at the admin breakpoint (≥744px) QueueNav's list goes columnar (`flex-col`), each `<li>` stretches to the 340px column width, a block-level anchor fills it, and an inline-flex anchor shrink-wraps. Measured at the PR #36 gate in the review page's own production wrapper: the four QueueNav chips went 340px → 163.42 / 153.72 / 148.94 / 136.92px at 820px (heights 44px on both builds; 390px identical). SPEC §4.5 prescribes absorbing `chip tap` + the ad hoc `font-semibold` into the class — `min-h-target` and `items-center` are genuinely absorbed by `.chip-filter`, but `flex` is NOT: the class is `inline-flex`, not `flex`. PR #35's build had this right (`chip-filter flex items-center gap-2`); the successor dropped it.

The cure, exactly:

1. The QueueNav anchor's class string is `chip-filter flex items-center gap-2` (the PR #35 form). One class string in one file.
2. **General rule for every migrated element in this build:** any pre-existing utility on a migrated element that the new class's contract (SPEC §4.2/§4.5) does NOT expressly absorb must be carried over unchanged. When in doubt, keep the utility. (The same dropped-`flex` pattern in QueueList's segment links is rendered-neutral — those anchors are flex items in a `flex flex-wrap` group — but carry utilities over there too rather than reasoning case-by-case; rendered neutrality is the gate's to prove, not the build's to assume.)
3. The new test file pins the QueueNav anchor's class string (it must contain `chip-filter` AND `flex`), so this drop cannot recur silently; the pin must fail if `flex` is removed from that anchor.

## Done criteria (in addition to the original brief's)

- Quinn's §6 checks for item 2.3 (2.3-A…2.3-F + T-A/T-B/T-C) can all pass, with T-B's rendered difference set exactly R-3 + R-4 + R-5 — in particular: filter-chip widths AND heights measure identical before/after at 390px and 820px, public and admin; and the QueueNav chips measure identical before/after at BOTH widths in the review page's production wrapper (340px column at ≥744px included).
- The PR body carries the standard accounting (grep counts where the original brief asks for them, existing-test pin changes enumerated, verify counts, the rendered-change confirmation — which may only claim "R-3 + R-4 + R-5 only" if that is literally true of the finished build).
