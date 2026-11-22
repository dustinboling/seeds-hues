/**
 * Tranche 2.3 — Chip split: filter chips vs tag chips (SPEC tranche-2 §4).
 *
 * Contract coverage, per the §4.2 table, the §4.3 behavioral contract, the
 * §4.4 removable affordance and the §4.5 census:
 *
 * - Census (2.3-A): no bare `chip` class and no `chip tap` pair remains in any
 *   class list; no chipClass helper declaration survives (including the two
 *   same-string helpers this tree carried under older names, segmentLink in
 *   queue-list.tsx and segmentClass in varieties/page.tsx — the spec calls the
 *   first "its chipClass"); every chip class sits inline in a className
 *   attribute, never built by a helper.
 * - Elements: chip-tag only on <span>, chip-filter only on <a>/<button> (Next
 *   <Link> in source, which renders <a> — every Link site is also rendered
 *   below to prove it); no chip element carries both aria-current and
 *   aria-pressed; the selected weight and dress live in the CSS, so no
 *   chip-filter class list re-implements them.
 * - Rules: .chip-filter carries the token values (44px via the house target,
 *   hover, selected dress with weight 600); .chip-tag is the inert 32px twin
 *   with no hover, selected, or transition rule; .chip-removable seats the
 *   6px glyph gap; no bare .chip selector remains.
 * - Tokens: component.chip filter/tag/removable groups pin the §4.2 values,
 *   with tag/filter shared DNA asserted equal to each other, not to literals.
 * - R-3: the two listing-list remover chips render the drawn 14px glyph with
 *   their Remove… names, no aria-current, and no group chip carries it.
 * - R-4: the listing-detail status tag and the account-list role labels take
 *   true tag geometry with their overrides gone.
 * - R-5: the crop rows carry chip-filter with aria-current="true", still
 *   hand-rolled (their rebuild is Tranche 3.1, guarded below).
 *
 * Every set asserted about a source file is derived from that file at test
 * time: class lists from className attributes, JSX tags from a brace-aware
 * open-tag scan, token endpoints from tokens.json with aliases resolved. The
 * only pinned endpoints are spec-registered values (44px/32px geometry, leaf
 * selected tones, the R-3 pair of removers, the §4.5 census files).
 *
 * Non-vacuity: this file fails on pre-build code — bare `chip` classes and
 * chipClass helpers exist there, component.chip and the three rules do not,
 * no chip-filter/chip-tag use exists, the removers carry a text cross, and
 * the crop rows use aria-current="page".
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountList } from "@/app/admin/(protected)/accounts/_components/account-list";
import { ListingDetail } from "@/app/admin/(protected)/listings/_components/listing-detail";
import { ListingList } from "@/app/admin/(protected)/listings/_components/listing-list";
import { QueueList } from "@/app/admin/(protected)/review/_components/queue-list";
import { QueueNav } from "@/app/admin/(protected)/review/_components/queue-nav";
import { SellerList } from "@/app/admin/(protected)/sellers/_components/seller-list";
import { SignalControl, TimeRangeControl } from "@/app/admin/(protected)/statistics/_components/time-range-control";
import { VarietyList } from "@/app/admin/(protected)/varieties/_components/variety-list";
import { RoleChip } from "@/components/admin/RoleChip";
import { GuideTabs } from "@/components/crop/GuideTabs";
import { ChipRemoveIcon } from "@/components/layout/icons";
import { StateFilter } from "@/components/seller/StateFilter";
import { BrowseFilters } from "@/components/ui/BrowseFilters";
import type { BrowseFilterState } from "@/components/ui/BrowseFilters";
import { SellerFilterSection } from "@/components/variety/SellerFilterSection";
import type { PublicListing } from "@/lib/validators";

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

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/[^\r\n]*/g, "$1 ");
}

const tokensJson: unknown = JSON.parse(readSource("design-tokens/tokens.json"));
const css = readSource("app/globals.css");

function chipRecord(): Record<string, unknown> {
  if (!isRecord(tokensJson)) throw new Error("tokens.json root is not an object");
  const component = tokensJson["component"];
  if (!isRecord(component)) throw new Error("tokens.json has no component group");
  const chip = component["chip"];
  if (!isRecord(chip)) throw new Error("tokens.json has no component.chip group (item 2.3 tokens missing)");
  return chip;
}

function chipGroup(key: string): Record<string, unknown> {
  const group = chipRecord()[key];
  if (!isRecord(group)) throw new Error(`tokens.json has no component.chip.${key} group`);
  return group;
}

function tokenValue(groupKey: string, leaf: string): unknown {
  const token = chipGroup(groupKey)[leaf];
  if (!isRecord(token)) throw new Error(`component.chip.${groupKey}.${leaf} is missing`);
  if (!("$value" in token)) throw new Error(`component.chip.${groupKey}.${leaf} has no $value`);
  return token["$value"];
}

