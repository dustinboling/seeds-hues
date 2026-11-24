/**
 * tokens.css is generated from the token mirror — this test fails on any drift
 * between the stylesheet the shell loads and the mapping the tests guard.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderTokensCss } from "../../src/design-system/tokens-css.js";
import { compAliases, sysSlots } from "../../src/design-system/tokens.js";

const CSS_PATH = fileURLToPath(new URL("../../src/design-system/tokens.css", import.meta.url));

describe("tokens.css", () => {
  it("is exactly the generator output", () => {
    expect(readFileSync(CSS_PATH, "utf8")).toBe(renderTokensCss());
  });

  it("declares every sys slot and comp alias", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    for (const slot of sysSlots()) {
      expect(css.includes(`--${slot.replace(/\./g, "-")}:`), `missing ${slot}`).toBe(true);
    }
    for (const alias of compAliases()) {
      expect(css.includes(`--${alias.replace(/\./g, "-")}:`), `missing ${alias}`).toBe(true);
    }
  });

  it("carries the warmed ground and keeps comp symbolic over sys", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toContain("--sys-color-bg: #f8f6ec;");
    expect(css).toContain("--comp-card-background: var(--sys-color-surface)");
  });
});
