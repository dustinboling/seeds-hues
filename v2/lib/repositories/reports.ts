/** reports + the review_items row each report creates (R8). Both rows go in one atomic batch. */
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { ingestIdempotency, reports, reviewItems, sellers, varieties } from "@/lib/db/schema";

export interface NewReport {
  type: "correct" | "claim" | "remove";
  targetType: "variety" | "seller";
  targetRef: string;
  message: string;
  contact: string;
  turnstile: "verified" | "not_configured";
  createdAt: string;
}

export async function targetExists(db: Db, targetType: "variety" | "seller", slug: string): Promise<boolean> {
  if (targetType === "seller") {
    const [r] = await db.select({ id: sellers.id }).from(sellers).where(and(eq(sellers.slug, slug), isNull(sellers.deletedAt))).limit(1);
    return Boolean(r);
  }
  const [r] = await db.select({ id: varieties.id }).from(varieties).where(and(eq(varieties.slug, slug), isNull(varieties.deletedAt))).limit(1);
  return Boolean(r);
}

/**
 * Inserts the report, then its queue item (which references the report id). If the second insert
 * fails the report row is deleted again, so a report never exists without its queue item.
 */
export async function insertReportWithReviewItem(db: Db, r: NewReport): Promise<{ reportId: number; reviewItemId: number }> {
  const [rep] = await db.insert(reports).values(r).returning({ id: reports.id });
  try {
    const [item] = await db
      .insert(reviewItems)
      .values({
        type: r.type === "remove" ? "removal" : "seller_correction",
        groupKey: `${r.targetType}:${r.targetRef}`,
        proposal: JSON.stringify({
          report_id: rep!.id,
          report: { type: r.type, target_type: r.targetType, target_ref: r.targetRef, message: r.message },
        }),
        reason: `report:${r.type}`,
        createdAt: r.createdAt,
      })
      .returning({ id: reviewItems.id });
    return { reportId: rep!.id, reviewItemId: item!.id };
  } catch (err) {
    await db.delete(reports).where(eq(reports.id, rep!.id));
    throw err;
  }
}

export async function resolveReport(db: Db, id: number, status: "resolved" | "dismissed", at: string): Promise<void> {
  await db.update(reports).set({ status, resolvedAt: at }).where(eq(reports.id, id));
}

// ─── Idempotency-Key replay (ingest + admin POSTs) ──────────────────────────

export async function idempotentResponse(db: Db, key: string) {
  const [r] = await db.select().from(ingestIdempotency).where(eq(ingestIdempotency.key, key)).limit(1);
  return r ?? null;
}

export async function storeIdempotentResponse(db: Db, row: { key: string; endpoint: string; response: string; createdAt: string }) {
  await db.insert(ingestIdempotency).values(row).onConflictDoNothing();
}
