/**
 * Tranche 2.3 — Chip split: filter chips vs tag chips (SPEC tranche-2 §4).
 *
 * Contract coverage, per the §4.2 table and the §4.5 census:
 *
 * - Census (2.3-A): no bare `chip` class token in any className, no `tap`
 *   paired with one, no `chipClass` builder declaration, and no string-builder
 *   body returning a bare chip class (the census's fifth helper and the two
 *   segment helpers are caught by content, not by name); `chip-tag` only on
 *   `<span>`, `chip-filter` only on `<a>` / `<button>` (Next `Link` is the
 *   `<a>` spelling); every `chip-removable` rides with `chip-filter`.
 * - Geometry (2.3-B): `.chip-filter` carries the house target in BOTH
 *   dimensions — min-height and min-width — so filter chips render at minimum
 *   44px wide as they did before the split (F-1 cure); `.chip-tag` carries the
 *   retired 32px height with no min-width, as the bare chip did.
 * - Selected dress folded into CSS (§4.2): the selected rule carries
 *   font-weight 600, and no chip className outside RoleChip's tone still adds
 *   ad hoc font-semibold.
 * - R-3 (2.3-D): the two admin remover chips render the drawn 14px × glyph
 *   with their Remove names intact; no group chip renders the glyph.
 * - R-4: listing-detail status span and account-list role labels are plain
 *   `chip-tag` with their overrides gone (44px → 32px; 13px → 14px).
 * - R-5 (2.3-E): crop rows carry `chip-filter` with `aria-current="true"`,
 *   never `"page"`, and their selected dress is the shared rule.
 * - Scope (2.3-F): FilterStrip keeps only its §2.1 shadow touch and no chip
 *   class; BrowseFilters' group model is unchanged.
 *
 * Every set asserted about a source file is derived from that file at test
 * time: className literals and builder bodies from the walked sources, token
 * values from tokens.json, tone utilities from the component.badge.role
 * tokens. Specified values (geometry, colors, glyph size, copy holdings) are
 * pinned as the contract.
 *
 * Non-vacuity: this file fails on pre-build code — component.chip is absent
 * from tokens.json, the split rules are absent from globals.css, bare `chip`
 * classes and `chipClass` builders are present in the sources, crop rows use
 * `"page"`, and the account-list overrides are present — except the holding
 * pins (group model, tap, gate-adjacent copy), which pass before and after by
 * design and are required holdings, not change proofs.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingList } from "@/app/admin/(protected)/listings/_components/listing-list";
import { RoleChip } from "@/components/admin/RoleChip";
import { ChipRemoveIcon } from "@/components/layout/icons";

const ROOT = process.cwd();
const WALK_ROOTS = ["app", "components", "lib"] as const;
const SOURCE_EXT = /\.(ts|tsx|css)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...walk(p));
    else if (SOURCE_EXT.test(name)) out.push(p);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSource(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const tokensJson: unknown = JSON.parse(readSource("design-tokens/tokens.json"));
const css = readSource("app/globals.css");

function chipGroup(name: string): Record<string, unknown> {
  if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
  const component = tokensJson["component"];
  if (!isRecord(component)) throw new Error("tokens.json has no component group");
  const chip = component["chip"];
  if (!isRecord(chip)) throw new Error("tokens.json has no component.chip group (item 2.3 tokens missing)");
  const group = chip[name];
  if (!isRecord(group)) throw new Error(`tokens.json has no component.chip.${name} group`);
  return group;
}

function chipToken(group: string, leaf: string): unknown {
  const token = chipGroup(group)[leaf];
  if (!isRecord(token)) throw new Error(`component.chip.${group}.${leaf} is missing`);
  if (!("$value" in token)) throw new Error(`component.chip.${group}.${leaf} has no $value`);
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

function tokenEntry(path: string): { value: unknown; cssVariable: string | null } {
  if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
  let node: unknown = tokensJson;
  for (const part of path.split(".")) {
    if (!isRecord(node)) throw new Error(`token ${path} is missing`);
    node = node[part];
  }
  if (!isRecord(node) || !("$value" in node)) throw new Error(`token ${path} has no $value`);
  const ext = node["$extensions"];
  const seeds = isRecord(ext) && isRecord(ext["seeds-hues"]) ? ext["seeds-hues"] : null;
  const cssVariable = seeds?.["cssVariable"] ?? null;
  if (typeof cssVariable !== "string" && cssVariable !== null) {
    throw new Error(`token ${path} has no usable cssVariable mapping`);
  }
  return { value: node["$value"], cssVariable };
}

/**
 * A dimension token value resolves to the CSS fragment its rule must carry: a
 * mapped alias becomes its variable reference, a documentation-only alias
 * becomes the resolved literal (the radius.full case: no --radius-full
 * variable exists by design), and a literal stays itself.
 */
