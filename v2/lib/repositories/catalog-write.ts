/**
 * Write repository used by the data scripts (importer / publisher / click beacon).
 * Multi-row inserts are chunked so no statement binds more than 100 parameters (D1 limit,
 * VERIFICATION-LOG V20). Multi-statement writes go through atomic().
 */
import { and, count, desc, eq, getTableColumns, isNotNull, isNull, ne, or, type InferInsertModel } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "@/lib/db/client";
import {
  catalogMeta,
  catalogPublish,
  categories,
  importBatches,
  listingEvents,
  listingPacketSizes,
  listings,
  matchQueue,
  media,
  outboundClicks,
  plants,
  plantSowingMethods,
  priceHistory,
  sellerClaims,
  sellers,
  series,
  sources,
  subcategories,
  varieties,
  varietyAliases,
  varietyTags,
} from "@/lib/db/schema";
import type { AtomicOp } from "./atomic";
import { CATALOG_SEQ_KEY } from "./seq";

export const D1_MAX_BOUND_PARAMS = 100;

/** Build chunked INSERT statements (not executed) for use inside atomic(). */
export function insertOps<T extends SQLiteTable>(db: Db, table: T, rows: InferInsertModel<T>[]): AtomicOp[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(getTableColumns(table)).length;
  const perChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columns));
  const ops: AtomicOp[] = [];
  for (let i = 0; i < rows.length; i += perChunk) {
    ops.push(db.insert(table).values(rows.slice(i, i + perChunk)) as unknown as AtomicOp);
  }
  return ops;
}

export async function getBatchByLabel(db: Db, label: string) {
  const [row] = await db.select().from(importBatches).where(eq(importBatches.label, label)).limit(1);
  return row ?? null;
}

export async function latestPublishedBatch(db: Db) {
  const [row] = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.status, "published"))
    .orderBy(desc(importBatches.id))
    .limit(1);
  return row ?? null;
}

export async function catalogIsEmpty(db: Db): Promise<boolean> {
  const tables = [sources, categories, plants, varieties, sellers, listings] as const;
  for (const t of tables) {
    const [r] = await db.select({ n: count() }).from(t);
    if ((r?.n ?? 0) > 0) return false;
  }
  return true;
}

/**
 * Delete every curated-catalog row (FK-safe order) so the importer can re-insert catalog.json in
 * the same atomic batch (full-replace semantics, design D2). Rows in FK-dependent side tables go
 * with them (legacy outbound_clicks, seller_claims, media, match_queue, catalog_publish); the
 * FK-free event/ops tables (click_events, search_events, reports, review_items, …) are kept.
 */
export function wipeCatalogOps(db: Db): AtomicOp[] {
  return [
    db.delete(priceHistory),
    db.delete(outboundClicks),
    db.delete(listingEvents),
    db.delete(listingPacketSizes),
    db.delete(listings),
    db.delete(sellerClaims),
    db.delete(varietyAliases),
    db.delete(varietyTags),
    db.delete(media),
    db.delete(varieties),
    db.delete(series),
    db.delete(sellers),
    db.delete(plantSowingMethods),
    db.delete(plants),
    db.delete(subcategories),
    db.delete(categories),
    db.delete(matchQueue),
    db.delete(catalogPublish),
    db.delete(importBatches),
    db.delete(sources),
  ] as unknown as AtomicOp[];
}

/** Set catalog_meta.catalog_seq to an explicit value (importer: deterministic 1..N). */
export function setCatalogSeqOp(db: Db, value: number): AtomicOp {
  return db
    .insert(catalogMeta)
    .values({ key: CATALOG_SEQ_KEY, value })
    .onConflictDoUpdate({ target: catalogMeta.key, set: { value } }) as unknown as AtomicOp;
}

export async function markBatchPublished(db: Db, batchId: number, at: string): Promise<void> {
  await db
    .update(importBatches)
    .set({ status: "published", publishedAt: at })
    .where(eq(importBatches.id, batchId));
}

