/**
 * Slice 5 surface contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub) over plain HTTP with no
 * JavaScript, Quinn-style. Every expectation is hardcoded from the v2
 * sources and Bea's audit — never computed by the app under test.
 *
 * Samples (tests/unit/shop-catalog.ts): blue-ridge-seeds (30 listings),
 * prairie-seed-house (12, imported rating), two-roads-farm
 * (multi-location), faraway-seeds (unparseable location), quiet-hollow-farm
 * (zero listings), shuttered-seed-co (removed → 410), sunflower (30
 * varieties), sunbeam (8 with sellers), moonshadow (3, zero with sellers),
 * oregon/kansas (plural/singular), california (real, absent → 404). The
 * invalidation proof runs LAST: it mutates the stub catalog.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { shopCatalogState } from "../unit/shop-catalog";
import { findPriceViolations, stripScriptElements } from "../unit/price-guard";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITE = "https://seeds.hues.flowers";
const SECRET = "slice5-revalidate-secret";

const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** HTML without script elements (page data + JSON-LD are asserted separately). */
const stripScripts = stripScriptElements;
/** Visible text only: no scripts, no tags, entities decoded. */
const visibleText = (html: string): string => decodeHtml(stripScripts(html).replace(/<[^>]*>/g, " "));

const countOf = (html: string, pattern: RegExp): number => html.match(pattern)?.length ?? 0;

const meta = (html: string, attr: string, name: string): string | null => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1]! : null;
};

const titleOf = (html: string): string | null => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1]! : null;
};

const canonicalOf = (html: string): string | null => {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/);
  return m ? decodeHtml(m[1]!) : null;
};

const ldJsonBlocks = (html: string): unknown[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));

interface LdItemList {
  "@type": string;
  name: string;
  numberOfItems: number;
  itemListElement: { "@type": string; position: number; url: string; name: string }[];
}

const itemLists = (html: string): LdItemList[] =>
  ldJsonBlocks(html).filter((b): b is LdItemList => typeof b === "object" && b !== null && (b as { "@type": string })["@type"] === "ItemList");

const organizations = (html: string): Record<string, unknown>[] =>
  ldJsonBlocks(html).filter(
    (b): b is Record<string, unknown> => typeof b === "object" && b !== null && (b as { "@type": string })["@type"] === "Organization",
  );

/** Shop-grid card order: the h3 variety names in DOM order. */
const shopCardNames = (html: string): string[] =>
  [...decodeHtml(html).matchAll(/<h3[\s\S]*?<\/h3>/g)].map((m) => m[0].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim());

function pngDims(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

async function get(path: string, follow = true): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${BASE}${path}`, { redirect: follow ? "follow" : "manual" });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

async function getBytes(path: string): Promise<{ status: number; headers: Headers; body: Buffer }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

function runBuildStep(apiBase: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", FORCE_COLOR: "0", SEEDS_API_BASE: apiBase },
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`npm run ${script} timed out:\n${output}`));
    }, 280_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} failed (code ${code}):\n${output}`));
    });
  });
}

async function buildApp(apiBase: string): Promise<void> {
  await runBuildStep(apiBase, "build");
  await runBuildStep(apiBase, "build:server");
}

function startServer(apiBase: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist-server/serve.mjs"], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: "0", SEEDS_API_BASE: apiBase, SEEDS_REVALIDATE_SECRET: SECRET },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`server did not print its listening line in time. stderr:\n${stderr}`));
    }, 30_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = /listening on (http:\/\/\S+)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        BASE = match[1]!;
        resolve(child);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (!BASE) {
        clearTimeout(timer);
        reject(new Error(`server exited before listening (code ${code}). stderr:\n${stderr}`));
      }
    });
  });
}

