/**
 * Slice 2 surface contract (the F5 cure's teeth): builds the real app once
 * and asserts the built output contains every deliverable — each route's
 * complete primary content markers, the generated machine files with Bea's
 * rules, robots byte parity, and og separation on every template. This test
 * fails on any tree where the surface does not exist (it failed on both
 * prior PRs' trees by construction: no routes, no files, no markers).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { LastmodCache, SyncSnapshotData } from "../../src/data/types";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DIST = `${APP_ROOT}/dist/client`;
const SITE = "https://seeds.hues.flowers";
const API = "https://seeds.hues.flowers/api/v1";

const read = (rel: string): string => {
  expect(existsSync(`${DIST}/${rel}`), `${rel} emitted`).toBe(true);
  return readFileSync(`${DIST}/${rel}`, "utf8");
};

/**
 * React escapes ' as &#x27; etc. and separates expressions with <!-- -->:
 * decode and strip before asserting on page TEXT.
 */
const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const meta = (html: string, attr: string, name: string): string | null => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1]! : null;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "seeds-hues-app-tests/0.1" } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Live-data reads, fetched once and shared by the live-equality assertions.
let snapshot: SyncSnapshotData;
let liveSitemap: string;
let cropsTotal = 0;
let firstCrops: { slug: string; commonName: string }[] = [];
let openapiPaths: string[] = [];
let recentFirstVariety = "";
let coverageWithSellers = 0;
let varietiesTotal = 0;
let sellersTotal = 0;

beforeAll(async () => {
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: APP_ROOT,
      stdio: "pipe",
      timeout: 280_000,
      env: { ...process.env, NODE_ENV: "production", FORCE_COLOR: "0" },
    });
  } catch (error) {
    const failed = error as { stdout?: Buffer; stderr?: Buffer };
    const output = [failed.stdout?.toString(), failed.stderr?.toString()]
      .filter((part) => part && part.length > 0)
      .join("\n");
    throw new Error(`npm run build failed:\n${output || String(error)}`);
  }
  const [snap, sitemapText, crops, openapi, recent, varieties, sellers, coverage] = await Promise.all([
    getJson<SyncSnapshotData>(`${API}/sync/snapshot`),
    fetch(`${SITE}/sitemap.xml`).then((r) => {
      if (!r.ok) throw new Error(`GET /sitemap.xml -> HTTP ${r.status}`);
      return r.text();
    }),
    getJson<{ data: { slug: string; commonName: string }[]; meta: { total?: number } }>(`${API}/crops?limit=100`),
    getJson<{ paths: Record<string, unknown> }>(`${API}/openapi.json`),
    getJson<{ data: { listing: { variety: { varietyName: string } } }[] }>(`${API}/recent?limit=6`),
    getJson<{ meta: { total?: number } }>(`${API}/varieties?limit=1`),
    getJson<{ meta: { total?: number } }>(`${API}/sellers?limit=1`),
    getJson<{ data: { varieties_with_sellers: number }[] }>(`${API}/coverage`),
  ]);
  snapshot = snap;
  liveSitemap = sitemapText;
  cropsTotal = crops.meta.total ?? crops.data.length;
  firstCrops = crops.data.slice(0, 3);
  openapiPaths = Object.keys(openapi.paths);
  recentFirstVariety = recent.data[0]?.listing.variety.varietyName ?? "";
  coverageWithSellers = coverage.data.reduce((n, c) => n + c.varieties_with_sellers, 0);
  varietiesTotal = varieties.meta.total ?? 0;
  sellersTotal = sellers.meta.total ?? 0;
}, 290_000);

