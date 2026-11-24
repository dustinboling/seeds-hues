/**
 * Slice 3 surface contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub) over plain HTTP with no
 * JavaScript, Quinn-style. Every expectation is hardcoded from the v2
 * sources and Bea's audit — never computed by the app under test.
 *
 * Samples (tests/unit/fake-catalog.ts): with-sellers
 * sweet-pea-kings-ransom, zero-seller cosmos-lonely-bloom, unbadged
 * cosmos-candy-stripe, merged sweet-pea-old-ransom, unknown-facts
 * cosmos-mystery-bloom. The invalidation proof runs LAST: it mutates the
 * stub catalog.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { fakeCatalogState } from "../unit/fake-catalog";
import { findPriceViolations, stripScriptElements } from "../unit/price-guard";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITE = "https://seeds.hues.flowers";
const SECRET = "slice3-revalidate-secret";

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

const ldJsonBlocks = (html: string): unknown[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));

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

/**
 * The build reads its catalog data from the in-process stub, so it must run
 * WITHOUT blocking the event loop (execFileSync would deadlock the stub:
 * the build waits for API reads the blocked loop can never serve).
 */
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
  stub = await startStubApi(fakeCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await buildApp(apiBase);
  server = await startServer(apiBase);
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await stub?.close();
});

const WITH_SELLERS = "sweet-pea-kings-ransom";
const ZERO_SELLER = "cosmos-lonely-bloom";
const UNBADGED = "cosmos-candy-stripe";
const MERGED = "sweet-pea-old-ransom";
const UNKNOWNS = "cosmos-mystery-bloom";

const WITH_TITLE = "King's Ransom Sweet Pea Seeds — Where to Buy (2 Sellers) | seeds.hues.flowers";
const WITH_DESCRIPTION =
  "King's Ransom Sweet Pea seeds (Lathyrus odoratus). King's Ransom bears large, ruffled blooms in deep rose on strong stems.";
const WITH_ANSWER = "As of Nov 20, 2026, 2 sellers list King's Ransom: Blue Ridge Seeds and Prairie Seed House.";
const ZERO_TITLE = "Lonely Bloom Cosmos Seeds — Where to Buy (No Seller Found Yet) | seeds.hues.flowers";
const ZERO_DESCRIPTION =
  "Lonely Bloom Cosmos seeds (Cosmos bipinnatus). No US sellers currently list this variety. Join the waitlist. Lonely Bloom opens single white flowers.";
const ZERO_ANSWER = "No seller found selling Lonely Bloom yet.";
const HONESTY = "Stock is as last seen when we checked each shop — it may have changed since. Prices are shown at the shop, not here.";
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

function expectNoPrice(html: string): void {
  expect(findPriceViolations(html)).toEqual([]);
}

function expectHeadExclusivity(html: string): void {
  expect(countOf(html, /<link rel="canonical"/g), "canonical count").toBe(1);
  expect(countOf(html, /<meta name="description"/g), "description count").toBe(1);
  expect(countOf(html, /<meta property="og:url"/g), "og:url count").toBe(1);
  expect(countOf(html, /<meta property="og:image"/g), "og:image count").toBe(1);
  expect(countOf(html, /<title>/g), "title count").toBe(1);
}

