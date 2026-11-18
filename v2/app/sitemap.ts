import type { MetadataRoute } from "next";
import { getServices } from "@/lib/services/context";
import { SITE_URL } from "@/lib/config";
import { totalPages } from "@/lib/paging";

export const dynamic = "force-dynamic";

/**
 * DB-generated sitemap (S5; delta R3): singular URLs; every indexable variety (owner ruling
 * 2026-11-16: all active varieties, sellers or not); approved sellers only; no <priority> or
 * <changefreq>. lastModified only where a real date exists. Single file in Phase 1; switch to
 * generateSitemaps() chunks before 50,000 URLs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { catalog } = await getServices();
  const [e, counts] = await Promise.all([catalog.sitemapEntries(), catalog.counts()]);
  const url = (p: string) => (p === "/" ? SITE_URL : `${SITE_URL}${p}`);
  const paged = (base: string, total: number) =>
    Array.from({ length: totalPages(total) }, (_, i) => ({ url: url(i === 0 ? base : `${base}?page=${i + 1}`) }));

  return [
    { url: url("/") },
    { url: url("/crop") },
    ...paged("/variety", counts.varieties),
    ...paged("/seller", counts.sellers),
    { url: url("/about") },
    { url: url("/about/data") },
    { url: url("/about/bot") },
    { url: url("/api-docs") },
    { url: url("/terms") },
    { url: url("/privacy") },
    ...e.crops.map((p) => ({ url: url(`/crop/${p.slug}`) })),
    ...e.series.map((s) => ({ url: url(`/series/${s.slug}`), lastModified: s.updatedAt })),
    ...e.varieties.map((v) => ({ url: url(`/variety/${v.slug}`), lastModified: v.updatedAt })),
    ...e.sellers.map((s) => ({ url: url(`/seller/${s.slug}`), lastModified: s.updatedAt })),
    // Live state pages only: states with ≥ 1 visible seller.
    ...e.states.map((st) => ({ url: url(`/state/${st.slug}`) })),
  ];
}
