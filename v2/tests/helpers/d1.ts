/**
 * Test D1: a fresh, throwaway local D1 (Miniflare via Wrangler's platform proxy) with the real
 * migrations applied by `wrangler d1 migrations apply`. Every suite gets its own directory, which
 * is deleted afterwards (HR6 — no test rows left behind).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { createDb, type Db } from "@/lib/db/client";
import { importCatalog } from "@/lib/catalog/importer";

export interface TestD1 {
  db: Db;
  env: CloudflareEnv;
  dispose: () => Promise<void>;
}

export function loadCatalogJson(): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "seed-data/catalog.json"), "utf8"));
}

export async function createTestD1(opts: { seed?: boolean } = {}): Promise<TestD1> {
  const dir = mkdtempSync(join(tmpdir(), "seeds-test-d1-"));
  execFileSync(
    process.execPath,
    [join(process.cwd(), "node_modules/wrangler/bin/wrangler.js"), "d1", "migrations", "apply", "DB", "--local", "--persist-to", dir],
    { stdio: "pipe", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
  );
  const proxy = await getPlatformProxy<CloudflareEnv>({ configPath: "wrangler.jsonc", persist: { path: join(dir, "v3") } });
  const db = createDb(proxy.env.DB);
  if (opts.seed !== false) await importCatalog(db, loadCatalogJson());
  return {
    db,
    env: proxy.env,
    dispose: async () => {
      await proxy.dispose();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