function dimensionCss(value: unknown, where: string): string {
  if (typeof value !== "string") throw new Error(`${where} is not a dimension string`);
  const target = /^\{(.+)\}$/.exec(value.trim())?.[1];
  if (target === undefined) return value;
  const entry = tokenEntry(target);
  if (entry.cssVariable !== null) return `var(${entry.cssVariable})`;
  if (typeof entry.value !== "string") throw new Error(`token ${target} resolves to a non-string`);
  return entry.value;
}

/** The CSS border declaration a rest-border token requires in its rule. */
function expectedBorderDeclaration(parts: { color: string; alpha: string }): string {
  if (parts.alpha !== "100%") throw new Error(`chip rest border alpha is not full strength: ${parts.alpha}`);
  return `border: 1px solid var(--color-${parts.color});`;
}

/** A rule block starting at its selector, through its closing brace. */
function cssBlock(start: string): string {
  const at = css.indexOf(start);
  if (at < 0) return "";
  const end = css.indexOf("\n  }", at);
  if (end < 0) return "";
  return css.slice(at, end);
}

interface ClassUse {
  file: string;
  /** Static class text with ${...} interpolations blanked (pre-build helpers interpolate). */
  value: string;
  raw: string;
  index: number;
}

/** Every className literal in a source file (double, single, or template quoted). */
function classUses(file: string, content: string): ClassUse[] {
  const out: ClassUse[] = [];
  for (const match of content.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    out.push({ file, value: raw.replace(/\$\{[^}]*\}/g, " "), raw, index: match.index ?? 0 });
  }
  return out;
}

function tokensOf(value: string): string[] {
  return value.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * The JSX element whose opener holds the className at index (null when none
 * does). A ">" only closes the opener outside braces and strings, so arrow
 * bodies (onClick={() => ...}) and string props cannot fake a close.
 */
function enclosingTag(content: string, index: number): string | null {
  const open = content.lastIndexOf("<", index);
  if (open < 0) return null;
  const between = content.slice(open, index);
  let depth = 0;
  let quote: string | null = null;
  for (const ch of between) {
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === ">" && depth === 0) return null;
  }
  return /^<([A-Za-z][A-Za-z0-9]*)/.exec(between)?.[1] ?? null;
}

const FILES = WALK_ROOTS.flatMap((root) => walk(root));
const CONTENTS = new Map<string, string>(FILES.map((f): [string, string] => [f, readSource(f)]));
const USES = [...CONTENTS].flatMap(([file, content]) => classUses(file, content));