/** Resolve a {dotted.path} alias against the token file; literals pass through. */
function resolveAlias(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const path = /^\{(.+)\}$/.exec(value.trim())?.[1];
  if (path === undefined) return value;
  let node: unknown = tokensJson;
  for (const part of path.split(".")) {
    if (!isRecord(node)) throw new Error(`Alias ${value} points at no token`);
    node = node[part];
  }
  if (!isRecord(node) || !("$value" in node)) throw new Error(`Alias ${value} points at no token`);
  return resolveAlias(node["$value"]);
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

/** Blank ${...} interpolations with a brace-aware scan (ternaries nest braces and quotes). */
function blankInterpolations(value: string): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const start = value.indexOf("${", i);
    if (start === -1) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, start);
    let j = start + 2;
    let depth = 1;
    let quote: string | null = null;
    while (j < value.length && depth > 0) {
      const ch = value[j];
      if (quote !== null) {
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === quote) quote = null;
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        j += 1;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      j += 1;
    }
    out += " ";
    i = j;
  }
  return out;
}

/** Raw className attribute values: quoted, template, or brace expressions. */
function classNameValues(code: string): string[] {
  const values: string[] = [];
  const re = /className\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const start = match.index + match[0].length;
    const open = code[start];
    if (open === '"' || open === "`") {
      const end = code.indexOf(open, start + 1);
      if (end === -1) break;
      values.push(code.slice(start + 1, end));
      re.lastIndex = end + 1;
    } else if (open === "{") {
      let j = start + 1;
      let depth = 1;
      let quote: string | null = null;
      while (j < code.length && depth > 0) {
        const ch = code[j];
        if (quote !== null) {
          if (ch === "\\") {
            j += 2;
            continue;
          }
          if (ch === quote) quote = null;
          j += 1;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          quote = ch;
          j += 1;
          continue;
        }
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        j += 1;
      }
      values.push(code.slice(start, j));
      re.lastIndex = j;
    }
  }
  return values;
}

/** Class lists as the browser sees their static part: interpolations blanked, split on space. */
function classLists(content: string): string[][] {
  const lists: string[][] = [];
  for (const value of classNameValues(content)) {
    if (value.startsWith("{")) {
      for (const quoted of value.matchAll(/"([^"]*)"/g)) {
        const inner = quoted[1];
        if (inner === undefined) continue;
        lists.push(blankInterpolations(inner).split(/\s+/).filter((t) => t.length > 0));
      }
    } else {
      lists.push(blankInterpolations(value).split(/\s+/).filter((t) => t.length > 0));
    }
  }
  return lists;
}

/** Source with every className value blanked, for outside-a-className checks. */
function blankClassNameValues(code: string): string {
  const spans: [number, number][] = [];
  const re = /className\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) {
    const start = match.index + match[0].length;
    const open = code[start];
    if (open === '"' || open === "`") {
      const end = code.indexOf(open, start + 1);
      if (end === -1) break;
      spans.push([start, end + 1]);
      re.lastIndex = end + 1;
    } else if (open === "{") {
      let j = start + 1;
      let depth = 1;
      let quote: string | null = null;
      while (j < code.length && depth > 0) {
        const ch = code[j];
        if (quote !== null) {
          if (ch === "\\") {
            j += 2;
            continue;
          }
          if (ch === quote) quote = null;
          j += 1;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          quote = ch;
          j += 1;
          continue;
        }
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        j += 1;
      }
      spans.push([start, j]);
      re.lastIndex = j;
    }
  }
  let out = code;
  for (const [from, to] of spans.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, from) + " ".repeat(Math.max(0, to - from)) + out.slice(to);
  }
  return out;
}

interface ChipUse {
  file: string;
  tag: string;
  attrs: string;
  classes: string[];
}

/**
 * JSX open tags via a brace-aware scan: the tag ends at the first `>` at
 * brace depth zero outside strings, so `=>` and `>` inside attribute
 * expressions never cut a tag short. Comments are stripped first so prose
 * about chips (a "chip strip", the retired class) never reads as markup.
 */
function jsxOpenTags(content: string): { tag: string; attrs: string }[] {
  const tags: { tag: string; attrs: string }[] = [];
  const code = stripComments(content);
  let i = 0;
  while (i < code.length) {
    const open = code.indexOf("<", i);
    if (open === -1) break;
    const head = /^<([A-Za-z][A-Za-z0-9.]*)(?=[\s/>])/.exec(code.slice(open, open + 60));
    const name = head?.[1];
    if (head === null || name === undefined) {
      i = open + 1;
      continue;
    }
    let j = open + head[0].length;
    let depth = 0;
    let quote: string | null = null;
    let closed = false;
    while (j < code.length) {
      const ch = code[j];
      if (quote !== null) {
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === quote) quote = null;
        j += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        j += 1;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (ch === ">" && depth === 0) {
        closed = true;
        break;
      } else if (ch === "<") break;
      j += 1;
    }
    if (closed) tags.push({ tag: name, attrs: code.slice(open, j) });
    i = open + 1;
  }
  return tags;
}

