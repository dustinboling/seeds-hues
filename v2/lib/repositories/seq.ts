/**
 * Global catalog change counter (canonical §2 "updated_seq"; design D1). One row in catalog_meta
 * (key 'catalog_seq'). Writers bump it INSIDE the same atomic() batch as the row they change:
 *
 *   await atomic(db, [...nextSeq(db), db.update(listings).set({ updatedSeq: currentSeq(), … })…]);
 *
 * Each call to nextSeq() is one increment, so every changed row gets its own sequence number.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { catalogMeta } from "@/lib/db/schema";
import type { AtomicOp } from "./atomic";

export const CATALOG_SEQ_KEY = "catalog_seq";

/** Statements that increment the counter (upsert, so a missing row starts at 1). */
export function nextSeq(db: Db): AtomicOp[] {
  return [
    db
      .insert(catalogMeta)
      .values({ key: CATALOG_SEQ_KEY, value: 1 })
      .onConflictDoUpdate({ target: catalogMeta.key, set: { value: sql`${catalogMeta.value} + 1` } }) as unknown as AtomicOp,
  ];
}

/** SQL expression for the counter's current value — use as `updatedSeq` right after nextSeq(). */
export function currentSeq(): SQL<number> {
  return sql<number>`(SELECT value FROM catalog_meta WHERE key = ${CATALOG_SEQ_KEY})`;
}

export async function catalogSeq(db: Db): Promise<number> {
  const [row] = await db.select({ v: catalogMeta.value }).from(catalogMeta).where(eq(catalogMeta.key, CATALOG_SEQ_KEY)).limit(1);
  return Number(row?.v ?? 0);
}
