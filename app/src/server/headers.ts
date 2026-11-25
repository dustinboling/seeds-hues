/**
 * Slice 8 edge-header suite: the per-route-class HTTP response headers.
 *
 * The base set ports v2's shipped headers verbatim (v2/next.config.ts
 * `securityHeaders`, measured live 2026-11-25 on /, /api/*, /go/*):
 * X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and the
 * three-directive CSP (frame-ancestors/base-uri/object-src). Slice 8
 * hardens on top, additively — nothing ported is weakened:
 * - HSTS on every class (v2 ships none; the site is https-only);
 * - per-class CSP: the document classes keep v2's three directives and
 *   gain allowlists for the origins the app needs (Turnstile, the
 *   Cloudflare Web Analytics beacon, the image CDN) without breaking
 *   Vike's inline payloads; admin drops the third-party sources; API
 *   and handler responses carry the tight non-document policy;
 * - Cache-Control per class (Bea §9 for cacheable documents, no-store
 *   for per-user/per-token surfaces and every error, the live machine-file
 *   lifetimes, immutable hashed assets, v2's /sw.js pair);
 * - X-Robots-Tag where v2 + Bea put it (API noindex, /go
 *   noindex-nofollow, admin HTML noindex per Bea §6.5).
 *
 * serve.ts is the single caller: it merges this edge set under the
 * response's own headers (Vike's per-route Cache-Control, the relayed
 * backend's headers) and forces no-store on error statuses. The
 * production Worker mirrors the same rows.
 */

export type RouteClass =
  | "public-ssr"
  | "prerendered"
  | "spa-shell"
  | "admin"
  | "handler"
  | "api"
  | "machine-file"
  | "static-asset"
  | "service-worker"
  | "internal";

/** v2's base set, verbatim (next.config.ts securityHeaders). */
const V2_BASE: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

/**
 * HSTS (Slice 8 addition — v2 ships none). No preload: the max-age +
 * includeSubDomains commitment is the conservative step; preload is a
 * one-way registry decision for Slice 9, not this slice.
 */
export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

const TURNSTILE = "https://challenges.cloudflare.com";
const ANALYTICS = "https://static.cloudflareinsights.com";
const IMAGE_CDN = "https://images.seeds.hues.flowers";

/**
 * The document CSP for the public classes: v2's three directives verbatim,
 * plus the origins the app needs. script-src keeps 'unsafe-inline' (Vike's
 * inline page payloads) while restricting external scripts to the two
 * third parties; style-src keeps 'unsafe-inline' (React inline styles).
 * No upgrade-insecure-requests: it would break the http://localhost lab
 * (Lighthouse CI) and local development.
 */
const PUBLIC_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `img-src 'self' data: ${IMAGE_CDN}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE} ${ANALYTICS}`,
  `connect-src 'self' ${TURNSTILE} ${ANALYTICS}`,
  `frame-src ${TURNSTILE}`,
  "form-action 'self'",
  "worker-src 'self'",
].join("; ");

