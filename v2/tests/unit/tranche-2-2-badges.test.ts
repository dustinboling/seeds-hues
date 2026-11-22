/**
 * Tranche 2.2 — Badge family unification (SPEC tranche-2 §3).
 *
 * Contract coverage, per the §3.2 variant table:
 *
 * - Tones: the five availability tones, the Small Farm tone, the Protection
 *   dress and the role tones are recorded in tokens.json (component.badge.*),
 *   and the globals.css rules carry exactly those token values — grounds, text
 *   and borders, with the border alphas pinned at Tranche 1.3's shipped values
 *   (60/65/70/70/75), never re-derived blends.
 * - Consumers: Availability, the AccountPanel waitlist pills and SmallFarmBadge
 *   render the family base plus their tone class; the Small Farm sizes consume
 *   the §3.3 component variables; no hand-built pill construction remains.
 * - R-1: Protection's re-dress (paper-deep ground, full-strength ink-soft
 *   border, ink label, ink-soft note, control radius, 16px seal icon) with zero
 *   petal left in the component, and the render gate unchanged (2.2-E).
 * - R-2: the listing In stock dot and word darken leaf-600 to leaf; every other
 *   listing state is unchanged.
 * - Scope guards: RoleChip and AdminShell are untouched (their migration is
 *   item 2.3), and no chip split exists yet.
 *
 * Every set asserted about a source file is derived from that file at test
 * time: tone values from tokens.json, the Availability TONE map and the
 * ListingRow STATUS_TONE map from their component sources, the state universe
 * from the AVAILABILITY and PROTECTION enums. Specified values (alphas, token
 * colors, gate states) are pinned as the contract.
 *
 * Non-vacuity: this file fails on pre-build code — component.badge is absent
 * from tokens.json, the .badge rules are absent from globals.css, Protection
 * renders petal with no icon, and STATUS_TONE maps In stock to leaf-600 —
 * except the gate-logic pins, which pass before and after by design (the gate
 * must not move) and are required holdings, not change proofs.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProtectionIcon } from "@/components/layout/icons";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { AVAILABILITY_LABEL, AvailabilityBadge } from "@/components/variety/Availability";
import { ProtectionBadge, showsProtection } from "@/components/variety/ProtectionBadge";
import { AVAILABILITY, PROTECTION } from "@/lib/db/schema";
import type { Availability } from "@/lib/validators";

const ROOT = process.cwd();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const tokensJson: unknown = JSON.parse(readSource("design-tokens/tokens.json"));
const css = readSource("app/globals.css");

function badgeRecord(): Record<string, unknown> {
  if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
  const component = tokensJson["component"];
  if (!isRecord(component)) throw new Error("tokens.json has no component group");
  const badge = component["badge"];
  if (!isRecord(badge)) throw new Error("tokens.json has no component.badge group (item 2.2 tokens missing)");
  return badge;
}

function badgeGroup(key: string): Record<string, unknown> {
  const group = badgeRecord()[key];
  if (!isRecord(group)) throw new Error(`tokens.json has no component.badge.${key} group`);
  return group;
}

function tokenValue(groupKey: string, leaf: string): unknown {
  const token = badgeGroup(groupKey)[leaf];
  if (!isRecord(token)) throw new Error(`component.badge.${groupKey}.${leaf} is missing`);
  if (!("$value" in token)) throw new Error(`component.badge.${groupKey}.${leaf} has no $value`);
  return token["$value"];
}

/** A {color.X} alias resolves to its color token name (X). */
function colorName(alias: unknown, where: string): string {
  if (typeof alias !== "string") throw new Error(`${where} is not a color alias`);
  const name = /^\{color\.([a-z0-9-]+)\}$/.exec(alias)?.[1];
  if (name === undefined) throw new Error(`${where} is not a {color.*} alias: ${alias}`);
  return name;
}

function borderParts(value: unknown, where: string): { color: string; alpha: string } {
  if (!isRecord(value)) throw new Error(`${where} border is not a {color, alpha} token`);
  const color = colorName(value["color"], `${where} border color`);
  const alpha = value["alpha"];
  if (typeof alpha !== "string" || !/^\d+%$/.test(alpha)) {
    throw new Error(`${where} border alpha is not a percent string`);
  }
  return { color, alpha };
}

