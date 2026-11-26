/**
 * Preview Worker routing table: drives handleWorkerRequest directly (the
 * web-standard fetch handler in server/worker-handler.ts; server/worker.ts
 * is the thin default-only entry workerd loads) with stubbed bindings
 * (ASSETS, D1, Vike render, OG render) and the hermetic catalog stub as
 * the backend origin — every serve.ts route class has its Worker
 * counterpart, and the SEEDS_PREVIEW shield holds over all of them.
 *
 * Each case builds fresh deps (own data cache + edge map), so cases stay
 * isolated; the stub backend is shared read-only except where a case
 * asserts a write arrived (relayed POSTs, floor POSTs, /go clicks).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCatalogApi, type CatalogApi } from "../../src/data/api";
import { createDataCache, type DataCache } from "../../src/data/cache";
import type { EdgeEntry } from "../../src/server/edge-cache";
import type { VarietyStatusDb } from "../../src/server/variety-status";
import {
  handleWorkerRequest,
  normalizeApiBase,
  type WorkerAssetsBinding,
  type WorkerDeps,
  type WorkerOgRenderer,
  type WorkerVikeArgs,
  type WorkerVikeRenderer,
  type WorkerVikeResult,
} from "../../server/worker-handler";
import { startStubApi, type StubApi } from "../stub/api-server";
import { fakeCatalogState } from "./fake-catalog";

const SITE = "https://preview.test";
const SECRET = "worker-revalidate-secret";

const req = (path: string, init?: RequestInit): Request => new Request(`${SITE}${path}`, init);

const textOf = async (res: Response): Promise<string> => await res.text();
const jsonOf = async (res: Response): Promise<unknown> => JSON.parse(await res.text()) as unknown;

interface AssetFile {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const stubAssets = (files: Record<string, AssetFile> = {}): WorkerAssetsBinding => ({
  fetch: async (input: Request): Promise<Response> => {
    const file = files[new URL(input.url).pathname];
    if (!file) return new Response("asset not found", { status: 404 });
    return new Response(file.body, { status: file.status, headers: file.headers });
  },
});

type VarietyRow = { status: string; merged_into_id: number | null; deleted_at: string | null };

const stubDb = (rows: Record<string, VarietyRow> = {}, targets: Record<number, string> = {}): VarietyStatusDb => ({
  prepare(query: string) {
    return {
      bind(...values: Array<string | number | null>) {
        return {
          first: async <R extends Record<string, unknown>>(): Promise<R | null> => {
            if (query.includes("slug =")) {
              const found = rows[String(values[0])];
              return (found ? ({ ...found }) : null) as unknown as R | null;
            }
            const slug = targets[Number(values[0])];
            return (slug ? ({ slug }) : null) as unknown as R | null;
          },
        };
      },
    };
  },
});

interface VikeStub {
  calls: WorkerVikeArgs[];
  renderVike: WorkerVikeRenderer;
}

const stubVike = (impl?: (args: WorkerVikeArgs) => WorkerVikeResult): VikeStub => {
  const calls: WorkerVikeArgs[] = [];
  const renderVike: WorkerVikeRenderer = async (args: WorkerVikeArgs): Promise<WorkerVikeResult> => {
    calls.push(args);
    return (
      impl?.(args) ?? {
        statusCode: 200,
        headers: [["content-type", "text/html; charset=utf-8"]],
        body: `<!doctype html><html><body>stub page for ${args.urlOriginal}</body></html>`,
      }
    );
  };
  return { calls, renderVike };
};

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const stubOg: WorkerOgRenderer = async () => ({
  status: 200,
  headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  body: PNG_BYTES,
});

let stub!: StubApi;
let api!: CatalogApi;
let apiBase = "";

const testDeps = (overrides: Partial<WorkerDeps> = {}): { deps: WorkerDeps; vike: VikeStub; cache: DataCache; edge: Map<string, EdgeEntry> } => {
  const vike = stubVike();
  const cache = createDataCache();
  const edge = new Map<string, EdgeEntry>();
  return {
    deps: {
      assets: stubAssets(),
      db: stubDb(),
      apiBase,
      revalidateSecret: SECRET,
      errorSinkUrl: "",
      siteKey: "test-site-key",
      preview: false,
      api,
      cache,
      edge,
      renderVike: vike.renderVike,
      renderOg: stubOg,
      ...overrides,
    },
    vike,
    cache,
    edge,
  };
};

/** A capturing error-sink server (the client-errors + 5xx delivery proof). */
async function startSink(): Promise<{ url: string; received: unknown[]; close: () => Promise<void> }> {
  const received: unknown[] = [];
  const server: Server = createServer((reqMsg: IncomingMessage, resMsg: ServerResponse) => {
    const chunks: Buffer[] = [];
    reqMsg.on("data", (chunk: Buffer) => chunks.push(chunk));
    reqMsg.on("end", () => {
      try {
        received.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        received.push(null);
      }
      resMsg.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sink: could not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    received,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

beforeAll(async () => {
  stub = await startStubApi(fakeCatalogState());
  apiBase = `${stub.url}/api/v1`;
  api = createCatalogApi({ baseUrl: apiBase });
}, 30_000);

afterAll(async () => {
  await stub.close();
});

describe("normalizeApiBase", () => {
  it("defaults to the live API and trims trailing slashes", () => {
    expect(normalizeApiBase(undefined)).toBe("https://seeds.hues.flowers/api/v1");
    expect(normalizeApiBase("")).toBe("https://seeds.hues.flowers/api/v1");
    expect(normalizeApiBase("https://example.test/api/v1///")).toBe("https://example.test/api/v1");
  });
});

describe("POST /internal/revalidate", () => {
  it("purges the data cache and the edge map for the tag's paths", async () => {
    const { deps, cache, edge } = testDeps();
    await cache.get("probe", async () => ({ value: 1, paths: ["/variety/sweet-pea-kings-ransom"] }));
    const entry: EdgeEntry = { status: 200, headers: [["content-type", "text/html"]], body: "stale" };
    edge.set("/variety/sweet-pea-kings-ransom", entry);
    edge.set("/variety/sweet-pea-kings-ransom?small_farm=true", entry);
    edge.set("/seller/blue-ridge-seeds", entry);
    const res = await handleWorkerRequest(
      req("/internal/revalidate", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ tags: ["variety:sweet-pea-kings-ransom"] }),
      }),
      deps,
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { revalidated: boolean; paths: string[] };
    expect(body.revalidated).toBe(true);
    expect(body.paths).toContain("/variety/sweet-pea-kings-ransom");
    expect(cache.peek("probe")).toBeNull();
    expect(edge.has("/variety/sweet-pea-kings-ransom")).toBe(false);
    expect(edge.has("/variety/sweet-pea-kings-ransom?small_farm=true")).toBe(false);
    // An unrelated page's entry survives.
    expect(edge.has("/seller/blue-ridge-seeds")).toBe(true);
  });

  it("refuses a bad secret (401), a bad tag (400), and answers not-configured without a secret (500)", async () => {
    const { deps } = testDeps();
    const badSecret = await handleWorkerRequest(
      req("/internal/revalidate", {
        method: "POST",
        headers: { authorization: "Bearer wrong", "content-type": "application/json" },
        body: JSON.stringify({ tags: ["variety:x"] }),
      }),
      deps,
    );
    expect(badSecret.status).toBe(401);
    const badTag = await handleWorkerRequest(
      req("/internal/revalidate", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ tags: ["nope"] }),
      }),
      deps,
    );
    expect(badTag.status).toBe(400);
    const unconfigured = await handleWorkerRequest(
      req("/internal/revalidate", {
        method: "POST",
        headers: { authorization: "Bearer x", "content-type": "application/json" },
        body: JSON.stringify({ tags: ["variety:x"] }),
      }),
      { ...deps, revalidateSecret: "" },
    );
    expect(unconfigured.status).toBe(500);
    expect(await jsonOf(unconfigured)).toEqual({ error: "revalidate not configured: set SEEDS_REVALIDATE_SECRET" });
  });
});

