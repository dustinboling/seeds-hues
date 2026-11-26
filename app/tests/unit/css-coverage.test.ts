/**
 * CSS coverage (preview visual fix, root cause C recurrence guard): every
 * class token used in a `className` in `src/` or `pages/` must have a
 * matching selector in the app's CSS, unless explicitly allowlisted as a
 * state/hook class. Extraction is syntactic (TypeScript AST over the JSX),
 * so string literals that merely sit near a className — error keys like
 * `v("about")`, comparisons like `choice === "gardener"` — are never
 * mistaken for classes. Only string literals in class-yielding positions
 * count: the attribute string itself, template static text, ternary
 * branches, && / || / ?? operands, and array elements.
 *
 * Opaque dynamics (map-driven tones, size unions, helper-passed rows) never
 * appear as literals, so they are asserted separately in DYNAMIC_FAMILIES:
 * each family names the exact classes its source can yield, cites the
 * source, and carries a drift marker proving the source still owns them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * State/hook classes: intentionally unstyled. Each entry is justified in
 * one line; the test fails on stale entries (unused, or styled after all).
 */
const ALLOWLIST: Record<string, string> = {
  // No intentional state/hook classes on this tree: every class token the
  // port introduced is a styled semantic class. Entries land here only with
  // a one-line justification each (see the record type above).
};

/** Opaque class dynamics: exact expansions each source can yield. */
const DYNAMIC_FAMILIES: Array<{
  classes: string[];
  source: string;
  marker: string;
  note: string;
}> = [
  {
    classes: ["swatch", "swatch-sm", "swatch-md", "swatch-lg"],
    source: "src/components/variety/Swatch.tsx",
    marker: "swatch swatch-${size}",
    note: "Swatch frame: `swatch swatch-${size}`, size sm | md | lg.",
  },
  {
    classes: [
      "badge-in-stock",
      "badge-sold-out",
      "badge-preorder",
      "badge-shop-closed",
      "badge-unknown",
    ],
    source: "src/components/AvailabilityBadge.tsx",
    marker: "TONE[value]",
    note: "AvailabilityBadge TONE map values over ApiAvailability.",
  },
  {
    classes: [
      "status-dot-in-stock",
      "status-word-in-stock",
      "status-dot-sold-out",
      "status-word-sold-out",
      "status-dot-preorder",
      "status-word-preorder",
      "status-dot-shop-closed",
      "status-word-shop-closed",
      "status-dot-unknown",
      "status-word-unknown",
    ],
    source: "src/components/variety/ListingRow.tsx",
    marker: "STATUS_TONE",
    note: "STATUS_TONE dot/word values shared by ListingRow and VarietyCard.",
  },
  {
    classes: ["badge-small-farm-standard", "badge-small-farm-large"],
    source: "src/components/seller/SmallFarmBadge.tsx",
    marker: "badge-small-farm-${size}",
    note: "SmallFarmBadge size union: standard | large.",
  },
  {
    classes: ["contact-row-first", "contact-row-first-tight"],
    source: "src/components/seller/SellerContactBlock.tsx",
    marker: "firstRowMargin",
    note: "SellerContactBlock first-row margin variants.",
  },
  {
    classes: ["imported-stars-base", "imported-stars-value"],
    source: "src/components/seller/ImportedRatingPanel.tsx",
    marker: "row(",
    note: "ImportedRatingPanel star-row helper arguments.",
  },
];

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

/** Split literal text into candidate tokens; interpolation fragments never qualify. */
function tokensOf(text: string, push: (token: string) => void): void {
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) continue;
    if (token.startsWith("-") || token.endsWith("-")) continue;
    push(token);
  }
}

/** String literals in class-yielding positions; calls/accesses/comparisons are opaque. */
function collectDynamic(node: ts.Node, push: (token: string) => void): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    tokensOf(node.text, push);
  } else if (ts.isTemplateExpression(node)) {
    tokensOf(node.head.text, push);
    for (const span of node.templateSpans) {
      collectDynamic(span.expression, push);
      tokensOf(span.literal.text, push);
    }
  } else if (ts.isConditionalExpression(node)) {
    collectDynamic(node.whenTrue, push);
    collectDynamic(node.whenFalse, push);
  } else if (ts.isParenthesizedExpression(node)) {
    collectDynamic(node.expression, push);
  } else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) {
    collectDynamic(node.expression, push);
  } else if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    collectDynamic(node.left, push);
    collectDynamic(node.right, push);
  } else if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectDynamic(element, push);
  }
  // Anything else (identifiers, property/element access, calls, comparisons)
  // is opaque by design — see DYNAMIC_FAMILIES for the audited dynamics.
}

function usedClasses(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const push = (file: string) => (token: string) => {
    const list = used.get(token) ?? [];
    if (!list.includes(file)) list.push(file);
    used.set(token, list);
  };
  const files = [...walk(join(APP_ROOT, "src"), [".ts", ".tsx"]), ...walk(join(APP_ROOT, "pages"), [".ts", ".tsx"])];
  for (const file of files) {
    const rel = relative(APP_ROOT, file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className" && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          tokensOf(node.initializer.text, push(rel));
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          collectDynamic(node.initializer.expression, push(rel));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return used;
}

function cssSelectors(): Set<string> {
  const selectors = new Set<string>();
  const files = [...walk(join(APP_ROOT, "src"), [".css"]), ...walk(join(APP_ROOT, "pages"), [".css"])];
  for (const file of files) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)) {
      const name = match[1];
      if (name !== undefined) selectors.add(name);
    }
  }
  return selectors;
}

describe("css coverage", () => {
  it("styles every class token used in src/ and pages/", () => {
    const used = usedClasses();
    const selectors = cssSelectors();
    expect(used.size).toBeGreaterThan(100);
    expect(selectors.size).toBeGreaterThan(100);
    const missing = [...used.entries()]
      .filter(([token]) => !selectors.has(token) && !(token in ALLOWLIST))
      .map(([token, files]) => `${token} (${files.slice(0, 3).join(", ")})`)
      .sort();
    expect(missing, `unstyled classes:\n${missing.join("\n")}`).toEqual([]);
  });

  it("keeps the state/hook allowlist exact", () => {
    const used = usedClasses();
    const selectors = cssSelectors();
    for (const [token, why] of Object.entries(ALLOWLIST)) {
      expect(why.trim().length > 0, `${token} carries a justification`).toBe(true);
      expect(used.has(token), `${token} is still used`).toBe(true);
      expect(selectors.has(token), `${token} is still unstyled`).toBe(false);
    }
  });

  it("styles every opaque dynamic family", () => {
    const selectors = cssSelectors();
    for (const family of DYNAMIC_FAMILIES) {
      const source = readFileSync(join(APP_ROOT, family.source), "utf8");
      expect(source.includes(family.marker), `${family.source} still owns ${family.marker}`).toBe(true);
      for (const token of family.classes) {
        expect(selectors.has(token), `${token} (${family.note})`).toBe(true);
      }
    }
  });
});
