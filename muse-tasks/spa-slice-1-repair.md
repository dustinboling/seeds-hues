# Slice 1 REPAIR — Token theme adoption + self-installing verify (Seed Directory SPA conversion)

You are repairing Slice 1 of the Seed Directory SPA conversion. PR #70 (branch `muse/45352801637`) FAILED Quinn's gate — record: `QUINN-GATE-spa-slice-1.md` on main. Read it first; it is the authority for this repair. Your run starts from PR #70's branch: everything Quinn passed stays exactly as it is. You fix ONLY the items below. The repair PR supersedes PR #70.

## Standing constraints (unchanged from the Slice 1 brief)

- Everything stays INERT: nothing deploys; `v2/` is the live tree. No deploy-config changes. No `.github/workflows/*` edits — stop and report if one seems required.
- The only permitted `v2/` change is item 3 (`v2/package.json` scripts — the §6 allowance).
- Do NOT restore the deleted legacy v1 `app/` files (gate note F4 — the deletion stands).
- Do NOT re-litigate the token values: the values below are the @hues package theme (`~/workspace/wwwhues` is not available to you — the values are quoted here from the package source and the gate record, and they agree).

## 1. F1 CURE (Critical) — adopt the briefed sys values in the mirror theme

In `app/src/design-system/tokens/theme.seeds.json`, resolve the seven ruled sys slots to the package/brief values:

| Slot | Value | Ref |
| --- | --- | --- |
| sys.color.bg | `#f8f6ec` | seeds-ground (already correct — keep) |
| sys.color.link | `#1B5E37` | seeds-link |
| sys.color.accent | `#2D6A4F` | fern |
| sys.color.accent-strong | `#1B4332` | seeds-deep |
| sys.color.text-muted | `#595959` | seeds-muted |
| sys.color.accent-ink | `#86691f` | gold-ink |
| sys.color.border-field | `#71806c` | ink-soft |

- **border-field must be WIRED as the field border** in the comp layer — not held unreferenced. Route the field-border component token(s) to `sys.color.border-field` per the package theme.
- Replace the theme file's `$comment` (the "design defaults NOT taken" interpretation) with a plain statement that the theme adopts the @hues package `theme.seeds.json` values per brief §3.
- Update `app/src/design-system/token-mapping.json` and every derived artifact (generated tokens CSS inputs, `contrast-table.ts`) so the whole mirror resolves consistently to the adopted values.
- **`app/tests/unit/token-mapping.test.ts`: fix the oracle** — it must assert the briefed/package resolution above (the current test locks in the deviation; a test that would pass with the old live values and fail with these values is the defect). After your change, the suite must FAIL if any of the seven slots is reverted to its old live value.

## 2. F3 CURE (Minor, follows from 1) — regenerate the contrast evidence

Regenerate `app/src/design-system/CONTRAST.md` (and the contrast table data it renders from) for the landed values on the new ground `#f8f6ec`. Quinn's record pre-computed the briefed pairs (seeds-link 7.17, fern 5.90, seeds-deep 10.23, seeds-muted 6.47, gold-ink 4.78, ink-soft border-field 3.87) — your regenerated table must be computed from the actual landed values by the existing generator, not hand-typed.

## 3. F2 CURE (Major) — make `verify:spa` self-installing

In `v2/package.json`, change the `verify:spa` script so the chain installs the app tree's dependencies itself before running the app verify — Quinn's accepted cure (a): `npm --prefix ../app ci && npm --prefix ../app run verify`. Keep the rest of the `verify` chain identical. **Prove it the way CI sees it:** with `app/node_modules` removed, `npm run verify` from `v2/` must run green end to end. State that proof (commands + result) in your summary.

## 4. F5 (Note) — placeholder landmark

In `app/src/components/TabBarPlaceholder.tsx`, remove the `aria-label="Primary"` from the empty placeholder `<nav>` (an empty labelled landmark must not ship as a pattern later slices inherit). Keep the structure and slots unchanged.

## Your summary must state

- The seven resolved slot values as landed (a small table).
- The exact new `verify:spa` script text, and the clean-state proof (app/node_modules removed → root verify green).
- That CONTRAST.md was regenerated from the landed values by the generator.
- Anything you could not do and why — plainly, in the summary, not buried.
