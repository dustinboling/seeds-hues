# Tranche 2.1 — Token consolidation (split build 1 of 3)

## Why this brief exists
Tranche 2 was split into per-item builds by the program coordinator after four full-tranche runs each failed the pipeline gate on a single small self-inflicted defect (scratch-file lint; new-test typecheck; icons.tsx parse; a hardcoded count in the builder's own sync test). Same spec, same gate standard, smaller change set. This brief covers item 2.1 ONLY. Items 2.2 (badges) and 2.3 (chips) follow as separate builds on top of this one.

## Source of truth
Design spec: `backlog-2026-11-21/tranche-2/SPEC.md` — implement **§2 (Item 2.1)** exactly, including §2.1.5's pattern table and allowlist dispositions and §2.1.6's per-file change list. The umbrella brief `muse-tasks/tranche-2-system-foundation.md` carries the tranche-wide traps; they apply here. Where any brief and the spec differ, the spec wins — flag the conflict in your PR body.

## Governing rule — value-preserving consolidation
This build NAMES rendered values; it does not improve them. Item 2.1 has **zero registered rendered changes** (the five registered changes R-1–R-5 belong to items 2.2/2.3). Any rendered difference from this build is a defect.

Traps (binding):
- The listing shadows' RGB (151,134,95) is the RETIRED line-strong value, frozen in the spec: **do not re-derive** them from the current `#91825C` line-strong token.
- `#E9DFC2` and `#DFE9D6` are promoted to tokens (`--color-listing`, `--color-visit`), never snapped to `line`/`leaf-50`.
- The Sheet shadow tokenizes at the exact value the Sheet already renders; do not warm it.
- SPEC §7 dispositions the 431 arbitrary-value lines; for THIS item follow the §2 pattern table and allowlist only. Do not touch badge or chip surfaces beyond the token renames §2.1.6 names.

## Scope
New DTCG source of truth at `v2/design-tokens/tokens.json`, synced to `@theme`; radius/shadow/spacing scales at the spec's exact rendered values; breakpoint names (`admin:` 744px, `admin-wide:` 1181px); the pattern→replacement migration per SPEC §2–§3 as §2.1.6 lists it; the lint test the spec requires.

## Required tests (Quinn gate conditions)
- The token **sync test**: tokens.json vs `@theme` — must fail if either side drifts.
- **Non-vacuity**: the new tests (sync, lint) must FAIL on the pre-build code and pass on yours.
- **Derived expectations**: any count or set your tests assert about tokens.json / `@theme` must be DERIVED from those files at test time, never a hardcoded literal that can drift from the files being synced (run 44992854929 died on exactly this: an expected count of 62 against 61 actual).
- All existing tests remain, unweakened, and green. If an existing test pins a pre-consolidation implementation detail, update the pin to the tokenized equivalent and list it in the PR body — never weaken an assertion to pass.

## Build discipline (accumulated from four failed runs — all binding)
- No scratch or fixture files anywhere in the tree at finish; build temporaries outside the repo or delete them.
- Strict TypeScript: narrow or assert after every lookup/index (`T | undefined`); run `npm run typecheck` on new test files before the full verify.
- After every file group, run ESLint on the touched files immediately.
- The FULL `npm run verify` (lint + typecheck + test) on the final tree is the literal last thing you do. If it is not green, fix and re-run. Do not finish on a red or unrun verify.

## Done criteria
- `npm run verify` green on your final branch.
- PR body carries: the SPEC §6 grep counts relevant to 2.1 (check 2.1-B's zero list) with their results; the list of updated test pins (if any); explicit confirmation that this build makes no rendered change.
- Scope discipline: item 2.1 surfaces only. No badge/chip component changes beyond §2.1.6's named renames, no Tranche 3 flow changes, no data/seed changes, no prices anywhere, US spelling in all copy and comments.
