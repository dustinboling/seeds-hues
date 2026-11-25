/**
 * Slice 8 header suite (unit): the route-class header sets
 * (src/server/headers.ts) — v2's header set ported verbatim (next.config.ts,
 * measured) plus the Slice 8 hardening additions (HSTS, per-class CSP with
 * the Turnstile/analytics/CDN allowlists, stricter admin/API), asserted per
 * route class. The build suite proves the same bytes over the wire.
 */
import { describe, expect, it } from "vitest";
import {
  HSTS_VALUE,
  contentSecurityPolicy,
  headersFor,
  mergeHeaders,
  routeClassFor,
  shouldCompress,
  type RouteClass,
} from "../../src/server/headers";

const ALL_CLASSES: RouteClass[] = [
  "public-ssr",
  "prerendered",
  "spa-shell",
  "admin",
  "handler",
  "api",
  "machine-file",
  "static-asset",
  "service-worker",
  "internal",
];

describe("routeClassFor", () => {
  it.each([
    ["/variety/sweet-pea-kings-ransom", "public-ssr"],
    ["/variety", "public-ssr"],
    ["/seller/blue-ridge-seeds", "public-ssr"],
    ["/seller", "public-ssr"],
    ["/crop/sunflower", "public-ssr"],
    ["/series/sunbeam", "public-ssr"],
    ["/state/oregon", "public-ssr"],
    ["/search", "public-ssr"],
  ])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([
    ["/", "prerendered"],
    ["/crop", "prerendered"],
    ["/about", "prerendered"],
    ["/about/data", "prerendered"],
    ["/about/bot", "prerendered"],
    ["/api-docs", "prerendered"],
    ["/privacy", "prerendered"],
    ["/terms", "prerendered"],
    ["/offline", "prerendered"],
  ])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([
    ["/account", "spa-shell"],
    ["/unsubscribe", "spa-shell"],
    ["/report", "spa-shell"],
    ["/add-your-farm", "spa-shell"],
  ])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([["/admin", "admin"], ["/admin/review", "admin"], ["/admin/sign-in", "admin"]])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([
    ["/go/1", "handler"],
    ["/og/variety/sweet-pea-kings-ransom", "handler"],
    ["/og/site/default", "handler"],
    ["/api/track", "handler"],
    ["/api/client-errors", "handler"],
  ])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([["/api/v1/crops", "api"], ["/api/internal/admin/sellers", "api"]])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it.each([
    ["/robots.txt", "machine-file"],
    ["/sitemap.xml", "machine-file"],
    ["/sitemap-varieties-listed.xml", "machine-file"],
    ["/llms.txt", "machine-file"],
  ])("%s → %s", (path, expected) => {
    expect(routeClassFor(path)).toBe(expected);
  });

  it("classifies the service worker, static assets, health, and internal paths", () => {
    expect(routeClassFor("/sw.js")).toBe("service-worker");
    expect(routeClassFor("/assets/index-abc123.js")).toBe("static-asset");
    expect(routeClassFor("/icons/hues-icon-512.png")).toBe("static-asset");
    expect(routeClassFor("/manifest.webmanifest")).toBe("static-asset");
    expect(routeClassFor("/healthz")).toBe("handler");
    expect(routeClassFor("/internal/revalidate")).toBe("internal");
  });
});

