# Refactor R2: DOM test layer + shared fixtures + API chassis tests

## Why

Slice R2 of the Seed Directory refactoring plan (`refactor-2026-11-21/PLAN.md`
§3). The BusyForm admin sign-in bug shipped on 2026-11-21 while 734 automated
tests passed: BusyForm's submit handler disabled its own form fields, disabled
controls are excluded from a native submission's form data by spec, and the
whole suite was node-only — no test anywhere constructed a form submission the
way a browser does, so the defect class was structurally invisible to verify.
The standing testing standard written after that audit
(`testing-audit-2026-11-21/STANDARD.md` §2.1) requires, for anything a user
submits, a DOM-submission or real-browser test that submits the form the way a
browser does and asserts what the server received. This slice builds that
proof layer as shared infrastructure, generalizes the one-off pattern the
BusyForm fix introduced, de-duplicates the copy-pasted test fixtures, and
gives the API chassis files their first direct tests.

**Coordinator re-verification against current `main` (2fb802a), 2026-11-21 —
read this before assuming the plan's survey state.** Part of the survey-era
scope has already landed through other workstreams and must NOT be redone:

- `jsdom` (31.0.1) and `@testing-library/react` are already installed
  devDependencies. **Do not add dependencies.**
- `tests/dom/` already exists with three files (`busy-form-submission`,
  `farm-errors`, `waitlist-success`), each using the per-file
  `// @vitest-environment jsdom` docblock; `vitest.config.ts` already
  includes `tests/dom/**/*.test.tsx` and keeps `environment: "node"` as the
  default. **Keep that pattern; no config change is expected.**
