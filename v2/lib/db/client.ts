/**
 * DB client initialisation — the ONLY module allowed to read the D1 binding (`env.DB`).
 * Spec §3.2 / §3.4 rule 6: the client is created inside the request scope, never at module scope.
 */
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type Db = DrizzleD1Database<typeof schema>;

/** Wrap a D1 binding (Worker request scope, Wrangler platform proxy in scripts/tests). */
export function createDb(d1: D1Database): Db {
  return drizzle(d1, { schema });
}

/** Request-scoped DB for Server Components and route handlers. */
export async function getDb(): Promise<Db> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("D1 binding `DB` is not configured");
  return createDb(env.DB);
}

/** DB from raw Worker bindings outside a request (the cron handler, lib/jobs/scheduled.ts). */
export function dbFromBindings(env: { DB?: D1Database }): Db {
  if (!env.DB) throw new Error("D1 binding `DB` is not configured");
  return createDb(env.DB);
}
