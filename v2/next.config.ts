import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  // Lets the OG route import its TTFs with `with { type: "bytes" }` so they are bundled into the
  // Worker (workerd has no filesystem for readFile/fetch of emitted assets).
  experimental: { turbopackImportTypeBytes: true },
  // R3: singular public URLs. permanent: true → 308.
  async redirects() {
    return [
      { source: "/varieties", destination: "/variety", permanent: true },
      { source: "/varieties/:slug", destination: "/variety/:slug", permanent: true },
      { source: "/sellers", destination: "/seller", permanent: true },
      { source: "/sellers/:slug", destination: "/seller/:slug", permanent: true },
      { source: "/plants", destination: "/crop", permanent: true },
      { source: "/plants/:slug", destination: "/crop/:slug", permanent: true },
      { source: "/categories", destination: "/crop", permanent: true },
      { source: "/categories/:slug", destination: "/crop", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // X10: every /api/* response is noindex (route helpers also set it).
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/go/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // The service worker must never be served stale (self-applying updates, spec §5 P6).
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Local `next dev` gets the Wrangler bindings (D1, R2, rate limiter) from .wrangler/state.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
