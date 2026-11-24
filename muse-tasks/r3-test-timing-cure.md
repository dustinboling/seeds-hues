# R-3 — Test-only timing cure (Quinn return condition from the Item 3.3 gate, extended)

## Provenance

- Quinn's gate record for PR #61 (`QUINN-GATE-tranche-3-3-pr61.md`), return condition **R-3**: in `tests/dom/tranche-3-3-field-states.test.tsx`, the focus assertions were left synchronous while the same build's repair cured the identical mechanism in `tests/dom/farm-errors.test.tsx` (await each `document.activeElement` assertion with `waitFor`). Quinn observed the field-states file fail once under full-suite load on exactly that mechanism (her Finding F-4, Minor): a synchronous focus read racing the focus effect's flush. The component behavior is correct; the defect is in the tests' timing.
- **Extension (coordinator #22, 2026-11-23):** `tests/dom/variety-browse.test.tsx` has now produced the same class of CI failure twice — the PR #61 merge-commit Verify ("Clear all resets every group… focus lands on the first All") and the PR #63 merge-commit Verify ("zero results (recovery + focus)") — each time green in the gate's own reproduction and in repeated local runs. Its synchronous focus assertions get the same cure in this pass.

## The work (test files ONLY)

1. In `tests/dom/tranche-3-3-field-states.test.tsx`: find every synchronous `document.activeElement` assertion and convert it to the awaited form the farm file uses (`await waitFor(() => expect(document.activeElement)…)` — match the cured pattern in `tests/dom/farm-errors.test.tsx` exactly). **Assertion bodies unchanged** — what is asserted about focus does not change, only the waiting.
2. In `tests/dom/variety-browse.test.tsx`: the same conversion for every synchronous `document.activeElement` assertion.
3. If a converted assertion, once awaited, **fails consistently** (i.e., the await reveals the focus genuinely never arrives — a real behavior defect, not a race), STOP: do not touch any component, do not adjust the assertion's meaning; report the failing test, its assertion, and your reproduction counts in the PR body as a blocking finding for the coordinator.

## Evidence required

- Each cured file run **5× consecutively** post-cure: all green, counts reported.
- Full `npm run verify` green on the final tree.
- T-A note: this is a test-timing cure, not new behavior coverage — the base-direction check is that the cured files' assertions are textually identical in what they assert (diff the assertion bodies and state the result in the PR body).

## PR body

Provenance (this brief; Quinn's R-3; the two CI incidents); a per-file enumeration of every assertion converted (test name + the before/after shape); the explicit statement that no assertion body changed in meaning and no non-test file was touched; the 5× run counts; the full-verify result.

## Boundaries

- **Test files only.** No component, lib, CSS, token, or config changes. No assertion weakening, deletion, or skipping — a test that cannot be cured by awaiting is reported, not edited away.
- Quinn re-checks by a chunk re-run (the two cured files + the farm file) — not a full re-gate. Do not merge or deploy.
