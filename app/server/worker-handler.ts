/**
 * The app's Cloudflare Worker entry (the cutover's foundation, pulled
 * forward for the preview deploy): a web-standard fetch handler composing
 * the SAME routes as the Node harness (server/serve.ts), route for route —
 * Static Assets for dist/client files and machine files; POST
 * /internal/revalidate; /og/[kind]/[slug]; the SSR floor POSTs (/report,
 * /add-your-farm); GET /go/[id]; the admin POST actions and the admin GET
 * gate; the /api/v1/* and /api/internal/admin/* relays to the API origin;
 * /healthz; /api/track; /api/client-errors; the in-memory edge mock for
 * detail 200s (a per-isolate Map); everything else through Vike
 * renderPage with ONE shared catalog client + data cache per isolate —
 * plus the Worker's own mounts: GET /api/internal/variety-status/[slug]
 * from D1 (the one Phase B mount the preview carries), and the preview
 * SEO shield behind SEEDS_PREVIEW.
 *
 * Node-only mechanics translate: static reads → the ASSETS binding; gzip
 * → the edge (dropped — the edge compresses); socket IP →
 * cf-connecting-ip. The unsubscribe/describe mount is deliberately
 * unmounted (it needs the production UNSUBSCRIBE_SIGNING_KEY, never
 * copied to a preview) — the app degrades per its contract.
 *
 * handleWorkerRequest is the injectable core (bindings, shared state, and
 * the Vike/OG renderers arrive via WorkerDeps, so the routing table is
 * drivable without a build); server/worker.ts is the thin entry that
 * wires the real bindings with per-isolate shared instances and exports
 * the default fetch handler alone (workerd rejects any other export).
 */
import type { D1Database, Fetcher } from "@cloudflare/workers-types";
import type { CatalogApi } from "../src/data/api";
import type { DataCache } from "../src/data/cache";
import { buildErrorReport, own500Html, postErrorReport } from "../src/lib/error-report";
import { scrubAdminFalsePositives } from "../src/server/admin-scrub";
import { DETAIL_PATTERN, detailKey, edgeKey, isPageContextJsonPath, purgeEdge, type EdgeEntry } from "../src/server/edge-cache";
import { headersFor, mergeHeaders, routeClassFor } from "../src/server/headers";
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
import { varietyStatusForSlug, type VarietyStatusDb } from "../src/server/variety-status";

/** The Worker's bindings + vars (wrangler.preview.jsonc, then the cutover config). */
export interface WorkerEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  SEEDS_API_BASE?: string;
  SEEDS_TURNSTILE_SITE_KEY?: string;
  SEEDS_REVALIDATE_SECRET?: string;
  SEEDS_ERROR_SINK_URL?: string;
  SEEDS_PREVIEW?: string;
}

/**
 * The entry's ASSETS surface: the binding's fetch over DOM types (the
 * mount never dials connect()). The default export adapts the real
 * Fetcher — whose Request declaration models the same runtime value
 * differently — at the boundary below.
 */
export interface WorkerAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerVikeArgs {
  urlOriginal: string;
  catalogApi: CatalogApi;
  dataCache: DataCache;
  formOutcome?: unknown;
  turnstileSiteKey: string | null;
  adminApiBase: string;
  requestCookie: string | null;
}

export interface WorkerVikeResult {
  statusCode: number;
  headers: [string, string][];
  body: string;
  errorWhileRendering?: unknown;
}

export type WorkerVikeRenderer = (args: WorkerVikeArgs) => Promise<WorkerVikeResult>;

