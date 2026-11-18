/**
 * Sync reads (canonical §3 "Bulk sync for native apps"): the full public catalog for
 * /sync/snapshot, and per-table rows with updated_seq > since for /sync/changes. Visibility
 * flags are computed here so the service can turn hidden rows into tombstones.
 * Prices are never selected (R1).
 */
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { categories, listings, plants, plantSowingMethods, sellers, series, varieties, varietyAliases } from "@/lib/db/schema";
import { activeVariety, visibleListing, visibleSeller } from "./catalog-read";

const cropSelect = {
  id: plants.id,
  slug: plants.slug,
  commonName: plants.commonName,
  latinName: plants.latinName,
  category: categories.slug,
  seasonClass: plants.seasonClass,
  seasonSourceId: plants.seasonSourceId,
  /** Comma list (correlated subquery); the service splits + orders it. */
  sowingMethods: sql<string | null>`(SELECT group_concat(psm.method) FROM ${plantSowingMethods} psm WHERE psm.plant_id = ${plants.id})`,
  sowingMethodSourceId: plants.sowingMethodSourceId,
  updatedSeq: plants.updatedSeq,
  deletedAt: plants.deletedAt,
};
const seriesSelect = {
  id: series.id,
  slug: series.slug,
  name: series.name,
  plantId: series.plantId,
  updatedSeq: series.updatedSeq,
  deletedAt: series.deletedAt,
};
const varietySelect = {
  id: varieties.id,
  slug: varieties.slug,
  name: varieties.varietyName,
  plantId: varieties.plantId,
  seriesId: varieties.seriesId,
  colorSwatch: varieties.colorSwatch,
  colorFamily: varieties.colorFamily,
  pollination: varieties.pollination,
  heightCm: varieties.heightCm,
  daysToBloomMin: varieties.daysToBloomMin,
  daysToBloomMax: varieties.daysToBloomMax,
  indexable: varieties.indexable,
  status: varieties.status,
  mergedIntoId: varieties.mergedIntoId,
  updatedSeq: varieties.updatedSeq,
  deletedAt: varieties.deletedAt,
};
const sellerSelect = {
  id: sellers.id,
  slug: sellers.slug,
  name: sellers.name,
  location: sellers.location,
  region: sellers.region,
  country: sellers.country,
  homepage: sellers.homepage,
  shipsTo: sellers.shipsTo,
  claimStatus: sellers.claimStatus,
  ratingCount: sellers.ratingCount,
  ratingAverage: sellers.ratingAverage,
  importedRatingSource: sellers.importedRatingSource,
  importedRatingPlaceName: sellers.importedRatingPlaceName,
  importedRatingPlaceId: sellers.importedRatingPlaceId,
  importedRatingValue: sellers.importedRatingValue,
  importedRatingCount: sellers.importedRatingCount,
  importedRatingFetchedAt: sellers.importedRatingFetchedAt,
  updatedSeq: sellers.updatedSeq,
  visible: sql<number>`CASE WHEN ${visibleSeller!} THEN 1 ELSE 0 END`,
};
const listingSelect = {
  id: listings.id,
  varietyId: listings.varietyId,
  sellerId: listings.sellerId,
  availability: listings.availability,
  lastCheckedAt: listings.lastCheckedAt,
  firstSeenAt: listings.firstSeenAt,
  productUrl: listings.productUrl,
  sourceUrl: listings.sourceUrl,
  matchMethod: listings.matchMethod,
  confidence: listings.confidence,
  updatedSeq: listings.updatedSeq,
  visible: sql<number>`CASE WHEN ${visibleListing!} AND ${activeVariety!} THEN 1 ELSE 0 END`,
};

