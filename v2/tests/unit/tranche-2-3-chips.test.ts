/**
 * Tranche 2.3 — Chip split (SPEC tranche-2 §4).
 *
 * Contract coverage, per the §4.2 component table and the §4.5 census:
 *
 * - Tokens: component.chip.filter.* (geometry incl. the F-1 min-width cure at
 *   {size.target}, grounds, selected tone), component.chip.tag.* (32px geometry,
 *   grounds) and component.chip.removable.* (14px glyph size, 6px gap) are
 *   recorded in tokens.json, and the globals.css rules carry exactly those
 *   values — the F-1 min-width pinned at BOTH levels so its removal fails.
 * - CSS: bare .chip selectors are gone; .chip-filter carries 44px in both
 *   dimensions with hover/selected/cursor rules at the pre-split values and the
 *   selected weight folded in; .chip-tag is 32px with no hover, selected, or
 *   focus rules; .chip-removable carries the 6px glyph gap; .tap is untouched.
 * - Census (2.3-A): no bare `chip` class token and no `chip tap` pair in any
 *   class literal; no chipClass declaration survives; chip-filter sits only on
 *   <a>/<button> (Link counts as <a>), chip-tag only on <span>, chip-removable
 *   only beside chip-filter on a remover link — except Tranche 3.1a's registered
 *   exception: the /variety applied row's hydrated removers are <button>s.
 * - QueueNav flex cure: the anchor's class string is exactly the PR#35 form
 *   `chip-filter flex items-center gap-2` — the pin fails if `flex` is dropped.
 * - R-3: the two listing-list removers carry chip-removable with the drawn
 *   ChipRemoveIcon (14px via the glyph-size token) and unchanged Remove names.
 * - R-4: the listing-detail status span and the account-list role labels are
 *   plain chip-tag spans, their overrides deleted.
 * - R-5: the crop rows carry chip-filter with aria-current="true", never "page".
 * - Scope guards: FilterStrip keeps only its shadow change; SmallFarmBadge,
 *   pagination, breadcrumbs, and the hydrated GuideTabs tab bar gain no chip.
 *
 * Every set asserted about a source file is derived from that file at test
 * time: token values from tokens.json, class literals and their enclosing JSX
 * tags from the walked sources, icon markup from the rendered icon. Specified
 * values (44px/32px/14px/6px geometry, tone colors, aria values, the QueueNav
 * string) are pinned as the contract.
 *
 * Non-vacuity: this file fails on pre-build code — component.chip is absent
 * from tokens.json, the .chip-filter rules are absent from globals.css, bare
 * `chip` classes and chipClass helpers are present in sources, and the QueueNav
 * anchor carries the pre-split string.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingList } from "@/app/admin/(protected)/listings/_components/listing-list";
import { QueueNav } from "@/app/admin/(protected)/review/_components/queue-nav";
import { RoleChip } from "@/components/admin/RoleChip";
import { ChipRemoveIcon } from "@/components/layout/icons";
import type { ListingChip } from "@/lib/admin/listings";

const ROOT = process.cwd();
const WALK_ROOTS = ["app", "components", "lib"] as const;
const SOURCE_EXT = /\.(ts|tsx)$/;
const TSX_EXT = /\.tsx$/;

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
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, " ");

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

/** A {group.name} alias resolves to its target path. */
function aliasTarget(alias: unknown, where: string): string {
  if (typeof alias !== "string") throw new Error(`${where} is not an alias`);
  const target = /^\{([a-z0-9.-]+)\}$/.exec(alias)?.[1];
  if (target === undefined) throw new Error(`${where} is not a {group.name} alias: ${alias}`);
  return target;
}

