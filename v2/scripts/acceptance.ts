/**
 * Acceptance run of the seeds-v2-delta (design D6) over real HTTP against a local preview.
 *
 *   npm run acceptance -- --base http://localhost:8787 [--report tmp/acceptance.md] [--skip-rate-limit] [--skip-media]
 *
 * The Media display section inserts one media row into the LOCAL D1 (platform proxy), revalidates
 * the variety with REVALIDATE_TOKEN from the environment or .dev.vars, checks the page/API/asset,
 * then deletes the row. Against a non-local base its row-based checks are skipped.
 * The Plant media display section does the same for one crop (media.plant_id): home grid and
 * /crop index thumbnails, the crop page hero + OG image, and the crop API. --skip-media skips both.
 *
 * Write flows (ingest planted evidence tests, throwaway-seller removal) need an ingest key and an
 * admin key. By default they are minted against the LOCAL D1 with scripts/create-api-key.ts and
 * revoked at the end; pass --admin-key / --ingest-key (or ACCEPTANCE_ADMIN_KEY /
 * ACCEPTANCE_INGEST_KEY) to supply your own. Every write uses a throwaway seller on a unique
 * `*.example` domain, so re-runs never collide. Nothing outside the base URL is fetched.
 *
 * Exit code 1 if any check fails. The rate-limit burst runs last because it exhausts the window.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SMALL_FARM_BADGE_SLUGS } from "@/lib/catalog/small-farm-classification";
import { openPlatform, parseArgs } from "./lib/platform";

const args = parseArgs();
const BASE = (args.values.get("base") ?? "http://localhost:8787").replace(/\/$/, "");
const RUN = Date.now().toString(36);
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const results: { group: string; name: string; ok: boolean; detail: string }[] = [];
let group = "";
let bursting = false;

async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = (await fn()) ?? "";
    results.push({ group, name, ok: true, detail });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ group, name, ok: false, detail });
    console.log(`  ✗ ${name} — ${detail}`);
  }
}
function section(name: string) {
  group = name;
  console.log(`\n${name}`);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET/POST without following redirects. Outside the burst test a 429 waits out the window once. */
async function get(path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual", ...init });
  if (r.status === 429 && !bursting && !(init.headers as Record<string, string> | undefined)?.["x-no-retry"]) {
    const wait = Number(r.headers.get("retry-after") ?? "60");
    console.log(`    (429 on ${path} — waiting ${wait}s for the rate-limit window)`);
    await sleep((wait + 1) * 1000);
    return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
  }
  return r;
}
type Env = { data: unknown; page?: { next_cursor: string | null; has_more: boolean }; meta: Record<string, unknown> | null; error: unknown };
async function getJson<T = Env>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await get(path, init);
  assert(r.status === 200, `${path} → ${r.status}`);
  return (await r.json()) as T;
}
async function html(path: string): Promise<string> {
  const r = await get(path);
  assert(r.status === 200, `${path} → ${r.status}`);
  return r.text();
}
function jsonLd(page: string): Record<string, unknown>[] {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
}
const text = (page: string) =>
  page
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
const robotsMeta = (h: string) => /<meta name="robots" content="([^"]+)"/.exec(h)?.[1] ?? "";
const PRICE_TEXT = /\$\s?\d+(?:\.\d{2})?|\bUSD\b|\d+\.\d{2}\s?(?:dollars|usd)/i;
const PRICE_KEY = /"(?:price\w*|lowPrice|highPrice|currency|fromPrice)":/i;

