# Tranche 3, Item 3.3 — REPAIR of the first build (workflow verify gate FAILED on typecheck)

## Provenance

- The original brief `muse-tasks/tranche-3-3-field-states.md` remains in force in full (scope fence, register D-1…D-12, T-A, PR-body hygiene). This brief only cures the gate failure below; it adds no scope.
- First build: run 45247203209, preserved on the WIP branch (this run's start point, head f121013). Its verify gate failed at **typecheck**; lint passed; the test suite never ran. The coordinator reproduced the failure locally on the WIP head — the complete failure set is exactly the two errors below, nothing else.

## The failure (complete, reproduced)

```
tests/unit/tranche-3-3-shared.test.ts(27,147): error TS2769: No overload matches this call.
  Type 'RefObject<unknown>' is not assignable to type 'RefObject<HTMLDivElement | null>'.
tests/unit/tranche-3-3-shared.test.ts(36,124): error TS2769: No overload matches this call.
  Type 'RefObject<unknown>' is not assignable to type 'RefObject<HTMLDivElement | null>'.
```

Cause: the test passes a bare `createRef()` (typed `RefObject<unknown>`) as `FieldSummary`'s `summaryRef` prop, which is typed `RefObject<HTMLDivElement | null>`, at both call sites (the Content A render and the Content B render).

## The cure

1. Type the two refs at creation: `createRef<HTMLDivElement>()` at both call sites in `tests/unit/tranche-3-3-shared.test.ts`. Change nothing else in that file — its assertions stand as written.
2. Then run `npm run verify` **in full** and iterate to exit 0. If the test run (which the first build never reached) surfaces failures in the build's own new tests, fix them at their cause — a wrong assertion gets corrected with the reason stated in the PR body; a real defect in the set or a form gets fixed in the component, never by weakening the test to pass. If a failure traces to pre-existing behavior outside this build's register, STOP on it and state it plainly in the PR body instead of fixing out of scope.
3. Complete the PR body to the original brief's full hygiene list (provenance; per-form disposition table for every §4.3 form; register conformance D-1…D-12; T-C — the original brief expects NO payload fields added, say so explicitly; machinery-change flags incl. any shared constants module; each new test's base behavior under T-A; the Gate record section naming checks 3.3-A…E + 3.3-V1…V15 with the browser-drive portions named as owed if the gate session cannot drive them). The first build's run produced the stub body only — the repair's PR body is the record of BOTH runs: name run 45247203209, its gate failure, and this cure in the provenance.

## Lessons fenced

1. A green workflow gate does NOT mean the deliverable exists — and a red one names exactly what to cure. Cure what is named; do not rebuild what already stands (the set, the forms, the mappings from run 45247203209 are the build; this run continues them).
2. Lint AND typecheck as you go; run `npm run verify` in full before ending and iterate to exit 0.
3. Leave your work UNCOMMITTED in the working tree — the workflow's WIP/PR steps handle branching. A fully-committed tree trips the no-changes guard and kills the run.