/** A {color.X} alias resolves to its color token name (X). */
function colorName(alias: unknown, where: string): string {
  const target = aliasTarget(alias, where);
  if (!target.startsWith("color.")) throw new Error(`${where} is not a {color.*} alias: ${alias}`);
  return target.slice("color.".length);
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

function cssRule(selector: string): string {
  return css.match(new RegExp(`\\.${selector} \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? "";
}

function cssBlock(selectorText: string): string {
  const start = css.indexOf(selectorText);
  if (start < 0) return "";
  const end = css.indexOf("\n  }", start);
  if (end < 0) return "";
  return css.slice(start, end);
}

/** Every class/className string literal in a source file, with its offset. */
function classLiterals(content: string): { literal: string; index: number }[] {
  const out: { literal: string; index: number }[] = [];
  const patterns = [/(?:className|class)\s*=\s*"([^"]*)"/g, /(?:className|class)\s*=\s*'([^']*)'/g, /(?:className|class)\s*=\s*`([^`]*)`/g];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const literal = match[1];
      const index = match.index;
      if (literal === undefined || index === undefined) continue;
      out.push({ literal: literal.replace(/\$\{[^}]*\}/g, " "), index });
    }
  }
  return out;
}

/**
 * The JSX tag name enclosing the class literal at `index`: the nearest `<Tag`
 * opener with no brace-depth-zero `>` between it and the literal (arrow bodies
 * like `() => f()` inside props must not read as a closed tag). Unknown when
 * none qualifies.
 */
function enclosingTag(content: string, index: number): string | null {
  let from = index;
  for (;;) {
    const open = content.lastIndexOf("<", from);
    if (open < 0 || open >= index) return null;
    let depth = 0;
    let closed = false;
    for (const ch of content.slice(open, index)) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (ch === ">" && depth === 0) {
        closed = true;
        break;
      }
    }
    const tag = /^<([A-Za-z][\w.]*)/.exec(content.slice(open, open + 40))?.[1];
    if (!closed && tag !== undefined) return tag;
    from = open - 1;
    if (from < 0) return null;
  }
}

