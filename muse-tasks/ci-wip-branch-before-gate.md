# CI — Muse workflow: push a WIP branch before the verify gate (repair loop)

## Provenance — why this change exists

Item 3.1b (Tranche 3 filter-parity spread) has now failed the Muse workflow's verify gate **five consecutive times** (unsplit runs 45115938520 / 45117989214 / 45120161154 / 45123921589; split part 1 run 45128133178) — each time on a different mechanical error, never on the design, and each time the entire build was discarded because **the workflow pushes no branch before its gate and has no repair loop**: a red gate leaves nothing behind to repair. Five full rebuilds at ~20–35 minutes each is the measured cost of the current shape.

**Decision (Hue, programme management, 2026-11-22 — path (a) of the coordinator's stop report):** the workflow pushes a work-in-progress branch, `muse/wip-<run_id>`, **before** its verify gate. A pull request still opens **only** on a green gate, so nothing ungated can be mistaken for gated work; but a failed gate now leaves a surviving branch that a repair dispatch can continue instead of discarding the whole build. This brief implements exactly that decision. Base: current `main`.

## Scope fence

**The only file this build may change is `.github/workflows/muse-code.yml`.** No `v2/` changes, no other workflow, no task files, no docs. If the change appears to need anything else, stop, make no other edit, and say so in the PR body instead.

## The change — three parts, all inside `muse-code.yml`

### 1. A new step: "Push a work-in-progress branch (pre-gate)"

Insert it **after** the "Upload the Muse run log" step and **immediately before** the "Gate on the repo's own tests" step. (The "Fail if Muse made no changes" step has already run by then, so the tree is known to carry work.) The step must, in order:

1. Delete `muse-run.jsonl` from the tree — the run log is **never committed on any branch**, WIP included (the same rule the PR step enforces today; do not rely on `.gitignore`).
2. Capture the current HEAD: `BASE="$(git rev-parse HEAD)"`.
3. Set the git identity to the same `github-actions[bot]` name/email the PR step uses.
4. `git add -A`. If the staged diff is non-empty, commit with the message `Muse WIP (pre-gate): <task file basename> — run <run_id>`. If it is empty (the tree's work is already committed at HEAD), make no commit — the push below still carries HEAD.
5. Push with a **plain** push of the current HEAD to the WIP branch: `git push origin "HEAD:refs/heads/muse/wip-<run_id>"`. **Never** force-push, anywhere in this file. A push collision (e.g. a re-run reusing a run id) must fail visibly, not overwrite.
6. If step 4 made a commit, undo it locally without touching the pushed branch: `git reset --soft "$BASE"`. This restores the working tree to exactly the state the existing PR step expects (the full change set present as staged changes against the base), so the PR step below runs **byte-identical to today** — its staged-diff census still measures the full change set, and its own commit carries the work onto the PR branch. If step 4 made no commit, the reset is a no-op against the same HEAD and may still run unconditionally.

### 2. A new optional dispatch input: `start_from`

Add a `workflow_dispatch` input `start_from` (type string, `required: false`, default empty) — the branch a repair dispatch continues from. Implement the checkout as **two conditional steps** (do not rely on empty-string `ref:` semantics in actions/checkout):

- `Check out the repository` — `if: inputs.start_from == ''` — exactly today's checkout step, unchanged.
- `Check out the repository (repair: continue from a WIP branch)` — `if: inputs.start_from != ''` — the same step plus `with: ref: ${{ inputs.start_from }}`.

A repair dispatch names a surviving `muse/wip-<run_id>` branch in `start_from`; the run builds on that work, its own pre-gate push goes to its own `muse/wip-<new run_id>`, and its PR (green gate only) carries the accumulated diff against `main`. When `start_from` is empty, every step behaves exactly as today.

### 3. Header comments — document the new shape

Extend the file's header comment block (it is this repo's own documentation of the gate's semantics) with a paragraph recording: the WIP branch is pushed **before** the gate as scratch only — it is never a pull request, never reviewed, and **never merged**; it exists so a failed gate's work survives for a repair dispatch (`start_from`); the sentence "no pull request is created unless that gate passes in full" stands unchanged; stale WIP branches are deleted by a human once their item ships or is abandoned (no automation deletes them).

## Invariants — the gate semantics that must not bend (Quinn checks each)

1. **No PR on red.** The PR step still runs only after the gate step succeeds; no step at or before the gate creates or updates a pull request. The WIP step pushes a branch and nothing else.
2. **The gate step is byte-identical** — `npm run verify` in `v2/`, `set -o pipefail`, output tee'd to `verify-output.txt` exactly as today.
3. **Naming.** WIP branches are exactly `muse/wip-<run_id>`; PR branches stay `muse/<run_id>`. The two namespaces never collide.
4. **No merging anywhere.** Nothing in the workflow merges, auto-merges, or approves anything. `permissions:` and `concurrency:` blocks are unchanged.
5. **Logs never committed.** Neither `muse-run.jsonl` nor `verify-output.txt` can be committed on the WIP branch or the PR branch.
6. **Default behavior unchanged.** With `start_from` empty, the run's observable behavior is today's, plus the one additional WIP push.
7. **The PR step is byte-identical** — the WIP step's soft reset (part 1, step 6) is what makes this possible; do not "simplify" by editing the PR step instead.

## Self-checks before ending your turn

- The edited workflow parses as YAML (`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/muse-code.yml'))"` or an equivalent parser) — quote the result in the PR body.
- The new step's shell is syntactically valid (`bash -n` on the extracted script, or equivalent care) and its step order in the final file is: checkout(s) → setup-node → install Muse → npm ci → run task → fail-if-no-changes → upload log → **WIP push** → gate → PR.
- Trace the green path once by reading: gate passes → PR step finds the full change set staged (thanks to the soft reset), commits it to `muse/<run_id>`, pushes, opens the PR with the build accounting intact. Trace the red path: gate fails → job stops → no PR exists → `muse/wip-<run_id>` on origin holds the work.
- Leave the tree clean apart from the one workflow file; keep the commit to this brief's scope.

## Finish discipline

This is a one-file change; it should not take anywhere near the step budget. Do not run the app's verify suite yourself as a substitute for the checks above (the workflow's gate will run it on the PR; `v2/` is untouched). End your turn with the YAML parse proven and the diff confined to `.github/workflows/muse-code.yml`.

## PR body hygiene

Provenance (this brief + the five-failure record), Build accounting (verify summary + diff census — generated by the workflow as usual), a **Gate semantics** section listing invariants 1–7 above with one line each on how the diff preserves it, and a Gate record section for Quinn's verdict.