export async function tableCounts(db: Db) {
  const n = async (t: SQLiteTable) => (await db.select({ n: count() }).from(t))[0]?.n ?? 0;
  return {
    sources: await n(sources),
    categories: await n(categories),
    subcategories: await n(subcategories),
    plants: await n(plants),
    plantSowingMethods: await n(plantSowingMethods),
    series: await n(series),
    varieties: await n(varieties),
    varietyTags: await n(varietyTags),
    varietyAliases: await n(varietyAliases),
    sellers: await n(sellers),
    listings: await n(listings),
    listingEvents: await n(listingEvents),
    approvedSellers: (await db.select({ n: count() }).from(sellers).where(eq(sellers.eligibility, "approved")))[0]?.n ?? 0,
    listingsWithoutCheckDate: (await db.select({ n: count() }).from(listings).where(isNull(listings.lastCheckedAt)))[0]?.n ?? 0,
    packetSizes: await n(listingPacketSizes),
    priceHistory: await n(priceHistory),
    media: await n(media),
    matchQueue: await n(matchQueue),
  };
}

/** Orphan-FK checks across the catalog (all must be 0). */
export async function orphanCounts(db: Db) {
  const q = async (p: Promise<{ n: number }[]>) => (await p)[0]?.n ?? 0;
  return {
    listingsWithoutVariety: await q(
      db.select({ n: count() }).from(listings).leftJoin(varieties, eq(varieties.id, listings.varietyId)).where(isNull(varieties.id)),
    ),
    listingsWithoutSeller: await q(
      db.select({ n: count() }).from(listings).leftJoin(sellers, eq(sellers.id, listings.sellerId)).where(isNull(sellers.id)),
    ),
    listingsWithoutSource: await q(
      db.select({ n: count() }).from(listings).leftJoin(sources, eq(sources.id, listings.sourceId)).where(isNull(sources.id)),
    ),
    varietiesWithoutSource: await q(
      db.select({ n: count() }).from(varieties).leftJoin(sources, eq(sources.id, varieties.sourceId)).where(isNull(sources.id)),
    ),
    varietiesWithoutPlant: await q(
      db.select({ n: count() }).from(varieties).leftJoin(plants, eq(plants.id, varieties.plantId)).where(isNull(plants.id)),
    ),
    packetsWithoutListing: await q(
      db
        .select({ n: count() })
        .from(listingPacketSizes)
        .leftJoin(listings, eq(listings.id, listingPacketSizes.listingId))
        .where(isNull(listings.id)),
    ),
    pricedPacketsWithoutProvenance: await q(
      db
        .select({ n: count() })
        .from(listingPacketSizes)
        .where(
          and(
            isNotNull(listingPacketSizes.priceCents),
            or(isNull(listingPacketSizes.priceSource), isNull(listingPacketSizes.priceCheckDate)),
          ),
        ),
    ),
    ratedSellers: await q(db.select({ n: count() }).from(sellers).where(ne(sellers.ratingCount, 0))),
  };
}

// ─── catalog_publish ────────────────────────────────────────────────────────

export async function latestPublish(db: Db) {
  const [row] = await db.select().from(catalogPublish).orderBy(desc(catalogPublish.version)).limit(1);
  return row ?? null;
}

export async function allPublishes(db: Db) {
  return db.select().from(catalogPublish).orderBy(catalogPublish.version);
}

export async function insertPublish(db: Db, row: typeof catalogPublish.$inferInsert): Promise<void> {
  await db.insert(catalogPublish).values(row);
}

// ─── Click beacon (§3.4) ────────────────────────────────────────────────────

export async function findListingForClick(db: Db, sellerSlug: string, varietySlug: string | null) {
  const [seller] = await db
    .select({ id: sellers.id, homepage: sellers.homepage })
    .from(sellers)
    .where(eq(sellers.slug, sellerSlug))
    .limit(1);
  if (!seller) return null;
  if (!varietySlug) return { sellerId: seller.id, listingId: null, urls: [seller.homepage] };
  const [l] = await db
    .select({ id: listings.id, productUrl: listings.productUrl })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(and(eq(listings.sellerId, seller.id), eq(varieties.slug, varietySlug)))
    .limit(1);
  return { sellerId: seller.id, listingId: l?.id ?? null, urls: [l?.productUrl ?? null, seller.homepage] };
}

export async function insertOutboundClick(db: Db, row: typeof outboundClicks.$inferInsert): Promise<void> {
  await db.insert(outboundClicks).values(row);
}