/** Every `<Tag ...>` opener in a source file, brace- and quote-aware. */
function jsxOpeners(content: string, tag: string): string[] {
  const out: string[] = [];
  const needle = `<${tag}`;
  let at = content.indexOf(needle);
  while (at >= 0) {
    const next = content[at + needle.length];
    if (next !== " " && next !== ">" && next !== "\n" && next !== "\t") {
      at = content.indexOf(needle, at + 1);
      continue;
    }
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = at + needle.length; i < content.length; i++) {
      const ch = content[i];
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
      else if (ch === ">" && depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    out.push(content.slice(at, end + 1));
    at = content.indexOf(needle, end + 1);
  }
  return out;
}

describe("2.3 — chip tokens (SPEC §4.2/§4.4 values, F-1 min-width recorded)", () => {
  it("records the filter, tag and removable groups (the contract is not vacuous)", () => {
    const keys = Object.keys(chipRecord());
    for (const group of ["filter", "tag", "removable"]) {
      expect(keys, `component.chip.${group} is missing`).toContain(group);
    }
  });

  it("pins the filter minimums at the house target in BOTH dimensions (F-1 cure)", () => {
    expect(aliasTarget(tokenValue("filter", "min-height"), "filter min-height")).toBe("size.target");
    expect(aliasTarget(tokenValue("filter", "min-width"), "filter min-width")).toBe("size.target");
    expect(css, "--size-target holds 44px").toContain("--size-target: 44px;");
  });

  it("pins the filter rest, hover and selected tones (§4.2 contract table)", () => {
    expect(colorName(tokenValue("filter", "rest-background"), "rest ground")).toBe("surface");
    expect(colorName(tokenValue("filter", "rest-text"), "rest text")).toBe("ink");
    const rest = borderParts(tokenValue("filter", "rest-border"), "rest");
    expect(rest.color).toBe("line-strong");
    expect(rest.alpha).toBe("100%");
    expect(colorName(tokenValue("filter", "hover-background"), "hover ground")).toBe("leaf-50");
    const hover = borderParts(tokenValue("filter", "hover-border"), "hover");
    expect(hover.color).toBe("leaf-600");
    expect(hover.alpha).toBe("100%");
    expect(colorName(tokenValue("filter", "selected-background"), "selected ground")).toBe("leaf-50");
    expect(colorName(tokenValue("filter", "selected-text"), "selected text")).toBe("leaf");
    const selected = borderParts(tokenValue("filter", "selected-border"), "selected");
    expect(selected.color).toBe("leaf");
    expect(selected.alpha).toBe("100%");
  });

  it("pins the tag geometry at 32px with the shared DNA grounds", () => {
    expect(tokenValue("tag", "min-height")).toBe("2rem");
    expect(colorName(tokenValue("tag", "background"), "tag ground")).toBe("surface");
    expect(colorName(tokenValue("tag", "text"), "tag text")).toBe("ink");
    const border = borderParts(tokenValue("tag", "border"), "tag");
    expect(border.color).toBe("line-strong");
    expect(border.alpha).toBe("100%");
  });

  it("pins the removable glyph at 14px on its variable, consumed by the removers", () => {
    expect(tokenValue("removable", "glyph-size")).toBe("14px");
    expect(tokenValue("removable", "glyph-gap")).toBe("6px");
    const token = chipGroup("removable")["glyph-size"];
    if (!isRecord(token)) throw new Error("component.chip.removable.glyph-size is missing");
    const ext = token["$extensions"];
    const seeds = isRecord(ext) && isRecord(ext["seeds-hues"]) ? ext["seeds-hues"] : null;
    expect(seeds?.["cssVariable"]).toBe("--chip-removable-glyph-size");
    expect(css, "@theme carries the glyph-size variable").toContain("--chip-removable-glyph-size: 14px;");
    const list = readSource("app/admin/(protected)/listings/_components/listing-list.tsx");
    expect(list, "the removers consume the glyph-size variable").toContain("size-(--chip-removable-glyph-size)");
  });
});

describe("2.3 — CSS rules carry the token values (F-1 min-width at rule level)", () => {
  it(".chip-filter carries 44px in BOTH dimensions plus the shared DNA", () => {
    const rule = cssRule("chip-filter");
    expect(rule, ".chip-filter rule is missing").not.toBe("");
    for (const decl of [
      "display: inline-flex;",
      "align-items: center;",
      "min-height: var(--size-target);",
      "min-width: var(--size-target);",
      "padding: 0.125rem 0.75rem;",
      "border-radius: 999px;",
      "border: 1px solid var(--color-line-strong);",
      "background: var(--color-surface);",
      "color: var(--color-ink);",
      "font-family: var(--font-sans);",
      "font-size: 0.875rem;",
      "line-height: 1.5;",
      "background-color 160ms ease-out,",
      "border-color 160ms ease-out;",
    ]) {
      expect(rule, decl).toContain(decl);
    }
  });

  it(".chip-filter hover, selected and cursor rules carry the pre-split values", () => {
    const hover = cssBlock("a.chip-filter:hover,");
    expect(hover, "the hover rule is missing").not.toBe("");
    for (const decl of ["border-color: var(--color-leaf-600);", "background: var(--color-leaf-50);", "color: var(--color-ink);"]) {
      expect(hover, decl).toContain(decl);
    }
    const selected = cssBlock('.chip-filter[aria-current="true"],');
    expect(selected, "the selected rule is missing").not.toBe("");
    const ground = colorName(tokenValue("filter", "selected-background"), "selected ground");
    const text = colorName(tokenValue("filter", "selected-text"), "selected text");
    const border = borderParts(tokenValue("filter", "selected-border"), "selected");
    expect(border.alpha, "the selected border is full strength").toBe("100%");
    for (const decl of [`border-color: var(--color-${border.color});`, `background: var(--color-${ground});`, `color: var(--color-${text});`, "font-weight: 600;"]) {
      expect(selected, decl).toContain(decl);
    }
    expect(selected, "stays 1px between states").not.toContain("border-width");
    expect(cssBlock("button.chip-filter {"), "toggle buttons keep the pointer cursor").toContain("cursor: pointer;");
  });

  it(".chip-tag keeps the 32px height with no interactive rules and no min-width", () => {
    const rule = cssRule("chip-tag");
    expect(rule, ".chip-tag rule is missing").not.toBe("");
    for (const decl of ["display: inline-flex;", "align-items: center;", "min-height: 2rem;", "padding: 0.125rem 0.75rem;", "border: 1px solid var(--color-line-strong);"]) {
      expect(rule, decl).toContain(decl);
    }
    expect(rule, "tags take no minimum width").not.toContain("min-width");
    expect(rule, "tags take no transition").not.toContain("transition");
    expect(cssCode, "no tag hover rule may exist").not.toMatch(/\.chip-tag[^{]*:hover/);
    expect(cssCode, "no tag selected rule may exist").not.toMatch(/\.chip-tag\[[^\]]*aria-(current|pressed)/);
  });

  it(".chip-removable carries the 6px glyph gap and nothing else structural", () => {
    const rule = cssRule("chip-removable");
    expect(rule, ".chip-removable rule is missing").not.toBe("");
    expect(rule).toContain("gap: 6px;");
  });

  it("no bare chip selector survives, and .tap is untouched", () => {
    expect(cssCode.match(/\.chip(?![\w-])/g) ?? [], "bare .chip selectors remain").toHaveLength(0);
    const tap = cssRule("tap");
    expect(tap, ".tap rule is missing").not.toBe("");
    expect(tap).toContain("min-height: 44px;");
    expect(tap).toContain("min-width: 44px;");
  });
});

describe("2.3-A — class census (no bare chip, no helpers, elements exclusive)", () => {
  const files = WALK_ROOTS.flatMap((root) => walk(root));
  const tsx = files.filter((f) => TSX_EXT.test(f));
  const contents = new Map<string, string>(tsx.map((f): [string, string] => [f, readSource(f)]));

  interface ChipUse {
    file: string;
    tag: string | null;
    tokens: string[];
  }
  const uses: ChipUse[] = [];
  for (const [file, content] of contents) {
    for (const { literal, index } of classLiterals(content)) {
      const tokens = literal.split(/\s+/).filter((t) => t !== "");
      if (!tokens.some((t) => t === "chip" || t === "chip-filter" || t === "chip-tag" || t === "chip-removable")) continue;
      uses.push({ file, tag: enclosingTag(content, index), tokens });
    }
  }

  it("finds chip classes in the tree (the census is not vacuous)", () => {
    expect(tsx.length).toBeGreaterThan(0);
    expect(uses.length).toBeGreaterThan(0);
  });

  it("finds zero bare `chip` tokens and zero `chip tap` pairs in class literals", () => {
    for (const use of uses) {
      expect(use.tokens, `${use.file} carries a bare chip class`).not.toContain("chip");
      expect(use.tokens.join(" "), `${use.file} still pairs chip with tap`).not.toContain("chip tap");
    }
  });

  it("keeps no chipClass declaration anywhere in app, components or lib", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = file.endsWith(".tsx") ? (contents.get(file) ?? "") : readSource(file);
      expect(content, `${file} still declares chipClass`).not.toMatch(/(function|const) chipClass/);
    }
  });

  it("sits chip-filter only on links and buttons, chip-tag only on spans", () => {
    let split = 0;
    for (const use of uses) {
      if (use.tokens.includes("chip-filter")) {
        split++;
        expect(["a", "button", "Link"], `${use.file}: chip-filter on <${use.tag ?? "?"}>`).toContain(use.tag);
      }
      if (use.tokens.includes("chip-tag")) {
        split++;
        expect(use.tag, `${use.file}: chip-tag on <${use.tag ?? "?"}>`).toBe("span");
      }
      if (use.tokens.includes("chip-removable")) {
        split++;
        expect(use.tokens, `${use.file}: chip-removable without chip-filter`).toContain("chip-filter");
        // Tranche 3.1a: the /variety applied row's hydrated removers are <button>s (in-place,
        // like the hydrated filter chips) — the one registered exception; everywhere else a
        // remover is still a link.
        const tags = use.file === "components/variety/VarietyBrowse.tsx" ? ["a", "Link", "button"] : ["a", "Link"];
        expect(tags, `${use.file}: chip-removable on <${use.tag ?? "?"}>`).toContain(use.tag);
      }
    }
    expect(split, "no split-class use examined (the exclusivity check is vacuous)").toBeGreaterThan(0);
  });
});

