# Tranche 3, Item 3.2 — CONTINUATION (verify + PR creation only; the build is already complete on this branch)

## State you are starting from

The original build run (45268772164, brief `muse-tasks/tranche-3-2-waitlist-flip.md`) **completed the full build** on this branch and its final in-run `npm run verify` **exited 0 (97 test files green)** — but the job hit its 60-minute timeout after the WIP push, before any PR was created. The branch you start from (`muse/wip-45268772164`, head `8d2fe95`) contains the complete build: 26 files, +2686/−112, including migration `0016_waitlist_pending_joins.sql`, the service/route/floor work, 42 new tests, two spec-mandated stale-test updates, and `PR-3-2-BODY.md` at the repo root — the maker's complete accounting, already written.

**Do not rebuild, redesign, or refactor anything.** The build's files are final unless step 1 surfaces a reproducing failure.

## Your tasks, in order

1. **Re-run `npm run verify` on this tree and confirm green.**
   - If it exits 0: proceed to step 2.
   - If a failure appears: re-run the failing file in isolation. The original run observed ONE intermittent failure in the 3.3 create-account DOM test (an `aria-describedby` assertion) that passed standalone 18/18 twice and sits on code this build does not touch — the known parallel-load flake class. If your failure matches that pattern (fails in the full run, passes in isolation, on code outside this build's diff), record it in the PR body as a flake with the isolation evidence and proceed.
   - If a failure **reproduces in isolation**, fix it minimally (the smallest change that makes the test's stated assertion pass honestly — never weaken an assertion) and re-run the full verify. Report the failure and the fix in the PR body.
2. **Create the PR** for this branch against `main`, using `PR-3-2-BODY.md` (repo root, in this tree) as the PR body, with one section appended at the end: "Continuation note" — stating the original run id (45268772164), that it completed the build and a green verify but timed out before PR creation, this run's id, and this run's verify result (including any flake record from step 1).
3. **Delete `PR-3-2-BODY.md` from the branch** in a final commit before finishing, so the scaffolding file does not merge to main. (The PR body itself carries the accounting.)
4. Final report: the PR number and URL, this run's verify result (file/test counts), and any step-1 failure handling, stated plainly.

## Boundaries

- No changes to the build's 25 non-scaffolding files except a step-1 minimal fix for a reproducing failure.
- No assertion weakening, no test deletion, no skipping.
- Migration 0016 is part of the build; do not apply anything to any database — deployment and migration application are the coordinator's ship steps after the gate.
