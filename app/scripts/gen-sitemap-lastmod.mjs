// npm run gen:sitemap-lastmod — refreshes src/data/sitemap-lastmod.json from the
// live API (see scripts/entries/gen-lastmod.entry.ts). Bundles the TS entry
// with esbuild (devDependency, no new toolchain) and runs it — the same
// pattern as scripts/assert-pwa.mjs.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dir = mkdtempSync(join(tmpdir(), "gen-lastmod-"));
try {
  const outfile = join(dir, "entry.mjs");
  buildSync({
    entryPoints: [join(root, "scripts/entries/gen-lastmod.entry.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  const { main } = await import(pathToFileURL(outfile).href);
  await main(root);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