export interface WorkerOgResult {
  status: 200 | 404;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

export type WorkerOgRenderer = (kind: string, slug: string) => Promise<WorkerOgResult>;

export interface WorkerDeps {
  assets: WorkerAssetsBinding;
  db: VarietyStatusDb;
  apiBase: string;
  revalidateSecret: string;
  errorSinkUrl: string;
  siteKey: string | null;
  preview: boolean;
  api: CatalogApi;
  cache: DataCache;
  edge: Map<string, EdgeEntry>;
  renderVike: WorkerVikeRenderer;
  renderOg: WorkerOgRenderer;
}

export const DEFAULT_WORKER_API_BASE = "https://seeds.hues.flowers/api/v1";

/** The normalized catalog API base (empty/unset = the live API). */
export function normalizeApiBase(value: string | undefined): string {
  return (value && value.length > 0 ? value : DEFAULT_WORKER_API_BASE).replace(/\/+$/, "");
}

/** The preview shield: on exactly when SEEDS_PREVIEW is set (any non-empty value). */
export function workerPreview(env: WorkerEnv): boolean {
  return (env.SEEDS_PREVIEW ?? "") !== "";
}

/** v2's /go NO_STORE pair, mirrored on every /go answer the app serves. */
const GO_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** v2's admin-handler pair: never cached, never indexed. */
const ADMIN_NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** The preview shield's disallow-all robots body (served for GET /robots.txt when the flag is set). */
const PREVIEW_ROBOTS_TXT = "User-agent: *\nDisallow: /\n";

const textDecoder = new TextDecoder();

/** Form-encoded POST fields (the SSR floors); anything else reads as no fields. */
function parseFormBody(text: string, contentType: string | null): Record<string, string> {
  if (!contentType?.includes("application/x-www-form-urlencoded")) return {};
  return Object.fromEntries(new URLSearchParams(text).entries());
}

/**
 * Merge the edge header set (v2's ported base + the hardening additions,
 * per route class) UNDER a response's own headers — Vike's per-route
 * Cache-Control and the relayed backend's headers survive — force
 * no-store on every error status, and force the shield's robots tag over
 * everything when SEEDS_PREVIEW is set. The shield lives here, behind
 * the flag, never as an unconditional change to the shared header paths.
 */
function edged(pathname: string, status: number, own: Record<string, string | string[]>, preview: boolean): Headers {
  const contentTypeValue = own["Content-Type"] ?? own["content-type"] ?? null;
  const contentType = typeof contentTypeValue === "string" ? contentTypeValue : null;
  const merged = mergeHeaders(headersFor(routeClassFor(pathname), { status, contentType, pathname }), own);
  if (status >= 400) merged["Cache-Control"] = "no-store";
  if (preview) merged["X-Robots-Tag"] = "noindex, nofollow";
  const headers = new Headers();
  for (const [name, value] of Object.entries(merged)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, value);
    }
  }
  return headers;
}

/**
 * The single responder — edge headers, then the Response. HEAD responses
 * carry headers only; 204/304 carry no body. Gzip is the edge's job (the
 * manual gzip the Node harness applies has no Worker equivalent).
 */
function respond(
  pathname: string,
  status: number,
  own: Record<string, string | string[]>,
  body: BodyInit | Uint8Array<ArrayBufferLike> | null,
  opts: { method: string; preview: boolean },
): Response {
  const headers = edged(pathname, status, own, opts.preview);
  const empty = opts.method === "HEAD" || status === 204 || status === 304;
  // Any Uint8Array is a valid body at runtime; the DOM type only names
  // the ArrayBuffer-backed one, hence the single documented cast here.
  return new Response(empty ? null : (body as BodyInit | null), { status, headers });
}

const jsonBody = (value: unknown): string => JSON.stringify(value);