describe("2.3 — chip tokens (SPEC §4.2 values, F-1 min-width recorded)", () => {
  it("records the filter, tag, and removable groups (the contract is not vacuous)", () => {
    if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
    const component = tokensJson["component"];
    if (!isRecord(component) || !isRecord(component["chip"])) {
      throw new Error("tokens.json has no component.chip group (item 2.3 tokens missing)");
    }
    const keys = Object.keys(component["chip"]);
    for (const group of ["filter", "tag", "removable"]) {
      expect(keys, `component.chip.${group} is missing`).toContain(group);
    }
  });

  it("pins the filter minimums at the house target in both dimensions (F-1 cure)", () => {
    expect(chipToken("filter", "min-height")).toBe("{size.target}");
    expect(chipToken("filter", "min-width")).toBe("{size.target}");
  });

  it("pins the shared geometry: padding, pill radius, and the tag height", () => {
    for (const group of ["filter", "tag"]) {
      expect(chipToken(group, "padding-block"), `${group} block padding`).toBe("2px");
      expect(chipToken(group, "padding-inline"), `${group} inline padding`).toBe("12px");
      expect(chipToken(group, "radius"), `${group} radius`).toBe("{radius.full}");
    }
    expect(chipToken("tag", "min-height")).toBe("2rem");
  });

  it("pins the resting dress twins: surface, ink, full-strength line-strong", () => {
    for (const group of ["filter", "tag"]) {
      expect(colorName(chipToken(group, "rest-background"), `${group} ground`)).toBe("surface");
      expect(colorName(chipToken(group, "rest-text"), `${group} text`)).toBe("ink");
      const border = borderParts(chipToken(group, "rest-border"), group);
      expect(border.color).toBe("line-strong");
      expect(border.alpha).toBe("100%");
    }
  });

  it("pins the filter hover and selected tones (§4.2 interactive column)", () => {
    expect(colorName(chipToken("filter", "hover-border"), "hover border")).toBe("leaf-600");
    expect(colorName(chipToken("filter", "hover-background"), "hover ground")).toBe("leaf-50");
    expect(colorName(chipToken("filter", "selected-border"), "selected border")).toBe("leaf");
    expect(colorName(chipToken("filter", "selected-background"), "selected ground")).toBe("leaf-50");
    expect(colorName(chipToken("filter", "selected-text"), "selected text")).toBe("leaf");
    expect(chipToken("filter", "selected-weight")).toBe("600");
  });

  it("pins the chip type both components share (14px / 1.5)", () => {
    for (const group of ["filter", "tag"]) {
      expect(chipToken(group, "font-size"), `${group} font size`).toBe("14px");
      expect(chipToken(group, "line-height"), `${group} line height`).toBe("1.5");
    }
  });

  it("pins the removable glyph: 14px drawn mark, 6px gap, family stroke (§4.4)", () => {
    expect(chipToken("removable", "glyph-size")).toBe("14px");
    expect(chipToken("removable", "glyph-gap")).toBe("6px");
    expect(chipToken("removable", "glyph-stroke")).toBe("1.8");
  });

  it("keeps the token file's bookkeeping standard on every chip token", () => {
    const leaves: string[] = [];
    const collect = (node: unknown, path: string): void => {
      if (!isRecord(node)) return;
      if ("$value" in node) {
        leaves.push(path);
        if (typeof node["$type"] !== "string") throw new Error(`token ${path} has no $type`);
        if (typeof node["$description"] !== "string") throw new Error(`token ${path} has no $description`);
        const ext = node["$extensions"];
        const seeds = isRecord(ext) && isRecord(ext["seeds-hues"]) ? ext["seeds-hues"] : null;
        if (seeds === null || (typeof seeds["cssVariable"] !== "string" && seeds["cssVariable"] !== null)) {
          throw new Error(`token ${path} has no usable cssVariable mapping`);
        }
        if (seeds["cssVariable"] === null && typeof seeds["reason"] !== "string") {
          throw new Error(`token ${path} is documentation-only but states no reason`);
        }
        return;
      }
      for (const key of Object.keys(node)) {
        if (key.startsWith("$")) continue;
        collect(node[key], path === "" ? key : `${path}.${key}`);
      }
    };
    if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
    const component = tokensJson["component"];
    if (!isRecord(component) || !isRecord(component["chip"])) {
      throw new Error("tokens.json has no component.chip group (item 2.3 tokens missing)");
    }
    collect(component["chip"], "chip");
    expect(leaves.length, "no chip tokens found").toBeGreaterThan(0);
  });
});

