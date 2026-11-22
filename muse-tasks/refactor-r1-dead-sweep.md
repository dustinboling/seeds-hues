# Refactor R1: proven-dead sweep + un-export pass

## Why

Slice R1 of the Seed Directory refactoring plan (`refactor-2026-11-21/PLAN.md`
§3). The 2026-11-21 survey found exported symbols whose only occurrence in the
entire repository is their own definition — dead surface that every later
refactoring slice must reason about — plus an interim admin component with no
callers, and files that export symbols only their own file uses. This slice
deletes what is provably dead and drops needless `export` keywords. It is
behavior-preserving by construction: every deletion is proven by whole-repo
cross-reference before it is made, and typecheck + the full test suite are the
mechanical proof that nothing referenced was removed.

The coordinator re-verified the survey's claims against current `main`
(7699b54) on 2026-11-21 before dispatch. Two survey claims no longer hold and
are **excluded** below (availabilityPhrase, sellerAccounts) — do not touch
them.

## Scope — exact changes

### 1. Delete `v2/components/admin/SectionFrame.tsx`

The Slice-0 interim frame. Whole-repo cross-reference (coordinator-verified):
the only occurrence of `SectionFrame` in `v2/` is its definition in that file.
Zero callers. Delete the file.

### 2. Delete these 9 proven-dead runtime exports

Each was coordinator-verified on current main: the symbol's only occurrence
in the whole `v2/` tree (app, lib, components, tests, scripts — string
literals and comments included) is its definition line.

| Symbol | Defined at |
| --- | --- |
| `phoneTail` | `v2/lib/accounts.ts` |
| `PRIVILEGED_ROLES` | `v2/lib/admin-auth.ts` |
| `utcToday` | `v2/lib/admin/statistics.ts` |
| `wordCount` | `v2/lib/names.ts` |
| `usersByIds` | `v2/lib/repositories/accounts.ts` |
| `invalidateAdminCodes` | `v2/lib/repositories/admin-auth.ts` |
| `isListingVisible` | `v2/lib/repositories/waitlist.ts` |
| `outboxForUser` | `v2/lib/repositories/waitlist.ts` |
| `DEFAULT_PAGE_SIZE` | `v2/lib/services/catalog.ts` |

Delete each definition. If a definition's removal leaves an import or a
helper used only by the deleted symbol, that import/helper is in scope for
removal only if it too is then provably unreferenced — prove it the same way
and list it in the PR body.

### 3. Complete the sweep mechanically — carefully

Beyond the named list, enumerate any other exported **runtime** symbol
(functions, consts, classes — in `v2/lib`, `v2/components`, `v2/app`) whose
whole-`v2/`-tree occurrence count is exactly its definition site, and delete
those too. Hard exclusions — never delete under this section:

- Anything in `v2/lib/db/schema.ts` (see §5 of "What must NOT change").
- Type-only exports (interfaces, type aliases) — deletion is out of scope;
  they are erased at runtime and the plan scoped this slice to runtime
  exports.
- Framework-convention exports: Next.js route handlers (`GET`/`POST`/…),
  `default` exports of pages/layouts/loading/error components, `metadata`,
  `generateStaticParams`, route segment config (`dynamic`, `revalidate`, …).
- Anything referenced by a test, a script, a string literal, a re-export
  barrel, or any form of dynamic access (computed keys, namespace imports).
- Anything you cannot prove dead by the occurrence rule. When in doubt,
  skip it and list it in the PR body as skipped-with-reason.

Every deletion under this section must be listed in the PR body with its
occurrence proof (the grep that shows the definition is the only hit).

### 4. Un-export pass

In `v2/lib/admin/statistics.ts`, `v2/lib/repositories/admin.ts`, and
`v2/lib/validators/index.ts` (worst first, per the survey), and in any other
file this slice already touches: remove the `export` keyword from any symbol
whose every occurrence in the `v2/` tree is inside its defining file. The
symbol itself does not change in any other way — same name, same signature,
same body. If a symbol is re-exported by a barrel file, it is not
file-internal; leave it exported.

## What must NOT change

- **`availabilityPhrase` (`v2/lib/services/template.ts`) stays.** The survey
  called it dead; Tranche 1.4 (PR #25) has since covered it in
  `v2/tests/unit/tranche-1-4.test.ts`, which imports and asserts it. It is
  no longer deletable without touching a shipped tranche's tests. Do not
  modify it or its tests.
- **`sellerAccounts` and every other table export in `v2/lib/db/schema.ts`
  stay.** The plan's guardrail required a runtime check that nothing
  enumerates the schema dynamically; the coordinator ran it and the check
  FAILS: `v2/lib/db/client.ts` passes the whole schema namespace to
  `drizzle(d1, { schema })`, so every table export is registered dynamically
  at runtime. No table export may be deleted. The table and its migration
  are untouched regardless. (Non-table symbols in schema.ts follow the same
  occurrence rules as everywhere else.)
- **No test file is created, edited, or deleted.** If a test references a
  symbol you believed dead, the symbol is not dead: skip it and say so in
  the PR body. The full suite must pass with zero test changes.
- **No behavior, visual, copy, or schema changes.** The diff contains only:
  whole-definition deletions, one file deletion (§1), `export`-keyword
  removals, and import removals proven dead by §2's rule. Nothing else.
- No other files change: no config, no package.json, no lockfile, no
  migrations, no workflow files.

## Test plan / done criteria

- `npm run verify` in `v2/` (lint + typecheck + vitest) passes in full,
  with no test weakened, skipped, or changed — the diff to `tests/` is
  empty.
- The PR body lists: every deleted symbol with its occurrence proof, every
  un-exported symbol, and every candidate skipped with its reason
  (including availabilityPhrase and sellerAccounts as pre-excluded).
- Quinn gates the PR after it opens (her own fresh-worktree verify +
  independent re-check of the occurrence proofs). Do not merge.
