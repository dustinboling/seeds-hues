/**
 * Contrast verification for the Q3 ground delta.
 *
 * 1. Oracle check: the generator must reproduce the ratios THEME-REPORT.md and
 *    v2/app/globals.css record for the OLD ground before any new-ground number
 *    is trusted. Tolerance ±0.06 covers the sources' 1–2 decimal rounding.
 * 2. Floor check: every pair the delta touches still clears its WCAG 2.2 AA
 *    floor on the NEW ground.
 * 3. Freshness: the committed CONTRAST.md is exactly the generator output.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixOver } from "../../src/design-system/contrast.js";
import { contrastRows, renderContrastTable } from "../../src/design-system/contrast-table.js";
import { refValue, sysValue } from "../../src/design-system/tokens.js";

const TOLERANCE = 0.06;

const paper = refValue("seeds.paper");
const paperDeep = sysValue("sys.color.bg-deep");
const surface = sysValue("sys.color.surface");
// The recorded ratios below were measured against the LIVE seeds values, so
// the oracle pins the live refs for the five slots the adopted package theme
// supersedes (brief §3; QUINN-GATE-spa-slice-1 F1 cure) — the oracle validates
// the contrast math, not the landed theme. Unchanged slots resolve via sys.
const liveMuted = refValue("seeds.muted");
const liveLink = refValue("seeds.link");
const liveLeaf = refValue("seeds.leaf");
const liveWarn = refValue("seeds.warn");

describe("contrast math (oracle: recorded ratios on the old ground)", () => {
  // [label, fg, bg, recorded ratio, recorded in]
  const recorded: Array<[string, string, string, number, string]> = [
    ["ink on paper", sysValue("sys.color.text"), paper, 12.68, "THEME-REPORT"],
    ["ink-soft on paper", sysValue("sys.color.text-soft"), paper, 8.6, "globals.css"],
    ["muted on paper", liveMuted, paper, 5.56, "THEME-REPORT"],
    ["muted on surface", liveMuted, surface, 6.15, "THEME-REPORT"],
    ["muted on paper-deep", liveMuted, paperDeep, 5.0, "THEME-REPORT"],
    ["ink-soft on paper-deep", sysValue("sys.color.text-soft"), paperDeep, 7.71, "THEME-REPORT"],
    ["link on paper", liveLink, paper, 7.02, "THEME-REPORT"],
    ["link on paper-deep", liveLink, paperDeep, 6.31, "THEME-REPORT"],
    ["leaf on paper", liveLeaf, paper, 9.4, "globals.css"],
    ["white on leaf", "#ffffff", liveLeaf, 10.6, "THEME-REPORT"],
    ["leaf on leaf-50", liveLeaf, sysValue("sys.color.accent-tint"), 8.6, "THEME-REPORT"],
    ["petal on paper", sysValue("sys.color.petal"), paper, 7.2, "globals.css"],
    ["petal on petal-50", sysValue("sys.color.petal"), sysValue("sys.color.petal-tint"), 6.8, "THEME-REPORT"],
    ["warn on paper", liveWarn, paper, 5.1, "globals.css"],
    ["warn on warn-50", liveWarn, sysValue("sys.color.accent-ink-tint"), 4.89, "THEME-REPORT"],
    ["focus on paper", sysValue("sys.color.focus"), paper, 7.39, "THEME-REPORT"],
    ["white on danger", "#ffffff", sysValue("sys.color.danger"), 8.93, "globals.css"],
    // NOTE: THEME-REPORT.md records line-strong on paper as 3.17 / on surface as
    // 3.50, but globals.css (current, post-Ada 2026-11-19) records 3.4 / 3.7 for
    // the current #91825C — the report's pair predates the value. The oracle for
    // line-strong is therefore globals.css, not the report.
    ["line-strong on paper", sysValue("sys.color.border-strong"), paper, 3.4, "globals.css"],
    ["line-strong on surface", sysValue("sys.color.border-strong"), surface, 3.7, "globals.css"],
    ["line-strong on paper-deep", sysValue("sys.color.border-strong"), paperDeep, 3.0, "globals.css"],
  ];
  it.each(recorded)("%s reproduces the recorded ratio", (_label, fg, bg, expected, _source) => {
    expect(Math.abs(contrastRatio(fg, bg) - expected)).toBeLessThanOrEqual(TOLERANCE);
  });

  it("reproduces the tab-bar wash composites (7.79 / 8.55)", () => {
    const wash = mixOver(paperDeep, paper, 0.92);
    expect(Math.abs(contrastRatio(sysValue("sys.color.text-soft"), wash) - 7.79)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(contrastRatio(liveLeaf, wash) - 8.55)).toBeLessThanOrEqual(TOLERANCE);
  });

  it("reproduces the grain worst case (muted 4.81)", () => {
    const grain = mixOver("#000000", paper, 0.065);
    expect(Math.abs(contrastRatio(liveMuted, grain) - 4.81)).toBeLessThanOrEqual(TOLERANCE);
  });
});

describe("Q3 ground delta (new ground #f8f6ec)", () => {
  it("keeps every touched pair at or above its floor", () => {
    const rows = contrastRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      if (row.floor === null) continue;
      expect(row.newRatio, `${row.pair}: ${row.newRatio.toFixed(2)} < ${row.floor}`).toBeGreaterThanOrEqual(row.floor);
    }
  });

  it("warms the ground without lowering any touched ratio", () => {
    // The warmed ground is lighter than paper, so dark-on-ground ratios rise.
    // If a future value change ever lowers one, this names it.
    for (const row of contrastRows()) {
      expect(row.newRatio, row.pair).toBeGreaterThanOrEqual(row.oldRatio - TOLERANCE);
    }
  });
});

describe("CONTRAST.md", () => {
  it("is exactly the generator output (computed from the actual values)", () => {
    const committed = readFileSync(
      fileURLToPath(new URL("../../src/design-system/CONTRAST.md", import.meta.url)),
      "utf8",
    );
    expect(committed).toBe(renderContrastTable());
  });
});
