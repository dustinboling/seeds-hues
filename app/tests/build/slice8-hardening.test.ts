/**
 * Slice 8 hardening contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub over the shop/hub catalog)
 * over plain HTTP with no JavaScript, Quinn-style.
 *
 * - the header matrix (§2.2): v2's header set ported verbatim + the
 *   hardening additions, asserted per route class over the wire;
 * - error surfaces: the app's own 404/410/500 pages with correct statuses,
 *   the /api/track + /api/client-errors mounts, sink delivery redacted;
 * - robots.txt served bytes vs the live recording (modulo the 3 sanctioned
 *   parameter disallows);
 * - per-template budgets (HTML weight, JS per route, image discipline);
 * - the structured-data inventory's as-built column vs emitted HTML;
 * - the automatable Day-0 rehearsal subset (sitemap shape, redirect rows,
 *   freshness — the freshness proof runs LAST: it mutates the stub).
 *
 * The full URL-by-URL parity crawl lives in slice8-parity.test.ts.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gunzipSync, gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { shopCatalogState } from "../unit/shop-catalog";
import { renderRobotsTxt } from "../../src/data/robots";
import { routeClassFor } from "../../src/server/headers";
import budget from "../../performance-budget.json";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITE = "https://seeds.hues.flowers";
const SECRET = "slice8-revalidate-secret";

const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const titleOf = (html: string): string | null => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? decodeHtml(m[1]!) : null;
};

const ldJsonBlocks = (html: string): unknown[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));

/** Top-level @type of every JSON-LD block on the page. */
const ldTypes = (html: string): string[] =>
  ldJsonBlocks(html).map((b) => (typeof b === "object" && b !== null ? String((b as { "@type": unknown })["@type"]) : "?"));

const scriptSrcs = (html: string): string[] => [
  ...new Set([
    ...[...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!),
    ...[...html.matchAll(/<link[^>]*\srel="modulepreload"[^>]*\shref="([^"]+)"/g)].map((m) => m[1]!),
  ]),
];

interface ImgTag {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
  fetchpriority: string | null;
}

const imgTags = (html: string): ImgTag[] =>
  [...html.matchAll(/<img\b([^>]*)>/g)].map((m) => {
    const attrs = m[1]!;
    const attr = (name: string): string | null => {
      const hit = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
      return hit ? hit[1]! : null;
    };
    return {
      src: attr("src") ?? "",
      alt: attr("alt"),
      width: attr("width"),
      height: attr("height"),
      loading: attr("loading"),
      fetchpriority: attr("fetchpriority"),
    };
  });

let stub!: StubApi;
let server!: ChildProcess;
let deadServer!: ChildProcess;
let sink!: Server;
let BASE = "";
let DEAD_BASE = "";
const sinkReceived: { body: string }[] = [];

async function get(
  path: string,
  opts: { follow?: boolean; headers?: Record<string, string>; base?: string } = {},
): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${opts.base ?? BASE}${path}`, {
    redirect: opts.follow ?? true ? "follow" : "manual",
    headers: opts.headers,
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

async function getBytes(path: string): Promise<{ status: number; headers: Headers; body: Buffer }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

async function postJson(
  path: string,
  body: unknown,
  opts: { base?: string } = {},
): Promise<{ status: number; headers: Headers; text: string }> {
  const res = await fetch(`${opts.base ?? BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
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

function startServer(apiBase: string, sinkUrl: string, onBase: (base: string) => void): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist-server/serve.mjs"], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: "0",
        SEEDS_API_BASE: apiBase,
        SEEDS_REVALIDATE_SECRET: SECRET,
        SEEDS_ERROR_SINK_URL: sinkUrl,
      },
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
        onBase(match[1]!);
        resolve(child);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited before listening (code ${code}). stderr:\n${stderr}`));
    });
  });
}

async function waitForSink(count: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (sinkReceived.length < count) {
    if (Date.now() - start > timeoutMs) throw new Error(`sink received ${sinkReceived.length}, wanted ${count}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

