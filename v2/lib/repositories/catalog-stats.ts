import { count, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { varieties } from "@/lib/db/schema";

export async function varietyLevelCounts(db: Db) {
  const [[f], [i]] = await Promise.all([
    db.select({ n: count() }).from(varieties).where(eq(varieties.contentLevel, "factual")),
    db.select({ n: count() }).from(varieties).where(eq(varieties.indexable, true)),
  ]);
  return { factual: f?.n ?? 0, indexable: i?.n ?? 0 };
}
