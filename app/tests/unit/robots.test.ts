/**
 * robots.txt byte parity (F4 pin): the renderer must reproduce the live
 * file's bytes exactly, plus precisely Bea's three parameter disallows. The
 * expected fixture is the live file fetched 2026-11-24 with the three lines
 * inserted after the carried set — generated programmatically, never
 * transcribed. The build test proves the same bytes are what gets served.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PARAMETER_DISALLOWS, renderRobotsTxt } from "../../src/data/robots";

const SITE = "https://seeds.hues.flowers";
const EXPECTED = readFileSync(fileURLToPath(new URL("../fixtures/robots-expected.txt", import.meta.url)));

describe("renderRobotsTxt", () => {
  it("byte-equals the live file plus exactly the three parameter disallows", () => {
    expect(Buffer.from(renderRobotsTxt(SITE), "utf8").equals(EXPECTED)).toBe(true);
  });

  it("names the sort/size/session keys specifically (never swallowing ?page=)", () => {
    expect([...PARAMETER_DISALLOWS]).toEqual(["/*?*sort=*", "/*?*limit=*", "/*?*session=*"]);
    for (const pattern of PARAMETER_DISALLOWS) {
      const key = pattern.slice("/*?*".length, -"=*".length);
      expect("page").not.toContain(key);
      expect(key).not.toBe("page");
    }
  });
});
