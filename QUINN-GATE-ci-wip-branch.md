# Quinn gate record — CI repair-loop change (WIP branch before the gate)

- **Subject:** commit `f8fee49` on `main` — `.github/workflows/muse-code.yml`, +47/−0 vs its parent, implementing `muse-tasks/ci-wip-branch-before-gate.md`.
- **Gate:** Quinn (independent QA; did not make this work). All evidence below was executed by the gate against `origin/main` (`git show origin/main:…`), never against the main tree's stale working files and never against the maker's summary.
- **Verdict: PASS WITH NOTES.** The change may stay on `main`, and the 3.1b-1 re-dispatch may proceed under the new flow. No invariant bends. The notes are two Minor findings, one Major-rated pre-existing defect this change neither introduces nor worsens (it improves its neighbourhood), and one by-design operational note. None blocks the re-dispatch, whose builder behaviour (uncommitted work, as in all five recorded 3.1b runs) is the path proven end-to-end below.

## Per-invariant verdicts (each measured, not read-and-trusted)

1. **No PR on red — PASS.** Step order in the shipped file: checkout(s) → setup-node → install Muse → npm ci → run task → fail-if-no-changes → upload log → **WIP push** → **gate** → **PR**. The file contains exactly one `gh pr create` (line 267), inside the PR step. The PR step carries no `if:` key, so it runs under the default `success()` condition — only after the gate step succeeds. The WIP step contains no `gh` invocation at all; it pushes a branch and nothing else. Behavioural corroboration: replay (d).
2. **Gate step byte-identical — PASS.** The "Gate on the repo's own tests" step was extracted by name from `f8fee49^` and from `f8fee49` and compared byte for byte: identical. Corroborated globally: the full-file diff is +47/−0 — zero deleted or modified lines anywhere.
3. **Naming — PASS.** The WIP push ref is exactly `HEAD:refs/heads/muse/wip-${{ github.run_id }}`; the PR step's branch stays `BRANCH="muse/${{ github.run_id }}"`. The replay produced exactly `muse/wip-111111`, `muse/wip-222222`, `muse/wip-333333` and `muse/111111`, `muse/333333` — the namespaces cannot collide.
4. **Nothing merges/auto-merges/approves; permissions & concurrency unchanged — PASS.** `permissions:` and `concurrency:` blocks extracted from both versions: byte-identical. A grep for merge/approve operations finds none — the only hits are comments and the PR body's own "Not auto-merged" line. No `force` push exists anywhere in the file.
5. **Logs never committed — PASS, with Minor finding F3.** The WIP step `rm -f muse-run.jsonl` before `git add -A`; in every replay the WIP tree provably lacked `muse-run.jsonl` although the file was present in the working tree. `verify-output.txt` is created only by the gate step, which runs *after* the WIP push, so the workflow's own copy cannot exist at WIP time; the PR step deletes both files before its `git add -A` (replay (c): the PR branch's diff is byte-identical to the WIP branch's diff, and neither log appears in it). The protection for `verify-output.txt` on the WIP branch is ordering only — see F3.
6. **Default behaviour unchanged with `start_from` empty — PASS.** The two checkout steps are mutually exclusive and exhaustive: `if: inputs.start_from == ''` and `if: inputs.start_from != ''`, covering every value of a string input. The first is today's checkout step plus only the `if:` line (verified: removing that one line reproduces the pre-change step byte for byte); the second adds only `with: ref:`. Every other pre-existing step is unchanged (diff is insertions only). The `start_from` input spec matches the brief: type string, `required: false`, default `""`. Replay (a)–(c) is today's green path plus exactly one extra branch on origin.
7. **PR step byte-identical — PASS.** Extracted by name from both versions and compared byte for byte: identical (same method as invariant 2).

## Decisive behavioural proof — local replay of the shipped shell

Method: the WIP step's `run:` script was extracted programmatically from the shipped YAML (not retyped), with only the two Actions expressions substituted (`inputs.task_file` → `muse-tasks/toy-task.md`, `github.run_id` → the scenario's id), and run under `bash -e` (the Actions default) in clones of a bare scratch origin seeded with a toy tree at a base commit. The PR step was continued with its own git commands (log deletion, `git switch -c muse/<id>`, `git add -A`, its staged-empty guard, commit, push), stopping before any `gh` call. The shipped file also passes `yaml.safe_load` parsing, and the substituted WIP script passes `bash -n`.

- **(a) WIP carries the work — PROVEN.** After the WIP step (run 111111; change set = modified `file1.txt` + new `file2.txt`, with a `muse-run.jsonl` present in the tree), origin held `muse/wip-111111` whose diff vs base was exactly that change set, and whose tree did not contain `muse-run.jsonl`.
- **(b) Soft reset restores the staged state — PROVEN.** After the step, local HEAD equalled the base SHA, and `git diff --cached --stat` measured the full change set (`file1.txt`, `file2.txt`) as staged changes — exactly the state the byte-identical PR step expects.
- **(c) PR branch equals the full change set — PROVEN.** The PR-step git commands produced `muse/111111` on origin; its diff vs base was compared with the WIP branch's diff vs base: **identical diffs**, file for file and line for line.
- **(d) Red path — PROVEN.** Fresh clone, change set made, WIP step run (222222), PR step skipped entirely (simulated gate failure): origin held `muse/wip-222222` carrying the full work, and no `muse/222222` branch existed.
- **(e) Repair path — PROVEN.** A clone checked out at `muse/wip-222222` (the `start_from` position, HEAD = the WIP commit), a further fix applied, WIP replayed under a new run id (333333) and the PR-step git commands run: `muse/333333`'s diff vs base is the **accumulated** set — original work (`file1.txt` red-work line, `redfile.txt`) plus the fix (`fix-line`, `fixfile.txt`), nothing lost, nothing duplicated.