describe("the SSR floor POSTs", () => {
  it("POST /report forwards the JSON payload and re-renders with the outcome", async () => {
    const { deps, vike } = testDeps();
    const before = stub.state.forms.received.filter((e) => e.endpoint === "reports").length;
    const res = await handleWorkerRequest(
      req("/report", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          type: "claim",
          target_type: "seller",
          target_ref: "Blue-Ridge-Seeds",
          message: "I run this farm and want to manage its listing, please.",
          contact: "Willa@Example.com",
          turnstile_token: "test-token",
        }).toString(),
      }),
      deps,
    );
    expect(res.status).toBe(200);
    const bodies = stub.state.forms.received.filter((e) => e.endpoint === "reports");
    expect(bodies.length).toBe(before + 1);
    expect(bodies[bodies.length - 1]!.body).toEqual({
      type: "claim",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "I run this farm and want to manage its listing, please.",
      contact: "Willa@Example.com",
      turnstile_token: "test-token",
    });
    expect(vike.calls).toHaveLength(1);
    expect(vike.calls[0]!.urlOriginal).toBe("/report");
    expect(vike.calls[0]!.formOutcome).toBeDefined();
  });

  it("POST /add-your-farm forwards and re-renders the same way", async () => {
    const { deps, vike } = testDeps();
    const before = stub.state.forms.received.filter((e) => e.endpoint === "farm").length;
    const res = await handleWorkerRequest(
      req("/add-your-farm", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ farm_name: "Blue Ridge Seeds", website: "https://example.test", turnstile_token: "test-token" }).toString(),
      }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(stub.state.forms.received.filter((e) => e.endpoint === "farm").length).toBe(before + 1);
    expect(vike.calls).toHaveLength(1);
    expect(vike.calls[0]!.urlOriginal).toBe("/add-your-farm");
    expect(vike.calls[0]!.formOutcome).toBeDefined();
  });
});