- `tests/dom/busy-form-submission.test.tsx` already asserts the FIXED
  BusyForm behavior (it is the PR #20 gate evidence). What does not exist yet
  is the shared helper, the in-suite defect proof, the fixture factories, and
  the chassis tests — those are this slice.

This slice is **tests only**: no production code changes anywhere.

## Scope — exact changes

### 1. Shared DOM form-submission helper — `v2/tests/helpers/dom-form.tsx`

Generalize the hand-rolled pattern in `tests/dom/busy-form-submission.test.tsx`
(render → fill → submit → let the busy state flush → `new FormData(form)` →
assert the payload) into one helper module. The helper must:

- render a form component with Testing Library;
- drive field changes and the submit event;
- flush React state updates (act) so post-submit state (busy labels, disabled
  submit button) is settled before the payload is constructed;
- construct the payload with `new FormData(form)` — the browser's own
  construction for a native submission, which is exactly what excludes
  disabled controls — and hand the `FormData` to the test for assertions.

Adopt the helper in `tests/dom/busy-form-submission.test.tsx` with **every
existing assertion preserved verbatim in meaning** (that file is gate
evidence; its assertions may be re-expressed through the helper but never
weakened, dropped, or re-worded to pass). Adopt it in the other two
`tests/dom/` files only where it genuinely fits their mechanics; where it
does not fit, leave the file untouched and say so in the PR body.

### 2. Defect-double proof — new `v2/tests/dom/form-submission-harness.test.tsx`

Make the harness's sensitivity to the BusyForm failure mode a permanent,
in-suite proof (today it exists only as a one-time manual gate check):

- A test-local double component replicating the pre-fix BusyForm pattern: a
  native POST form whose submit handler disables the wrapping `<fieldset>`
  (the exact PR #20 root cause). Submit it through the §1 helper and assert
  the constructed payload is **empty** — the harness sees the defect.
- A paired test: the same form shape rendered through the real `BusyForm`,
  submitted through the same helper, asserting the payload arrives **intact**.

Both tests must go through the §1 helper, so the proof covers the helper
itself, not a private re-implementation.

### 3. Services-context mock factory — `v2/tests/helpers/services-context.ts`

Twelve test files currently paste near-identical
`vi.mock("@/lib/services/context", …)` boilerplate (contract ×2, integration
×6, unit ×4 — coordinator-counted on current main). Add one factory that
produces the `getServices` mock module shape with per-file overridable fakes
(catalog, accounts, and whatever else the current boilerplates stub), and
adopt it in the files whose boilerplate genuinely matches. Rules:

- `vi.mock` is hoisted per file; use a mechanism Vitest 5 supports for
  factory-based mocks (dynamic import inside the mock factory, or
  `vi.hoisted`) — the mechanism is your choice, the meaning is not: each
  adopted file keeps **its own fake data and every one of its assertions**.
- A file whose mock has materially diverged from the common shape is left
  untouched and listed in the PR body as skipped-with-reason.

### 4. SellerDetail fake factory — `v2/tests/helpers/seller-detail.ts`

Six test files hand-build a fake `SellerDetail` (`tests/contract/api.test.ts`,
`tests/unit/admin-sellers.test.ts`, `tests/unit/route-not-found.test.ts`,
`tests/unit/seller-states.test.ts`, `tests/unit/seo.test.ts`,
`tests/unit/state-plates.test.ts`). Add `fakeSellerDetail(overrides)` returning
a complete, valid `SellerDetail`, and adopt it in those files, preserving each
file's field values through overrides. Assertions unchanged.

### 5. Direct unit tests for the API chassis — new test file(s) under `v2/tests/unit/`

These files are exercised today only indirectly (zero direct test imports —
coordinator-verified). Add direct tests pinning their **current** behavior:

- `lib/api/route.ts` — `apiRoute`: success envelope shape, error mapping
  (`Problem`/`ApiError` → response), and any method/auth plumbing the wrapper
  itself owns.
- `lib/api/write-route.ts` — `parseBody` (valid body passes; schema failure
  raises the current error), `intParam` (valid/missing/non-numeric), and
  `writeRouter` dispatch semantics (matched route, unknown path, wrong
  method) at the level the module exposes.
- `lib/api/problem.ts` — `problemBody`/`problemResponse`: RFC 9457 shape
  (`application/problem+json`, status/code/detail fields, extra fields).
- `lib/api/handlers.ts` — the read handlers (`listVarieties`, `getVariety`,
  `listSellerListings`, etc.) against a fake services object (the §3 factory
  is the natural source): happy paths plus the not-found problem for a
  missing slug.
- `lib/paging.ts` — `parsePage`, `pageWindow`, `totalPages`,
  `assertPageInRange`, `pagePath`, `pageTitleSuffix`, `parseSeasonParam`,
  `parseMethodParam`. Pin current behavior exactly — including
  `assertPageInRange`'s current throw semantics. Changing any of this
  behavior is a different (held) workstream; this slice only proves what is.
- `lib/session.ts` — whatever is unit-reachable with the suite's existing
  mocking patterns (e.g. mocked `next/headers`). If a function cannot be
  exercised without changing production code, do not change production code;
  cover what is reachable and list the rest in the PR body as
  skipped-with-reason.

## What must NOT change

- **No production code.** Nothing under `v2/app/`, `v2/lib/`, `v2/components/`,
  `v2/public/`, or `v2/scripts/` changes. No schema, no migrations, no copy,
  no visual change. The diff is confined to `v2/tests/` (plus this brief).
- **No dependency changes.** `package.json` and the lockfile are untouched —
  jsdom and Testing Library are already installed (see re-verification).
- **No vitest config change expected.** The include list already covers
  `tests/dom/`; the default environment stays `node`; jsdom stays per-file
  via docblock. If you believe a config change is unavoidable, keep it
  minimal, prove every pre-existing test still runs under the same
  environment it ran under before, and justify it prominently in the PR body.
- **No existing assertion is weakened, deleted, skipped, or re-worded to
  pass.** Fixture/helper adoption preserves each file's fake data and
  assertions. The suite's `it()` count must not decrease; the total test
  count increases by the new tests (§2 and §5).
- The three existing `tests/dom/` files keep their current proof obligations
  in full.

## Test plan / done criteria

- `npm run verify` in `v2/` (lint + typecheck + vitest) passes in full.
- Proof kinds (per STANDARD.md §5): this slice adds the **DOM-submission**
  layer as shared infrastructure. No browser/device layer is claimed —
  test-only slice, no shipped surface changes.
- Non-vacuity, both directions, demonstrable from the PR:
  - §2's defect-double test asserts an EMPTY payload for the broken pattern
    and an INTACT payload for the real `BusyForm`, through the same helper.
  - The PR body states the manual re-proof Quinn will run at gate: mutate
    `BusyForm` in a scratch worktree to disable its fieldset on submit (the
    pre-fix pattern) → `tests/dom/busy-form-submission.test.tsx` and §2's
    paired test must FAIL; restore → PASS.
- The PR body lists: the helper APIs added (§1, §3, §4); every file adopted
  per factory and every file skipped-with-reason; a per-file coverage map for
  the §5 chassis tests; and anything found untestable without production
  changes, as skipped-with-reason.
- Quinn gates the PR after it opens (her own fresh-worktree verify, the
  mutation re-proof above, and a diff review that no existing assertion was
  weakened). Do not merge.
