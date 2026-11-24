/**
 * Token-mapping guard: fails if any live seeds color token is unmapped, if any
 * mapped value differs from the source, or if the conversion grows a second
 * color delta. A silent token miss renders as an unstyled surface; this test
 * is what catches it.
 *
 * Source of truth: the `@theme` block of v2/app/globals.css, parsed live, so a
 * value change on the live side breaks this test until the mirror follows it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compAliases,
  compValue,
  mappingEntries,
  refValue,
  sysDefaultRef,
  sysSlots,
  sysValue,
  themeFrom,
} from "../../src/design-system/tokens.js";

const GLOBALS_CSS = fileURLToPath(new URL("../../../v2/app/globals.css", import.meta.url));

/** Parse `--color-<name>: <value>;` from the first `@theme` block (the palette). */
function parseLiveColors(): Map<string, string> {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const block = /@theme\s*{([\s\S]*?)}/.exec(css);
  if (!block?.[1]) throw new Error(`No @theme block found in ${GLOBALS_CSS}`);
  const colors = new Map<string, string>();
  for (const match of block[1].matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name === undefined || value === undefined) throw new Error("Unreachable: regex groups");
    if (colors.has(name)) throw new Error(`Duplicate --color-${name} in @theme block`);
    colors.set(name, value);
  }
  if (colors.size === 0) throw new Error(`No --color-* tokens parsed from ${GLOBALS_CSS}`);
  return colors;
}

const live = parseLiveColors();
const entries = mappingEntries();

describe("token mapping", () => {
  it("covers every live seeds color token (22 names)", () => {
    expect(live.size).toBe(22);
    expect(entries).toHaveLength(22);
    const mapped = new Set(entries.map((entry) => entry.seeds));
    for (const name of live.keys()) {
      expect(mapped.has(name), `seeds token "${name}" has no mapping entry`).toBe(true);
    }
  });

  it("has no stale entries for tokens the live theme dropped", () => {
    for (const entry of entries) {
      expect(live.has(entry.seeds), `mapping entry "${entry.seeds}" is not a live token`).toBe(true);
    }
  });

  it("records each live value exactly", () => {
    for (const entry of entries) {
      expect(entry.sourceValue, `sourceValue drift for "${entry.seeds}"`).toBe(live.get(entry.seeds));
    }
  });

  it("ports every value as-is except the single ruled Q3 delta", () => {
    const replaced = entries.filter((entry) => entry.status === "replaced");
    expect(replaced.map((entry) => entry.seeds)).toEqual(["paper"]);
    expect(replaced[0]?.themeValue).toBe(refValue("design.seeds-ground"));
    expect(replaced[0]?.themeValue).toBe("#f8f6ec");
    for (const entry of entries.filter((entry) => entry.status === "mapped")) {
      expect(entry.themeValue, `as-is violation for "${entry.seeds}"`).toBe(entry.sourceValue);
    }
  });

  it("resolves every entry's hues slot to the theme value", () => {
    for (const entry of entries) {
      expect(sysValue(entry.hues), `slot drift for "${entry.seeds}"`).toBe(entry.themeValue);
    }
  });

  it("keeps the theme from-chain sound (from-ref value === slot value)", () => {
    for (const slot of sysSlots()) {
      expect(refValue(themeFrom(slot)), `broken from-chain for "${slot}"`).toBe(sysValue(slot));
    }
  });

  it("keeps the sys layer's default refs resolvable", () => {
    for (const slot of sysSlots()) {
      expect(() => refValue(sysDefaultRef(slot))).not.toThrow();
    }
  });

  it("resolves every comp alias to a concrete value", () => {
    expect(compAliases().length).toBeGreaterThan(0);
    for (const alias of compAliases()) {
      const value = compValue(alias);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("records the hues ref endpoints the brief quotes (design defaults, not taken)", () => {
    const bySeeds = new Map(entries.map((entry) => [entry.seeds, entry]));
    const quoted: Array<[string, string, string]> = [
      ["paper", "design.seeds-ground", "#f8f6ec"],
      ["muted", "design.seeds-muted", "#595959"],
      ["leaf", "design.seeds-deep", "#1B4332"],
      ["leaf-600", "design.fern", "#2D6A4F"],
      ["link", "design.seeds-link", "#1B5E37"],
      ["warn", "design.gold-ink", "#86691f"],
    ];
    for (const [seeds, ref, value] of quoted) {
      const entry = bySeeds.get(seeds);
      expect(entry?.huesRef).toBe(ref);
      expect(entry?.huesRefValue).toBe(value);
      expect(refValue(ref)).toBe(value);
    }
    // The border-field ref exists in the mirror even though no seeds token feeds it.
    expect(refValue("design.ink-soft")).toBe("#71806c");
    expect(sysValue("sys.color.border-field")).toBe("#71806c");
  });
});