describe("SSR render, with-sellers (raw-HTML drive, no JavaScript)", () => {
  it("serves 200 with the §9 cache headers", async () => {
    const res = await get(`/variety/${WITH_SELLERS}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
  });

  it("renders the exact title, description, canonical, H1, eyebrow, and answer sentence", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(html).toContain(`<title>${WITH_TITLE}</title>`);
    expect(meta(html, "name", "description")).toBe(WITH_DESCRIPTION);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety/${WITH_SELLERS}"`);
    expect(html).toContain("<h1");
    expect(html).toContain("King's Ransom");
    expect(html).toContain("Sweet Pea seeds");
    expect(html).toContain("Lathyrus odoratus");
    expect(html).toContain(`data-testid="answer">${WITH_ANSWER}`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(stripScripts(html).includes("noindex")).toBe(false);
  });

  it("renders the hero plate whole with fixed dimensions", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(html).toContain('data-testid="variety-hero"');
    expect(html).toContain('alt="King\'s Ransom Sweet Pea — illustration"');
    expect(html).toContain('width="1120"');
    expect(html).toContain('height="2240"');
    expect(html).toContain("images.seeds.hues.flowers");
  });

  it("renders every facts row with links, plus rating, aliases, tags, and the swatch", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    for (const label of ["Crop", "Latin name", "Series", "Hue", "Season", "Sowing method", "Pollination", "Height", "Days to bloom"]) {
      expect(html, `facts label ${label}`).toContain(`>${label}<`);
    }
    expect(html).toContain('<a href="/crop/sweet-pea"');
    expect(html).toContain("Lathyrus odoratus");
    expect(html).toContain('<a href="/series/spencer-mix"');
    expect(html).toContain(">Spencer<");
    expect(html).toContain(">Pink<");
    expect(html).toContain("Cool Season Hardy Annuals");
    expect(html).toContain("Direct Sow · Start indoors");
    expect(html).toContain("Open-pollinated");
    expect(html).toContain("180 cm (about 71 in)");
    expect(html).toContain("70 days–80 days");
    expect(html).toContain("Not yet rated");
    expect(html).toContain(">Also sold as<");
    expect(html).toContain(">Tags<");
    expect(html).toContain(">Swatch<");
    expect(html).toContain("Fragrant");
    expect(html).toContain("#E87A9E");
  });

  it("renders description prose with the directory summary", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(html).toContain("King's Ransom bears large, ruffled blooms in deep rose on strong stems.");
    expect(html).toContain("Directory summary:");
    expect(html).toContain(
      "King's Ransom is a Sweet Pea variety (Lathyrus odoratus). It is listed by 2 seed sellers in this directory.",
    );
  });

  it("renders the buy section: summary line, honesty line, chips, and every listing card in full", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(html).toContain("Where to buy King's Ransom Sweet Pea seeds");
    expect(html).toContain("2 shops · 1 in stock");
    expect(html).toContain(HONESTY);
    expect(html).toContain(`href="/variety/${WITH_SELLERS}"`);
    expect(html).toContain(`href="/variety/${WITH_SELLERS}?small_farm=true"`);
    expect(html).toMatch(/aria-current="true"[^>]*>\s*All sellers/s);
    expect(html).toContain("3 listings.");
    // Exactly one seller anchor per listing — a dropped card fails here.
    expect(countOf(html, /<a[^>]*href="\/seller\//g)).toBe(3);
    for (const seller of ["/seller/blue-ridge-seeds", "/seller/prairie-seed-house"]) {
      expect(html, seller).toContain(`href="${seller}"`);
    }
    expect(html).toContain("Blue Ridge Seeds");
    expect(html).toContain("Prairie Seed House");
    expect(countOf(html, /data-small-farm-badge/g)).toBe(3); // two cards + the legend
    expect(html).toContain("Portland, OR");
    expect(html).toContain("Lawrence, KS");
    expect(html).toContain("In stock");
    expect(html).toContain("Sold out");
    expect(html).toContain("Preorder");
    expect(html).toContain("Checked Nov 20");
    expect(html).toContain("Checked Nov 18");
    expect(html).toContain("Not yet checked");
    expect(html).toContain("25 seeds · 1 g (90 seeds)");
    expect(html).toContain("50 seeds");
    expect(html).toContain("Packet sizes vary by season.");
    expect(html).toContain("Treated seed.");
    expect(countOf(html, /href="\/report\?/g)).toBe(4); // three cards + the page-level link
    expect(html).toContain("/report?type=correct&seller=blue-ridge-seeds&variety=sweet-pea-kings-ransom");
    // SSR sort: in-stock first, sold-out last, stable.
    const order = ["/go/1", "/go/3", "/go/2"].map((href) => html.indexOf(`href="${href}"`));
    expect(order.every((p) => p >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("Visit shop →");
  });

  it("renders breadcrumbs as real anchors plus the sowing section and sibling strip", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<a href="/crop/sweet-pea">Sweet Pea</a>');
    expect(html).toContain('<a href="/series/spencer-mix">Spencer series</a>');
    expect(html).toContain("Sowing and growing");
    expect(html).toContain("Sow indoors 4 weeks before last frost.");
    expect(html).toContain("More sweet pea varieties");
    for (const slug of ["sweet-pea-blue-ribbon", "sweet-pea-rose-queen", "sweet-pea-giant-wave"]) {
      expect(html, `sibling ${slug}`).toContain(`href="/variety/${slug}"`);
    }
    expect(html).toContain("Blue Ribbon");
    expect(html).toContain("No sellers yet");
    expect(html).toContain("All Sweet Pea varieties");
  });

  it("emits BreadcrumbList + deduplicated sellers ItemList in JSON-LD", async () => {
    const html = (await get(`/variety/${WITH_SELLERS}`)).text;
    const blocks = ldJsonBlocks(html) as { "@type": string; name?: string; numberOfItems?: number; itemListElement?: { position: number; name?: string; item?: string; url?: string }[] }[];
    expect(blocks.map((b) => b["@type"]).sort()).toEqual(["BreadcrumbList", "ItemList"]);
    const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList")!;
    expect(crumbs.itemListElement!.map((item) => [item.position, item.name, item.item])).toEqual([
      [1, "Home", SITE],
      [2, "Sweet Pea", `${SITE}/crop/sweet-pea`],
      [3, "Spencer series", `${SITE}/series/spencer-mix`],
      [4, "King's Ransom", `${SITE}/variety/${WITH_SELLERS}`],
    ]);
    const sellers = blocks.find((b) => b["@type"] === "ItemList")!;
    expect(sellers.name).toBe("Where to buy King's Ransom seed");
    expect(sellers.numberOfItems).toBe(2);
    expect(sellers.itemListElement!.map((item) => [item.position, item.name, item.url])).toEqual([
      [1, "Blue Ridge Seeds", `${SITE}/seller/blue-ridge-seeds`],
      [2, "Prairie Seed House", `${SITE}/seller/prairie-seed-house`],
    ]);
  });

  it("emits OG + Twitter tags with the media share image (never the canonical)", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}`)).text);
    expect(meta(html, "property", "og:url")).toBe(`${SITE}/variety/${WITH_SELLERS}`);
    expect(meta(html, "property", "og:title")).toBe("King's Ransom Sweet Pea Seeds — Where to Buy (2 Sellers)");
    expect(meta(html, "property", "og:image")).toBe(
      "https://images.seeds.hues.flowers/cdn-cgi/image/width=1120,quality=80,format=auto,fit=scale-down/artwork/sweet-pea-kings-ransom.png",
    );
    expect(meta(html, "property", "og:image:width")).toBe("1120");
    expect(meta(html, "property", "og:image:height")).toBe("2240");
    expect(html.includes("og:image:type")).toBe(false);
    expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "name", "twitter:image")).toBe(meta(html, "property", "og:image"));
    expect(meta(html, "property", "og:image")).not.toBe(meta(html, "property", "og:url"));
  });

  it("keeps exactly one head block (exclusivity, not presence)", async () => {
    expectHeadExclusivity((await get(`/variety/${WITH_SELLERS}`)).text);
  });

  it("shows no price anywhere and no loading placeholder", async () => {
    const html = (await get(`/variety/${WITH_SELLERS}`)).text;
    expectNoPrice(html);
    expect(html).toContain("25 seeds");
    expect(html).toContain("1 g (90 seeds)");
    const text = visibleText(html);
    expect(text).not.toMatch(/loading/i);
    expect(text).not.toMatch(/skeleton/i);
  });
});

describe("SSR render, zero-seller (indexable, with waitlist)", () => {
  it("serves 200 with the no-seller title, description, and answer", async () => {
    const res = await get(`/variety/${ZERO_SELLER}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(html).toContain(`<title>${ZERO_TITLE}</title>`);
    expect(meta(html, "name", "description")).toBe(ZERO_DESCRIPTION);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety/${ZERO_SELLER}"`);
    expect(html).toContain(`data-testid="answer">${ZERO_ANSWER}`);
    expect(html).toContain("No seller found selling Lonely Bloom yet.");
    expect(html).toContain("empty-no-sellers");
  });

  it("stays indexable: no noindex anywhere (decision 27)", async () => {
    const html = (await get(`/variety/${ZERO_SELLER}`)).text;
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(stripScripts(html).includes("noindex")).toBe(false);
  });

  it("server-renders the waitlist floor form with its pre-join fields", async () => {
    const html = decodeHtml((await get(`/variety/${ZERO_SELLER}`)).text);
    expect(html).toContain('id="waitlist-block"');
    expect(html).toContain("Join the waiting list — we’ll let you know when a seller lists Lonely Bloom.");
    expect(html).toContain("<form");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/v1/account/waitlist/join-form"');
    expect(html).toContain('name="variety"');
    expect(html).toContain('value="cosmos-lonely-bloom"');
    expect(html).toContain('id="waitlist-floor-email"');
    expect(html).toContain('name="channel"');
    expect(html).toContain('value="email"');
    expect(html).toContain('value="sms"');
    expect(html).toContain('id="waitlist-floor-phone"');
    expect(html).toContain("Consent is not a condition of purchase.");
  });

  it("omits the sellers ItemList content (empty) but keeps the BreadcrumbList", async () => {
    const html = (await get(`/variety/${ZERO_SELLER}`)).text;
    const blocks = ldJsonBlocks(html) as { "@type": string; numberOfItems?: number; itemListElement?: unknown[] }[];
    expect(blocks.map((b) => b["@type"]).sort()).toEqual(["BreadcrumbList", "ItemList"]);
    const sellers = blocks.find((b) => b["@type"] === "ItemList")!;
    expect(sellers.numberOfItems).toBe(0);
    expect(sellers.itemListElement).toEqual([]);
  });

  it("renders facts with explicit unknowns and no seller filter", async () => {
    const html = decodeHtml((await get(`/variety/${ZERO_SELLER}`)).text);
    expect(html).toContain(">Latin name<");
    expect(html).toContain("Cosmos bipinnatus");
    expect(html).toContain(">Series<");
    expect(html).toContain(">None<");
    expect(html).toContain("No other names on file");
    expect(html).not.toContain("Sowing and growing");
    expect(html).not.toContain('data-testid="variety-seller-filter"');
    expect(html).toContain("More cosmos varieties");
    expect(html).toContain('href="/variety/cosmos-pink-lady"');
    expect(html).toContain('href="/variety/cosmos-white-night"');
  });

  it("uses the generated card as the share image", async () => {
    const html = (await get(`/variety/${ZERO_SELLER}`)).text;
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/variety/${ZERO_SELLER}`);
    expect(meta(html, "property", "og:image:width")).toBe("1200");
    expect(meta(html, "property", "og:image:height")).toBe("630");
    expect(meta(html, "property", "og:image:type")).toBe("image/png");
  });

  it("keeps exactly one head block and shows no price", async () => {
    const html = (await get(`/variety/${ZERO_SELLER}`)).text;
    expectHeadExclusivity(html);
    expectNoPrice(html);
  });
});

describe("small-farms variant (?small_farm=true)", () => {
  const listingRegion = (html: string): string => {
    const start = html.indexOf('id="variety-listings"');
    const end = html.indexOf('id="facts-title"');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return html.slice(start, end);
  };

  it("noindexes with the canonical to the clean URL (never the query string)", async () => {
    const res = await get(`/variety/${WITH_SELLERS}?small_farm=true`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety/${WITH_SELLERS}"`);
    expect(meta(html, "property", "og:url")).toBe(`${SITE}/variety/${WITH_SELLERS}`);
    expect(html).toContain(`<title>${WITH_TITLE}</title>`);
    expect(html).toContain(`data-testid="answer">${WITH_ANSWER}`);
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("narrows the listing region to badged sellers, with legend and aria-current", async () => {
    const html = decodeHtml((await get(`/variety/${WITH_SELLERS}?small_farm=true`)).text);
    expect(html).toMatch(/aria-current="true"[^>]*>\s*Small farms only/s);
    expect(html).toContain("2 of 3 listings · Small farms only.");
    expect(html).toContain("The Small farm badge marks a seller we judge to be a small family farm");
    const region = listingRegion(html);
    expect(region).toContain("Blue Ridge Seeds");
    expect(region).not.toContain("Prairie Seed House");
    expect(countOf(region, /<a[^>]*href="\/seller\//g)).toBe(2);
  });

  it("keeps the full-set sellers ItemList on the variant (narrowing is a view, not a fact base)", async () => {
    const html = (await get(`/variety/${WITH_SELLERS}?small_farm=true`)).text;
    const blocks = ldJsonBlocks(html) as { "@type": string; numberOfItems?: number }[];
    expect(blocks.find((b) => b["@type"] === "ItemList")!.numberOfItems).toBe(2);
  });

  it("renders the small-farm empty state where no badged seller lists the variety", async () => {
    const res = await get(`/variety/${UNBADGED}?small_farm=true`);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain("No seller with the Small farm badge lists Candy Stripe yet.");
    expect(html).toContain("Show all sellers");
    expect(html).toContain('href="/variety/cosmos-candy-stripe"');
    expect(html).toContain("0 of 2 listings · Small farms only.");
    expect(countOf(html, /<a[^>]*href="\/seller\//g)).toBe(0);
    expect(html).not.toContain("The Small farm badge marks");
  });

  it("treats garbage small_farm values as the ordinary page (forgiving parse, 200, indexable)", async () => {
    for (const search of ["?small_farm=yes", "?small_farm=false", "?small_farm=true&small_farm=true"]) {
      const res = await get(`/variety/${WITH_SELLERS}${search}`);
      expect(res.status, search).toBe(200);
      const html = decodeHtml(res.text);
      expect(meta(html, "name", "robots"), search).toBe("index, follow");
      expect(html, search).toContain(`<link rel="canonical" href="${SITE}/variety/${WITH_SELLERS}"`);
      expect(html, search).toContain("3 listings.");
      expect(countOf(html, /<a[^>]*href="\/seller\//g), search).toBe(3);
      expect(html, search).toMatch(/aria-current="true"[^>]*>\s*All sellers/s);
    }
  });
});

describe("unknown facts render 'Unknown', never omitted", () => {
  it("renders every unknown fact row on the unknowns sample", async () => {
    const html = decodeHtml(stripScripts((await get(`/variety/${UNKNOWNS}`)).text));
    for (const label of ["Crop", "Latin name", "Series", "Hue", "Season", "Sowing method", "Pollination", "Height", "Days to bloom"]) {
      expect(html, `facts label ${label}`).toContain(`>${label}<`);
    }
    expect(countOf(html, />Unknown</g)).toBe(7);
    expect(countOf(html, />None</g)).toBe(1);
    expect(html).not.toContain(">Swatch<");
    expect(html).not.toContain('data-testid="variety-seller-filter"');
  });
});

describe("statuses & redirects (permanent redirects are 301, uniformly)", () => {
  it("404s unknown slugs with the 404 page (never the app shell with a 200)", async () => {
    const res = await get("/variety/definitely-not-a-variety", false);
    expect(res.status).toBe(404);
    const html = decodeHtml(res.text);
    expect(html).toContain("We couldn’t find that page");
    expect(html).toContain("The link may be old, or the variety or seller may have been removed.");
    expect(html).toContain('action="/search"');
    expect(html).toContain("All varieties");
    expect(html).toContain("All sellers");
  });

  it("404s malformed slugs", async () => {
    for (const slug of ["Bad_Slug", "UPPER", "-lead", "trail-", "a--b", "with%20space"]) {
      const res = await get(`/variety/${slug}`, false);
      expect(res.status, slug).toBe(404);
      expect(decodeHtml(res.text), slug).toContain("We couldn’t find that page");
    }
  });

  it("301s merged slugs to the survivor in one hop", async () => {
    const res = await get(`/variety/${MERGED}`, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/variety/${WITH_SELLERS}`);
    const followed = await get(`/variety/${MERGED}`);
    expect(followed.status).toBe(200);
    expect(decodeHtml(followed.text)).toContain(`data-testid="answer">${WITH_ANSWER}`);
  });

  it("preserves ?small_farm=true across the merged redirect", async () => {
    const res = await get(`/variety/${MERGED}?small_farm=true`, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/variety/${WITH_SELLERS}?small_farm=true`);
    const followed = await get(`/variety/${MERGED}?small_farm=true`);
    expect(followed.status).toBe(200);
    expect(meta(followed.text, "name", "robots")).toBe("noindex, follow");
  });

  it("301s plural legacy paths to their singular canonicals", async () => {
    const res = await get(`/varieties/${WITH_SELLERS}`, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/variety/${WITH_SELLERS}`);
    expect((await get(`/varieties/${WITH_SELLERS}`)).status).toBe(200);
    const bare = await get("/varieties", false);
    expect(bare.status).toBe(301);
    expect(bare.headers.get("location")).toBe("/variety");
  });

  it("301s legacy ?v= slugs to the variety page", async () => {
    const res = await get(`/variety?v=${WITH_SELLERS}`, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/variety/${WITH_SELLERS}`);
    expect((await get(`/variety?v=${WITH_SELLERS}`)).status).toBe(200);
    const normalized = await get("/variety?v=%20Sweet-Pea-Kings-Ransom%20", false);
    expect(normalized.status).toBe(301);
    expect(normalized.headers.get("location")).toBe(`/variety/${WITH_SELLERS}`);
  });

  it("never serves the internal small-farms path (301 to the public URL)", async () => {
    const res = await get(`/variety/${WITH_SELLERS}/small-farms`, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/variety/${WITH_SELLERS}?small_farm=true`);
    const followed = await get(`/variety/${WITH_SELLERS}/small-farms`);
    expect(followed.status).toBe(200);
    expect(meta(followed.text, "name", "robots")).toBe("noindex, follow");
  });
});

describe("OG cards", () => {
  it("serves 1200×630 PNGs for variety and site cards", async () => {
    for (const path of [`/og/variety/${WITH_SELLERS}`, "/og/site/default"]) {
      const res = await getBytes(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toBe("image/png");
      expect(pngDims(res.body), path).toEqual({ width: 1200, height: 630 });
    }
  });

  it("serves 1200×630 PNGs for seller and crop cards", async () => {
    for (const path of ["/og/seller/blue-ridge-seeds", "/og/crop/sweet-pea"]) {
      const res = await getBytes(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toBe("image/png");
      expect(pngDims(res.body), path).toEqual({ width: 1200, height: 630 });
    }
  });

  it("404s malformed slugs, missing records, and unknown kinds (no card)", async () => {
    for (const path of ["/og/variety/BAD-SLUG", "/og/variety/no-such-variety", "/og/nope/x"]) {
      expect((await getBytes(path)).status, path).toBe(404);
    }
  });
});

describe("freshness spot-check", () => {
  it("renders the data source's current stock word and checked date", async () => {
    const listing = stub.state.details[UNKNOWNS]!.listings[0]!;
    const html = decodeHtml((await get(`/variety/${UNKNOWNS}`)).text);
    expect(listing.availability).toBe("in_stock");
    expect(html).toContain("In stock");
    expect(html).toContain("Checked Nov 19");
    expect(listing.lastCheckedAt?.slice(0, 10)).toBe("2026-11-19");
  });
});

// The invalidation proof mutates the stub catalog: it runs LAST.
describe("cache-invalidation proof on the built artifact", () => {
  it("serves the new stock state and date after a variety-tag revalidate (no rebuild, no cache-bust)", async () => {
    const page = `/variety/${WITH_SELLERS}`;
    const variant = `${page}?small_farm=true`;
    // Warm both edge entries (the variant keys separately).
    expect((await get(page)).status).toBe(200);
    expect((await get(variant)).status).toBe(200);

    // The catalog write: listing 1 sells out; the checked date moves.
    stub.state.details[WITH_SELLERS]!.listings[0]!.availability = "sold_out";
    stub.state.details[WITH_SELLERS]!.listings[0]!.lastCheckedAt = "2026-11-21T09:00:00.000Z";

    // Stale reads first: both entries still serve the old state (the
    // staleness the hook exists to cure — the purge below must earn the flip).
    expect(decodeHtml((await get(page)).text)).toContain(`data-testid="answer">${WITH_ANSWER}`);
    expect(decodeHtml((await get(variant)).text)).toContain(`data-testid="answer">${WITH_ANSWER}`);

    // The write path POSTs the variety tag (Bearer auth, v2 convention).
    const revalidate = await fetch(`${BASE}/internal/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ tags: [`variety:${WITH_SELLERS}`] }),
    });
    expect(revalidate.status).toBe(200);
    const result = (await revalidate.json()) as { revalidated: boolean; paths: string[]; purged: string[] };
    expect(result.revalidated).toBe(true);
    expect(result.paths).toContain(page);
    expect(result.paths).toContain(variant);
    expect(result.purged).toContain(`variety:detail:${WITH_SELLERS}`);

    // After: the page AND its variant carry the new state and date — no
    // rebuild ran, no cache-busting parameter was sent.
    const freshAnswer = "As of Nov 21, 2026, 2 sellers list King's Ransom: Blue Ridge Seeds and Prairie Seed House.";
    for (const url of [page, variant]) {
      const html = decodeHtml((await get(url)).text);
      expect(html, url).toContain(`data-testid="answer">${freshAnswer}`);
      expect(html, url).toContain("Checked Nov 21");
      expect(html, url).toContain("2 shops · 0 in stock");
    }
  });

  it("refuses revalidate POSTs without the bearer secret", async () => {
    const res = await fetch(`${BASE}/internal/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: JSON.stringify({ tags: [`variety:${WITH_SELLERS}`] }),
    });
    expect(res.status).toBe(401);
  });
});
