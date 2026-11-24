# Slice 0 — Workflow standard RECOVERY run (E1–E4, delivery via run log)

**Why this run exists.** The first Slice 0 run (45338811866) implemented the change, but its WIP-branch push was rejected by GitHub — `refusing to allow a GitHub App to create or update workflow .github/workflows/muse-code.yml without workflows permission` — and the run died before its gate step. That rejection is structural: the GitHub App token can NEVER push any branch whose diff touches a workflow file, so no bench run of this task can deliver through a branch or PR. The deliverable of THIS run is therefore the run-log artifact: you emit the finished file into the log (protocol below), the coordinator reconstructs it byte-exactly (verified against your SHA-256), Quinn gates the exact bytes, and the coordinator direct-pushes the single workflow file to `main` under the workflow-scoped credential (the R0 / CI-repair precedent: commits `f08044b`, `f8fee49`).

**The task itself is unchanged.** Read `muse-tasks/spa-slice-0-workflow-standard.md` in full and implement it exactly — one file changes (`.github/workflows/muse-code.yml`), invariants I1–I10, all working rules (edit only that file; leave changes uncommitted; self-validate with a YAML parse + `bash -n` over every `run:` block; do not run the v2/ suite yourself). This brief adds ONLY the delivery protocol below; where the two briefs conflict on delivery mechanics, this one wins.

## Delivery protocol (do these LAST, in this order, after your self-validation passes)

1. Print the file's fingerprint:
   `wc -lc .github/workflows/muse-code.yml && sha256sum .github/workflows/muse-code.yml`
2. Emit the ENTIRE final file as four separate exec calls, in order, using exactly these commands (line ranges assume ~390 lines; if the file is longer, keep going with further 100-line ranges until the last line is emitted — completeness is proven by the SHA-256 in step 1, and a missing tail fails the delivery):
   - `echo '===SLICE0-FILE 1/4 lines 1-100==='; sed -n '1,100p' .github/workflows/muse-code.yml`
   - `echo '===SLICE0-FILE 2/4 lines 101-200==='; sed -n '101,200p' .github/workflows/muse-code.yml`
   - `echo '===SLICE0-FILE 3/4 lines 201-300==='; sed -n '201,300p' .github/workflows/muse-code.yml`
   - `echo '===SLICE0-FILE 4/4 lines 301-end==='; sed -n '301,1000p' .github/workflows/muse-code.yml`
3. In your final summary, state: the byte count and SHA-256 from step 1, your YAML-parse result, your `bash -n` result, and the step-name diff vs the old file (which steps are unchanged, renamed, added, removed).

## What happens after your turn (expected — not a failure of your work)

The workflow's own WIP-push step will be rejected by GitHub for the reason above and the run will conclude as failed at that step. Do not attempt to work around it, do not commit or push anything yourself, and do not put the file's content anywhere else in the tree. The uploaded run log is the delivery vehicle; the protocol above is the whole delivery.