beforeAll(async () => {
  sink = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      sinkReceived.push({ body: Buffer.concat(chunks).toString("utf8") });
      res.writeHead(202, { "Content-Type": "text/plain" });
      res.end("ok");
    });
  });
  await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
  const address = sink.address();
  if (!address || typeof address === "string") throw new Error("sink: could not bind");
  const sinkUrl = `http://127.0.0.1:${address.port}/errors`;

  stub = await startStubApi(shopCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await runBuildStep(apiBase, "build");
  await runBuildStep(apiBase, "build:server");
  server = await startServer(apiBase, sinkUrl, (base) => void (BASE = base));
  // The dead-backend server: every catalog read throws, so data-driven
  // pages answer the app's own 500 (the deterministic 5xx trigger).
  deadServer = await startServer("http://127.0.0.1:9/unreachable", sinkUrl, (base) => void (DEAD_BASE = base));
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  deadServer?.kill("SIGTERM");
  await stub?.close();
  await new Promise<void>((resolve, reject) => sink.close((error) => (error ? reject(error) : resolve())));
});

const EDGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/** v2's base set verbatim + HSTS, on every response class. */
function expectBaseHeaders(headers: Headers): void {
  expect(headers.get("x-content-type-options")).toBe("nosniff");
  expect(headers.get("referrer-policy")).not.toBeNull();
  expect(headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), interest-cohort=()");
  expect(headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
}

function expectDocumentCsp(headers: Headers, strict: boolean): void {
  const csp = headers.get("content-security-policy");
  expect(csp).not.toBeNull();
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("object-src 'none'");
  if (strict) {
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).not.toContain("static.cloudflareinsights.com");
  } else {
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://static.cloudflareinsights.com");
    expect(csp).toContain("https://images.seeds.hues.flowers");
  }
}