function serviceFetchFor(apiBase: string): ServiceFetch {
  return async (path, init) => {
    const target = `${new URL(apiBase).origin}${path}`;
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
}

const ADMIN_ACTION_PATTERN = /^\/admin\/(?:sign-in\/(?:request|verify|sign-out)|review\/decide|(sellers|varieties|listings|accounts)\/actions)$/;

/**
 * One request through the Worker's routing table — the serve.ts
 * composition in the same mount order, over web-standard Request/Response.
 */
export async function handleWorkerRequest(request: Request, deps: WorkerDeps): Promise<Response> {
  const { apiBase, cache, edge, preview } = deps;
  const secret = deps.revalidateSecret;
  const errorSinkUrl = deps.errorSinkUrl;
  const siteKey = deps.siteKey;
  const method = request.method;
  const socketIp = request.headers.get("cf-connecting-ip");
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (method === "POST" && pathname === "/internal/revalidate") {
      if (!secret) {
        return respond(pathname, 500, { "Content-Type": "application/json" }, jsonBody({ error: "revalidate not configured: set SEEDS_REVALIDATE_SECRET" }), { method, preview });
      }
      // Invalid JSON propagates to the catastrophic catch, like the Node
      // harness (whose readJsonBody throws outside its mount try-block).
      const revalidateText = await request.text();
      const revalidateBody: unknown = revalidateText.length > 0 ? (JSON.parse(revalidateText) as unknown) : null;
      try {
        // Capture related-entity paths BEFORE the data purge deletes the
        // entries that register them (a seller tag drops the variety
        // pages behind its listings even though the tag names only its
        // own — relatedPaths after invalidate would see an empty cache).
        let related: string[] = [];
        const result = await handleRevalidateHttpRequest(
          { authorization: request.headers.get("authorization"), body: revalidateBody },
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
        return respond(pathname, 200, { "Content-Type": "application/json" }, jsonBody(result), { method, preview });
      } catch (error) {
        const auth = error instanceof Error && error.name === "RevalidateAuthError";
        const validation = error instanceof Error && error.name === "RevalidateValidationError";
        return respond(
          pathname,
          auth ? 401 : validation ? 400 : 500,
          { "Content-Type": "application/json" },
          jsonBody({ error: error instanceof Error ? error.message : "revalidate failed" }),
          { method, preview },
        );
      }
    }

    if (method === "POST" && (pathname === "/report" || pathname === "/add-your-farm")) {
      // The SSR floor POSTs: form-encoded fields map to backend JSON
      // through the shared chassis builders (identical payloads to the
      // enhanced path by construction), post to the unchanged backend,
      // and the page re-renders with the outcome — the success state,
      // or the plain-language errors with the typed values preserved.
      // Always 200: a rejection is a re-render, never an error status.
      const fields = parseFormBody(await request.text(), request.headers.get("content-type"));
      const isReport = pathname === "/report";
      const payload = isReport ? reportJsonFromForm(fields) : farmJsonFromForm(fields);
      let status: number;
      let json: { code?: string; detail?: string };
      try {
        const r = await postBackendJson(apiBase, isReport ? "/api/v1/reports" : "/api/v1/farm-submissions", payload, {
          forwardedFor: socketIp ?? undefined,
        });
        status = r.status;
        json = r.json;
      } catch {
        status = 500;
        json = { code: "error", detail: "backend unreachable" };
      }
      const result = backendResultOf(status, json);
      const formOutcome = isReport ? reportFloorOutcome(result, reportValuesFromSubmission(payload)) : farmFloorOutcome(result, farmValuesFromSubmission(payload));
      const floorRender = await deps.renderVike({
        urlOriginal: `${url.pathname}${url.search}`,
        catalogApi: deps.api,
        dataCache: cache,
        formOutcome,
        turnstileSiteKey: siteKey,
        adminApiBase: new URL(apiBase).origin,
        requestCookie: request.headers.get("cookie"),
      });
      const floorOwn: Record<string, string> = Object.fromEntries(floorRender.headers);
      if (!floorOwn["content-type"] && !floorOwn["Content-Type"]) floorOwn["content-type"] = "text/html; charset=utf-8";
      return respond(pathname, floorRender.statusCode, floorOwn, floorRender.body, { method, preview });
    }

    const go = /^\/go\/([^/]+)$/.exec(pathname);
    if (go && method === "GET") {
      // GET /go/[id]: numeric ids relay the backend's handler (anything
      // else 404s without a backend call — v2's route rule), the
      // retired utm_source is renamed on relay (Bea m-3), and the
      // backend's 404/410 pass through (removed seller stays 410, v2 +
      // Bea §1.7). Always no-store.
      const id = go[1]!;
      if (!isGoId(id)) {
        return respond(pathname, 404, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Listing not found", { method, preview });
      }
      let out;
      try {
        out = await relayHttp(apiBase, {
          method: "GET",
          path: pathname,
          query: url.search,
          headers: request.headers,
          body: null,
          socketIp,
        });
      } catch {
        return respond(pathname, 502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Bad Gateway", { method, preview });
      }
      const mapped = mapGoStatus(out.status);
      if (mapped === 302 && typeof out.headers.location === "string" && out.headers.location) {
        return respond(pathname, 302, { ...GO_NO_STORE, "Referrer-Policy": "origin", Location: rewriteGoLocation(out.headers.location) }, null, { method, preview });
      }
      if (mapped === 404 || mapped === 410) {
        return respond(pathname, mapped, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, out.body, { method, preview });
      }
      return respond(pathname, 502, { ...GO_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Bad Gateway", { method, preview });
    }

    // The admin handlers (sign-in, decide, section actions). Native form
    // posts 303 back with the status wording; the SPA's JSON posts get
    // v2's sheet-JSON vocabulary. Every write purges the data cache +
    // edge for the service's revalidate paths (v2's revalidatePath on
    // the same funnel).
    const adminAction = ADMIN_ACTION_PATTERN.exec(pathname);
    if (adminAction && method === "POST") {
      const origin = request.headers.get("origin");
      if (origin !== null && origin !== url.origin) {
        return respond(pathname, 403, { ...ADMIN_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Forbidden", { method, preview });
      }
      const rawText = textDecoder.decode(new Uint8Array(await request.arrayBuffer()));
      const contentType = request.headers.get("content-type");
      let raw: Record<string, unknown> = {};
      if (contentType?.includes("application/json")) {
        try {
          const parsed: unknown = JSON.parse(rawText || "{}") as unknown;
          if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
        } catch {
          raw = {};
        }
      } else {
        raw = parseFormBody(rawText, contentType);
      }
      const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
      const cookieHeader = request.headers.get("cookie");
      const serviceFetch = serviceFetchFor(apiBase);
      let result: HandlerResult;
      try {
        if (pathname === "/admin/sign-in/request") result = await handleSignInRequest(serviceFetch, { raw, wantsJson });
        else if (pathname === "/admin/sign-in/verify") result = await handleSignInVerify(serviceFetch, { raw, wantsJson });
        else if (pathname === "/admin/sign-in/sign-out") result = await handleSignOut(serviceFetch, cookieHeader ?? undefined);
        else if (pathname === "/admin/review/decide") result = await handleDecide(serviceFetch, { raw, wantsJson, cookie: cookieHeader ?? undefined });
        else result = await handleSectionActions(serviceFetch, adminAction[1] as AdminSection, { raw, wantsJson, cookie: cookieHeader ?? undefined });
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
        return respond(
          pathname,
          303,
          { ...ADMIN_NO_STORE, Location: result.location, ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) },
          null,
          { method, preview },
        );
      }
      if (result.kind === "json") {
        return respond(
          pathname,
          result.status,
          { ...ADMIN_NO_STORE, "Content-Type": "application/json; charset=utf-8", ...(result.setCookie ? { "Set-Cookie": result.setCookie } : {}) },
          jsonBody(result.body),
          { method, preview },
        );
      }
      return respond(pathname, result.status, { ...ADMIN_NO_STORE, "Content-Type": "text/html; charset=utf-8" }, result.body, { method, preview });
    }

    // The admin page gate (GET/HEAD). Vike's abort only speaks 301/302
    // while the admin gate is 303 throughout (v2 parity), so the entry
    // enforces it before renderPage: every /admin/* surface refuses
    // signed-out (sign-in + return path, expired → the A3 welcome-back)
    // and unauthorized (no-access).
    if ((method === "GET" || method === "HEAD") && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      const isActionPath = ADMIN_ACTION_PATTERN.test(pathname);
      if (!isActionPath) {
        const cookieHeader = request.headers.get("cookie");
        const gateFetch = serviceFetchFor(apiBase);
        let me;
        try {
          me = await fetchMe(gateFetch, cookieHeader ?? undefined);
        } catch {
          me = { signedIn: false as const, user: null, expired: false as const, email: null };
        }
        if (pathname === "/admin/sign-in") {
          const next = safeAdminNext(url.searchParams.get("next")) ?? "/admin";
          const gate = gateSignIn(me, next);
          if (gate.kind === "redirect") {
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location }, null, { method, preview });
          }
        } else if (pathname === "/admin/sign-in/code") {
          const next = safeAdminNext(url.searchParams.get("next")) ?? "/admin";
          const gate = gateSignIn(me, next);
          if (gate.kind === "redirect") {
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location }, null, { method, preview });
          }
          if (!url.searchParams.get("email")) {
            const to = next === "/admin" ? "/admin/sign-in" : `/admin/sign-in?next=${encodeURIComponent(next)}`;
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: to }, null, { method, preview });
          }
        } else if (pathname === "/admin/no-access") {
          const gate = gateNoAccess(me, url.searchParams.get("email"), url.searchParams.get("name"));
          if (gate.kind === "redirect") {
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location }, null, { method, preview });
          }
        } else if (pathname === "/admin/waitlist") {
          // Retired in v2 Slice D: a true 404 for privileged sessions
          // (the gate still refuses signed-out + unauthorized first).
          const gate = gateProtected(me, `${url.pathname}${url.search}`);
          if (gate.kind === "redirect") {
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location }, null, { method, preview });
          }
          return respond(pathname, 404, { ...ADMIN_NO_STORE, "Content-Type": "text/plain; charset=utf-8" }, "Not found", { method, preview });
        } else {
          const gate = gateProtected(me, `${url.pathname}${url.search}`);
          if (gate.kind === "redirect") {
            return respond(pathname, 303, { ...ADMIN_NO_STORE, Location: gate.location }, null, { method, preview });
          }
        }
      }
    }

    // The variety-status mount (the one Phase B mount the preview
    // carries): the merged-variety lookup from D1, SELECT only, answering
    // exactly the contract the app + stub pin. Always 200: it is a
    // lookup, not a fetch. A D1 failure answers a fail-closed 500 JSON
    // (never a degraded unknown — that would 404 merged slugs instead
    // of redirecting them).
    const varietyStatus = /^\/api\/internal\/variety-status\/([^/]+)$/.exec(pathname);
    if (varietyStatus && (method === "GET" || method === "HEAD")) {
      try {
        const result = await varietyStatusForSlug(deps.db, varietyStatus[1]!);
        return respond(pathname, 200, { "Content-Type": "application/json; charset=utf-8" }, jsonBody(result), { method, preview });
      } catch {
        return respond(pathname, 500, { "Content-Type": "application/json; charset=utf-8" }, jsonBody({ error: "variety status unavailable" }), {
          method,
          preview,
        });
      }
    }

    if (pathname === "/api/internal/admin" || pathname.startsWith("/api/internal/admin/")) {
      // The admin service reads (session + role enforced by the service
      // from the forwarded cookie): relayed verbatim, like /api/v1.
      const raw = new Uint8Array(await request.arrayBuffer());
      let out;
      try {
        out = await relayHttp(apiBase, {
          method,
          path: pathname,
          query: url.search,
          headers: request.headers,
          body: raw.length > 0 ? raw : null,
          socketIp,
        });
      } catch {
        return respond(pathname, 502, { "Content-Type": "application/json" }, jsonBody({ error: "backend unreachable" }), { method, preview });
      }
      // Relayed verbatim (the backend owns bytes AND encoding — no gzip
      // here), with the edge set merged under for the robots tag + base.
      return respond(pathname, out.status, out.headers, out.body, { method, preview });
    }

    if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
      // The backend-owned paths (form/account reads and writes, the
      // 303-only no-JS form endpoints): reverse-proxied to the API
      // origin with status, headers, and bytes relayed verbatim —
      // notably the 303 Locations with their Ruling 9 fragments and
      // the session Set-Cookie.
      const raw = new Uint8Array(await request.arrayBuffer());
      let out;
      try {
        out = await relayHttp(apiBase, {
          method,
          path: pathname,
          query: url.search,
          headers: request.headers,
          body: raw.length > 0 ? raw : null,
          socketIp,
        });
      } catch {
        return respond(pathname, 502, { "Content-Type": "application/json" }, jsonBody({ error: "backend unreachable" }), { method, preview });
      }
      // Relayed verbatim (the backend owns bytes AND encoding), edge set merged under.
      return respond(pathname, out.status, out.headers, out.body, { method, preview });
    }

    // The uptime hook. 200 + {"ok":true}, never cached, never indexed.
    if (pathname === "/healthz" && (method === "GET" || method === "HEAD")) {
      return respond(pathname, 200, { "Content-Type": "application/json; charset=utf-8" }, '{"ok":true}', { method, preview });
    }

    // POST /api/track, ported from v2/app/api/track/route.ts — the
    // internal view/click beacon. Always 204 (a beacon can never affect
    // navigation; measurement never fails loudly); anything but POST is
    // 405. This entry records nothing (the preview carries no click
    // service); the production Worker validates the same shapes and
    // writes to the click service (Slice 9 mount behavior, same wire
    // contract).
    if (pathname === "/api/track") {
      if (method !== "POST") {
        return respond(pathname, 405, { Allow: "POST", "X-Robots-Tag": "noindex" }, null, { method, preview });
      }
      const raw = new Uint8Array(await request.arrayBuffer());
      if (raw.length <= 4096) {
        try {
          JSON.parse(textDecoder.decode(raw)) as unknown;
        } catch {
          // Unparseable bodies 204 like everything else.
        }
      }
      return respond(pathname, 204, { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" }, null, { method, preview });
    }

    // POST /api/client-errors — the client ErrorReporter's same-origin
    // relay. The payload is redacted and forwarded to the configured
    // sink; the response is always 204 (a beacon, like /api/track).
    // Anything but POST is 405.
    if (pathname === "/api/client-errors") {
      if (method !== "POST") {
        return respond(pathname, 405, { Allow: "POST", "X-Robots-Tag": "noindex" }, null, { method, preview });
      }
      const raw = new Uint8Array(await request.arrayBuffer());
      if (errorSinkUrl && raw.length > 0 && raw.length <= 8192) {
        try {
          const payload = JSON.parse(textDecoder.decode(raw)) as { name?: unknown; message?: unknown; stack?: unknown; url?: unknown; extra?: unknown };
          const report = buildErrorReport(
            {
              name: typeof payload.name === "string" ? payload.name : "Error",
              message: typeof payload.message === "string" ? payload.message : "",
              stack: typeof payload.stack === "string" ? payload.stack : undefined,
            },
            {
              url: typeof payload.url === "string" ? payload.url : "/",
              userAgent: request.headers.get("user-agent") ?? undefined,
              extra: payload.extra,
            },
          );
          await postErrorReport(errorSinkUrl, report);
        } catch {
          // Monitoring must not break serving: fall through to the 204.
        }
      }
      return respond(pathname, 204, { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" }, null, { method, preview });
    }

    const og = /^\/og\/([^/]+)\/([^/]+)$/.exec(pathname);
    if (og && (method === "GET" || method === "HEAD")) {
      const result = await deps.renderOg(og[1]!, og[2]!);
      if (result.status === 404 || !result.body) {
        return respond(pathname, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found", { method, preview });
      }
      return respond(pathname, 200, result.headers, result.body, { method, preview });
    }

    // The preview shield's robots.txt: a disallow-all body when the flag
    // is set. Unset, the request falls through to Static Assets —
    // exactly the production bytes.
    if (preview && pathname === "/robots.txt" && (method === "GET" || method === "HEAD")) {
      return respond(pathname, 200, { "Content-Type": "text/plain; charset=utf-8" }, PREVIEW_ROBOTS_TXT, { method, preview });
    }

    if (method === "GET" || method === "HEAD") {
      const asset = await deps.assets.fetch(request);
      if (asset.status !== 404) {
        const own: Record<string, string> = {};
        asset.headers.forEach((value, name) => {
          own[name] = value;
        });
        return respond(pathname, asset.status, own, asset.body, { method, preview });
      }
      // Not a static file — fall through to the renderer.
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
      method === "GET" && !floorBypass && !isPageContextJsonPath(pathname) && (pathname.startsWith("/variety/") || DETAIL_PATTERN.test(pathname));
    const key = cacheable ? (pathname.startsWith("/variety/") ? edgeKey(pathname, url.search) : detailKey(pathname, url.search)) : null;
    const hit = key ? edge.get(key) : undefined;
    if (key && hit) {
      // Stored raw; re-edged per request (the merge is idempotent).
      return respond(key.split("?")[0]!, hit.status, Object.fromEntries(hit.headers), hit.body, { method, preview });
    }

    const pageContext = await deps.renderVike({
      urlOriginal: `${url.pathname}${url.search}`,
      catalogApi: deps.api,
      dataCache: cache,
      turnstileSiteKey: siteKey,
      adminApiBase: new URL(apiBase).origin,
      requestCookie: request.headers.get("cookie"),
    });
    // Server 5xx capture — a Vike error render reports its redacted
    // failure to the sink (when configured) before serving.
    if (pageContext.statusCode >= 500 && errorSinkUrl) {
      const failure = pageContext.errorWhileRendering;
      const message = failure instanceof Error ? `${failure.name}: ${failure.message}` : `render failed with status ${pageContext.statusCode}`;
      await postErrorReport(
        errorSinkUrl,
        buildErrorReport(
          { name: "RenderError", message, stack: failure instanceof Error ? failure.stack : undefined },
          { url: pathname, userAgent: request.headers.get("user-agent") ?? undefined },
        ),
      );
    }
    let body = pageContext.body;
    const headers = new Headers(pageContext.headers);
    if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
    if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pageContext.statusCode === 200 && (headers.get("content-type") ?? "").includes("text/html")) {
      body = scrubAdminFalsePositives(body);
    }
    const headerList = [...headers.entries()] as [string, string][];
    if (key && pageContext.statusCode === 200) {
      edge.set(key, { status: 200, headers: headerList, body });
    }
    return respond(pathname, pageContext.statusCode, Object.fromEntries(headerList), body, { method, preview });
  } catch (error) {
    // Catastrophic (renderPage itself threw — past Vike's _error page):
    // report the redacted failure, then serve the app's own 500 page.
    console.error("worker: render failed", error);
    try {
      const url = new URL(request.url);
      if (errorSinkUrl) {
        await postErrorReport(
          errorSinkUrl,
          buildErrorReport(
            {
              name: "RenderError",
              message: error instanceof Error ? `${error.name}: ${error.message}` : "render failed",
              stack: error instanceof Error ? error.stack : undefined,
            },
            { url: url.pathname, userAgent: request.headers.get("user-agent") ?? undefined },
          ),
        );
      }
      return respond(url.pathname, 500, { "Content-Type": "text/html; charset=utf-8" }, own500Html(), { method, preview });
    } catch {
      return new Response("Internal Server Error", { status: 500, headers: { "Content-Type": "text/plain" } });
    }
  }
}
