# Environment Standard — seeds-hues muse-code workflow vs the program standard

**Date:** 2026-11-23 · **Status: PREP ONLY.** No workflow file is changed by this package. The seeds pipeline is frozen mid-CSN-build under Dustin's stop order (WIP branch preserved); the workflow change is itself a build slice (Slice 0 in BUILD-SEQUENCE.md) that dispatches only when the conversion starts and Quinn gates it like any other change.

## Where seeds-hues already leads (verified from origin/main `.github/workflows/muse-code.yml`)

- **Executable environment**: dependencies installed (`npm ci` in `v2/`) before the run and `--disable-sandbox` on `muse exec`, so the builder runs the repo's own tests itself — the pattern the wwwhues foundation run lacked and is now adopting.
- **CI repair loop (shipped 2026-11-23)**: the workflow pushes `muse/wip-<run_id>` BEFORE its verify gate; a red gate leaves the branch standing; repair dispatches continue it via the `start_from` input instead of rebuilding from scratch. PR bodies carry provenance + build accounting + a pre-templated gate record.
- npm caching on (`actions/setup-node` cache with `cache-dependency-path: v2/package-lock.json`); explicit 60-minute job timeout; `verify` = lint + typecheck + vitest as the gate floor.

## What wwwhues is proving now (verified from wwwhues `.github/workflows/muse-code.yml`)

- **In-job verify→repair loop**: when the gate is red, the job itself runs up to **three further `muse exec` repair turns with the gate output as the prompt**, inside the same run — no human re-dispatch per round.
- **120-minute job timeout** (vs seeds' 60) to give the repair loop room.
- Same npm caching and single `muse-code` concurrency group.

## The gap list for seeds-hues (what "same standard" takes)

| # | Upgrade | Why | Cost/risk |
| --- | --- | --- | --- |
| E1 | **In-job verify→repair loop (≥3 turns)** ported from wwwhues | Seeds' repair path works but costs a human-supervised re-dispatch per round (the 3.1b five-failure arc is the record of that cost); the in-job loop keeps the WIP/`start_from` path as the fallback for runs that exhaust their turns | One workflow PR; behavior proven in wwwhues first |
| E2 | **Per-task concurrency**: group `muse-code-${{ inputs.task_file }}` (or per-slice group) instead of one global `muse-code` group | Today the single group holds only ONE pending run — a newer dispatch silently cancels a queued one (confirmed live repeatedly). Per-task groups let independent slices queue without eating each other, which the conversion's slice sequence depends on | One-line class of change; must keep `cancel-in-progress: false` |
| E3 | **Timeout 60 → 120 min** | A conversion slice + 3 repair turns cannot fit in 60; the CSN/3.4 runs already pressed the 60-minute bound | Trivial; longer runs cost more when they hang — bounded by max_model_steps |
| E4 | **Known-defect fixes ride along (CI-fix-2)**: F1 — a builder that commits all its own work dies at the no-changes step before the WIP push (fails visibly, work recoverable, but wastes the run; proven live twice); F3 — verify-output ordering protection; brief-materialization — a `start_from` run reads its brief from the checked-out tree, so repair briefs must be committed onto the start branch before dispatch (workaround in force; fix = read the brief from an explicit ref) | Each has bitten real builds; the conversion multiplies dispatch volume, so the tax multiplies too | Small, well-specified; Quinn's F1/F3 findings are the spec |
| E5 | npm cache: already on — **no change**; record as verified-equal | — | — |

## Application order

E1–E4 land as **one workflow slice (Slice 0)**, gated by Quinn (her CI-fix-2 findings + a live red-gate drill: dispatch a deliberately failing task, watch the WIP push + in-job repair + `start_from` continuation all fire), merged before Slice 1 dispatches. The wwwhues proof results (its workflow fix currently in verification there) are inputs to the slice brief, so seeds adopts the *proven* form, not the draft.