export type SyncCropRow = Awaited<ReturnType<typeof snapshotRows>>["crops"][number];
export type SyncSeriesRow = Awaited<ReturnType<typeof snapshotRows>>["series"][number];
export type SyncVarietyRow = Awaited<ReturnType<typeof snapshotRows>>["varieties"][number];
export type SyncSellerRow = Awaited<ReturnType<typeof snapshotRows>>["sellers"][number];
export type SyncListingRow = Awaited<ReturnType<typeof snapshotRows>>["listings"][number];

function listingBase(db: Db) {
  return db
    .select(listingSelect)
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .innerJoin(varieties, eq(varieties.id, listings.varietyId));
}

export async function snapshotRows(db: Db) {
  const [crops, seriesRows, varietyRows, names, sellerRows, listingRows] = await Promise.all([
    db.select(cropSelect).from(plants).innerJoin(categories, eq(categories.id, plants.categoryId)).where(isNull(plants.deletedAt)).orderBy(asc(plants.id)),
    db.select(seriesSelect).from(series).where(isNull(series.deletedAt)).orderBy(asc(series.id)),
    db.select(varietySelect).from(varieties).where(activeVariety).orderBy(asc(varieties.id)),
    db
      .select({ varietyId: varietyAliases.varietyId, name: varietyAliases.alias, kind: varietyAliases.kind })
      .from(varietyAliases)
      .innerJoin(varieties, eq(varieties.id, varietyAliases.varietyId))
      .where(activeVariety)
      .orderBy(asc(varietyAliases.varietyId), asc(varietyAliases.alias)),
    db.select(sellerSelect).from(sellers).where(visibleSeller).orderBy(asc(sellers.id)),
    listingBase(db).where(and(visibleListing, activeVariety)).orderBy(asc(listings.id)),
  ]);
  return { crops, series: seriesRows, varieties: varietyRows, names, sellers: sellerRows, listings: listingRows };
}

/** Rows changed after `since`, each table capped at `limit` (the service merges + cuts). */
export async function changedRows(db: Db, since: number, limit: number) {
  const [crops, seriesRows, varietyRows, sellerRows, listingRows] = await Promise.all([
    db
      .select(cropSelect)
      .from(plants)
      .innerJoin(categories, eq(categories.id, plants.categoryId))
      .where(gt(plants.updatedSeq, since))
      .orderBy(asc(plants.updatedSeq))
      .limit(limit),
    db.select(seriesSelect).from(series).where(gt(series.updatedSeq, since)).orderBy(asc(series.updatedSeq)).limit(limit),
    db.select(varietySelect).from(varieties).where(gt(varieties.updatedSeq, since)).orderBy(asc(varieties.updatedSeq)).limit(limit),
    db.select(sellerSelect).from(sellers).where(gt(sellers.updatedSeq, since)).orderBy(asc(sellers.updatedSeq)).limit(limit),
    listingBase(db).where(gt(listings.updatedSeq, since)).orderBy(asc(listings.updatedSeq)).limit(limit),
  ]);
  return { crops, series: seriesRows, varieties: varietyRows, sellers: sellerRows, listings: listingRows };
}

export async function namesFor(db: Db, varietyIds: number[]) {
  if (varietyIds.length === 0) return [];
  // Bound-parameter discipline (V20): D1 caps variables per statement, and a sync page can
  // hold up to SYNC_MAX_LIMIT varieties — chunk the IN list instead of binding them all.
  type AliasRow = { varietyId: number; name: string; kind: (typeof varietyAliases.$inferSelect)["kind"] };
  const rows: AliasRow[] = [];
  for (let i = 0; i < varietyIds.length; i += 100) {
    rows.push(
      ...(await db
        .select({ varietyId: varietyAliases.varietyId, name: varietyAliases.alias, kind: varietyAliases.kind })
        .from(varietyAliases)
        .where(inArray(varietyAliases.varietyId, varietyIds.slice(i, i + 100)))
        .orderBy(asc(varietyAliases.varietyId), asc(varietyAliases.alias))),
    );
  }
  return rows.sort((a, b) => a.varietyId - b.varietyId || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

