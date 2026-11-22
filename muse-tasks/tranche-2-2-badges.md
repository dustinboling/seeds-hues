# Tranche 2.2 — Badge family unification (split build 2 of 3)

## Why this brief exists
Tranche 2 was split into per-item builds by the program coordinator after four full-tranche runs each failed the pipeline gate on a single small defect. Same spec, same gate standard, smaller change set. This brief covers item 2.2 ONLY, and it builds on item 2.1 (token consolidation) already merged to main. Item 2.3 (chips) follows separately.

## Source of truth
Design spec: `backlog-2026-11-21/tranche-2/SPEC.md` — implement **§3 (Item 2.2)** exactly: §3.1 the family definition, §3.2 the complete variant→tokens table, §3.3 Small Farm component tokens, §3.4 the IRIS-C-02 listing status fix, §3.5 Protection's new dress, §3.6 the per-file change list. The umbrella brief `muse-tasks/tranche-2-system-foundation.md` carries the tranche-wide traps; they apply here. Where any brief and the spec differ, the spec wins — flag the conflict in your PR body.

## Governing rule — value-preserving consolidation
The ONLY permitted rendered changes from this build are the two registered in SPEC §5 for this item:
- **R-1** — Protection badge re-dress (§3.5): ground petal-50 → paper-deep; border petal full → ink-soft full; label petal → ink; note muted → ink-soft; radius 8px → 12px; 16px seal icon appears before the label. Wording, placement, and render gate identical.
- **R-2** — Listing In stock dot + word darken (§3.4): leaf-600 `#2E6B4F` → leaf `#1E4634`, in-stock listings only, no other state or element.

Any other rendered difference is a defect. In particular: badge border alphas are Tranche 1.3's SHIPPED values (SPEC §3.2 states them exactly) — they are the floor, not a starting point; do not move any alpha. Protection's dress is specified completely in §3.5, including the ship-without-icon fallback if the glyph cannot be drawn to standard: new 16px shield-check icon in `icons.tsx`, stroke 1.8, aria-hidden.

## Required tests (Quinn gate conditions)
- Badge/chip contract tests covering the §3.2 variant table and the Protection gate logic (a variety with protection unset/unknown, and one with a claim but no note, render NO Protection component).
- **Non-vacuity**: new tests must FAIL on the pre-build code and pass on yours.
- **Derived expectations**: counts/sets asserted about source files must be derived from those files at test time, never hardcoded literals that can drift.
- Contrast values are recomputed by Quinn from the built CSS (SPEC 2.2-A expected ratios); your tests should pin the token values, not re-derive blends.
- All existing tests remain, unweakened, and green. Updated pins (class strings → tokenized equivalents) are listed in the PR body — never weaken an assertion to pass.

## Build discipline (accumulated from four failed runs — all binding)
- No scratch or fixture files anywhere in the tree at finish.
- Strict TypeScript: narrow or assert after every lookup/index; run `npm run typecheck` on new test files before the full verify.
- After editing `icons.tsx` — and after every file group — run ESLint on the touched files immediately. The ProtectionIcon is plain TSX; the file must parse before you move on (run 44990987708 died on an icons.tsx parse error).
- The FULL `npm run verify` (lint + typecheck + test) on the final tree is the literal last thing you do. If it is not green, fix and re-run. Do not finish on a red or unrun verify.

## Done criteria
- `npm run verify` green on your final branch.
- PR body carries: explicit confirmation that the only rendered changes are R-1 and R-2; the list of updated test pins (if any); the icon outcome (drawn to standard, or the §3.5 fallback taken — say which).
- Scope discipline: item 2.2 surfaces only. No chip changes (item 2.3), no token-file restructuring (item 2.1 is merged; consume its tokens, do not rename them), no Tranche 3 flow changes, no data/seed changes, no prices anywhere, US spelling in all copy and comments.
