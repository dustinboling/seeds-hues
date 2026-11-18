/**
 * Portability + policy guardrails (spec §3.4, FINAL X1/X3/X9/§1.1). Grep-level checks over the
 * source tree so a violation fails `npm run verify`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANY_NAME_EXCLUSION_PATTERN } from "@/lib/catalog/assertions";
import { POD_ART_BY_PLANT } from "@/lib/data/pod-ornaments";

const ROOT = process.cwd();
const SELF = "tests/unit/guardrails.test.ts";

function walk(dir: string, exts = /\.(ts|tsx|js|mjs|css)$/): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    const st = statSync(join(ROOT, p));
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

const RUNTIME = ["app", "components", "lib"].flatMap((d) => walk(d));
const ALL = [...RUNTIME, ...walk("scripts"), ...walk("tests")].filter((f) => f !== SELF);
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function offenders(files: string[], re: RegExp, allow: string[] = [], code = true): string[] {
  return files.filter((f) => !allow.includes(f) && re.test(code ? stripComments(read(f)) : read(f))).map((f) => relative(".", f));
}

describe("portability guardrails (§3.4)", () => {
  it("env.DB is read only in lib/db/client.ts", () => {
    expect(offenders(RUNTIME, /\benv\.DB\b/, ["lib/db/client.ts"])).toEqual([]);
  });

  it("db.batch() appears only inside atomic()", () => {
    expect(offenders(ALL, /\.batch\(/, ["lib/repositories/atomic.ts"])).toEqual([]);
  });

  it("FTS SQL (MATCH / bm25 / varieties_fts) lives only in lib/repositories/fts.ts", () => {
    expect(offenders(RUNTIME, /\bMATCH\b|bm25\(|varieties_fts/, ["lib/repositories/fts.ts"])).toEqual([]);
  });

  it("raw SQL execution (db.run / db.all / sql.raw / prepare) only in the FTS module or schema DDL", () => {
    expect(offenders(RUNTIME, /\bdb\.(run|all|get|values)\(|\.prepare\(/, ["lib/repositories/fts.ts"])).toEqual([]);
    expect(offenders(RUNTIME, /sql\.raw\(/, ["lib/db/schema.ts"])).toEqual([]);
  });

  it("only lib/db and lib/repositories import Drizzle", () => {
    const bad = RUNTIME.filter((f) => !f.startsWith("lib/db/") && !f.startsWith("lib/repositories/")).filter((f) =>
      /from "drizzle-orm/.test(read(f)),
    );
    expect(bad).toEqual([]);
  });

  it("pages and components never import repositories or the DB directly", () => {
    const ui = RUNTIME.filter((f) => f.startsWith("app/") || f.startsWith("components/"));
    expect(offenders(ui, /from "@\/lib\/(repositories|db)\//)).toEqual([]);
  });

  it("no hand-written AUTOINCREMENT and no PRAGMA in app code", () => {
    expect(offenders(RUNTIME, /AUTOINCREMENT|PRAGMA/i)).toEqual([]);
    const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql"));
    for (const m of migrations) expect(read(join("migrations", m))).not.toMatch(/AUTOINCREMENT/i);
  });

  it("Worker code imports no Node built-ins", () => {
    expect(offenders(RUNTIME, /from "(node:[a-z_/]+|fs|path|net|child_process|os|crypto|zlib)"/)).toEqual([]);
  });

  it("prices are never floats (no parseFloat / toFixed on the money path)", () => {
    expect(offenders(RUNTIME, /parseFloat\(|\.toFixed\(/)).toEqual([]);
  });
});

describe("prices are stored, never shown (R1)", () => {
  // Storage, the importer, the snapshot allowlist and the DB schema may name price columns;
  // nothing on the path to a page, JSON-LD block or public API payload may.
  const STORAGE = ["lib/db/schema.ts", "lib/catalog/importer.ts", "lib/catalog/input.ts", "lib/catalog/assertions.ts", "lib/repositories/catalog-write.ts", "lib/repositories/snapshot-allowlist.ts", "lib/repositories/snapshot.ts"];
  // jsonld.ts names "price"/"lowPrice" only in its PROHIBITED list (checked by the R4 guard test).
  const PUBLIC_PATH = RUNTIME.filter((f) => !STORAGE.includes(f) && f !== "lib/seo/jsonld.ts");

  it("no page, component, serializer, validator, SEO builder or read repository references a price field", () => {
    expect(offenders(PUBLIC_PATH, /priceCents|priceSource|priceCheckDate|price_cents|price_source|price_check_date|formatPrice|fromPrice|lowPrice/)).toEqual([]);
  });

  it("the scanner is not vacuous (storage still has price columns)", () => {
    expect(offenders(["lib/db/schema.ts"], /priceCents/)).toHaveLength(1);
  });

  it("price sorts are gone from the API", () => {
    expect(offenders(RUNTIME, /price-asc|price-desc/)).toEqual([]);
  });

  it("shop buttons go through /go/{listing_id}; no page links straight to a productUrl", () => {
    expect(read("components/variety/ListingRow.tsx")).toMatch(/href=\{`\/go\/\$\{l\.id\}`\}/);
    expect(read("components/variety/ListingRow.tsx")).toMatch(/rel="nofollow noopener noreferrer"/);
    const ui = RUNTIME.filter((f) => f.startsWith("app/") || f.startsWith("components/"));
    expect(offenders(ui, /href=\{[^}]*productUrl/)).toEqual([]);
  });
});

describe("policy guardrails", () => {
  it("scanners are not vacuous (they do see the allow-listed files)", () => {
    expect(offenders(["lib/catalog/assertions.ts"], COMPANY_NAME_EXCLUSION_PATTERN)).toHaveLength(1);
    expect(offenders(["lib/repositories/atomic.ts"], /\.batch\(/)).toHaveLength(1);
    expect(offenders(["lib/db/client.ts"], /\benv\.DB\b/)).toHaveLength(1);
  });
  it("no large seed company names outside comments and the exclusion list", () => {
    const allow = ["lib/catalog/assertions.ts"];
    expect(offenders(ALL, COMPANY_NAME_EXCLUSION_PATTERN, allow)).toEqual([]);
  });

  it("no Product / Offer / AggregateRating / FAQPage / Review / priceValidUntil outside the prohibition list (R4)", () => {
    expect(
      offenders(RUNTIME, /AggregateRating|AggregateOffer|FAQPage|priceValidUntil|"Review"|"Product"|"Offer"/, ["lib/seo/jsonld.ts"]),
    ).toEqual([]);
  });

  // Media delta (2026-11-16): the rule is no seller photos and no hotlinked images. The only raster
  // images are own-work illustrations from the media table, served from this app's /artwork/ assets.
  // Plant-media delta: the crop card thumbnail joins the variety/crop hero as the second allowed file.
  // Theme delta: the decorative theme illustrations (components/ui/ThemeArt.tsx) are the third; their
  // srcs are a fixed table of this app's own /theme/ assets (checked below), never a media row.
  // Variety-card delta: the variety card image is the fourth; its src is the media row's local
  // /artwork/ path rewritten to the /artwork/w480/ copy (or the stored path for other media).
  // Pod-ornament delta: decorative seed-pod art from this app's own /ornaments/ assets.
  it("no hotlinked images, no remote image config (local /artwork/, /theme/, /brand/ and /ornaments/ assets allowed)", () => {
    const ui = RUNTIME.filter((f) => /\.(tsx|css)$/.test(f));
    // A remote or protocol-relative src on an <img>, as a string, expression or template literal.
    expect(offenders(ui, /<img\b[^>]*\bsrc=\{?\s*["'`](https?:)?\/\//)).toEqual([]);
    // Remote CSS backgrounds.
    expect(offenders(ui, /url\(\s*["']?(https?:)?\/\//)).toEqual([]);
    // No remote next/image configuration.
    expect(read("next.config.ts")).not.toMatch(/remotePatterns|domains:|images\s*:/);
    // <img> renders only in the explicitly named media components, each taking its src from the
    // media row's local /artwork/ path (the crop card prefers the computed /artwork/crops/thumbs/ url).
    // Each entry lists the file's allowed srcs: the file has exactly that many <img> and src=.
    const IMG_FILES: Record<string, readonly RegExp[]> = {
      "components/variety/VarietyHeroImage.tsx": [/src=\{media\.url\}/],
      "components/crop/CropCardImage.tsx": [/src=\{m\.thumbUrl \?\? m\.url\}/],
      // Pod-ornament delta: without media, the card placeholder shows the crop's decorative pod
      // motif (lib/data/pod-ornaments.ts, this app's own /ornaments/ assets).
      "components/variety/VarietyCardImage.tsx": [/src=\{cardSrc\}/, /src=\{motif\}/],
      "components/ui/ThemeArt.tsx": [/src=\{art\.src\}/],
      // Branding delta: the Hues wordmark renders only in components/layout/HuesLogo.tsx, from
      // this app's own /brand/ asset (the owner's master artwork, self-hosted).
      "components/layout/HuesLogo.tsx": [/src="\/brand\/hues-logo\.svg"/],
      // State-hero delta: the state page's scene painting, from this app's own
      // /theme/state-scenes/{slug}.webp asset (lib/data/state-scenes.ts).
      "app/state/[slug]/page.tsx": [/src=\{`\/theme\/state-scenes\/\$\{st\.slug\}\.webp`\}/],
      // Pod-ornament delta: the decorative seed-pod divider and the crop header motif, both from
      // this app's own /ornaments/ assets (lib/data/pod-ornaments.ts). The footer has no motif.
      "components/ui/PodDivider.tsx": [/src=\{bundle\}/],
      "app/crop/[slug]/page.tsx": [/src=\{pod\.motif\}/],
    };
    const allowed = Object.keys(IMG_FILES);
    expect(offenders(ui, /<img\b/, allowed)).toEqual([]);
    for (const [file, srcs] of Object.entries(IMG_FILES)) {
      const code = stripComments(read(file));
      for (const src of srcs) expect(code, file).toMatch(src);
      // One <img> per allowed src, and those srcs are the only ones in that file.
      expect(code.match(/<img\b/g) ?? [], file).toHaveLength(srcs.length);
      expect(code.match(/\bsrc=/g) ?? [], file).toHaveLength(srcs.length);
    }
    // The scanner is not vacuous: it sees every allowed <img>.
    expect(offenders(allowed, /<img\b/)).toHaveLength(allowed.length);
    // Every path in the theme art table is a local /theme/ asset (no remote or protocol-relative URL).
    const themeArt = stripComments(read("components/ui/ThemeArt.tsx"));
    const themePaths = [...themeArt.matchAll(/\b(?:src|wide):\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(themePaths.length).toBeGreaterThan(0);
    for (const p of themePaths) expect(p).toMatch(/^\/theme\/[a-z0-9-]+\.webp$/);
    // The brand wordmark is exactly one local /brand/ asset.
    const brandLogo = stripComments(read("components/layout/HuesLogo.tsx"));
    const brandPaths = [...brandLogo.matchAll(/\bsrc="([^"]+)"/g)].map((m) => m[1]);
    expect(brandPaths).toEqual(["/brand/hues-logo.svg"]);
    // Every pod ornament is a local /ornaments/ asset that exists in public/.
    const podPaths = Object.values(POD_ART_BY_PLANT).flatMap((a) => [a.motif, a.bundle]);
    expect(podPaths.length).toBeGreaterThan(0);
    for (const p of podPaths) {
      expect(p).toMatch(/^\/ornaments\/(?:motif|bundle)-[a-z0-9-]+\.webp$/);
      expect(existsSync(join(ROOT, "public", p)), p).toBe(true);
    }
  });

  it("no wildcard CORS, no next-pwa", () => {
    expect(offenders(RUNTIME, /Allow-Origin["']?\s*[:,]\s*["']\*["']/)).toEqual([]);
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain("next-pwa");
  });

  it("dependency versions are exact pins", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.dependencies.next).toMatch(/^16\.4\./);
    expect(pkg.dependencies.react).toMatch(/^19\.3\./);
  });

  it("no checkout / cart / payment code paths", () => {
    expect(RUNTIME.filter((f) => /(^|\/)(checkout|cart|payments?|orders?)(\/|$)/.test(f))).toEqual([]);
    expect(offenders(RUNTIME, /stripe|paypal|add to cart/i)).toEqual([]);
  });
});