describe("2.3 — QueueNav flex cure (the anchor fills the 340px column)", () => {
  const QUEUE_NAV = "app/admin/(protected)/review/_components/queue-nav.tsx";

  it("pins the anchor's class string exactly (chip-filter AND flex, PR#35 form)", () => {
    const src = readSource(QUEUE_NAV);
    const literals = classLiterals(src).map((c) => c.literal);
    expect(literals, "the QueueNav anchor string is missing").toContain("chip-filter flex items-center gap-2");
  });

  it("renders the four queue anchors on the pinned string", () => {
    const html = renderToStaticMarkup(
      createElement(QueueNav, { active: "sellers", counts: { duplicates: 2, sellers: 0, listings: 5, reports: 1 } }),
    );
    const anchors = html.match(/<a [^>]*class="([^"]*)"[^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      const cls = /class="([^"]*)"/.exec(anchor)?.[1] ?? "";
      const tokens = cls.split(/\s+/);
      expect(tokens, anchor).toContain("chip-filter");
      expect(tokens, `${anchor} dropped flex and would shrink-wrap the column`).toContain("flex");
    }
  });
});

describe("2.3-D — removers (R-3: the drawn glyph, Remove names intact)", () => {
  const LISTING_LIST = "app/admin/(protected)/listings/_components/listing-list.tsx";
  const seller = { slug: "songbird-seed-co", name: "Songbird Seed Co." };
  const variety = { slug: "katz-rainbow", name: "Katz Rainbow" };

  it("marks both deep-link anchors removable with the drawn glyph, no text cross", () => {
    const src = readSource(LISTING_LIST);
    expect(src, "the removers use the drawn glyph").toContain("ChipRemoveIcon");
    expect(src, "a text cross survives beside the drawn glyph").not.toContain(">×<");
    const anchors = jsxOpeners(src, "a").filter((opener) => opener.includes("chip-removable"));
    expect(anchors.length, "no chip-removable anchor found").toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor, `${anchor} lost its chip-filter base`).toContain("chip-filter");
      expect(anchor, `${anchor} lost its Remove name`).toMatch(/aria-label=\{`Remove the (seller|variety) filter/);
    }
  });

  it("renders each deep link as one target: glyph inside, Remove name on the link", () => {
    const params = { q: null, chip: "all" as ListingChip, seller: seller.slug, variety: variety.slug, show: 50 };
    const html = renderToStaticMarkup(
      createElement(ListingList, { rows: [], total: 0, params, selected: null, deepLinks: { seller, variety } }),
    );
    for (const [kind, value] of [["seller", seller.name], ["variety", variety.name]] as const) {
      const name = `Remove the ${kind} filter, ${kind === "seller" ? "Seller" : "Variety"}: ${value}`;
      const open = html.match(new RegExp(`<a [^>]*aria-label="${name}"[^>]*>`))?.[0] ?? "";
      expect(open, `${kind} remover link is missing`).not.toBe("");
      expect(open, `${kind} remover lost chip-removable`).toContain("chip-removable");
      const body = html.slice(html.indexOf(open) + open.length, html.indexOf("</a>", html.indexOf(open)));
      expect(body, `${kind} remover lost its drawn glyph`).toContain("<svg");
      expect(body, `${kind} remover regrew a text cross`).not.toContain(">×<");
    }
  });
});

describe("2.3 — ChipRemoveIcon (SPEC §4.4 family rules)", () => {
  it("draws a cross: 24px grid, stroke 1.8, currentColor, no fill, hidden", () => {
    const html = renderToStaticMarkup(createElement(ChipRemoveIcon, { className: "size-(--chip-removable-glyph-size)" }));
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="size-(--chip-removable-glyph-size)"');
    expect(html.match(/<path/g) ?? []).toHaveLength(2);
    expect(html).not.toContain(">×<");
  });
});

describe("2.3-E — crop rows (R-5: class-only migration, true not page)", () => {
  const CROP_PAGE = "app/crop/[slug]/page.tsx";

  it("carries chip-filter with aria-current true on the active option", () => {
    const src = readSource(CROP_PAGE);
    expect(src, "the crop chip renderer lost its filter class").toContain('className="chip-filter"');
    expect(src, "the crop rows still announce page").not.toContain('aria-current={active ? "page"');
    expect(src, "the crop rows still announce page").not.toContain('aria-current="page"');
    expect(src, "the crop rows lost their current marker").toContain('aria-current={active ? "true" : undefined}');
    expect(src, "selected utilities survive beside the class").not.toContain("border-leaf bg-leaf-50");
    expect(src, "the rows were rebuilt instead of migrated").toContain("const chip = (label: string, next: CropFilters, active: boolean) => (");
  });
});

describe("2.3 — RoleChip and the R-4 tag surfaces", () => {
  it("renders the admin tone and the plain reviewer tag on chip-tag", () => {
    const admin = renderToStaticMarkup(createElement(RoleChip, { role: "admin" }));
    expect(admin).toContain("chip-tag bg-leaf-50 font-semibold text-leaf");
    expect(admin).toContain(">Admin<");
    const reviewer = renderToStaticMarkup(createElement(RoleChip, { role: "reviewer" }));
    expect(reviewer).toContain('class="chip-tag"');
    expect(reviewer).toContain(">Reviewer<");
  });

  it("leaves the listing-detail status span a plain tag (44px to 32px, R-4)", () => {
    const src = readSource("app/admin/(protected)/listings/_components/listing-detail.tsx");
    expect(src, "the status span kept its height override").not.toContain("min-h-target");
    expect(src, "the status span is not a plain tag").toContain('className="chip-tag">{statusWordForListing(l)}');
  });

  it("leaves the account-list role labels plain tags (13px to 14px, R-4)", () => {
    const src = readSource("app/admin/(protected)/accounts/_components/account-list.tsx");
    for (const label of ["Admin", "Reviewer", "Farm owner"]) {
      expect(src, `${label} label is not a plain tag`).toContain(`<span className="chip-tag">${label}</span>`);
    }
  });
});

describe("2.3-F — scope guards (item 2.3 surfaces only)", () => {
  it("FilterStrip keeps only its shadow change: no chip, no sizing touch", () => {
    const src = readSource("components/ui/FilterStrip.tsx");
    expect(src, "the 2.1 shadow token left FilterStrip").toContain("shadow-strip-button");
    for (const chip of ["chip-filter", "chip-tag", "chip-removable"]) {
      expect(src, `${chip} leaked into FilterStrip`).not.toContain(chip);
    }
  });

  it("badges, pagination, breadcrumbs and the tab bar gain no chip class", () => {
    for (const file of [
      "components/seller/SmallFarmBadge.tsx",
      "components/ui/Pagination.tsx",
      "components/ui/Breadcrumbs.tsx",
      "components/variety/Availability.tsx",
    ]) {
      const src = readSource(file);
      for (const { literal } of classLiterals(src)) {
        for (const chip of ["chip-filter", "chip-tag", "chip-removable"]) {
          expect(literal.split(/\s+/), `${chip} leaked into ${file}`).not.toContain(chip);
        }
      }
    }
    const tabs = readSource("components/crop/GuideTabs.tsx");
    const tabButtons = jsxOpeners(tabs, "button");
    expect(tabButtons.length, "no tab buttons found").toBeGreaterThan(0);
    for (const attrs of tabButtons) {
      expect(attrs, "a hydrated tab button wears a chip class").not.toContain("chip-filter");
    }
  });
});
