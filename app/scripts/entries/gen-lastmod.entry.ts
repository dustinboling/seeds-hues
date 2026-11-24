/**
 * gen:sitemap-lastmod entry (bundled + run by scripts/gen-sitemap-lastmod.mjs):
 * refreshes the committed lastmod cache from the live API — kept entries
 * re-verify against the live snapshot's seqs (no fetch), new/changed
 * variety/seller rows refresh from their detail endpoints, unverifiable
 * series rows drop (their URLs omit lastmod, honest per Bea §8.2 rule 3).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCatalogApi } from "../../src/data/api";
import { apiBaseUrl } from "../../src/data/load";
import { refreshLastmodCache } from "../../src/data/lastmod";
import type { LastmodCache } from "../../src/data/types";

export async function main(appRoot: string): Promise<LastmodCache> {
  const api = createCatalogApi({ baseUrl: apiBaseUrl() });
  const snapshotRes = await api.snapshot();
  if ("notModified" in snapshotRes) throw new Error("gen:sitemap-lastmod: unexpected 304 on a cold snapshot");
  const cachePath = join(appRoot, "src/data/sitemap-lastmod.json");
  const previous = JSON.parse(readFileSync(cachePath, "utf8")) as LastmodCache;
  const report = await refreshLastmodCache(api, snapshotRes.data, previous);
  writeFileSync(cachePath, `${JSON.stringify(report.cache, null, 2)}\n`);
  console.log(
    `sitemap-lastmod: kept=${report.kept} refreshed=${report.refreshed} ` +
      `droppedSeries=${report.droppedSeries.length} catalog_seq=${report.cache.catalog_seq}`,
  );
  return report.cache;
}
