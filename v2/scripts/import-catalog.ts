/**
 * Import seed-data/catalog.json as batch `initial-catalog` (FINAL spec §6).
 *
 *   npm run db:import:local                       # local D1 (.wrangler/state/v3)
 *   tsx scripts/import-catalog.ts --persist-to <dir>
 *   tsx scripts/import-catalog.ts --remote --config wrangler.remote.jsonc
 *
 * Exit code 0 on success (including the idempotent no-op), 1 on any assertion failure.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDb } from "@/lib/db/client";
import { importCatalog } from "@/lib/catalog/importer";
import { CatalogAssertionError } from "@/lib/catalog/assertions";
import { openPlatform, parseArgs } from "./lib/platform";

async function main() {
  const args = parseArgs();
  const file = resolve(args.values.get("file") ?? "seed-data/catalog.json");
  const raw: unknown = JSON.parse(await readFile(file, "utf8"));
  const proxy = await openPlatform(args);
  try {
    const db = createDb(proxy.env.DB);
    const result = await importCatalog(db, raw, { log: (m) => console.log(m) });
    console.log(
      `\nImport ${result.status} — batch ${result.batchId}\n` +
        Object.entries(result.counts)
          .map(([k, v]) => `  ${k.padEnd(16)} ${v}`)
          .join("\n") +
        `\n  factual varieties ${result.factualVarieties}\n  indexable varieties ${result.indexableVarieties}`,
    );
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  if (err instanceof CatalogAssertionError) console.error(`✗ ${err.message}`);
  else console.error(err);
  process.exit(1);
});