describe("2.3 — rules in globals.css carry the token values", () => {
  it(".chip-filter carries the resting dress with the 44px minimum in both dimensions", () => {
    const rule = cssBlock(".chip-filter {");
    expect(rule, ".chip-filter rule is missing").not.toBe("");
    const minHeight = dimensionCss(chipToken("filter", "min-height"), "filter min-height");
    const minWidth = dimensionCss(chipToken("filter", "min-width"), "filter min-width");
    expect(minHeight, "the height minimum is the house target").toBe("var(--size-target)");
    expect(minWidth, "the width minimum is the house target (F-1)").toBe("var(--size-target)");
    expect(rule).toContain(`min-height: ${minHeight};`);
    expect(rule).toContain(`min-width: ${minWidth};`);
    const ground = colorName(chipToken("filter", "rest-background"), "filter ground");
    const text = colorName(chipToken("filter", "rest-text"), "filter text");
    const radius = dimensionCss(chipToken("filter", "radius"), "filter radius");
    expect(rule).toContain(`background: var(--color-${ground});`);
    expect(rule).toContain(`color: var(--color-${text});`);
    expect(rule).toContain(expectedBorderDeclaration(borderParts(chipToken("filter", "rest-border"), "filter")));
    expect(rule).toContain(`border-radius: ${radius};`);
    for (const decl of [
      "display: inline-flex;",
      "align-items: center;",
      "padding: 0.125rem 0.75rem;",
      "font-family: var(--font-sans);",
      "font-size: 0.875rem;",
      "line-height: 1.5;",
      "text-decoration: none;",
      "background-color 160ms ease-out,",
      "border-color 160ms ease-out;",
    ]) {
      expect(rule, decl).toContain(decl);
    }
  });

  it("the filter hover rule carries today's hover values onto the class", () => {
    const rule = cssBlock("a.chip-filter:hover");
    expect(rule, "filter hover rule is missing").not.toBe("");
    expect(rule).toContain("button.chip-filter:hover");
    const border = colorName(chipToken("filter", "hover-border"), "hover border");
    const ground = colorName(chipToken("filter", "hover-background"), "hover ground");
    expect(rule).toContain(`border-color: var(--color-${border});`);
    expect(rule).toContain(`background: var(--color-${ground});`);
    expect(rule).toContain("color: var(--color-ink);");
  });

  it("the filter selected rule carries the selected dress with weight 600, never page", () => {
    const rule = cssBlock('.chip-filter[aria-current="true"]');
    expect(rule, "filter selected rule is missing").not.toBe("");
    expect(rule).toContain('.chip-filter[aria-pressed="true"]');
    const border = colorName(chipToken("filter", "selected-border"), "selected border");
    const ground = colorName(chipToken("filter", "selected-background"), "selected ground");
    const text = colorName(chipToken("filter", "selected-text"), "selected text");
    const weight = chipToken("filter", "selected-weight");
    if (typeof weight !== "string") throw new Error("selected weight is not a string");
    expect(rule).toContain(`border-color: var(--color-${border});`);
    expect(rule).toContain(`background: var(--color-${ground});`);
    expect(rule).toContain(`color: var(--color-${text});`);
    expect(rule).toContain(`font-weight: ${weight};`);
    expect(css, "no page selector on filter chips").not.toContain('.chip-filter[aria-current="page"]');
  });

  it("button filter chips keep the pointer cursor of the link form", () => {
    const rule = cssBlock("button.chip-filter {");
    expect(rule, "button.chip-filter rule is missing").not.toBe("");
    expect(rule).toContain("cursor: pointer;");
  });

  it(".chip-tag carries the resting dress at the retired 32px height, with no states", () => {
    const rule = cssBlock(".chip-tag {");
    expect(rule, ".chip-tag rule is missing").not.toBe("");
    const minHeight = dimensionCss(chipToken("tag", "min-height"), "tag min-height");
    expect(rule).toContain(`min-height: ${minHeight};`);
    expect(rule, "tags take no min-width").not.toContain("min-width");
    const ground = colorName(chipToken("tag", "rest-background"), "tag ground");
    const text = colorName(chipToken("tag", "rest-text"), "tag text");
    const radius = dimensionCss(chipToken("tag", "radius"), "tag radius");
    expect(rule).toContain(`background: var(--color-${ground});`);
    expect(rule).toContain(`color: var(--color-${text});`);
    expect(rule).toContain(expectedBorderDeclaration(borderParts(chipToken("tag", "rest-border"), "tag")));
    expect(rule).toContain(`border-radius: ${radius};`);
    for (const decl of ["display: inline-flex;", "padding: 0.125rem 0.75rem;", "cursor: default;"]) {
      expect(rule, decl).toContain(decl);
    }
    expect(rule, "tags take no transition").not.toContain("transition");
    expect(css, "tags take no hover rule").not.toContain(".chip-tag:hover");
    expect(css, "tags take no selected rule").not.toMatch(/\.chip-tag\[aria-(current|pressed)/);
  });

  it(".chip-removable spaces the drawn glyph 6px after the label", () => {
    const rule = cssBlock(".chip-removable svg {");
    expect(rule, ".chip-removable rule is missing").not.toBe("");
    const gap = dimensionCss(chipToken("removable", "glyph-gap"), "glyph gap");
    expect(rule).toContain(`margin-left: ${gap};`);
  });

  it("retires every bare .chip selector while .tap stays for its other controls", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(code, "a bare .chip selector remains").not.toMatch(/\.chip(?![-\w])/);
    const tap = cssBlock(".tap {");
    expect(tap, ".tap rule is missing").not.toBe("");
    expect(tap).toContain("min-height: 44px;");
    expect(tap).toContain("min-width: 44px;");
  });
});