/** Every element that carries a chip class, derived per file at test time. */
function chipUses(): ChipUse[] {
  const uses: ChipUse[] = [];
  for (const file of WALK_ROOTS.flatMap((root) => walk(root))) {
    if (!file.endsWith(".tsx")) continue;
    for (const { tag, attrs } of jsxOpenTags(readSource(file))) {
      if (!/chip-(filter|tag|removable)/.test(attrs)) continue;
      const classes = classLists(attrs).flat();
      if (classes.some((c) => c === "chip-filter" || c === "chip-tag" || c === "chip-removable")) {
        uses.push({ file, tag, attrs, classes });
      }
    }
  }
  return uses;
}

function cssRule(selector: string): string {
  return css.match(new RegExp(`\\.${selector} \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? "";
}

describe("2.3-A — census: the bare chip class is retired everywhere", () => {
  const files = WALK_ROOTS.flatMap((root) => walk(root));

  it("finds no bare `chip` class and no `chip tap` pair in any class list", () => {
    const offenders: string[] = [];
    let splitUses = 0;
    for (const file of files) {
      if (!file.endsWith(".tsx")) continue;
      for (const classes of classLists(stripComments(readSource(file)))) {
        if (classes.includes("chip")) offenders.push(`${file}: bare chip in "${classes.join(" ")}"`);
        if (classes.includes("chip") && classes.includes("tap")) offenders.push(`${file}: chip tap pair survives`);
        if (classes.includes("chip-filter") || classes.includes("chip-tag")) splitUses += 1;
      }
    }
    expect(splitUses, "the scanner sees no split-chip use at all").toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("finds no surviving chip class helper (chipClass, segmentLink, segmentClass)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      const code = stripComments(readSource(file));
      for (const helper of ["chipClass", "segmentLink", "segmentClass"]) {
        if (new RegExp(`function ${helper}[\\s(]|const ${helper}\\s*=`).test(code)) {
          offenders.push(`${file}: ${helper} still declared`);
        }
        if (new RegExp(`\\b${helper}\\s*\\(`).test(code)) {
          offenders.push(`${file}: ${helper} still called`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("holds every chip class inline in a className attribute (no helper of any name builds one)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      const code = blankClassNameValues(stripComments(readSource(file)));
      for (const cls of ["chip-filter", "chip-tag", "chip-removable"]) {
        if (code.includes(cls)) offenders.push(`${file}: ${cls} outside a className attribute`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("2.3-A — elements: tags are spans, filters are links and buttons", () => {
  const uses = chipUses();
  const filters = uses.filter((u) => u.classes.includes("chip-filter") || u.classes.includes("chip-removable"));
  const tags = uses.filter((u) => u.classes.includes("chip-tag"));

  it("sees both sides of the split (the element checks are not vacuous)", () => {
    expect(filters.length).toBeGreaterThan(0);
    expect(tags.length).toBeGreaterThan(0);
  });

  it("puts chip-tag only on <span>", () => {
    const offenders = tags.filter((u) => u.tag !== "span").map((u) => `${u.file}: <${u.tag}> carries chip-tag`);
    expect(offenders).toEqual([]);
  });

  it("puts chip-filter only on <a>, <button> and <Link> (Link renders <a>, proven by the renders below)", () => {
    const offenders = filters.filter((u) => u.tag !== "a" && u.tag !== "button" && u.tag !== "Link").map((u) => `${u.file}: <${u.tag}> carries a filter chip`);
    expect(offenders).toEqual([]);
  });

  it("pairs chip-removable with chip-filter on the same element", () => {
    const offenders = uses.filter((u) => u.classes.includes("chip-removable") && !u.classes.includes("chip-filter")).map((u) => `${u.file}: <${u.tag}> carries chip-removable without chip-filter`);
    expect(offenders).toEqual([]);
  });

  it("never puts aria-current and aria-pressed on the same chip (§4.3.1 exclusivity)", () => {
    const offenders = uses.filter((u) => u.attrs.includes("aria-current") && u.attrs.includes("aria-pressed")).map((u) => `${u.file}: <${u.tag}> carries both chip semantics`);
    expect(offenders).toEqual([]);
  });

  it("carries no re-implemented dress in chip-filter class lists (the CSS owns height, dress and weight)", () => {
    const offenders: string[] = [];
    for (const use of filters) {
      for (const old of ["tap", "min-h-target", "font-semibold", "border-leaf", "bg-leaf-50"]) {
        if (use.classes.includes(old)) offenders.push(`${use.file}: <${use.tag}> still carries ${old} beside chip-filter`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("carries no size override in chip-tag class lists (R-4 deleted them; the class is the geometry)", () => {
    const offenders: string[] = [];
    for (const use of tags) {
      for (const old of ["tap", "min-h-target", "min-h-[32px]", "text-[13px]", "px-2.5", "py-1", "inline-flex", "items-center"]) {
        if (use.classes.includes(old)) offenders.push(`${use.file}: <${use.tag}> still carries ${old} beside chip-tag`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("2.3 — chip rules in globals.css carry the token values", () => {
  it("retires every bare .chip selector (only the split classes remain)", () => {
    const bare = stripComments(css).match(/\.chip(?![\w-])/g) ?? [];
    expect(bare).toEqual([]);
    for (const rule of [".chip-filter {", ".chip-tag {", ".chip-removable {"]) {
      expect(css, `${rule} is missing`).toContain(rule);
    }
  });

  it(".chip-filter carries the shared DNA and the 44px house target", () => {
    const rule = cssRule("chip-filter");
    expect(rule, ".chip-filter rule is missing").not.toBe("");
    for (const decl of [
      "display: inline-flex;",
      "align-items: center;",
      "min-height: var(--size-target);",
      "padding: 0.125rem 0.75rem;",
      "border-radius: 999px;",
      "border: 1px solid var(--color-line-strong);",
      "background: var(--color-surface);",
      "color: var(--color-ink);",
      "font-family: var(--font-sans);",
      "font-size: 0.875rem;",
      "line-height: 1.5;",
    ]) {
      expect(rule, decl).toContain(decl);
    }
    expect(resolveAlias(tokenValue("filter", "min-height")), "the house target is 44px").toBe("44px");
  });

  it(".chip-filter keeps the retired hover values on links and buttons only", () => {
    const hover = css.match(/a\.chip-filter:hover,[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(hover, "the filter hover rule is missing").not.toBe("");
    expect(hover).toContain("button.chip-filter:hover");
    expect(hover).toContain("border-color: var(--color-leaf-600);");
    expect(hover).toContain("background: var(--color-leaf-50);");
    expect(hover).toContain("color: var(--color-ink);");
  });

  it(".chip-filter folds the selected dress and weight into one rule (no page selector survives)", () => {
    const selected = css.match(/\.chip-filter\[aria-current="true"\][\s\S]*?\n  \}/)?.[0] ?? "";
    expect(selected, "the filter selected rule is missing").not.toBe("");
    expect(selected).toContain('[aria-pressed="true"]');
    expect(selected).toContain("border-color: var(--color-leaf);");
    expect(selected).toContain("background: var(--color-leaf-50);");
    expect(selected).toContain("color: var(--color-leaf);");
    expect(selected).toContain("font-weight: 600;");
    expect(css, 'a chip "page" selector survives').not.toContain('[aria-current="page"]');
  });

  it("gives toggle buttons the pointer cursor of the links they replace", () => {
    expect(css).toContain("button.chip-filter {\n    cursor: pointer;\n  }");
  });

  it(".chip-tag is the inert 32px twin: same DNA, no hover, selected, transition, or focus rule", () => {
    const rule = cssRule("chip-tag");
    expect(rule, ".chip-tag rule is missing").not.toBe("");
    for (const decl of [
      "display: inline-flex;",
      "align-items: center;",
      "min-height: 2rem;",
      "padding: 0.125rem 0.75rem;",
      "border-radius: 999px;",
      "border: 1px solid var(--color-line-strong);",
      "background: var(--color-surface);",
      "color: var(--color-ink);",
      "font-family: var(--font-sans);",
      "font-size: 0.875rem;",
      "line-height: 1.5;",
      "cursor: default;",
    ]) {
      expect(rule, decl).toContain(decl);
    }
    expect(rule, "a tag transition survives").not.toContain("transition");
    for (const forbidden of [".chip-tag:hover", ".chip-tag[aria", ".chip-tag:focus"]) {
      expect(stripComments(css), `${forbidden} must not exist`).not.toContain(forbidden);
    }
  });

  it(".chip-removable seats the 6px glyph gap and nothing else", () => {
    expect(cssRule("chip-removable")).toContain("gap: 6px;");
    expect(tokenValue("removable", "glyph-gap")).toBe("6px");
  });
});

describe("2.3 — chip tokens (SPEC §4.2 values, shared DNA asserted twin to twin)", () => {
  it("records the filter, tag and removable groups (the contract is not vacuous)", () => {
    const keys = Object.keys(chipRecord());
    for (const group of ["filter", "tag", "removable"]) {
      expect(keys, `component.chip.${group} is missing`).toContain(group);
    }
  });

  it("pins the filter geometry: 44px house target, retired bare-chip padding and type", () => {
    expect(tokenValue("filter", "min-height")).toBe("{size.target}");
    expect(resolveAlias(tokenValue("filter", "min-height"))).toBe("44px");
    expect(tokenValue("filter", "padding-block")).toBe("0.125rem");
    expect(tokenValue("filter", "padding-inline")).toBe("0.75rem");
    expect(tokenValue("filter", "radius")).toBe("999px");
    expect(tokenValue("filter", "font-size")).toBe("0.875rem");
    expect(tokenValue("filter", "line-height")).toBe(1.5);
  });

  it("pins the resting and hover tones both chips share", () => {
    for (const group of ["filter", "tag"]) {
      expect(colorName(tokenValue(group, "background"), `${group} ground`)).toBe("surface");
      const border = borderParts(tokenValue(group, "border"), group);
      expect(border.color).toBe("line-strong");
      expect(border.alpha).toBe("100%");
      expect(colorName(tokenValue(group, "text"), `${group} text`)).toBe("ink");
    }
    expect(colorName(tokenValue("filter", "hover-border"), "hover border")).toBe("leaf-600");
    expect(colorName(tokenValue("filter", "hover-background"), "hover ground")).toBe("leaf-50");
  });

  it("pins the folded-in selected dress: leaf border, leaf-50 ground, leaf semibold text", () => {
    expect(colorName(tokenValue("filter", "selected-border"), "selected border")).toBe("leaf");
    expect(colorName(tokenValue("filter", "selected-background"), "selected ground")).toBe("leaf-50");
    expect(colorName(tokenValue("filter", "selected-text"), "selected text")).toBe("leaf");
    expect(tokenValue("filter", "selected-weight")).toBe("600");
  });

  it("holds the shared DNA identical between tag and filter (twins at rest, by decision)", () => {
    for (const leaf of ["padding-block", "padding-inline", "radius", "background", "border", "text", "font-family", "font-size", "line-height"]) {
      expect(JSON.stringify(tokenValue("tag", leaf)), `tag ${leaf} drifts from filter ${leaf}`).toBe(JSON.stringify(tokenValue("filter", leaf)));
    }
  });

  it("pins the tag height at the retired 32px and the absence of tag states", () => {
    expect(tokenValue("tag", "min-height")).toBe("2rem");
    const leaves = Object.keys(chipGroup("tag")).filter((leaf) => !leaf.startsWith("$"));
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf, `a tag ${leaf} state token must not exist`).not.toMatch(/hover|selected|pressed|current|transition/);
    }
  });

  it("pins the removable glyph contract: 14px, 6px gap, family stroke (§4.4)", () => {
    expect(tokenValue("removable", "glyph-size")).toBe("14px");
    expect(tokenValue("removable", "glyph-gap")).toBe("6px");
    expect(tokenValue("removable", "glyph-stroke")).toBe(1.8);
  });
});

describe("2.3 — public filter chips render as links with one current value per group", () => {
  const OFF: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: null, smallFarm: false };

  it("BrowseFilters: chip-filter links, one aria-current per group, hue dots kept (§4.3.4)", () => {
    const h = renderToStaticMarkup(createElement(BrowseFilters, { basePath: "/variety", state: OFF, groups: ["season", "hue"] }));
    const chips = h.match(/<a[^>]*class="chip-filter"[^>]*>/g) ?? [];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip, "ad hoc selected weight survives").not.toContain("font-semibold");
    expect(h.match(/aria-current="true"/g) ?? []).toHaveLength(2);
    expect(h).toContain("rounded-full border border-line-strong");
  });

  it("StateFilter: the counted cloud keeps its layout, chips take the filter class", () => {
    const h = renderToStaticMarkup(
      createElement(StateFilter, { basePath: "/seller", states: [{ code: "CA", name: "California", slug: "california", sellerCount: 3 }], active: null }),
    );
    expect(h).toContain('class="chip-filter"');
    expect(h).toContain('class="chip-filter gap-1.5"');
    expect(h).toContain("All states");
    expect(h).toContain("California");
    expect(h.match(/aria-current="true"/g) ?? []).toHaveLength(1);
    const chips = h.match(/<a[^>]*class="chip-filter[^"]*"[^>]*>/g) ?? [];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip, "ad hoc selected weight survives").not.toContain("font-semibold");
  });

  it("SellerFilterSection first paint: filter links with aria-current, no toggle semantics yet", () => {
    const listing = (id: number, isSmallFarm: boolean): PublicListing =>
      ({
        id,
        availability: "in_stock",
        lastCheckedAt: null,
        firstSeenAt: null,
        packetSizes: [],
        notes: null,
        seller: { slug: `seller-${id}`, name: `Seller ${id}`, location: null, region: "WA", country: "US", isSmallFarm },
        variety: { slug: "test-variety", varietyName: "Test Variety", plant: { slug: "test-plant", commonName: "Test Plant" } },
      }) as unknown as PublicListing;
    const h = renderToStaticMarkup(
      createElement(SellerFilterSection, { slug: "test-variety", varietyName: "Test Variety", listings: [listing(1, false), listing(2, true)], initialSmallFarmOnly: false }),
    );
    const chips = h.match(/<a[^>]*class="chip-filter"[^>]*>/g) ?? [];
    expect(chips).toHaveLength(2);
    for (const chip of chips) expect(chip, "ad hoc selected weight survives").not.toContain("font-semibold");
    expect(h.match(/aria-current="true"/g) ?? []).toHaveLength(1);
    expect(h).toContain("<nav");
    expect(h).not.toContain("aria-pressed");
  });

  it("GuideTabs pre-hydration: panel links in filter chips (the tab bar itself is untouched)", () => {
    const h = renderToStaticMarkup(createElement(GuideTabs, { label: "Grower guide", panels: [{ id: "sowing", label: "Sowing", content: "Sow shallow." }] }));
    expect(h).toContain('data-enhanced="false"');
    expect(h).toContain('class="chip-filter"');
    expect(h).toContain('data-testid="grower-guide-tab"');
    expect(h).not.toContain('role="tab"');
  });
});

describe("2.3 — crop rows, search shortcuts and variety tags (class-only migration)", () => {
  it("crop rows carry chip-filter with aria-current true, still hand-rolled (R-5, no Tranche 3.1 rebuild)", () => {
    const page = readSource("app/crop/[slug]/page.tsx");
    expect(page).toContain('className="chip-filter"');
    expect(page).toContain('aria-current={active ? "true" : undefined}');
    expect(page).not.toContain('aria-current={active ? "page" : undefined}');
    for (const old of ["border-leaf bg-leaf-50", "chip tap"]) {
      expect(page, `${old} is re-implemented dress`).not.toContain(old);
    }
    expect(page, "the rows were rebuilt onto BrowseFilters").not.toContain("BrowseFilters");
  });

  it("search shortcuts are three plain filter links with no selected state", () => {
    const page = readSource("app/search/page.tsx");
    for (const label of ["Browse by crop", "Browse all varieties", "Browse sellers"]) {
      expect(page, label).toContain(label);
    }
    expect(page.match(/className="chip-filter"/g) ?? []).toHaveLength(3);
    expect(page).not.toContain("aria-current");
  });

  it("variety Tags are the canonical tag use: same labels, layout and placement", () => {
    const view = readSource("app/variety/[slug]/variety-view.tsx");
    expect(view).toContain('<span key={t} className="chip-tag">');
    expect(view).toContain("{titleCaseTag(t)}");
    expect(view).toContain('<dd className="mt-1 flex flex-wrap gap-2">');
  });
});

describe("2.3 — admin filter chips render as links with one current value per group", () => {
  it("seller-list classification and listing-state groups", () => {
    const h = renderToStaticMarkup(
      createElement(SellerList, { rows: [], total: 0, params: { q: null, badge: "all", state: "all", sort: "name" }, selected: null }),
    );
    expect(h.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(6);
    expect(h.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(2);
  });

  it("variety-list crop group inside its FilterStrip", () => {
    const h = renderToStaticMarkup(
      createElement(VarietyList, {
        rows: [],
        total: 0,
        params: { q: null, crop: null, show: 50 },
        selected: null,
        crops: [{ slug: "tomato", commonName: "Tomato" }],
      }),
    );
    expect(h.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(2);
    expect(h.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(1);
  });

  it("queue navigation keeps its count content inside filter chips", () => {
    const h = renderToStaticMarkup(
      createElement(QueueNav, { active: "reports", counts: { duplicates: 1, sellers: 0, listings: 2, reports: 3 } }),
    );
    expect(h.match(/class="chip-filter flex items-center gap-2"/g) ?? []).toHaveLength(4);
    expect(h.match(/aria-current="true" class="chip-filter flex items-center gap-2"/g) ?? []).toHaveLength(1);
    expect(h).toContain("All clear");
  });

  it("queue-list Waiting/Decided segments", () => {
    const h = renderToStaticMarkup(
      createElement(QueueList, { queue: "reports", show: 50, decided: false, rows: [], total: 0, selected: null, decidedRows: [], decidedTotal: 0, decidedPage: 1 }),
    );
    expect(h.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(2);
    expect(h.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(1);
  });

  it("time-range and signal groups share the one filter class", () => {
    const range = renderToStaticMarkup(createElement(TimeRangeControl, { range: "30d", signal: "clicks", show: 25, words: "Oct 22 – Nov 20, 2026" }));
    expect(range.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(3);
    expect(range.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(1);
    const signal = renderToStaticMarkup(createElement(SignalControl, { range: "30d", signal: "searches", show: 10 }));
    expect(signal.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(4);
    expect(signal.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(1);
  });

  it("listing-list state group keeps its four options with one current", () => {
    const h = renderToStaticMarkup(
      createElement(ListingList, {
        rows: [],
        total: 0,
        params: { q: null, chip: "all", seller: null, variety: null, show: 50 },
        selected: null,
        deepLinks: { seller: null, variety: null },
      }),
    );
    expect(h.match(/class="chip-filter flex items-center"/g) ?? []).toHaveLength(4);
    expect(h.match(/aria-current="true" class="chip-filter flex items-center"/g) ?? []).toHaveLength(1);
    expect(h).not.toContain("chip-removable");
  });
});

describe("2.3 — R-3: the two remover chips gain the drawn glyph (2.3-D)", () => {
  const h = renderToStaticMarkup(
    createElement(ListingList, {
      rows: [],
      total: 0,
      params: { q: null, chip: "all", seller: "songbird-seed-co", variety: "chantilly-purple", show: 50 },
      selected: null,
      deepLinks: { seller: { slug: "songbird-seed-co", name: "Songbird Seed Co." }, variety: { slug: "chantilly-purple", name: "Chantilly Purple" } },
    }),
  );
  const removers = h.match(/<a[^>]*chip-removable[^>]*>[\s\S]*?<\/a>/g) ?? [];

  it("renders exactly the two registered removers, each with the glyph and its Remove name", () => {
    expect(removers).toHaveLength(2);
    expect(h).toContain('aria-label="Remove the seller filter, Seller: Songbird Seed Co."');
    expect(h).toContain('aria-label="Remove the variety filter, Variety: Chantilly Purple"');
    expect(h).toContain("Seller: Songbird Seed Co.");
    expect(h).toContain("Variety: Chantilly Purple");
  });

  it("draws the glyph (never a text cross) as one inseparable hit target per chip", () => {
    expect(h).not.toContain(">×<");
    for (const remover of removers) {
      expect(remover, "remover without the drawn glyph").toContain("<svg");
      expect(remover).toContain('aria-hidden="true"');
      expect(remover).toContain('class="size-3.5 shrink-0"');
      expect(remover).toContain('class="chip-filter chip-removable flex items-center"');
      expect(remover, "a remover must never look like a selected option").not.toContain("aria-current");
      const inner = remover.replace(/^<a[^>]*>/, "").replace(/<\/a>$/, "");
      expect(inner, "the glyph must never be a nested control").not.toContain("<button");
      expect(inner, "the glyph must never be a nested link").not.toContain("<a ");
    }
  });

  it("keeps the glyph off every group chip in every file (R-3 names exactly two chips)", () => {
    const users = chipUses().filter((u) => u.classes.includes("chip-removable"));
    expect(users).toHaveLength(2);
    const files = [...new Set(users.map((u) => u.file))];
    expect(files).toEqual([join("app", "admin", "(protected)", "listings", "_components", "listing-list.tsx")]);
  });
});

describe("2.3 — R-4: inert admin chips take true tag geometry (2.3-B)", () => {
  it("RoleChip renders the tag with its §3.2 tone, never a filter class", () => {
    const admin = renderToStaticMarkup(createElement(RoleChip, { role: "admin" }));
    expect(admin).toBe('<span class="chip-tag bg-leaf-50 font-semibold text-leaf">Admin</span>');
    const reviewer = renderToStaticMarkup(createElement(RoleChip, { role: "reviewer" }));
    expect(reviewer).toBe('<span class="chip-tag">Reviewer</span>');
  });

  it("listing-detail status reads out as a tag with its overrides gone", () => {
    const h = renderToStaticMarkup(
      createElement(ListingDetail, {
        detail: {
          id: 7,
          titleRaw: "Chantilly Purple Snapdragon Seeds",
          productUrl: "https://example.com/p/7",
          status: "removed",
          availability: "sold_out",
          deletedAt: null,
          varietySlug: "chantilly-purple",
          varietyName: "Chantilly Purple",
          sellerSlug: "songbird-seed-co",
          sellerName: "Songbird Seed Co.",
          sellerEligibility: "eligible",
          sellerStatus: "active",
          sellerListingPolicy: "all",
          sellerDeletedAt: null,
          packets: [],
          history: [],
        },
        role: "admin",
        ctx: { listing: "7", q: null, chip: "all", seller: null, variety: null, show: "50" },
        backHref: "/admin/listings",
        genericStatus: null,
      }),
    );
    expect(h).toContain('<span class="chip-tag">Retired</span>');
  });

  it("account-list role labels render as plain tags with their overrides gone", () => {
    const h = renderToStaticMarkup(
      createElement(AccountList, {
        rows: [
          { id: 1, name: "A U Thor", displayName: null, email: "a@example.com", createdAt: "2026-11-20T00:00:00.000Z", role: "admin", isFarmOwner: true },
          { id: 2, name: "R E Viewer", displayName: null, email: "r@example.com", createdAt: "2026-11-19T00:00:00.000Z", role: "reviewer", isFarmOwner: false },
        ],
        total: 2,
        params: { q: null, show: 50 },
        selected: null,
      }),
    );
    const tags = h.match(/<span class="chip-tag"[^>]*>[^<]*<\/span>/g) ?? [];
    expect(tags).toHaveLength(3);
    expect(h).toContain('<span class="chip-tag">Admin</span>');
    expect(h).toContain('<span class="chip-tag">Reviewer</span>');
    expect(h).toContain('<span class="chip-tag">Farm owner</span>');
    for (const tag of tags) {
      for (const old of ["min-h-[32px]", "text-[13px]", "px-2.5", "py-1"]) {
        expect(tag, `${old} survives on a tag`).not.toContain(old);
      }
    }
  });
});

describe("2.3 — ChipRemoveIcon (SPEC §4.4 family rules)", () => {
  it("draws a cross: 24px grid, stroke 1.8, currentColor, no fill, hidden, caller-sized", () => {
    const h = renderToStaticMarkup(createElement(ChipRemoveIcon, { className: "size-3.5 shrink-0" }));
    expect(h).toContain("<svg");
    expect(h).toContain('viewBox="0 0 24 24"');
    expect(h).toContain('stroke="currentColor"');
    expect(h).toContain('stroke-width="1.8"');
    expect(h).toContain('fill="none"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('class="size-3.5 shrink-0"');
    expect(h.match(/<path/g) ?? []).toHaveLength(2);
  });
});

describe("2.3 — scope guards (item 2.3 surfaces only)", () => {
  it("FilterStrip keeps only its 2.1 shadow touch: no chip class, chevrons and fades intact", () => {
    const strip = readSource("components/ui/FilterStrip.tsx");
    for (const cls of ["chip-filter", "chip-tag", "chip-removable", "chipClass"]) {
      expect(strip, `${cls} in FilterStrip`).not.toContain(cls);
    }
    expect(strip).toContain("shadow-strip-button");
    expect(strip).toContain("ChevronLeftIcon");
    expect(strip).toContain("ChevronRightIcon");
  });

  it("non-chips stay non-chips: pagination, Small Farm, the admin shell", () => {
    for (const file of ["components/ui/Pagination.tsx", "components/seller/SmallFarmBadge.tsx", "components/admin/AdminShell.tsx"]) {
      const src = readSource(file);
      for (const cls of ["chip-filter", "chip-tag", "chip-removable"]) {
        expect(src, `${cls} in ${file}`).not.toContain(cls);
      }
    }
    expect(readSource("components/seller/SmallFarmBadge.tsx"), "the badge size-table key is renamed").toContain('chip: "gap-');
  });

  it("SellerFilterSection keeps its hydration contract: links then toggle buttons, never mixed", () => {
    const section = readSource("components/variety/SellerFilterSection.tsx");
    expect(section).toContain("useSyncExternalStore");
    expect(section).toContain("aria-pressed");
    expect(section).toContain("aria-current");
    expect(section).toContain('role="group" aria-label="Filter sellers"');
  });

  it("the §4.5 census files are exactly the files that carry chip classes", () => {
    const users = chipUses();
    const files = [...new Set(users.map((u) => u.file))].sort();
    const expected = [
      "app/admin/(protected)/accounts/_components/account-list.tsx",
      "app/admin/(protected)/listings/_components/listing-detail.tsx",
      "app/admin/(protected)/listings/_components/listing-list.tsx",
      "app/admin/(protected)/review/_components/queue-list.tsx",
      "app/admin/(protected)/review/_components/queue-nav.tsx",
      "app/admin/(protected)/sellers/_components/seller-list.tsx",
      "app/admin/(protected)/statistics/_components/time-range-control.tsx",
      "app/admin/(protected)/varieties/_components/variety-list.tsx",
      "app/admin/(protected)/varieties/page.tsx",
      "app/crop/[slug]/page.tsx",
      "app/search/page.tsx",
      "app/variety/[slug]/variety-view.tsx",
      "components/admin/RoleChip.tsx",
      "components/crop/GuideTabs.tsx",
      "components/seller/StateFilter.tsx",
      "components/ui/BrowseFilters.tsx",
      "components/variety/SellerFilterSection.tsx",
    ]
      .map((f) => join(...f.split("/")))
      .sort();
    expect(files).toEqual(expected);
  });
});
