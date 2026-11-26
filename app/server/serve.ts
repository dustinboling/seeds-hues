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
 *   page; ?waitlist=… floor states and client-navigation data
 *   (.pageContext.json) bypass it entirely), purged by the
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
import { gzipSync } from "node:zlib";
import { renderPage } from "vike/server";
import { createCatalogApi } from "../src/data/api";
import { createDataCache } from "../src/data/cache";
import { buildErrorReport, own500Html, postErrorReport } from "../src/lib/error-report";
import { scrubAdminFalsePositives } from "../src/server/admin-scrub";
import { DETAIL_PATTERN, detailKey, edgeKey, isPageContextJsonPath, purgeEdge, type EdgeEntry } from "../src/server/edge-cache";
import { headersFor, mergeHeaders, routeClassFor, shouldCompress } from "../src/server/headers";
import {
  fetchMe,
  gateNoAccess,
  gateProtected,
  gateSignIn,
  handleDecide,
  handleSectionActions,
  handleSignInRequest,
  handleSignInVerify,
  handleSignOut,
  type AdminSection,
  type HandlerResult,
  type ServiceFetch,
} from "../src/server/admin-handlers";
import { safeAdminNext } from "../src/lib/admin/auth";
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

/**
 * Slice 8: merge the edge header set (v2's ported base + the hardening
 * additions, per route class) UNDER a response's own headers — Vike's
 * per-route Cache-Control and the relayed backend's headers survive —
 * and force no-store on every error status.
 */
function edged(pathname: string, status: number, own: Record<string, string | string[]>): Record<string, string | string[]> {
  const contentTypeValue = own["Content-Type"] ?? own["content-type"] ?? null;
  const contentType = typeof contentTypeValue === "string" ? contentTypeValue : null;
  const merged = mergeHeaders(headersFor(routeClassFor(pathname), { status, contentType, pathname }), own);
  if (status >= 400) merged["Cache-Control"] = "no-store";
  return merged;
}

function acceptsGzip(req: IncomingMessage): boolean {
  return req.headers["accept-encoding"]?.includes("gzip") ?? false;
}

/**
 * Slice 8: the single responder — edge headers, then gzip for worthwhile
 * textual bodies (≥1 KB, client accepts it), then the write. HEAD
 * responses carry headers only.
 */
function respond(
  res: ServerResponse,
  req: IncomingMessage,
  pathname: string,
  status: number,
  own: Record<string, string | string[]>,
  body?: string | Buffer,
): void {
  const merged = edged(pathname, status, own);
  const buf = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(body);
  const headOnly = req.method === "HEAD";
  const contentTypeValue = merged["Content-Type"] ?? merged["content-type"] ?? null;
  if (
    buf &&
    buf.length >= 1024 &&
    acceptsGzip(req) &&
    shouldCompress(typeof contentTypeValue === "string" ? contentTypeValue : null, req.method ?? "GET")
  ) {
    const gzipped = gzipSync(buf);
    merged["Content-Encoding"] = "gzip";
    delete merged["Content-Length"];
    res.writeHead(status, merged);
    res.end(headOnly ? undefined : gzipped);
    return;
  }
  res.writeHead(status, merged);
  res.end(headOnly ? undefined : buf);
}

/** v2's /go NO_STORE pair, mirrored on every /go answer the app serves. */
const GO_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** v2's admin-handler pair: never cached, never indexed. */
const ADMIN_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

