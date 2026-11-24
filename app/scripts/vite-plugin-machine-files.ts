/**
 * Build plugin: generates the machine files (robots.txt, llms.txt,
 * /sitemap.xml index + seven Bea §8.2 segments) from the data layer and emits
 * them into dist/client alongside the prerendered HTML. Generation goes
 * through the single generateMachineFiles path (the same function the
 * revalidate regeneration calls), reading live catalog data via the shared
 * API client + cache and dates from the committed lastmod cache.
 *
 * A build that cannot reach the API fails loudly here: emitting machine
 * files from stale or missing data would bake false facts (Bea §9).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { getCatalogApi, getDataCache } from "../src/data/load";
import type { LastmodCache } from "../src/data/types";
import { generateMachineFiles } from "../src/server/machine-files";
import { SITE_URL } from "../src/site";

const here = dirname(fileURLToPath(import.meta.url));

export function machineFilesPlugin(): Plugin {
  let done = false;
  return {
    name: "seeds-machine-files",
    apply: "build",
    async generateBundle(options) {
      // vike build runs the client and server bundles through this hook; the
      // machine files belong to the served client output, emitted exactly once.
      const dir = options.dir ?? "";
      if (!dir.endsWith("client") || done) return;
      done = true;
      const lastmod = JSON.parse(
        readFileSync(join(here, "../src/data/sitemap-lastmod.json"), "utf8"),
      ) as LastmodCache;
      const files = await generateMachineFiles({
        siteUrl: SITE_URL,
        api: getCatalogApi(),
        cache: getDataCache(),
        lastmod,
      });
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
