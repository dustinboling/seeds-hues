/**
 * Slice 3 preview/test server (Node): serves the BUILT app (dist/client +
 * dist/server) over plain HTTP so the contract suite drives the real SSR
 * path — Vike renderPage — with no JavaScript, Quinn-style.
 *
 * Responsibilities (production Worker/router concerns, mirrored 1:1 here):
 * - static files from dist/client (assets, manifest, machine files);
 * - POST /internal/revalidate (Bearer secret, the revalidate-handler mount
 *   contract): purges the shared data cache AND the edge mock, returns paths;
 * - /og/[kind]/[slug] image responses (the src/og route handler);
 * - Slice 6: the SSR floor POSTs (/report, /add-your-farm — form-encoded
 *   fields map to backend JSON and the page re-renders with the outcome);
 *   the /api/v1/* reverse-proxy to the API origin (verbatim status,
 *   headers, and bytes, including the 303-only no-JS form endpoints);
 *   GET /go/[id] (numeric ids relay the backend handler with the m-3
 *   utm_source rename; 404/410 pass through, v2 + Bea §1.7);
 * - everything else through Vike renderPage with the shared CatalogApi +
 *   DataCache passed via pageContextInit — ONE instance per process, so the
 *   revalidate purge reaches the same cache the +data hooks read (a second
 *   bundle copy would make the purge silently miss);
 * - a minimal in-memory edge mock for the detail routes' 200s
 *   (/variety/*, /seller/*, /crop/*, /series/*, /state/*), keyed per the
 *   §9 contract (the ?small_farm=true variant and every filtered/paged
 *   view keys separately, so a variant can never serve as the clean
 *   page; ?waitlist=… floor states bypass it entirely), purged by the
 *   revalidate paths plus the purged entries' related paths. Only 200s
 *   are stored; redirects and errors bypass.
 *
 * Env: PORT (0 = ephemeral; the listening URL prints on stdout),
 * SEEDS_API_BASE (default: the live API), SEEDS_REVALIDATE_SECRET
 * (required for POST /internal/revalidate).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "vike/server";
import { createCatalogApi } from "../src/data/api";
import { createDataCache } from "../src/data/cache";
import {
  handleDecide,
  handleSectionActions,
  handleSignInRequest,
  handleSignInVerify,
  handleSignOut,
  type AdminSection,
  type HandlerResult,
  type ServiceFetch,
} from "../src/server/admin-handlers";
import { serveOgImage } from "../src/og/serve";
import { isGoId, mapGoStatus, postBackendJson, relayHttp, rewriteGoLocation } from "../src/server/api-relay";
import {
  backendResultOf,
  farmFloorOutcome,
  farmJsonFromForm,
  farmValuesFromSubmission,
  reportFloorOutcome,
  reportJsonFromForm,
  reportValuesFromSubmission,
} from "../src/server/form-posts";
import { handleRevalidateHttpRequest } from "../src/server/revalidate-handler";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CLIENT_DIST = join(ROOT, "dist", "client");
const OG_FONTS_DIR = process.env.OG_FONTS_DIR ?? join(ROOT, "dist-server", "fonts");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon",
};

interface EdgeEntry {
  status: number;
  headers: [string, string][];
  body: string;
}

/**
 * Edge key for a variety URL: the pathname plus the variant marker when the
 * forgiving parse is on (?small_farm=true exactly once). All other query
 * strings are ignored — the route renders identically without them.
 */
function edgeKey(pathname: string, search: string): string {
  const values = new URLSearchParams(search).getAll("small_farm");
  const variant = values.length === 1 && values[0] === "true";
  return variant ? `${pathname}?small_farm=true` : pathname;
}

/** Single-segment shop/hub detail paths (the browse indexes stay uncached, Slice 4's rule). */
const DETAIL_PATTERN = /^\/(?:seller|crop|series|state)\/[^/]+$/;

/**
 * Edge key for a shop/hub URL: the pathname plus the FULL query string.
 * Every filtered, searched, sorted, and paged view keys separately from
 * the clean page (and from each other), so a variant can never serve as
 * the clean page — at the cost of one entry per distinct URL.
 */