async function main(): Promise<void> {
  // Slice 8: `SEEDS_API_BASE=stub:parity` embeds the hermetic parity stub
  // (the same fixture catalog the verify gate's parity crawl runs
  // against — no network, no production reads). Lighthouse CI serves
  // this mode; production never sets it.
  let apiBaseUrl = (process.env.SEEDS_API_BASE ?? "https://seeds.hues.flowers/api/v1").replace(/\/+$/, "");
  if (apiBaseUrl === "stub:parity") {
    const [{ startStubApi }, { parityCatalogState }] = await Promise.all([
      import("../tests/stub/api-server"),
      import("../tests/parity/parity-catalog"),
    ]);
    const stub = await startStubApi(parityCatalogState());
    apiBaseUrl = `${stub.url}/api/v1`;
  }
  const secret = process.env.SEEDS_REVALIDATE_SECRET ?? "";
  // Slice 8: the error-monitoring sink (client + server capture). Empty =
  // unconfigured: capture is skipped, serving never waits on it.
  const errorSinkUrl = process.env.SEEDS_ERROR_SINK_URL ?? "";
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
          respond(res, req, pathname, 500, { "Content-Type": "application/json" }, JSON.stringify({ error: "revalidate not configured: set SEEDS_REVALIDATE_SECRET" }));
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
          respond(res, req, pathname, 200, { "Content-Type": "application/json" }, JSON.stringify(result));
        } catch (error) {
          const auth = error instanceof Error && error.name === "RevalidateAuthError";
          const validation = error instanceof Error && error.name === "RevalidateValidationError";
          respond(res, req, pathname, auth ? 401 : validation ? 400 : 500, { "Content-Type": "application/json" }, JSON.stringify({ error: error instanceof Error ? error.message : "revalidate failed" }));
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
        respond(res, req, pathname, floorRender.httpResponse.statusCode, Object.fromEntries([...floorHeaders.entries()]), floorBody);
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
          respond(res, req, pathname, 404, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Listing not found");
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
          respond(res, req, pathname, 502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Bad Gateway");
          return;
        }
        const mapped = mapGoStatus(out.status);
        if (mapped === 302 && typeof out.headers.location === "string" && out.headers.location) {
          respond(res, req, pathname, 302, { ...GO_NO_STORE, "Referrer-Policy": "origin", Location: rewriteGoLocation(out.headers.location) });
          return;
        }
        if (mapped === 404 || mapped === 410) {
          respond(res, req, pathname, mapped, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, Buffer.from(out.body));
          return;
        }
        respond(res, req, pathname, 502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Bad Gateway");
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
          respond(res, req, pathname, 403, { ...ADMIN_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
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
          respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: result.location, ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) });
          return;
        }
        if (result.kind === "json") {
          respond(res, req, pathname, result.status, { ...ADMIN_NO_STORE, "Content-Type": "application/json; charset=utf-8", ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) }, JSON.stringify(result.body));
          return;
        }
        respond(res, req, pathname, result.status, { ...ADMIN_NO_STORE, "Content-Type": "text/html; charset=utf-8" }, result.body);
        return;
      }

      // Slice 7: the admin page gate (GET/HEAD). Vike's abort only
      // speaks 301/302 while the admin gate is 303 throughout (v2
      // parity), so the server enforces it before renderPage: every
      // /admin/* surface refuses signed-out (sign-in + return path,
      // expired → the A3 welcome-back) and unauthorized (no-access).
      if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
        const isActionPath = /^\/admin\/(?:sign-in\/(?:request|verify|sign-out)|review\/decide|(?:sellers|varieties|listings|accounts)\/actions)$/.test(pathname);
        if (!isActionPath) {
          const cookieHeader = req.headers.cookie;
          const gateFetch: ServiceFetch = async (path, init) => {
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
          let me;
          try {
            me = await fetchMe(gateFetch, cookieHeader);
          } catch {
            me = { signedIn: false as const, user: null, expired: false as const, email: null };
          }
          if (pathname === "/admin/sign-in") {
            const next = safeAdminNext(url.searchParams.get("next")) ?? "/admin";
            const gate = gateSignIn(me, next);
            if (gate.kind === "redirect") {
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location });
              return;
            }
          } else if (pathname === "/admin/sign-in/code") {
            const next = safeAdminNext(url.searchParams.get("next")) ?? "/admin";
            const gate = gateSignIn(me, next);
            if (gate.kind === "redirect") {
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location });
              return;
            }
            if (!url.searchParams.get("email")) {
              const to = next === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(next)}`;
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: to });
              return;
            }
          } else if (pathname === "/admin/no-access") {
            const gate = gateNoAccess(me, url.searchParams.get("email"), url.searchParams.get("name"));
            if (gate.kind === "redirect") {
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location });
              return;
            }
          } else if (pathname === "/admin/waitlist") {
            // Retired in v2 Slice D: a true 404 for privileged sessions
            // (the gate still refuses signed-out + unauthorized first).
            const gate = gateProtected(me, req.url ?? pathname);
            if (gate.kind === "redirect") {
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location });
              return;
            }
            respond(res, req, pathname, 404, { ...ADMIN_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Not found");
            return;
          } else {
            const gate = gateProtected(me, req.url ?? pathname);
            if (gate.kind === "redirect") {
              respond(res, req, pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location });
              return;
            }
          }
        }
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
          respond(res, req, pathname, 502, { "Content-Type": "application/json" }, JSON.stringify({ error: "backend unreachable" }));
          return;
        }
        // Relayed verbatim (the backend owns bytes AND encoding — no gzip
        // here), with the edge set merged under for the robots tag + base.
        res.writeHead(out.status, edged(pathname, out.status, out.headers));
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
          respond(res, req, pathname, 502, { "Content-Type": "application/json" }, JSON.stringify({ error: "backend unreachable" }));
          return;
        }
        // Relayed verbatim (the backend owns bytes AND encoding), edge set merged under.
        res.writeHead(out.status, edged(pathname, out.status, out.headers));
        res.end(Buffer.from(out.body));
        return;
      }

      // Slice 8: the uptime hook. 200 + {"ok":true}, never cached, never
      // indexed. The production Worker serves the identical mount.
      if (pathname === "/healthz" && (req.method === "GET" || req.method === "HEAD")) {
        respond(res, req, pathname, 200, { "Content-Type": "application/json; charset=utf-8" }, '{"ok":true}');
        return;
      }

      // Slice 8: POST /api/track, ported from v2/app/api/track/route.ts —
      // the internal view/click beacon. Always 204 (a beacon can never
      // affect navigation; measurement never fails loudly); anything but
      // POST is 405. This harness records nothing (it has no D1); the
      // production Worker validates the same shapes and writes to the
      // click service (Slice 9 mount behavior, same wire contract).
      if (pathname === "/api/track") {
        if (req.method !== "POST") {
          respond(res, req, pathname, 405, { Allow: "POST", "X-Robots-Tag": "noindex" });
          return;
        }
        const raw = await readRawBody(req);
        if (raw.length <= 4096) {
          try {
            JSON.parse(raw.toString("utf8"));
          } catch {
            // Unparseable bodies 204 like everything else.
          }
        }
        respond(res, req, pathname, 204, { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" });
        return;
      }

      // Slice 8: POST /api/client-errors — the client ErrorReporter's
      // same-origin relay. The payload is redacted and forwarded to the
      // configured sink; the response is always 204 (a beacon, like
      // /api/track). Anything but POST is 405.
      if (pathname === "/api/client-errors") {
        if (req.method !== "POST") {
          respond(res, req, pathname, 405, { Allow: "POST", "X-Robots-Tag": "noindex" });
          return;
        }
        const raw = await readRawBody(req);
        if (errorSinkUrl && raw.length > 0 && raw.length <= 8192) {
          try {
            const payload = JSON.parse(raw.toString("utf8")) as { name?: unknown; message?: unknown; stack?: unknown; url?: unknown; extra?: unknown };
            const report = buildErrorReport(
              {
                name: typeof payload.name === "string" ? payload.name : "Error",
                message: typeof payload.message === "string" ? payload.message : "",
                stack: typeof payload.stack === "string" ? payload.stack : undefined,
              },
              {
                url: typeof payload.url === "string" ? payload.url : "/",
                userAgent: req.headers["user-agent"],
                extra: payload.extra,
              },
            );
            await postErrorReport(errorSinkUrl, report);
          } catch {
            // Monitoring must not break serving: fall through to the 204.
          }
        }
        respond(res, req, pathname, 204, { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" });
        return;
      }

      const og = /^\/og\/([^/]+)\/([^/]+)$/.exec(pathname);
      if (og && (req.method === "GET" || req.method === "HEAD")) {
        const result = await serveOgImage(og[1]!, og[2]!, { catalog: api, fontDir: OG_FONTS_DIR });
        if (result.status === 404 || !result.body) {
          respond(res, req, pathname, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
          return;
        }
        respond(res, req, pathname, 200, result.headers, result.body);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const filePath = normalize(join(CLIENT_DIST, pathname === "/" ? "index.html" : `.${pathname}`));
        if (filePath.startsWith(CLIENT_DIST)) {
          try {
            const body = await readFile(filePath);
            respond(res, req, pathname, 200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" }, body);
            return;
          } catch {
            // Not a static file — fall through to the renderer.
          }
        }
      }

      // Edge mock: serve a stored detail 200, else render and maybe store.
      // Floor-state URLs (?waitlist=…) bypass it entirely: a transient
      // per-visitor render must never serve as, or be served from, the
      // clean page's cache entry. Client-navigation data
      // (.pageContext.json) bypasses it too: it varies by the full query
      // string, so the variety detail key would serve one filter's data
      // as another's (Quinn F2).
      const floorBypass = url.searchParams.has("waitlist");
      const cacheable =
        req.method === "GET" &&
        !floorBypass &&
        !isPageContextJsonPath(pathname) &&
        (pathname.startsWith("/variety/") || DETAIL_PATTERN.test(pathname));
      const key = cacheable
        ? pathname.startsWith("/variety/")
          ? edgeKey(pathname, url.search)
          : detailKey(pathname, url.search)
        : null;
      const hit = key ? edge.get(key) : undefined;
      if (key && hit) {
        // Stored raw; re-edged + compressed per request (the merge is idempotent).
        respond(res, req, key.split("?")[0]!, hit.status, Object.fromEntries(hit.headers), hit.body);
        return;
      }

      const pageContext = await renderPage({ urlOriginal: req.url ?? "/", catalogApi: api, dataCache: cache, turnstileSiteKey: siteKey, adminApiBase: new URL(apiBaseUrl).origin, requestCookie: req.headers.cookie ?? null });
      const { httpResponse } = pageContext;
      // Slice 8: server 5xx capture — a Vike error render reports its
      // redacted failure to the sink (when configured) before serving.
      if (httpResponse.statusCode >= 500 && errorSinkUrl) {
        const failure = (pageContext as { errorWhileRendering?: unknown }).errorWhileRendering;
        const message =
          failure instanceof Error
            ? `${failure.name}: ${failure.message}`
            : `render failed with status ${httpResponse.statusCode}`;
        await postErrorReport(
          errorSinkUrl,
          buildErrorReport(
            { name: "RenderError", message, stack: failure instanceof Error ? failure.stack : undefined },
            { url: pathname, userAgent: req.headers["user-agent"] },
          ),
        );
      }
      let body = await httpResponse.getBody();
      const headers = new Headers(httpResponse.headers);
      if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
      if ((pathname === "/admin" || pathname.startsWith("/admin/")) && httpResponse.statusCode === 200 && (headers.get("content-type") ?? "").includes("text/html")) {
        body = scrubAdminFalsePositives(body);
      }
      const headerList = [...headers.entries()] as [string, string][];
      if (key && httpResponse.statusCode === 200) {
        edge.set(key, { status: 200, headers: headerList, body });
      }
      respond(res, req, pathname, httpResponse.statusCode, Object.fromEntries(headerList), body);
    } catch (error) {
      // Catastrophic (renderPage itself threw — past Vike's _error page):
      // report the redacted failure, then serve the app's own 500 page.
      console.error("serve: render failed", error);
      if (!res.headersSent) {
        try {
          const url = new URL(req.url ?? "/", "http://app");
          if (errorSinkUrl) {
            await postErrorReport(
              errorSinkUrl,
              buildErrorReport(
                {
                  name: "RenderError",
                  message: error instanceof Error ? `${error.name}: ${error.message}` : "render failed",
                  stack: error instanceof Error ? error.stack : undefined,
                },
                { url: url.pathname, userAgent: req.headers["user-agent"] },
              ),
            );
          }
          respond(res, req, url.pathname, 500, { "Content-Type": "text/html; charset=utf-8" }, own500Html());
        } catch {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
          }
        }
      }
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
