/**
 * The Q3 ground-delta contrast table. Every row is computed live from the
 * token mirror (theme.seeds.json via tokens.ts) — the committed CONTRAST.md is
 * this module's output, and the freshness test fails if they differ.
 *
 * Coverage rule: every text/background pair the ground delta touches, i.e. every
 * pair THEME-REPORT.md or v2/app/globals.css records against the paper ground,
 * plus the two composites laid over the ground (translucent tab-bar wash,
 * paper grain). Untouched pairs (white on leaf, leaf on sage-tint, anything on
 * surface/paper-deep) are out of scope: neither side changed.
 */
import { contrastRatio, mixOver } from "./contrast";
import { refValue, sysValue } from "./tokens";

export interface ContrastRow {
  /** Human-readable pair label, e.g. "ink on ground". */
  pair: string;
  /** Foreground variable or description. */
  fg: string;
  /** Background description (old → new). */
  bg: string;
  /** Ratio on the old ground (live paper #f8f1e1). */
  oldRatio: number;
  /** Ratio on the new ground (warmed seeds-ground #f8f6ec). */
  newRatio: number;
  /** Required floor, or null for decorative pairs with no requirement. */
  floor: number | null;
  /** Why this floor (WCAG criterion or design rule). */
  floorKind: string;
  note?: string;
}

const OLD_GROUND = refValue("seeds.paper");
const NEW_GROUND = sysValue("sys.color.bg");

function textRow(fgName: string, slot: string): ContrastRow {
  const fg = sysValue(slot);
  return {
    pair: `${fgName} on ground`,
    fg: `${slot} ${fg}`,
    bg: `ground ${OLD_GROUND} → ${NEW_GROUND}`,
    oldRatio: contrastRatio(fg, OLD_GROUND),
    newRatio: contrastRatio(fg, NEW_GROUND),
    floor: 4.5,
    floorKind: "WCAG 2.2 AA body text (1.4.3)",
  };
}

export function contrastRows(): ContrastRow[] {
  const rows: ContrastRow[] = [
    textRow("ink", "sys.color.text"),
    textRow("ink-soft", "sys.color.text-soft"),
    textRow("muted", "sys.color.text-muted"),
    textRow("link", "sys.color.link"),
    textRow("leaf", "sys.color.accent-strong"),
    textRow("petal", "sys.color.petal"),
    textRow("warn", "sys.color.accent-ink"),
    textRow("focus", "sys.color.focus"),
  ];

  const lineStrong = sysValue("sys.color.border-strong");
  rows.push({
    pair: "line-strong on ground",
    fg: `sys.color.border-strong ${lineStrong}`,
    bg: `ground ${OLD_GROUND} → ${NEW_GROUND}`,
    oldRatio: contrastRatio(lineStrong, OLD_GROUND),
    newRatio: contrastRatio(lineStrong, NEW_GROUND),
    floor: 3.0,
    floorKind: "WCAG 2.2 AA UI boundary (1.4.11; Ada's floor)",
  });

  const line = sysValue("sys.color.border");
  rows.push({
    pair: "line on ground (decorative)",
    fg: `sys.color.border ${line}`,
    bg: `ground ${OLD_GROUND} → ${NEW_GROUND}`,
    oldRatio: contrastRatio(line, OLD_GROUND),
    newRatio: contrastRatio(line, NEW_GROUND),
    floor: null,
    floorKind: "none — decorative hairline, never carries text",
  });

  // Tab-bar wash: paper-deep at 92% over the ground (THEME-REPORT.md). The tab
  // bar itself is a placeholder in slice 1, but the composite moves with the
  // ground, so the pair is carried for Iris + Ada.
  const washOld = mixOver(sysValue("sys.color.bg-deep"), OLD_GROUND, 0.92);
  const washNew = mixOver(sysValue("sys.color.bg-deep"), NEW_GROUND, 0.92);
  for (const [fgName, slot] of [
    ["ink-soft", "sys.color.text-soft"],
    ["leaf", "sys.color.accent-strong"],
  ] as const) {
    const fg = sysValue(slot);
    rows.push({
      pair: `${fgName} on tab-bar wash`,
      fg: `${slot} ${fg}`,
      bg: `paper-deep 92% over ground (${washOld} → ${washNew})`,
      oldRatio: contrastRatio(fg, washOld),
      newRatio: contrastRatio(fg, washNew),
      floor: 4.5,
      floorKind: "WCAG 2.2 AA body text (1.4.3)",
      note: "tab bar is a slice-1 placeholder; pair carried for the gate",
    });
  }

  // Paper-grain worst case (THEME-REPORT.md method): darkest grain pixel at
  // 6.5% black (13% tile alpha × 0.5 opacity) over the ground, muted text over it.
  const grainOld = mixOver("#000000", OLD_GROUND, 0.065);
  const grainNew = mixOver("#000000", NEW_GROUND, 0.065);
  const muted = sysValue("sys.color.text-muted");
  rows.push({
    pair: "muted on grain-darkened ground (worst case)",
    fg: `sys.color.text-muted ${muted}`,
    bg: `ground + 6.5% black (${grainOld} → ${grainNew})`,
    oldRatio: contrastRatio(muted, grainOld),
    newRatio: contrastRatio(muted, grainNew),
    floor: 4.5,
    floorKind: "WCAG 2.2 AA body text (1.4.3)",
    note: "worst-case grain; flat ground is the row above",
  });

  return rows;
}

function renderRatio(ratio: number): string {
  return ratio.toFixed(2);
}

/** Render the full committed CONTRAST.md. Deterministic: no timestamps. */
export function renderContrastTable(): string {
  const lines: string[] = [
    "# Contrast table — Q3 ground delta (`#f8f1e1` → `#f8f6ec`)",
    "",
    "Generated from the token mirror (`theme.seeds.json` via `tokens.ts` + `contrast.ts`);",
    "do not edit by hand — run `npm run gen:contrast`. The freshness test",
    "(`tests/unit/contrast.test.ts`) fails if this file differs from the generator output,",
    "and the ratio test cross-checks the generator against THEME-REPORT.md's recorded",
    "ratios before trusting any new-ground number below.",
    "",
    "Scope: every text/background pair the ground delta touches (see `contrast-table.ts`",
    "for the coverage rule). WCAG 2.x relative-luminance math.",
    "",
    "| Pair | On old ground `#f8f1e1` | On new ground `#f8f6ec` | Floor | Pass |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of contrastRows()) {
    const pass = row.floor === null ? "n/a (decorative)" : row.newRatio >= row.floor ? "yes" : "NO";
    lines.push(
      `| ${row.pair} | ${renderRatio(row.oldRatio)} | ${renderRatio(row.newRatio)} | ${row.floor === null ? "—" : row.floor.toFixed(1)} (${row.floorKind}) | ${pass} |`,
    );
  }
  lines.push(
    "",
    "Notes:",
    "",
    "- `ink-soft`/`leaf` on tab-bar wash: the tab bar is a named placeholder in slice 1",
    "  (see `TabBarPlaceholder`); the composite is carried so Iris + Ada re-verify the",
    "  exact pair at Quinn's gate.",
    "- Grain worst case follows THEME-REPORT.md's method (darkest grain pixel 6.5% black).",
    "- `line on ground` has no floor: the hairline is decorative and never carries text.",
    "",
  );
  return lines.join("\n");
}
