/**
 * Lastmod cache refresh (the `npm run gen:sitemap-lastmod` core). Pure logic
 * over the API client + live snapshot: a cached entry survives only while
 * its seq equals the live row's seq; new/changed variety/seller rows refresh
 * from their detail endpoints; series rows have no public updatedAt read
 * path, so a series entry that no longer verifies is dropped (its URL omits
 * lastmod — honest per Bea §8.2 rule 3) until a new verified date exists.
 */
import type { CatalogApi } from "./api";
import type { LastmodCache, LastmodEntry, SyncSnapshotData } from "./types";

export interface LastmodRefreshReport {
  cache: LastmodCache;
  kept: number;
  refreshed: number;
  droppedSeries: string[];
}

export async function refreshLastmodCache(
  api: Pick<CatalogApi, "varietyUpdatedAt" | "sellerUpdatedAt">,
  snapshot: SyncSnapshotData,
  previous: LastmodCache,
): Promise<LastmodRefreshReport> {
  const kept = (table: Record<string, LastmodEntry>, slug: string, liveSeq: number): LastmodEntry | null => {
    const entry = table[slug];
    return entry && entry.updated_seq === liveSeq && entry.updated_at ? entry : null;
  };

  let keptCount = 0;
  let refreshedCount = 0;
  const varieties: Record<string, LastmodEntry> = {};
  for (const v of snapshot.varieties) {
    if (!v.indexable) continue;
    const hit = kept(previous.varieties, v.slug, v.updated_seq);
    if (hit) {
      varieties[v.slug] = hit;
      keptCount++;
    } else {
      varieties[v.slug] = { updated_at: await api.varietyUpdatedAt(v.slug), updated_seq: v.updated_seq };
      refreshedCount++;
    }
  }
  const sellers: Record<string, LastmodEntry> = {};
  for (const s of snapshot.sellers) {
    const hit = kept(previous.sellers, s.slug, s.updated_seq);
    if (hit) {
      sellers[s.slug] = hit;
      keptCount++;
    } else {
      sellers[s.slug] = { updated_at: await api.sellerUpdatedAt(s.slug), updated_seq: s.updated_seq };
      refreshedCount++;
    }
  }
  const series: Record<string, LastmodEntry> = {};
  const droppedSeries: string[] = [];
  for (const s of snapshot.series) {
    const hit = kept(previous.series, s.slug, s.updated_seq);
    if (hit) {
      series[s.slug] = hit;
      keptCount++;
    } else {
      droppedSeries.push(s.slug);
    }
  }
  return {
    cache: { generated_at: new Date().toISOString(), catalog_seq: snapshot.catalog_seq, varieties, sellers, series },
    kept: keptCount,
    refreshed: refreshedCount,
    droppedSeries: droppedSeries.sort(),
  };
}
