/**
 * Machine-file generation — the single path that produces robots.txt,
 * llms.txt, /sitemap.xml (the index), and the seven Bea §8.2 segments from
 * the data layer. The build plugin (vite-plugin-machine-files) calls this to
 * emit the files into dist/client; the revalidate handler's regeneration
 * calls it after a purge; the tests call it against a fake catalog. One
 * function, three callers — the outputs can never disagree.
 *
 * Inputs: the site URL, a catalog API client, the shared data cache, and the
 * committed lastmod cache (src/data/sitemap-lastmod.json, refreshed by
 * `npm run gen:sitemap-lastmod`). lastmod dates emit only where the cached
 * seq still verifies against the live snapshot — a stale entry omits.
 */
import type { CatalogApi } from "../data/api";
import type { DataCache } from "../data/cache";
import { loadMachineData } from "../data/load";
import { renderLlmsTxt } from "../data/llms";
import { renderRobotsTxt } from "../data/robots";
import { buildSitemap, type SitemapFilename } from "../data/sitemap";
import type { LastmodCache } from "../data/types";
import { BOT_USER_AGENT, CONFLICT_OF_INTEREST, SITE_DESCRIPTION, TRADEMARK_DISCLAIMER } from "../site";

export interface MachineFileMap {
  "robots.txt": string;
  "llms.txt": string;
  "sitemap.xml": string;
}

export type AllMachineFiles = MachineFileMap & Record<SitemapFilename, string>;

export interface MachineFilesInput {
  siteUrl: string;
  api: CatalogApi;
  cache: DataCache;
  lastmod: LastmodCache;
}

export async function generateMachineFiles(input: MachineFilesInput): Promise<AllMachineFiles> {
  const { siteUrl, api, cache, lastmod } = input;
  const machine = await loadMachineData(api, cache);
  const sitemap = buildSitemap({ siteUrl, snapshot: machine.snapshot, lastmod });
  const llms = renderLlmsTxt({
    siteUrl,
    siteDescription: SITE_DESCRIPTION,
    botUserAgent: BOT_USER_AGENT,
    conflictOfInterest: CONFLICT_OF_INTEREST,
    trademarkDisclaimer: TRADEMARK_DISCLAIMER,
    counts: machine.counts,
    crops: machine.crops,
    sellers: machine.sellers,
  });
  return {
    "robots.txt": renderRobotsTxt(siteUrl),
    "llms.txt": llms,
    "sitemap.xml": sitemap.index,
    ...sitemap.files,
  };
}
