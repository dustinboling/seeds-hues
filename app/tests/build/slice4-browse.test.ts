/**
 * Slice 4 surface contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub serving the browse catalog)
 * over plain HTTP with no JavaScript, Quinn-style. Every expectation is
 * hardcoded from the v2 sources and Bea's audit — never computed by the
 * app under test.
 *
 * Fixtures (tests/unit/browse-catalog.ts): 55 varieties (Blue Ribbon first
 * at name sort; "Testbloom 21" first on page 2; "Pink Lady" first at
 * availability sort; "Testbloom 14" first at recent sort), 26 sellers (Blue
 * Ridge Seeds first; Testbloom Farm 23–24 on page 2), the Testbloom crop +
 * Testbloom Cascade series (the four-group search query "testbloom").
 *
 * Readings recorded (brief ambiguities, resolved against "port faithfully;
 * do not invent copy"): v2's search groups carry NO per-group count
 * numerals — the h3 labels plus the truthful total are the shipped UI — so
 * "truthful per-group counts" is asserted by counting each group's anchors
 * (Crops 1, Series 1, Varieties 50, Sellers 5) plus the exact total heading,
 * which makes the Tranche 3.4 dropped-group defect structurally impossible
 * without inventing UI. Sort-only views are indexable with a sort-free
 * canonical (v2's generateMetadata: sort is not a filter group; robots
 * carries the ?sort= disallow, already shipped in Slice 2).
 *
 * The invalidation proof runs LAST: it mutates the stub catalog.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { browseCatalogState } from "../unit/browse-catalog";
import { findPriceViolations, stripScriptElements } from "../unit/price-guard";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITE = "https://seeds.hues.flowers";
const SECRET = "slice4-revalidate-secret";

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

interface LdItemList {
  "@type": string;
  name?: string;
  numberOfItems?: number;
  itemListElement?: { position: number; name?: string; url?: string; item?: string }[];
}

const itemLists = (html: string): LdItemList[] =>
  (ldJsonBlocks(html) as LdItemList[]).filter((b) => b["@type"] === "ItemList");

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

async function get(path: string, follow = true): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${BASE}${path}`, { redirect: follow ? "follow" : "manual" });
  return { status: res.status, headers: res.headers, text: await res.text() };
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
  stub = await startStubApi(browseCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await buildApp(apiBase);
  server = await startServer(apiBase);
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await stub?.close();
});

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
const VARIETY_DESCRIPTION =
  "Every flower seed variety in the directory, alphabetical, with how many sellers list it and when each listing was last checked.";
const SELLER_DESCRIPTION =
  "US farms and seed companies of every size that sell flower seed, with the varieties each one carries and when each listing was last checked.";
const SEARCH_DESCRIPTION = "Search flower seed varieties, crops, series and sellers by any name a variety goes by.";

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

describe("/variety page 1 SSR (raw HTML, no JavaScript)", () => {
  it("serves 200 with the §9 cache headers", async () => {
    const res = await get("/variety");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
  });

  it("renders the H1, count line, title, description, and self-canonical", async () => {
    const html = decodeHtml((await get("/variety")).text);
    expect(html).toContain("<h1");
    expect(html).toContain("Flower seed varieties");
    expect(html).toContain("55 varieties, alphabetical. Page 1 of 3.");
    expect(html).toContain(`<title>All flower seed varieties | seeds.hues.flowers</title>`);
    expect(meta(html, "name", "description")).toBe(VARIETY_DESCRIPTION);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety"`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/site/default`);
  });

  it("renders ItemList with exactly 24 entries, positions 1–24, first card Blue Ribbon", async () => {
    const html = (await get("/variety")).text;
    const lists = itemLists(html);
    expect(lists).toHaveLength(1);
    const list = lists[0]!;
    expect(list.name).toBe("Flower seed varieties");
    expect(list.numberOfItems).toBe(24);
    expect(list.itemListElement).toHaveLength(24);
    expect(list.itemListElement!.map((e) => e.position)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(list.itemListElement![0]).toMatchObject({ position: 1, name: "Blue Ribbon" });
    expect(list.itemListElement![23]).toMatchObject({ position: 24, name: "Testbloom 20" });
    // The first card's name = the fixture's alphabetical first (visible card, not just JSON-LD).
    const body = decodeHtml(stripScripts(html));
    expect(body.indexOf("Blue Ribbon")).toBeGreaterThan(0);
    expect(body.indexOf("Blue Ribbon")).toBeLessThan(body.indexOf("Testbloom 01"));
  });

  it("links cards to /variety/{slug} and exposes a real page-2 anchor", async () => {
    const html = decodeHtml(stripScripts((await get("/variety")).text));
    expect(html).toContain('href="/variety/sweet-pea-blue-ribbon"');
    expect(html).toContain('href="/variety?page=2"');
    // Breadcrumb trail as real anchors.
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('href="/variety"');
  });

  it("renders filter + sort controls as real links to the §1.3 parameterized URLs", async () => {
    const html = decodeHtml(stripScripts((await get("/variety")).text));
    expect(html).toContain('href="/variety?color_family=yellow"');
    expect(html).toContain('href="/variety?season=cool"');
    expect(html).toContain('href="/variety?sort=recent"');
    expect(html).toContain('href="/variety?sort=availability"');
  });

  it("shows no price anywhere and no loading placeholder", async () => {
    const html = (await get("/variety")).text;
    expectNoPrice(html);
    const text = visibleText(html);
    expect(text).not.toMatch(/loading/i);
    expect(text).not.toMatch(/skeleton/i);
  });
});

describe("/variety page 2 (self-canonical paging)", () => {
  it("serves 200 with a SELF-canonical to ?page=2 (never canonicalized to page 1)", async () => {
    const res = await get("/variety?page=2");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety?page=2"`);
    expect(html).toContain(`<title>All flower seed varieties — page 2 | seeds.hues.flowers</title>`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).toContain("55 varieties, alphabetical. Page 2 of 3.");
  });

  it("continues ItemList positions at 25 with zero name overlap with page 1", async () => {
    const [p1, p2] = await Promise.all([(await get("/variety")).text, (await get("/variety?page=2")).text]);
    const names1 = new Set(itemLists(p1)[0]!.itemListElement!.map((e) => e.name));
    const list2 = itemLists(p2)[0]!;
    expect(list2.numberOfItems).toBe(24);
    expect(list2.itemListElement!.map((e) => e.position)).toEqual(Array.from({ length: 24 }, (_, i) => i + 25));
    expect(list2.itemListElement![0]).toMatchObject({ position: 25, name: "Testbloom 21" });
    for (const e of list2.itemListElement!) expect(names1.has(e.name)).toBe(false);
  });

  it("serves page 3 with the final 7 items at positions 49–55", async () => {
    const html = (await get("/variety?page=3")).text;
    const list = itemLists(html)[0]!;
    expect(list.numberOfItems).toBe(7);
    expect(list.itemListElement!.map((e) => e.position)).toEqual([49, 50, 51, 52, 53, 54, 55]);
    expect(list.itemListElement![0]).toMatchObject({ position: 49, name: "Testbloom 45" });
    expect(list.itemListElement![6]).toMatchObject({ position: 55, name: "White Night" });
  });
});

describe("?page=1 → a single 301 to the clean route (Bea §4.1, new behavior)", () => {
  it("/variety?page=1 301s to /variety in one hop", async () => {
    const res = await get("/variety?page=1", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/variety");
    expect((await get("/variety?page=1")).status).toBe(200);
  });

  it("/seller?page=1 301s to /seller in one hop", async () => {
    const res = await get("/seller?page=1", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/seller");
    expect((await get("/seller?page=1")).status).toBe(200);
  });

  it("keeps the other params when stripping page=1 (filtered page 1 → filtered clean)", async () => {
    const res = await get("/variety?color_family=yellow&page=1", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/variety?color_family=yellow");
    const seller = await get("/seller?state=OR&page=1", false);
    expect(seller.status).toBe(301);
    expect(seller.headers.get("location")).toBe("/seller?state=OR");
  });
});

describe("out-of-range and malformed ?page= → true 404 (no empty 200, no clamp)", () => {
  it.each(["?page=99", "?page=0", "?page=-1", "?page=abc", "?page=2.5"])("/variety%s 404s", async (query) => {
    const res = await get(`/variety${query}`, false);
    expect(res.status).toBe(404);
    expect(decodeHtml(res.text)).toContain("We couldn’t find that page");
  });

  it.each(["?page=99", "?page=0", "?page=abc"])("/seller%s 404s", async (query) => {
    const res = await get(`/seller${query}`, false);
    expect(res.status).toBe(404);
    expect(decodeHtml(res.text)).toContain("We couldn’t find that page");
  });

  it("404s a filtered page past the filtered end (?color_family=yellow has one page)", async () => {
    const res = await get("/variety?color_family=yellow&page=2", false);
    expect(res.status).toBe(404);
    expect(decodeHtml(res.text)).toContain("We couldn’t find that page");
  });
});

describe("/variety filtered views (noindex + canonical-to-clean)", () => {
  it("?color_family=yellow: 200, noindex, canonical exactly /variety, 16-item ItemList", async () => {
    const res = await get("/variety?color_family=yellow");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety"`);
    expect(html).toContain(`<title>Yellow — flower seed varieties | seeds.hues.flowers</title>`);
    expect(html).toContain("16 varieties · Yellow, alphabetical.");
    const list = itemLists(res.text)[0]!;
    expect(list.numberOfItems).toBe(16);
    expect(list.itemListElement!.map((e) => e.position)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("renders the filtered SET: yellow names present AND non-yellow names absent", async () => {
    const html = decodeHtml(stripScripts((await get("/variety?color_family=yellow")).text));
    for (const present of ["Testbloom 03", "Testbloom 06", "Testbloom 48"]) {
      expect(html, `present ${present}`).toContain(present);
    }
    for (const absent of ["Testbloom 01", "Testbloom 02", "Blue Ribbon", "White Night"]) {
      expect(html, `absent ${absent}`).not.toContain(absent);
    }
  });

  it("multi-hue selection renders the OR-union (yellow + white, pink excluded)", async () => {
    const res = await get("/variety?color_family=yellow,white");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety"`);
    expect(html).toContain("33 varieties · White · Yellow, alphabetical. Page 1 of 2.");
    // Page 1 carries the union's head (NN 02–36 at 24/page); page 2 its
    // tail (NN 38–50) — every originally asserted name stays asserted, on
    // the page the paging rule puts it.
    const body = decodeHtml(stripScripts(res.text));
    for (const present of ["Testbloom 03", "Testbloom 02"]) {
      expect(body, `present ${present}`).toContain(present);
    }
    for (const absent of ["Testbloom 01", "Testbloom 04", "Blue Ribbon"]) {
      expect(body, `absent ${absent}`).not.toContain(absent);
    }
    const page2 = decodeHtml(stripScripts((await get("/variety?color_family=yellow,white&page=2")).text));
    for (const present of ["Testbloom 48", "Testbloom 50"]) {
      expect(page2, `present ${present}`).toContain(present);
    }
    for (const absent of ["Testbloom 01", "Testbloom 04", "Blue Ribbon"]) {
      expect(page2, `absent ${absent}`).not.toContain(absent);
    }
  });

  it("combined hue + season renders the AND-intersection", async () => {
    const html = decodeHtml(stripScripts((await get("/variety?color_family=yellow&season=cool")).text));
    expect(html).toContain("8 varieties · Cool Season Hardy Annuals · Yellow, alphabetical.");
    for (const present of ["Testbloom 03", "Testbloom 09", "Testbloom 45"]) {
      expect(html, `present ${present}`).toContain(present);
    }
    // Yellow but warm (even NN); cool but pink/white; unfiltered fixtures.
    for (const absent of ["Testbloom 06", "Testbloom 12", "Testbloom 01", "Testbloom 02", "Blue Ribbon"]) {
      expect(html, `absent ${absent}`).not.toContain(absent);
    }
  });

  it("renders the applied row: one remover per hue + Clear all back to the clean route", async () => {
    const html = decodeHtml(stripScripts((await get("/variety?color_family=yellow,white")).text));
    expect(html).toContain("Hue: Yellow");
    expect(html).toContain("Hue: White");
    expect(html).toContain("Clear all filters");
    expect(html).toContain('href="/variety"');
  });

  it("forgives garbage filter values (unfiltered 200, never a 404)", async () => {
    const res = await get("/variety?color_family=notacolor");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety"`);
    expect(html).toContain("55 varieties, alphabetical. Page 1 of 3.");
  });

  it("renders the honest empty state (200, noindex) when filters match nothing", async () => {
    const res = await get("/variety?life_cycle=biennial");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain("0 varieties · Biennial, alphabetical.");
    expect(decodeHtml(stripScripts(res.text))).toContain("No varieties match.");
  });
});

describe("/variety sort (?sort= is an ordering, not a filter group)", () => {
  it("?sort=availability leads with Pink Lady (in stock, most sellers)", async () => {
    const html = (await get("/variety?sort=availability")).text;
    expect(itemLists(html)[0]!.itemListElement![0]).toMatchObject({ position: 1, name: "Pink Lady" });
    expect(decodeHtml(html)).toContain("55 varieties, most sellers first. Page 1 of 3.");
  });

  it("?sort=recent leads with Testbloom 14 (checked Nov 24, earliest name on ties)", async () => {
    const html = (await get("/variety?sort=recent")).text;
    expect(itemLists(html)[0]!.itemListElement![0]).toMatchObject({ position: 1, name: "Testbloom 14" });
    expect(decodeHtml(html)).toContain("55 varieties, most recently checked first. Page 1 of 3.");
  });

  it("sort-only views stay indexable with a sort-free canonical (robots carries ?sort=)", async () => {
    for (const query of ["?sort=availability", "?sort=recent"]) {
      const html = decodeHtml((await get(`/variety${query}`)).text);
      expect(meta(html, "name", "robots"), query).toBe("index, follow");
      expect(html, query).toContain(`<link rel="canonical" href="${SITE}/variety"`);
      // The CANONICAL is sort-free (the test's stated intent, same as the
      // facet audit below): the page body necessarily carries ?sort= links
      // — the sort control this suite requires at "renders filter + sort
      // controls as real links" — so the whole-HTML assertion could never
      // pass alongside it.
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      expect(canonical, query).not.toContain("sort=");
    }
  });

  it("sort + filter composes (filtered rule wins: noindex + canonical clean)", async () => {
    const res = await get("/variety?color_family=yellow&sort=recent");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/variety"`);
  });

  it("forgives garbage sort values (Name A–Z fallback, 200)", async () => {
    const html = (await get("/variety?sort=garbage")).text;
    expect(itemLists(html)[0]!.itemListElement![0]).toMatchObject({ position: 1, name: "Blue Ribbon" });
  });
});

describe("/seller page 1 SSR (raw HTML, no JavaScript)", () => {
  it("serves 200 with the §9 cache headers", async () => {
    const res = await get("/seller");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
  });

  it("renders the H1, count line, title, description, and self-canonical", async () => {
    const html = decodeHtml((await get("/seller")).text);
    expect(html).toContain("<h1");
    expect(html).toContain("Flower seed sellers");
    expect(html).toContain("26 sellers — US farms and seed companies of every size. Sellers do not pay for placement. Page 1 of 2.");
    expect(html).toContain(`<title>Flower seed sellers | seeds.hues.flowers</title>`);
    expect(meta(html, "name", "description")).toBe(SELLER_DESCRIPTION);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/seller"`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(meta(html, "property", "og:image")).toBe(`${SITE}/og/site/default`);
  });

  it("renders ItemList with exactly 24 entries, positions 1–24, first card Blue Ridge Seeds", async () => {
    const html = (await get("/seller")).text;
    const lists = itemLists(html);
    expect(lists).toHaveLength(1);
    const list = lists[0]!;
    expect(list.name).toBe("Flower seed sellers");
    expect(list.numberOfItems).toBe(24);
    expect(list.itemListElement).toHaveLength(24);
    expect(list.itemListElement!.map((e) => e.position)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(list.itemListElement![0]).toMatchObject({ position: 1, name: "Blue Ridge Seeds" });
  });

  it("links cards to /seller/{slug} with location, type, and variety count — plus a page-2 anchor", async () => {
    const html = decodeHtml(stripScripts((await get("/seller")).text));
    expect(html).toContain('href="/seller/blue-ridge-seeds"');
    expect(html).toContain("Portland, OR");
    expect(html).toContain("Retail seed shop");
    expect(html).toContain("5 varieties listed");
    expect(html).toContain("Not yet rated");
    expect(html).toContain('href="/seller?page=2"');
  });

  it("renders the farms artwork, the Small Farm legend, and the state filter as real links", async () => {
    const html = decodeHtml(stripScripts((await get("/seller")).text));
    expect(html).toContain("farms-basket");
    expect(html).toContain("<img");
    expect(html).toContain("The Small farm badge marks a seller we judge to be a small family farm");
    expect(html).toContain('href="/seller?state=OR"');
    expect(html).toContain('href="/seller?state=KS"');
    expect(html).toContain('href="/seller?state=CA"');
  });

  it("serves page 2 self-canonical with Farm 23–24 at positions 25–26", async () => {
    const res = await get("/seller?page=2");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/seller?page=2"`);
    expect(html).toContain(`<title>Flower seed sellers — page 2 | seeds.hues.flowers</title>`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    const list = itemLists(res.text)[0]!;
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement!.map((e) => [e.position, e.name])).toEqual([
      [25, "Testbloom Farm 23"],
      [26, "Testbloom Farm 24"],
    ]);
  });

  it("shows no price anywhere and no loading placeholder", async () => {
    const html = (await get("/seller")).text;
    expectNoPrice(html);
    const text = visibleText(html);
    expect(text).not.toMatch(/loading/i);
    expect(text).not.toMatch(/skeleton/i);
  });
});

describe("/seller state-filtered views (?state= → noindex + canonical /seller)", () => {
  it("?state=OR: 200, noindex, canonical exactly /seller, Oregon sellers only", async () => {
    const res = await get("/seller?state=OR");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/seller"`);
    expect(html).toContain(`<title>Seed sellers in Oregon | seeds.hues.flowers</title>`);
    expect(html).toContain("9 sellers in Oregon.");
    expect(html).toContain('href="/state/oregon"');
    expect(html).toContain("Seed sellers in Oregon");
    const list = itemLists(res.text)[0]!;
    expect(list.name).toBe("Flower seed sellers in Oregon");
    expect(list.numberOfItems).toBe(9);
    const body = decodeHtml(stripScripts(res.text));
    for (const present of ["Blue Ridge Seeds", "Testbloom Farm 01", "Testbloom Farm 08"]) {
      expect(body, `present ${present}`).toContain(present);
    }
    for (const absent of ["Prairie Seed House", "Testbloom Farm 09", "Testbloom Farm 17"]) {
      expect(body, `absent ${absent}`).not.toContain(absent);
    }
  });

  it("renders the single State remover and omits Clear All (the §2.6.2 bounded exception)", async () => {
    const html = decodeHtml(stripScripts((await get("/seller?state=OR")).text));
    expect(html).toContain("State: Oregon");
    expect(html).not.toContain("Clear all");
  });

  it("normalizes lowercase codes (?state=or behaves as ?state=OR)", async () => {
    const res = await get("/seller?state=or");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain("9 sellers in Oregon.");
  });

  it("forgives unknown codes (?state=XX reads as All states: indexable, 200, never 404)", async () => {
    const res = await get("/seller?state=XX");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/seller"`);
    expect(html).toContain("26 sellers — US farms and seed companies of every size.");
  });
});

describe("/search with a multi-group query (server-rendered, every group, truthful total)", () => {
  const Q = "/search?q=testbloom";

  it("serves 200 with the §9 cache headers, noindex, and canonical exactly /search", async () => {
    const res = await get(Q);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe(CACHE_CONTROL);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/search"`);
    expect(html).toContain(`<title>Search: testbloom | seeds.hues.flowers</title>`);
    expect(meta(html, "name", "description")).toBe(SEARCH_DESCRIPTION);
  });

  it("renders the query-filled search box and the truthful total heading", async () => {
    const html = decodeHtml(stripScripts((await get(Q)).text));
    expect(html).toContain("<h1");
    expect(html).toContain(">Search<");
    expect(html).toContain('action="/search"');
    expect(html).toContain('name="q"');
    expect(html).toContain('value="testbloom"');
    expect(html).toContain("57 results for “testbloom”");
  });

  it("renders EVERY matching group with truthful per-group counts (the Tranche 3.4 guard)", async () => {
    const html = decodeHtml(stripScripts((await get(Q)).text));
    // Group labels present — no group silently dropped.
    for (const label of [">Crops<", ">Series<", ">Varieties<", ">Sellers<"]) {
      expect(html, `group ${label}`).toContain(label);
    }
    // Per-group membership counted from the rendered anchors (slug anchors
    // only — bare hub paths never match these patterns).
    const varietyAnchors = countOf(html, /href="\/variety\/[a-z0-9-]+"/g);
    const cropAnchors = countOf(html, /href="\/crop\/[a-z0-9-]+"/g);
    const seriesAnchors = countOf(html, /href="\/series\/[a-z0-9-]+"/g);
    const sellerAnchors = countOf(html, /href="\/seller\/[a-z0-9-]+"/g);
    expect(varietyAnchors, "Varieties anchors").toBe(50);
    expect(cropAnchors, "Crops anchors").toBe(1);
    expect(seriesAnchors, "Series anchors").toBe(1);
    expect(sellerAnchors, "Sellers anchors").toBe(5);
    // Spot members + the capped seller set's exact membership.
    expect(html).toContain('href="/variety/testbloom-01"');
    expect(html).toContain('href="/crop/testbloom"');
    expect(html).toContain('href="/series/testbloom-cascade"');
    expect(html).toContain('href="/seller/testbloom-farm-01"');
    expect(html).toContain('href="/seller/testbloom-farm-05"');
    expect(html).not.toContain('href="/seller/testbloom-farm-06"');
    // The total heading counts exactly the rendered groups (57 = 50+1+1+5).
    expect(varietyAnchors + cropAnchors + seriesAnchors + sellerAnchors).toBe(57);
  });

  it("shows no price anywhere and no loading placeholder", async () => {
    const html = (await get(Q)).text;
    expectNoPrice(html);
    const text = visibleText(html);
    expect(text).not.toMatch(/loading/i);
    expect(text).not.toMatch(/skeleton/i);
  });
});

describe("/search zero-results (200 with the honest state, never a 404)", () => {
  it("?q=testbloomx: 200, artwork, Nothing-matches copy, report link, did-you-mean", async () => {
    const res = await get("/search?q=testbloomx");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/search"`);
    expect(html).toContain("Not in the catalog yet");
    const body = decodeHtml(stripScripts(res.text));
    expect(body).toContain("empty-search");
    expect(body).toContain("Nothing matches “testbloomx”.");
    expect(body).toContain('href="/report?type=correct"');
    expect(body).toContain("Did you mean");
    expect(body).toContain('href="/search?q=Testbloom"');
    expect(body).toContain(">Testbloom<");
    // No result anchors anywhere in the zero state.
    expect(countOf(body, /href="\/(variety|crop|series|seller)\/[a-z0-9-]+"/g)).toBe(0);
  });

  it("?q=zxqv: 200 with the zero state and NO suggestion when nothing qualifies", async () => {
    const res = await get("/search?q=zxqv");
    expect(res.status).toBe(200);
    const body = decodeHtml(stripScripts(res.text));
    expect(body).toContain("Nothing matches “zxqv”.");
    expect(body).not.toContain("Did you mean");
  });
});

describe("/search bare + over-long queries", () => {
  it("bare /search: 200, search form, guidance, browse chips, noindex", async () => {
    const res = await get("/search");
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/search"`);
    expect(html).toContain(`<title>Search flower seeds | seeds.hues.flowers</title>`);
    const body = decodeHtml(stripScripts(res.text));
    expect(body).toContain('action="/search"');
    expect(body).toContain('name="q"');
    expect(body).toContain("Not sure what to search for?");
    expect(body).toContain("Two letters are enough to start");
    expect(body).toContain('href="/crop"');
    expect(body).toContain('href="/variety"');
    expect(body).toContain('href="/seller"');
  });

  it("truncates an over-long ?q= at 100 chars (200, never an error)", async () => {
    const long = "a".repeat(150);
    const res = await get(`/search?q=${long}`);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain(`<title>Search: ${"a".repeat(100)} | seeds.hues.flowers</title>`);
  });
});

describe("head exclusivity on every new template (the Slice 2 F6 lesson)", () => {
  it.each([
    "/variety",
    "/variety?page=2",
    "/variety?color_family=yellow",
    "/seller",
    "/seller?page=2",
    "/seller?state=OR",
    "/search",
    "/search?q=testbloom",
    "/search?q=testbloomx",
  ])("%s keeps exactly one head block", async (path) => {
    expectHeadExclusivity((await get(path)).text);
  });
});

describe("price guard on every new template (visible copy, meta, OG, JSON-LD)", () => {
  it.each([
    "/variety",
    "/variety?page=2",
    "/variety?color_family=yellow",
    "/seller",
    "/seller?page=2",
    "/seller?state=OR",
    "/search",
    "/search?q=testbloom",
    "/search?q=testbloomx",
  ])("%s shows no price anywhere", async (path) => {
    expectNoPrice((await get(path)).text);
  });
});

describe("facet canonical audit: every parameterized URL the UI can produce", () => {
  // Filtered views: noindex + canonical to the clean route (Bea §1.3). None
  // is a promoted landing at conversion time, so there are no exceptions.
  const FILTERED: [path: string, clean: string][] = [
    // /variety single-group options (every chip the UI renders).
    ["/variety?season=cool", "/variety"],
    ["/variety?season=warm", "/variety"],
    ["/variety?method=direct", "/variety"],
    ["/variety?method=trays", "/variety"],
    ["/variety?life_cycle=annual", "/variety"],
    ["/variety?life_cycle=biennial", "/variety"],
    ["/variety?life_cycle=perennial", "/variety"],
    ["/variety?color_family=white", "/variety"],
    ["/variety?color_family=blush", "/variety"],
    ["/variety?color_family=pink", "/variety"],
    ["/variety?color_family=peach", "/variety"],
    ["/variety?color_family=orange", "/variety"],
    ["/variety?color_family=yellow", "/variety"],
    ["/variety?color_family=red", "/variety"],
    ["/variety?color_family=burgundy", "/variety"],
    ["/variety?color_family=purple", "/variety"],
    ["/variety?color_family=blue", "/variety"],
    ["/variety?color_family=green", "/variety"],
    ["/variety?color_family=chocolate", "/variety"],
    ["/variety?color_family=mix", "/variety"],
    ["/variety?small_farm=true", "/variety"],
    // /variety combinations (multi-hue, cross-group AND, filtered paging).
    ["/variety?color_family=yellow,white", "/variety"],
    ["/variety?color_family=pink,yellow,white", "/variety"],
    ["/variety?color_family=yellow&season=cool", "/variety"],
    ["/variety?season=warm&life_cycle=perennial", "/variety"],
    ["/variety?small_farm=true&season=cool", "/variety"],
    ["/variety?color_family=pink,white&page=2", "/variety"],
    ["/variety?season=cool&page=2", "/variety"],
    // /seller state views.
    ["/seller?state=OR", "/seller"],
    ["/seller?state=KS", "/seller"],
    ["/seller?state=CA", "/seller"],
    // /search filtered views (every search URL is noindex regardless).
    ["/search?q=testbloom&season=cool", "/search"],
    ["/search?q=testbloom&color_family=yellow", "/search"],
    ["/search?q=testbloom&method=trays&life_cycle=annual", "/search"],
  ];

  it(`all ${FILTERED.length} filtered URLs are noindex + canonical-to-clean`, async () => {
    expect(FILTERED).toHaveLength(34);
    for (const [path, clean] of FILTERED) {
      const res = await get(path);
      expect(res.status, path).toBe(200);
      const html = decodeHtml(res.text);
      expect(meta(html, "name", "robots"), path).toBe("noindex, follow");
      expect(html, path).toContain(`<link rel="canonical" href="${SITE}${clean}"`);
      // The canonical is the CLEAN route — no query string survives on it.
      expect(html, path).not.toContain(`<link rel="canonical" href="${SITE}${clean}?`);
    }
  });

  it("sort-only URLs keep a sort-free canonical (indexable per v2, robots-disallowed per §1.3)", async () => {
    for (const path of ["/variety?sort=availability", "/variety?sort=recent", "/variety?sort=recent&page=2"]) {
      const html = decodeHtml((await get(path)).text);
      expect(meta(html, "name", "robots"), path).toBe("index, follow");
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      expect(canonical, path).not.toContain("sort=");
    }
  });
});

describe("sitemap: no pagination URL in any served segment (Slice 2 machinery, no regression)", () => {
  const SEGMENTS = [
    "/sitemap.xml",
    "/sitemap-varieties-listed.xml",
    "/sitemap-varieties-zero-seller.xml",
    "/sitemap-sellers.xml",
    "/sitemap-crops.xml",
    "/sitemap-series.xml",
    "/sitemap-states.xml",
    "/sitemap-hubs.xml",
  ];

  it("serves every segment with zero pagination URLs and clean hub entries", async () => {
    for (const seg of SEGMENTS) {
      const res = await get(seg);
      expect(res.status, seg).toBe(200);
      expect(res.text, seg).not.toContain("page=");
      expect(res.text, seg).not.toMatch(/<loc>[^<]*[?&]/);
    }
    const hubs = (await get("/sitemap-hubs.xml")).text;
    expect(hubs).toContain(`<loc>${SITE}/variety</loc>`);
    expect(hubs).toContain(`<loc>${SITE}/seller</loc>`);
  });
});

describe("statuses & redirects (permanent redirects are 301, uniformly, one hop)", () => {
  it("Slice 3 carry: /varieties → 301 → /variety returns 200", async () => {
    const res = await get("/varieties", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/variety");
    const followed = await get("/varieties");
    expect(followed.status).toBe(200);
    expect(decodeHtml(followed.text)).toContain("Flower seed varieties");
  });

  it("Slice 3 carry: /variety?v={slug} → 301 → the variety page returns 200", async () => {
    const res = await get("/variety?v=sweet-pea-kings-ransom", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/variety/sweet-pea-kings-ransom");
    const followed = await get("/variety?v=sweet-pea-kings-ransom");
    expect(followed.status).toBe(200);
    expect(decodeHtml(followed.text)).toContain("King's Ransom");
  });

  it("/sellers → 301 → /seller returns 200", async () => {
    const res = await get("/sellers", false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/seller");
    const followed = await get("/sellers");
    expect(followed.status).toBe(200);
    expect(decodeHtml(followed.text)).toContain("Flower seed sellers");
  });

  it("301s plural seller paths and legacy ?s= to the shop URL (shops land in Slice 5)", async () => {
    // The redirect rows fire today with §8.4-correct targets; the targets
    // 404 until Slice 5 lands the shops — the Slice 3 ruling-(b) pattern,
    // carried forward explicitly.
    const plural = await get("/sellers/blue-ridge-seeds", false);
    expect(plural.status).toBe(301);
    expect(plural.headers.get("location")).toBe("/seller/blue-ridge-seeds");
    const legacy = await get("/seller?s=blue-ridge-seeds", false);
    expect(legacy.status).toBe(301);
    expect(legacy.headers.get("location")).toBe("/seller/blue-ridge-seeds");
    const normalized = await get("/seller?s=%20Blue-Ridge-Seeds%20", false);
    expect(normalized.status).toBe(301);
    expect(normalized.headers.get("location")).toBe("/seller/blue-ridge-seeds");
  });
});

describe("client-navigation data (.pageContext.json, the in-place filter path)", () => {
  // Quinn F2's sequence against the real serve: the unfiltered browse data
  // warms first (the tab-bar navigation to /variety), then the filtered tap
  // must carry its own filtered totals — the first broken link was this
  // response itself (200 with the unfiltered total).
  const browseTotalOf = (text: string): unknown => {
    const parsed: unknown = JSON.parse(text);
    const pageContext = (Array.isArray(parsed) ? parsed[0] : parsed) as { data?: { browse?: { total?: unknown } } };
    return pageContext.data?.browse?.total;
  };

  it("serves per-URL filtered totals: the ?color_family=white fetch narrows after an unfiltered warm", async () => {
    const clean = await get("/variety/index.pageContext.json");
    expect(clean.status).toBe(200);
    expect(clean.headers.get("content-type")).toContain("application/json");
    expect(browseTotalOf(clean.text)).toBe(55);
    const filtered = await get("/variety/index.pageContext.json?color_family=white");
    expect(filtered.status).toBe(200);
    expect(filtered.headers.get("content-type")).toContain("application/json");
    expect(browseTotalOf(filtered.text)).toBe(17);
    // No contamination in either direction: the clean URL still reads clean.
    expect(browseTotalOf((await get("/variety/index.pageContext.json")).text)).toBe(55);
  });
});

// The invalidation proof mutates the stub catalog: it runs LAST.
describe("cache-invalidation proof for the browse index on the built artifact", () => {
  it("serves the renamed variety after a list:variety revalidate (no rebuild, no cache-bust)", async () => {
    const page = "/variety";
    expect((await get(page)).status).toBe(200);

    // The catalog write: Testbloom 05 gains a restocked name.
    const item = stub.state.listItems.find((v) => v.slug === "testbloom-05")!;
    item.varietyName = "Testbloom 05 Restocked";

    // Stale reads first: the edge entry still serves the old name (the
    // staleness the hook exists to cure — the purge below must earn the flip).
    const stale = decodeHtml((await get(page)).text);
    expect(stale.includes("Testbloom 05 Restocked")).toBe(false);
    expect(stale).toContain("Testbloom 05");

    // The write path POSTs the list tag (Bearer auth, v2 convention).
    const revalidate = await fetch(`${BASE}/internal/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ tags: ["list:variety"] }),
    });
    expect(revalidate.status).toBe(200);
    const result = (await revalidate.json()) as { revalidated: boolean; paths: string[]; purged: string[] };
    expect(result.revalidated).toBe(true);
    expect(result.paths).toContain(page);
    expect(result.purged.some((k) => k.startsWith("browse:variety:"))).toBe(true);

    // After: the index carries the new name — no rebuild ran, no
    // cache-busting parameter was sent.
    const fresh = decodeHtml((await get(page)).text);
    expect(fresh).toContain("Testbloom 05 Restocked");
  });
});