describe("v2 base set, ported verbatim to every class", () => {
  it.each(ALL_CLASSES)("X-Content-Type-Options: nosniff on %s", (routeClass) => {
    expect(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" })["X-Content-Type-Options"]).toBe(
      "nosniff",
    );
  });

  it.each(ALL_CLASSES)("Referrer-Policy verbatim on %s", (routeClass) => {
    expect(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" })["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it.each(ALL_CLASSES)("Permissions-Policy verbatim on %s", (routeClass) => {
    expect(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" })["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    );
  });

  it("HSTS rides every class (the Slice 8 addition — v2 ships none; no preload)", () => {
    expect(HSTS_VALUE).toBe("max-age=31536000; includeSubDomains");
    for (const routeClass of ALL_CLASSES) {
      expect(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" })["Strict-Transport-Security"]).toBe(
        HSTS_VALUE,
      );
    }
  });
});

describe("Content-Security-Policy per class", () => {
  it("every document class carries v2's three directives verbatim", () => {
    for (const routeClass of ["public-ssr", "prerendered", "spa-shell", "admin"] as const) {
      const csp = contentSecurityPolicy(routeClass);
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("object-src 'none'");
    }
  });

  it("public classes allowlist Turnstile, the analytics beacon, and the image CDN", () => {
    for (const routeClass of ["public-ssr", "prerendered", "spa-shell"] as const) {
      const csp = contentSecurityPolicy(routeClass);
      expect(csp).toContain("https://challenges.cloudflare.com");
      expect(csp).toContain("https://static.cloudflareinsights.com");
      expect(csp).toContain("https://images.seeds.hues.flowers");
      // The app's own scripts (Vike inline payloads) and styles keep working.
      expect(csp).toMatch(/script-src[^;]*'self'[^;]*'unsafe-inline'/);
      expect(csp).toMatch(/style-src[^;]*'self'[^;]*'unsafe-inline'/);
    }
  });

  it("admin carries the stricter posture: no third-party script, connect, or frame source", () => {
    const csp = contentSecurityPolicy("admin");
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).not.toContain("static.cloudflareinsights.com");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("https://images.seeds.hues.flowers");
  });

  it("api/handler/internal responses carry the tight non-document policy", () => {
    for (const routeClass of ["api", "handler", "internal"] as const) {
      const csp = contentSecurityPolicy(routeClass);
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
    }
  });
});

describe("Cache-Control per class", () => {
  it("public SSR 200s carry the §9 edge-cache posture exactly", () => {
    expect(headersFor("public-ssr", { status: 200, contentType: "text/html; charset=utf-8" })["Cache-Control"]).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  });

  it("prerendered documents carry the same posture (they regenerate on invalidation)", () => {
    expect(headersFor("prerendered", { status: 200, contentType: "text/html; charset=utf-8" })["Cache-Control"]).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  });

  it.each(["spa-shell", "admin", "internal"] as const)("%s 200s are no-store (per-user, per-token, per-session)", (routeClass) => {
    expect(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" })["Cache-Control"]).toBe("no-store");
  });

  it("errors are no-store on every cacheable class", () => {
    for (const routeClass of ["public-ssr", "prerendered", "spa-shell", "admin"] as const) {
      for (const status of [404, 410, 500]) {
        expect(headersFor(routeClass, { status, contentType: "text/html; charset=utf-8" })["Cache-Control"]).toBe("no-store");
      }
    }
  });

  it("permanent redirects cache an hour; temporary redirects never store", () => {
    expect(headersFor("public-ssr", { status: 301, contentType: null })["Cache-Control"]).toBe("public, max-age=3600");
    expect(headersFor("handler", { status: 302, contentType: null })["Cache-Control"]).toBe("no-store");
    expect(headersFor("admin", { status: 303, contentType: null })["Cache-Control"]).toBe("no-store");
  });

  it("machine files port the live cache lifetimes (robots/sitemap revalidate, llms.txt an hour)", () => {
    expect(headersFor("machine-file", { status: 200, contentType: "text/plain", pathname: "/robots.txt" })["Cache-Control"]).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(
      headersFor("machine-file", { status: 200, contentType: "application/xml", pathname: "/sitemap.xml" })["Cache-Control"],
    ).toBe("public, max-age=0, must-revalidate");
    expect(headersFor("machine-file", { status: 200, contentType: "text/markdown", pathname: "/llms.txt" })["Cache-Control"]).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
  });

  it("the service worker carries v2's no-cache pair plus Service-Worker-Allowed", () => {
    const headers = headersFor("service-worker", { status: 200, contentType: "text/javascript" });
    expect(headers["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
    expect(headers["Service-Worker-Allowed"]).toBe("/");
  });

  it("hashed assets are immutable; unhashed static revalidates hourly", () => {
    expect(
      headersFor("static-asset", { status: 200, contentType: "text/javascript", pathname: "/assets/index-abc123.js" })[
        "Cache-Control"
      ],
    ).toBe("public, max-age=31536000, immutable");
    expect(
      headersFor("static-asset", { status: 200, contentType: "application/manifest+json", pathname: "/manifest.webmanifest" })[
        "Cache-Control"
      ],
    ).toBe("public, max-age=3600, stale-while-revalidate=86400");
  });
});

describe("X-Robots-Tag", () => {
  it("api responses are noindex, /go noindex-nofollow (v2 verbatim)", () => {
    expect(headersFor("api", { status: 200, contentType: "application/json" })["X-Robots-Tag"]).toBe("noindex");
    expect(headersFor("handler", { status: 302, contentType: null, pathname: "/go/1" })["X-Robots-Tag"]).toBe("noindex, nofollow");
  });

  it("admin HTML carries noindex (Bea §6.5); public documents carry no header", () => {
    expect(headersFor("admin", { status: 200, contentType: "text/html; charset=utf-8" })["X-Robots-Tag"]).toBe("noindex");
    expect(headersFor("public-ssr", { status: 200, contentType: "text/html; charset=utf-8" })["X-Robots-Tag"]).toBeUndefined();
    expect(headersFor("prerendered", { status: 200, contentType: "text/html; charset=utf-8" })["X-Robots-Tag"]).toBeUndefined();
  });
});

describe("mergeHeaders + shouldCompress", () => {
  it("merges case-insensitively with the override winning", () => {
    expect(mergeHeaders({ "X-Robots-Tag": "noindex", "Cache-Control": "no-store" }, { "cache-control": "public, max-age=60" })).toEqual(
      { "X-Robots-Tag": "noindex", "Cache-Control": "public, max-age=60" },
    );
  });

  it("compresses textual GET/HEAD responses only", () => {
    expect(shouldCompress("text/html; charset=utf-8", "GET")).toBe(true);
    expect(shouldCompress("text/css; charset=utf-8", "HEAD")).toBe(true);
    expect(shouldCompress("application/json; charset=utf-8", "GET")).toBe(true);
    expect(shouldCompress("image/png", "GET")).toBe(false);
    expect(shouldCompress("font/woff2", "GET")).toBe(false);
    expect(shouldCompress("text/html; charset=utf-8", "POST")).toBe(false);
    expect(shouldCompress(null, "GET")).toBe(false);
  });
});

describe("no-price guard over the header sets", () => {
  it("no header value on any class carries a price-shaped string", () => {
    for (const routeClass of ALL_CLASSES) {
      const blob = JSON.stringify(headersFor(routeClass, { status: 200, contentType: "text/html; charset=utf-8" }));
      expect(blob).not.toMatch(/\$\d/);
      expect(blob.toLowerCase()).not.toContain("price");
    }
  });
});
