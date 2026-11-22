# Tranche 2.3 — Chip split: filter chips vs tag chips (split build 3 of 3)

## Why this brief exists
Tranche 2 was split into per-item builds by the program coordinator after four full-tranche runs each failed the pipeline gate on a single small defect. Same spec, same gate standard, smaller change set. This brief covers item 2.3 ONLY, building on items 2.1 (tokens) and 2.2 (badges) already merged to main.

## Source of truth
Design spec: `backlog-2026-11-21/tranche-2/SPEC.md` — implement **§4 (Item 2.3)** exactly: §4.2 the two components (normative), §4.3 the filter-chip behavioral contract, §4.4 the removable-chip affordance, §4.5 the complete per-surface migration census (public + admin), §4.6 the per-file change list. The umbrella brief `muse-tasks/tranche-2-system-foundation.md` carries the tranche-wide traps; they apply here. Where any brief and the spec differ, the spec wins — flag the conflict in your PR body.

## Governing rule — value-preserving consolidation
The ONLY permitted rendered changes from this build are the three registered in SPEC §5 for this item:
- **R-3** — Removable chips gain the × glyph (§4.4): admin listing list deep-link remover chips (2 chips); 14px × after the label; chip size, colors, link target, accessible name identical.
- **R-4** — Two admin inert chips take true tag geometry (§4.5): admin listing-detail status span height 44px → 32px; admin account-list role labels text 13px → 14px, padding 10px/4px → 12px/2px (height holds at 32px). Text content and colors identical.
- **R-5** — Crop filter `aria-current` value (§4.3.5): `"page"` → `"true"`. No visual difference.

Any other rendered difference is a defect. Structural rules: bare `.chip` is retired; `.chip-filter` (44px; `<a>`/`aria-current` or `<button>`/`aria-pressed` exclusively; selected dress folded into the CSS so all five duplicated `chipClass` helpers are deleted) vs `.chip-tag` (32px, `<span>` only, no interactive states); `.chip-removable` modifier with the drawn 14px × glyph. Crop rows migrate class-only — the strip rebuild is Tranche 3.1; do NOT rebuild the strip, and FilterStrip.tsx may be touched only as item 2.1 already did (Ada A3 is NOT part of this build).

## Required tests (Quinn gate conditions)
- Chip contract tests: no bare `chip` classes remain; `chip-tag` only on `<span>`; `chip-filter` only on `<a>`/`<button>`; no `chipClass` declarations remain (SPEC 2.3-A census).
- **Non-vacuity**: new tests must FAIL on the pre-build code and pass on yours.
- **Derived expectations**: counts/sets asserted about source files must be derived from those files at test time, never hardcoded literals that can drift.
- All existing tests remain, unweakened, and green. Updated pins listed in the PR body — never weaken an assertion to pass.

## Build discipline (accumulated from four failed runs — all binding)
- No scratch or fixture files anywhere in the tree at finish.
- Strict TypeScript: narrow or assert after every lookup/index; run `npm run typecheck` on new test files before the full verify.
- After every file group, run ESLint on the touched files immediately.
- The FULL `npm run verify` (lint + typecheck + test) on the final tree is the literal last thing you do. If it is not green, fix and re-run. Do not finish on a red or unrun verify.

## Done criteria
- `npm run verify` green on your final branch.
- PR body carries: the §4.5 migration census accounted for surface by surface; explicit confirmation that the only rendered changes are R-3, R-4, and R-5; the list of updated test pins (if any).
- Scope discipline: item 2.3 surfaces only. No strip rebuild, no filter behavior changes (Tranche 3.1), no token or badge changes (items 2.1/2.2 are merged; consume them, do not rename), no data/seed changes, no prices anywhere, US spelling in all copy and comments.
