# Slice 0 — Workflow standard: in-job repair loop, per-task concurrency, CI-fix-2 (E1–E4)

**What this task is.** ONE file changes: `.github/workflows/muse-code.yml`. Nothing else in the tree changes — no `v2/` code, no tests, no other workflow, no `.gitignore`. This is Slice 0 of the Seed Directory SPA conversion (BUILD-SEQUENCE.md): it brings the seeds-hues Muse workflow to the program standard in `spa-conversion-2026-11-23/ENVIRONMENT-STANDARD.md` (gaps E1–E4), porting the verify→repair loop form proven in the wwwhues repo's workflow (rewritten there 2026-11-23) into THIS workflow's existing single-job structure and preserving this repo's shipped machinery (WIP branch `muse/wip-<run_id>`, `start_from` repairs, PR build accounting + gate-record body) wherever this brief does not explicitly change it.

**Read before editing:** the current `.github/workflows/muse-code.yml` in full (its header comments are its documentation — several describe behaviour you are changing, and you must update them to match), and `QUINN-GATE-ci-wip-branch.md` findings **F1** (Major), **F2** (Minor), **F3** (Minor), which are the defect spec for E4 below.

## The changes

### E2 — Per-task concurrency (one line class)
- `concurrency.group` becomes `muse-code-${{ inputs.task_file }}`; add `queue: max`; keep `cancel-in-progress: false`. (Today's single global group holds only ONE pending run — a newer dispatch silently cancels a queued one. Per-task groups with queue:max mean dispatches of different tasks never eat each other.)

### E3 — Timeout
- Job `timeout-minutes` 60 → **120**.

### New input — `task_ref` (brief materialization, part of E4)
- Add an optional string input `task_ref`, default `""`, described as: "Ref (branch/tag/SHA) to read the task file from; empty reads it from the checked-out tree".
- Add a step **before** the Muse run step that materializes the prompt into `${{ runner.temp }}/bench/task-brief.md`:
  - if `task_ref` is non-empty: `git fetch origin "${{ inputs.task_ref }}"` then write `git show "FETCH_HEAD:${{ inputs.task_file }}"` to that path;
  - else: copy `${{ inputs.task_file }}` from the checked-out tree to that path.
- The Muse run step's `--prompt-file` and the PR step's title grep both read the materialized copy. Nothing about the tree changes: the materialized brief never enters the working tree, so it can never be committed or appear in a PR diff.
- Why: today a `start_from` run reads its brief from the start branch's tree, so a repair brief committed to `main` after that branch forked is invisible to the run (the defect behind the standing "commit the brief onto the start branch" workaround). After this change a repair dispatch names `task_ref: main` and gets the current brief regardless of the start branch.

### BASE recording (foundation for the F1 cure)
- Immediately after the two checkout steps, add a step that records the checked-out commit: `echo "BASE_SHA=$(git rev-parse HEAD)" >> "$GITHUB_ENV"`. Every "did anything change" judgement below compares against `BASE_SHA`, never against porcelain alone.

### F1 cure, part 1 — the no-changes check compares against BASE
- The step "Fail if Muse made no changes" fails **only when both** hold: `git rev-parse HEAD` equals `BASE_SHA`, **and** the porcelain status (excluding `muse-run.jsonl`, as today) is empty. A builder that committed all of its own work (HEAD moved, tree clean) passes this check. A builder that produced literally nothing still fails visibly, exactly as today.

### E1 — In-job verify→repair loop (replaces the single gate step)
Replace the step "Gate on the repo's own tests" with a loop step with this exact behaviour:
1. Define a `checkpoint()` shell function implementing today's WIP mechanics as a reusable operation: `rm -f muse-run.jsonl verify-output.txt` (BOTH artifact names — this is also the F3 cure, below); `git add -A`; if the staged diff is non-empty, commit with a message naming the checkpoint (e.g. `Muse WIP (pre-gate): <task file basename> — run <run_id>` for the first, `Muse WIP (repair round N): …` for later ones); plain-push `HEAD` to `refs/heads/muse/wip-<run_id>` (NEVER force-push — a collision must fail visibly); then `git reset --soft "$BASE_SHA"` to restore the tree state the PR step expects. If nothing is staged and HEAD already differs from BASE (the builder committed its own work), push HEAD as-is (today's echo branch — now reachable).
2. Run `checkpoint` once (this subsumes today's separate "Push a work-in-progress branch (pre-gate)" step — remove that step; its behaviour lives here now).
3. Loop, up to 4 verify attempts total: run `npm run verify` in `v2/` with output captured to `${{ runner.temp }}/bench/verify-output.txt` (NOT the workspace — see F3). On green, stop looping. On red with attempts remaining (3 repair turns maximum), run a repair turn: generate `${{ runner.temp }}/bench/fix-prompt.md` containing (a) a preamble that names the task file and instructs the agent to read it for scope, states that dependencies are already installed and it can run `npm run verify` in `v2/` itself, and carries this discipline verbatim in substance — *fix ONLY what the verify output reports; do not widen scope or start new work; finish every function you reference; leave no unused imports; you may fix a test file only where the test itself is broken (a syntax or runtime error in the test), never weaken or delete an assertion to make the gate pass* — and (b) the last ~300 lines of the verify output in a fenced block. Run `muse exec --prompt-file <fix-prompt> --approval-mode never --disable-sandbox --max-model-steps <input>` with the same env as the main run, appending its JSONL to the run log in runner.temp. Then `checkpoint` again and loop.
4. On red after the 4th verify attempt (3 repair turns spent): print the last ~100 lines of the verify output and exit 1. No PR is created; the WIP branch stands with every checkpoint.
5. **Final gate re-run:** after the loop breaks green, run `npm run verify` in `v2/` ONE more time on the final tree, capturing to the same runner.temp output file (this is the run whose summary lines feed the PR body). Red here fails the job — no PR. (This mirrors wwwhues: the gate re-runs the verify command on the final tree before any PR opens, so the PR step's claim "verify passed in the workflow" is certified against the exact tree being shipped, not an earlier loop state.)

### F1 cure, part 2 + F2 — the PR step handles committed work and counts against BASE
- Keep the PR step's structure, provenance text, build-accounting section, and gate-record section. Change only:
  - The verify summary is read from `${{ runner.temp }}/bench/verify-output.txt` (fall back to today's "summary lines not captured" line when the summary grep finds nothing).
  - The `rm -f muse-run.jsonl verify-output.txt` lines stay (they protect the PR branch against builder-created copies — F3 class).
  - After `git add -A`: if nothing is staged **and** `HEAD` differs from `BASE_SHA`, the work is already committed — proceed: create the PR branch at HEAD and continue to push + `gh pr create` (the branch's diff vs `main` is the change set). Fail with today's "Refusing to open an empty PR" error **only** when nothing is staged AND `HEAD` equals `BASE_SHA`.
  - **Census vs BASE (F2):** `FILES_CHANGED`, `INSERTIONS`, `DELETIONS`, and the diff-stat are computed from the full change set against `BASE_SHA` (e.g. `git diff --numstat "$BASE_SHA"` once the tree's changes are committed on the PR branch — committed-at-HEAD work included), not from the staged diff alone. Quinn's F2: with partially committed work, today's staged-only census undercounts insertions; the census must equal the PR branch's true diff.

### F3 — run artifacts can never be swept into a pushed branch
- `muse-run.jsonl` is tee'd to `${{ runner.temp }}/bench/muse-run.jsonl` (upload-artifact reads it from there; the file never sits in the tree).
- `verify-output.txt` lives only in runner.temp (above).
- Every `git add -A` site (checkpoint function, PR step) is preceded by `rm -f muse-run.jsonl verify-output.txt` so even builder-created in-tree copies are deleted before staging (Quinn's F3 one-liner, applied at every site).
- The no-changes check keeps its `muse-run.jsonl` pathspec exclusion (harmless; covers a builder-created copy).

### Header comments
Update the file's header comment block so every statement in it is true of the new file: the 120-minute bound, the per-task concurrency + queue behaviour, the verify→repair loop (≤3 repair turns, WIP checkpoint after the agent turn and every repair turn, final gate re-run), the `task_ref` materialization, and the BASE-comparison no-changes rule. Keep the sandbox rationale comment (unchanged behaviour) and the WIP-branch-is-scratch paragraph (still true), amending the WIP paragraph to describe checkpoint pushes during the loop.

## Invariants (Quinn will replay these against your file — design for them)

- **I1** Fresh run, `start_from` and `task_ref` empty, builder leaves work uncommitted, verify green first try: behaviour equals today's green path (WIP branch pushed, PR opened with provenance + build accounting + gate-record sections), plus exactly one extra verify run (the final gate re-run).
- **I2** No PR is ever created when the final gate re-run is red, or when the loop exhausts its repair turns red.
- **I3** No pushed branch's tree ever contains `muse-run.jsonl` or `verify-output.txt` — including when the builder itself creates a `verify-output.txt` in the workspace root before the first checkpoint (Quinn's adversarial replay (h)).
- **I4** A builder that commits ALL its work at HEAD gets: no-changes check passes, WIP branch carries HEAD, PR step opens a PR whose diff vs `main` equals the committed change set (F1 cured end-to-end — Quinn's replay (f1) must now reach a PR-shaped branch, not an error).
- **I5** Partially committed work ships the full accumulated set, and the PR body's census equals the true diff vs BASE (F2 cured).
- **I6** A `start_from` run with `task_ref: main` executes the brief as it exists on `main` even when the start branch's tree holds a different or missing copy of the task file.
- **I7** The WIP branch receives a push after the agent turn and after every repair turn; every push is a plain push (collision fails visibly, never overwrites).
- **I8** At most 3 repair turns; each repair prompt embeds the failing verify output's tail and the fix-only discipline; the loop never modifies the task file.
- **I9** Concurrency is exactly: group `muse-code-${{ inputs.task_file }}`, `queue: max`, `cancel-in-progress: false`. Job timeout is exactly 120.
- **I10** The file parses as YAML and every `run:` block is syntactically valid bash. The only file changed is `.github/workflows/muse-code.yml`.

## Working rules for this run

- Edit ONLY `.github/workflows/muse-code.yml`. Do not touch `v2/` (its verify suite is the gate, not the subject). Do not commit or push anything yourself — leave all changes uncommitted in the working tree; the workflow's own steps handle branching and pushing. (This instruction is load-bearing: it keeps this run on the proven uncommitted path while the F1 cure is gated separately by replay + drill.)
- You cannot test the workflow by running it; validate your own edit by parsing the YAML (python3 + yaml is available on the runner image path the repo uses — if PyYAML is absent, use `npx --yes js-yaml` or ruby) and by extracting each `run:` block and running `bash -n` over it. State in your final summary what you ran and its result.
- Keep every step you are not explicitly changing byte-identical (checkout steps, Node setup, Muse install, dependency install, upload step's retention/shape) — Quinn diffs steps by name.
- Efficiency: this is a single-file surgical edit. Read the two named inputs, make the edit, self-validate (YAML parse + bash -n), and finish. Do not run the `v2/` test suite yourself — the workflow's gate step runs it.
