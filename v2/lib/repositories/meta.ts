/** Small integer flags in catalog_meta (e.g. notifications_paused). Not part of the snapshot. */
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { catalogMeta } from "@/lib/db/schema";

export async function getMetaFlag(db: Db, key: string): Promise<boolean> {
  const [r] = await db.select({ v: catalogMeta.value }).from(catalogMeta).where(eq(catalogMeta.key, key)).limit(1);
  return Number(r?.v ?? 0) !== 0;
}
