/**
 * Slice 8 budget suite (unit): the adopted thresholds
 * (app/performance-budget.json) — values from the architecture plan
 * (ARCHITECTURE-BRIEF.md §6: the variety page's 150 KB JS budget, LCP ≤
 * 2.5 s / INP ≤ 200 ms / CLS ≤ 0.1 field goals) as calibrated for the lab
 * (LHCI thresholds in app/.lighthouserc.json must match these figures),
 * plus the slice-adopted HTML ceiling the plan leaves unnamed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import budget from "../../performance-budget.json";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

interface LhciRc {
  ci: {
    assert: { assertions: Record<string, [string, { maxNumericValue: number }]> };
  };
}

describe("performance-budget.json", () => {
  it("adopts the plan's 150 KB uniform JS budget per route (ARCHITECTURE-BRIEF §6)", () => {
    expect(budget.jsGzipBytesPerRoute.threshold).toBe(153600);
    expect(budget.jsGzipBytesPerRoute.source).toContain("ARCHITECTURE-BRIEF.md §6");
  });

  it("adopts the plan's field goals, lab-calibrated (LCP ≤ 6 s guard, CLS ≤ 0.1, TBT ≤ 200 ms)", () => {
    expect(budget.lighthouse.lcpMs).toBe(6000);
    expect(budget.lighthouse.cls).toBe(0.1);
    expect(budget.lighthouse.tbtMs).toBe(200);
    expect(budget.lighthouse.consoleErrors).toBe(0);
    expect(budget.lighthouse.source).toContain("ARCHITECTURE-BRIEF.md §6");
  });

  it("states the slice-adopted 200 KB HTML ceiling and names it as slice-adopted (no plan figure exists)", () => {
    expect(budget.htmlBytesPerTemplate.threshold).toBe(204800);
    expect(budget.htmlBytesPerTemplate.source).toContain("slice-adopted");
  });

  it("pins the image discipline to Bea §1.3 (alt, dimensions, eager hero, self-hosted)", () => {
    expect(budget.images.requireAlt).toBe(true);
    expect(budget.images.requireDimensions).toBe(true);
    expect(budget.images.heroEager).toBe(true);
    expect(budget.images.selfHosted).toBe(true);
    expect(budget.images.source).toContain("§1.3");
  });

  it("matches the committed LHCI config assertion-for-assertion (one threshold set, two enforcers)", () => {
    const rc = JSON.parse(readFileSync(`${APP_ROOT}/.lighthouserc.json`, "utf8")) as LhciRc;
    const assertions = rc.ci.assert.assertions;
    expect(assertions["resource-summary:script:size"]![1].maxNumericValue).toBe(budget.jsGzipBytesPerRoute.threshold);
    expect(assertions["largest-contentful-paint"]![1].maxNumericValue).toBe(budget.lighthouse.lcpMs);
    expect(assertions["cumulative-layout-shift"]![1].maxNumericValue).toBe(budget.lighthouse.cls);
    expect(assertions["total-blocking-time"]![1].maxNumericValue).toBe(budget.lighthouse.tbtMs);
    expect(assertions["errors-in-console"]![1].maxNumericValue).toBe(budget.lighthouse.consoleErrors);
  });

  it("carries no price-shaped string anywhere in the budget file", () => {
    const blob = JSON.stringify(budget);
    expect(blob).not.toMatch(/\$\d/);
    expect(blob.toLowerCase()).not.toContain("price");
  });
});
