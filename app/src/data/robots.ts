/**
 * robots.txt renderer. Posture preserved VERBATIM from the live site (open to
 * search + AI crawlers per the 5.1 ruling — the carried rules below are
 * v2/app/robots.ts's, byte-identical to the live file) plus the plan's Data
 * #1.5 parameter disallows:
 *
 * - sort: the ?sort= key (live on /variety; the in-place layer's ordering)
 * - page-size: the limit key (the API's page-size key — page URLs never
 *   carry it, but a hand-built one must never become crawlable)
 * - session: the session key (no page carries one today; the SPA's future
 *   session keys must never form crawlable URLs)
 *
 * Each pattern names its key specifically (Bea §8.3): no sitemap URL and no
 * canonical in §3–§5 contains one, so no canonical's crawling is blocked —
 * and crucially the patterns never match ?page=, the paginated canonicals'
 * only parameter. A build test diffs this output against the live file and
 * fails on anything but these three lines.
 */

export const CARRIED_DISALLOWS = [
  "/go/",
  "/admin",
  "/api/v1/ingest/",
  "/api/v1/admin/",
  "/api/internal/",
  "/api/v1/internal/",
  "/api/v1/account",
  "/account",
  "/unsubscribe",
] as const;

/** The plan Data #1.5 additions — the ONLY permitted diff vs the live file. */
export const PARAMETER_DISALLOWS = ["/*?*sort=*", "/*?*limit=*", "/*?*session=*"] as const;

export function renderRobotsTxt(siteUrl: string): string {
  const lines = [
    "User-Agent: *",
    "Allow: /",
    ...CARRIED_DISALLOWS.map((d) => `Disallow: ${d}`),
    ...PARAMETER_DISALLOWS.map((d) => `Disallow: ${d}`),
    "",
    `Host: ${siteUrl}`,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ];
  return lines.join("\n");
}