describe("header matrix over the wire", () => {
  it("public SSR carries the base set, the document CSP, and the §9 cache posture", async () => {
    expect(routeClassFor("/variety/sweet-pea-kings-ransom")).toBe("public-ssr");
    const r = await get("/variety/sweet-pea-kings-ransom");
    expect(r.status).toBe(200);
    expectBaseHeaders(r.headers);
    expectDocumentCsp(r.headers, false);
    expect(r.headers.get("cache-control")).toBe(EDGE_CACHE);
    expect(r.headers.get("x-robots-tag")).toBeNull();
  });

  it("prerendered documents carry the same posture (regenerated on invalidation)", async () => {
    const r = await get("/about");
    expect(r.status).toBe(200);
    expectBaseHeaders(r.headers);
    expectDocumentCsp(r.headers, false);
    expect(r.headers.get("cache-control")).toBe(EDGE_CACHE);
  });

  it("form/account/unsubscribe surfaces are no-store with the document CSP and no robots header", async () => {
    for (const path of ["/report", "/add-your-farm", "/account", "/unsubscribe"]) {
      const r = await get(path);
      expect(r.status, path).toBe(200);
      expectBaseHeaders(r.headers);
      expectDocumentCsp(r.headers, false);
      expect(r.headers.get("cache-control"), path).toBe("no-store");
      expect(r.headers.get("x-robots-tag"), path).toBeNull();
    }
  });

  it("admin HTML carries the stricter CSP, no-store, and the §6.5 noindex header", async () => {
    const r = await get("/admin/sign-in");
    expect(r.status).toBe(200);
    expectBaseHeaders(r.headers);
    expectDocumentCsp(r.headers, true);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("/go keeps v2's wire shape: 302, origin referrer, no-store, noindex-nofollow", async () => {
    const r = await get("/go/1", { follow: false });
    expect(r.status).toBe(302);
    expect(r.headers.get("referrer-policy")).toBe("origin");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(r.headers.get("location")).toContain("utm_source=seed-directory");
    expect(r.headers.get("location")).not.toContain("seedfinder");
  });

  it("generated images carry the tight policy and a cacheable lifetime", async () => {
    const r = await getBytes("/og/site/default");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("relayed API responses keep the backend's bytes and gain the edge noindex", async () => {
    const r = await get("/api/v1/crops?limit=1");
    expect(r.status).toBe(200);
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(() => JSON.parse(r.text)).not.toThrow();
  });

  it("machine files port the live cache lifetimes", async () => {
    const robots = await get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.headers.get("content-type")).toContain("text/plain");
    expect(robots.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    const sitemap = await get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    const llms = await get("/llms.txt");
    expect(llms.status).toBe(200);
    expect(llms.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
  });

  it("/sw.js carries v2's no-cache pair plus Service-Worker-Allowed", async () => {
    const r = await get("/sw.js");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    expect(r.headers.get("service-worker-allowed")).toBe("/");
  });

  it("hashed assets are immutable", async () => {
    const assets = readdirSync(`${APP_ROOT}/dist/client/assets`, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".js"));
    expect(assets.length).toBeGreaterThan(0);
    const r = await get(`/assets/${assets[0]}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("/healthz answers the uptime hook: 200, JSON, no-store, never cached or indexed", async () => {
    const r = await get("/healthz");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.text).toBe('{"ok":true}');
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expectBaseHeaders(r.headers);
  });

  it("gzip: textual responses compress when the client accepts it", async () => {
    const plain = await get("/about");
    expect(plain.status).toBe(200);
    // Undici transparently decodes; prove the wire encoding via raw bytes.
    const raw = await new Promise<Buffer>((resolve, reject) => {
      import("node:http").then(({ request }) => {
        const url = new URL(`${BASE}/about`);
        const req = request(
          { hostname: url.hostname, port: url.port, path: "/about", headers: { "Accept-Encoding": "gzip" } },
          (res) => {
            expect(res.headers["content-encoding"]).toBe("gzip");
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
          },
        );
        req.on("error", reject);
        req.end();
      });
    });
    expect(gunzipSync(raw).toString("utf8")).toBe(plain.text);
  });
});

describe("error surfaces", () => {
  it("unknown paths answer the app's own 404 page with a true 404, no-store", async () => {
    for (const path of ["/no-such-page", "/variety/definitely-not-a-variety", "/crop/not-a-crop"]) {
      const r = await get(path);
      expect(r.status, path).toBe(404);
      expect(r.headers.get("cache-control"), path).toBe("no-store");
      expect(r.text, path).toContain("We couldn’t find that page");
      expect(titleOf(r.text), path).toBe("Page not found | seeds.hues.flowers");
    }
  });

  it("removed sellers answer the app's own 410 page, noindexed, linking to /seller", async () => {
    const r = await get("/seller/shuttered-seed-co");
    expect(r.status).toBe(410);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.text).toContain("This seller has been removed");
    expect(r.text).toContain('href="/seller"');
    expect(titleOf(r.text)).toBe("Seller removed | seeds.hues.flowers");
  });

  it("a dead backend answers the app's own 500 page and the sink receives the redacted report", async () => {
    const before = sinkReceived.length;
    const r = await get("/variety/sweet-pea-kings-ransom", { base: DEAD_BASE });
    expect(r.status).toBe(500);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.text).toContain("This page could not be loaded.");
    expect(r.text).toContain('href="/"');
    await waitForSink(before + 1);
    const delivered = sinkReceived[before]!;
    expect(delivered.body).toContain("/variety/sweet-pea-kings-ransom");
    expect(delivered.body).not.toMatch(/\$\d/);
  });

  it("POST /api/track answers 204 with v2's silence contract (valid or garbage)", async () => {
    for (const body of [
      { type: "view", varietySlug: "sweet-pea-kings-ransom" },
      { seller: "x", variety: "y", href: "https://example.com" },
      { garbage: true },
      "not json at all",
    ]) {
      const r = await postJson("/api/track", body);
      expect(r.status, JSON.stringify(body)).toBe(204);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("x-robots-tag")).toBe("noindex");
    }
    const getTrack = await get("/api/track", { follow: false });
    expect(getTrack.status).toBe(405);
    expect(getTrack.headers.get("allow")).toBe("POST");
  });

  it("POST /api/client-errors relays the redacted report to the sink and answers 204", async () => {
    const before = sinkReceived.length;
    const r = await postJson("/api/client-errors", {
      name: "TypeError",
      message: "boom for willa@example.com, total $4.95",
      url: "/account?code=654321",
    });
    expect(r.status).toBe(204);
    expect(r.headers.get("cache-control")).toBe("no-store");
    await waitForSink(before + 1);
    const delivered = sinkReceived[before]!;
    expect(delivered.body).not.toContain("willa@example.com");
    expect(delivered.body).not.toContain("$4.95");
    expect(delivered.body).not.toContain("654321");
    expect(delivered.body).toContain("/account");
  });
});

describe("Slice 9 mount degradation", () => {
  it("unsubscribe describe unreachable renders the invalid-link state, 200 — never a 500, never a confirm", async () => {
    // Until Slice 9 mounts /api/internal/unsubscribe/describe, any fault
    // (here: the dead backend) reads as no scope — the invalid-link state,
    // by design (§6.2). Any token exercises it: the fault precedes parsing.
    const r = await get("/unsubscribe?token=definitely-not-a-token", { base: DEAD_BASE });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(decodeHtml(r.text)).toContain("This unsubscribe link isn’t valid.");
    expect(r.text).toContain('href="/account"');
  });

  it("admin relay unreachable answers 502 JSON — the backend owns the mount, the app reports it", async () => {
    const r = await get("/api/internal/admin/session", { base: DEAD_BASE, follow: false });
    expect(r.status).toBe(502);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(r.text)).toEqual({ error: "backend unreachable" });
  });
});

describe("robots diff", () => {
  it("serves the renderer output byte-identical", async () => {
    const r = await getBytes("/robots.txt");
    expect(r.status).toBe(200);
    expect(r.body.equals(Buffer.from(renderRobotsTxt(SITE), "utf8"))).toBe(true);
  });

  it("differs from the live recording by exactly the three sanctioned parameter disallows", async () => {
    const live = readFileSync(`${APP_ROOT}/tests/fixtures/robots-live.txt`, "utf8");
    const served = (await get("/robots.txt")).text;
    const sanctioned = ["Disallow: /*?*sort=*", "Disallow: /*?*limit=*", "Disallow: /*?*session=*"];
    let stripped = served;
    for (const line of sanctioned) {
      expect(stripped, `sanctioned line present once: ${line}`).toContain(`${line}\n`);
      stripped = stripped.replace(`${line}\n`, "");
    }
    expect(stripped).toBe(live);
  });
});

const BUDGET_TEMPLATES: { name: string; path: string }[] = [
  { name: "home", path: "/" },
  { name: "variety-browse", path: "/variety" },
  { name: "variety-detail", path: "/variety/sweet-pea-kings-ransom" },
  { name: "variety-zero-seller", path: "/variety/cosmos-lonely-bloom" },
  { name: "seller-index", path: "/seller" },
  { name: "seller-shop", path: "/seller/blue-ridge-seeds" },
  { name: "crop-index", path: "/crop" },
  { name: "crop-hub", path: "/crop/sunflower" },
  { name: "series-hub", path: "/series/sunbeam" },
  { name: "state-hub", path: "/state/oregon" },
  { name: "search", path: "/search?q=sweet+pea" },
  { name: "static", path: "/about" },
  { name: "report", path: "/report" },
  { name: "account", path: "/account" },
  { name: "admin-sign-in", path: "/admin/sign-in" },
];

describe("performance budgets", () => {
  it.each(BUDGET_TEMPLATES.map((t) => [t.name, t.path]))("%s HTML weighs at most 200 KB", async (_name, path) => {
    const r = await get(path as string);
    expect(r.status).toBe(200);
    expect(Buffer.byteLength(r.text, "utf8")).toBeLessThanOrEqual(budget.htmlBytesPerTemplate.threshold);
  });

  it.each(BUDGET_TEMPLATES.map((t) => [t.name, t.path]))("%s ships at most 150 KB gzipped JS", async (_name, path) => {
    const r = await get(path as string);
    expect(r.status).toBe(200);
    let total = 0;
    for (const src of scriptSrcs(r.text)) {
      expect(src, "same-origin script").toMatch(/^\/assets\//);
      const asset = await getBytes(src);
      expect(asset.status, src).toBe(200);
      total += gzipSync(asset.body).length;
    }
    expect(total).toBeLessThanOrEqual(budget.jsGzipBytesPerRoute.threshold);
  });

  it.each(BUDGET_TEMPLATES.map((t) => [t.name, t.path]))("%s images carry alt + dimensions from self-hosted sources", async (_name, path) => {
    const r = await get(path as string);
    expect(r.status).toBe(200);
    for (const img of imgTags(r.text)) {
      expect(img.alt, `alt on ${img.src}`).not.toBeNull();
      expect(img.width, `width on ${img.src}`).not.toBeNull();
      expect(img.height, `height on ${img.src}`).not.toBeNull();
      expect(img.src, `self-hosted ${img.src}`).toMatch(/^(\/|data:|https:\/\/images\.seeds\.hues\.flowers\/)/);
    }
  });

  it("hero images are eager (never lazy) on the home and variety templates", async () => {
    for (const path of ["/", "/variety/sweet-pea-kings-ransom"]) {
      const r = await get(path);
      expect(r.status).toBe(200);
      const imgs = imgTags(r.text);
      expect(imgs.length, `${path} has imagery`).toBeGreaterThan(0);
      expect(imgs[0]!.loading, `${path} hero loading`).not.toBe("lazy");
    }
  });
});

/** The inventory doc's as-built column, parsed: template key → top-level @type set. */
function inventoryAsBuilt(): Map<string, string[]> {
  const doc = readFileSync(fileURLToPath(new URL("../../../structured-data-inventory.md", import.meta.url)), "utf8");
  const map = new Map<string, string[]>();
  for (const line of doc.split("\n")) {
    const m = /^\| ([a-z-]+) \| .* \| (.*) \| (.*) \|$/.exec(line);
    if (m) map.set(m[1]!, m[2]!.split(",").map((s) => s.trim()).filter((s) => s.length > 0 && s !== "none"));
  }
  return map;
}

const INVENTORY_URLS: { template: string; paths: string[] }[] = [
  { template: "home", paths: ["/"] },
  { template: "variety-browse", paths: ["/variety"] },
  { template: "variety-detail", paths: ["/variety/sweet-pea-kings-ransom", "/variety/cosmos-lonely-bloom"] },
  { template: "seller-index", paths: ["/seller"] },
  { template: "seller-shop", paths: ["/seller/blue-ridge-seeds", "/seller/blue-ridge-seeds?page=2"] },
  { template: "crop-index", paths: ["/crop"] },
  { template: "crop-hub", paths: ["/crop/sunflower", "/crop/sunflower?page=2"] },
  { template: "series-hub", paths: ["/series/sunbeam"] },
  { template: "state-hub", paths: ["/state/oregon"] },
  { template: "static-informational", paths: ["/about"] },
];

describe("structured-data inventory vs emitted HTML", () => {
  it.each(INVENTORY_URLS.map((t) => [t.template, t.paths.join(" ")]))("%s emits exactly its inventoried types", async (template) => {
    const asBuilt = inventoryAsBuilt();
    const entry = INVENTORY_URLS.find((t) => t.template === template)!;
    for (const path of entry.paths) {
      const r = await get(path);
      expect(r.status, path).toBe(200);
      // Zero-seller variety pages emit the EMPTY sellers ItemList — Bea
      // §1.1's "empty list / omitted" resolved by live behavior (recorded
      // 2026-11-25: numberOfItems 0), matched exactly by the port.
      expect([...ldTypes(r.text)].sort(), path).toEqual([...asBuilt.get(entry.template)!].sort());
    }
  });
});

const A11Y_TEMPLATES: { name: string; path: string; status: number; dead?: boolean }[] = [
  ...BUDGET_TEMPLATES.map((t) => ({ name: t.name, path: t.path, status: 200 })),
  // The static-informational class beyond the /about representative.
  { name: "static-about-data", path: "/about/data", status: 200 },
  { name: "static-about-bot", path: "/about/bot", status: 200 },
  { name: "static-api-docs", path: "/api-docs", status: 200 },
  { name: "static-privacy", path: "/privacy", status: 200 },
  { name: "static-terms", path: "/terms", status: 200 },
  { name: "static-add-farm", path: "/add-your-farm", status: 200 },
  { name: "static-unsubscribe", path: "/unsubscribe", status: 200 },
  { name: "static-offline", path: "/offline", status: 200 },
  // The error surfaces (the 500 serves from the dead-backend server).
  { name: "not-found", path: "/no-such-page", status: 404 },
  { name: "seller-removed", path: "/seller/shuttered-seed-co", status: 410 },
  { name: "server-error", path: "/variety/sweet-pea-kings-ransom", status: 500, dead: true },
];

/** Structural HTML without scripts (hydration payloads carry HTML-ish strings). */
const contentHtml = (html: string): string => html.replace(/<script[\s\S]*?<\/script>/g, "");

/** Heading levels in document order. */
const headingLevels = (html: string): number[] =>
  [...contentHtml(html).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));

describe("per-template static accessibility audit", () => {
  // One fetch per template; the five properties assert off the cached bytes.
  // This describe runs before the day-0 rehearsal block, whose final test
  // mutates the stub — every page here renders from unmutated state.
  const pages = new Map<string, string>();
  beforeAll(async () => {
    for (const t of A11Y_TEMPLATES) {
      const r = await get(t.path, t.dead ? { base: DEAD_BASE } : {});
      expect(r.status, `${t.name} ${t.path}`).toBe(t.status);
      pages.set(t.name, r.text);
    }
  }, 60_000);

  const names = A11Y_TEMPLATES.map((t) => [t.name]);

  it.each(names)("%s renders one main landmark with the banner, footer, nav, and skip link", (name) => {
    const body = contentHtml(pages.get(name as string)!);
    expect(body.match(/<main[\s>]/g) ?? [], `${name}: one main`).toHaveLength(1);
    // The banner + footer live outside <main> (detail templates nest an
    // article <header> inside main — valid, not a second banner).
    const outsideMain = body.replace(/<main[\s\S]*?<\/main>/, "");
    expect(outsideMain.match(/<header[\s>]/g) ?? [], `${name}: one banner`).toHaveLength(1);
    expect(outsideMain.match(/<footer[\s>]/g) ?? [], `${name}: one footer`).toHaveLength(1);
    expect(body, `${name}: navigation landmark`).toContain("<nav");
    expect(body, `${name}: skip link`).toContain('href="#main"');
    expect(body, `${name}: skip target`).toMatch(/<main[^>]*\sid="main"/);
  });

  it.each(names)("%s headings start at h1 exactly once with no skipped levels", (name) => {
    const levels = headingLevels(pages.get(name as string)!);
    expect(
      levels.filter((l) => l === 1),
      `${name}: one h1 (${levels.join(",")})`,
    ).toHaveLength(1);
    expect(levels[0], `${name}: first heading is h1`).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i], `${name}: no skipped level (${levels.join(",")})`).toBeLessThanOrEqual(levels[i - 1]! + 1);
    }
  });

  it.each(names)("%s form controls are all labeled", (name) => {
    const body = contentHtml(pages.get(name as string)!);
    const labelsFor = new Set([...body.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
    for (const m of body.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
      const tag = m[1]!;
      const attrs = m[2]!;
      const type = /type="([^"]*)"/.exec(attrs)?.[1] ?? "";
      if (tag === "input" && (type === "hidden" || type === "submit" || type === "button" || type === "reset")) continue;
      if (tag === "input" && type === "image") {
        expect(attrs, `${name}: image button alt`).toMatch(/alt="[^"]+"/);
        continue;
      }
      const id = /id="([^"]*)"/.exec(attrs)?.[1];
      const wrapped = body.lastIndexOf("<label", m.index ?? 0) > body.lastIndexOf("</label>", m.index ?? 0);
      const labeled =
        /aria-label="[^"]+"/.test(attrs) ||
        /aria-labelledby="[^"]+"/.test(attrs) ||
        (id != null && id !== "" && labelsFor.has(id)) ||
        wrapped;
      expect(labeled, `${name}: labeled control <${tag} ${attrs.slice(0, 80)}>`).toBe(true);
    }
  });

  it.each(names)("%s names every link and button, hides no focusable, and resolves every aria ref", (name) => {
    const body = contentHtml(pages.get(name as string)!);
    for (const m of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const text = decodeHtml(m[2]!.replace(/<[^>]*>/g, "")).trim();
      const named = /aria-label="[^"]+"/.test(m[1]!) || /aria-labelledby="[^"]+"/.test(m[1]!) || text !== "";
      expect(named, `${name}: named button`).toBe(true);
    }
    for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      if (!/href=/.test(m[1]!)) continue; // An anchor without href is not a link.
      const text = decodeHtml(m[2]!.replace(/<[^>]*>/g, "")).trim();
      const named = /aria-label="[^"]+"/.test(m[1]!) || /aria-labelledby="[^"]+"/.test(m[1]!) || text !== "";
      expect(named, `${name}: named link`).toBe(true);
    }
    for (const m of body.matchAll(/<(a|button|input|select|textarea)\b([^>]*)>/g)) {
      expect(m[2], `${name}: no aria-hidden focusable <${m[1]}>`).not.toContain('aria-hidden="true"');
    }
    const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of body.matchAll(/aria-(?:labelledby|describedby|controls|owns)="([^"]+)"/g)) {
      for (const ref of m[1]!.split(/\s+/)) {
        expect(ids.has(ref), `${name}: aria ref resolves #${ref}`).toBe(true);
      }
    }
  });

  it.each(names)("%s carries no positive tabindex", (name) => {
    expect(contentHtml(pages.get(name as string)!), `${name}: tab order is source order`).not.toMatch(
      /tabindex="[1-9][0-9]*"/,
    );
  });

  it("the shipped shell CSS styles :focus-visible", async () => {
    const home = pages.get("home")!;
    const hrefs = [
      ...new Set([...home.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]!)),
    ];
    expect(hrefs.length, "stylesheets linked").toBeGreaterThan(0);
    let styled = false;
    for (const href of hrefs) {
      expect(href, "same-origin stylesheet").toMatch(/^\/assets\//);
      const css = await getBytes(href);
      expect(css.status, href).toBe(200);
      if (css.body.toString("utf8").includes(":focus-visible")) styled = true;
    }
    expect(styled, ":focus-visible rule shipped").toBe(true);
  });
});

describe("day-0 rehearsal (automatable subset)", () => {
  it("the sitemap index lists the seven Bea §8.2 segments", async () => {
    const r = await get("/sitemap.xml");
    expect(r.status).toBe(200);
    for (const file of [
      "sitemap-varieties-listed.xml",
      "sitemap-varieties-zero-seller.xml",
      "sitemap-sellers.xml",
      "sitemap-crops.xml",
      "sitemap-series.xml",
      "sitemap-states.xml",
      "sitemap-hubs.xml",
    ]) {
      expect(r.text, file).toContain(`${SITE}/${file}`);
      const segment = await get(`/${file}`);
      expect(segment.status, file).toBe(200);
      expect(segment.text, file).toContain("<urlset");
    }
  });

  it("no sitemap lists a paginated, filtered, or noindex URL", async () => {
    const index = await get("/sitemap.xml");
    const files = [...index.text.matchAll(new RegExp(`${SITE.replace(/\./g, "\\.")}/(sitemap-[a-z-]+\\.xml)`, "g"))].map(
      (m) => m[1]!,
    );
    expect(files).toHaveLength(7);
    for (const file of files) {
      const segment = await get(`/${file}`);
      expect(segment.text, `${file}: no ?page=`).not.toContain("?page=");
      expect(segment.text, `${file}: no query strings`).not.toMatch(/<loc>[^<]*\?/);
      for (const banned of ["/search", "/report", "/account", "/unsubscribe", "/offline", "/go/", "/og/", "/api/", "/admin"]) {
        expect(segment.text, `${file} must not list ${banned}`).not.toContain(`<loc>${SITE}${banned}`);
      }
    }
  });

  it("sitemap lastmod values are real dates, never build stamps", async () => {
    // NOTE (Slice 8 repair): on stub builds this loop is vacuous — 0 dates
    // emit because no synthetic stub updated_seq matches the live-derived
    // committed cache (seq-verified omission, the designed conservative
    // behavior — see the day-0 rehearsal record). The positive rule (a
    // verified seq emits its real date; stale/removed rows omit) is proven
    // non-vacuously at unit level (sitemap-rules + machine-files suites,
    // aligned fixtures). This test still guards the built artifact against
    // malformed or future lastmod whenever any date does emit.
    const listed = await get("/sitemap-varieties-listed.xml");
    const dates = [...listed.text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]!);
    for (const date of dates) {
      expect(date, "ISO date").toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(new Date(date).getTime(), `not in the future: ${date}`).toBeLessThanOrEqual(Date.now());
    }
  });

  it("legacy + port-requirement redirect rows answer a single 301 to the final canonical", async () => {
    const rows: [string, string][] = [
      ["/varieties", "/variety"],
      ["/varieties/sweet-pea-kings-ransom", "/variety/sweet-pea-kings-ransom"],
      ["/sellers", "/seller"],
      ["/sellers/blue-ridge-seeds", "/seller/blue-ridge-seeds"],
      ["/plants", "/crop"],
      ["/plants/sunflower", "/crop/sunflower"],
      ["/categories", "/crop"],
      ["/categories/sunflower", "/crop"],
      ["/variety?v=sweet-pea-kings-ransom", "/variety/sweet-pea-kings-ransom"],
      ["/seller?s=blue-ridge-seeds", "/seller/blue-ridge-seeds"],
      ["/variety/sweet-pea-kings-ransom/small-farms", "/variety/sweet-pea-kings-ransom?small_farm=true"],
      ["/variety?page=1", "/variety"],
      ["/seller?page=1", "/seller"],
      ["/seller/blue-ridge-seeds?page=1", "/seller/blue-ridge-seeds"],
      ["/crop/sunflower?page=1", "/crop/sunflower"],
      ["/state/oregon?page=1", "/state/oregon"],
      ["/crop/", "/crop"],
      ["/variety/sweet-pea-kings-ransom/", "/variety/sweet-pea-kings-ransom"],
    ];
    for (const [from, to] of rows) {
      const r = await get(from, { follow: false });
      expect(r.status, from).toBe(301);
      expect(r.headers.get("location"), from).toBe(to);
      const landed = await get(r.headers.get("location")!, { follow: false });
      expect(landed.status, `${from} lands without a second hop`).toBe(200);
    }
  });

  it("wrong-case paths 404 (live behavior — never a 200 duplicate)", async () => {
    const r = await get("/Variety", { follow: false });
    expect(r.status).toBe(404);
  });

  it("merged varieties redirect one hop to the survivor, preserving ?small_farm=true", async () => {
    const slug = Object.keys(stub.state.merged)[0]!;
    const target = stub.state.merged[slug]!;
    const r = await get(`/variety/${slug}`, { follow: false });
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe(`/variety/${target}`);
    const variant = await get(`/variety/${slug}?small_farm=true`, { follow: false });
    expect(variant.status).toBe(301);
    expect(variant.headers.get("location")).toBe(`/variety/${target}?small_farm=true`);
  });

  it("freshness, LAST: a listing write fans out through revalidate to every affected page", async () => {
    // Warm both templates, mutate the shared listing row behind them,
    // confirm stale, revalidate the seller tag, re-fetch without
    // cache-busting: both pages serve the new state and date.
    const shopBefore = await get("/seller/prairie-seed-house");
    expect(shopBefore.status).toBe(200);
    const varietyBefore = await get("/variety/sweet-pea-kings-ransom");
    expect(varietyBefore.status).toBe(200);
    const listing = stub.state.details["sweet-pea-kings-ransom"]!.listings.find((l) => l.seller.slug === "prairie-seed-house")!;
    listing.availability = "sold_out";
    listing.lastCheckedAt = "2026-11-24T08:00:00.000Z";
    const stale = await get("/seller/prairie-seed-house");
    expect(stale.text).toBe(shopBefore.text);
    const purge = await fetch(`${BASE}/internal/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ tags: ["seller:prairie-seed-house"] }),
    });
    expect(purge.status).toBe(200);
    const shopAfter = await get("/seller/prairie-seed-house");
    expect(shopAfter.text).toContain("Sold out");
    const varietyAfter = await get("/variety/sweet-pea-kings-ransom");
    expect(varietyAfter.text).toContain("Sold out");
  });
});
