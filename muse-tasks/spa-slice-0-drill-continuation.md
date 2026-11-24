# Slice 0 DRILL — continuation (tests start_from + task_ref brief materialization)

**This is a drill, not product work.** This brief was committed to `main` AFTER the drill WIP branch (`muse/wip-45342257212`) forked, so it does not exist in that branch's tree. If you are reading this prompt, the workflow's `task_ref` materialization worked: the brief was read from `main`, not from the checked-out start tree. That is the behaviour being proven (invariant I6, live).

## The change

In `v2/lib/drill-answer.test.ts` (created by the drill you are continuing), change exactly one string: the test name `"returns the drill answer"` becomes `"returns the drill answer (continuation-proven)"`. Nothing else changes — not the expectation, not the function, not any other file.

## Working rules

- Make only that one-string edit. Do not commit or push anything yourself; leave the change uncommitted in the working tree.
- You may run the single drill test file yourself to confirm it passes (`npx vitest run lib/drill-answer.test.ts` in `v2/`); do not run the full verify suite — the workflow's gate does that.