## Watch items — traced and rated

### F1 — Major (pre-existing; not introduced by this change): a builder that commits *all* its own work still loses it, before the WIP step ever runs

Trace, executed in replay (f1): with the work fully committed at HEAD, the earlier "Fail if Muse made no changes" step (unchanged by this change) sees a clean porcelain — its only exclusion is `muse-run.jsonl` — and exits 1 **before** the upload, WIP, and gate steps. The WIP step's "already committed at HEAD" echo branch is therefore unreachable in exactly the case it describes: it can only be reached if the tree becomes clean between that check and the WIP step, which no intervening step does. Two sub-verdicts the coordinator asked for:

- **If the echo branch were reached** (isolated by bypassing the earlier step in replay): it pushes HEAD to the WIP branch correctly, the soft reset is a true no-op, and the PR step then hits its own guard — `::error::Nothing staged after removing the run log. Refusing to open an empty PR.` — and exits 1. **It fails visibly. It never silently mis-ships**: no empty PR, no partial PR, and the WIP branch holds the work for a repair dispatch.
- **Partially committed work** (replay f2) ships correctly: the PR branch carries the full accumulated set through ancestry. One accounting wrinkle — see F2.

Why this does not fail the gate: the defect lives in a step this change was forbidden to touch (invariants 2 and 7, scope fence), it predates the change, and the change strictly improves the neighbourhood (partial commits now survive on the WIP branch; before, a red gate discarded everything). The pipeline's recorded builder behaviour — all five 3.1b runs and every run that produced a PR — leaves work uncommitted, which is the path proven in (a)–(e). Recommended future brief (not a condition of this gate): make the fail-if-no-changes check compare against the checkout base rather than porcelain alone, or state "never commit your work" explicitly in builder task briefs. This is the PR #49 incident class; it deserves its own fix, separately gated.

### F2 — Minor: PR-body census undercounts when a builder has partially committed

In replay (f2) the staged census after the soft reset counted 2 insertions where the PR branch's true diff vs `main` was 3 (the committed part rides in ancestry, invisible to `git diff --cached`). Files-changed count stayed correct in the replay. Impact is confined to the PR body's build accounting — the shipped code is the full set — but Quinn's own gate work reads that census, so the undercount is recorded here rather than discovered later.

### F3 — Minor: `verify-output.txt` protection on the WIP branch is ordering, not deletion

The WIP step deletes only `muse-run.jsonl`. Adversarial replay (h): a `verify-output.txt` created in the workspace root *by the builder* before the WIP step is swept up by `git add -A` and committed to the WIP branch. The workflow's own `verify-output.txt` cannot be affected (the gate creates it after the WIP push — invariant 5 holds for every file the workflow itself produces, and the PR branch is explicitly protected by deletion in the PR step). Impact ceiling: a stale log file on a never-merged scratch branch. A one-line `rm -f verify-output.txt` beside the existing `rm` would close it whenever the workflow file is next legitimately edited; not worth a change on its own.

### F4 — Note (by design, recorded so nobody is surprised): Actions "Re-run" of a pushed run fails at the WIP step

Replay (g): a second, divergent push to the same `muse/wip-<run_id>` ref (what a re-run of the same run id attempts) is rejected non-fast-forward, the step exits 1, the job stops before the gate, and the original WIP branch is untouched — exactly the brief's specified behaviour ("a collision must fail visibly, not overwrite"), and the safe direction. Operational consequence: after a failed run, do **not** use the Actions re-run button; dispatch a fresh run (new run id) with `start_from` naming the surviving WIP branch — which is precisely the repair loop this change exists to provide.

## Coverage ledger

- **Population:** the brief's seven invariants, the two coordinator watch items (committed-at-HEAD branch, re-run collision), and the brief's own self-checks (YAML parse, `bash -n`, step order, green/red traces).
- **Checked:** all seven invariants by extraction/diff/grep measurement; step order and input spec by parsed YAML; behaviour by five scripted replay scenarios (a)–(e) plus three adversarial scenarios (f1, f2, g, h) using the verbatim extracted shell against a real git origin.
- **Evidence fidelity:** the git semantics exercised (push, soft reset, staged census, ancestry) are the real operations the workflow performs, run against a real (local bare) origin — high fidelity for everything except GitHub-hosted specifics. Substituted by hand: the two Actions expressions, and `gh pr create` was not executed (stopped before it, per the gate brief) — PR *creation* itself is proven only to the branch-push link of the chain; the `gh` invocation is inside the byte-identical PR step whose production history already exercises it.
- **Exclusions:** no live Actions run was dispatched (outside this gate's authority, and the semantics under test are runner-independent); the toy tree stands in for `v2/` content because the gate step is byte-identical and untouched — nothing about `npm run verify` itself was in scope.
- **Evaluator structure:** single evaluator (Quinn). This is CI configuration semantics with fully scripted, reproducible evidence — not interactive or identity work — so no second rater was commissioned; every measurement above is re-runnable from the shipped file.
- **Residual risk:** GitHub-hosted-runner behaviours that differ from local git (checkout ref handling for an arbitrary `start_from` branch name, token push permissions for the new branch namespace) are the class of defect this coverage could still miss; the first real repair dispatch is the live confirmation, and its WIP push + PR (or red-gate survival) should be eyeballed against this record.

## Verdict restated

**PASS WITH NOTES** — invariants 1–7 all hold on executed evidence; replays (a)–(e) all proven; findings F1 (Major, pre-existing, separate fix), F2 (Minor), F3 (Minor), F4 (note, by design). The change stays; the 3.1b-1 re-dispatch may proceed under the new flow, using fresh dispatches with `start_from` for repairs rather than Actions re-runs.

— Quinn, quality assurance gate
