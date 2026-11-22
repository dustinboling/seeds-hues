/**
 * Tranche 2.1 — Token consolidation (SPEC tranche-2 §2).
 *
 * Two gates, both required by the spec:
 *
 * 1. Token sync (§2.1.1): v2/design-tokens/tokens.json is the source of truth and
 *    the @theme blocks in v2/app/globals.css are kept in exact sync with it. Every
 *    token that declares a cssVariable must exist in @theme with the same value
 *    (aliases resolved), and every @theme variable must be claimed by a token. A
 *    token in only one of the two files is a failure. All expectations are derived
 *    from the two files at test time — no hardcoded counts or name sets.
 *
 * 2. Arbitrary-value lint (§2.1.5): walks v2/app, v2/components and v2/lib and
 *    fails on the owned families' literal spellings (radius, shadow, breakpoint,
 *    spacing and badge/chip color literals), on a bare `shadow` utility, and on
 *    the two promoted hexes outside tokens.json and the @theme block. Remaining
 *    arbitrary values must each match the explicit per-pattern allowlist below
 *    (spec §2.1.5 table, with same-reason entries for values the table implies).
 *
 * Both gates fail on pre-build code (the sync gate on @theme drift, the lint gate
 * on the banned literals) and pass after the item 2.1 migration.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

interface TokenEntry {
  path: string;
  value: unknown;
  cssVariable: string | null;
  frozen: boolean;
}

/** Collect every DTCG token (any object with $value) with its dotted path. */
function collectTokens(node: unknown, path: string, out: TokenEntry[]): void {
  if (!isRecord(node)) return;
  if ("$value" in node) {
    const ext = node["$extensions"];
    const seeds = isRecord(ext) && isRecord(ext["seeds-hues"]) ? ext["seeds-hues"] : null;
    const cssVariable = seeds?.["cssVariable"] ?? null;
    if (typeof cssVariable !== "string" && cssVariable !== null) {
      throw new Error(`Token ${path} has no usable cssVariable mapping`);
    }
    if (cssVariable === null && typeof seeds?.["reason"] !== "string") {
      throw new Error(`Token ${path} is documentation-only but states no reason`);
    }
    out.push({ path, value: node["$value"], cssVariable, frozen: seeds?.["frozen"] === true });
    return;
  }
  for (const key of Object.keys(node)) {
    if (key.startsWith("$")) continue;
    collectTokens(node[key], path === "" ? key : `${path}.${key}`, out);
  }
}

