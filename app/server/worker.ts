/**
 * The app's Cloudflare Worker entry (the cutover's foundation, pulled
 * forward for the preview deploy): wires the routing table in
 * ./worker-handler.ts to the real bindings with per-isolate shared
 * instances (ONE catalog client + data cache + edge map). This module
 * exports the default fetch handler ALONE — workerd rejects any other
 * export (every named export must be a function or ExportedHandler).
 *
 * The side-effect import below bundles Vike's server production entry
 * (the global entry + assets manifest + build info) into the worker:
 * without it renderPage dies with "The server production entry is
 * missing", because the entry chunk the build emits beside index.js is
 * never imported at runtime in workerd.
 */
import "virtual:@brillout/vite-plugin-server-entry:serverEntry";
import type { Fetcher } from "@cloudflare/workers-types";
import { renderPage } from "vike/server";
import { createCatalogApi, type CatalogApi } from "../src/data/api";
import { createDataCache, type DataCache } from "../src/data/cache";
import type { EdgeEntry } from "../src/server/edge-cache";
import {
  handleWorkerRequest,
  normalizeApiBase,
  workerPreview,
  type WorkerEnv,
  type WorkerOgResult,
  type WorkerVikeArgs,
  type WorkerVikeRenderer,
  type WorkerVikeResult,
} from "./worker-handler";

const realRenderVike: WorkerVikeRenderer = async (args: WorkerVikeArgs): Promise<WorkerVikeResult> => {
  const pageContext = await renderPage({
    urlOriginal: args.urlOriginal,
    catalogApi: args.catalogApi,
    dataCache: args.dataCache,
    ...(args.formOutcome !== undefined ? { formOutcome: args.formOutcome } : {}),
    turnstileSiteKey: args.turnstileSiteKey,
    adminApiBase: args.adminApiBase,
    requestCookie: args.requestCookie,
  });
  const { httpResponse } = pageContext;
  return {
    statusCode: httpResponse.statusCode,
    headers: httpResponse.headers,
    body: await httpResponse.getBody(),
    errorWhileRendering: pageContext.errorWhileRendering,
  };
};

interface IsolateShared {
  apiBase: string;
  api: CatalogApi;
  cache: DataCache;
  edge: Map<string, EdgeEntry>;
}

let shared: IsolateShared | null = null;

/** The isolate's ONE catalog client + data cache + edge map. */
function isolateShared(apiBase: string): IsolateShared {
  if (!shared || shared.apiBase !== apiBase) {
    shared = { apiBase, api: createCatalogApi({ baseUrl: apiBase }), cache: createDataCache(), edge: new Map<string, EdgeEntry>() };
  }
  return shared;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const apiBase = normalizeApiBase(env.SEEDS_API_BASE);
    const isolate = isolateShared(apiBase);
    return handleWorkerRequest(request, {
      assets: {
        // The runtime values ARE the worker Request/Response — the DOM
        // and workers-types declarations just model them differently
        // (theirs requires a fetcher member and older iterators) —
        // hence the boundary casts, in this one place only.
        fetch: (incoming: Request): Promise<Response> =>
          env.ASSETS.fetch(incoming as unknown as Parameters<Fetcher["fetch"]>[0]) as unknown as Promise<Response>,
      },
      // The real D1Database satisfies the mount's minimal surface
      // structurally (this adaptation is the proof — no casts).
      db: env.DB,
      apiBase,
      revalidateSecret: env.SEEDS_REVALIDATE_SECRET ?? "",
      errorSinkUrl: env.SEEDS_ERROR_SINK_URL ?? "",
      siteKey: env.SEEDS_TURNSTILE_SITE_KEY ?? null,
      preview: workerPreview(env),
      api: isolate.api,
      cache: isolate.cache,
      edge: isolate.edge,
      renderVike: realRenderVike,
      renderOg: async (kind: string, slug: string): Promise<WorkerOgResult> => {
        // Preview relay: serve the production OG cards through the
        // worker (same mount contract — known kinds + well-formed slugs
        // only, anything else 404s without a backend call). The port's
        // own edge renderer (src/og/render-edge.ts, unit-pinned) cannot
        // initialize in workerd: Satori's engine needs dynamic WASM
        // compilation, which the runtime disallows ("code generation
        // disallowed by embedder"), and its Emscripten env detection
        // crashes on the missing self.location. The cutover's renderer
        // needs an edge-safe Satori engine (@vercel/og ships static
        // yoga/resvg .wasm modules — the shape workerd accepts).
        if (!isOgRelayable(kind, slug)) return { status: 404, headers: {}, body: null };
        let upstream: Response;
        try {
          upstream = await fetch(`${new URL(apiBase).origin}/og/${kind}/${slug}`, { method: "GET", redirect: "manual" });
        } catch {
          return { status: 404, headers: {}, body: null };
        }
        const contentType = upstream.headers.get("content-type") ?? "";
        if (upstream.status !== 200 || !contentType.startsWith("image/")) return { status: 404, headers: {}, body: null };
        return {
          status: 200,
          headers: {
            "Content-Type": contentType.split(";")[0]!,
            "Cache-Control": upstream.headers.get("cache-control") ?? "public, max-age=86400, stale-while-revalidate=604800",
          },
          body: new Uint8Array(await upstream.arrayBuffer()),
        };
      },
    });
  },
};

/** The relayable card shapes (mirrors buildOgCard's kind + slug rules): anything else 404s without a fetch. */
function isOgRelayable(kind: string, slug: string): boolean {
  if (kind !== "site" && kind !== "variety" && kind !== "seller" && kind !== "crop") return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
