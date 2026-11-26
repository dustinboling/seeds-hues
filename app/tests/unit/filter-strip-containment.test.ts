/**
 * Filter-strip root containment (preview visual fix repair, Quinn gate F1
 * recurrence guard): the strip's screen-reader-only count spans are
 * absolutely positioned, and their containing block used to be the
 * `.filter-strip` wrapper OUTSIDE the `overflow-x: auto` scroller — so the
 * scroller never clipped them and their boxes, sitting at static positions
 * deep in the scrolled-out region, inflated the document's scrollable
 * overflow on every strip-carrying route (+1255 on /variety at 390px).
 * The fix establishes the containing block INSIDE the scroller, so the
 * scroller clips them; the in-flow chips were always clipped. jsdom has no
 * layout engine, so this guard is structural: it asserts the containment
 * declarations are present in the shipped CSS, plus preservation
 * assertions pinning what the fix must not change (the strip still
 * scrolls, never wraps; the shop footer stays side-by-side where it
 * fits). The containment assertions fail on the pre-fix tree.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "node_modules") walk(path, exts, out);
    } else if (exts.some((ext) => path.endsWith(ext))) {
      out.push(path);
    }
  }
  return out;
}

/** All shipped stylesheets, comments stripped (same strip as css-coverage). */
function shippedCss(): string {
  const files = [...walk(join(APP_ROOT, "src"), [".css"]), ...walk(join(APP_ROOT, "pages"), [".css"])];
  expect(files.length).toBeGreaterThan(0);
  return files.map((file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
}

/** Declaration text of every top-level `selector { ... }` block (exact selector). */
function ruleBlocks(css: string, selector: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    // The regex requires `{` right after the selector (modulo whitespace),
    // so longer selectors (.filter-strip-list::-webkit-scrollbar) never match.
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push(css.slice(match.index + match[0].length, i - 1));
  }
  return blocks;
}

/** Every @media block as {query, body}, braces balanced. */
function mediaBlocks(css: string): Array<{ query: string; body: string }> {
  const blocks: Array<{ query: string; body: string }> = [];
  const re = /@media\s*([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const query = match[1];
    if (query === undefined) continue;
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push({ query: query.trim(), body: css.slice(match.index + match[0].length, i - 1) });
  }
  return blocks;
}

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of block.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    map.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim().toLowerCase());
  }
  return map;
}

describe("filter-strip root containment", () => {
  it("establishes the strip scroller as the containing block for its absolutely positioned content", () => {
    const blocks = ruleBlocks(shippedCss(), ".filter-strip-list");
    expect(blocks.length).toBeGreaterThan(0);
    const containing = blocks.some((block) => {
      const decls = declarations(block);
      const position = decls.get("position") ?? "";
      // Any position other than static establishes a containing block for
      // abspos descendants; relative (no offsets) is the layout-neutral one.
      // Layout/paint/style containment does the same (contain: layout and up).
      if (position === "relative" || position === "sticky") return true;
      const contain = decls.get("contain") ?? "";
      return ["layout", "paint", "strict", "content"].some((kind) => contain.split(/\s+/).includes(kind));
    });
    expect(
      containing,
      ".filter-strip-list must establish a containing block (position: relative, or contain: layout and up) " +
        "so the scroller clips its sr-only spans instead of leaking them to the root",
    ).toBe(true);
  });

  it("keeps the strip an internally scrolling, never-wrapping row", () => {
    const blocks = ruleBlocks(shippedCss(), ".filter-strip-list");
    expect(blocks.length).toBeGreaterThan(0);
    const decls = declarations(blocks.join(";"));
    // A "fix" that clips the strip's content, wraps it, or stops it
    // scrolling is a v2-parity failure, not a fix.
    expect(["auto", "scroll"], ".filter-strip-list keeps its own horizontal scroll").toContain(decls.get("overflow-x"));
    expect(decls.get("flex-wrap"), ".filter-strip-list never wraps").toBe("nowrap");
    expect(decls.get("display"), ".filter-strip-list stays a flex row").toBe("flex");
  });

  it("stacks the shop-card footer below the width where report + pill fit side by side", () => {
    const css = shippedCss();
    const narrow = mediaBlocks(css).filter(({ query }) => /max-width\s*:\s*[\d.]+px/.test(query));
    const stacking = narrow.filter(({ body }) => {
      const blocks = ruleBlocks(body, ".shop-card-footer");
      return blocks.some((block) => declarations(block).get("flex-direction") === "column");
    });
    expect(
      stacking.length,
      "a narrow max-width media query must stack .shop-card-footer (flex-direction: column): " +
        "at 390px the report link's min-content + gap + shrink-0 pill overflows the card and the viewport",
    ).toBeGreaterThan(0);
    // Surgical scope: the stack rule must only cover narrow viewports, where
    // the 2-column card cannot fit the footer — never tablet/desktop, where
    // v2's side-by-side geometry fits and must stay byte-identical.
    for (const { query } of stacking) {
      const px = Number(query.match(/max-width\s*:\s*([\d.]+)px/)?.[1]);
      expect(px, `${query} stays below the sm breakpoint`).toBeLessThan(640);
    }
  });

  it("keeps the shop-card footer side by side where it fits", () => {
    const blocks = ruleBlocks(shippedCss(), ".shop-card-footer");
    expect(blocks.length).toBeGreaterThan(0);
    const decls = declarations(blocks.join(";"));
    expect(decls.get("display"), ".shop-card-footer stays a flex row").toBe("flex");
    expect(decls.get("justify-content"), ".shop-card-footer keeps v2's spread").toBe("space-between");
  });
});
