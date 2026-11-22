# Tranche 3.1a — successor fix for Quinn gate findings F1 + F2 (PR #41)

PR #41 (branch `muse/45077555769`) FAILED Quinn's gate (`QUINN-GATE-tranche-3-1a-pr41.md`): NOT A PASS. Everything executed passed except two Major spec-conformance findings, both in the build's own surface on `/variety`. This successor fixes exactly those two, on top of PR #41's work — do not rebuild the item, do not touch anything the gate passed. (The gate's remaining owed item — the real-browser drive — is not yours; it runs at the re-gate.)

## F1 — Per-option counts need their screen-reader-only unit (SPEC §2.4.2)

`ChipCount` in `BrowseFilters.tsx` renders counts as a bare `(12)` with no sr-only unit. SPEC §2.4.2 requires the StateFilter pattern it generalizes: a bare muted numeral for sighted readers PLUS an sr-only unit word (StateFilter renders the numeral + sr-only " sellers"). Apply that pattern to every count `ChipCount` renders, on `/variety`, in both the server-rendered and hydrated states: the visible rendering does not change at all; the accessible rendering gains the unit. Use the unit word §2.4.2 prescribes for this surface — read the SPEC text and the StateFilter implementation and match them; if the SPEC names a different unit for variety counts than "sellers", the SPEC wins. The build's own tests must pin the accessible form, not just the visible one.

## F2 — Applied-row naming must match SPEC §2.6.1 / §2.6.2

The applied row deviates from the spec in three places:
- Remover chip label is value-only ("Pink"); spec form carries the group: "Hue: Pink" (per §2.6.1 — match the spec's exact label construction for every group, not only Hue).
- The remover's accessible name is "Remove Pink"; spec/check 3.1-D form is "Remove the Hue filter, Pink" (per §2.6.2 — the "Remove the {group} filter, {value}" construction for every group).
- Clear All reads "Clear all"; the spec label is "Clear all filters".

Bring all three to the spec's exact forms everywhere the applied row renders (SSR floor and hydrated). PR #41's tests pin the deviating names — update those pins to the spec forms; the updated pins are part of this fix's proof.

## Proof (the re-gate will re-run it)

- `npm run verify` green; counts vs PR #41's branch stated in the PR body (the delta should be small and explained by F1 + F2 only).
- Diff scope: only the files F1/F2 touch (BrowseFilters and its tests, plus any file the applied-row naming lives in). Everything the gate passed stays byte-identical in behavior — if you believe a passed surface must change to make F1/F2 consistent, stop and say so in the PR body instead of changing it.
- Non-vacuity: the updated naming/count tests FAIL against PR #41's head and PASS on your branch — state both runs in the PR body.
- The PR body carries the standard accounting (files changed, verify counts branch vs PR #41 head, proof results, non-vacuity statement) and quotes Quinn's F1/F2 text it answers.

## Discipline (standing)

- No scratch or fixture files. ESLint per file group as you go; strict narrowing in tests.
- Finish discipline: run the full `npm run verify` once, as the last act. If verify fails, fix only failures in files this task touched, re-run once more, and finish. Failures in untouched files: report verbatim in the PR body, do not chase. Never more than two verify runs.
- US spelling. No prices anywhere. Nothing outside F1 + F2.