describe("GET /go/[id]", () => {
  it("relays numeric ids with the m-3 utm_source rename, always no-store", async () => {
    const { deps } = testDeps();
    const res = await handleWorkerRequest(req("/go/1"), deps);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://shop.example.com/blue-ridge/kings-ransom?utm_source=seed-directory&utm_medium=referral");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("referrer-policy")).toBe("origin");
    expect(stub.state.forms.clicks.some((c) => c.listingId === 1)).toBe(true);
  });

  it("keeps the listing's own query and never renames a seller utm_source", async () => {
    const { deps } = testDeps();
    const withQuery = await handleWorkerRequest(req("/go/3"), deps);
    expect(withQuery.headers.get("location")).toContain("color=red");
    expect(withQuery.headers.get("location")).toContain("utm_source=seed-directory");
    const ownUtm = await handleWorkerRequest(req("/go/4"), deps);
    expect(ownUtm.headers.get("location")).toContain("utm_source=newsletter");
  });

  it("404s non-numeric ids without a backend call; 404/410 pass through", async () => {
    const { deps } = testDeps();
    const clicksBefore = stub.state.forms.clicks.length;
    const bad = await handleWorkerRequest(req("/go/abc"), deps);
    expect(bad.status).toBe(404);
    expect(await textOf(bad)).toBe("Listing not found");
    expect(stub.state.forms.clicks.length).toBe(clicksBefore);
    expect((await handleWorkerRequest(req("/go/2"), deps)).status).toBe(404);
    expect((await handleWorkerRequest(req("/go/999"), deps)).status).toBe(404);
    const gone = await handleWorkerRequest(req("/go/5"), deps);
    expect(gone.status).toBe(410);
    expect(gone.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("the admin POST actions", () => {
  it("refuses a cross-origin POST without touching the service", async () => {
    const { deps } = testDeps();
    const before = stub.state.admin.received.length;
    const res = await handleWorkerRequest(
      req("/admin/sign-in/request", {
        method: "POST",
        headers: { origin: "https://evil.test", "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      }),
      deps,
    );
    expect(res.status).toBe(403);
    expect(stub.state.admin.received.length).toBe(before);
  });

  it("serves the SPA's JSON vocabulary and the native 303 floor", async () => {
    const { deps } = testDeps();
    const json = await handleWorkerRequest(
      req("/admin/sign-in/request", {
        method: "POST",
        headers: { origin: SITE, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      }),
      deps,
    );
    expect(json.status).toBe(200);
    expect(json.headers.get("content-type")).toContain("application/json");
    expect(json.headers.get("cache-control")).toBe("no-store");
    const jsonBody = (await jsonOf(json)) as { ok: boolean; redirect: string };
    expect(jsonBody.ok).toBe(true);
    expect(jsonBody.redirect.startsWith("/admin/sign-in/code?")).toBe(true);
    const native = await handleWorkerRequest(
      req("/admin/sign-in/request", {
        method: "POST",
        headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "nobody@example.com" }).toString(),
      }),
      deps,
    );
    expect(native.status).toBe(303);
    expect(native.headers.get("location")).toContain("/admin/sign-in/code?");
  });
});

describe("the admin GET gate", () => {
  it("refuses signed-out sessions with the 303 sign-in round trip", async () => {
    const { deps, vike } = testDeps();
    const res = await handleWorkerRequest(req("/admin"), deps);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/sign-in?next=%2Fadmin");
    expect(vike.calls).toHaveLength(0);
  });

  it("shows the sign-in surface to signed-out visitors", async () => {
    const { deps, vike } = testDeps();
    const res = await handleWorkerRequest(req("/admin/sign-in"), deps);
    expect(res.status).toBe(200);
    expect(vike.calls).toHaveLength(1);
  });

  it("leaves the action paths ungated (they answer POSTs, never pages)", async () => {
    const { deps, vike } = testDeps();
    const res = await handleWorkerRequest(req("/admin/review/decide"), deps);
    expect(res.status).toBe(200);
    expect(vike.calls).toHaveLength(1);
  });
});

describe("GET /api/internal/variety-status/[slug]", () => {
  it("mounts the D1 lookup with the app contract + API headers", async () => {
    const { deps } = testDeps({
      db: stubDb({ "sweet-pea-kings-ransom": { status: "active", merged_into_id: null, deleted_at: null } }),
    });
    const res = await handleWorkerRequest(req("/api/internal/variety-status/sweet-pea-kings-ransom"), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(await jsonOf(res)).toEqual({ status: "active", merged_into: null });
    const unknown = await handleWorkerRequest(req("/api/internal/variety-status/no-such-slug"), deps);
    expect(unknown.status).toBe(200);
    expect(await jsonOf(unknown)).toEqual({ status: "unknown", merged_into: null });
  });
});

describe("the backend relays", () => {
  it("proxies /api/v1 reads and writes verbatim", async () => {
    const { deps } = testDeps();
    const direct = await fetch(`${stub.url}/api/v1/crops?limit=1`);
    const relayed = await handleWorkerRequest(req("/api/v1/crops?limit=1"), deps);
    expect(relayed.status).toBe(direct.status);
    expect(await textOf(relayed)).toBe(await direct.text());
    const before = stub.state.forms.received.filter((e) => e.endpoint === "reports").length;
    const write = await handleWorkerRequest(
      req("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "correct", turnstile_token: "tok" }),
      }),
      deps,
    );
    expect(write.status).toBe(201);
    expect(stub.state.forms.received.filter((e) => e.endpoint === "reports").length).toBe(before + 1);
  });

  it("proxies the admin service reads verbatim", async () => {
    const { deps } = testDeps();
    const direct = await fetch(`${stub.url}/api/internal/admin/me`);
    const relayed = await handleWorkerRequest(req("/api/internal/admin/me"), deps);
    expect(relayed.status).toBe(direct.status);
    expect(await textOf(relayed)).toBe(await direct.text());
  });

  it("502s loudly when the backend is unreachable", async () => {
    const downBase = "http://127.0.0.1:9/api/v1";
    const { deps } = testDeps({ apiBase: downBase, api: createCatalogApi({ baseUrl: downBase }) });
    const res = await handleWorkerRequest(req("/api/v1/crops"), deps);
    expect(res.status).toBe(502);
    expect(await jsonOf(res)).toEqual({ error: "backend unreachable" });
  });
});

describe("/healthz, /api/track, /api/client-errors", () => {
  it("answers the uptime hook", async () => {
    const { deps } = testDeps();
    const res = await handleWorkerRequest(req("/healthz"), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await textOf(res)).toBe('{"ok":true}');
    const head = await handleWorkerRequest(req("/healthz", { method: "HEAD" }), deps);
    expect(head.status).toBe(200);
    expect(await textOf(head)).toBe("");
  });

  it("beacons /api/track as an unfailable 204, POST only", async () => {
    const { deps } = testDeps();
    expect((await handleWorkerRequest(req("/api/track", { method: "POST", body: "{}" }), deps)).status).toBe(204);
    expect((await handleWorkerRequest(req("/api/track", { method: "POST", body: "not json" }), deps)).status).toBe(204);
    expect((await handleWorkerRequest(req("/api/track", { method: "POST", body: "x".repeat(5000) }), deps)).status).toBe(204);
    const get = await handleWorkerRequest(req("/api/track"), deps);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
  });

  it("relays client errors redacted, always a 204, POST only", async () => {
    const sink = await startSink();
    try {
      const { deps } = testDeps({ errorSinkUrl: sink.url });
      const res = await handleWorkerRequest(
        req("/api/client-errors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Error", message: "broke for willa@example.com", url: "/variety/x?token=abc" }),
        }),
        deps,
      );
      expect(res.status).toBe(204);
      expect(sink.received).toHaveLength(1);
      const report = sink.received[0] as { message: string; url: string };
      expect(report.message).toContain("[email]");
      expect(report.message).not.toContain("willa@example.com");
      expect(report.url).toBe("/variety/x");
      const oversize = await handleWorkerRequest(req("/api/client-errors", { method: "POST", body: "x".repeat(9000) }), deps);
      expect(oversize.status).toBe(204);
      expect(sink.received).toHaveLength(1);
      const get = await handleWorkerRequest(req("/api/client-errors"), deps);
      expect(get.status).toBe(405);
      expect(get.headers.get("allow")).toBe("POST");
    } finally {
      await sink.close();
    }
  });

  it("204s without a sink configured", async () => {
    const { deps } = testDeps();
    expect((await handleWorkerRequest(req("/api/client-errors", { method: "POST", body: "{}" }), deps)).status).toBe(204);
  });
});

describe("/og/[kind]/[slug]", () => {
  it("serves the rendered card, or 404 without one", async () => {
    const { deps } = testDeps();
    const res = await handleWorkerRequest(req("/og/site/default"), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
    const missing = testDeps({ renderOg: async () => ({ status: 404, headers: {}, body: null }) });
    const notFound = await handleWorkerRequest(req("/og/variety/no-such-slug"), missing.deps);
    expect(notFound.status).toBe(404);
  });
});

describe("static assets", () => {
  it("serves ASSETS files with the edge set merged under their own headers", async () => {
    const { deps } = testDeps({
      assets: stubAssets({
        "/manifest.webmanifest": { status: 200, headers: { "Content-Type": "application/manifest+json" }, body: '{"name":"x"}' },
        "/robots.txt": { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "custom" }, body: "robots" },
      }),
    });
    const manifest = await handleWorkerRequest(req("/manifest.webmanifest"), deps);
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("content-type")).toBe("application/manifest+json");
    // The static-asset default applies when the asset sets no lifetime...
    expect(manifest.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
    expect(await textOf(manifest)).toBe('{"name":"x"}');
    // ...and the asset's own headers survive over the edge set.
    const robots = await handleWorkerRequest(req("/robots.txt"), deps);
    expect(robots.headers.get("cache-control")).toBe("custom");
  });

  it("falls through to the renderer when the asset is missing, and for non-GET/HEAD", async () => {
    const { deps, vike } = testDeps();
    expect((await handleWorkerRequest(req("/about"), deps)).status).toBe(200);
    expect(vike.calls).toHaveLength(1);
    expect((await handleWorkerRequest(req("/manifest.webmanifest", { method: "POST" }), deps)).status).toBe(200);
    expect(vike.calls).toHaveLength(2);
  });
});

describe("the edge mock + Vike catch-all", () => {
  it("caches variety 200s per variant and bypasses floor states", async () => {
    const vike = stubVike((args) => ({
      statusCode: 200,
      headers: [["content-type", "text/html; charset=utf-8"]],
      body: `page:${args.urlOriginal}`,
    }));
    const { deps } = testDeps({ renderVike: vike.renderVike });
    expect(await textOf(await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom"), deps))).toBe("page:/variety/sweet-pea-kings-ransom");
    expect(await textOf(await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom"), deps))).toBe("page:/variety/sweet-pea-kings-ransom");
    expect(vike.calls).toHaveLength(1);
    // The small-farms variant keys separately from the clean page...
    expect(await textOf(await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom?small_farm=true"), deps))).toBe(
      "page:/variety/sweet-pea-kings-ransom?small_farm=true",
    );
    expect(vike.calls).toHaveLength(2);
    // ...while other query strings render identically without their own entries.
    expect(await textOf(await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom?utm_source=x"), deps))).toBe("page:/variety/sweet-pea-kings-ransom");
    expect(vike.calls).toHaveLength(2);
    // Floor states bypass entirely: never stored, never served.
    await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom?waitlist=join"), deps);
    await handleWorkerRequest(req("/variety/sweet-pea-kings-ransom?waitlist=join"), deps);
    expect(vike.calls).toHaveLength(4);
  });

  it("keys every filtered shop/hub view separately and stores 200s only", async () => {
    const vike = stubVike((args) => ({
      statusCode: args.urlOriginal === "/seller/gone" ? 404 : 200,
      headers: [["content-type", "text/html; charset=utf-8"]],
      body: `page:${args.urlOriginal}`,
    }));
    const { deps } = testDeps({ renderVike: vike.renderVike });
    await handleWorkerRequest(req("/seller/blue-ridge-seeds"), deps);
    await handleWorkerRequest(req("/seller/blue-ridge-seeds"), deps);
    await handleWorkerRequest(req("/seller/blue-ridge-seeds?page=2"), deps);
    await handleWorkerRequest(req("/seller/blue-ridge-seeds?page=2"), deps);
    expect(vike.calls).toHaveLength(2);
    await handleWorkerRequest(req("/seller/gone"), deps);
    await handleWorkerRequest(req("/seller/gone"), deps);
    expect(vike.calls).toHaveLength(4);
    // The browse indexes stay uncached.
    await handleWorkerRequest(req("/seller"), deps);
    await handleWorkerRequest(req("/seller"), deps);
    expect(vike.calls).toHaveLength(6);
  });

  it("never serves or stores client-navigation data (.pageContext.json) from the edge mock", async () => {
    // Quinn F2's sequence: the unfiltered browse data warms first (the
    // tab-bar navigation to /variety), then the filtered tap must get its
    // own data — the variety detail key ignores every query but
    // ?small_farm=true, so a stored JSON entry would answer every later
    // filter with the first fetch's data.
    const vike = stubVike((args) => ({
      statusCode: 200,
      headers: [["content-type", "application/json; charset=utf-8"]],
      body: `json:${args.urlOriginal}`,
    }));
    const { deps, edge } = testDeps({ renderVike: vike.renderVike });
    expect(await textOf(await handleWorkerRequest(req("/variety/index.pageContext.json"), deps))).toBe("json:/variety/index.pageContext.json");
    expect(await textOf(await handleWorkerRequest(req("/variety/index.pageContext.json?color_family=white"), deps))).toBe(
      "json:/variety/index.pageContext.json?color_family=white",
    );
    expect(await textOf(await handleWorkerRequest(req("/variety/index.pageContext.json"), deps))).toBe("json:/variety/index.pageContext.json");
    expect(vike.calls).toHaveLength(3);
    expect(edge.size).toBe(0);
  });

  it("passes the isolate's shared client + cache + request context per render", async () => {
    const { deps, vike, cache } = testDeps();
    const res = await handleWorkerRequest(req("/about?x=1", { headers: { cookie: "sf_session=tok" } }), deps);
    expect(res.status).toBe(200);
    expect(vike.calls).toHaveLength(1);
    const args = vike.calls[0]!;
    expect(args.urlOriginal).toBe("/about?x=1");
    expect(args.catalogApi).toBe(api);
    expect(args.dataCache).toBe(cache);
    expect(args.formOutcome).toBeUndefined();
    expect(args.turnstileSiteKey).toBe("test-site-key");
    expect(args.adminApiBase).toBe(stub.url);
    expect(args.requestCookie).toBe("sf_session=tok");
    // Vike's own headers survive over the edge defaults.
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("scrubs the admin HTML false positives on admin pages only", async () => {
    const vike = stubVike(() => ({ statusCode: 200, headers: [["content-type", "text/html; charset=utf-8"]], body: "<p>Review review Product</p>" }));
    const { deps } = testDeps({ renderVike: vike.renderVike });
    // Sign in for real through the stub service, then pass the gate.
    await handleWorkerRequest(
      req("/admin/sign-in/request", {
        method: "POST",
        headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "dustin@hues.flowers" }).toString(),
      }),
      deps,
    );
    const verified = await handleWorkerRequest(
      req("/admin/sign-in/verify", {
        method: "POST",
        headers: { origin: SITE, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: "dustin@hues.flowers", code: "111111" }).toString(),
      }),
      deps,
    );
    expect(verified.status).toBe(303);
    const setCookie = verified.headers.get("set-cookie");
    expect(setCookie).toContain("=");
    const cookie = setCookie!.split(";")[0]!;
    const home = await handleWorkerRequest(req("/admin", { headers: { cookie } }), deps);
    expect(home.status).toBe(200);
    expect(await textOf(home)).toBe("<p>Rev&#105;ew rev&#105;ew Pro&#100;uct</p>");
    // The public path passes through verbatim.
    expect(await textOf(await handleWorkerRequest(req("/about"), deps))).toBe("<p>Review review Product</p>");
  });

  it("reports 5xx renders to the sink and forces no-store", async () => {
    const sink = await startSink();
    try {
      const failing = stubVike(() => ({
        statusCode: 500,
        headers: [["content-type", "text/html; charset=utf-8"]],
        body: "render broke",
        errorWhileRendering: new Error("boom for willa@example.com"),
      }));
      const { deps } = testDeps({ renderVike: failing.renderVike, errorSinkUrl: sink.url });
      const res = await handleWorkerRequest(req("/variety/x"), deps);
      expect(res.status).toBe(500);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(sink.received).toHaveLength(1);
      expect(JSON.stringify(sink.received[0])).toContain("[email]");
    } finally {
      await sink.close();
    }
  });

  it("serves the app's own 500 page when rendering throws catastrophically", async () => {
    const sink = await startSink();
    try {
      const throwing = stubVike(() => {
        throw new Error("vike exploded");
      });
      const { deps } = testDeps({ renderVike: throwing.renderVike, errorSinkUrl: sink.url });
      const res = await handleWorkerRequest(req("/"), deps);
      expect(res.status).toBe(500);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(await textOf(res)).toContain("could not be loaded");
      expect(sink.received).toHaveLength(1);
    } finally {
      await sink.close();
    }
  });
});

describe("the preview shield", () => {
  it("forces noindex, nofollow over every response class when SEEDS_PREVIEW is set", async () => {
    const { deps } = testDeps({
      preview: true,
      assets: stubAssets({ "/manifest.webmanifest": { status: 200, headers: { "Content-Type": "application/manifest+json" }, body: "{}" } }),
    });
    const paths: Array<{ path: string; init?: RequestInit }> = [
      { path: "/" },
      { path: "/healthz" },
      { path: "/manifest.webmanifest" },
      { path: "/go/1" },
      { path: "/api/v1/crops?limit=1" },
      { path: "/api/internal/variety-status/x" },
    ];
    for (const { path, init } of paths) {
      const res = await handleWorkerRequest(req(path, init), deps);
      expect(`${path} -> ${res.headers.get("x-robots-tag")}`).toBe(`${path} -> noindex, nofollow`);
    }
    const beacon = await handleWorkerRequest(req("/api/track", { method: "POST", body: "{}" }), deps);
    expect(beacon.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const notFound = await handleWorkerRequest(
      req("/no-such-page"),
      {
        ...deps,
        renderVike: async () => ({ statusCode: 404, headers: [["content-type", "text/html; charset=utf-8"]], body: "missing" }),
      },
    );
    expect(notFound.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("serves a disallow-all robots.txt in preview, production bytes otherwise", async () => {
    const production = "User-agent: *\nAllow: /\n";
    const preview = testDeps({
      preview: true,
      assets: stubAssets({ "/robots.txt": { status: 200, headers: { "Content-Type": "text/plain" }, body: production } }),
    });
    const blocked = await handleWorkerRequest(req("/robots.txt"), preview.deps);
    expect(blocked.status).toBe(200);
    expect(blocked.headers.get("content-type")).toContain("text/plain");
    expect(await textOf(blocked)).toBe("User-agent: *\nDisallow: /\n");
    expect(blocked.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const prod = testDeps({ assets: stubAssets({ "/robots.txt": { status: 200, headers: { "Content-Type": "text/plain" }, body: production } }) });
    const served = await handleWorkerRequest(req("/robots.txt"), prod.deps);
    expect(await textOf(served)).toBe(production);
    expect(served.headers.get("x-robots-tag")).toBeNull();
  });

  it("leaves production headers byte-identical when the flag is unset", async () => {
    const { deps } = testDeps();
    expect((await handleWorkerRequest(req("/healthz"), deps)).headers.get("x-robots-tag")).toBe("noindex");
    expect((await handleWorkerRequest(req("/about"), deps)).headers.get("x-robots-tag")).toBeNull();
    expect((await handleWorkerRequest(req("/go/1"), deps)).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