/** Resolve DTCG aliases ({a.b.c}) against the token map; walks nested objects. */
function resolveAliases(value: unknown, byPath: Map<string, TokenEntry>): unknown {
  if (typeof value === "string") {
    const alias = /^\{(.+)\}$/.exec(value.trim());
    if (!alias) return value;
    const target = alias[1];
    if (target === undefined) return value;
    const entry = byPath.get(target);
    if (!entry) throw new Error(`Alias ${value} points at no token`);
    return resolveAliases(entry.value, byPath);
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = resolveAliases(value[key], byPath);
    return out;
  }
  return value;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Parse every @theme block (including `@theme inline`) into variable -> value. */
function parseTheme(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const blocks = css.match(/@theme(?:\s+inline)?\s*\{[\s\S]*?\n\}/g) ?? [];
  for (const block of blocks) {
    const body = block.replace(/\/\*[\s\S]*?\*\//g, " ");
    const decls = body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g);
    for (const decl of decls) {
      const name = decl[1];
      const raw = decl[2];
      if (name === undefined || raw === undefined) continue;
      if (vars.has(name)) throw new Error(`@theme declares ${name} twice`);
      vars.set(name, normalize(raw));
    }
  }
  return vars;
}

describe("2.1-A — token sync (tokens.json vs @theme)", () => {
  const tokensJson = readFileSync(join(ROOT, "design-tokens/tokens.json"), "utf8");
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
  const entries: TokenEntry[] = [];
  collectTokens(JSON.parse(tokensJson) as unknown, "", entries);
  const byPath = new Map<string, TokenEntry>(entries.map((e): [string, TokenEntry] => [e.path, e]));
  const theme = parseTheme(css);

  it("holds at least one token and one @theme variable (the sync is not vacuous)", () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(theme.size).toBeGreaterThan(0);
  });

  it("matches every mapped token value against @theme (aliases resolved)", () => {
    const mapped = entries.filter((e) => e.cssVariable !== null);
    expect(mapped.length).toBeGreaterThan(0);
    for (const entry of mapped) {
      const variable = entry.cssVariable;
      if (variable === null) continue;
      const themed = theme.get(variable);
      expect(themed, `token ${entry.path} -> ${variable} is missing from @theme`).toBeDefined();
      if (themed === undefined) continue;
      const resolved = resolveAliases(entry.value, byPath);
      expect(typeof resolved, `token ${entry.path} resolves to a non-string`).toBe("string");
      if (typeof resolved !== "string") continue;
      expect(normalize(resolved), `token ${entry.path} drifts from ${variable}`).toBe(themed);
    }
  });

  it("claims every @theme variable from exactly one token (no orphaned variables)", () => {
    const claimants = new Map<string, string[]>();
    for (const entry of entries) {
      if (entry.cssVariable === null) continue;
      const list = claimants.get(entry.cssVariable) ?? [];
      list.push(entry.path);
      claimants.set(entry.cssVariable, list);
    }
    for (const name of theme.keys()) {
      const paths = claimants.get(name) ?? [];
      expect(paths, `@theme variable ${name} is claimed by no token`).not.toHaveLength(0);
      expect(paths, `@theme variable ${name} is claimed twice`).toHaveLength(1);
    }
  });

  it("resolves every documentation-only token alias to a real token", () => {
    const documented = entries.filter((e) => e.cssVariable === null);
    expect(documented.length).toBeGreaterThan(0);
    for (const entry of documented) {
      expect(() => resolveAliases(entry.value, byPath), `token ${entry.path} has a dangling alias`).not.toThrow();
    }
  });

  it("keeps frozen tokens literal with the retired 151/134/95 RGB (never re-derived)", () => {
    const frozen = entries.filter((e) => e.frozen);
    expect(frozen.length).toBeGreaterThan(0);
    for (const entry of frozen) {
      expect(typeof entry.value, `frozen token ${entry.path} must be a literal`).toBe("string");
      if (typeof entry.value !== "string") continue;
      expect(entry.value.trim().startsWith("{"), `frozen token ${entry.path} must not alias line-strong`).toBe(false);
      expect(entry.value, `frozen token ${entry.path} lost the 151/134/95 RGB`).toContain("151 134 95");
    }
  });

  it("defines no --radius-full in @theme (Tailwind's built-in rounded-full is the rendered pill radius)", () => {
    expect(theme.has("--radius-full")).toBe(false);
  });
});