beforeAll(async () => {
  stub = await startStubApi(shopCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await buildApp(apiBase);
  server = await startServer(apiBase);
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await stub?.close();
});

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

function expectNoPrice(html: string): void {
  expect(findPriceViolations(html)).toEqual([]);
}

/**
 * The price guard where honest copy carries a prohibited-list WORD
 * (Bea §5's rule — Quinn reads the hit): each known sentence is pinned
 * (its absence fails) and scrubbed, then the shared checker runs over
 * the rest — JSON-LD strictness and the footer requirement intact.
 */
function expectNoPriceWithKnownWords(html: string, known: string[]): void {
  for (const sentence of known) expect(html, `known-good sentence pinned: ${sentence}`).toContain(sentence);
  let scrubbed = html;
  for (const sentence of known) scrubbed = scrubbed.split(sentence).join("");
  expect(findPriceViolations(scrubbed)).toEqual([]);
}

function expectHeadExclusivity(html: string): void {
  expect(countOf(html, /<link rel="canonical"/g), "canonical count").toBe(1);
  expect(countOf(html, /<meta name="description"/g), "description count").toBe(1);
  expect(countOf(html, /<meta property="og:url"/g), "og:url count").toBe(1);
  expect(countOf(html, /<meta property="og:image"/g), "og:image count").toBe(1);
  expect(countOf(html, /<title>/g), "title count").toBe(1);
}

const PAGE1_ORDER = [
  "Apple Blossom",
  "Blue Ribbon",
  "Candy Stripe",
  "Dwarf Jewel",
  "Early Wonder",
  "Floral Dance",
  "Giant Wave",
  "Honey Glow",
  "Ivory Princess",
  "Jubilee Gem",
  "King's Ransom",
  "King's Ransom",
  "Knee-Hi Mix",
  "Lavender Lady",
  "Mammoth Gold",
  "Zelda Star",
  "Amber Waves",
  "Apricot Dream",
  "Butter Yellow",
  "Copper Glow",
  "Dainty Maid",
  "Ember Glow",
  "Frosted Hills",
  "Golden Hour",
];

const PAGE2_ORDER = ["Harvest Rose", "Ink Spot", "Joyful Noise", "Koko Loco", "Linen White", "Misty Rose"];

const BLUE_RIDGE_DESCRIPTION =
  "Blue Ridge Seeds in Portland, OR: 30 flower seed varieties listed, each with its stock state and the date it was last checked.";

describe("shop page 1 SSR (raw HTML, no JavaScript)", () => {
  it("serves 200 with the §9 cache headers", async () => {
    const res = await get("/seller/blue-ridge-seeds");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
  });

  it("renders the H1, title, sentence-composed description, and self-canonical", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds")).text);
    expect(html).toContain("<h1");
    expect(html).toContain("Blue Ridge Seeds");
    expect(titleOf(html)).toBe("Blue Ridge Seeds — Flower Seed Seller | seeds.hues.flowers");
    // m-5: composed to a complete sentence — the mid-word clip is
    // structurally impossible (ends at a sentence boundary, no prose fragment).
    expect(meta(html, "name", "description")).toBe(BLUE_RIDGE_DESCRIPTION);
    expect(meta(html, "name", "description")).toMatch(/[.!?]$/);
    expect(meta(html, "name", "description")).not.toContain("Willamette");
    expect(canonicalOf(html)).toBe(`${SITE}/seller/blue-ridge-seeds`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).not.toContain("noindex");
  });

  it("emits Organization JSON-LD with the parsed PostalAddress", async () => {
    const html = (await get("/seller/blue-ridge-seeds")).text;
    const orgs = organizations(html);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!["name"]).toBe("Blue Ridge Seeds");
    expect(orgs[0]!["address"]).toEqual({ "@type": "PostalAddress", addressLocality: "Portland", addressRegion: "OR" });
  });

  it("emits a 24-entry ItemList plus variety anchors", async () => {
    const html = (await get("/seller/blue-ridge-seeds")).text;
    const lists = itemLists(html);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(24);
    expect(lists[0]!.itemListElement.map((e) => e.position)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(lists[0]!.itemListElement.map((e) => e.name)).toEqual(PAGE1_ORDER);
    expect(countOf(html, /href="\/variety\//g)).toBeGreaterThanOrEqual(24);
  });

  it("renders the grouped order: orderable A–Z above the rest A–Z", async () => {
    const html = (await get("/seller/blue-ridge-seeds")).text;
    expect(shopCardNames(html)).toEqual(PAGE1_ORDER);
    // The grouping proof: Zelda Star (orderable) renders before Amber Waves
    // although Z > A — a pure A–Z sort would invert them.
    expect(html.indexOf("Zelda Star")).toBeLessThan(html.indexOf("Amber Waves"));
  });

  it("renders stock words, checked dates, packet sizes, and Latin names on cards", async () => {
    const text = visibleText((await get("/seller/blue-ridge-seeds")).text);
    expect(text).toContain("In stock");
    expect(text).toContain("Sold out");
    expect(text).toContain("Preorder");
    expect(text).toContain("Checked Nov 21");
    expect(text).toContain("Checked Nov 20");
    expect(text).toContain("Not yet checked");
    expect(text).toContain("25 seeds");
    expect(text).toContain("1 g");
    expect(text).toContain("100 seeds");
    expect(text).toContain("Lathyrus odoratus");
    expect(text).toContain("Cosmos bipinnatus");
  });

  it("renders the contact block, direct homepage link, badge, and facts", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds")).text);
    expect(html).toContain("(503) 555-0114");
    expect(html).toContain('href="tel:+15035550114"');
    expect(html).toContain("help@blueridgeseeds.example.com");
    expect(html).toContain('href="mailto:help@blueridgeseeds.example.com"');
    // Direct outbound — never through a portal or /go/.
    expect(html).toContain('href="https://blueridgeseeds.example.com"');
    expect(html).toContain("Retail seed shop");
    expect(html).toContain("Small farm");
    expect(html).toContain("Portland, OR");
    expect(html).toContain('href="/state/oregon"');
    expect(html).toContain("Ordering notes:");
    expect(html).toContain("Ships within two weeks.");
    expect(html).toContain("Blue Ridge Seeds’ shop");
    expect(html).toContain("30 listings, in stock first. · page 1 of 2");
    expect(html).toContain('href="/report?seller=blue-ridge-seeds"');
  });

  it("shows the state plate where one exists", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds")).text);
    expect(html).toContain("Oregon grape, Oregon's state flower");
  });

  it("renders shop search, crop-first filters, and grouped sort at T=30", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds")).text);
    expect(html).toContain('id="shop-search"');
    expect(html).toContain("Search Blue Ridge Seeds’ shop");
    const legends = [...html.matchAll(/<legend[^>]*>([^<]*)<\/legend>/g)].map((m) => m[1]);
    expect(legends[0]).toBe("Crop");
    expect(legends).toEqual(expect.arrayContaining(["Crop", "Season", "Sowing method", "Hue"]));
    expect(html).toContain("In stock first");
    expect(html).toContain("Name A–Z");
    expect(html).toContain("Recently checked");
    expect(html).toContain('href="/seller/blue-ridge-seeds?page=2"');
  });

  it("declares the generated seller card as og:image and the generator serves it", async () => {
    const html = (await get("/seller/blue-ridge-seeds")).text;
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/seller/blue-ridge-seeds`);
    const card = await getBytes("/og/seller/blue-ridge-seeds");
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/png");
    expect(pngDims(card.body)).toEqual({ width: 1200, height: 630 });
  });

  it("keeps head exclusivity and the price guard", async () => {
    const html = (await get("/seller/blue-ridge-seeds")).text;
    expectHeadExclusivity(html);
    expectNoPrice(html);
  });
});

describe("shop page 2 and page bounds", () => {
  it("serves page 2 with a self-canonical, continuous positions, and new names", async () => {
    const res = await get("/seller/blue-ridge-seeds?page=2");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(canonicalOf(html)).toBe(`${SITE}/seller/blue-ridge-seeds?page=2`);
    expect(titleOf(html)).toBe("Blue Ridge Seeds — Flower Seed Seller — page 2 | seeds.hues.flowers");
    expect(shopCardNames(res.text)).toEqual(PAGE2_ORDER);
    const lists = itemLists(res.text);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(6);
    expect(lists[0]!.itemListElement.map((e) => e.position)).toEqual([25, 26, 27, 28, 29, 30]);
    expect(lists[0]!.itemListElement.map((e) => e.name)).toEqual(PAGE2_ORDER);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("redirects ?page=1 to the clean shop URL in one 301 hop", async () => {
    const res = await get("/seller/blue-ridge-seeds?page=1", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/seller/blue-ridge-seeds");
    const followed = await get("/seller/blue-ridge-seeds");
    expect(followed.status).toBe(200);
  });

  it("answers 404 past the end", async () => {
    const res = await get("/seller/blue-ridge-seeds?page=3");
    expect(res.status).toBe(404);
    expect(decodeHtml(res.text)).toContain("We couldn’t find that page");
  });
});

describe("shop bands and graceful absences", () => {
  it("renders filters without search at T=12, grouped A–Z", async () => {
    const html = decodeHtml((await get("/seller/prairie-seed-house")).text);
    expect(html).toContain("Crop");
    expect(html).toContain("In stock first");
    expect(html).not.toContain('id="shop-search"');
    expect(shopCardNames(html)).toEqual([
      "Blue Boy",
      "Candy Stripe",
      "Coral Charm",
      "Frost King",
      "Mystery Bloom",
      "Prairie Rose",
      "Amber Star",
      "Candy Stripe",
      "Dawn Chorus",
      "Ember Star",
      "Golden Boy",
      "King's Ransom",
    ]);
    // No plate for a state without one (no substitutes).
    expect(html).not.toContain("data-state-plate");
  });

  it("renders the prose-included description branch on prairie", async () => {
    const html = decodeHtml((await get("/seller/prairie-seed-house")).text);
    expect(meta(html, "name", "description")).toBe(
      "Prairie Seed House in Lawrence, KS: 12 flower seed varieties listed, each with its stock state and the date it was last checked. Heirloom seed, plainly grown.",
    );
    expect(meta(html, "name", "description")).toMatch(/[.!?]$/);
  });

  it("renders the imported rating as a visible panel only, with graceful contact absence", async () => {
    const html = decodeHtml((await get("/seller/prairie-seed-house")).text);
    expect(html).toContain("Reviews from Google");
    expect(html).toContain("Rated 4.7 out of 5");
    expect(html).toContain("Not yet rated");
    expect(html).toContain("No website on file for this seller.");
    expect(html).toContain("(785) 555-0199");
    expect(html).not.toContain("mailto:");
    expectHeadExclusivity(html);
    expectNoPriceWithKnownWords(html, ["Reviews from Google", "from 132 reviews on Google"]);
  });

  it("emits no PostalAddress for an unparseable location, with email-only contact", async () => {
    const res = await get("/seller/faraway-seeds");
    expect(res.status).toBe(200);
    const orgs = organizations(res.text);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!["name"]).toBe("Faraway Seeds");
    expect(orgs[0]).not.toHaveProperty("address");
    const html = decodeHtml(res.text);
    expect(html).toContain("Online only");
    expect(html).toContain("hello@farawayseeds.example.com");
    expect(html).not.toContain("tel:");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("renders the plain grid at T=3 with no tools", async () => {
    const html = decodeHtml((await get("/seller/two-roads-farm")).text);
    expect(shopCardNames(html)).toEqual(["Gate Row", "North Field", "South Field"]);
    expect(html).not.toContain('id="shop-search"');
    expect(html).not.toContain("In stock first");
    expect(html).not.toContain("<legend");
  });
});

describe("multi-location shop", () => {
  it("renders both locations with kind labels, primary first and marked", async () => {
    const html = decodeHtml((await get("/seller/two-roads-farm")).text);
    expect(html).toContain("Two Roads Farm’s locations");
    expect(html).toContain("Physical address");
    expect(html).toContain("Primary");
    expect(html).toContain("4810 Springdale Rd");
    expect(html).toContain("Mailing address");
    expect(html).toContain("PO Box 1408");
    expect(html.indexOf("Physical address")).toBeLessThan(html.indexOf("Mailing address"));
    expectHeadExclusivity(html);
    expectNoPrice(html);
  });

  it("is exactly one shop page (no per-location pages)", async () => {
    const html = (await get("/seller/two-roads-farm")).text;
    expect(countOf(html, /href="\/seller\/two-roads-farm\//g)).toBe(0);
    const res = await get("/seller/two-roads-farm/austin");
    expect(res.status).toBe(404);
  });
});

describe("zero-listing shop and removed sellers", () => {
  it("serves the empty shop 200 and indexable", async () => {
    const res = await get("/seller/quiet-hollow-farm");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("Quiet Hollow Farm");
    expect(html).toContain("No listings for this seller yet.");
    expect(html).toContain("0 listings");
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).not.toContain("noindex");
    expect(meta(html, "name", "description")).toBe(
      "Quiet Hollow Farm in Burlington, VT: 0 flower seed varieties listed, each with its stock state and the date it was last checked. A quiet hillside farm.",
    );
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("answers 404 for a page past the empty shop's end", async () => {
    const res = await get("/seller/quiet-hollow-farm?page=2");
    expect(res.status).toBe(404);
  });

  it("answers 410 for a removed seller with the noindex Gone page", async () => {
    const res = await get("/seller/shuttered-seed-co", false);
    expect(res.status).toBe(410);
    const html = decodeHtml(res.text);
    expect(html).toContain("This seller has been removed");
    expect(html).toContain("This seller asked to be removed from the directory, and its listings have been taken down.");
    expect(html).toContain('href="/seller"');
    expect(html).toContain("Browse other sellers");
    expect(meta(html, "name", "robots")).toContain("noindex");
    expectNoPrice(res.text);
  });

  it("keeps 410 distinct from 404", async () => {
    const gone = await get("/seller/shuttered-seed-co", false);
    const missing = await get("/seller/no-such-seller", false);
    expect(gone.status).toBe(410);
    expect(missing.status).toBe(404);
    expect(decodeHtml(missing.text)).toContain("We couldn’t find that page");
    expect(decodeHtml(missing.text)).not.toContain("This seller has been removed");
    expect(decodeHtml(gone.text)).not.toContain("We couldn’t find that page");
    const malformed = await get("/seller/Bad_Slug", false);
    expect(malformed.status).toBe(404);
  });

  it("re-tests the Slice 4 carry end-to-end (301 → 200)", async () => {
    const plural = await get("/sellers/blue-ridge-seeds", false);
    expect(plural.status).toBe(301);
    expect(plural.headers.get("location")).toBe("/seller/blue-ridge-seeds");
    expect((await get("/seller/blue-ridge-seeds")).status).toBe(200);
    const legacy = await get("/seller?s=blue-ridge-seeds", false);
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get("location")).toBe("/seller/blue-ridge-seeds");
    expect((await get("/seller/blue-ridge-seeds")).status).toBe(200);
  });
});

describe("shop search, filters, and sort (server-rendered)", () => {
  it("narrows search to the shop's varieties only", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds?q=rose")).text);
    expect(shopCardNames(html)).toEqual(["Harvest Rose", "Misty Rose"]);
    expect(html).toContain("2 matches for “rose”, best match first.");
    // Lonely Bloom exists in the catalog but not in this shop: no matches.
    const none = decodeHtml((await get("/seller/blue-ridge-seeds?q=lonely")).text);
    expect(none).toContain("No matches for “lonely” in Blue Ridge Seeds’ shop.");
    expect(meta(none, "name", "robots")).toBe("noindex, follow");
    expect(canonicalOf(none)).toBe(`${SITE}/seller/blue-ridge-seeds`);
  });

  it("filters by the shop's crops with the crop group leading", async () => {
    const res = await get("/seller/blue-ridge-seeds?crop=cosmos");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("14 listings, in stock first.");
    expect(shopCardNames(html)).toEqual([
      "Candy Stripe",
      "Dwarf Jewel",
      "Floral Dance",
      "Honey Glow",
      "Jubilee Gem",
      "Lavender Lady",
      "Zelda Star",
      "Apricot Dream",
      "Butter Yellow",
      "Dainty Maid",
      "Frosted Hills",
      "Harvest Rose",
      "Joyful Noise",
      "Linen White",
    ]);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(canonicalOf(html)).toBe(`${SITE}/seller/blue-ridge-seeds`);
  });

  it("renders the zero-combination state for a stocked-out valid crop, never a 404", async () => {
    const res = await get("/seller/blue-ridge-seeds?crop=sunflower");
    expect(res.status).toBe(200);
    expect(decodeHtml(res.text)).toContain("No listings in Blue Ridge Seeds’ shop match those filters.");
  });

  it("sorts pure Name A–Z on ?sort=name across the grouped boundary", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds?sort=name")).text);
    const names = shopCardNames(html);
    expect(names.slice(0, 3)).toEqual(["Amber Waves", "Apple Blossom", "Apricot Dream"]);
    expect(names).toHaveLength(24);
    expect(html).toContain("30 listings, A–Z. · page 1 of 2");
  });

  it("keeps sort-only views indexable with the sort-free canonical", async () => {
    const html = decodeHtml((await get("/seller/blue-ridge-seeds?sort=name")).text);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(canonicalOf(html)).toBe(`${SITE}/seller/blue-ridge-seeds`);
  });

  it("404s a filtered page past its narrowed end", async () => {
    const res = await get("/seller/blue-ridge-seeds?crop=cosmos&page=2");
    expect(res.status).toBe(404);
  });
});

const CROP_PAGE1 = [
  "Autumn Beauty",
  "Buttercream",
  "Chianti",
  "Chocolate Cherry",
  "Claret",
  "Evening Sun",
  "Florenza",
  "Giant Sungold",
  "Gold Rush",
  "Indian Blanket",
  "Italian White",
  "Lemon Queen",
  "Moulin Rouge",
  "Orange Hobbit",
  "Pacino Gold",
  "Pastiche",
  "Prado Red",
  "ProCut Gold",
  "ProCut Orange",
  "Red Sun",
  "Ring of Fire",
  "Ruby Eclipse",
  "Solano Flame",
  "Soraya",
];

const CROP_PAGE2 = ["Strawberry Blonde", "Sunbright", "Sunrich Orange", "Teddy Bear", "Valentine", "Velvet Queen"];

describe("crop hub SSR", () => {
  it("serves page 1 with H1, Latin, counts, ItemList, and variety anchors", async () => {
    const res = await get("/crop/sunflower");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(html).toContain("Sunflower seeds");
    expect(html).toContain("Helianthus annuus");
    expect(titleOf(html)).toBe("Sunflower Seeds (Helianthus annuus) — 30 Varieties, 25 With Sellers | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe(
      "30 varieties of Sunflower (Helianthus annuus) cataloged; 25 sold by sellers in the directory. Last updated Nov 21, 2026.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/crop/sunflower`);
    expect(html).toContain("30 varieties cataloged · 25 with sellers · last updated Nov 21, 2026");
    const lists = itemLists(res.text);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(24);
    expect(lists[0]!.itemListElement.map((e) => e.name)).toEqual(CROP_PAGE1);
    expect(countOf(res.text, /href="\/variety\//g)).toBeGreaterThanOrEqual(24);
    expect(html).toContain("30 varieties, alphabetical. Page 1 of 2.");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("renders facts, hero, about, series links, and the grower guide", async () => {
    const html = decodeHtml((await get("/crop/sunflower")).text);
    expect(html).toContain("Season:");
    expect(html).toContain("Sowing method:");
    expect(html).toContain("Annual · Tolerates light frost once established.");
    expect(html).toContain('data-testid="crop-hero"');
    expect(html).toContain("About sunflower");
    expect(html).toContain("Sunflowers turn their faces to the sun");
    expect(html).toContain('href="/series/sunbeam"');
    expect(html).toContain('href="/series/moonshadow"');
    expect(html).toContain("Growing sunflower");
    expect(html).toContain("Germination & Growing");
    expect(html).toContain("Harvest");
    expect(html).toContain("Seed Saving");
    expect(html).toContain("Sow 1 inch deep after frost.");
    expect(html).toContain("Succession sow every two weeks.");
    expect(html).toContain("Saving seed: Easy");
  });

  it("declares the generated crop card as og:image — never the portrait artwork", async () => {
    const html = (await get("/crop/sunflower")).text;
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/crop/sunflower`);
    const card = await getBytes("/og/crop/sunflower");
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/png");
    expect(pngDims(card.body)).toEqual({ width: 1200, height: 630 });
  });

  it("serves page 2 self-canonical with continuous positions", async () => {
    const res = await get("/crop/sunflower?page=2");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(canonicalOf(html)).toBe(`${SITE}/crop/sunflower?page=2`);
    const lists = itemLists(res.text);
    expect(lists[0]!.itemListElement.map((e) => e.position)).toEqual([25, 26, 27, 28, 29, 30]);
    expect(lists[0]!.itemListElement.map((e) => e.name)).toEqual(CROP_PAGE2);
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("redirects ?page=1 in one 301 hop and 404s past the end", async () => {
    const one = await get("/crop/sunflower?page=1", false);
    expect(one.status).toBe(301);
    expect(one.headers.get("location")).toBe("/crop/sunflower");
    expect((await get("/crop/sunflower?page=3")).status).toBe(404);
    expect((await get("/crop/no-such-crop")).status).toBe(404);
  });

  it("redirects the plural legacy crop paths in one 301 hop", async () => {
    for (const from of ["/plants/sunflower", "/categories/sunflower"]) {
      const res = await get(from, false);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe("/crop/sunflower");
    }
    for (const from of ["/plants", "/categories"]) {
      const res = await get(from, false);
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe("/crop");
    }
    expect((await get("/crop/sunflower")).status).toBe(200);
  });
});

describe("crop filtered views and the strict parse", () => {
  it("serves ?has_sellers=true noindexed with the clean canonical", async () => {
    const res = await get("/crop/sunflower?has_sellers=true");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(canonicalOf(html)).toBe(`${SITE}/crop/sunflower`);
    expect(html).toContain("25 varieties match, alphabetical. Page 1 of 2.");
    const lists = itemLists(res.text);
    expect(lists[0]!.numberOfItems).toBe(24);
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("filters by hue and series as real links", async () => {
    const pink = decodeHtml((await get("/crop/sunflower?color_family=pink")).text);
    expect(pink).toContain("5 varieties match, alphabetical.");
    expect(itemLists(pink)[0]!.itemListElement.map((e) => e.name)).toEqual([
      "Autumn Beauty",
      "Florenza",
      "Moulin Rouge",
      "ProCut Orange",
      "Strawberry Blonde",
    ]);
    const series = decodeHtml((await get("/crop/sunflower?series=sunbeam")).text);
    expect(series).toContain("8 varieties match, alphabetical.");
  });

  it("404s malformed filter values (the strict parse is deliberate)", async () => {
    expect((await get("/crop/sunflower?color_family=PINK!")).status).toBe(404);
    expect((await get("/crop/sunflower?color_family=pink%2CPINK")).status).toBe(404);
    expect((await get("/crop/sunflower?has_sellers=yes")).status).toBe(404);
    expect((await get("/crop/sunflower?has_sellers=1")).status).toBe(404);
  });

  it("stays forgiving where the audit is silent (vocabulary, series, repeats)", async () => {
    // Pattern-clean but unknown hue: ignored, the ordinary indexable page.
    const vocab = await get("/crop/sunflower?color_family=mauve");
    expect(vocab.status).toBe(200);
    expect(meta(decodeHtml(vocab.text), "name", "robots")).toBe("index, follow");
    // Unknown series slug: kept, filtering honestly to zero — 200, noindexed.
    const series = await get("/crop/sunflower?series=no-such-series");
    expect(series.status).toBe(200);
    expect(decodeHtml(series.text)).toContain("No varieties match.");
    // Repeated has_sellers: first value wins.
    expect((await get("/crop/sunflower?has_sellers=true&has_sellers=false")).status).toBe(200);
  });

  it("keeps sort-only views indexable with the sort-free canonical", async () => {
    const html = decodeHtml((await get("/crop/sunflower?sort=recent")).text);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(canonicalOf(html)).toBe(`${SITE}/crop/sunflower`);
    expect(html).toContain("30 varieties, most recently checked first. Page 1 of 2.");
  });
});

describe("series hub SSR", () => {
  it("serves the full grid with counts, crop link, and ItemList", async () => {
    const res = await get("/series/sunbeam");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(html).toContain("Sunbeam");
    expect(html).toContain("Sunflower series");
    expect(titleOf(html)).toBe("Sunbeam Sunflower Series — 8 Varieties, 8 With Sellers | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe(
      "The Sunbeam series of Sunflower (Helianthus annuus): 8 varieties cataloged, 8 sold by sellers in the directory.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/series/sunbeam`);
    expect(html).toContain('href="/crop/sunflower"');
    const lists = itemLists(res.text);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(8);
    expect(countOf(res.text, /href="\/variety\//g)).toBeGreaterThanOrEqual(8);
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/crop/sunflower`);
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("serves the zero-with-sellers series 200 and indexable", async () => {
    const res = await get("/series/moonshadow");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(titleOf(html)).toBe("Moonshadow Sunflower Series — 3 Varieties, 0 With Sellers | seeds.hues.flowers");
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).not.toContain("noindex");
    const lists = itemLists(res.text);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(3);
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("answers 404 for unknown series", async () => {
    expect((await get("/series/no-such-series")).status).toBe(404);
  });

  it("ignores paging on the unpaginated template (the port does not paginate series)", async () => {
    const res = await get("/series/sunbeam?page=2");
    expect(res.status).toBe(200);
    expect(itemLists(res.text)[0]!.numberOfItems).toBe(8);
  });
});

describe("state hub SSR", () => {
  it("serves the plural state with absolute title, intro, cards, and artwork", async () => {
    const res = await get("/state/oregon");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    // Absolute title — no site-name suffix.
    expect(titleOf(html)).toBe("Seed sellers in Oregon — Seed Directory");
    expect(meta(html, "name", "description")).toBe(
      "2 farms and seed companies in Oregon list flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/state/oregon`);
    expect(html).toContain("Seed sellers in Oregon");
    expect(html).toContain("2 seed sellers in Oregon list seed with the Seed Directory.");
    expect(html).toContain('href="/add-your-farm?state=OR"');
    expect(html).toContain("Add Your Farm");
    const lists = itemLists(res.text);
    expect(lists).toHaveLength(1);
    expect(lists[0]!.numberOfItems).toBe(2);
    expect(lists[0]!.itemListElement.map((e) => e.position)).toEqual([1, 2]);
    expect(countOf(res.text, /href="\/seller\//g)).toBeGreaterThanOrEqual(2);
    expect(html).toContain('data-testid="state-hero"');
    expect(html).toContain("Oregon landscape with Oregon grape");
    expect(html).toContain("Oregon grape, Oregon's state flower");
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/site/default`);
    expectHeadExclusivity(res.text);
    expectNoPriceWithKnownWords(res.text, ["we review every submission by hand"]);
  });

  it("serves the singular state without artwork where none exists", async () => {
    const res = await get("/state/kansas");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("1 seed seller in Kansas lists seed with the Seed Directory.");
    expect(html).not.toContain('data-testid="state-hero"');
    expect(html).not.toContain("data-state-plate");
    expectHeadExclusivity(res.text);
    expectNoPriceWithKnownWords(res.text, ["we review every submission by hand"]);
  });

  it("serves the generated site card for state pages", async () => {
    const card = await getBytes("/og/site/default");
    expect(card.status).toBe(200);
    expect(card.headers.get("content-type")).toBe("image/png");
    expect(pngDims(card.body)).toEqual({ width: 1200, height: 630 });
  });

  it("redirects ?page=1, 404s past the end, and 404s sellerless states", async () => {
    const one = await get("/state/oregon?page=1", false);
    expect(one.status).toBe(301);
    expect(one.headers.get("location")).toBe("/state/oregon");
    expect((await get("/state/oregon?page=2")).status).toBe(404);
    // California is real but has no fixture seller: true 404, like any unknown slug.
    expect((await get("/state/california")).status).toBe(404);
    expect((await get("/state/not-a-state")).status).toBe(404);
  });
});

describe("invalidation spot proof (runs last — mutates the stub)", () => {
  it("serves a changed listing stock to the shop AND the variety page after a seller-tag revalidate", async () => {
    // King's Ransom's shared listing id 1 starts in stock, checked Nov 20.
    expect(decodeHtml((await get("/seller/blue-ridge-seeds")).text)).not.toContain("Nov 22");
    expect(decodeHtml((await get("/variety/sweet-pea-kings-ransom")).text)).toContain("Nov 20, 2026");

    // The catalog write: listing 1 sells out, rechecked Nov 22.
    const detail = stub.state.details["sweet-pea-kings-ransom"]!;
    const listing = detail.listings.find((l) => l.id === 1)!;
    listing.availability = "sold_out";
    listing.lastCheckedAt = "2026-11-22T08:00:00.000Z";

    // Stale reads first: the warm edge still serves the old stock (the
    // staleness the hook exists to cure — the purge below must earn the flip).
    expect(decodeHtml((await get("/seller/blue-ridge-seeds")).text)).not.toContain("Nov 22");
    expect(decodeHtml((await get("/variety/sweet-pea-kings-ransom")).text)).toContain("Nov 20, 2026");

    const revalidated = await fetch(`${BASE}/internal/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ tags: ["seller:blue-ridge-seeds"] }),
    });
    expect(revalidated.status).toBe(200);
    const result = (await revalidated.json()) as { paths: string[]; purged: string[] };
    expect(result.paths).toContain("/seller/blue-ridge-seeds");
    expect(result.purged).toContain("seller:detail:blue-ridge-seeds");
    expect(result.purged).toContain("variety:detail:sweet-pea-kings-ransom");

    // After: both pages reflect the write with no rebuild and no cache-busting.
    // Listing 1 sells out, so the grouped order moves it from page 1 (orderable)
    // to page 2 (sold out, King's Ransom sorts after Joyful Noise) — page 2
    // carries the new "Checked Nov 22" stock line.
    const shopAfter = decodeHtml((await get("/seller/blue-ridge-seeds?page=2")).text);
    expect(shopAfter).toContain("Checked Nov 22");
    const varietyAfter = decodeHtml((await get("/variety/sweet-pea-kings-ransom")).text);
    expect(varietyAfter).toContain("Checked Nov 22");
    expect(varietyAfter).toContain("Nov 22, 2026");
    expect(varietyAfter).toContain("2 shops · 0 in stock");
  });
});
