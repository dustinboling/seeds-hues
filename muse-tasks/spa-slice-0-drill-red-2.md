# Slice 0 DRILL 2 — deliberately red gate (tests the in-job verify→repair loop)

**This is a drill, not product work.** Drill 1's test sat in `v2/lib/`, outside vitest's include set (`tests/unit/**`, `tests/integration/**`, `tests/contract/**`, `tests/dom/**`), so the gate never collected it and no repair fired. This drill places the test where the suite actually runs. It proves, on a live run of the new workflow: a red gate fires the in-job repair loop, the repair turn fixes only what verify reported, a checkpoint pushes after the repair turn, the final gate re-run certifies the shipped tree, and a PR opens. The drill files are deleted after the drill; the PR is closed unmerged.

## The spec (ground truth for any repair turn reading this file)

- `drillAnswer()` returns **42**. That is the requirement; it does not change.
- Create `v2/lib/drill-answer.ts` containing exactly:
  ```ts
  export function drillAnswer(): number {
    return 42;
  }
  ```
- Create `v2/tests/unit/drill-answer.test.ts` containing exactly:
  ```ts
  import { describe, expect, it } from "vitest";
  import { drillAnswer } from "@/lib/drill-answer";

  describe("drillAnswer", () => {
    it("returns the drill answer", () => {
      expect(drillAnswer()).toBe(43);
    });
  });
  ```
  Yes — the test asserts 43 while the spec says 42. **The mismatch is the drill.** The test as written is the broken artifact; the function is correct.

## Working rules for the main turn

- Create the two files exactly as above. Change nothing else in the tree.
- Do NOT run `npm run verify`, vitest, or any test yourself in this run — the workflow's gate step is the drill's subject, and it must see the red state first.
- Do NOT reconcile the mismatch, and do not commit or push anything yourself; leave both files uncommitted in the working tree.

## Expected shape (for the gate record, not an instruction to you)

Gate verify #1 goes red on the drill test → repair turn 1 fixes the test's expectation to the spec value (42) → checkpoint → verify green → final gate re-run green → PR opens. A repair that instead changes the function to return 43 is a drill FAILURE (it would mean the repair turn overrode the task file's spec).