describe("2.1-B — arbitrary-value lint", () => {
  const files = WALK_ROOTS.flatMap((root) => walk(root));
  const contents = new Map<string, string>(files.map((f): [string, string] => [f, readFileSync(join(ROOT, f), "utf8")]));

  // Owned families' literal spellings. The spec's ban list (rounded-[, shadow-[,
  // shadow-xl, shadow-lg, bare shadow, min-[744px], min-[1181px], border-[#,
  // bg-[#) plus the other literals the §2.1.5 table tokenizes: each names a token
  // now, so any remaining literal is drift.
  const BANNED = [
    "rounded-[",
    "shadow-[",
    "shadow-xl",
    "shadow-lg",
    "min-[744px]",
    "min-[1181px]",
    "min-[1024px]",
    "border-[#",
    "bg-[#",
    "pt-[18px]",
    "px-[18px]",
    "mt-[3px]",
    "mt-[9px]",
    "mt-[5px]",
    "min-h-[44px]",
    "min-w-[44px]",
    "border-[1.5px]",
    "border-[rgba(151,134,95,0.45)]",
  ] as const;

  it("finds zero banned literals across app, components and lib", () => {
    for (const [file, content] of contents) {
      for (const literal of BANNED) {
        expect(content, `${file} still contains the banned literal ${literal}`).not.toContain(literal);
      }
    }
  });

  it("keeps the promoted hexes out of sources (tokens.json and @theme only)", () => {
    for (const [file, content] of contents) {
      // globals.css holds the hexes inside its @theme block by design; every
      // other occurrence in any walked file is a literal that escaped promotion.
      const scoped = file === join("app", "globals.css") ? content.replace(/@theme(?:\s+inline)?\s*\{[\s\S]*?\n\}/g, " ") : content;
      expect(scoped.toLowerCase(), `${file} still carries a promoted hex literal`).not.toContain("e9dfc2");
      expect(scoped.toLowerCase(), `${file} still carries a promoted hex literal`).not.toContain("dfe9d6");
    }
    const tokensJson = readFileSync(join(ROOT, "design-tokens/tokens.json"), "utf8");
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    for (const hex of ["#E9DFC2", "#DFE9D6"]) {
      expect(tokensJson, `tokens.json no longer promotes ${hex}`).toContain(hex);
      expect(css, `@theme no longer carries ${hex}`).toContain(hex);
    }
  });

  it("finds no bare `shadow` utility (comments excluded)", () => {
    for (const [file, content] of contents) {
      const code = content
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|\s)\/\/[^\r\n]*/g, "$1 ");
      const bare = /(^|[\s"'`({])shadow([\s"'`)};]|$)/.exec(code);
      expect(bare?.[0], `${file} still uses a bare shadow utility`).toBeUndefined();
    }
  });

  // Explicit per-pattern exemptions (spec §2.1.5 allowlist). Every remaining
  // arbitrary value must match one entry; anything else fails as unowned drift.
  // Each entry carries the spec reason it stays literal.
  const ALLOWLIST: { pattern: RegExp; reason: string }[] = [
    { pattern: /^(text|leading|tracking|decoration|underline-offset)-\[/, reason: "Thea's type scale, not tokenized here" },
    { pattern: /^grid-cols-\[/, reason: "Single-use page layout template, no cross-page reuse" },
    { pattern: /^(max-w|min-w|w)-\[/, reason: "Single-surface content measure or layout width tied to its artwork or column" },
    { pattern: /^(max-h|h)-\[/, reason: "Viewport-relative or artwork-tied height, not a scale step" },
    { pattern: /^min-h-\[(?!44px\])/, reason: "Non-target component height (widget reserve, textarea, chip override, skeleton)" },
    { pattern: /^aspect-\[/, reason: "Plate proportion, specified in the art direction" },
    { pattern: /^(align-\[1px\]|size-\[3px\])$/, reason: "Single-component optical value with no second consumer" },
    // (The SmallFarmBadge exemption lived here until item 2.2 tokenized those four
    // literals as component tokens; the exemption is gone with the literals.)
    { pattern: /^border-b-\[3px\]$/, reason: "GuideTabs active-tab indicator; fits no §2.1.5 row, left literal by the value-preserving rule" },
    {
      pattern: /^(\[-webkit-overflow-scrolling:touch\]|\[scrollbar-width:none\]|\[&::-webkit-scrollbar\]|has-\[:(checked|focus-visible)\])$/,
      reason: "CSS property setting or state query, not a design value",
    },
  ];

  it("matches every remaining arbitrary value against the allowlist", () => {
    const prefixed = /[A-Za-z][A-Za-z0-9-]*-\[[^\]\r\n"'`]*\]/g;
    // Bare property arbitraries only ([prop:value], [&selector]): the &/name:
    // requirement keeps JS noise (array literals, regex classes, selector
    // strings) out of the scan.
    const bare = /\[(?:&|[A-Za-z-][A-Za-z0-9-]*:)[^\]\r\n]*\]/g;
    const offenders: string[] = [];
    for (const [file, content] of contents) {
      const tokens = [...content.matchAll(prefixed), ...content.matchAll(bare)];
      for (const token of tokens) {
        const text = token[0];
        if (text === undefined) continue;
        if (!ALLOWLIST.some((entry) => entry.pattern.test(text))) {
          offenders.push(`${file}: ${text} (no allowlist entry)`);
        }
      }
    }
    const exemptions = ALLOWLIST.map((entry) => `${String(entry.pattern)} — ${entry.reason}`).join("\n");
    expect(offenders, `unowned arbitrary values:\n${offenders.join("\n")}\nAllowlist:\n${exemptions}`).toHaveLength(0);
  });
});
