# Recovery — SHOP build: carry the finished branch through the gate to a PR

## Provenance — read carefully; this run's shape is unusual

The SHOP build (`muse-tasks/shop-build.md`, the contract in full) is **already built and committed on this branch** (`muse/wip-45310118248`, head 67b15e7), and the coordinator has independently run `npm run verify` on this exact tree: **green — 105 test files / 1,576 tests, lint + typecheck + vitest all passing.**

The branch has no PR for one reason only: the known workflow defect F1 (queued as CI-fix-2). A builder that commits its own work leaves a clean tree, the workflow's "Fail if Muse made no changes" step kills the job, and the WIP-push / gate / PR steps never run. That is what killed the repair run — its work survived only because it pushed to this branch itself.

## Your task

1. **DO NOT COMMIT. DO NOT PUSH. Leave every change you make uncommitted in the working tree.** The workflow's own steps carry the branch from there. If you commit, this run dies the same death as the last one.
2. **Completeness pass:** re-read `muse-tasks/shop-build.md` against the committed tree. If anything in the brief is unbuilt or partially built, implement the gap now (uncommitted), within the brief's Boundaries. If you find a gap you cannot close inside this run, leave a precise note of it in the PR accounting (step 4) instead of forcing it.
3. **Confirm the gate:** run `npm run verify` in `v2/`. It should be green on arrival. If anything is red, fix it at the cause (uncommitted) and re-run until green.
4. **The carrying change:** if the completeness pass leaves you with no uncommitted change, make this one — it is genuinely owed. The design gate's one open note (N-R1, `shop-design/QA-GATE-delta-regate.md`) records two stale prose passages in `shop-design/UI-DESIGN.md` (§§8 and 18) that still describe the shop's filter set as four groups; the Crop group (register S-13) makes five, and check SH-17 as amended is the operative five-group text. Conform every stale "four"-group passage in `shop-design/UI-DESIGN.md` to the five-group reality (grep the file for group-count language; prose only, no design change, no other file). Mina's conformance at next touch, explicitly no re-gate owed.
5. **PR accounting:** the pull request this run produces must carry the FULL accounting the original brief's "PR body" section requires (provenance; design documents lifted; migration 0018's additive-only statement; endpoint shapes; payload changes; counts mechanism; generic-pod asset decision; T-A both directions; the SH / SH-G / SH-22…27 check series answered with any un-runnable check named plainly; no-production-data statement), PLUS a recovery section: run 45310118248 built the substance and its final gate failed on 15 lint errors + 5 tests; repair 1 (commit 67b15e7, tests-only) cleared them; run 45316409697 died at the F1 no-changes defect after committing that repair; the coordinator independently verified 67b15e7 green (105 files / 1,576 tests) before this recovery dispatch; this run's own changes (from steps 2–4) listed exactly.

## Boundaries

The original brief's Boundaries stand in full. Do not merge, deploy, or touch production data. Do not reformat, refactor, or "improve" committed code outside a genuine completeness gap. No new scope.