describe("2.3-A — census: no bare chip, no builders, elements honest", () => {
  it("migrates chips across the tree (the census is not vacuous)", () => {
    const files = new Set(USES.filter((u) => tokensOf(u.value).some((t) => t.startsWith("chip-"))).map((u) => u.file));
    expect(files.size, "no chip-filter/chip-tag class found anywhere").toBeGreaterThan(0);
  });

  it("leaves no bare chip class token in any className", () => {
    for (const use of USES) {
      expect(tokensOf(use.value), `${use.file}: bare chip class`).not.toContain("chip");
    }
  });

  it("leaves no chip tap pair in any className", () => {
    for (const use of USES) {
      const tokens = tokensOf(use.value);
      expect(tokens.includes("chip") && tokens.includes("tap"), `${use.file}: chip tap pair`).toBe(false);
    }
  });

  it("leaves no chipClass builder declaration in any source file", () => {
    for (const [file, content] of CONTENTS) {
      const code = content.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\r\n]*/g, "$1 ");
      expect(code, `${file}: chipClass declaration remains`).not.toMatch(/(?:function\s+chipClass\b|(?:const|let|var)\s+chipClass\s*=)/);
    }
  });

  it("leaves no string-builder body returning a bare chip class", () => {
    for (const [file, content] of CONTENTS) {
      for (const match of content.matchAll(/(?:return|=>)\s*`([^`]*)`/g)) {
        const body = match[1] ?? "";
        const tokens = tokensOf(body.replace(/\$\{[^}]*\}/g, " "));
        expect(tokens, `${file}: a builder still returns a bare chip class`).not.toContain("chip");
      }
    }
  });

  it("puts chip-tag only on span elements", () => {
    for (const use of USES) {
      if (!tokensOf(use.value).includes("chip-tag")) continue;
      const content = CONTENTS.get(use.file);
      if (content === undefined) continue;
      expect(enclosingTag(content, use.index), `${use.file}: chip-tag off a span`).toBe("span");
    }
  });

  it("puts chip-filter only on links and buttons", () => {
    for (const use of USES) {
      if (!tokensOf(use.value).includes("chip-filter")) continue;
      const content = CONTENTS.get(use.file);
      if (content === undefined) continue;
      // Next Link is the <a> spelling for navigation filters.
      expect(["a", "button", "Link"], `${use.file}: chip-filter off a link or button`).toContain(enclosingTag(content, use.index));
    }
  });

  it("rides every chip-removable with chip-filter", () => {
    for (const use of USES) {
      const tokens = tokensOf(use.value);
      if (!tokens.includes("chip-removable")) continue;
      expect(tokens, `${use.file}: removable without the filter class`).toContain("chip-filter");
    }
  });
});

describe("2.3 — selected dress folded into CSS (no ad hoc font-semibold)", () => {
  it("keeps font-semibold out of chip classNames except RoleChip's tone", () => {
    for (const use of USES) {
      if (use.file.endsWith(join("components", "admin", "RoleChip.tsx"))) continue;
      const tokens = tokensOf(use.value);
      if (!tokens.some((t) => t === "chip" || t.startsWith("chip-"))) continue;
      expect(use.raw, `${use.file}: ad hoc selected weight`).not.toContain("font-semibold");
    }
  });
});

describe("2.3-D — removers (R-3): drawn glyph, Remove names intact", () => {
  const list = readSource(join("app", "admin", "(protected)", "listings", "_components", "listing-list.tsx"));

  it("builds both removers from chip-filter chip-removable with the drawn glyph", () => {
    expect(list).toContain("ChipRemoveIcon");
    expect(list).toContain('className="size-3.5"');
    expect(list).toContain("chip-filter chip-removable");
    expect(list, "typographic remover × remains").not.toContain(">×<");
  });

  it("keeps the remover accessible names starting with Remove", () => {
    expect(list).toContain("Remove the seller filter, Seller:");
    expect(list).toContain("Remove the variety filter, Variety:");
  });

  it("renders one drawn glyph per deep link with the names intact", () => {
    const cases = [
      { seller: { slug: "songbird", name: "Songbird Seed Co." }, variety: null },
      { seller: null, variety: { slug: "chantilly-purple", name: "Chantilly Purple" } },
      { seller: { slug: "songbird", name: "Songbird Seed Co." }, variety: { slug: "chantilly-purple", name: "Chantilly Purple" } },
    ];
    for (const deepLinks of cases) {
      const expected = [deepLinks.seller, deepLinks.variety].filter((d) => d !== null).length;
      const h = renderToStaticMarkup(
        createElement(ListingList, {
          rows: [],
          total: 0,
          params: { q: null, chip: "all", seller: deepLinks.seller?.slug ?? null, variety: deepLinks.variety?.slug ?? null, show: 50 },
          selected: null,
          deepLinks,
        }),
      );
      expect(h.match(/chip-filter chip-removable/g) ?? [], "remover chips").toHaveLength(expected);
      expect(h.match(/<svg/g) ?? [], "drawn glyphs").toHaveLength(expected);
      if (deepLinks.seller) expect(h).toContain('aria-label="Remove the seller filter, Seller: Songbird Seed Co."');
      if (deepLinks.variety) expect(h).toContain('aria-label="Remove the variety filter, Variety: Chantilly Purple"');
    }
  });

  it("renders no glyph on group chips (the state strip)", () => {
    const h = renderToStaticMarkup(
      createElement(ListingList, {
        rows: [],
        total: 0,
        params: { q: null, chip: "all", seller: null, variety: null, show: 50 },
        selected: null,
        deepLinks: { seller: null, variety: null },
      }),
    );
    expect(h).toContain("chip-filter");
    expect(h, "group chips render no glyph").not.toContain("<svg");
  });
});

describe("2.3-E — crop rows (R-5): chip-filter with aria-current true", () => {
  const crop = readSource(join("app", "crop", "[slug]", "page.tsx"));

  it("migrates the rows class-only, with true instead of page", () => {
    expect(crop).toContain('className="chip-filter"');
    expect(crop).toContain('aria-current={active ? "true" : undefined}');
    expect(crop, "crop rows still use page").not.toContain('aria-current={active ? "page" : undefined}');
  });

  it("deletes the rows' re-implemented selected utilities (the class carries them)", () => {
    expect(crop, "crop rows still re-implement the selected border").not.toContain("border-leaf");
  });
});

describe("2.3 — R-4: inert admin chips take true tag geometry", () => {
  it("reduces the listing-detail status span to a plain tag", () => {
    const detail = readSource(join("app", "admin", "(protected)", "listings", "_components", "listing-detail.tsx"));
    expect(detail).toContain('<span className="chip-tag">');
    for (const use of classUses("listing-detail", detail)) {
      if (!tokensOf(use.value).some((t) => t === "chip" || t.startsWith("chip-"))) continue;
      expect(tokensOf(use.value), "status span keeps overrides").toEqual(["chip-tag"]);
    }
  });

  it("reduces the account-list role labels to plain tags with their overrides gone", () => {
    const accounts = readSource(join("app", "admin", "(protected)", "accounts", "_components", "account-list.tsx"));
    for (const use of classUses("account-list", accounts)) {
      if (!tokensOf(use.value).some((t) => t === "chip" || t.startsWith("chip-"))) continue;
      expect(tokensOf(use.value), "role label keeps overrides").toEqual(["chip-tag"]);
    }
  });
});

describe("2.3 — RoleChip consumes its 2.2 tone on chip-tag", () => {
  const role = readSource(join("components", "admin", "RoleChip.tsx"));

  function roleTone(leaf: string): string {
    if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
    const component = tokensJson["component"];
    if (!isRecord(component) || !isRecord(component["badge"]) || !isRecord(component["badge"]["role"])) {
      throw new Error("tokens.json has no component.badge.role group");
    }
    const token = component["badge"]["role"][leaf];
    if (!isRecord(token) || !("$value" in token)) throw new Error(`component.badge.role.${leaf} is missing`);
    return colorName(token["$value"], `role ${leaf}`);
  }

  it("renders the admin tone and the plain tag from the role tokens", () => {
    const ground = roleTone("admin-background");
    const text = roleTone("admin-text");
    expect(role).toContain(`chip-tag bg-${ground} font-semibold text-${text}`);
    expect(role).toContain('"chip-tag"');
    expect(role, "bare chip remains in RoleChip").not.toMatch(/"chip[\s"]/);
  });

  it("renders both roles on chip-tag with text intact", () => {
    const admin = renderToStaticMarkup(createElement(RoleChip, { role: "admin" }));
    expect(admin).toContain("chip-tag bg-leaf-50 font-semibold text-leaf");
    expect(admin).toContain("Admin");
    const reviewer = renderToStaticMarkup(createElement(RoleChip, { role: "reviewer" }));
    expect(reviewer).toContain('class="chip-tag"');
    expect(reviewer).toContain("Reviewer");
  });
});

describe("2.3-F — scope guards (item 2.3 surfaces only)", () => {
  it("FilterStrip keeps only its shadow touch: no chip class, chevron token intact", () => {
    const strip = readSource(join("components", "ui", "FilterStrip.tsx"));
    expect(strip).toContain("shadow-strip-button");
    for (const use of classUses("FilterStrip", strip)) {
      expect(tokensOf(use.value).some((t) => t === "chip" || t.startsWith("chip-")), "FilterStrip gained a chip class").toBe(false);
    }
  });

  it("BrowseFilters keeps its group model, order, and labels", () => {
    const browse = readSource(join("components", "ui", "BrowseFilters.tsx"));
    const legends: string[] = [];
    for (const match of browse.matchAll(/legend: "([^"]+)"/g)) {
      const legend = match[1];
      if (legend !== undefined) legends.push(legend);
    }
    expect(legends.length, "no filter groups found").toBeGreaterThan(0);
    expect(legends).toEqual(["Season", "Sowing method", "Life cycle", "Hue", "Sellers"]);
  });
});

describe("2.3 — ChipRemoveIcon (SPEC §4.4 family rules)", () => {
  it("draws the × as two strokes: 24px grid, stroke 1.8, currentColor, no fill, hidden", () => {
    const h = renderToStaticMarkup(createElement(ChipRemoveIcon, { className: "size-3.5" }));
    expect(h).toContain("<svg");
    expect(h).toContain('viewBox="0 0 24 24"');
    expect(h).toContain('stroke="currentColor"');
    expect(h).toContain('stroke-width="1.8"');
    expect(h).toContain('fill="none"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('class="size-3.5"');
    expect(h.match(/<path/g) ?? []).toHaveLength(2);
  });

  it("sizes to the removable glyph token at the call site", () => {
    expect(chipToken("removable", "glyph-size")).toBe("14px");
    const list = readSource(join("app", "admin", "(protected)", "listings", "_components", "listing-list.tsx"));
    expect(list).toContain('className="size-3.5"');
  });
});
