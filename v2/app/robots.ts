import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Canonical §5 GEO: allow search and AI crawlers (be cited); disallow /go/ (click redirects),
 * /admin, the ingest + admin API paths, and the per-user account / alert endpoints (Phase 3). The public /api/ stays crawlable — its responses carry
 * `X-Robots-Tag: noindex` instead.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/go/", "/admin", "/api/v1/ingest/", "/api/v1/admin/", "/api/internal/", "/api/v1/internal/", "/api/v1/account", "/account", "/unsubscribe"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
