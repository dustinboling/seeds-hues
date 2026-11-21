# Probe: can the builder execute shell commands? (pipeline-fix verification, 2026-11-20)

This is a diagnostic task, not a feature. Its only purpose is to prove
whether the Muse builder in this workflow can execute shell commands
end to end after the sandbox fix (`--disable-sandbox` on the `muse exec`
invocation in `.github/workflows/muse-code.yml`).

Do exactly this, and nothing else:

1. Run this shell command from the repository root:

   ```
   cd v2 && npm run verify
   ```

   (Dependencies are already installed by the workflow before this run
   starts.)

2. Create a NEW file named `probe-result.md` at the repository root
   containing:
   - the exact command you ran,
   - its exit code,
   - the LAST 25 lines of its combined output, quoted verbatim inside a
     fenced code block.

3. If the shell command cannot start at all (for example a `bwrap` or
   other environment error before execution), do NOT invent output.
   Instead, create `probe-result.md` containing that error text verbatim
   and a one-line note that the command never executed.

Do not change any other file. Do not refactor, fix, or improve anything
the verify output reports — quote it exactly as produced, pass or fail.