/** The admin CSP: the document policy minus every third-party source. */
const ADMIN_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `img-src 'self' data: ${IMAGE_CDN}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-src 'none'",
  "form-action 'self'",
  "worker-src 'self'",
].join("; ");

/** The tight non-document policy (API, handlers, internal — never a page). */
const TIGHT_CSP = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

export function contentSecurityPolicy(routeClass: RouteClass): string {
  switch (routeClass) {
    case "admin":
      return ADMIN_CSP;
    case "api":
    case "handler":
    case "internal":
      return TIGHT_CSP;
    default:
      return PUBLIC_CSP;
  }
}

const PRERENDERED_PATHS = new Set(["/", "/crop", "/about", "/about/data", "/about/bot", "/api-docs", "/privacy", "/terms", "/offline"]);

/** The no-store document class (per-user, per-token, per-session, or form surfaces). */
const NO_STORE_PATHS = new Set(["/report", "/add-your-farm", "/account", "/unsubscribe"]);

/** Classify a request pathname into its header route class. */
export function routeClassFor(pathname: string): RouteClass {
  if (pathname === "/sw.js") return "service-worker";
  if (pathname === "/internal/revalidate" || pathname.startsWith("/internal/")) return "internal";
  if (pathname === "/healthz") return "handler";
  if (pathname === "/api/track" || pathname === "/api/client-errors") return "handler";
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) return "api";
  if (pathname === "/api/internal/admin" || pathname.startsWith("/api/internal/admin/")) return "api";
  if (pathname === "/api/internal" || pathname.startsWith("/api/internal/")) return "api";
  if (pathname === "/go" || pathname.startsWith("/go/")) return "handler";
  if (pathname === "/og" || pathname.startsWith("/og/")) return "handler";
  if (pathname === "/robots.txt" || pathname === "/llms.txt") return "machine-file";
  if (pathname === "/sitemap.xml" || (pathname.startsWith("/sitemap-") && pathname.endsWith(".xml"))) return "machine-file";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (NO_STORE_PATHS.has(pathname)) return "spa-shell";
  if (PRERENDERED_PATHS.has(pathname)) return "prerendered";
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico"
  ) {
    return "static-asset";
  }
  return "public-ssr";
}

export interface HeaderContext {
  status: number;
  /** The response content type (null when the response carries none, e.g. redirects). */
  contentType: string | null;
  /** The request pathname (refines machine-file, static-asset, and /go headers). */
  pathname?: string;
}

const EDGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * The edge header set for a response. Never sets Content-Type (the
 * responder owns it — Vike, the static file's extension, the relayed
 * backend). serve.ts merges this UNDER the response's own headers, then
 * forces no-store on error statuses.
 */
export function headersFor(routeClass: RouteClass, ctx: HeaderContext): Record<string, string> {
  const headers: Record<string, string> = {
    ...V2_BASE,
    "Strict-Transport-Security": HSTS_VALUE,
    "Content-Security-Policy": contentSecurityPolicy(routeClass),
  };

  // Cache-Control.
  if (ctx.status >= 400) {
    headers["Cache-Control"] = "no-store";
  } else if (ctx.status === 301) {
    headers["Cache-Control"] = "public, max-age=3600";
  } else if (ctx.status === 302 || ctx.status === 303 || ctx.status === 307) {
    headers["Cache-Control"] = "no-store";
  } else {
    switch (routeClass) {
      case "public-ssr":
      case "prerendered":
        headers["Cache-Control"] = EDGE_CACHE;
        break;
      case "spa-shell":
      case "admin":
      case "internal":
        headers["Cache-Control"] = "no-store";
        break;
      case "handler":
        // /go is no-store verbatim (v2's route rule); generated OG cards
        // are deterministic per URL and cache like documents; the beacons
        // (/api/track, /api/client-errors) and the uptime hook never store.
        if (ctx.pathname?.startsWith("/og/") === true) headers["Cache-Control"] = EDGE_CACHE;
        else headers["Cache-Control"] = "no-store";
        break;
      case "api":
        // The backend owns API cache lifetimes — the edge sets none, so
        // the merge can never clobber a relayed Cache-Control.
        break;
      case "machine-file":
        headers["Cache-Control"] =
          ctx.pathname === "/llms.txt" ? "public, max-age=3600, stale-while-revalidate=86400" : "public, max-age=0, must-revalidate";
        break;
      case "service-worker":
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        headers["Service-Worker-Allowed"] = "/";
        break;
      case "static-asset":
        headers["Cache-Control"] =
          ctx.pathname?.startsWith("/assets/") === true
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600, stale-while-revalidate=86400";
        break;
    }
  }

  // X-Robots-Tag: v2's /api + /go rules, plus Bea §6.5's admin-HTML rule.
  // /go's 404/410 answers keep the tag (v2's route rule, mirrored).
  if (routeClass === "api" || routeClass === "internal") {
    headers["X-Robots-Tag"] = "noindex";
  } else if (routeClass === "handler") {
    headers["X-Robots-Tag"] = ctx.pathname?.startsWith("/go/") === true ? "noindex, nofollow" : "noindex";
  } else if (routeClass === "admin") {
    headers["X-Robots-Tag"] = "noindex";
  }

  return headers;
}

/**
 * Merge two header maps with case-insensitive names; the override wins.
 * Used as mergeHeaders(edgeSet, responseSet) — the response's own
 * Cache-Control (Vike's per-route value, the backend's relayed value)
 * survives over the edge default.
 */
export function mergeHeaders(
  base: Record<string, string>,
  override: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const merged: Record<string, string | string[]> = { ...base };
  const lowerToKey = new Map<string, string>();
  for (const key of Object.keys(merged)) lowerToKey.set(key.toLowerCase(), key);
  for (const [key, value] of Object.entries(override)) {
    const existing = lowerToKey.get(key.toLowerCase());
    // The override's value wins but the base's canonical casing stands.
    merged[existing ?? key] = value;
    lowerToKey.set(key.toLowerCase(), existing ?? key);
  }
  return merged;
}

const COMPRESSIBLE = new Set([
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/json",
  "application/manifest+json",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/markdown",
  "image/svg+xml",
]);

/** Whether the response body is worth gzipping (textual GET/HEAD only). */
export function shouldCompress(contentType: string | null, method: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (!contentType) return false;
  const mime = contentType.split(";")[0]!.trim().toLowerCase();
  return COMPRESSIBLE.has(mime);
}
