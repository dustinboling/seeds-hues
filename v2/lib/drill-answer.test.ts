import { describe, expect, it } from "vitest";
import { drillAnswer } from "./drill-answer";

describe("drillAnswer", () => {
  it("returns the drill answer", () => {
    expect(drillAnswer()).toBe(43);
  });
});