describe("Slice 2 built surface", () => {
  describe("static set (deliverable 1)", () => {
    it("/about keeps its gated content", () => {
      const text = decodeHtml(read("about/index.html"));
      expect(text).toContain("About seeds.hues.flowers");
      expect(text).toContain("honored within 48 hours");
    });

    it("/about/data ships complete primary content", () => {
      const html = read("about/data/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("About the data");
      expect(text).toContain("How data is collected");
      expect(text).toContain("We honor removal requests within 48 hours");
      expect(text).toContain("Small farm badge");
      expect(text).toContain("HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)");
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/about/data"');
      expect(html).toContain("<title>About the data | seeds.hues.flowers</title>");
    });

    it("/about/bot ships complete primary content", () => {
      const html = read("about/bot/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("Our crawler");
      expect(text).toContain("honoring any Crawl-delay");
      expect(text).toContain("Removal requests are honored within 48 hours");
      expect(text).toContain("Rate limits");
      expect(text).toContain("HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)");
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/about/bot"');
      expect(html).toContain("<title>Our crawler (HuesSeedFinderBot) | seeds.hues.flowers</title>");
    });

    it("/api-docs renders the contract facts plus the live endpoint inventory", () => {
      const html = read("api-docs/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("Public API v1");
      expect(text).toContain("Base URL");
      expect(text).toContain("https://seeds.hues.flowers/api/v1");
      expect(text).toContain("OpenAPI 3.1 document (openapi.json)");
      expect(text).toContain("120 requests per minute per IP; 429 with Retry-After when exceeded.");
      expect(text).toContain("ETag on every GET (send If-None-Match for 304). Catalog version is never cached.");
      expect(text).toContain("Opaque cursors: pass meta.nextCursor back as ?cursor=. limit 1–100 (default 24).");
      expect(text).toContain("next_cursor");
      expect(text).toContain("resync_required");
      expect(text).toContain("curl https://seeds.hues.flowers/api/v1/varieties?crop=sweet-pea");
      expect(text).toContain("No prices are published.");
      expect(openapiPaths.length).toBeGreaterThan(0);
      for (const path of openapiPaths) {
        expect(text, `endpoint /api/v1${path} rendered`).toContain(`/api/v1${path}`);
      }
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/api-docs"');
    });

    it("/privacy ships complete primary content", () => {
      const html = read("privacy/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("Privacy");
      expect(text).toContain("sf_session");
      expect(text).toContain("Cloudflare Turnstile");
      expect(text).toContain("reply STOP to end them");
      expect(text).toContain("no tracking pixels");
      expect(text).toContain("Last updated Nov 17, 2026.");
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/privacy"');
      expect(html).toContain("<title>Privacy | seeds.hues.flowers</title>");
    });

    it("/terms ships complete primary content", () => {
      const html = read("terms/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("Terms of use");
      expect(text).toContain("free, read-only directory run by Hues Floral Park");
      expect(text).toContain("with attribution to seeds.hues.flowers");
      expect(text).toContain("Last updated Nov 16, 2026.");
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/terms"');
      expect(html).toContain("<title>Terms of use | seeds.hues.flowers</title>");
    });
  });

  describe("/crop index (deliverable 2)", () => {
    it("lists every crop with live variety counts", () => {
      const html = read("crop/index.html");
      const text = decodeHtml(html);
      expect(text).toContain("Crops");
      const m = text.match(/(\d+) crops in the directory, alphabetical\./);
      expect(m, "count line present").not.toBeNull();
      expect(Number(m?.[1]), "rendered crop total equals the live total").toBe(cropsTotal);
      for (const c of firstCrops) {
        expect(text).toContain(c.commonName);
        expect(html).toContain(`/crop/${c.slug}`);
      }
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain("Flower seed crops");
      expect(html).toContain('"@type":"ItemList"');
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers/crop"');
      expect(html).toContain("<title>Flower seed crops | seeds.hues.flowers</title>");
    });
  });

  describe("home (deliverable 3)", () => {
    it("replaces the proof page with the real home template", () => {
      const html = read("index.html");
      const text = decodeHtml(html);
      expect(text).not.toContain("Color tokens");
      expect(text).not.toContain("Font stacks");
      expect(text).toContain("Find where to buy any flower seed");
      expect(text).toContain("We don't sell seed.");
      expect(text).toContain("Hard-to-find flower seed");
      expect(text).toContain("Some flower seed is hard to track down");
      expect(html).toContain('role="search"');
      expect(html).toContain('action="/search"');
      expect(html).toContain('data-testid="coverage-line"');
      expect(html).toContain('data-testid="home-motif"');
      expect(html).toContain("images.seeds.hues.flowers");
      expect(html).toContain("divider-home");
      expect(text).toContain("Recently restocked and newly listed");
      expect(text).toContain("Browse by crop");
      expect(text).toContain("All crops");
      expect(text).toContain("see all crops");
      expect(text).toContain("How this directory works");
      expect(text).toContain("No checkout");
      expect(html).toContain("SearchAction");
      expect(html).toContain("query-input");
      expect(html).toContain("Hues Floral Park");
      expect(html).toContain("<title>seeds.hues.flowers — Find Where to Buy Any Flower Seed</title>");
      expect(html).toContain('<link rel="canonical" href="https://seeds.hues.flowers"');
    });

    it("renders the coverage line and recent strip from live data", () => {
      const text = decodeHtml(read("index.html"));
      expect(text).toContain(`${varietiesTotal}`);
      expect(text).toContain(`${coverageWithSellers} with a seller`);
      expect(text).toContain(`${sellersTotal}`);
      expect(text).toContain(`${snapshot.listings.length}`);
      if (recentFirstVariety) expect(text).toContain(recentFirstVariety);
    });
  });

  describe("machine files (deliverables 4–6)", () => {
    it("/llms.txt is served with live counts", () => {
      const text = read("llms.txt");
      expect(text.startsWith("# seeds.hues.flowers")).toBe(true);
      expect(text).toContain(
        `${varietiesTotal} flower seed varieties across ${cropsTotal} crops, sold by ${sellersTotal} US sellers (${snapshot.listings.length} listings)`,
      );
      for (const section of ["## Seller policy", "## Data model", "## Key pages", "## Crops", "## Sellers", "## API", "## Legal"]) {
        expect(text).toContain(section);
      }
      expect(text).toContain("/api/v1/openapi.json");
      expect(text).not.toContain('"price"');
    });

    it("/robots.txt is served byte-identical to live + the three additions", () => {
      const expected = readFileSync(fileURLToPath(new URL("../fixtures/robots-expected.txt", import.meta.url)));
      const actual = readFileSync(`${DIST}/robots.txt`);
      expect(actual.equals(expected)).toBe(true);
    });

    it("/sitemap.xml is the index over all seven segments", () => {
      const index = read("sitemap.xml");
      for (const seg of [
        "sitemap-varieties-listed.xml",
        "sitemap-varieties-zero-seller.xml",
        "sitemap-sellers.xml",
        "sitemap-crops.xml",
        "sitemap-series.xml",
        "sitemap-states.xml",
        "sitemap-hubs.xml",
      ]) {
        expect(index).toContain(`${SITE}/${seg}`);
        expect(read(seg).length).toBeGreaterThan(0);
      }
      expect(index.match(/<sitemap>/g)).toHaveLength(7);
    });

    it("keeps pagination URLs out of every generated segment", () => {
      for (const seg of [
        "sitemap.xml",
        "sitemap-varieties-listed.xml",
        "sitemap-varieties-zero-seller.xml",
        "sitemap-sellers.xml",
        "sitemap-crops.xml",
        "sitemap-series.xml",
        "sitemap-states.xml",
        "sitemap-hubs.xml",
      ]) {
        const body = read(seg);
        expect(body, seg).not.toContain("page=");
        expect(body, seg).not.toMatch(/<loc>[^<]*[?&]/);
      }
    });

    it("holds the zero-seller cohort in its own segment (membership vs the live snapshot)", () => {
      const listedIds = new Set(snapshot.listings.map((l) => l.variety_id));
      const listed = snapshot.varieties.filter((v) => v.indexable && listedIds.has(v.id)).slice(0, 5);
      const zero = snapshot.varieties.filter((v) => v.indexable && !listedIds.has(v.id)).slice(0, 5);
      expect(listed.length).toBeGreaterThan(0);
      expect(zero.length).toBeGreaterThan(0);
      const listedFile = read("sitemap-varieties-listed.xml");
      const zeroFile = read("sitemap-varieties-zero-seller.xml");
      for (const v of listed) {
        expect(listedFile).toContain(`${SITE}/variety/${v.slug}`);
        expect(zeroFile).not.toContain(v.slug);
      }
      for (const v of zero) {
        expect(zeroFile).toContain(`${SITE}/variety/${v.slug}`);
        expect(listedFile).not.toContain(v.slug);
      }
    });

    it("lists no removed seller: every seller URL resolves in the live snapshot", () => {
      const sellersFile = read("sitemap-sellers.xml");
      const liveSlugs = new Set(snapshot.sellers.map((s) => s.slug));
      const emitted = [...sellersFile.matchAll(/<loc>https:\/\/seeds\.hues\.flowers\/seller\/([^<]+)<\/loc>/g)].map((m) => m[1]!);
      expect(emitted.length).toBeGreaterThan(0);
      for (const slug of emitted) {
        expect(liveSlugs.has(slug), `generated seller ${slug} is live`).toBe(true);
      }
      expect(sellersFile).not.toContain("angletok");
    });

    it("emits lastmod from the verified cache only (real-or-omitted)", () => {
      const cache = JSON.parse(readFileSync(`${APP_ROOT}/src/data/sitemap-lastmod.json`, "utf8")) as LastmodCache;
      const liveSeq = new Map(snapshot.varieties.map((v) => [v.slug, v.updated_seq] as const));
      const varietyFiles = read("sitemap-varieties-listed.xml") + read("sitemap-varieties-zero-seller.xml");
      let verified = 0;
      for (const [slug, entry] of Object.entries(cache.varieties).slice(0, 50)) {
        if (liveSeq.get(slug) === entry.updated_seq) {
          expect(varietyFiles).toContain(`<lastmod>${entry.updated_at}</lastmod>`);
          verified++;
        }
      }
      expect(verified, "at least one verified lastmod emits").toBeGreaterThan(0);
      for (const [, entry] of Object.entries(cache.varieties)) {
        expect(entry.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
      for (const seg of ["sitemap-crops.xml", "sitemap-states.xml", "sitemap-hubs.xml"]) {
        expect(read(seg), seg).not.toContain("<lastmod>");
      }
    });

    it("matches the live URL set per segment (slugs generated == slugs live)", () => {
      const slugsOf = (xml: string, kind: string): string[] =>
        [...xml.matchAll(new RegExp(`<loc>${SITE}/${kind}/([^<]+)</loc>`, "g"))].map((m) => m[1]!).sort();
      // Sanity first: the API snapshot and the live sitemap agree right now —
      // if they don't, the catalog moved mid-run and (b) below cannot judge.
      const snapVarietySlugs = snapshot.varieties.filter((v) => v.indexable).map((v) => v.slug).sort();
      const liveVarietySlugs = slugsOf(liveSitemap, "variety");
      expect(liveVarietySlugs, "(a) live sitemap == live snapshot (varieties)").toEqual(snapVarietySlugs);
      // The generated set equals the live set per type.
      const generatedListed = slugsOf(read("sitemap-varieties-listed.xml"), "variety");
      const generatedZero = slugsOf(read("sitemap-varieties-zero-seller.xml"), "variety");
      expect([...generatedListed, ...generatedZero].sort(), "(b) generated == live (varieties)").toEqual(liveVarietySlugs);
      expect(slugsOf(read("sitemap-sellers.xml"), "seller"), "generated == live (sellers)").toEqual(slugsOf(liveSitemap, "seller"));
      expect(slugsOf(read("sitemap-crops.xml"), "crop"), "generated == live (crops)").toEqual(slugsOf(liveSitemap, "crop"));
      expect(slugsOf(read("sitemap-series.xml"), "series"), "generated == live (series)").toEqual(slugsOf(liveSitemap, "series"));
      expect(slugsOf(read("sitemap-states.xml"), "state"), "generated == live (states)").toEqual(slugsOf(liveSitemap, "state"));
    });
  });

  describe("head contract on every template", () => {
    const TEMPLATES: [rel: string, canonical: string][] = [
      ["index.html", SITE],
      ["about/index.html", `${SITE}/about`],
      ["about/data/index.html", `${SITE}/about/data`],
      ["about/bot/index.html", `${SITE}/about/bot`],
      ["api-docs/index.html", `${SITE}/api-docs`],
      ["privacy/index.html", `${SITE}/privacy`],
      ["terms/index.html", `${SITE}/terms`],
      ["crop/index.html", `${SITE}/crop`],
    ];

    it.each(TEMPLATES)("og:image is the share image, never the canonical (%s)", (rel, canonical) => {
      const html = read(rel);
      const image = meta(html, "property", "og:image");
      const url = meta(html, "property", "og:url");
      expect(image).toBe(`${SITE}/og/site/default`);
      expect(url).toBe(canonical);
      expect(image).not.toBe(url);
      expect(meta(html, "name", "twitter:image")).toBe(image);
      expect(html).toContain(`<link rel="canonical" href="${canonical}"`);
      expect(html).not.toContain('"price"');
    });
  });
});
