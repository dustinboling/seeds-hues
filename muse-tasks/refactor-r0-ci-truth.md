# Refactor R0: CI truth-telling — PR titles from the task file, verify gate for human changes

## Why

The Muse pipeline workflow (`.github/workflows/muse-code.yml`) mislabels
every pull request it opens, and human-authored changes get no verification
gate at all:

- The PR step hardcodes `--title "Muse: fix soft-404 on seller and crop pages"`
  and a body claiming "the first Muse Code run for this repository", so every
  pipeline PR since the first has carried the wrong title and a false body.
- The `task_file` input still defaults to `muse-tasks/fix-soft-404.md`, a task
  that shipped long ago — a dispatch that forgets to name its task file would
  silently re-run a stale task.
- The workflow still installs bubblewrap even though the run uses
  `--disable-sandbox` (see the header comment in the workflow for why the
  sandbox is deliberately disabled on GitHub-hosted runners). The install step
  is vestigial.
- No workflow runs on `push` or `pull_request`, so a human-authored change
  pushed straight to the repo gets no `npm run verify` gate — only Muse
  runs are gated today.

This is slice R0 of the Seed Directory refactoring plan
(`refactor-2026-11-21/PLAN.md` §3). It is a behavior-preserving tooling slice:
no website code changes.

## Scope — exact changes

### 1. `.github/workflows/muse-code.yml`

- Remove the "Install bubblewrap" step entirely. Keep the header comment block
  that explains why the sandbox is disabled — it is still accurate and still
  the reason no bubblewrap is needed.
- `task_file` input: remove the `default:` value. Keep `required: true`, the
  description, and `type: string`, so every dispatch names its task file
  explicitly — no stale default.
- In the "Open a pull request with the changes" step, derive the PR title from
  the task file: the first line matching `^# ` in `${{ inputs.task_file }}`,
  stripped of the `# ` prefix; if the task file has no such line, fall back to
  the file's basename. Pass that derived title to `gh pr create --title`.
- Rewrite the `gh pr create --body` so it describes THIS run accurately:
  the task file used, the workflow run id, the statement that
  `npm run verify` passed in `v2/` before the PR was created, and that the PR
  is not auto-merged (Hue verifies before merge). No "first run" language
  anywhere.

### 2. New `.github/workflows/verify.yml`

- Name: `Verify`.
- Triggers: `push` to `main`, and `pull_request` (all).
- One job on `ubuntu-latest`, `timeout-minutes: 30`:
  `actions/checkout@v4`; `actions/setup-node@v4` with node-version 22,
  `cache: npm`, `cache-dependency-path: v2/package-lock.json`; `npm ci` in
  `v2/`; `npm run verify` in `v2/`.
- Brief header comment in the same style as `muse-code.yml`, explaining the
  gate exists so human-authored changes get the same verification Muse
  runs get.

## What must NOT change

- Nothing under `v2/` or anywhere else in the repo — only
  `.github/workflows/muse-code.yml`, the new `.github/workflows/verify.yml`,
  and this task file.
- In `muse-code.yml`, everything outside the three edits above stays
  byte-identical: the concurrency group, permissions, the `muse exec`
  invocation (`--disable-sandbox`, `--approval-mode never`), the verify gate
  step, timeouts, and the artifact upload.
- The pipeline's gate itself is unchanged: `npm run verify` in `v2/` still
  runs after the Muse run, and no PR is created unless it passes in full.
- No website behavior, visuals, copy, or schema changes of any kind.

## Test plan

- Both workflow YAML files parse cleanly (e.g. `yaml.safe_load` on each).
- In the worktree, `cd v2 && npm ci && npm run verify` is fully green.
- The new verify workflow proves itself on its own PR: it runs on the
  `pull_request` that carries it.
- The next Muse run after the title fix must open a correctly titled PR —
  its title is the H1 of the task file it ran (this file's H1 is the first
  proof).

## Verify before you finish

You can run commands. In `v2/`, run `npm run verify` yourself; if anything
fails, fix it and re-run until the full gate is green. Do not finish with a
failing or unrun gate.

Note on landing: pushes that create or update workflow files need a credential
with the `workflow` scope. If the standard Muse PR path refuses the
workflow-file change, this slice lands by a direct push with a workflow-scoped
credential instead — same content, same verify, noted in the ship record.
