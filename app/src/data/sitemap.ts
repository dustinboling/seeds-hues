/**
 * Segmented sitemap machinery (Bea §8.2). /sitemap.xml becomes the index;
 * seven segment files carry the cohorts — the zero-seller varieties get
 * their own file by design (decision-27 measurement commitment).
 *
 * Rules (all binding, all tested):
 * - Only canonical, indexable URLs. No filtered URL, no noindex URL, no
 *   /go/, /og/, /api/, admin — and pagination URLs are OUT (crawlable via
 *   anchors, not sitemap-listed).
 * - lastmod = the record's real updated_at from D1, or omitted. A cached
 *   date emits only when its stored updated_seq still equals the live
 *   snapshot's seq for that row; anything else omits. Build-time stamping
 *   is prohibited.
 * - No priority, no changefreq. Membership sorts match the live generator
 *   (detail URLs by slug; states by name).
 *
 * Input is the same data layer as /crop and home (the API client): the live
 * bulk snapshot for membership/segmentation/seqs, the committed lastmod
 * cache for dates. Generation is pure — the build script and the future
 * request-time regeneration call the same function.
 */
import { stateByCode } from "../lib/states";
import type { LastmodCache, SyncSnapshotData } from "./types";

export const SITEMAP_FILENAMES = [
  "sitemap-varieties-listed.xml",
  "sitemap-varieties-zero-seller.xml",
  "sitemap-sellers.xml",
  "sitemap-crops.xml",
  "sitemap-series.xml",
  "sitemap-states.xml",
  "sitemap-hubs.xml",
] as const;

export type SitemapFilename = (typeof SITEMAP_FILENAMES)[number];

/**
 * Hub/static URLs (Bea §8.2's hubs table). /add-your-farm is indexable (§5.1)
 * and belongs here even though it is not in the live single-file sitemap —
 * the one deliberate +1 over the live URL set, recorded, not silent.
 */
export const HUB_PATHS = [
  "/",
  "/crop",
  "/variety",
  "/seller",
  "/about",
  "/about/data",
  "/about/bot",
  "/api-docs",
  "/terms",
  "/privacy",
  "/add-your-farm",
] as const;

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

export interface SitemapBuild {
  index: string;
  files: Record<SitemapFilename, string>;
  /** Machine-readable manifest for tests and the Slice 8 URL-by-URL diff. */
  manifest: Record<SitemapFilename, SitemapUrl[]> & { index: SitemapUrl[] };
}

const xmlEscape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function renderUrlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => (u.lastmod ? `<url>\n<loc>${xmlEscape(u.loc)}</loc>\n<lastmod>${xmlEscape(u.lastmod)}</lastmod>\n</url>` : `<url>\n<loc>${xmlEscape(u.loc)}</loc>\n</url>`))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderIndex(urls: SitemapUrl[]): string {
  const body = urls.map((u) => `<sitemap>\n<loc>${xmlEscape(u.loc)}</loc>\n</sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export interface SitemapInput {
  siteUrl: string;
  snapshot: SyncSnapshotData;
  lastmod: LastmodCache;
}

export function buildSitemap(input: SitemapInput): SitemapBuild {
  const { siteUrl, snapshot, lastmod } = input;
  const url = (p: string): string => (p === "/" ? siteUrl : `${siteUrl}${p}`);

  /** A cached date emits only while its seq still matches the live row. */
  const verifiedDate = (table: Record<string, { updated_at: string; updated_seq: number }>, slug: string, liveSeq: number): string | undefined => {
    const entry = table[slug];
    if (!entry || entry.updated_seq !== liveSeq || !entry.updated_at) return undefined;
    return entry.updated_at;
  };

  // Listed = ≥1 visible listing in the snapshot (the snapshot's listings are
  // visible-listing + active-variety only, same filter as the D1 sitemap rows).
  const listedVarietyIds = new Set(snapshot.listings.map((l) => l.variety_id));
  const indexableVarieties = snapshot.varieties.filter((v) => v.indexable).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const listedUrls: SitemapUrl[] = [];
  const zeroSellerUrls: SitemapUrl[] = [];
  for (const v of indexableVarieties) {
    const entry: SitemapUrl = { loc: url(`/variety/${v.slug}`) };
    const date = verifiedDate(lastmod.varieties, v.slug, v.updated_seq);
    if (date) entry.lastmod = date;
    (listedVarietyIds.has(v.id) ? listedUrls : zeroSellerUrls).push(entry);
  }

  const sellerUrls: SitemapUrl[] = snapshot.sellers
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((s) => {
      const entry: SitemapUrl = { loc: url(`/seller/${s.slug}`) };
      const date = verifiedDate(lastmod.sellers, s.slug, s.updated_seq);
      if (date) entry.lastmod = date;
      return entry;
    });

  const cropUrls: SitemapUrl[] = snapshot.crops
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((c) => ({ loc: url(`/crop/${c.slug}`) }));

  const seriesUrls: SitemapUrl[] = snapshot.series
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((s) => {
      const entry: SitemapUrl = { loc: url(`/series/${s.slug}`) };
      const date = verifiedDate(lastmod.series, s.slug, s.updated_seq);
      if (date) entry.lastmod = date;
      return entry;
    });

  // A state page exists iff it has a visible seller (Bea §0.2): distinct US
  // regions over the snapshot's visible sellers, by name — the catalog
  // service's sellerStates() rule, same order.
  const seenRegions = new Set<string>();
  for (const s of snapshot.sellers) {
    if (s.country === "US" && stateByCode(s.region)) seenRegions.add(s.region as string);
  }
  const stateUrls: SitemapUrl[] = [...seenRegions]
    .map((region) => stateByCode(region))
    .filter((st): st is NonNullable<typeof st> => st !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((st) => ({ loc: url(`/state/${st.slug}`) }));

  const hubUrls: SitemapUrl[] = HUB_PATHS.map((p) => ({ loc: url(p) }));

  const files: Record<SitemapFilename, SitemapUrl[]> = {
    "sitemap-varieties-listed.xml": listedUrls,
    "sitemap-varieties-zero-seller.xml": zeroSellerUrls,
    "sitemap-sellers.xml": sellerUrls,
    "sitemap-crops.xml": cropUrls,
    "sitemap-series.xml": seriesUrls,
    "sitemap-states.xml": stateUrls,
    "sitemap-hubs.xml": hubUrls,
  };
  const indexUrls: SitemapUrl[] = SITEMAP_FILENAMES.map((f) => ({ loc: url(`/${f}`) }));

  return {
    index: renderIndex(indexUrls),
    files: {
      "sitemap-varieties-listed.xml": renderUrlset(listedUrls),
      "sitemap-varieties-zero-seller.xml": renderUrlset(zeroSellerUrls),
      "sitemap-sellers.xml": renderUrlset(sellerUrls),
      "sitemap-crops.xml": renderUrlset(cropUrls),
      "sitemap-series.xml": renderUrlset(seriesUrls),
      "sitemap-states.xml": renderUrlset(stateUrls),
      "sitemap-hubs.xml": renderUrlset(hubUrls),
    },
    manifest: { ...files, index: indexUrls },
  };
}

/** Total sitemap URLs across segments (the ≈1,097 figure at current size). */
export function sitemapUrlCount(build: SitemapBuild): number {
  return SITEMAP_FILENAMES.reduce((n, f) => n + build.manifest[f].length, 0);
}
