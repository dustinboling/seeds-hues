# Tranche 3.5 — Variety pagination bounds → true 404s (RE-DISPATCH)

The task is exactly `muse-tasks/tranche-3-5-pagination-404.md` (source: Tranche 3 SPEC §6; Quinn's design gate cleared this item). Read that brief and follow it in full. This file adds only the re-dispatch context and finish discipline:

- **The first build run (45027450898) was cancelled by the coordinator after ~75 minutes** in the builder step with no branch and no PR — it never converged. Nothing from it landed; start from current main.
- **The change is one route.** `/variety` is the last paginated route still streaming a 200 shell for out-of-range pages; the guard (`assertPageInRange`) already exists and the two sanctioned patterns are in the original brief. Pick one pattern, implement it, write the status-through-render tests the brief requires, and stop.
- **Finish discipline:** run the full `npm run verify` once, as the last act. If verify fails, fix only failures in files this task touched, re-run verify once more, and finish. If a failure is in files this task did not touch, do not chase it across the codebase — finish with the PR body reporting the failure verbatim and which files it sits in; the gate will judge it. Do not iterate beyond two verify runs.
- All other discipline from the original brief stands (no scratch files, derived-not-hardcoded expectations, non-vacuity stated in the PR body, US spelling, nothing outside scope).