function detailKey(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

/**
 * Drop an edge entry and every variant keyed under its pathname (a page's
 * filtered/paged views purge with the page itself).
 */
function purgeEdge(edge: Map<string, EdgeEntry>, path: string): void {
  edge.delete(path);
  for (const key of [...edge.keys()]) {
    if (key.startsWith(`${path}?`)) edge.delete(key);
  }
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const text = (await readRawBody(req)).toString("utf8");
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}

/** Form-encoded POST fields (the SSR floors); anything else reads as no fields. */
function parseFormBody(raw: Buffer, contentType: string | undefined): Record<string, string> {
  if (!contentType?.includes("application/x-www-form-urlencoded")) return {};
  return Object.fromEntries(new URLSearchParams(raw.toString("utf8")).entries());
}

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

function socketIp(req: IncomingMessage): string | null {
  return req.socket.remoteAddress ?? null;
}

/** v2's /go NO_STORE pair, mirrored on every /go answer the app serves. */
const GO_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** v2's admin-handler pair: never cached, never indexed. */
const ADMIN_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

async function main(): Promise<void> {
  const apiBaseUrl = (process.env.SEEDS_API_BASE ?? "https://seeds.hues.flowers/api/v1").replace(/\/+$/, "");
  const secret = process.env.SEEDS_REVALIDATE_SECRET ?? "";
  // The Turnstile site key, passed per render via pageContextInit (the
  // Worker-safe path — +data hooks never read process.env directly).
  const siteKey = process.env.SEEDS_TURNSTILE_SITE_KEY ?? null;
  // The process's ONE catalog client + data cache, shared by every render
  // (via pageContextInit) and every revalidate POST (inline purge).
  const api = createCatalogApi({ baseUrl: apiBaseUrl });
  const cache = createDataCache();
  const edge = new Map<string, EdgeEntry>();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://app");
      const pathname = url.pathname;

      if (req.method === "POST" && pathname === "/internal/revalidate") {
        if (!secret) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "revalidate not configured: set SEEDS_REVALIDATE_SECRET" }));
          return;
        }
        const body = await readJsonBody(req);
        try {
          // Capture related-entity paths BEFORE the data purge deletes the
          // entries that register them (a seller tag drops the variety
          // pages behind its listings even though the tag names only its
          // own — relatedPaths after invalidate would see an empty cache).
          let related: string[] = [];
          const result = await handleRevalidateHttpRequest(
            { authorization: req.headers.authorization ?? null, body },
            {
              expectedSecret: secret,
              invalidatePaths: (paths) => {
                related = cache.relatedPaths(paths);
                return cache.invalidatePaths(paths);
              },
            },
          );
          // The tag's own paths plus the purged entries' related-entity
          // paths (a one-tag revalidate drops every affected page even
          // though the tag names only its own — e.g. a seller tag drops
          // the variety pages behind its listings).
          for (const p of new Set([...result.paths, ...related])) purgeEdge(edge, p);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          const auth = error instanceof Error && error.name === "RevalidateAuthError";
          const validation = error instanceof Error && error.name === "RevalidateValidationError";
          res.writeHead(auth ? 401 : validation ? 400 : 500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "revalidate failed" }));
        }
        return;
      }

      if (req.method === "POST" && (pathname === "/report" || pathname === "/add-your-farm")) {
        // The SSR floor POSTs: form-encoded fields map to backend JSON
        // through the shared chassis builders (identical payloads to the
        // enhanced path by construction), post to the unchanged backend,
        // and the page re-renders with the outcome — the success state,
        // or the plain-language errors with the typed values preserved.
        // Always 200: a rejection is a re-render, never an error status.
        const raw = await readRawBody(req);
        const fields = parseFormBody(raw, req.headers["content-type"]);
        const isReport = pathname === "/report";
        const payload = isReport ? reportJsonFromForm(fields) : farmJsonFromForm(fields);
        let status: number;
        let json: { code?: string; detail?: string };
        try {
          const r = await postBackendJson(apiBaseUrl, isReport ? "/api/v1/reports" : "/api/v1/farm-submissions", payload, {
            forwardedFor: socketIp(req) ?? undefined,
          });
          status = r.status;
          json = r.json;
        } catch {
          status = 500;
          json = { code: "error", detail: "backend unreachable" };
        }
        const result = backendResultOf(status, json);
        const formOutcome = isReport
          ? reportFloorOutcome(result, reportValuesFromSubmission(payload))
          : farmFloorOutcome(result, farmValuesFromSubmission(payload));
        const floorRender = await renderPage({ urlOriginal: req.url ?? "/", catalogApi: api, dataCache: cache, formOutcome, turnstileSiteKey: siteKey, adminApiBase: new URL(apiBaseUrl).origin, requestCookie: req.headers.cookie ?? null });
        const floorBody = await floorRender.httpResponse.getBody();
        const floorHeaders = new Headers(floorRender.httpResponse.headers);
        if (!floorHeaders.has("content-type")) floorHeaders.set("content-type", "text/html; charset=utf-8");
        res.writeHead(floorRender.httpResponse.statusCode, Object.fromEntries([...floorHeaders.entries()]));
        res.end(floorBody);
        return;
      }

      const go = /^\/go\/([^/]+)$/.exec(pathname);
      if (go && req.method === "GET") {
        // GET /go/[id]: numeric ids relay the backend's handler (anything
        // else 404s without a backend call — v2's route rule), the
        // retired utm_source is renamed on relay (Bea m-3), and the
        // backend's 404/410 pass through (removed seller stays 410, v2 +
        // Bea §1.7). Always no-store.
        const id = go[1]!;
        if (!isGoId(id)) {
          res.writeHead(404, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
          res.end("Listing not found");
          return;
        }
        let out;
        try {
          out = await relayHttp(apiBaseUrl, {
            method: "GET",
            path: pathname,
            query: url.search,
            headers: requestHeaders(req),
            body: null,
            socketIp: socketIp(req),
          });
        } catch {
          res.writeHead(502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
          res.end("Bad Gateway");
          return;
        }
        const mapped = mapGoStatus(out.status);
        if (mapped === 302 && typeof out.headers.location === "string" && out.headers.location) {
          res.writeHead(302, { ...GO_NO_STORE, "Referrer-Policy": "origin", Location: rewriteGoLocation(out.headers.location) });
          res.end();
          return;
        }
        if (mapped === 404 || mapped === 410) {
          res.writeHead(mapped, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
          res.end(Buffer.from(out.body));
          return;
        }
        res.writeHead(502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad Gateway");
        return;
      }

      // Slice 7: the admin handlers (sign-in, decide, section actions).
      // Native form posts 303 back with the status wording; the SPA's
      // JSON posts get v2's sheet-JSON vocabulary. Every write purges the
      // data cache + edge for the service's revalidate paths (v2's
      // revalidatePath on the same funnel).
      const adminAction = /^\/admin\/(?:sign-in\/(?:request|verify|sign-out)|review\/decide|(sellers|varieties|listings|accounts)\/actions)$/.exec(pathname);
      if (adminAction && req.method === "POST") {
        const origin = req.headers.origin;
        if (typeof origin === "string" && origin !== url.origin) {
          res.writeHead(403, { ...ADMIN_NO_STORE, "Content-Type": "text/plain; charset=utf-8" });
          res.end("Forbidden");
          return;
        }
        const rawBody = await readRawBody(req);
        const contentType = req.headers["content-type"];
        let raw: Record<string, unknown> = {};
        if (contentType?.includes("application/json")) {
          try {
            const parsed: unknown = JSON.parse(rawBody.toString("utf8") || "{}");
            if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
          } catch {
            raw = {};
          }
        } else {
          raw = parseFormBody(rawBody, contentType);
        }
        const wantsJson = req.headers.accept?.includes("application/json") ?? false;
        const cookieHeader = req.headers.cookie;
        const serviceFetch: ServiceFetch = async (path, init) => {
          const target = `${new URL(apiBaseUrl).origin}${path}`;
          const r = await fetch(target, {
            method: init.method,
            headers: {
              "Content-Type": "application/json",
              ...(init.cookie ? { Cookie: init.cookie } : {}),
            },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            redirect: "manual",
          });
          const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
          return { status: r.status, json, setCookie: r.headers.get("set-cookie") };
        };
        let result: HandlerResult;
        try {
          if (pathname === "/admin/sign-in/request") result = await handleSignInRequest(serviceFetch, { raw, wantsJson });
          else if (pathname === "/admin/sign-in/verify") result = await handleSignInVerify(serviceFetch, { raw, wantsJson });
          else if (pathname === "/admin/sign-in/sign-out") result = await handleSignOut(serviceFetch, cookieHeader);
          else if (pathname === "/admin/review/decide") result = await handleDecide(serviceFetch, { raw, wantsJson, cookie: cookieHeader });
          else result = await handleSectionActions(serviceFetch, adminAction[1] as AdminSection, { raw, wantsJson, cookie: cookieHeader });
        } catch {
          result = wantsJson
            ? { kind: "json", status: 500, body: { ok: false, message: "That didn't go through. Nothing was changed — try again." }, revalidate: [] }
            : { kind: "redirect", location: pathname.startsWith("/admin/review") ? "/admin/review?status=failed" : `${pathname.split("/actions")[0]}?status=save_failed`, revalidate: [] };
        }
        if (result.revalidate.length > 0) {
          const related = cache.relatedPaths(result.revalidate);
          cache.invalidatePaths(result.revalidate);
          for (const p of new Set([...result.revalidate, ...related])) purgeEdge(edge, p);
        }
        if (result.kind === "redirect") {
          res.writeHead(303, { ...ADMIN_NO_STORE, Location: result.location, ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) });
          res.end();
          return;
        }
        if (result.kind === "json") {
          res.writeHead(result.status, { ...ADMIN_NO_STORE, "Content-Type": "application/json; charset=utf-8", ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) });
          res.end(JSON.stringify(result.body));
          return;
        }
        res.writeHead(result.status, { ...ADMIN_NO_STORE, "Content-Type": "text/html; charset=utf-8" });
        res.end(result.body);
        return;
      }

      if (pathname === "/api/internal/admin" || pathname.startsWith("/api/internal/admin/")) {
        // Slice 7: the admin service reads (session + role enforced by the
        // service from the forwarded cookie): relayed verbatim, like /api/v1.
        const raw = await readRawBody(req);
        let out;
        try {
          out = await relayHttp(apiBaseUrl, {
            method: req.method ?? "GET",
            path: pathname,
            query: url.search,
            headers: requestHeaders(req),
            body: raw.length > 0 ? new Uint8Array(raw) : null,
            socketIp: socketIp(req),
          });
        } catch {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "backend unreachable" }));
          return;
        }
        res.writeHead(out.status, out.headers);
        res.end(Buffer.from(out.body));
        return;
      }

      if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
        // The backend-owned paths (form/account reads and writes, the
        // 303-only no-JS form endpoints): reverse-proxied to the API
        // origin with status, headers, and bytes relayed verbatim —
        // notably the 303 Locations with their Ruling 9 fragments and
        // the session Set-Cookie.
        const raw = await readRawBody(req);
        let out;
        try {
          out = await relayHttp(apiBaseUrl, {
            method: req.method ?? "GET",
            path: pathname,
            query: url.search,
            headers: requestHeaders(req),
            body: raw.length > 0 ? new Uint8Array(raw) : null,
            socketIp: socketIp(req),
          });
        } catch {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "backend unreachable" }));
          return;
        }
        res.writeHead(out.status, out.headers);
        res.end(Buffer.from(out.body));
        return;
      }

      const og = /^\/og\/([^/]+)\/([^/]+)$/.exec(pathname);
      if (og && (req.method === "GET" || req.method === "HEAD")) {
        const result = await serveOgImage(og[1]!, og[2]!, { catalog: api, fontDir: OG_FONTS_DIR });
        if (result.status === 404 || !result.body) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        res.writeHead(200, result.headers);
        res.end(req.method === "HEAD" ? undefined : result.body);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const filePath = normalize(join(CLIENT_DIST, pathname === "/" ? "index.html" : `.${pathname}`));
        if (filePath.startsWith(CLIENT_DIST)) {
          try {
            const body = await readFile(filePath);
            res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
            res.end(req.method === "HEAD" ? undefined : body);
            return;
          } catch {
            // Not a static file — fall through to the renderer.
          }
        }
      }

      // Edge mock: serve a stored detail 200, else render and maybe store.
      // Floor-state URLs (?waitlist=…) bypass it entirely: a transient
      // per-visitor render must never serve as, or be served from, the
      // clean page's cache entry.
      const floorBypass = url.searchParams.has("waitlist");
      const cacheable = req.method === "GET" && !floorBypass && (pathname.startsWith("/variety/") || DETAIL_PATTERN.test(pathname));
      const key = cacheable
        ? pathname.startsWith("/variety/")
          ? edgeKey(pathname, url.search)
          : detailKey(pathname, url.search)
        : null;
      const hit = key ? edge.get(key) : undefined;
      if (hit) {
        res.writeHead(hit.status, Object.fromEntries(hit.headers));
        res.end(hit.body);
        return;
      }

      const pageContext = await renderPage({ urlOriginal: req.url ?? "/", catalogApi: api, dataCache: cache, turnstileSiteKey: siteKey, adminApiBase: new URL(apiBaseUrl).origin, requestCookie: req.headers.cookie ?? null });
      const { httpResponse } = pageContext;
      const body = await httpResponse.getBody();
      const headers = new Headers(httpResponse.headers);
      if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
      const headerList = [...headers.entries()] as [string, string][];
      if (key && httpResponse.statusCode === 200) {
        edge.set(key, { status: 200, headers: headerList, body });
      }
      res.writeHead(httpResponse.statusCode, Object.fromEntries(headerList));
      res.end(body);
    } catch (error) {
      // A server that cannot render says why, once.
      console.error("serve: render failed", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  const port = Number(process.env.PORT ?? "0") || 0;
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("serve: could not bind a port");
  // The contract suite parses this line for the ephemeral port.
  console.log(`seeds-app listening on http://127.0.0.1:${address.port}`);
}

await main();
