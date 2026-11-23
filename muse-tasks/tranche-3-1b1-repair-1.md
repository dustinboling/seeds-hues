# Repair brief — Item 3.1b-1, repair 1: register the 3.1a chip-removable exception for the shared component

You are CONTINUING a build, not starting one. This run checks out branch `muse/wip-45133498406` (via `start_from`), which carries the complete Item 3.1b-1 build (16 files, +1299/−548 vs main). The governing brief is `muse-tasks/tranche-3-1b1-browse-surfaces.md` INCLUDING its 2026-11-22 addendum — both remain in force in full. This repair brief covers exactly ONE defect: the single failure from run 45133498406's verify gate. Change nothing else.

## The gate failure (run 45133498406, verbatim)

The workflow verify gate ran 69 test files / 1,174 tests: **1 failed, 1,173 passed**. The one failure:

```
FAIL tests/unit/tranche-2-3-chips.test.ts > 2.3-A — class census (no bare chip, no helpers, elements exclusive) > sits chip-filter only on links and buttons, chip-tag only on spans
AssertionError: components/ui/InPlaceBrowse.tsx: chip-removable on <button>: expected [ 'a', 'Link' ] to include 'button'
  ❯ tests/unit/tranche-2-3-chips.test.ts:400:76
```

Everything else in the build passed the gate, including the three shipped-behavior pins the addendum fenced (motif divider, Tranche 1.4 hero/Recent dates, the chip census's SSR assertions) and `catalog.browseCrops`. Do not touch any of it.

## What is actually wrong

Nothing in the build's rendering. The 2.3 census carries a registered exception, written into the test itself when Item 3.1a shipped (Quinn-gated, PR #49):

```ts
// Tranche 3.1a: the /variety applied row's hydrated removers are <button>s (in-place,
// like the hydrated filter chips) — the one registered exception; everywhere else a
// remover is still a link.
const tags = use.file === "components/variety/VarietyBrowse.tsx" ? ["a", "Link", "button"] : ["a", "Link"];
```

Item 3.1b-1 generalized the applied-row machinery out of `VarietyBrowse.tsx` into the shared `components/ui/InPlaceBrowse.tsx` (which now holds both remover forms: the SSR/no-JS link and the hydrated in-place `<button>`, per SPEC §2.6). `VarietyBrowse.tsx` no longer renders a remover at all. The exception did not follow the machinery to its new home — that is the whole defect.

## The fix (the only change this repair makes)

In `v2/tests/unit/tranche-2-3-chips.test.ts`, in the `chip-removable` branch of the "sits chip-filter only on links and buttons, chip-tag only on spans" test:

1. Move the registered exception to the file that now renders the hydrated removers: `components/ui/InPlaceBrowse.tsx` gets the `["a", "Link", "button"]` allowance.
2. Remove the `components/variety/VarietyBrowse.tsx` entry (it renders no remover now; the exception must name exactly the files that carry the machinery — no more). If, contrary to the record above, removing it makes the census fail on a real remover use in that file, restore it and say so explicitly in the PR body.
3. Update the comment to record the move in the same voice as the original, e.g.: the 3.1a exception, moved in 3.1b-1 to the shared in-place component the machinery generalized into; everywhere else a remover is still a link.

Hard fences:

- Do NOT change any rendering in `InPlaceBrowse.tsx` or anywhere else. The hydrated remover as a `<button>` is by design (SPEC §2.6); the SSR render stays a link.
- Do NOT broaden the exception: no additional files, no wildcard, no relaxing the `["a", "Link"]` default for other files. If you believe a second file needs the allowance, do not add it — finish the repair without it and state the case in the PR body for Quinn.
- Do NOT modify any other test or source file. The expected total delta of this repair is the one test file.

## Finish discipline

Run the one test file (`npx vitest run tests/unit/tranche-2-3-chips.test.ts` in `v2/`), then the full `npm run verify`, and iterate until verify exits 0 before ending your turn. Leave the tree clean and **leave your work uncommitted** — the workflow's steps handle branching and commits.

## PR body hygiene

Provenance: the original brief + its addendum + this repair brief, and the `start_from` branch (`muse/wip-45133498406`). Build accounting: run 45133498406's gate result (69 files / 1,174 tests / the 1 failure quoted above) + this run's verify summary + the ACCUMULATED diff census vs main. Flag the census change explicitly for Quinn in its own paragraph: the 3.1a registered exception followed the machinery into the shared component, the now-removerless VarietyBrowse entry was removed, and the census's default (removers are links everywhere else) is unchanged. Gate record section for Quinn's verdict.
