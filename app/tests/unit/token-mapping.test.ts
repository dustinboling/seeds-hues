/**
 * Token-mapping guard: fails if any live seeds color token is unmapped, if any
 * mapped value differs from the source, if any of the seven ruled sys slots
 * drifts from the adopted @hues package values, or if a `replaced` entry
 * appears outside the ruled six. A silent token miss renders as an unstyled
 * surface; this test is what catches it.
 *
 * Sources of truth: the `@theme` block of v2/app/globals.css, parsed live, so
 * a value change on the live side breaks this test until the mirror follows
 * it — and the brief §3 / @hues package theme.seeds.json resolution below,
 * which fails if any ruled slot is reverted to its old live value.
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
import compJson from "../../src/design-system/tokens/tokens.comp.json";

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

  it("supersedes exactly the six ruled live values with the adopted package values", () => {
    const replaced = entries.filter((entry) => entry.status === "replaced");
    expect(replaced.map((entry) => entry.seeds).sort()).toEqual(
      ["leaf", "leaf-600", "link", "muted", "paper", "warn"].sort(),
    );
    for (const entry of replaced) {
      // A replaced entry renders the package ref value, never the live value.
      expect(entry.huesRefValue).not.toBeNull();
      expect(entry.themeValue).toBe(entry.huesRefValue);
      expect(entry.themeValue).toBe(refValue(entry.huesRef as string));
      expect(entry.themeValue, `live value leaked into "${entry.seeds}"`).not.toBe(entry.sourceValue);
    }
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

  it("resolves the seven ruled sys slots to the briefed package values", () => {
    // Brief §3 / @hues package theme.seeds.json (QUINN-GATE-spa-slice-1 F1
    // cure). Reverting any slot to its old live value must fail this test.
    const ruled: Array<[string, string, string]> = [
      ["sys.color.bg", "design.seeds-ground", "#f8f6ec"],
      ["sys.color.link", "design.seeds-link", "#1B5E37"],
      ["sys.color.accent", "design.fern", "#2D6A4F"],
      ["sys.color.accent-strong", "design.seeds-deep", "#1B4332"],
      ["sys.color.text-muted", "design.seeds-muted", "#595959"],
      ["sys.color.accent-ink", "design.gold-ink", "#86691f"],
      ["sys.color.border-field", "design.ink-soft", "#71806c"],
    ];
    for (const [slot, ref, value] of ruled) {
      expect(refValue(ref), `ref drift for "${ref}"`).toBe(value);
      expect(sysValue(slot), `slot drift for "${slot}"`).toBe(value);
      expect(themeFrom(slot), `broken from-chain for "${slot}"`).toBe(ref);
    }
  });

  it("wires the field border to sys.color.border-field (not held unreferenced)", () => {
    // Resolved value first: the old wiring rendered line-strong (#91825C).
    expect(compValue("comp.field.border")).toBe(sysValue("sys.color.border-field"));
    expect(compValue("comp.field.border")).toBe("#71806c");
    // Then the pointer itself: re-pointing the alias at any other slot must
    // fail even if values ever coincided.
    const table = compJson as unknown as Record<string, { sys?: string }>;
    expect(table["comp.field.border"]?.sys).toBe("sys.color.border-field");
  });
});