/** The CSS border-color declaration a border token requires in its tone rule. */
function expectedBorderDeclaration(parts: { color: string; alpha: string }): string {
  return parts.alpha === "100%"
    ? `border-color: var(--color-${parts.color});`
    : `border-color: color-mix(in oklab, var(--color-${parts.color}) ${parts.alpha}, transparent);`;
}

function cssRule(selector: string): string {
  return css.match(new RegExp(`\\.${selector} \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? "";
}

/** Tone groups whose values live in a globals.css rule: token group, selector, leaf names. */
const RULED_TONES = [
  { group: "in-stock", selector: "badge-in-stock", background: "background", text: "text", border: "border" },
  { group: "sold-out", selector: "badge-sold-out", background: "background", text: "text", border: "border" },
  { group: "preorder", selector: "badge-preorder", background: "background", text: "text", border: "border" },
  { group: "shop-closed", selector: "badge-shop-closed", background: "background", text: "text", border: "border" },
  { group: "unknown", selector: "badge-unknown", background: "background", text: "text", border: "border" },
  {
    group: "small-farm",
    selector: "badge-small-farm",
    background: "tone-background",
    text: "tone-text",
    border: "tone-border",
  },
] as const;

describe("2.2 — tone tokens (SPEC §3.2 values, pinned, alphas never moved)", () => {
  it("records every family group the section specifies (the contract is not vacuous)", () => {
    const keys = Object.keys(badgeRecord());
    for (const group of ["in-stock", "sold-out", "preorder", "shop-closed", "unknown", "small-farm", "protection", "role", "listing"]) {
      expect(keys, `component.badge.${group} is missing`).toContain(group);
    }
  });

  it("pins the availability border alphas at Tranche 1.3's shipped values", () => {
    const alphas: Record<string, string> = {
      "in-stock": "60%",
      "sold-out": "65%",
      preorder: "70%",
      "shop-closed": "70%",
      unknown: "75%",
    };
    for (const group of Object.keys(alphas)) {
      const expected = alphas[group];
      if (expected === undefined) continue;
      expect(borderParts(tokenValue(group, "border"), group).alpha, `${group} border alpha moved`).toBe(expected);
    }
  });

  it("pins the availability grounds and texts (§3.2 rows 1a-1e)", () => {
    const pairs: Record<string, [string, string]> = {
      "in-stock": ["leaf-50", "leaf"],
      "sold-out": ["petal-50", "petal"],
      preorder: ["surface", "leaf-600"],
      "shop-closed": ["surface", "muted"],
      unknown: ["warn-50", "warn"],
    };
    for (const group of Object.keys(pairs)) {
      const [ground, text] = pairs[group] ?? [];
      if (ground === undefined || text === undefined) continue;
      expect(colorName(tokenValue(group, "background"), `${group} ground`)).toBe(ground);
      expect(colorName(tokenValue(group, "text"), `${group} text`)).toBe(text);
    }
  });

  it("pins the Small Farm tone at the In stock values (IRIS-C-06, kept deliberately)", () => {
    expect(colorName(tokenValue("small-farm", "tone-background"), "small-farm ground")).toBe("leaf-50");
    expect(colorName(tokenValue("small-farm", "tone-text"), "small-farm text")).toBe("leaf");
    expect(borderParts(tokenValue("small-farm", "tone-border"), "small-farm").alpha).toBe("60%");
  });

  it("pins the Protection dress tokens (§3.5: paper-deep, ink-soft border, ink label)", () => {
    expect(colorName(tokenValue("protection", "background"), "protection ground")).toBe("paper-deep");
    const border = borderParts(tokenValue("protection", "border"), "protection");
    expect(border.color).toBe("ink-soft");
    expect(border.alpha).toBe("100%");
    expect(colorName(tokenValue("protection", "label"), "protection label")).toBe("ink");
    expect(colorName(tokenValue("protection", "note"), "protection note")).toBe("ink-soft");
  });

  it("pins the role tones (§3.2 rows 5/5b, specified here, consumed in 2.3)", () => {
    expect(colorName(tokenValue("role", "admin-background"), "admin ground")).toBe("leaf-50");
    expect(colorName(tokenValue("role", "admin-text"), "admin text")).toBe("leaf");
    const adminBorder = borderParts(tokenValue("role", "admin-border"), "admin");
    expect(adminBorder.color).toBe("line-strong");
    expect(adminBorder.alpha).toBe("100%");
    expect(colorName(tokenValue("role", "reviewer-background"), "reviewer ground")).toBe("surface");
    expect(colorName(tokenValue("role", "reviewer-text"), "reviewer text")).toBe("ink");
    const reviewerBorder = borderParts(tokenValue("role", "reviewer-border"), "reviewer");
    expect(reviewerBorder.color).toBe("line-strong");
    expect(reviewerBorder.alpha).toBe("100%");
  });

  it("pins the listing line tones (§3.4: In stock is leaf, the rest unchanged)", () => {
    const dots: Record<string, string> = {
      "in-stock-dot": "leaf",
      "preorder-dot": "leaf-600",
      "sold-out-dot": "petal",
      "shop-closed-dot": "muted",
      "unknown-dot": "warn",
    };
    for (const leaf of Object.keys(dots)) {
      const expected = dots[leaf];
      if (expected === undefined) continue;
      expect(colorName(tokenValue("listing", leaf), `listing ${leaf}`)).toBe(expected);
    }
  });
});

describe("2.2 — tone rules in globals.css carry the token values", () => {
  it("defines the .badge base with the shared construction", () => {
    const base = cssRule("badge");
    expect(base, ".badge rule is missing").not.toBe("");
    for (const decl of [
      "display: inline-flex;",
      "align-items: center;",
      "border: 1px solid;",
      "border-radius: 999px;",
      "font-family: var(--font-sans);",
    ]) {
      expect(base, decl).toContain(decl);
    }
  });

  for (const tone of RULED_TONES) {
    it(`.${tone.selector} carries the ${tone.group} token values`, () => {
      const rule = cssRule(tone.selector);
      expect(rule, `.${tone.selector} rule is missing`).not.toBe("");
      const ground = colorName(tokenValue(tone.group, tone.background), `${tone.group} ground`);
      const text = colorName(tokenValue(tone.group, tone.text), `${tone.group} text`);
      expect(rule).toContain(`background-color: var(--color-${ground});`);
      expect(rule).toContain(`color: var(--color-${text});`);
      expect(rule).toContain(expectedBorderDeclaration(borderParts(tokenValue(tone.group, tone.border), tone.group)));
    });
  }

  it(".badge-notice carries the Protection dress (R-1)", () => {
    const rule = cssRule("badge-notice");
    expect(rule, ".badge-notice rule is missing").not.toBe("");
    const ground = colorName(tokenValue("protection", "background"), "protection ground");
    const border = borderParts(tokenValue("protection", "border"), "protection");
    expect(border.alpha, "the notice border is full strength").toBe("100%");
    expect(rule).toContain("display: inline-flex;");
    expect(rule).toContain("flex-direction: column;");
    expect(rule).toContain(`background-color: var(--color-${ground});`);
    expect(rule).toContain(`border: 1px solid var(--color-${border.color});`);
    expect(rule).toContain("border-radius: var(--radius-control);");
    expect(rule, "the notice must never take petal").not.toContain("petal");
  });
});

describe("2.2 — Availability consumes the family (TONE map derived from source)", () => {
  const src = readSource("components/variety/Availability.tsx");
  const toneOf = new Map<string, string>();
  for (const match of src.matchAll(/(\w+): "(badge-[a-z-]+)"/g)) {
    const state = match[1];
    const tone = match[2];
    if (state === undefined || tone === undefined) continue;
    toneOf.set(state, tone);
  }

  it("maps exactly the availability states to tone classes (no state left on utilities)", () => {
    expect([...toneOf.keys()].sort()).toEqual([...AVAILABILITY].sort());
    for (const state of AVAILABILITY) {
      const tone = toneOf.get(state);
      expect(tone, `${state} has no tone class`).toBeDefined();
      if (tone === undefined) continue;
      expect(tone, `${state} tone class`).toMatch(/^badge-/);
    }
  });

  it("renders the base plus tone class with the state label for every state", () => {
    expect(toneOf.size, "the derived TONE map is empty").toBe(AVAILABILITY.length);
    for (const state of AVAILABILITY) {
      const tone = toneOf.get(state);
      if (tone === undefined) continue;
      const h = renderToStaticMarkup(createElement(AvailabilityBadge, { value: state as Availability }));
      expect(h, state).toContain(`badge ${tone}`);
      expect(h, state).toContain("px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]");
      const label = AVAILABILITY_LABEL[state as Availability];
      if (label !== undefined) expect(h, state).toContain(label);
    }
  });

  it("keeps no hand-built pill construction in the component", () => {
    for (const old of ["rounded-full", "inline-flex", "border-leaf/", "border-petal/", "border-muted/", "border-warn/", "bg-leaf-50", "bg-petal-50", "bg-warn-50"]) {
      expect(src, old).not.toContain(old);
    }
  });
});

describe("2.2 — AccountPanel waitlist pills consume the family", () => {
  const panel = readSource("components/account/AccountPanel.tsx");

  it("Found, Waiting and Held render badge tones (rows 2a-2c)", () => {
    expect(panel).toContain("badge badge-in-stock");
    expect(panel).toContain("badge badge-preorder");
    expect(panel).toContain("badge badge-unknown");
    expect(panel).toContain(">Found<");
    expect(panel).toContain(">Waiting · active<");
    expect(panel).toContain(">Held<");
  });

  it("keeps no hand-built pill construction in the component", () => {
    expect(panel).not.toContain("rounded-full border");
  });
});

describe("2.2 — Small Farm consumes its tone and component tokens (§3.3)", () => {
  const src = readSource("components/seller/SmallFarmBadge.tsx");

  /** Every small-farm token that maps to a @theme variable must be consumed by the component. */
  function mappedVariables(): string[] {
    const group = badgeGroup("small-farm");
    const vars: string[] = [];
    for (const leaf of Object.keys(group)) {
      const token = group[leaf];
      if (!isRecord(token) || !("$value" in token)) continue;
      const ext = token["$extensions"];
      const seeds = isRecord(ext) && isRecord(ext["seeds-hues"]) ? ext["seeds-hues"] : null;
      const cssVariable = seeds?.["cssVariable"];
      if (typeof cssVariable === "string") vars.push(cssVariable);
    }
    return vars;
  }

  it("holds mapped component variables (the consumption check is not vacuous)", () => {
    expect(mappedVariables().length).toBeGreaterThan(0);
  });

  it("consumes every mapped variable in its size table", () => {
    for (const variable of mappedVariables()) {
      expect(src, `${variable} is unconsumed`).toContain(variable);
    }
  });

  it("keeps no arbitrary badge-internal literal in the component", () => {
    for (const old of ["gap-[5px]", "py-[2px]", "pl-[7px]", "size-[13px]", "text-[13px]", "leading-[18px]"]) {
      expect(src, old).not.toContain(old);
    }
  });

  it("renders both sizes on the family base with mark, label and behavior intact", () => {
    for (const size of ["standard", "large"] as const) {
      const h = renderToStaticMarkup(createElement(SmallFarmBadge, { size }));
      expect(h, size).toContain("badge badge-small-farm");
      expect(h, size).toContain(`data-small-farm-badge="${size}"`);
      expect(h, size).toContain("Small farm");
      expect(h, size).toContain("shrink-0");
      expect(h, size).toContain("whitespace-nowrap");
      expect(h, size).toContain("<svg");
      expect(h, size).toContain('aria-hidden="true"');
    }
    const standard = renderToStaticMarkup(createElement(SmallFarmBadge, { size: "standard" }));
    for (const variable of mappedVariables().filter((v) => v.includes("-standard-"))) {
      expect(standard, variable).toContain(variable);
    }
    const large = renderToStaticMarkup(createElement(SmallFarmBadge, { size: "large" }));
    for (const variable of mappedVariables().filter((v) => v.includes("-large-"))) {
      expect(large, variable).toContain(variable);
    }
  });
});

describe("2.2 — Protection dress (R-1) and gate logic (2.2-E)", () => {
  const src = readSource("components/variety/ProtectionBadge.tsx");
  const POSITIVE = ["pvp_us", "utility_patent_us", "pbr"] as const;
  const SILENT = ["none_stated", "unknown"] as const;

  it("holds zero petal anywhere in the component", () => {
    expect(src).not.toContain("petal");
  });

  it("builds the notice from the new dress, with the old classes gone", () => {
    for (const part of ["badge-notice", "ProtectionIcon", "size-4", "gap-1.5", 'font-semibold text-ink"', 'text-ink-soft"']) {
      expect(src, part).toContain(part);
    }
    for (const old of ["rounded-inner", "border-petal", "bg-petal-50", "text-petal", "text-muted"]) {
      expect(src, old).not.toContain(old);
    }
  });

  it("renders the claim with label, note, seal icon and notice construction", () => {
    const h = renderToStaticMarkup(
      createElement(ProtectionBadge, { protection: "pvp_us", note: "USPV 12345, expires 2040." }),
    );
    expect(h).toContain("US Plant Variety Protection");
    expect(h).toContain("USPV 12345, expires 2040.");
    expect(h).toContain("badge-notice px-3 py-2 text-sm");
    expect(h).toContain("size-4");
    expect(h).toContain("<svg");
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('stroke-width="1.8"');
    expect(h).not.toContain("petal");
  });

  it("renders no component when protection is unset or unknown (gate holds)", () => {
    for (const state of PROTECTION) {
      const h = renderToStaticMarkup(createElement(ProtectionBadge, { protection: state, note: "Sourced note." }));
      if ((SILENT as readonly string[]).includes(state)) {
        expect(h, state).toBe("");
      } else {
        expect(h, state).not.toBe("");
      }
    }
  });

  it("renders no component when a claim has no note (gate holds)", () => {
    for (const state of POSITIVE) {
      expect(renderToStaticMarkup(createElement(ProtectionBadge, { protection: state, note: null })), state).toBe("");
    }
  });

  it("showsProtection mirrors the render gate over the whole enum", () => {
    for (const state of PROTECTION) {
      const positive = (POSITIVE as readonly string[]).includes(state);
      expect(showsProtection(state, "Sourced note."), `${state} with note`).toBe(positive);
      expect(showsProtection(state, null), `${state} without note`).toBe(false);
    }
  });
});

describe("2.2 — ProtectionIcon (SPEC §3.5 family rules)", () => {
  it("draws a shield holding a check: 24px grid, stroke 1.8, currentColor, no fill, hidden", () => {
    const h = renderToStaticMarkup(createElement(ProtectionIcon, { className: "size-4" }));
    expect(h).toContain("<svg");
    expect(h).toContain('viewBox="0 0 24 24"');
    expect(h).toContain('stroke="currentColor"');
    expect(h).toContain('stroke-width="1.8"');
    expect(h).toContain('fill="none"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('class="size-4"');
    expect(h.match(/<path/g) ?? []).toHaveLength(2);
  });
});

describe("2.2 — Listing status line (R-2; STATUS_TONE derived from source)", () => {
  const src = readSource("components/variety/ListingRow.tsx");
  const toneOf = new Map<string, { dot: string; word: string }>();
  for (const match of src.matchAll(/(\w+): \{ dot: "([^"]+)", word: "([^"]+)" \}/g)) {
    const state = match[1];
    const dot = match[2];
    const word = match[3];
    if (state === undefined || dot === undefined || word === undefined) continue;
    toneOf.set(state, { dot, word });
  }

  it("covers exactly the availability states", () => {
    expect([...toneOf.keys()].sort()).toEqual([...AVAILABILITY].sort());
  });

  it("matches the listing tokens: In stock is leaf, every other state holds", () => {
    const group = badgeGroup("listing");
    const leaves = Object.keys(group).filter((leaf) => !leaf.startsWith("$"));
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      const state = leaf.replace(/-dot$/, "").replace(/-/g, "_");
      const color = colorName(tokenValue("listing", leaf), `listing ${leaf}`);
      const tone = toneOf.get(state);
      expect(tone, `${state} is missing from STATUS_TONE`).toBeDefined();
      if (tone === undefined) continue;
      expect(tone.dot, `${state} dot`).toBe(`bg-${color}`);
      expect(tone.word, `${state} word`).toBe(`text-${color}`);
    }
  });
});

describe("2.2 — scope guards (item 2.2 surfaces only)", () => {
  it("RoleChip migrated in 2.3: chip-tag with its tone, still no badge class", () => {
    const role = readSource("components/admin/RoleChip.tsx");
    expect(role).toContain("chip-tag");
    expect(role).not.toContain("badge-");
  });

  it("AdminShell is untouched: the review-count pill keeps its dress", () => {
    expect(readSource("components/admin/AdminShell.tsx")).not.toContain("badge-");
  });

  it("the 2.3 chip split stands: bare .chip retired, filter/tag classes present", () => {
    expect(css).not.toContain(".chip {");
    for (const present of ["chip-filter", "chip-tag", "chip-removable"]) {
      expect(css, present).toContain(present);
    }
  });
});