// ─── keys ────────────────────────────────────────────────────────────────────
const minted: number[] = [];
function mintKey(scope: "admin" | "ingest"): string {
  const out = execFileSync(process.execPath, [join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/create-api-key.ts", "--scope", scope, "--label", `acceptance-${RUN}-${scope}`, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop();
  assert(line, `could not mint a ${scope} key`);
  const k = JSON.parse(line) as { id: number; token: string };
  minted.push(k.id);
  return k.token;
}
function revokeMinted() {
  for (const id of minted) {
    try {
      execFileSync(process.execPath, [join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/create-api-key.ts", "--revoke", String(id)], { stdio: "ignore" });
    } catch {
      console.log(`  (could not revoke acceptance key ${id})`);
    }
  }
}

// ─── image CDN (R2 + Image Transformations migration, 2026-11-18) ─────────────
// Every /artwork/, /theme/ and /ornaments/ image renders from our own image CDN as a scale-down
// transformation of its R2 original (lib/images). Expected URLs are pinned here as literals (not
// computed with lib/images) so the acceptance run checks the contract independently of the helper.
const IMG_CDN = "https://images.seeds.hues.flowers";
/** A transformation URL for an R2 original key (the exact shape lib/images emits). */
const cdn = (width: number, key: string) => `${IMG_CDN}/cdn-cgi/image/width=${width},quality=80,format=auto,fit=scale-down/${key}`;
/** Matches the src of any transformation of an R2 key under `prefix` (regex source, already escaped). */
const cdnSrcRe = (prefix: string) => `https://images\\.seeds\\.hues\\.flowers/cdn-cgi/image/[^"/]+/${prefix}`;
/** Width × height of a WebP (VP8 / VP8L / VP8X), or null. */
function webpSize(b: Uint8Array): { w: number; h: number } | null {
  const td = new TextDecoder();
  if (b.length < 30 || td.decode(b.slice(0, 4)) !== "RIFF" || td.decode(b.slice(8, 12)) !== "WEBP") return null;
  const chunk = td.decode(b.slice(12, 16));
  if (chunk === "VP8X") return { w: (b[24]! | (b[25]! << 8) | (b[26]! << 16)) + 1, h: (b[27]! | (b[28]! << 8) | (b[29]! << 16)) + 1 };
  if (chunk === "VP8 ") return { w: (b[26]! | (b[27]! << 8)) & 0x3fff, h: (b[28]! | (b[29]! << 8)) & 0x3fff };
  if (chunk === "VP8L") {
    const v = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

// ─── media display (media delta D7) ──────────────────────────────────────────
const MEDIA_SLUG = "zinnia-queen-lime-blush";
const MEDIA_PATH = `/artwork/${MEDIA_SLUG}.webp`;
/** R2 original of MEDIA_PATH (a shipped WebP, so the key keeps the .webp extension). */
const MEDIA_KEY = `artwork/${MEDIA_SLUG}.webp`;
const NO_MEDIA_SLUG = "sweet-pea-albutt-blue";
const IS_LOCAL_BASE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE);

/** Runs SQL against the LOCAL D1 only (fresh args: never --remote), via the platform proxy. */
async function localD1(sql: string, ...binds: unknown[]): Promise<number> {
  const proxy = await openPlatform({ flags: new Set(), values: new Map() });
  try {
    const r = await proxy.env.DB.prepare(sql).bind(...binds).run();
    return r.meta.changes;
  } finally {
    await proxy.dispose();
  }
}

/** REVALIDATE_TOKEN from the environment, else from .dev.vars (the preview reads the same file). */
function revalidateToken(): string | null {
  if (process.env.REVALIDATE_TOKEN) return process.env.REVALIDATE_TOKEN;
  if (!existsSync(".dev.vars")) return null;
  const line = readFileSync(".dev.vars", "utf8").split("\n").find((l) => /^\s*REVALIDATE_TOKEN\s*=/.test(l));
  const v = line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  return v || null;
}

async function revalidateTags(token: string, tags: string[]): Promise<void> {
  const r = await get("/api/revalidate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  assert(r.status === 200, `revalidate ${tags.join(",")} → ${r.status}`);
}

const revalidateVariety = (token: string, slug: string) => revalidateTags(token, [`variety:${slug}`]);

// ─── plant media display (plant-media delta D6) ──────────────────────────────
const PLANT_MEDIA_SLUG = "zinnia";
const PLANT_MEDIA_NAME = "Zinnia";
const PLANT_MEDIA_PATH = `/artwork/crops/${PLANT_MEDIA_SLUG}.webp`;
const PLANT_MEDIA_KEY = `artwork/crops/${PLANT_MEDIA_SLUG}.webp`;
/** Crop cards render the 480-wide transformation (the old /artwork/crops/thumbs/ copies are gone). */
const PLANT_CARD_SRC = cdn(480, PLANT_MEDIA_KEY);
const PLANT_HERO_SRC = cdn(1120, PLANT_MEDIA_KEY);
const PLANT_NO_MEDIA_SLUG = "yarrow";
// The revalidate route's tag taxonomy names crops "crop:<slug>" and the crop index "list:crop".
const PLANT_MEDIA_TAGS = [`crop:${PLANT_MEDIA_SLUG}`, "list:home", "list:crop"];
const cropImg = (h: string) => new RegExp(`<img\\b[^>]*\\bsrc="${cdnSrcRe("artwork/crops/")}[^"]*"[^>]*>`).exec(h)?.[0] ?? null;
const escapeRe = (x: string) => x.replace(/[.*+?^$()|[\]{}\\/]/g, "\\$&");
const imgWithSrc = (h: string, src: string) => new RegExp(`<img\\b[^>]*\\bsrc="${escapeRe(src)}"[^>]*>`).exec(h)?.[0] ?? null;
/** The <li> card that links to /crop/<slug> (home grid and /crop index both render one per crop). */
const cropCard = (h: string, slug: string) =>
  [...h.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]!).find((li) => li.includes(`href="/crop/${slug}"`)) ?? null;

/** Re-fetch a page until `want` holds (ISR may serve one stale render while regenerating). */
async function pageUntil(path: string, want: (h: string) => boolean, tries = 6): Promise<{ h: string; attempt: number }> {
  let h = "";
  for (let attempt = 1; attempt <= tries; attempt++) {
    h = await html(path);
    if (want(h)) return { h, attempt };
    await sleep(1000);
  }
  throw new Error(`${path}: expected state not reached after ${tries} fetches`);
}

/** Any own-artwork <img> (hero or card): a CDN transformation of an artwork/ original. */
const artworkImg = (h: string) => new RegExp(`<img\\b[^>]*\\bsrc="${cdnSrcRe("artwork/")}[^"]+"[^>]*>`).exec(h)?.[0] ?? null;
/** The page hero: the 1120-wide artwork transformation (cards load the 480-wide one). */
const heroImg = (h: string) =>
  /<img\b[^>]*\bsrc="https:\/\/images\.seeds\.hues\.flowers\/cdn-cgi\/image\/width=1120,[^"\/]*\/artwork\/[^"]+"[^>]*>/.exec(h)?.[0] ?? null;
/** The <li> card that links to /variety/<slug> (variety grids render one per variety). */
/** Every opening <a> tag as an attribute map (order-independent); href is entity-decoded. */
const anchorTags = (h: string) =>
  [...h.matchAll(/<a\b([^>]*)>/g)].map((m) => {
    const attrs: Record<string, string> = {};
    for (const a of m[1]!.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]!.toLowerCase()] = a[2]!;
    if (attrs.href) attrs.href = attrs.href.replace(/&amp;/g, "&");
    return attrs;
  });
const relHas = (a: Record<string, string>, ...tokens: string[]) => {
  const rel = (a.rel ?? "").split(/\s+/);
  return tokens.every((t) => rel.includes(t));
};
const varietyCard = (h: string, slug: string) =>
  [...h.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]!).find((li) => li.includes(`href="/variety/${slug}"`)) ?? null;
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
/** The variety card's no-media placeholder frame (its inner HTML), if the card has one. */
const placeholderFrame = (card: string) => /<div\b[^>]*data-testid="variety-card-placeholder"[^>]*>([\s\S]*?)<\/div>/.exec(card)?.[1] ?? null;
/** Stored pod paths render as transformations of their .png masters: motifs 480 wide, bundles 1600. */
const POD_MOTIF_ZINNIA = cdn(480, "ornaments/motif-zinnia.png");
const podBundle = (key: string) => cdn(1600, `ornaments/bundle-${key}.png`);
/** Divider motif B (2026-11-19): R2 key of the 2400×518 master and its rendered 1200-wide transformation. */
const MOTIF_B_KEY = "ornaments/motif-divider-b.webp";
const MOTIF_B_SRC = cdn(1200, MOTIF_B_KEY);
const metaContent = (h: string, prop: string) => new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(h)?.[1] ?? null;

type Variety = { slug: string; indexable: boolean; listingCount: number };
type Listing = { id: number; seller: { slug: string; name: string; region: string | null }; availability: string; lastCheckedAt: string | null; productUrl: string | null; goUrl: string; provenance: Record<string, unknown> };

async function main() {
  console.log(`Acceptance run ${RUN} against ${BASE}`);
  const allVarieties: Variety[] = [];
  const crawled = new Map<string, string>();

  section("Routes: singular URLs (R3)");
  for (const p of ["/", "/variety", "/seller", "/crop", "/crop/sweet-pea", "/crop/zinnia?has_sellers=true", "/series/zinnia-dearest", "/report", "/about", "/about/data", "/about/bot", "/terms", "/privacy", "/offline", "/api-docs", "/search", "/search?q=sweet+pea"]) {
    await check(`GET ${p} → 200`, async () => {
      const r = await get(p);
      assert(r.status === 200, `status ${r.status}`);
      crawled.set(p, await r.text());
    });
  }
  for (const p of ["/variety/does-not-exist", "/seller/does-not-exist", "/crop/does-not-exist", "/series/does-not-exist", "/variety?page=99", "/go/999999"]) {
    await check(`GET ${p} → 404`, async () => {
      const r = await get(p);
      assert(r.status === 404, `status ${r.status}`);
    });
  }

  section("Redirects: plural → singular 308s, legacy ?v=/?s= (R3)");
  for (const [from, to] of [
    ["/varieties", "/variety"],
    ["/varieties/stock-katz-mix", "/variety/stock-katz-mix"],
    ["/sellers", "/seller"],
    ["/sellers/songbird-seed-co", "/seller/songbird-seed-co"],
    ["/plants", "/crop"],
    ["/plants/sweet-pea", "/crop/sweet-pea"],
    ["/categories", "/crop"],
    ["/categories/flowers", "/crop"],
    ["/variety?v=stock-katz-mix", "/variety/stock-katz-mix"],
    ["/seller?s=songbird-seed-co", "/seller/songbird-seed-co"],
  ] as const) {
    await check(`${from} → 308 → ${to}`, async () => {
      const r = await get(from);
      assert(r.status === 308, `status ${r.status}`);
      const loc = new URL(r.headers.get("location") ?? "", BASE);
      assert(loc.pathname === to && loc.search === "", `location ${loc.pathname}${loc.search}`);
    });
  }
  for (const [from, to] of [
    ["/varieties?v=stock-katz-mix", "/variety/stock-katz-mix"],
    ["/sellers/?s=songbird-seed-co", "/seller/songbird-seed-co"],
  ] as const) {
    await check(`${from} → 308 chain → ${to}`, async () => {
      let url: string = from;
      const hops: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await get(url);
        if (r.status !== 308) break;
        hops.push(r.status);
        const loc = new URL(r.headers.get("location") ?? "", BASE);
        url = `${loc.pathname}${loc.search}`;
      }
      assert(url === to && hops.length >= 1, `ended at ${url} via ${hops.join(",")}`);
      return `${hops.length} hop(s), all 308`;
    });
  }

  section("API envelope + contract (R13)");
  await check("/api/v1/varieties?limit=5 walks all 778 via page.next_cursor; meta has catalog_seq + generated_at", async () => {
    let cursor: string | null = null;
    let pages = 0;
    let seq: unknown = null;
    do {
      const qs: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const b = await getJson<Env & { data: Variety[] }>(`/api/v1/varieties?limit=5${qs}`);
      allVarieties.push(...b.data);
      assert(b.page && typeof b.page.has_more === "boolean", "no page{}");
      assert(typeof b.meta?.catalog_seq === "number" && typeof b.meta?.generated_at === "string", "meta lacks catalog_seq/generated_at");
      seq = b.meta.catalog_seq;
      cursor = b.page.next_cursor;
      pages++;
    } while (cursor && pages < 200);
    assert(allVarieties.length === 778 && new Set(allVarieties.map((v) => v.slug)).size === 778, `walked ${allVarieties.length}`);
    return `${pages} pages, catalog_seq ${String(seq)}`;
  });
  await check("limit cap 100; price sorts removed (400); spec sorts accepted", async () => {
    const b = await getJson("/api/v1/varieties?limit=1000");
    assert((b.data as unknown[]).length === 100 && b.meta?.total === 778, "cap");
    for (const s of ["price-asc", "price-desc"]) assert((await get(`/api/v1/varieties?sort=${s}`)).status === 400, `${s} accepted`);
    for (const s of ["name", "-name", "recently_checked", "-recently_checked", "listing_count", "-listing_count"]) assert((await get(`/api/v1/varieties?sort=${s}&limit=1`)).status === 200, s);
  });
  await check("/api/v1/crops replaces /api/v1/plants (no shim)", async () => {
    const c = await getJson("/api/v1/crops?limit=100");
    assert((c.data as unknown[]).length === 100 && c.meta?.total === 124, `${(c.data as unknown[]).length} crops`);
    assert((await get("/api/v1/plants")).status === 404, "/api/v1/plants still answers");
  });
  await check("sub-resources: variety + seller listings, series, coverage, recent", async () => {
    const vl = await getJson<{ data: Listing[] }>("/api/v1/varieties/sweet-pea-kings-ransom/listings");
    assert(vl.data.length >= 1 && vl.data.every((l) => l.provenance && l.goUrl), "variety listings");
    const sl = await getJson<{ data: Listing[] }>("/api/v1/sellers/songbird-seed-co/listings?availability=sold_out");
    assert(sl.data.length === 2, `songbird sold_out ${sl.data.length}`);
    const se = await getJson<{ data: { varietyCount: number } }>("/api/v1/series/zinnia-dearest");
    assert(se.data.varietyCount >= 1, "series");
    const cov = await getJson<{ data: { varieties_with_sellers: number }[] }>("/api/v1/coverage");
    assert(cov.data.length === 124, "coverage rows");
    const rec = await getJson<{ data: unknown[] }>("/api/v1/recent?crop=sweet-pea");
    assert(rec.data.length >= 1, "recent");
  });
  await check("unknown slug → 404 envelope; POST on a read → 405; ETag → 304", async () => {
    const r = await get("/api/v1/varieties/does-not-exist");
    const b = (await r.json()) as { data: null; error: { code: string } };
    assert(r.status === 404 && b.data === null && b.error.code === "not_found", `status ${r.status}`);
    assert((await get("/api/v1/varieties", { method: "POST" })).status === 405, "POST not 405");
    const a = await get("/api/v1/sellers");
    const etag = a.headers.get("etag");
    assert(etag, "no ETag");
    assert((await get("/api/v1/sellers", { headers: { "If-None-Match": etag } })).status === 304, "no 304");
  });
  await check("X-Robots-Tag noindex on /api/*, X-API-Version 1, CORS allowlist (no *)", async () => {
    for (const p of ["/api/v1/varieties", "/api/v1/openapi.json", "/api/v1/varieties/nope", "/api/v1/sync/snapshot"]) {
      assert((await get(p)).headers.get("x-robots-tag")?.includes("noindex"), `${p} missing X-Robots-Tag`);
    }
    const ok = await get("/api/v1/varieties", { headers: { Origin: "https://seeds.hues.flowers" } });
    assert(ok.headers.get("x-api-version") === "1", "X-API-Version");
    const acao = ok.headers.get("access-control-allow-origin");
    const localEcho = /^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE) && acao === new URL(BASE).origin;
    assert(acao === "https://seeds.hues.flowers" || localEcho, `allowlisted origin not reflected (${acao})`);
    assert(!(await get("/api/v1/varieties", { headers: { Origin: "https://random.example" } })).headers.get("access-control-allow-origin"), "random origin reflected");
  });
  await check("OpenAPI 3.1 documents crops, sync, reports; no ingest/admin; no prices", async () => {
    const d = await getJson<{ openapi: string; paths: Record<string, unknown> }>("/api/v1/openapi.json");
    assert(d.openapi === "3.1.0", d.openapi);
    for (const p of ["/crops", "/sync/snapshot", "/sync/changes", "/reports", "/coverage", "/recent", "/catalog/snapshot/{version}.sqlite"]) assert(p in d.paths, `${p} missing`);
    const t = JSON.stringify(d);
    assert(!/\/ingest\/|\/admin\/|priceCents|price-asc/.test(t), "leaks ingest/admin/price");
    return `${Object.keys(d.paths).length} paths`;
  });
  await check("catalog/version + .sqlite snapshot untouched", async () => {
    const r = await get("/api/v1/catalog/version");
    assert(r.headers.get("cache-control") === "no-store", "cache-control");
    const v = ((await r.json()) as { data: { version: number } }).data.version;
    assert(v >= 1, `version ${v}`);
    const s = await get(`/api/v1/catalog/snapshot/${v}.sqlite`);
    const bytes = new Uint8Array(await s.arrayBuffer());
    assert(new TextDecoder().decode(bytes.slice(0, 15)) === "SQLite format 3", "not SQLite");
    return `version ${v}, ${bytes.length} bytes`;
  });

  section("Every page (enumerated from the API)");
  const sellers = (await getJson<{ data: { slug: string; name: string }[] }>("/api/v1/sellers?limit=100")).data;
  // The catalog passed 100 crops in Nov 2026, so enumeration walks every page of the API.
  const walkCrops = async <T,>(qs = ""): Promise<T[]> => {
    const out: T[] = [];
    let cursor: string | null = null;
    do {
      const b: { data: T[]; page?: { next_cursor: string | null } } = await getJson(`/api/v1/crops?limit=100${qs}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      out.push(...b.data);
      cursor = b.page?.next_cursor ?? null;
    } while (cursor);
    return out;
  };
  const crops = await walkCrops<{ slug: string }>();
  await check(`all ${allVarieties.length} variety pages → 200`, async () => {
    for (const v of allVarieties) crawled.set(`/variety/${v.slug}`, await html(`/variety/${v.slug}`));
  });
  await check(`all ${sellers.length} seller pages → 200 with "Not yet rated" and a claim/correct/remove link`, async () => {
    for (const s of sellers) {
      const h = await html(`/seller/${s.slug}`);
      crawled.set(`/seller/${s.slug}`, h);
      assert(h.includes("Not yet rated"), `${s.slug} lacks "Not yet rated"`);
      assert(h.includes(`href="/report?seller=${s.slug}"`) && text(h).includes("Claim, correct or remove"), `${s.slug} lacks the report link`);
    }
  });
  await check(`all ${crops.length} crop pages → 200 with coverage counts`, async () => {
    for (const c of crops) {
      const h = await html(`/crop/${c.slug}`);
      crawled.set(`/crop/${c.slug}`, h);
      assert(/\d+ variet(y|ies) cataloged · \d+ with sellers/.test(text(h)), `${c.slug} lacks coverage counts`);
    }
  });
  await check("/crop index cards: variety counts shown, no seller counts on cards", async () => {
    const t = text(await html("/crop"));
    assert(/\d+ varieties/.test(t), "index lacks variety counts");
    assert(!t.includes("with sellers"), "an index card shows a seller count");
  });
  await check("zinnia crop page: season fact shown, no source attributions", async () => {
    const h = await html("/crop/zinnia");
    const t = text(h);
    assert(/<p[^>]*data-testid="crop-season"/.test(h) && t.includes("Season: Warm Season Tender Annuals"), "season fact");
    for (const a of ["(per ", "Source:", "Floret Library", "Gardener's Workshop", "Sowing & Growing Notes"]) assert(!h.includes(a) && !t.includes(a), `page shows "${a}"`);
  });

  section("Crop 'Has sellers' filter (?has_sellers=true)");
  /** Variety slugs of the grid cards (VarietyCard: one "packet" link per card). */
  const gridSlugs = (h: string) =>
    anchorTags(h)
      .filter((a) => a.href?.startsWith("/variety/") && (a.class ?? "").split(/\s+/).includes("packet"))
      .map((a) => a.href!.slice("/variety/".length));
  /** The Sellers chip row's links as label → href (the row runs from "Sellers:" to its closing </div>). */
  const sellersChips = (h: string) => {
    const start = h.indexOf(">Sellers:<");
    const row = start < 0 ? "" : h.slice(start, h.indexOf("</div>", start));
    return new Map([...row.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [text(m[2]!).trim(), (attr(m[1]!, "href") ?? "").replace(/&amp;/g, "&")]));
  };
  const countOf = (h: string, re: RegExp) => Number(re.exec(text(h))?.[1] ?? NaN);
  await check("/crop/sweet-pea?has_sellers=true: only with-listing varieties, fewer than unfiltered, chips round-trip the param", async () => {
    const [all, only] = await Promise.all([html("/crop/sweet-pea"), html("/crop/sweet-pea?has_sellers=true")]);
    const shown = gridSlugs(only);
    assert(shown.length >= 1, "filtered grid renders no variety cards");
    const listed = new Set<string>();
    let cursor: string | null = null;
    do {
      const b: { data: { slug: string }[]; page?: { next_cursor: string | null } } = await getJson(
        `/api/v1/varieties?crop=sweet-pea&has_listings=true&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      for (const v of b.data) listed.add(v.slug);
      cursor = b.page?.next_cursor ?? null;
    } while (cursor);
    const stray = shown.filter((s) => !listed.has(s));
    assert(stray.length === 0, `cards without listings: ${stray.join(", ")}`);
    const filteredCount = countOf(only, /(\d+) variet(?:y|ies) match\./);
    const unfilteredCount = countOf(all, /(\d+) variet(?:y|ies) cataloged/);
    assert(filteredCount < unfilteredCount, `filtered ${filteredCount} not < unfiltered ${unfilteredCount}`);
    const hasHref = sellersChips(all).get("Has sellers") ?? "";
    assert(hasHref.includes("has_sellers=true"), `unfiltered "Has sellers" chip href ${hasHref}`);
    const allHref = sellersChips(only).get("All") ?? "";
    assert(allHref === "/crop/sweet-pea", `filtered Sellers "All" chip href ${allHref}`);
    return `${filteredCount} of ${unfilteredCount} varieties have sellers`;
  });
  await check("zero-seller crop: ?has_sellers=true shows the 'No sellers yet for this crop' empty state; unfiltered shows cards", async () => {
    const cov = await getJson<{ data: { crop: { slug: string }; varieties: number; varieties_with_sellers: number }[] }>("/api/v1/coverage");
    const crop = cov.data.find((r) => r.varieties > 0 && r.varieties_with_sellers === 0)?.crop.slug;
    assert(crop, "no crop with varieties and zero sellers in /api/v1/coverage");
    const [all, only] = await Promise.all([html(`/crop/${crop}`), html(`/crop/${crop}?has_sellers=true`)]);
    assert(text(only).includes("No sellers yet for this crop"), `${crop}: empty-state text missing`);
    assert(gridSlugs(only).length === 0, `${crop}: filtered grid renders cards`);
    assert(gridSlugs(all).length >= 1, `${crop}: unfiltered grid renders no cards`);
    return crop;
  });

  section("Crop grower guide (tabs + life-cycle fact)");
  const GUIDE_CROPS = ["breadseed-poppy", "calendula", "celosia", "cornflower", "cosmos", "echinacea", "larkspur", "marigold", "nigella", "pincushion-flower", "strawflower", "sunflower", "sweet-pea", "zinnia"];
  const guideTabs = (h: string) => [...h.matchAll(/<(?:a|button)\b[^>]*data-testid="grower-guide-tab"[^>]*>([\s\S]*?)<\/(?:a|button)>/g)].map((m) => text(m[1]!).trim());
  const guidePanels = (h: string) => [...h.matchAll(/<(?:section|div)\b([^>]*data-testid="grower-guide-panel"[^>]*)>/g)].map((m) => m[1]!);
  /** The guide's HTML: from its section start to the "All crops" link that closes the page body. */
  const guideSection = (h: string) => {
    const start = h.indexOf('data-testid="grower-guide"');
    return start < 0 ? "" : h.slice(start, h.indexOf('href="/crop"', start));
  };
  await check("/crop/zinnia: life-cycle fact + grower guide with all three tabs, every panel server-rendered", async () => {
    const h = await html("/crop/zinnia");
    const t = text(h);
    assert(/<p[^>]*data-testid="crop-life-cycle"[^>]*>Annual — plant out after frost; the first frost ends it\.<\/p>/.test(h), "life-cycle fact");
    assert(/data-testid="grower-guide"/.test(h), "no grower guide section");
    const tabs = guideTabs(h);
    assert(JSON.stringify(tabs) === JSON.stringify(["Germination & Growing", "Harvest", "Seed Saving"]), `tabs ${JSON.stringify(tabs)}`);
    const panels = guidePanels(h);
    assert(panels.length === 3, `${panels.length} panels`);
    // No JS: nothing is hidden — every panel is in the HTML and visible.
    assert(panels.every((a) => !/\shidden(?:[\s=>]|$)/.test(a)), "a panel is hidden in the server render");
    for (const id of ["grower-guide-growing", "grower-guide-harvest", "grower-guide-seed-saving"]) assert(h.includes(`id="${id}"`), `missing #${id}`);
    for (const label of ["Sowing", "Germination", "Days to bloom", "When to harvest", "Pollination", "Saving seed: easy"]) assert(t.includes(label), `missing "${label}"`);
    const g = text(guideSection(h));
    for (const a of ["Source", "source:", "Seed Savers", "Extension", "Floret", "rareseeds", "threshseed", "SOURCES"]) assert(!g.includes(a), `guide shows "${a}"`);
    return tabs.join(" · ");
  });
  await check("/crop/breadseed-poppy: no Harvest tab (no harvest-for-cutting content)", async () => {
    const tabs = guideTabs(await html("/crop/breadseed-poppy"));
    assert(JSON.stringify(tabs) === JSON.stringify(["Germination & Growing", "Seed Saving"]), `tabs ${JSON.stringify(tabs)}`);
  });
  await check("/crop/yarrow (outside the 13): no grower guide; the classified life-cycle fact", async () => {
    const h = await html("/crop/yarrow");
    assert(!h.includes('data-testid="grower-guide'), "guide rendered");
    assert(/<p[^>]*data-testid="crop-life-cycle"[^>]*>Perennial in Zones 3-9\.<\/p>/.test(h), "life-cycle fact");
  });
  await check("/crop/soapwort + /crop/ornamental-grass (held): no life-cycle fact", async () => {
    for (const slug of ["soapwort", "ornamental-grass"]) assert(!(await html(`/crop/${slug}`)).includes('data-testid="crop-life-cycle"'), `${slug} fact rendered`);
  });
  await check(`only the ${GUIDE_CROPS.length} covered crops render a grower guide`, async () => {
    const withGuide = [...crawled].filter(([p, h]) => p.startsWith("/crop/") && !p.includes("?") && h.includes('data-testid="grower-guide"')).map(([p]) => p.slice(6)).sort();
    assert(JSON.stringify(withGuide) === JSON.stringify(GUIDE_CROPS), `with guide: ${withGuide.join(", ")}`);
    return `${[...crawled.keys()].filter((p) => p.startsWith("/crop/") && !p.includes("?")).length} crop pages scanned`;
  });

  section("Life cycle filter (/variety + API)");
  const cropSlugsFor = async (q: string) => (await walkCrops<{ slug: string }>(`&${q}`)).map((c) => c.slug);
  await check("/api/v1/crops?life_cycle=perennial: yarrow in, cosmos out; annual the reverse; held crops in neither", async () => {
    const perennial = await cropSlugsFor("life_cycle=perennial");
    const annual = await cropSlugsFor("life_cycle=annual");
    assert(perennial.includes("yarrow") && !perennial.includes("cosmos"), `perennial: ${perennial.join(", ")}`);
    assert(annual.includes("cosmos") && !annual.includes("yarrow"), "annual bucket");
    const any = await cropSlugsFor("life_cycle=annual,biennial,perennial");
    assert(!any.includes("soapwort") && !any.includes("ornamental-grass") && any.length === 121, `${any.length} crops in any bucket`);
    return `annual ${annual.length}, perennial ${perennial.length}`;
  });
  await check("life_cycle bogus → 400 on /crops and /varieties; combines with season/method", async () => {
    for (const path of ["/api/v1/crops?life_cycle=bogus", "/api/v1/varieties?life_cycle=bogus"]) assert((await get(path)).status === 400, `${path} not 400`);
    const v = await getJson("/api/v1/varieties?life_cycle=perennial&season=cool&limit=100");
    assert(v.meta?.total === 10, `perennial+cool total ${String(v.meta?.total)}`);
    assert((await get("/api/v1/crops?life_cycle=annual&method=direct")).status === 200, "annual+direct not 200");
  });
  await check("/variety?life_cycle=perennial: Life cycle group, Perennial chip current, filtered count; bogus ignored", async () => {
    const h = await html("/variety?life_cycle=perennial");
    assert(/<legend[^>]*>Life cycle<\/legend>/.test(h), "no Life cycle legend");
    assert(/<a[^>]*aria-current="true"[^>]*data-filter="lifeCycle"[^>]*>Perennial<\/a>/.test(h), "Perennial chip not current");
    assert(text(h).includes("91 varieties · Perennial"), "count line");
    const combined = text(await html("/variety?life_cycle=perennial&season=cool"));
    assert(combined.includes("10 varieties · Cool Season Hardy Annuals · Perennial"), "combined count line");
    assert((await get("/variety?life_cycle=bogus")).status === 200, "bogus value not ignored");
  });

  section("Variety pages (R6)");
  await check("King's Ransom: answer sentence, seller, region, stock state, Last checked, Shop → /go, no source attributions", async () => {
    const h = crawled.get("/variety/sweet-pea-kings-ransom")!;
    const t = text(h);
    assert(t.includes("As of 2026-11-15, 1 seller lists King's Ransom: Songbird Seed Co."), "answer sentence");
    assert(t.includes("Songbird Seed Co.") && /Skagit Valley, WA/.test(t), "seller + region");
    assert(t.includes("In stock") && t.includes("Last checked 2026-11-15"), "stock state / last checked");
    assert(/<a href="\/go\/\d+" rel="nofollow noopener noreferrer"/.test(h) && t.includes("Shop at Songbird Seed Co."), "Shop button via /go");
    assert(t.includes("Not yet rated") && t.includes("Also sold as"), "rating / also sold as");
    assert(h.includes('href="/report?variety=sweet-pea-kings-ransom"'), "report link");
    for (const a of ["Source:", "(per ", "Floret Library", "Sowing & Growing Notes"]) assert(!h.includes(a) && !t.includes(a), `page shows "${a}"`);
  });
  await check("Outbound links open in a new tab: /go/ Shop (noopener noreferrer), seller homepage (noopener); internal links same-tab", async () => {
    const vh = crawled.get("/variety/sweet-pea-kings-ransom")!;
    const va = anchorTags(vh);
    const shop = va.filter((a) => a.href?.startsWith("/go/"));
    assert(shop.length >= 1, "variety page has no /go/ anchor");
    for (const a of shop) assert(a.target === "_blank" && relHas(a, "noopener", "noreferrer"), `${a.href}: target=${a.target} rel=${a.rel}`);
    const internal = va.filter((a) => a.href?.startsWith("/seller/") || a.href === "/variety" || a.href?.startsWith("/crop"));
    assert(va.some((a) => a.href === "/seller/songbird-seed-co"), "listing heading link to /seller/songbird-seed-co missing");
    for (const a of internal) assert(a.target !== "_blank", `internal ${a.href} opens a new tab`);
    let homeSeller: { slug: string; homepage: string } | null = null;
    for (const s of sellers) {
      const d = (await getJson<{ data: { homepage: string | null } }>(`/api/v1/sellers/${s.slug}`)).data;
      if (d.homepage) {
        homeSeller = { slug: s.slug, homepage: d.homepage };
        break;
      }
    }
    assert(homeSeller, "no seller with a homepage");
    const ext = anchorTags(crawled.get(`/seller/${homeSeller.slug}`)!).find((a) => a.href === homeSeller.homepage);
    assert(ext, `/seller/${homeSeller.slug} lacks an anchor to ${homeSeller.homepage}`);
    assert(ext.target === "_blank" && relHas(ext, "noopener"), `homepage link target=${ext.target} rel=${ext.rel}`);
    return `${shop.length} /go/ link(s), ${internal.length} internal link(s), homepage via ${homeSeller.slug}`;
  });
  await check("Unknown facts print Unknown; zero-seller page says so", async () => {
    const t = text(crawled.get("/variety/stock-katz-mix")!);
    // Katz Mix's hue is sourced since the hue batch ("Mix"), so the Unknown hue
    // is checked on a variety that still has none.
    for (const f of ["Pollination Unknown", "Days to bloom Unknown"]) assert(t.includes(f), `missing "${f}"`);
    assert(text(crawled.get("/variety/sweet-pea-susan-burgess")!).includes("Hue Unknown"), 'missing "Hue Unknown"');
    assert(t.includes("No seller found selling Katz Mix yet."), "zero-seller answer");
    assert(t.includes("No sellers yet — currently unavailable."), "zero-seller where-to-buy state");
    assert(t.includes("Know a seller who sells it?"), "zero-seller report prompt");
  });
  await check("Emma sold out; Dawn Creek Pastels unknown availability (labels)", async () => {
    assert(text(crawled.get("/variety/sweet-pea-emma")!).includes("Sold out"), "Emma");
    assert(/Unknown\s+Last checked 2026-11-15/.test(text(crawled.get("/variety/zinnia-dawn-creek-pastels")!)), "Dawn Creek Pastels");
  });
  await check("index rule (owner ruling 2026-11-16): all 778 varieties indexable; robots meta matches the API flag", async () => {
    let idx = 0;
    for (const v of allVarieties) {
      const robots = robotsMeta(crawled.get(`/variety/${v.slug}`)!);
      assert(robots === "index, follow", `${v.slug}: ${robots}`);
      assert(v.indexable === true, `${v.slug} indexable=${v.indexable} listings=${v.listingCount}`);
      if (v.indexable) idx++;
    }
    assert(idx === 778 && allVarieties.length - idx === 0, `${idx}/${allVarieties.length - idx}`);
    return `${idx} indexable / ${allVarieties.length - idx} noindex`;
  });

  section("Prices are stored, never shown (R1)");
  await check("no price text on any crawled page", async () => {
    for (const [p, h] of crawled) {
      const m = PRICE_TEXT.exec(text(h));
      assert(!m, `${p}: "${m?.[0]}"`);
    }
    return `${crawled.size} pages`;
  });
  await check("no price keys in API payloads, sync snapshot or JSON-LD", async () => {
    const docs: [string, string][] = [
      ["varieties", await (await get("/api/v1/varieties?limit=100")).text()],
      ["sellers", await (await get("/api/v1/sellers?limit=100")).text()],
      ["sync", await (await get("/api/v1/sync/snapshot")).text()],
      ["recent", await (await get("/api/v1/recent?limit=100")).text()],
    ];
    for (const slug of ["sweet-pea-kings-ransom", "sweet-pea-emma", "zinnia-dawn-creek-pastels", "zinnia-gift"]) docs.push([slug, await (await get(`/api/v1/varieties/${slug}`)).text()]);
    for (const s of sellers) docs.push([s.slug, await (await get(`/api/v1/sellers/${s.slug}`)).text()]);
    for (const [p, h] of crawled) for (const ld of jsonLd(h)) docs.push([`${p} JSON-LD`, JSON.stringify(ld)]);
    for (const [name, body] of docs) assert(!PRICE_KEY.test(body), `${name} has a price key`);
    return `${docs.length} documents`;
  });

  section("Structured data (R4)");
  await check("no Product / Offer / AggregateOffer / AggregateRating / Review / FAQPage / priceValidUntil anywhere", async () => {
    for (const [p, h] of crawled) assert(!/"Product"|"Offer"|AggregateOffer|AggregateRating|"Review"|FAQPage|priceValidUntil/.test(h), p);
    return `${crawled.size} pages`;
  });
  await check("home WebSite + Organization; variety BreadcrumbList + ItemList(sellers); seller Organization + ItemList; crop/series ItemList", async () => {
    const types = (p: string) => jsonLd(crawled.get(p)!).map((x) => String(x["@type"]));
    assert(["WebSite", "Organization"].every((t) => types("/").includes(t)), `home ${types("/")}`);
    assert(JSON.stringify(types("/variety/sweet-pea-kings-ransom")) === JSON.stringify(["BreadcrumbList", "ItemList"]), `variety ${types("/variety/sweet-pea-kings-ransom")}`);
    const sellerList = jsonLd(crawled.get("/variety/sweet-pea-kings-ransom")!).find((x) => x["@type"] === "ItemList") as { itemListElement: { url: string }[] };
    assert(sellerList.itemListElement[0]?.url === "https://seeds.hues.flowers/seller/songbird-seed-co", "variety ItemList is not sellers");
    assert(["Organization", "ItemList"].every((t) => types("/seller/songbird-seed-co").includes(t)), "seller");
    assert(types("/crop/sweet-pea").includes("ItemList") && types("/series/zinnia-dearest").includes("ItemList"), "crop/series");
  });

  section("Data + spot checks (124/778/25/17)");
  await check("counts 778 varieties / 25 sellers / 17 listings / 124 crops", async () => {
    const s = (await getJson("/api/v1/sellers?limit=1")).meta?.total;
    const c = (await getJson("/api/v1/crops?limit=1")).meta?.total;
    const l = allVarieties.reduce((a, x) => a + x.listingCount, 0);
    assert(allVarieties.length === 778 && s === 25 && l === 17 && c === 124, `${allVarieties.length}/${String(s)}/${l}/${String(c)}`);
    return `778/${String(s)}/${l}/${String(c)}`;
  });
  await check("Songbird × King's Ransom in_stock 2026-11-15; Songbird × Emma sold_out; Floret × Dawn Creek Pastels unknown", async () => {
    const l = async (slug: string, seller: string) =>
      (await getJson<{ data: Listing[] }>(`/api/v1/varieties/${slug}/listings`)).data.find((x) => x.seller.slug === seller)!;
    const kr = await l("sweet-pea-kings-ransom", "songbird-seed-co");
    assert(kr.availability === "in_stock" && kr.lastCheckedAt?.startsWith("2026-11-15"), JSON.stringify(kr));
    assert(kr.productUrl === "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m", `${kr.productUrl}`);
    assert((await l("sweet-pea-emma", "songbird-seed-co")).availability === "sold_out", "Emma");
    assert((await l("zinnia-dawn-creek-pastels", "floret")).availability === "unknown", "Dawn Creek Pastels");
  });
  await check("Open Directory: every seller is a US seller and its badge matches the recorded judgment", async () => {
    // The retired small-farms-only exclusion scan (COMPANY_NAME_EXCLUSION_PATTERN) is gone with
    // the model that created it (Dustin's ruling, 2026-11-19): large US sellers — GeoSeed
    // included — are listable now. What acceptance guards instead is the new model, read from
    // the live API: US-only, and isSmallFarm equal to the recorded judgment in
    // lib/catalog/small-farm-classification.ts (GeoSeed is pre-recorded NO BADGE, so a badged
    // GeoSeed fails here). Sellers with no recorded judgment yet (a brand-new crawl find) are
    // reported, not failed — badging is a judgment applied after listing.
    const badge = new Set<string>(SMALL_FARM_BADGE_SLUGS);
    const sellers = (
      await getJson<{ data: { slug: string; country: string; isSmallFarm: boolean }[] }>("/api/v1/sellers?limit=100")
    ).data;
    assert(sellers.length > 0, "no sellers returned");
    const unjudged: string[] = [];
    for (const s of sellers) {
      assert(s.country === "US", `${s.slug} is not a US seller (${s.country})`);
      if (badge.has(s.slug)) assert(s.isSmallFarm === true, `${s.slug} should carry the Small farm badge`);
      else if (s.slug === "geoseed" || ["american-meadows", "botanical-interests", "great-basin-seed", "high-mowing-organic-seeds", "johnnys-selected-seeds", "seed-savers-exchange", "wild-west-seed"].includes(s.slug))
        assert(s.isSmallFarm === false, `${s.slug} is recorded NO BADGE but surfaces badged`);
      else unjudged.push(s.slug);
    }
    const badged = sellers.filter((s) => s.isSmallFarm).length;
    return `${sellers.length} sellers · ${badged} badged${unjudged.length ? ` · unjudged: ${unjudged.join(", ")}` : ""}`;
  });

  section("Seller states + imported ratings (brief #4)");
  const sellerSlugsIn = (h: string) => [...new Set([...h.matchAll(/href="\/seller\/([a-z0-9-]+)"/g)].map((m) => m[1]!))].sort();
  const canonicalOf = (h: string) => /<link rel="canonical" href="([^"]+)"/.exec(h)?.[1] ?? "";
  const titleOf = (h: string) => (/<title>([^<]*)<\/title>/.exec(h)?.[1] ?? "").replace(/&amp;/g, "&");
  await check("/state/oregon → 200 with exactly the OR sellers, scene hero, H1, indexable, canonical self", async () => {
    const h = await html("/state/oregon");
    const want = (await getJson<{ data: { slug: string }[] }>("/api/v1/sellers?region=OR&limit=100")).data.map((s) => s.slug).sort();
    assert(want.length > 0, "API has no OR sellers");
    const got = sellerSlugsIn(h);
    assert(JSON.stringify(got) === JSON.stringify(want), `cards ${got.join(",")} ≠ ${want.join(",")}`);
    assert(/<h1[^>]*>Seed sellers in Oregon<\/h1>/.test(h), "H1");
    assert(titleOf(h) === "Seed sellers in Oregon — Seed Directory", `title "${titleOf(h)}"`);
    assert(
      text(h).includes(
        want.length === 1
          ? "1 seed seller in Oregon lists seed with the Seed Directory."
          : `${want.length} seed sellers in Oregon list seed with the Seed Directory.`,
      ),
      "intro",
    );
    assert(robotsMeta(h).startsWith("index"), `robots ${robotsMeta(h)}`);
    assert(canonicalOf(h) === "https://seeds.hues.flowers/state/oregon", `canonical ${canonicalOf(h)}`);
    // Phase 3 (brief #3 addendum 5): the state page now carries the Add Your Farm CTA, prefilled with its state.
    assert(h.includes('href="/add-your-farm?state=OR"'), "Add Your Farm CTA (?state=OR)");
    assert(h.includes(`src="${cdn(1200, "theme/state-scenes/oregon.png")}"`), "scene hero artwork (1200-wide CDN transformation)");
    assert(h.includes('data-testid="state-hero"'), "state-hero figure");
    assert(h.includes("Oregon landscape with Oregon grape"), "scene hero alt text");
    // State-plates delta (2026-11-19): this line used to assert the masked state-flower artwork
    // (StateShape art variant) was GONE from the page. The state's flower now returns as the plate
    // directly above the farm grid — whole, in .art-frame, 640-wide, lazy (placement amended
    // 2026-11-20, Dustin's call: Elena's B-05) — so the check pins that instead,
    // and that no other state-flower rendering (the masked outline) came back with it.
    const plateFig = /<figure\b[^>]*data-state-plate="OR"[^>]*>([\s\S]*?)<\/figure>/.exec(h);
    assert(plateFig, "state plate figure (data-state-plate=OR)");
    assert(plateFig[1]!.includes(`src="${cdn(640, "artwork/states/oregon.png")}"`), "plate src (640-wide CDN transformation)");
    assert(plateFig[1]!.includes(`alt="Oregon grape, Oregon&#x27;s state flower"`), "plate alt (Ada §A.2)");
    assert(/\bloading="lazy"/.test(plateFig[1]!) && !/fetchpriority/i.test(plateFig[1]!), "plate lazy, no fetchPriority");
    assert(!/<figcaption|<a\b|\btitle=|aria-label/.test(plateFig[0]), "plate must have no caption, link, title or aria-label");
    assert(h.indexOf('data-testid="state-add-farm"') < h.indexOf("data-state-plate") && h.indexOf("data-state-plate") < h.indexOf("data-state-sellers"), "plate sits after the CTA, before the farm grid");
    assert((h.match(/artwork\/states\//g) ?? []).length === 1, "exactly one state-flower rendering (the plate)");
    crawled.set("/state/oregon", h);
    return `${got.length} sellers`;
  });
  await check("/state/texas (real state, no sellers) and /state/atlantis → 404", async () => {
    for (const p of ["/state/texas", "/state/atlantis", "/state/OR"]) {
      const r = await get(p);
      assert(r.status === 404, `${p} → ${r.status}`);
    }
  });
  await check("every seller's state page → 200 and is in the sitemap; nothing else under /state/", async () => {
    const all = (await getJson<{ data: { slug: string; region: string | null }[] }>("/api/v1/sellers?limit=100")).data;
    const { stateSlugOf } = await import("@/lib/data/states");
    const slugs = [...new Set(all.map((s) => stateSlugOf(s.region)).filter((x): x is string => x !== null))].sort();
    const x = await html("/sitemap.xml");
    const inMap = [...x.matchAll(/\/state\/([a-z-]+)<\/loc>/g)].map((m) => m[1]!).sort();
    assert(JSON.stringify(inMap) === JSON.stringify(slugs), `sitemap ${inMap.join(",")} ≠ ${slugs.join(",")}`);
    for (const sl of slugs) crawled.set(`/state/${sl}`, await html(`/state/${sl}`));
    return `${slugs.length} state pages`;
  });
  await check("state-flower plates: painted states/sellers show their own plate once; no state or no plate → none", async () => {
    const { STATE_PLATES } = await import("@/lib/data/state-plates");
    const { stateByCode } = await import("@/lib/data/states");
    const all = (await getJson<{ data: { slug: string; region: string | null; country: string }[] }>("/api/v1/sellers?limit=100")).data;
    let withPlate = 0;
    let without = 0;
    for (const s of all) {
      const st = s.country === "US" ? stateByCode(s.region) : null;
      const plate = st && Object.hasOwn(STATE_PLATES, st.slug) ? STATE_PLATES[st.slug]! : null;
      const h = crawled.get(`/seller/${s.slug}`) ?? (await html(`/seller/${s.slug}`));
      const figs = [...h.matchAll(/<figure\b[^>]*data-state-plate="([A-Z]{2})"[^>]*>([\s\S]*?)<\/figure>/g)];
      if (plate && st) {
        assert(figs.length === 1 && figs[0]![1] === st.code, `/seller/${s.slug}: expected one ${st.code} plate, got ${figs.map((f) => f[1]).join(",") || "none"}`);
        assert(figs[0]![2]!.includes(`src="${cdn(640, `artwork/states/${st.slug}.png`)}"`), `/seller/${s.slug}: plate src`);
        assert(figs[0]![2]!.includes(`alt="${plate.alt.replace(/'/g, "&#x27;")}"`), `/seller/${s.slug}: plate alt`);
        assert(/\bloading="eager"/.test(figs[0]![2]!) && !/fetchpriority/i.test(figs[0]![2]!), `/seller/${s.slug}: eager, no fetchPriority`);
        withPlate++;
      } else {
        assert(figs.length === 0 && !h.includes("artwork/states/"), `/seller/${s.slug}: no plate expected (region ${s.region ?? "none"})`);
        without++;
      }
    }
    for (const [path, h] of crawled) {
      const m = /^\/state\/([a-z-]+)$/.exec(path);
      if (!m) continue;
      const n = (h.match(/data-state-plate="/g) ?? []).length;
      assert(n === (Object.hasOwn(STATE_PLATES, m[1]!) ? 1 : 0), `${path}: ${n} plates`);
    }
    return `${withPlate} sellers with a plate, ${without} without`;
  });
  await check("seller with an imported rating: \"Reviews from Google\" panel AND our \"Not yet rated\"; nothing in JSON-LD", async () => {
    const h = await html("/seller/johnnys-selected-seeds");
    const t = text(h);
    assert(t.includes("Not yet rated"), "our rating line is gone");
    assert(t.includes("Reviews from Google"), "no Google panel");
    assert(h.includes('aria-label="Rated 4.7 out of 5"'), "accessible star label");
    assert(t.includes("from 313 reviews on Google"), "review count line");
    assert(t.includes("Ratings from Google · fetched 2026-11-16"), "attribution line");
    assert(t.indexOf("About this seller") < t.indexOf("Reviews from Google"), "panel must sit below the summary");
    const ld = JSON.stringify(jsonLd(h));
    assert(!/rating|review|4\.7|313/i.test(ld), "imported rating leaked into JSON-LD");
    assert(/href="\/state\/maine"[^>]*>[\s\S]*?Maine<\/a>/.test(h), "state link with name text");
    const f = await html("/seller/floret");
    assert(!text(f).includes("Reviews from Google") && text(f).includes("Not yet rated"), "floret must have no Google panel");
  });
  await check("/seller?state=VT filters server-side: only VT cards, VT chip aria-current, noindex, chips = states with sellers", async () => {
    const h = await html("/seller?state=VT");
    const want = (await getJson<{ data: { slug: string }[] }>("/api/v1/sellers?region=VT&limit=100")).data.map((s) => s.slug).sort();
    const got = sellerSlugsIn(h);
    assert(want.length > 0 && JSON.stringify(got) === JSON.stringify(want), `cards ${got.join(",")} ≠ ${want.join(",")}`);
    assert(/<a[^>]*href="\/seller\?state=VT"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="\/seller\?state=VT"/.test(h), "VT chip not current");
    assert((h.match(/aria-current="true"/g) ?? []).length === 1, "exactly one active chip");
    assert(robotsMeta(h).startsWith("noindex"), `robots ${robotsMeta(h)}`);
    const chips = [...h.matchAll(/data-state="([A-Z]{2})"/g)].map((m) => m[1]!);
    const all = await html("/seller");
    assert(/<a[^>]*href="\/seller"[^>]*aria-current="true"[^>]*>All states/.test(all) || /aria-current="true"[^>]*data-filter="state"[^>]*>All states/.test(all), "All states chip not current on /seller");
    assert(sellerSlugsIn(all).length >= got.length, "unfiltered list shorter than filtered");
    const bogus = await html("/seller?state=TX");
    assert(!/data-state="TX"/.test(bogus) && sellerSlugsIn(bogus).length === sellerSlugsIn(all).length, "?state=TX should be ignored (no chip, all sellers)");
    return `${got.length} VT sellers; ${chips.length} state chips`;
  });

  section("SEO / GEO");
  await check("sitemap: singular URLs, all indexable varieties listed (778), no <priority>/<changefreq>", async () => {
    const x = await html("/sitemap.xml");
    assert(!/<priority>|<changefreq>/.test(x), "priority/changefreq present");
    assert(!/\/(varieties|sellers|plants|categories)[/<]/.test(x), "plural URL in sitemap");
    for (const v of allVarieties) {
      const listed = x.includes(`/variety/${v.slug}</loc>`);
      assert(listed === v.indexable, `${v.slug} listed=${listed} indexable=${v.indexable}`);
    }
    assert(x.includes("/series/zinnia-dearest</loc>") && x.includes("/about/data</loc>"), "series/about-data missing");
    return `${(x.match(/<loc>/g) ?? []).length} URLs`;
  });
  await check("robots.txt allows crawlers, disallows /go/, /admin, ingest + admin API", async () => {
    const r = await html("/robots.txt");
    assert(/User-Agent: \*/i.test(r) && /Allow: \//.test(r), "allow");
    for (const d of ["/go/", "/admin", "/api/v1/ingest/", "/api/v1/admin/"]) assert(r.includes(`Disallow: ${d}`), `no Disallow ${d}`);
    assert(!/Disallow:\s*\/api\/\s*$/m.test(r), "disallows all of /api/");
    assert(r.includes("Sitemap: https://seeds.hues.flowers/sitemap.xml"), "no sitemap line");
  });
  await check("llms.txt: singular links, data policy, no prices", async () => {
    const t = await html("/llms.txt");
    assert(t.includes("/crop/") && t.includes("/about/data") && t.includes("/api/v1/openapi.json"), "links");
    assert(!/\/(varieties|sellers|plants)\b/.test(t.replace(/\/api\/v1\/\S+/g, "")), "plural links");
    assert(/778 flower seed varieties/.test(t) && /bought-in seed/.test(t), "counts/policy");
  });
  await check("/about/data and /about/bot copy (R14)", async () => {
    const d = text(crawled.get("/about/data")!);
    for (const s of ["does not have to grow the seed it sells", "bought-in seed is listed the same way", "48 hours", "Hues Floral Park", "approves by hand"]) assert(d.includes(s), `about/data lacks "${s}"`);
    const b = text(crawled.get("/about/bot")!);
    assert(b.includes("HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)") && /robots\.txt/.test(b) && /5 seconds/.test(b), "about/bot");
  });
  await check("OG cards are 1200×630 PNGs for variety, seller and crop", async () => {
    for (const p of ["/og/variety/sweet-pea-kings-ransom", "/og/seller/floret", "/og/crop/zinnia"]) {
      const r = await get(p);
      assert(r.status === 200 && r.headers.get("content-type")?.includes("image/png"), `${p} ${r.status}`);
      const dv = new DataView((await r.arrayBuffer()) as ArrayBuffer);
      assert(dv.getUint32(16) === 1200 && dv.getUint32(20) === 630, `${p} dimensions`);
    }
    assert(/og\/variety\/sweet-pea-kings-ransom/.test(crawled.get("/variety/sweet-pea-kings-ransom")!), "variety og:image");
  });
  await check("search pages are noindex, follow and canonical /search", async () => {
    const h = crawled.get("/search?q=sweet+pea")!;
    assert(robotsMeta(h) === "noindex, follow", "robots");
    assert(/<link rel="canonical" href="https:\/\/seeds.hues.flowers\/search"/.test(h), "canonical");
  });
  await check("tab bar + header use singular routes", async () => {
    const h = crawled.get("/")!;
    assert(h.includes('href="/crop"') && h.includes('href="/seller"') && !/href="\/(varieties|sellers|plants)"/.test(h), "nav links");
  });

  section("Media display (media delta)");
  await check("no crawled page hotlinks an image (remote srcs are only our own image CDN); no page has an /artwork/ hero while media is empty", async () => {
    for (const [p, h] of crawled) {
      // Image-CDN migration: a remote <img> src is allowed only on images.seeds.hues.flowers (our zone).
      const remote = [...h.matchAll(/<img\b[^>]*\bsrc="((?:https?:)?\/\/[^"]*)"/g)].map((m) => m[1]!);
      const foreign = remote.filter((u) => !u.startsWith(`${IMG_CDN}/`));
      assert(foreign.length === 0, `${p} has a hotlinked <img>: ${foreign.join(" ")}`);
      assert(!artworkImg(h), `${p} renders an /artwork/ img with no media rows`);
    }
    return `${crawled.size} pages`;
  });
  await check(`GET image-CDN original ${MEDIA_KEY} → 200 image/webp, 1120×2240, immutable cache (public/artwork retired in the 2026-11-18 migration)`, async () => {
    const r = await fetch(`${IMG_CDN}/${MEDIA_KEY}`);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.headers.get("content-type")?.startsWith("image/webp"), `content-type ${r.headers.get("content-type")}`);
    const b = new Uint8Array(await r.arrayBuffer());
    const td = new TextDecoder();
    assert(td.decode(b.slice(0, 4)) === "RIFF" && td.decode(b.slice(8, 12)) === "WEBP", "not a WebP file");
    const w = (b[24]! | (b[25]! << 8) | (b[26]! << 16)) + 1;
    const ht = (b[27]! | (b[28]! << 8) | (b[29]! << 16)) + 1;
    assert(w === 1120 && ht === 2240, `dimensions ${w}×${ht}`);
    assert(/immutable/.test(r.headers.get("cache-control") ?? ""), `cache-control ${r.headers.get("cache-control")}`);
    return `${b.length} bytes, ${r.headers.get("cache-control")}`;
  });
  await check("image CDN: transformations serve WebP at the requested width, whole (scale-down: aspect kept, never upscaled); SVG served as stored", async () => {
    const probe = async (url: string, accept = "image/webp,*/*") => {
      const r = await fetch(url, { headers: { Accept: accept } });
      assert(r.status === 200, `${url} → ${r.status}`);
      return { type: r.headers.get("content-type") ?? "", bytes: new Uint8Array(await r.arrayBuffer()) };
    };
    const out: string[] = [];
    // A shipped WebP original, a .png master looked up from a .webp stored path, and the 1:2 standard.
    for (const [width, key] of [[480, MEDIA_KEY], [768, MEDIA_KEY], [480, "artwork/amaranth-mira.png"]] as const) {
      const { type, bytes } = await probe(cdn(width, key));
      assert(type.startsWith("image/webp"), `${key}@${width}: content-type ${type}`);
      const size = webpSize(bytes);
      assert(size && size.w === width && size.h === width * 2, `${key}@${width}: ${size ? `${size.w}×${size.h}` : "not a WebP"}`);
      out.push(`${key}@${width}=${size.w}×${size.h}`);
    }
    // Never upscaled: asking for more than the 1120-wide original returns the original width.
    const big = webpSize((await probe(cdn(2000, "artwork/amaranth-mira.png"))).bytes);
    assert(big && big.w === 1120 && big.h === 2240, `upscaled: ${big ? `${big.w}×${big.h}` : "not a WebP"}`);
    // A non-1:2 crop original keeps its own aspect (no crop / pad by the transformation).
    const crop = webpSize((await probe(PLANT_HERO_SRC)).bytes);
    assert(crop && crop.w <= 1120 && crop.h > 0, `crop original: ${crop ? `${crop.w}×${crop.h}` : "not a WebP"}`);
    // Clients without WebP/AVIF (link-preview crawlers) still get an image.
    const plain = await probe(cdn(1120, MEDIA_KEY), "*/*");
    assert(/^image\//.test(plain.type), `Accept */*: content-type ${plain.type}`);
    const svg = await probe(`${IMG_CDN}/theme/divider-stem.svg`, "*/*");
    assert(svg.type.startsWith("image/svg+xml"), `divider-stem.svg: content-type ${svg.type}`);
    return `${out.join(", ")}; crop ${crop.w}×${crop.h}; */* → ${plain.type}`;
  });
  if (!IS_LOCAL_BASE || args.flags.has("skip-media")) {
    console.log(`  (media-row checks skipped: they insert into the LOCAL D1, and ${BASE} is not a local preview)`);
  } else {
    const token = revalidateToken();
    const credit = `Acceptance illustration credit ${RUN}`;
    let inserted = false;
    try {
      await check(`insert a media row for ${MEDIA_SLUG} (local D1 via the platform proxy)${token ? " and revalidate variety:" + MEDIA_SLUG : ""}`, async () => {
        const n = await localD1(
          "INSERT INTO media (variety_id, r2_key, licence, credit, created_at) SELECT id, ?, ?, ?, ? FROM varieties WHERE slug = ?",
          MEDIA_PATH,
          `acceptance-test ${RUN}`,
          credit,
          new Date().toISOString(),
          MEDIA_SLUG,
        );
        assert(n === 1, `inserted ${n} rows`);
        inserted = true;
        if (token) await revalidateVariety(token, MEDIA_SLUG);
        return token ? "revalidated with the .dev.vars token" : "NO REVALIDATE_TOKEN: relying on a cache miss";
      });
      await check("API detail carries the media row", async () => {
        const v = (await getJson<{ data: { media: { url: string; licence: string; credit: string }[] } }>(`/api/v1/varieties/${MEDIA_SLUG}`)).data;
        assert(v.media.length === 1 && v.media[0]!.url === MEDIA_PATH && v.media[0]!.credit === credit, JSON.stringify(v.media));
        const none = (await getJson<{ data: { media: unknown[] } }>(`/api/v1/varieties/${NO_MEDIA_SLUG}`)).data;
        assert(Array.isArray(none.media) && none.media.length === 0, `${NO_MEDIA_SLUG} media ${JSON.stringify(none.media)}`);
      });
      await check(`variety page renders the hero: <img src="${cdn(1120, MEDIA_KEY)}"> (768w/1120w srcset) with illustration alt, 1120×2240, no caption; og:image is the illustration`, async () => {
        const { h, attempt } = await pageUntil(`/variety/${MEDIA_SLUG}`, (x) => heroImg(x) !== null);
        const img = heroImg(h)!;
        assert(attr(img, "src") === cdn(1120, MEDIA_KEY), `src ${attr(img, "src")}`);
        const ss = attr(img, "srcset") ?? attr(img, "srcSet");
        assert(ss === `${cdn(768, MEDIA_KEY)} 768w, ${cdn(1120, MEDIA_KEY)} 1120w`, `srcset ${ss}`);
        assert(/illustration/.test(attr(img, "alt") ?? ""), `alt ${attr(img, "alt")}`);
        assert(attr(img, "alt") === "Queen Lime Blush Zinnia — illustration", `alt ${attr(img, "alt")}`);
        assert(attr(img, "width") === "1120" && attr(img, "height") === "2240", "width/height attributes");
        assert(attr(img, "loading") === "eager", "loading=eager");
        assert(!h.includes("<figcaption"), "figcaption present");
        assert(!h.includes(credit), "credit text rendered on page");
        assert(metaContent(h, "og:image") === cdn(1120, MEDIA_KEY), `og:image ${metaContent(h, "og:image")}`);
        assert(metaContent(h, "og:image:width") === "1120" && metaContent(h, "og:image:height") === "2240", "og:image dimensions");
        // format=auto negotiates per client (JPEG for crawlers, AVIF/WebP for browsers): no fixed type.
        assert(metaContent(h, "og:image:type") === null, `og:image:type ${metaContent(h, "og:image:type")}`);
        assert(h.includes(`<meta name="twitter:image" content="${cdn(1120, MEDIA_KEY)}"`), "twitter:image");
        return `fetch ${attempt}`;
      });
      await check(`no-media variety (${NO_MEDIA_SLUG}) renders no /artwork/ hero and keeps the generated OG card`, async () => {
        const h = await html(`/variety/${NO_MEDIA_SLUG}`);
        assert(!heroImg(h) && !h.includes("<figcaption"), "hero present");
        assert(metaContent(h, "og:image") === `https://seeds.hues.flowers/og/variety/${NO_MEDIA_SLUG}`, `og:image ${metaContent(h, "og:image")}`);
      });
      await check("API variety list items carry media: the row for the media variety, [] for the rest", async () => {
        type M = { url: string; licence: string; credit: string; thumbUrl?: string };
        // The API keeps the canonical stored path in `url` (rendering alone moved to the CDN).
        const list = (await getJson<{ data: { slug: string; media: M[] }[] }>("/api/v1/varieties?crop=zinnia&limit=100")).data;
        const m = list.find((x) => x.slug === MEDIA_SLUG)?.media ?? [];
        assert(m.length === 1 && m[0]!.url === MEDIA_PATH && m[0]!.credit === credit && m[0]!.thumbUrl === undefined, JSON.stringify(m));
        assert(list.every((x) => Array.isArray(x.media)), "a list item without a media array");
        assert(list.filter((x) => x.media.length > 0).length === 1, "more than one variety has media");
      });
      await check(`variety card: <img src="${cdn(480, MEDIA_KEY)}"> (480w/768w srcset, alt, 480×960, lazy, contain in a 1:2 frame), placeholder for the rest, whole card one link`, async () => {
        // /crop/{slug} is force-dynamic, so the new row shows without a revalidate. Walk the
        // name-sorted pages of the colour filter until the card turns up.
        const w480 = cdn(480, MEDIA_KEY);
        const w768 = cdn(768, MEDIA_KEY);
        let h = "";
        let card: string | null = null;
        for (let page = 1; page <= 20 && !card; page++) {
          const r = await get(`/crop/zinnia?color_family=green${page > 1 ? `&page=${page}` : ""}`);
          if (r.status !== 200) break;
          h = await r.text();
          card = varietyCard(h, MEDIA_SLUG);
        }
        assert(card, `no ${MEDIA_SLUG} card on /crop/zinnia?color_family=green`);
        const img = imgWithSrc(card, w480);
        assert(img, "480-wide card image not inside the card");
        // React SSR emits the camelCase name `srcSet=`; HTML attribute names are case-insensitive, so accept either.
        const ss = attr(img, "srcset") ?? attr(img, "srcSet");
        assert(ss === `${w480} 480w, ${w768} 768w`, `srcset ${ss}`);
        assert(attr(img, "alt") === "Queen Lime Blush — illustration", `alt ${attr(img, "alt")}`);
        assert(attr(img, "width") === "480" && attr(img, "height") === "960", "width/height attributes");
        assert(attr(img, "loading") === "lazy", "loading=lazy");
        assert(/\bobject-contain\b/.test(attr(img, "class") ?? "") && !/object-cover/.test(card), "object-contain, never cover");
        assert(/class="[^"]*aspect-\[1\/2\]/.test(card), "aspect-[1/2] frame");
        assert(!h.includes(`src="${cdn(1120, MEDIA_KEY)}"`) && !h.includes(`${cdn(1120, MEDIA_KEY)} 1120w`), "card grid loads the 1120-wide hero size");
        // The whole card is one link, labelled with the name and crop, ending in the availability line.
        assert((card.match(/<a\b/g) ?? []).length === 1, "card has more than one link");
        assert(/<a\b[^>]*aria-label="Queen Lime Blush — Zinnia"/.test(card), "card link aria-label");
        assert(/>(No sellers yet|\d+ sellers?)</.test(card), "availability line");
        assert(!/Last checked|in stock|<h[23]\b/.test(card), "old card content (Last checked / in-stock / heading)");
        // Every other card on the page has the placeholder; its only <img> is the decorative zinnia
        // pod motif inside the placeholder frame (pod-ornament delta).
        const others = [...h.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
          .map((x) => x[1]!)
          .filter((li) => /href="\/variety\/[^"]+"/.test(li) && !li.includes(`href="/variety/${MEDIA_SLUG}"`));
        for (const li of others) {
          assert(li.includes('data-testid="variety-card-placeholder"'), "a no-media card without the placeholder");
          const imgs = li.match(/<img\b[^>]*>/g) ?? [];
          assert(imgs.every((i) => attr(i, "src") === POD_MOTIF_ZINNIA), `a no-media card has a non-motif img: ${imgs.join(" ")}`);
          const ph = placeholderFrame(li) ?? "";
          assert((ph.match(/<img\b/g) ?? []).length === imgs.length, "a pod motif outside the placeholder frame");
        }
        return `${others.length} placeholder card(s) beside it`;
      });
    } finally {
      await check("cleanup: delete the media row (and revalidate); the page drops the hero", async () => {
        const n = await localD1("DELETE FROM media WHERE r2_key = ? AND credit = ?", MEDIA_PATH, credit);
        assert(!inserted || n === 1, `deleted ${n} rows`);
        if (token) await revalidateVariety(token, MEDIA_SLUG);
        const { attempt } = await pageUntil(`/variety/${MEDIA_SLUG}`, (x) => heroImg(x) === null);
        const v = (await getJson<{ data: { media: unknown[] } }>(`/api/v1/varieties/${MEDIA_SLUG}`)).data;
        assert(v.media.length === 0, "API still returns media");
        return `deleted ${n} row(s); hero gone on fetch ${attempt}`;
      });
    }
  }

  section("Plant media display (plant-media delta)");
  await check("no page has an artwork/crops/ img while plant media is empty", async () => {
    for (const [p, h] of crawled) assert(!cropImg(h), `${p} renders an artwork/crops/ img with no media rows`);
    for (const p of ["/", "/crop", `/crop/${PLANT_MEDIA_SLUG}`]) assert(!cropImg(await html(p)), `${p} renders an artwork/crops/ img`);
    const c = (await getJson<{ data: { media: unknown[] } }>(`/api/v1/crops/${PLANT_MEDIA_SLUG}`)).data;
    assert(Array.isArray(c.media) && c.media.length === 0, `crop media ${JSON.stringify(c.media)}`);
    return `${crawled.size} pages + /, /crop, /crop/${PLANT_MEDIA_SLUG}`;
  });
  if (!IS_LOCAL_BASE || args.flags.has("skip-media")) {
    console.log(`  (plant-media-row checks skipped: they insert into the LOCAL D1, and ${BASE} is not a local preview)`);
  } else {
    const token = revalidateToken();
    const credit = `Acceptance crop illustration credit ${RUN}`;
    let inserted = false;
    try {
      await check(`insert a plant media row for ${PLANT_MEDIA_SLUG} (local D1 via the platform proxy)${token ? " and revalidate " + PLANT_MEDIA_TAGS.join(", ") : ""}`, async () => {
        const n = await localD1(
          "INSERT INTO media (plant_id, r2_key, licence, credit, created_at) SELECT id, ?, ?, ?, ? FROM plants WHERE slug = ?",
          PLANT_MEDIA_PATH,
          `acceptance-test ${RUN}`,
          credit,
          new Date().toISOString(),
          PLANT_MEDIA_SLUG,
        );
        assert(n === 1, `inserted ${n} rows`);
        inserted = true;
        if (token) await revalidateTags(token, PLANT_MEDIA_TAGS);
        return token ? "revalidated with the .dev.vars token" : "NO REVALIDATE_TOKEN: relying on a cache miss";
      });
      await check("API crop detail and crop list carry the row as stored (canonical url, no thumbUrl); the no-media crop has []", async () => {
        type M = { url: string; thumbUrl?: string; licence: string; credit: string };
        const want = (m: M[]) => m.length === 1 && m[0]!.url === PLANT_MEDIA_PATH && m[0]!.thumbUrl === undefined && m[0]!.credit === credit;
        const c = (await getJson<{ data: { media: M[] } }>(`/api/v1/crops/${PLANT_MEDIA_SLUG}`)).data;
        assert(want(c.media), `detail ${JSON.stringify(c.media)}`);
        const list = await walkCrops<{ slug: string; media: M[] }>();
        assert(want(list.find((x) => x.slug === PLANT_MEDIA_SLUG)?.media ?? []), "list entry");
        assert(list.filter((x) => x.media.length > 0).length === 1, "only one crop has media");
        const none = (await getJson<{ data: { media: unknown[] } }>(`/api/v1/crops/${PLANT_NO_MEDIA_SLUG}`)).data;
        assert(Array.isArray(none.media) && none.media.length === 0, `${PLANT_NO_MEDIA_SLUG} media ${JSON.stringify(none.media)}`);
      });
      for (const page of ["/", "/crop"]) {
        await check(`${page} card shows the thumbnail <img src="${PLANT_CARD_SRC}"> (alt, 480×960, lazy, 1:2 wrapper); ${PLANT_NO_MEDIA_SLUG} card has none`, async () => {
          const { h, attempt } = await pageUntil(page, (x) => imgWithSrc(x, PLANT_CARD_SRC) !== null);
          const card = cropCard(h, PLANT_MEDIA_SLUG);
          assert(card, `no ${PLANT_MEDIA_SLUG} card`);
          const img = imgWithSrc(card, PLANT_CARD_SRC);
          assert(img, "thumbnail not inside the zinnia card");
          assert(attr(img, "alt") === `${PLANT_MEDIA_NAME} — illustration`, `alt ${attr(img, "alt")}`);
          assert(attr(img, "width") === "480" && attr(img, "height") === "960", "width/height attributes");
          assert(attr(img, "loading") === "lazy", "loading=lazy");
          // The wrapper matches the 480×960 (1:2) thumbnails since the theme delta (CropCardImage).
          assert(/class="[^"]*aspect-\[1\/2\]/.test(card), "aspect-[1/2] wrapper");
          assert(!h.includes(`src="${PLANT_HERO_SRC}"`), "card grid loads the full-size hero");
          const other = cropCard(h, PLANT_NO_MEDIA_SLUG);
          assert(other && !/<img\b/.test(other), `${PLANT_NO_MEDIA_SLUG} card has an img`);
          // Theme delta: decorative /theme/ art (the home hero) is not a crop thumbnail; count the rest.
          // Branding delta: the Hues wordmark (/brand/) in the header and footer is not one either.
          // Pod-ornament delta: nor are the decorative seed-pod ornaments (/ornaments/).
          // Image-CDN migration: theme and ornament art are now CDN transformations of theme/ and ornaments/ keys.
          const notDecor = new RegExp(`<img\\b(?![^>]*\\bsrc="(?:/brand/|${cdnSrcRe("(?:theme|ornaments)/")}))`, "g");
          assert((h.match(notDecor) ?? []).length === 1, "exactly one non-theme, non-brand, non-ornament img on the page");
          return `fetch ${attempt}`;
        });
      }
      await check(`crop page renders the hero <img src="${PLANT_HERO_SRC}"> (768w/1120w srcset, alt, 1120×2240, no caption); og:image is the illustration`, async () => {
        const { h, attempt } = await pageUntil(`/crop/${PLANT_MEDIA_SLUG}`, (x) => imgWithSrc(x, PLANT_HERO_SRC) !== null);
        const img = imgWithSrc(h, PLANT_HERO_SRC)!;
        const ss = attr(img, "srcset") ?? attr(img, "srcSet");
        assert(ss === `${cdn(768, PLANT_MEDIA_KEY)} 768w, ${PLANT_HERO_SRC} 1120w`, `srcset ${ss}`);
        assert(attr(img, "alt") === `${PLANT_MEDIA_NAME} — illustration`, `alt ${attr(img, "alt")}`);
        assert(attr(img, "width") === "1120" && attr(img, "height") === "2240", "width/height attributes");
        assert(attr(img, "loading") === "eager", "loading=eager");
        assert(/data-testid="crop-hero"/.test(h), "crop-hero figure");
        assert(!h.includes("<figcaption"), "figcaption present");
        assert(!h.includes(credit), "credit text rendered on page");
        assert(metaContent(h, "og:image") === PLANT_HERO_SRC, `og:image ${metaContent(h, "og:image")}`);
        assert(metaContent(h, "og:image:width") === "1120" && metaContent(h, "og:image:height") === "2240", "og:image dimensions");
        assert(metaContent(h, "og:image:type") === null, `og:image:type ${metaContent(h, "og:image:type")}`);
        assert(h.includes(`<meta name="twitter:image" content="${PLANT_HERO_SRC}"`), "twitter:image");
        return `fetch ${attempt}`;
      });
      await check(`no-media crop page (${PLANT_NO_MEDIA_SLUG}) renders no artwork/crops/ img and keeps the generated OG card`, async () => {
        const h = await html(`/crop/${PLANT_NO_MEDIA_SLUG}`);
        assert(!cropImg(h) && !h.includes("<figcaption"), "hero present");
        assert(metaContent(h, "og:image") === `https://seeds.hues.flowers/og/crop/${PLANT_NO_MEDIA_SLUG}`, `og:image ${metaContent(h, "og:image")}`);
      });
    } finally {
      await check("cleanup: delete the plant media row (and revalidate); grid, index and crop page drop the image", async () => {
        const n = await localD1("DELETE FROM media WHERE r2_key = ? AND credit = ?", PLANT_MEDIA_PATH, credit);
        assert(!inserted || n === 1, `deleted ${n} rows`);
        if (token) await revalidateTags(token, PLANT_MEDIA_TAGS);
        const attempts: string[] = [];
        for (const p of ["/", "/crop", `/crop/${PLANT_MEDIA_SLUG}`]) {
          const { attempt } = await pageUntil(p, (x) => cropImg(x) === null);
          attempts.push(`${p} fetch ${attempt}`);
        }
        const c = (await getJson<{ data: { media: unknown[] } }>(`/api/v1/crops/${PLANT_MEDIA_SLUG}`)).data;
        assert(c.media.length === 0, "API still returns media");
        return `deleted ${n} row(s); image gone: ${attempts.join(", ")}`;
      });
    }
  }

  section("Pod ornaments (pod-ornament delta)");
  /** Script-free document markup. <script> payloads are dropped, since the RSC payload carries a
   *  serialized copy of the whole tree and streamed chunk order varies, so matching against the raw
   *  document can land inside a payload string instead of an element. */
  const noScripts = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ");
  /** The page's <main> element markup, script-free: the page content, without the header and footer. */
  const mainHtml = (h: string) => {
    const m = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(noScripts(h));
    assert(m, "no <main> element");
    return m[1]!;
  };
  /** The footer-adjacent slot (FooterStem, data-testid="footer-stem"): from its opening tag to the
   *  <footer>. The slot sits between </main> and <footer> and renders the thin divider-stem rule
   *  there in server HTML on every page (its bundle-ending suppression is client-side). */
  const footerSlot = (h: string) => {
    const x = noScripts(h);
    const start = x.lastIndexOf("<div", x.indexOf('data-testid="footer-stem"'));
    const end = x.indexOf("<footer", start);
    return start >= 0 && end > start && x.indexOf('data-testid="footer-stem"') >= 0 ? x.slice(start, end) : null;
  };
  const podImg = (h: string, src: string) => {
    const img = imgWithSrc(h, src);
    assert(img, `no <img src="${src}">`);
    assert(attr(img, "alt") === "" && attr(img, "aria-hidden") === "true", `${src} is not decorative`);
    return img;
  };
  await check("/crop/zinnia: header pod motif + pod divider before the grower guide; motif in the card placeholders", async () => {
    const h = await html("/crop/zinnia");
    podImg(h, POD_MOTIF_ZINNIA);
    assert(h.includes(`src="${podBundle("zinnia")}"`), "no bundle-zinnia divider");
    const div = h.indexOf('data-testid="pod-divider"');
    const guide = h.indexOf('data-testid="grower-guide"');
    assert(div >= 0 && guide > div, "pod divider is not before the grower guide");
    const ph = [...h.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((x) => placeholderFrame(x[1]!)).filter((x): x is string => x !== null);
    // The local DB has no media rows, so the cards render placeholders.
    if (ph.length) assert(ph.every((x) => imgWithSrc(x, POD_MOTIF_ZINNIA) !== null), "a zinnia card placeholder without the pod motif");
    return `${ph.length} placeholder(s) with the motif`;
  });
  await check("/crop/cornflower: the bachelor-button pod motif", async () => {
    const h = await html("/crop/cornflower");
    podImg(h, cdn(480, "ornaments/motif-bachelor-button.png"));
    assert(h.includes(`src="${podBundle("bachelor-button")}"`), "no bundle-bachelor-button divider");
  });
  await check("/crop/dahlia (no pod art): no ornaments and no pod divider in the page content", async () => {
    const body = mainHtml(await html("/crop/dahlia"));
    assert(!body.includes("ornaments/"), "ornament in <main>");
    assert(!body.includes('data-testid="pod-divider"'), "pod divider rendered");
  });
  await check("home: cosmos + sunflower pod dividers; /variety: zinnia pod divider; footer element has no ornament, stem rule above it", async () => {
    const home = await html("/");
    for (const b of ["cosmos", "sunflower"]) assert(home.includes(`src="${podBundle(b)}"`), `home has no bundle-${b}`);
    assert((home.match(/data-testid="pod-divider"/g) ?? []).length === 2, "home has other than two pod dividers");
    const v = await html("/variety");
    assert(v.includes(`src="${podBundle("zinnia")}"`), "/variety has no bundle-zinnia");
    // Scope to the footer ELEMENT, in script-free HTML: the RSC payload carries a serialized
    // copy of the whole tree (footer included) and streamed chunk order varies, so matching
    // against the raw document can land inside a payload string instead of the element.
    // The thin stem rule sits in the FooterStem slot on the paper ground ABOVE the paper-deep
    // <footer> element, never inside it.
    const footer = /<footer[\s\S]*?<\/footer>/.exec(home.replace(/<script[\s\S]*?<\/script>/g, " "))?.[0] ?? "";
    assert(!footer.includes("ornaments/"), "footer carries an ornament (motif or bundle)");
    assert(!footer.includes('data-testid="footer-stem"'), "stem rule inside the <footer> element");
    assert(footer.length > 0, "footer element not found");
    const slot = footerSlot(home);
    assert(slot, "no footer-stem slot before the <footer>");
    assert(slot.includes("divider-stem"), "footer slot without the divider-stem rule");
  });
  /** The motif-B wrapper (data-testid="motif-b") and its <img>, from the first occurrence in `h`. */
  const motifB = (h: string) => {
    const i = h.indexOf('data-testid="motif-b"');
    if (i < 0) return null;
    const wrapper = h.slice(h.lastIndexOf("<div", i), h.indexOf(">", i) + 1);
    const img = /<img\b[^>]*>/.exec(h.slice(i))?.[0] ?? null;
    return { wrapper, img };
  };
  const assertMotifB = (h: string, where: string, sizes: string) => {
    const m = motifB(h);
    assert(m, `${where}: no data-testid="motif-b"`);
    assert(attr(m.wrapper, "aria-hidden") === "true", `${where}: motif wrapper is not aria-hidden`);
    assert(m.img, `${where}: motif has no <img>`);
    assert(attr(m.img, "src") === MOTIF_B_SRC, `${where}: src ${attr(m.img, "src")}`);
    const ss = attr(m.img, "srcset") ?? attr(m.img, "srcSet");
    assert(ss === [600, 900, 1200].map((w) => `${cdn(w, MOTIF_B_KEY)} ${w}w`).join(", "), `${where}: srcset ${ss}`);
    assert(attr(m.img, "sizes") === sizes, `${where}: sizes ${attr(m.img, "sizes")}`);
    assert(attr(m.img, "alt") === "", `${where}: motif alt is not empty`);
    assert(attr(m.img, "width") === "2400" && attr(m.img, "height") === "518", `${where}: width/height ${attr(m.img, "width")}×${attr(m.img, "height")}`);
    assert(attr(m.img, "loading") === "lazy", `${where}: loading ${attr(m.img, "loading")}`);
  };
  await check(`home: divider motif B (<img src="${MOTIF_B_SRC}">) once in the page content, between the hero and Browse by crop`, async () => {
    const main = mainHtml(await html("/"));
    assert((main.match(/data-testid="motif-b"/g) ?? []).length === 1, "home <main> has other than one motif B");
    assertMotifB(main, "home <main>", "min(480px, 92vw)");
    const at = main.indexOf('data-testid="motif-b"');
    assert(main.indexOf('id="hero-title"') < at && at < main.indexOf('id="crops-title"'), "motif B is not between the hero and Browse by crop");
    assert((main.match(/data-testid="pod-divider"/g) ?? []).length === 2, "home <main> has other than two pod dividers");
  });
  // The footer-adjacent motif B placement was removed 2026-11-19 at Dustin's direction (its
  // painted ground did not match the page ground). On 2026-11-20 he directed the slot's original
  // thin stem rule restored: the FooterStem slot renders the divider-stem rule above the footer
  // on every page, and motif B stays out of the slot — it appears nowhere outside <main>.
  await check("/variety/sweet-pea-kings-ransom: content keeps the thin divider-stem rule; footer slot carries the stem, no motif B anywhere", async () => {
    const h = crawled.get("/variety/sweet-pea-kings-ransom") ?? (await html("/variety/sweet-pea-kings-ransom"));
    const main = mainHtml(h);
    assert(/\bclass="[^"]*\bdivider-stem(?:-mini)?\b/.test(main), "no divider-stem rule in the variety content");
    assert(!main.includes('data-testid="motif-b"'), "motif B inside the variety content");
    assert(!main.includes(MOTIF_B_KEY), "motif B image inside the variety content");
    const slot = footerSlot(h);
    assert(slot, "no footer-stem slot before the <footer>");
    assert(slot.includes("divider-stem"), "footer slot without the divider-stem rule");
    assert(slot.includes('aria-hidden="true"'), "footer slot is not decorative (aria-hidden)");
    assert(!slot.includes('data-testid="motif-b"') && !slot.includes(MOTIF_B_KEY), "motif B in the footer slot");
    const doc = noScripts(h);
    const outside = doc.replace(/<main\b[^>]*>[\s\S]*<\/main>/, " ");
    assert(outside.length < doc.length, "no <main> element");
    assert(!outside.includes('data-testid="motif-b"') && !outside.includes(MOTIF_B_KEY), "motif B outside <main>");
  });
  await check(`image CDN: motif B ${MOTIF_B_KEY} at 1200 → WebP 1200×259, whole (4.63:1 kept)`, async () => {
    const r = await fetch(MOTIF_B_SRC, { headers: { Accept: "image/webp,*/*" } });
    assert(r.status === 200, `${MOTIF_B_SRC} → ${r.status}`);
    const type = r.headers.get("content-type") ?? "";
    assert(type.startsWith("image/webp"), `content-type ${type}`);
    const size = webpSize(new Uint8Array(await r.arrayBuffer()));
    assert(size && size.w === 1200 && size.h === 259, `motif B@1200: ${size ? `${size.w}×${size.h}` : "not a WebP"}`);
    return `${size.w}×${size.h}`;
  });

  section("Search (R12)");
  await check("short queries return matches (ka → results; katz → Katz Mix); mixed result types", async () => {
    // "ka" alone no longer surfaces Katz Mix in the top results: the flowering-kale varieties
    // added in Nov 2026 match it too and rank ahead. The specific-variety assertion therefore
    // uses the distinctive query "katz"; "ka" still has to return matches at all.
    const ka = await getJson<{ data: { varieties: { slug: string }[]; crops: unknown[] } }>("/api/v1/search?q=ka");
    assert(ka.data.varieties.length > 0, "ka returned no varieties");
    const r = await getJson<{ data: { varieties: { slug: string }[]; crops: unknown[] } }>("/api/v1/search?q=katz");
    assert(r.data.varieties.some((v) => v.slug === "stock-katz-mix"), "katz");
    const z = await getJson<{ data: { crops: { href: string }[]; series: unknown[]; varieties: unknown[] } }>("/api/v1/search?q=zinnia");
    assert(z.data.crops[0]?.href === "/crop/zinnia" && z.data.varieties.length > 0, "mixed");
    const t = text(await html("/search?q=katz"));
    assert(t.includes("Katz Mix"), "search page");
  });
  const zeroQuery = `nothing${RUN}`;
  await check(`zero results: "Not in the catalog yet" + report link (query "${zeroQuery}")`, async () => {
    const h = await html(`/search?q=${zeroQuery}`);
    assert(text(h).includes("Not in the catalog yet") && h.includes('href="/report?type=correct"'), "zero-result state");
  });

  section("Sync (R9)");
  await check("snapshot: spec keys, ETag derives from catalog_seq, 304 on match", async () => {
    const r = await get("/api/v1/sync/snapshot");
    const b = (await r.json()) as Record<string, unknown> & { catalog_seq: number; varieties: unknown[]; sellers: unknown[]; listings: unknown[] };
    assert(JSON.stringify(Object.keys(b)) === JSON.stringify(["catalog_seq", "schema_version", "generated_at", "crops", "series", "varieties", "names", "sellers", "listings"]), Object.keys(b).join(","));
    assert(r.headers.get("etag") === `"seq-${b.catalog_seq}"`, `etag ${r.headers.get("etag")}`);
    assert((await get("/api/v1/sync/snapshot", { headers: { "If-None-Match": `"seq-${b.catalog_seq}"` } })).status === 304, "304");
    return `seq ${b.catalog_seq}: ${b.varieties.length} varieties, ${b.sellers.length} sellers, ${b.listings.length} listings`;
  });
  await check("changes: shape; since in the future → 400; since < 0 → 410 resync_required (problem+json)", async () => {
    const c = await getJson<{ data: { upserts: Record<string, unknown[]>; deletes: unknown[]; next_seq: number; has_more: boolean } }>("/api/v1/sync/changes?since=0&limit=20");
    assert(c.data.has_more === true && c.data.next_seq > 0 && Array.isArray(c.data.deletes), "shape");
    const f = await get("/api/v1/sync/changes?since=99999999");
    assert(f.status === 400 && f.headers.get("content-type") === "application/problem+json", `future ${f.status}`);
    const g = await get("/api/v1/sync/changes?since=-1");
    const gb = (await g.json()) as { code: string };
    assert(g.status === 410 && gb.code === "resync_required", `negative ${g.status} ${gb.code}`);
  });

  // ─── write flows ───────────────────────────────────────────────────────────
  section("Keys + auth (D5)");
  let ADMIN = args.values.get("admin-key") ?? process.env.ACCEPTANCE_ADMIN_KEY ?? "";
  let INGEST = args.values.get("ingest-key") ?? process.env.ACCEPTANCE_INGEST_KEY ?? "";
  await check("ingest + admin keys available (minted against local D1 unless supplied)", async () => {
    if (!ADMIN) ADMIN = mintKey("admin");
    if (!INGEST) INGEST = mintKey("ingest");
    return minted.length ? `minted ${minted.length} key(s) for this run` : "supplied";
  });
  const auth = (k: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${k}`, ...extra });
  const postJson = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const r = await get(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: r.status, headers: r.headers, json: json as { data?: Record<string, unknown>; code?: string; detail?: string } };
  };
  await check("401 without a key, 403 with the wrong scope, problem+json, no-store", async () => {
    const none = await get("/api/v1/admin/health");
    assert(none.status === 401 && none.headers.get("content-type") === "application/problem+json" && none.headers.get("cache-control") === "no-store", `none ${none.status}`);
    assert((await get("/api/v1/admin/health", { headers: auth(INGEST) })).status === 403, "ingest key on admin");
    assert((await get("/api/v1/ingest/match-context?crop=zinnia", { headers: auth(ADMIN) })).status === 403, "admin key on ingest");
  });
  await check("admin health: no invariant violations", async () => {
    const h = await getJson<{ data: { ok: boolean; invariants: { violations: unknown[] } } }>("/api/v1/admin/health", { headers: auth(ADMIN) });
    assert(h.data.ok, JSON.stringify(h.data.invariants.violations));
  });

  section("/go + demand signals (R7, R11)");
  const sweetPeaListing = (await getJson<{ data: Listing[] }>("/api/v1/varieties/sweet-pea-kings-ransom/listings")).data.find((l) => l.seller.slug === "songbird-seed-co")!;
  await check("/go/{id}: 302 to the product page with UTM, Cache-Control no-store", async () => {
    const r = await get(`/go/${sweetPeaListing.id}`, { headers: { "User-Agent": BROWSER_UA, Referer: `${BASE}/variety/sweet-pea-kings-ransom`, "X-Client": "acceptance/1" } });
    assert(r.status === 302, `status ${r.status}`);
    assert(r.headers.get("location") === "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m?utm_source=seedfinder&utm_medium=referral", `location ${r.headers.get("location")}`);
    assert(r.headers.get("cache-control") === "no-store", `cache-control ${r.headers.get("cache-control")}`);
  });
  await check("view beacon + zero-result search + click show up in admin demand stats", async () => {
    const b = await get("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "view", varietySlug: "stock-katz-mix" }) });
    assert(b.status === 204, `beacon ${b.status}`);
    await getJson(`/api/v1/search?q=${zeroQuery}`, { headers: { "X-Client": "acceptance/1" } });
    const d = await getJson<{ data: Record<string, { slug?: string; query?: string; clicks?: number; views?: number }[]> }>(`/api/v1/admin/stats/demand?since=${new Date().toISOString().slice(0, 10)}`, { headers: auth(ADMIN) });
    assert(d.data.top_clicked_varieties!.some((x) => x.slug === "sweet-pea-kings-ransom"), "click not counted");
    assert(d.data.top_zero_seller_views!.some((x) => x.slug === "stock-katz-mix"), "view not counted");
    assert(d.data.top_zero_result_searches!.some((x) => x.query === zeroQuery), "zero-result search not logged");
  });
  await check("rollup: POST /admin/rollup aggregates today's clicks into daily_stats", async () => {
    const r = await postJson("/api/v1/admin/rollup", { date: new Date().toISOString().slice(0, 10) }, auth(ADMIN));
    assert(r.status === 200 && Number(r.json.data?.clicks) >= 1, JSON.stringify(r.json));
    return `${String(r.json.data?.rows)} rows, ${String(r.json.data?.clicks)} clicks`;
  });

  section("Ingest: planted evidence-validation tests (R10)");
  const domain = `throwaway-${RUN}.example`;
  const productUrl = `https://shop.${domain}/products/dearest-sunset?variant=packet`;
  const SNAPSHOT = `Dearest Sunset Zinnia Seeds\n50 seeds per packet\nIn stock\nShips in spring. (acceptance run ${RUN})`;
  let sellerSlug = "";
  let sellerId = 0;
  let sourceId = 0;
  let listingId = 0;
  const obs = (product: Record<string, unknown> = {}, match: Record<string, unknown> = {}) => ({
    schema: "listing_observation/1",
    seller_id: sellerSlug,
    source_id: sourceId,
    product: {
      url: productUrl,
      external_product_id: "unknown",
      variant_key: "packet",
      title_raw: "Dearest Sunset Zinnia Seeds",
      is_seed: { value: "yes", evidence: "50 seeds per packet" },
      crop: { value: "zinnia", evidence: "Zinnia Seeds" },
      variety_name: { value: "Dearest Sunset", evidence: "Dearest Sunset Zinnia Seeds" },
      availability: { value: "in_stock", evidence: "In stock" },
      ...product,
    },
    match: { variety_id: "zinnia-dearest-sunset", method: "exact", confidence: 1, ...match },
  });
  await check(`throwaway seller ${domain}: candidate → admin approve item → admin approve seller`, async () => {
    const c = await postJson("/api/v1/ingest/seller-candidates", { name: `Throwaway Farm ${RUN}`, website_url: `https://${domain}`, evidence: "acceptance fixture" }, auth(INGEST));
    assert(c.status === 201, `candidate ${c.status} ${JSON.stringify(c.json)}`);
    const a = await postJson(`/api/v1/admin/review/${String(c.json.data?.review_item_id)}/approve`, {}, auth(ADMIN));
    assert(a.status === 200 && a.json.data?.eligibility === "candidate", `approve item ${a.status} ${JSON.stringify(a.json)}`);
    sellerSlug = String(a.json.data?.seller_slug);
    sellerId = Number(a.json.data?.seller_id);
    assert((await get(`/api/v1/sellers/${sellerSlug}`)).status === 404, "candidate is public");
    const s = await postJson(`/api/v1/admin/sellers/${sellerId}/approve`, {}, auth(ADMIN));
    assert(s.status === 200 && s.json.data?.eligibility === "approved", `approve seller ${s.status}`);
    assert((await get(`/api/v1/sellers/${sellerSlug}`)).status === 200, "approved seller not public");
    return sellerSlug;
  });
  await check("register a human-captured source: snapshot stored at fetch/{sha256}.txt; idempotent", async () => {
    const body = { url: productUrl, fetched_at: new Date().toISOString(), http_status: 200, content_text: SNAPSHOT, robots_allowed: true, kind: "human" };
    const a = await postJson("/api/v1/ingest/sources", body, auth(INGEST));
    assert(a.status === 201 && /^fetch\/[0-9a-f]{64}\.txt$/.test(String(a.json.data?.snapshot_key)), `source ${a.status} ${JSON.stringify(a.json)}`);
    sourceId = Number(a.json.data?.id);
    const b = await postJson("/api/v1/ingest/sources", body, auth(INGEST));
    assert(b.status === 200 && Number(b.json.data?.id) === sourceId && b.json.data?.created === false, "not idempotent");
  });
  await check("PLANTED: a fabricated evidence quote is REJECTED with evidence_not_found", async () => {
    const r = await postJson("/api/v1/ingest/observations", { observations: [obs({ availability: { value: "in_stock", evidence: "Only 2 left, order today!" } })] }, auth(INGEST));
    const res = (r.json.data?.results as { status: string; reason?: string }[])[0]!;
    assert(r.status === 200 && res.status === "rejected" && res.reason === "evidence_not_found", JSON.stringify(res));
    const ls = await getJson<{ data: Listing[] }>("/api/v1/varieties/zinnia-dearest-sunset/listings");
    assert(!ls.data.some((l) => l.seller.slug === sellerSlug), "fabricated observation published");
  });
  await check("PLANTED: a model match QUEUES instead of publishing", async () => {
    const r = await postJson("/api/v1/ingest/observations", { observations: [obs({}, { method: "model", confidence: 0.97 })] }, auth(INGEST));
    const res = (r.json.data?.results as { status: string; reason?: string }[])[0]!;
    assert(res.status === "queued" && res.reason === "model_match", JSON.stringify(res));
  });
  await check("PLANTED: a genuine quote from the stored snapshot is ACCEPTED and publishes on an exact match", async () => {
    const r = await postJson("/api/v1/ingest/observations", { observations: [obs()] }, auth(INGEST, { "Idempotency-Key": `obs-${RUN}` }));
    const res = (r.json.data?.results as { status: string; listing_id?: number; event?: string }[])[0]!;
    assert(res.status === "published" && res.event === "first_seen", JSON.stringify(res));
    listingId = Number(res.listing_id);
    const ls = await getJson<{ data: Listing[] }>("/api/v1/varieties/zinnia-dearest-sunset/listings");
    const l = ls.data.find((x) => x.seller.slug === sellerSlug);
    assert(l && l.availability === "in_stock" && (l.provenance as { method: string }).method === "exact", JSON.stringify(l));
    const replay = await postJson("/api/v1/ingest/observations", { observations: [obs()] }, auth(INGEST, { "Idempotency-Key": `obs-${RUN}` }));
    assert(replay.headers.get("idempotency-replayed") === "true", "Idempotency-Key not replayed");
    return `listing ${listingId}`;
  });
  await check("off-domain product URL is rejected; /go keeps the farm's query string and appends UTM", async () => {
    const r = await postJson("/api/v1/ingest/observations", { observations: [obs({ url: "https://elsewhere.example/p/1" })] }, auth(INGEST));
    assert((r.json.data?.results as { reason?: string }[])[0]!.reason === "off_domain", "off_domain");
    const g = await get(`/go/${listingId}`, { headers: { "User-Agent": BROWSER_UA } });
    assert(g.status === 302 && g.headers.get("location") === `${productUrl}&utm_source=seedfinder&utm_medium=referral`, `location ${g.headers.get("location")}`);
  });

  section("Reports + throwaway-seller removal flow (R8)");
  let removalItem = 0;
  await check("POST /api/v1/reports (remove) creates a report and a review queue item", async () => {
    const r = await postJson("/api/v1/reports", { type: "remove", target_type: "seller", target_ref: sellerSlug, message: "Please remove our farm (acceptance).", contact: `owner@${domain}` });
    assert(r.status === 201 && r.json.data?.turnstile === "not_configured", `${r.status} ${JSON.stringify(r.json)}`);
    removalItem = Number(r.json.data?.review_item_id);
    const q = await getJson<{ data: { id: number; type: string; status: string }[] }>("/api/v1/admin/review?type=removal&status=pending", { headers: auth(ADMIN) });
    assert(q.data.some((i) => i.id === removalItem), "not in queue");
  });
  await check("seller page is 200 before removal", async () => {
    assert((await get(`/seller/${sellerSlug}`)).status === 200, "not 200");
  });
  await check("admin approves the removal: eligibility removed_by_request, listings removed, domain blocked", async () => {
    const r = await postJson(`/api/v1/admin/review/${removalItem}/approve`, {}, auth(ADMIN));
    assert(r.status === 200 && r.json.data?.eligibility === "removed_by_request" && r.json.data?.blocked_domain === domain, JSON.stringify(r.json));
    return `${String(r.json.data?.listings_removed)} listing(s) removed`;
  });
  await check("seller page answers 410; API answers 410; /go answers 410", async () => {
    const page = await get(`/seller/${sellerSlug}`);
    assert(page.status === 410, `page ${page.status}`);
    const api = await get(`/api/v1/sellers/${sellerSlug}`);
    assert(api.status === 410 && ((await api.json()) as { error: { code: string } }).error.code === "gone", `api ${api.status}`);
    assert((await get(`/api/v1/sellers/${sellerSlug}/listings`)).status === 410, "listings api");
    assert((await get(`/go/${listingId}`)).status === 410, "/go");
  });
  await check("removed seller excluded from seller list, variety listings, search, sitemap and sync", async () => {
    const list = await getJson<{ data: { slug: string }[] }>("/api/v1/sellers?limit=100");
    assert(!list.data.some((s) => s.slug === sellerSlug) && list.data.length === 25, "seller list");
    const ls = await getJson<{ data: Listing[] }>("/api/v1/varieties/zinnia-dearest-sunset/listings");
    assert(!ls.data.some((l) => l.seller.slug === sellerSlug), "variety listings");
    const s = await getJson<{ data: { sellers: unknown[] } }>(`/api/v1/search?q=throwaway`);
    assert(s.data.sellers.length === 0, "search");
    assert(!(await html("/sitemap.xml")).includes(sellerSlug), "sitemap");
    const snap = (await getJson<Record<string, unknown>>("/api/v1/sync/snapshot")) as { sellers: { slug: string }[] };
    assert(!snap.sellers.some((x) => x.slug === sellerSlug), "sync snapshot");
    const v = await getJson<{ data: { indexable: boolean } }>("/api/v1/varieties/zinnia-dearest-sunset");
    assert(v.data.indexable === true, "variety lost indexable after losing its only listing (owner ruling 2026-11-16: it stays indexable)");
  });
  await check("the blocked domain can no longer feed the catalog", async () => {
    const r = await postJson("/api/v1/ingest/sources", { url: `https://shop.${domain}/x`, fetched_at: new Date().toISOString(), http_status: 200, content_text: "x", robots_allowed: true, kind: "human" }, auth(INGEST));
    assert(r.status === 422 && r.json.code === "blocked_domain", `${r.status} ${JSON.stringify(r.json)}`);
    const c = await postJson("/api/v1/ingest/seller-candidates", { name: "Back again", website_url: `https://${domain}`, evidence: "x" }, auth(INGEST));
    assert(c.status === 422 && c.json.code === "blocked_domain", `candidate ${c.status}`);
  });
  await check("admin health still clean after the flow", async () => {
    const h = await getJson<{ data: { ok: boolean; invariants: { violations: unknown[] } } }>("/api/v1/admin/health", { headers: auth(ADMIN) });
    assert(h.data.ok, JSON.stringify(h.data.invariants.violations));
  });
  await check("reports are rate limited to 3/min per IP (429)", async () => {
    let saw = 0;
    for (let i = 0; i < 4; i++) {
      const r = await get("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-no-retry": "1" },
        body: JSON.stringify({ type: "correct", target_type: "seller", target_ref: "floret", message: `rate limit probe ${i}`, contact: "probe@acceptance.example" }),
      });
      if (r.status === 429) saw = i + 1;
      if (saw) break;
    }
    assert(saw > 0, "never limited");
    return `429 on request ${saw} of this burst`;
  });

  section("PWA (HTTP-level only — no browser available locally)");
  await check("manifest valid with 192/512/maskable icons from our origin", async () => {
    const m = await getJson<{ name: string; short_name: string; start_url: string; display: string; icons: { src: string; sizes: string; purpose?: string }[] }>("/manifest.webmanifest");
    assert(m.start_url === "/" && m.display === "standalone" && m.name && m.short_name, "fields");
    for (const size of ["192x192", "512x512"]) assert(m.icons.some((i) => i.sizes === size), size);
    assert(m.icons.some((i) => i.purpose === "maskable"), "maskable");
  });
  await check("sw.js served with no-cache and a build version; never intercepts /go/", async () => {
    const r = await get("/sw.js");
    assert(r.status === 200 && /no-cache|no-store/.test(r.headers.get("cache-control") ?? ""), "headers");
    const body = await r.text();
    const v = /const VERSION = "([^"]+)"/.exec(body)?.[1];
    assert(v && v !== "__SW_VERSION__", "version not stamped");
    assert(body.includes('url.pathname.startsWith("/go/")'), "/go/ not excluded");
    return `version ${v}`;
  });

  section("Phase 3: accounts, waiting lists, Add Your Farm (brief #3)");
  await check("header carries the account icon and the menu button (no Add Your Farm pill); the logo still links home", async () => {
    const h = await html("/");
    assert(!h.includes('data-testid="header-add-farm"'), "Add Your Farm pill still in header");
    assert(h.includes('data-testid="header-menu-button"'), "header menu button");
    assert(/<a[^>]*href="\/account"[^>]*aria-label="Your account"|<a[^>]*aria-label="Your account"[^>]*href="\/account"/.test(h), "account icon link");
    assert(/<a[^>]*href="\/"[^>]*aria-label="Seed Directory — home"|<a[^>]*aria-label="Seed Directory — home"[^>]*href="\/"/.test(h), "logo → /");
  });
  await check("/account (signed out) shows create + sign-in forms, noindex; /add-your-farm prefills ?state=", async () => {
    const a = await html("/account");
    assert(a.includes("Create an account") && a.includes("Sign in"), "forms");
    assert(robotsMeta(a).startsWith("noindex"), `robots ${robotsMeta(a)}`);
    const f = await html("/add-your-farm?state=VT");
    assert(/<option value="VT" selected=""/.test(f), "state prefill");
    for (const n of ["farm_name", "contact_name", "contact_email", "city", "state", "website", "about", "varieties", "authorized", "business_phone", "gbp_url", "instagram_url", "tiktok_url", "facebook_url", "wholesale", "notes"]) assert(f.includes(`name="${n}"`), `field ${n}`);
  });
  await check("state pages link to /add-your-farm?state={code}", async () => {
    const h = await html("/state/vermont");
    assert(h.includes('href="/add-your-farm?state=VT"'), "CTA");
  });
  await check("zero-seller variety pages carry the waiting-list panel; listed ones do not", async () => {
    assert((await html("/variety/zinnia-dearest-tabita")).includes('data-testid="waitlist-block"'), "panel missing");
    assert(!(await html("/variety/sweet-pea-kings-ransom")).includes('data-testid="waitlist-block"'), "panel on a listed variety");
  });
  await check("no Turnstile token → 403 on create-account, sign-in and Add Your Farm; drain needs the admin key", async () => {
    const c = await postJson("/api/v1/account", { name: "Acceptance", email: `acc-${RUN}@example.com`, phone: "5415550123", zip: "97448" });
    assert(c.status === 403 && c.json.code === "turnstile_failed", `create ${c.status}`);
    const si = await postJson("/api/v1/account/sign-in", { email: `acc-${RUN}@example.com`, phone: "5415550123" });
    assert(si.status === 403, `sign-in ${si.status}`);
    const f = await postJson("/api/v1/farm-submissions", {
      farm_name: "Acceptance Farm",
      contact_name: "Acceptance",
      contact_email: `farm-${RUN}@example.com`,
      city: "Junction City",
      state: "OR",
      website: "https://acceptance-farm.example",
      about: "An acceptance-run fixture farm.",
      varieties: "Zinnia — Dearest Sunset",
      authorized: true,
      business_phone: "5415550123",
    });
    assert(f.status === 403 && f.json.code === "turnstile_failed", `farm ${f.status}`);
    assert((await postJson("/api/v1/internal/notifications/drain", {})).status === 401, "drain without key");
    const d = await postJson("/api/v1/internal/notifications/drain", {}, auth(ADMIN));
    assert(d.status === 200, `drain ${d.status}`);
    return `drain: email ${String((d.json.data?.email as { status?: string })?.status)}, sms ${String((d.json.data?.sms as { status?: string })?.status)}`;
  });

  if (!args.flags.has("skip-rate-limit")) {
    section("Rate limit (runs last)");
    await check("burst > 120 req/min from one IP → 429 + Retry-After", async () => {
      bursting = true;
      let saw: Response | null = null;
      // The limiter counts fixed 60 s windows: a 160-request burst that straddles a window
      // boundary can split ≤ 120 / ≤ 120 and never trip. 260 always puts > 120 in one window.
      for (let i = 0; i < 260 && !saw; i++) {
        const r = await get("/api/v1/categories");
        if (r.status === 429) saw = r;
      }
      bursting = false;
      assert(saw, "never limited");
      assert(saw.headers.get("retry-after"), "no Retry-After");
    });
  }

  if (minted.length) {
    section("Cleanup");
    await check("revoke the keys minted for this run", async () => {
      revokeMinted();
      assert((await get("/api/v1/admin/health", { headers: auth(ADMIN) })).status === 401, "minted admin key still works");
      return `${minted.length} key(s) revoked`;
    });
  }

  const failed = results.filter((r) => !r.ok);
  const report = [
    `# Acceptance results — ${BASE}`,
    "",
    `Run ${RUN} at ${new Date().toISOString()}. ${results.length - failed.length}/${results.length} checks passed.`,
    "",
    ...[...new Set(results.map((r) => r.group))].flatMap((g) => [
      `## ${g}`,
      "",
      "| Result | Check | Detail |",
      "|---|---|---|",
      ...results.filter((r) => r.group === g).map((r) => `| ${r.ok ? "PASS" : "FAIL"} | ${r.name.replace(/\|/g, "\\|")} | ${r.detail.replace(/\|/g, "\\|")} |`),
      "",
    ]),
  ].join("\n");
  const out = args.values.get("report");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, report);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  revokeMinted();
  process.exit(1);
});
