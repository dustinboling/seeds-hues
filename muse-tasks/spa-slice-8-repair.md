# Slice 8 REPAIR — hermetic serving 500 (F1) + a11y block (F2) + rehearsal artifacts (F3)

You are repairing Slice 8 of the Seed Directory SPA conversion. PR #81 (branch `muse/45583193488`) FAILED Quinn's gate (record: `QUINN-GATE-spa-slice-8.md` on main — read it first, then the Slice 8 brief `muse-tasks/spa-slice-8-hardening-parity.md` incl. its repair addendum). You start from the PR branch — the full Slice 8 tree. **Fix only what this brief names; everything Quinn verified strong (parity 220/220 + 224-suite, headers, error surfaces, inventory exact, robots, verify 65 files / 1,257 tests) must stay byte-stable in behavior.**

**Work tests-first where a test can discriminate, and treat your summary accounting as a deliverable** (the coordinator appends it to the repair PR's body verbatim).

## Standing constraints

- Still INERT; `v2/` untouched. **No `.github/workflows/*` edits** — if the Lighthouse workflow file itself seems to need a change, STOP and report it in your summary instead (the coordinator lands workflow changes under the scoped credential). `app/.lighthouserc.json` and app code are yours to change.
- Prices never shown anywhere. US spelling. Strict TS, no stubs.

## F1 (Major, blocking) — the built app's hermetic mode 500s; Lighthouse has never asserted

Quinn's direct observation on the built artifact: `npm run build` + `SEEDS_API_BASE=stub:parity npm run serve` → `/crop` 500 (persistent) and `/` 500, serve log `TypeError: fetch failed`; other templates 200. Lighthouse CI run 45596893268 on PR #81 concluded FAILURE the same way (`/crop` ERRORED_DOCUMENT_REQUEST; the assert step never ran — zero assertions have ever been evaluated). The verify suite is green only because its harness runs the stub in-process from TS sources — the built server's embedded-stub path was never exercised. The first builder named this exact failure "undiagnosed" and the repair turns did not close it.

Required:
1. **Diagnose the root cause** of the built-mode fetch failure (state it in your summary — what differs between the in-process harness and the bundled `dist-server` embedded stub on `/` and `/crop` specifically) and fix it in the app/serve layer.
2. **Add a built-artifact smoke probe to the verify chain:** build, serve the built server in `stub:parity` mode, assert 200 + non-empty HTML on the five Lighthouse URLs (`/`, `/variety`, `/seller`, `/crop`, `/search`), then shut it down. The probe must FAIL on the PR #81 tree and pass on yours (state both results).
3. **Lighthouse green with assertions evaluated:** after your fix, the hermetic LHCI run must complete collect + assert; report the assertion table (per-URL medians vs thresholds) in your summary. Threshold honesty stands as Quinn judged it (LCP 6 s labeled lab guard, TBT the INP proxy, JS 150 KB + CLS 0.1 exact) — do not weaken any threshold to get green; if a threshold cannot be met, report the measured value and the gap instead.

## F2 — complete the a11y per-template static audit

The complete accessibility pass the brief commissioned exists only as focus/announcement pins (route-focus 5, inplace-focus 4). Add the per-template static audit block to the hardening suite: every template in the inventory checked for the static AA-floor properties the prior slices sampled (landmarks, heading order, form labels, alt/aria contracts, focus-visible posture) — discriminating tests first, failures fixed app-side or recorded with their ruling. State the coverage count in your summary.

## F3 — rehearsal record + budget table + mount re-confirmation, as artifacts

1. Execute the automatable day-0 rehearsal against the built app served in the (now-fixed) hermetic mode and commit the rehearsal record (path stated in your summary): item-by-item results, mirroring the brief's Step-3 list.
2. Print the budget table — per-template measured vs threshold, pass/fail — as a committed artifact (the parity report's sibling under `app/parity-reports/` or a path you state).
3. Re-confirm by code read + test that the app degrades as the gates recorded until Slice 9 mounts `/api/internal/variety-status/[slug]`, `/api/internal/unsubscribe/describe`, and `/api/internal/admin/*` — state the degradation behavior per mount in your summary.

## Your summary must state

- The F1 root cause (one paragraph, exact) + the smoke probe's red-on-#81 / green-on-yours results.
- The Lighthouse assertion table and the workflow's expected result on your PR.
- F2 coverage count; F3 artifact paths.
- Starting-red and final green counts for everything you added or changed; the full verify result on your final tree.
- Anything still open and why — plainly.
