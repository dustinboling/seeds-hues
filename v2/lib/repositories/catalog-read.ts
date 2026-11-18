/**
 * Read repository for the public catalog. Drizzle operators only (§3.4 rule 2); outputs are
 * plain row shapes that the service layer maps + Zod-validates.
 *
 * Visibility rules applied here (single place; canonical §2 publish invariants):
 *  - varieties: status = 'active' AND deleted_at IS NULL
 *  - sellers: eligibility = 'approved' AND status = 'active' AND listing_policy <> 'removed'
 *             AND deleted_at IS NULL
 *  - listings: status IN ('active','published') AND deleted_at IS NULL AND visible seller
 *  - prices: NEVER selected here (R1 — stored, not exposed).
 */
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  max,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "@/lib/db/client";
import { lifeCycleMatches } from "@/lib/life-cycle";
import type { LifeCycleParam } from "@/lib/validators";
import {
  categories,
  listingEvents,
  listingPacketSizes,
  listings,
  media,
  plants,
  plantSowingMethods,
  sellers,
  series,
  sources,
  subcategories,
  varieties,
  varietyAliases,
  varietyTags,
  VISIBLE_LISTING_STATUS,
  type SEASON_CLASSES,
  type SOWING_METHODS,
} from "@/lib/db/schema";

export type SeasonClass = (typeof SEASON_CLASSES)[number];
export type SowingMethod = (typeof SOWING_METHODS)[number];

/**
 * The source a plant's season class came from. Aliased so it can sit beside the listing-source
 * join on `sources` (publicListingRows). Always a LEFT JOIN: unclassified plants have none.
 */
const seasonSources = alias(sources, "season_sources");
/**
 * Crop facts carried by every PlantRef: the season class (+ its source, joined above) and the
 * sowing methods (+ their source). Methods come back as a comma list from a correlated subquery
 * (no join fan-out); the service splits and orders them. The method source label is a scalar
 * subquery so no call site needs another join.
 */
const plantRefCols = {
  seasonClass: plants.seasonClass,
  seasonSourceLabel: seasonSources.label,
  sowingMethods: sql<string | null>`(SELECT group_concat(psm.method) FROM ${plantSowingMethods} psm WHERE psm.plant_id = ${plants.id})`,
  sowingMethodSourceLabel: sql<string | null>`(SELECT ms.label FROM ${sources} ms WHERE ms.id = ${plants.sowingMethodSourceId})`,
};

/** Plants having ANY of the given sowing methods (subquery on plant_sowing_methods). */
function plantHasMethod(methods: SowingMethod[]): SQL {
  return sql`${plants.id} IN (SELECT ${plantSowingMethods.plantId} FROM ${plantSowingMethods} WHERE ${inArray(plantSowingMethods.method, methods)})`;
}

/**
 * Plants whose life cycle falls in ANY of the given buckets. The buckets are derived from the
 * stored life_cycle text (lib/life-cycle.ts), so the distinct values in use are read first and
 * matched in code; crops without a life cycle never match.
 */
async function plantLifeCycleIn(db: Db, buckets: LifeCycleParam[]): Promise<SQL> {
  const rows = await db.selectDistinct({ v: plants.lifeCycle }).from(plants).where(and(isNull(plants.deletedAt), isNotNull(plants.lifeCycle)));
  const values = rows.map((r) => r.v!).filter((v) => lifeCycleMatches(v, buckets));
  return values.length ? inArray(plants.lifeCycle, values) : sql`0 = 1`;
}

export const visibleSeller = and(
  eq(sellers.status, "active"),
  eq(sellers.eligibility, "approved"),
  ne(sellers.listingPolicy, "removed"),
  isNull(sellers.deletedAt),
);
export const visibleListing = and(
  inArray(listings.status, [...VISIBLE_LISTING_STATUS]),
  isNull(listings.deletedAt),
  visibleSeller,
);
export const activeVariety = and(eq(varieties.status, "active"), isNull(varieties.deletedAt));

const lowerName = sql`lower(${varieties.varietyName})`;

export interface VarietyFilters {
  category?: string;
  subcategory?: string;
  plant?: string[];
  series?: string[];
  colorFamily?: string[];
  pollination?: string[];
  seller?: string;
  tag?: string;
  hasListings?: boolean;
  inStock?: boolean;
  ids?: number[];
  /** The variety's crop (plant) season class; unclassified crops never match. */
  season?: SeasonClass[];
  /** The variety's crop has ANY of these sowing methods; unclassified crops never match. */
  methods?: SowingMethod[];
  /** The variety's crop is in ANY of these life-cycle buckets; crops without one never match. */
  lifeCycle?: LifeCycleParam[];
}

/** Canonical §3 sorts (leading "-" = descending). Price sorts were removed (R1). */
export const VARIETY_SORTS = [
  "name",
  "-name",
  "recently_checked",
  "-recently_checked",
  "listing_count",
  "-listing_count",
] as const;
export type VarietySort = (typeof VARIETY_SORTS)[number];

export interface Page {
  offset: number;
  limit: number;
}

// ─── Variety summaries ───────────────────────────────────────────────────────

function listingStatsSq(db: Db) {
  return db
    .select({
      varietyId: listings.varietyId,
      listingCount: count(listings.id).as("listing_count"),
      inStockCount: sql<number>`sum(CASE WHEN ${listings.availability} = 'in_stock' THEN 1 ELSE 0 END)`.as("in_stock_count"),
      lastChecked: max(listings.lastCheckedAt).as("last_checked"),
    })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(visibleListing)
    .groupBy(listings.varietyId)
    .as("ls");
}

function varietyWhere(db: Db, f: VarietyFilters, ls: ReturnType<typeof listingStatsSq>, lifeCycle?: SQL): SQL | undefined {
  const conds: (SQL | undefined)[] = [activeVariety, lifeCycle];
  if (f.ids) conds.push(f.ids.length ? inArray(varieties.id, f.ids) : sql`0 = 1`);
  if (f.category) conds.push(eq(categories.slug, f.category));
  if (f.subcategory) conds.push(eq(subcategories.slug, f.subcategory));
  if (f.plant?.length) conds.push(inArray(plants.slug, f.plant));
  if (f.series?.length) conds.push(inArray(series.slug, f.series));
  if (f.colorFamily?.length) conds.push(inArray(varieties.colorFamily, f.colorFamily));
  if (f.season?.length) conds.push(inArray(plants.seasonClass, f.season));
  if (f.methods?.length) conds.push(plantHasMethod(f.methods));
  if (f.pollination?.length) conds.push(inArray(varieties.pollination, f.pollination as ("open_pollinated" | "f1_hybrid" | "unknown")[]));
  if (f.hasListings !== undefined) conds.push(f.hasListings ? sql`coalesce(${ls.listingCount}, 0) > 0` : sql`coalesce(${ls.listingCount}, 0) = 0`);
  if (f.inStock !== undefined) conds.push(f.inStock ? sql`coalesce(${ls.inStockCount}, 0) > 0` : sql`coalesce(${ls.inStockCount}, 0) = 0`);
  if (f.tag) {
    conds.push(
      inArray(
        varieties.id,
        db.select({ id: varietyTags.varietyId }).from(varietyTags).where(eq(varietyTags.tag, f.tag)),
      ),
    );
  }
  if (f.seller) {
    conds.push(
      inArray(
        varieties.id,
        db
          .select({ id: listings.varietyId })
          .from(listings)
          .innerJoin(sellers, eq(sellers.id, listings.sellerId))
          .where(and(visibleListing, eq(sellers.slug, f.seller))),
      ),
    );
  }
  return and(...conds);
}

export interface VarietySummaryRow {
  id: number;
  slug: string;
  varietyName: string;
  colorSwatch: string | null;
  colorFamily: string;
  indexable: boolean;
  plantSlug: string;
  commonName: string;
  latinName: string | null;
  seasonClass: SeasonClass | null;
  seasonSourceLabel: string | null;
  sowingMethods: string | null;
  sowingMethodSourceLabel: string | null;
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string | null;
  subcategoryName: string | null;
  seriesSlug: string | null;
  seriesName: string | null;
  listingCount: number | null;
  inStockCount: number | null;
  lastChecked: string | null;
}

function sortOrder(sort: VarietySort, ls: ReturnType<typeof listingStatsSq>): SQL[] {
  const tail = [sql`${lowerName} ASC`, sql`${varieties.slug} ASC`];
  switch (sort) {
    case "name":
      return tail;
    case "-name":
      return [sql`${lowerName} DESC`, sql`${varieties.slug} DESC`];
    case "listing_count":
      return [sql`coalesce(${ls.listingCount}, 0) ASC`, ...tail];
    case "-listing_count":
      return [sql`coalesce(${ls.listingCount}, 0) DESC`, ...tail];
    case "recently_checked":
      return [sql`${ls.lastChecked} IS NULL`, sql`${ls.lastChecked} ASC`, ...tail];
    case "-recently_checked":
      return [sql`${ls.lastChecked} IS NULL`, sql`${ls.lastChecked} DESC`, ...tail];
  }
}

/** Mirror of sortOrder() for rows already fetched (used only by the ids chunking below). */
function summaryComparator(sort: VarietySort): (a: VarietySummaryRow, b: VarietySummaryRow) => number {
  const nameAsc = (a: VarietySummaryRow, b: VarietySummaryRow) =>
    a.varietyName.toLowerCase().localeCompare(b.varietyName.toLowerCase()) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const checked = (dir: 1 | -1) => (a: VarietySummaryRow, b: VarietySummaryRow) => {
    // SQL: ORDER BY (last_checked IS NULL) ASC — non-null rows first, nulls last.
    const an = a.lastChecked === null ? 1 : 0;
    const bn = b.lastChecked === null ? 1 : 0;
    if (an !== bn) return an - bn;
    if (a.lastChecked !== b.lastChecked) return (a.lastChecked! < b.lastChecked! ? -1 : 1) * dir;
    return nameAsc(a, b);
  };
  switch (sort) {
    case "name":
      return nameAsc;
    case "-name":
      return (a, b) => -nameAsc(a, b);
    case "listing_count":
      return (a, b) => (a.listingCount ?? 0) - (b.listingCount ?? 0) || nameAsc(a, b);
    case "-listing_count":
      return (a, b) => (b.listingCount ?? 0) - (a.listingCount ?? 0) || nameAsc(a, b);
    case "recently_checked":
      return checked(1);
    case "-recently_checked":
      return checked(-1);
  }
}

export async function listVarietySummaryRows(
  db: Db,
  filters: VarietyFilters,
  sort: VarietySort,
  page: Page,
): Promise<{ rows: VarietySummaryRow[]; total: number }> {
  // Bound-parameter discipline (V20): D1 caps a statement at 100 bound parameters, and the
  // summary query binds several besides the ids — a 100-match search overflows it. Fetch
  // large ids sets in chunks, then merge with the same ordering the SQL would produce.
  if (filters.ids && filters.ids.length > 50) {
    const parts: { rows: VarietySummaryRow[]; total: number }[] = [];
    for (let i = 0; i < filters.ids.length; i += 50) {
      const ids = filters.ids.slice(i, i + 50);
      parts.push(await listVarietySummaryRows(db, { ...filters, ids }, sort, { offset: 0, limit: ids.length }));
    }
    const rows = parts.flatMap((p) => p.rows).sort(summaryComparator(sort));
    return { rows: rows.slice(page.offset, page.offset + page.limit), total: parts.reduce((n, p) => n + p.total, 0) };
  }
  const ls = listingStatsSq(db);
  const where = varietyWhere(db, filters, ls, filters.lifeCycle?.length ? await plantLifeCycleIn(db, filters.lifeCycle) : undefined);
  const base = () =>
    db
      .select({
        id: varieties.id,
        slug: varieties.slug,
        varietyName: varieties.varietyName,
        colorSwatch: varieties.colorSwatch,
        colorFamily: varieties.colorFamily,
        indexable: varieties.indexable,
        plantSlug: plants.slug,
        commonName: plants.commonName,
        latinName: plants.latinName,
        ...plantRefCols,
        categorySlug: categories.slug,
        categoryName: categories.name,
        subcategorySlug: subcategories.slug,
        subcategoryName: subcategories.name,
        seriesSlug: series.slug,
        seriesName: series.name,
        listingCount: ls.listingCount,
        inStockCount: ls.inStockCount,
        lastChecked: ls.lastChecked,
      })
      .from(varieties)
      .innerJoin(plants, eq(plants.id, varieties.plantId))
      .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
      .innerJoin(categories, eq(categories.id, varieties.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, varieties.subcategoryId))
      .leftJoin(series, eq(series.id, varieties.seriesId))
      .leftJoin(ls, eq(ls.varietyId, varieties.id));

  const rows = await base()
    .where(where)
    .orderBy(...sortOrder(sort, ls))
    .limit(page.limit)
    .offset(page.offset);

  const [totalRow] = await db
    .select({ n: count() })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .innerJoin(categories, eq(categories.id, varieties.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, varieties.subcategoryId))
    .leftJoin(series, eq(series.id, varieties.seriesId))
    .leftJoin(ls, eq(ls.varietyId, varieties.id))
    .where(where);

  return {
    rows: rows.map((r) => ({ ...r, inStockCount: r.inStockCount === null ? null : Number(r.inStockCount) })),
    total: totalRow?.n ?? 0,
  };
}

/** Distinct colour families in use for a crop (crop-page filter options). */
export async function colorFamiliesForPlant(db: Db, plantSlug: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ c: varieties.colorFamily })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(activeVariety, eq(plants.slug, plantSlug)))
    .orderBy(asc(varieties.colorFamily));
  return rows.map((r) => r.c);
}

// ─── Variety detail ──────────────────────────────────────────────────────────

export async function varietyDetailRow(db: Db, slug: string) {
  const [row] = await db
    .select({
      id: varieties.id,
      slug: varieties.slug,
      varietyName: varieties.varietyName,
      description: varieties.description,
      sowingNotes: varieties.sowingNotes,
      heightCm: varieties.heightCm,
      colorSwatch: varieties.colorSwatch,
      colorFamily: varieties.colorFamily,
      pollination: varieties.pollination,
      daysToBloomMin: varieties.daysToBloomMin,
      daysToBloomMax: varieties.daysToBloomMax,
      contentLevel: varieties.contentLevel,
      indexable: varieties.indexable,
      protection: varieties.protection,
      protectionNote: varieties.protectionNote,
      updatedAt: varieties.updatedAt,
      plantSlug: plants.slug,
      commonName: plants.commonName,
      latinName: plants.latinName,
      plantDescription: plants.description,
      plantSowingNotes: plants.sowingNotes,
      ...plantRefCols,
    })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
    .where(and(eq(varieties.slug, slug), activeVariety))
    .limit(1);
  return row ?? null;
}

/** For a merged (or otherwise retired) slug: the surviving variety's slug, if any. */
export async function mergedVarietyTarget(db: Db, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ status: varieties.status, mergedIntoId: varieties.mergedIntoId })
    .from(varieties)
    .where(eq(varieties.slug, slug))
    .limit(1);
  if (!row || row.status !== "merged" || !row.mergedIntoId) return null;
  const [target] = await db
    .select({ slug: varieties.slug })
    .from(varieties)
    .where(and(eq(varieties.id, row.mergedIntoId), activeVariety))
    .limit(1);
  return target?.slug ?? null;
}

export async function varietyTagsAndAliases(db: Db, varietyId: number) {
  const [tags, aliases] = await Promise.all([
    db
      .select({ tag: varietyTags.tag })
      .from(varietyTags)
      .where(eq(varietyTags.varietyId, varietyId))
      .orderBy(asc(varietyTags.tag)),
    db
      .select({ alias: varietyAliases.alias })
      .from(varietyAliases)
      .where(and(eq(varietyAliases.varietyId, varietyId), ne(varietyAliases.kind, "primary")))
      .orderBy(asc(varietyAliases.alias)),
  ]);
  return { tags: tags.map((t) => t.tag), aliases: aliases.map((a) => a.alias) };
}

export interface MediaRow {
  r2Key: string;
  licence: string;
  credit: string;
}

/**
 * A variety's media rows, oldest first (ordered by media.id). For own-work artwork served from
 * the app's public assets, r2_key holds the public path (e.g. /artwork/<file>.webp).
 */
export async function listMediaForVariety(db: Db, varietyId: number): Promise<MediaRow[]> {
  return db
    .select({ r2Key: media.r2Key, licence: media.licence, credit: media.credit })
    .from(media)
    .where(eq(media.varietyId, varietyId))
    .orderBy(asc(media.id));
}

/**
 * A plant's (crop's) media rows, oldest first (ordered by media.id). Same storage convention as
 * variety media: r2_key holds the public path (e.g. /artwork/crops/<plant-slug>.webp).
 */
export async function listMediaForPlant(db: Db, plantId: number): Promise<MediaRow[]> {
  return db
    .select({ r2Key: media.r2Key, licence: media.licence, credit: media.credit })
    .from(media)
    .where(eq(media.plantId, plantId))
    .orderBy(asc(media.id));
}

/**
 * Media rows for many plants, grouped by plant id (id order kept within each plant). Ids are
 * queried in chunks of 50 to stay under D1's 100-bound-parameter cap, as the summary loader does.
 * Plants without rows are absent from the map.
 */
export async function listMediaForPlants(db: Db, plantIds: number[]): Promise<Map<number, MediaRow[]>> {
  const out = new Map<number, MediaRow[]>();
  const ids = [...new Set(plantIds)];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const rows = await db
      .select({ plantId: media.plantId, r2Key: media.r2Key, licence: media.licence, credit: media.credit })
      .from(media)
      .where(inArray(media.plantId, chunk))
      .orderBy(asc(media.id));
    for (const { plantId, ...row } of rows) {
      if (plantId === null) continue;
      const list = out.get(plantId);
      if (list) list.push(row);
      else out.set(plantId, [row]);
    }
  }
  return out;
}

/**
 * Media rows for many varieties, grouped by variety id (id order kept within each variety, so the
 * first row is the same hero listMediaForVariety returns). Ids are queried in chunks of 50 to stay
 * under D1's 100-bound-parameter cap. Varieties without rows are absent from the map.
 */
export async function listMediaForVarieties(db: Db, varietyIds: number[]): Promise<Map<number, MediaRow[]>> {
  const out = new Map<number, MediaRow[]>();
  const ids = [...new Set(varietyIds)];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const rows = await db
      .select({ varietyId: media.varietyId, r2Key: media.r2Key, licence: media.licence, credit: media.credit })
      .from(media)
      .where(inArray(media.varietyId, chunk))
      .orderBy(asc(media.varietyId), asc(media.id));
    for (const { varietyId, ...row } of rows) {
      if (varietyId === null) continue;
      const list = out.get(varietyId);
      if (list) list.push(row);
      else out.set(varietyId, [row]);
    }
  }
  return out;
}

// ─── Public listings (one row shape for every public listing view) ──────────

export interface ListingQuery {
  varietyId?: number;
  sellerId?: number;
  ids?: number[];
  availability?: string[];
  plant?: string[];
  shipsTo?: string[];
}

const listingSelect = {
  id: listings.id,
  productUrl: listings.productUrl,
  notes: listings.notes,
  availability: listings.availability,
  lastCheckedAt: listings.lastCheckedAt,
  firstSeenAt: listings.firstSeenAt,
  matchMethod: listings.matchMethod,
  confidence: listings.confidence,
  sourceUrl: listings.sourceUrl,
  sourceLabel: sources.label,
  sellerId: sellers.id,
  sellerSlug: sellers.slug,
  sellerName: sellers.name,
  varietyId: varieties.id,
  sellerLocation: sellers.location,
  sellerRegion: sellers.region,
  sellerCountry: sellers.country,
  sellerHomepage: sellers.homepage,
  varietySlug: varieties.slug,
  varietyName: varieties.varietyName,
  colorSwatch: varieties.colorSwatch,
  plantSlug: plants.slug,
  commonName: plants.commonName,
  latinName: plants.latinName,
  ...plantRefCols,
};

export type PublicListingRow = Awaited<ReturnType<typeof publicListingRows>>[number];

/** Visible listings, in-stock first, then seller name (variety view) / crop + variety (seller view). */
export async function publicListingRows(db: Db, q: ListingQuery) {
  const conds: (SQL | undefined)[] = [visibleListing, activeVariety];
  if (q.varietyId !== undefined) conds.push(eq(listings.varietyId, q.varietyId));
  if (q.sellerId !== undefined) conds.push(eq(listings.sellerId, q.sellerId));
  if (q.ids) conds.push(q.ids.length ? inArray(listings.id, q.ids) : sql`0 = 1`);
  if (q.availability?.length) conds.push(inArray(listings.availability, q.availability as ("in_stock" | "sold_out" | "preorder" | "shop_closed" | "unknown")[]));
  if (q.plant?.length) conds.push(inArray(plants.slug, q.plant));
  if (q.shipsTo?.length) {
    conds.push(sql`EXISTS (SELECT 1 FROM json_each(${sellers.shipsTo}) j WHERE j.value IN (${sql.join(q.shipsTo.map((s) => sql`${s}`), sql`, `)}))`);
  }
  const order =
    q.sellerId !== undefined
      ? [sql`lower(${plants.commonName})`, asc(lowerName), asc(varieties.slug)]
      : [sql`CASE WHEN ${listings.availability} = 'in_stock' THEN 0 ELSE 1 END`, sql`lower(${sellers.name})`, asc(sellers.slug), asc(listings.id)];
  return db
    .select(listingSelect)
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
    .leftJoin(sources, eq(sources.id, listings.sourceId))
    .where(and(...conds))
    .orderBy(...order);
}

export type PacketRow = Awaited<ReturnType<typeof packetRows>>[number];

/** Packet labels + seed counts only — price columns are deliberately not selected (R1). */
export async function packetRows(db: Db, listingIds: number[]) {
  if (listingIds.length === 0) return [];
  return db
    .select({
      listingId: listingPacketSizes.listingId,
      label: listingPacketSizes.label,
      seedCount: listingPacketSizes.seedCount,
    })
    .from(listingPacketSizes)
    .where(inArray(listingPacketSizes.listingId, listingIds))
    .orderBy(asc(listingPacketSizes.listingId), asc(listingPacketSizes.sortOrder), asc(listingPacketSizes.id));
}

/** Listing + seller state for /go/{id} (any status — the route decides 302 / 404 / 410). */
export async function listingForGo(db: Db, id: number) {
  const [row] = await db
    .select({
      id: listings.id,
      status: listings.status,
      deletedAt: listings.deletedAt,
      availability: listings.availability,
      productUrl: listings.productUrl,
      varietyId: listings.varietyId,
      sellerId: listings.sellerId,
      sellerHomepage: sellers.homepage,
      sellerEligibility: sellers.eligibility,
      sellerStatus: sellers.status,
      sellerListingPolicy: sellers.listingPolicy,
      varietyStatus: varieties.status,
    })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(eq(listings.id, id))
    .limit(1);
  return row ?? null;
}

// ─── Sellers ────────────────────────────────────────────────────────────────

function sellerVarietyCountsSq(db: Db) {
  return db
    .select({ sellerId: listings.sellerId, varietyCount: countDistinct(listings.varietyId).as("variety_count") })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(and(inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt), activeVariety))
    .groupBy(listings.sellerId)
    .as("svc");
}

const sellerSelect = (svc: ReturnType<typeof sellerVarietyCountsSq>) => ({
  id: sellers.id,
  slug: sellers.slug,
  name: sellers.name,
  type: sellers.type,
  location: sellers.location,
  region: sellers.region,
  country: sellers.country,
  homepage: sellers.homepage,
  description: sellers.description,
  orderingNotes: sellers.orderingNotes,
  ratingCount: sellers.ratingCount,
  ratingAverage: sellers.ratingAverage,
  claimStatus: sellers.claimStatus,
  shipsTo: sellers.shipsTo,
  isSiteOwner: sellers.isSiteOwner,
  updatedAt: sellers.updatedAt,
  importedRatingSource: sellers.importedRatingSource,
  importedRatingPlaceName: sellers.importedRatingPlaceName,
  importedRatingPlaceId: sellers.importedRatingPlaceId,
  importedRatingValue: sellers.importedRatingValue,
  importedRatingCount: sellers.importedRatingCount,
  importedRatingFetchedAt: sellers.importedRatingFetchedAt,
  varietyCount: svc.varietyCount,
});

export interface SellerFilters {
  region?: string[];
  q?: string;
}

function sellerWhere(f: SellerFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [visibleSeller];
  if (f.region?.length) conds.push(inArray(sellers.region, f.region));
  if (f.q) conds.push(sql`lower(${sellers.name}) LIKE ${`%${f.q.replace(/[%_\\]/g, "").toLowerCase()}%`}`);
  return and(...conds);
}

export async function listSellerRows(db: Db, page: Page, filters: SellerFilters = {}) {
  const svc = sellerVarietyCountsSq(db);
  const where = sellerWhere(filters);
  const rows = await db
    .select(sellerSelect(svc))
    .from(sellers)
    .leftJoin(svc, eq(svc.sellerId, sellers.id))
    .where(where)
    .orderBy(sql`lower(${sellers.name})`, asc(sellers.slug))
    .limit(page.limit)
    .offset(page.offset);
  const [t] = await db.select({ n: count() }).from(sellers).where(where);
  return { rows, total: t?.n ?? 0 };
}

/** Visible sellers per (country, region), for the state filter and /state pages. */
export async function sellerRegionCountRows(db: Db) {
  return db
    .select({ country: sellers.country, region: sellers.region, n: count() })
    .from(sellers)
    .where(and(visibleSeller, isNotNull(sellers.region)))
    .groupBy(sellers.country, sellers.region)
    .orderBy(asc(sellers.region));
}

export async function sellerRow(db: Db, slug: string) {
  const svc = sellerVarietyCountsSq(db);
  const [row] = await db
    .select(sellerSelect(svc))
    .from(sellers)
    .leftJoin(svc, eq(svc.sellerId, sellers.id))
    .where(and(eq(sellers.slug, slug), visibleSeller))
    .limit(1);
  return row ?? null;
}

/** Eligibility of any seller by slug (visible or not) — drives the 410 for removed sellers. */
export async function sellerEligibility(db: Db, slug: string) {
  const [row] = await db
    .select({ eligibility: sellers.eligibility, listingPolicy: sellers.listingPolicy })
    .from(sellers)
    .where(eq(sellers.slug, slug))
    .limit(1);
  return row ?? null;
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function categoryRows(db: Db, slug?: string) {
  const cats = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(slug ? eq(categories.slug, slug) : undefined)
    .orderBy(asc(categories.sortOrder), asc(categories.slug));
  if (cats.length === 0) return [];
  const catIds = cats.map((c) => c.id);
  const [subs, catCounts, subCounts] = await Promise.all([
    db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId, slug: subcategories.slug, name: subcategories.name })
      .from(subcategories)
      .where(inArray(subcategories.categoryId, catIds))
      .orderBy(asc(subcategories.name)),
    db
      .select({ categoryId: varieties.categoryId, n: count() })
      .from(varieties)
      .where(and(activeVariety, inArray(varieties.categoryId, catIds)))
      .groupBy(varieties.categoryId),
    db
      .select({ subcategoryId: varieties.subcategoryId, n: count() })
      .from(varieties)
      .where(and(activeVariety, inArray(varieties.categoryId, catIds), isNotNull(varieties.subcategoryId)))
      .groupBy(varieties.subcategoryId),
  ]);
  const catN = new Map(catCounts.map((c) => [c.categoryId, c.n]));
  const subN = new Map(subCounts.map((s) => [s.subcategoryId, s.n]));
  return cats.map((c) => ({
    slug: c.slug,
    name: c.name,
    varietyCount: catN.get(c.id) ?? 0,
    subcategories: subs
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({ slug: s.slug, name: s.name, varietyCount: subN.get(s.id) ?? 0 })),
  }));
}

// ─── Crops (= plants) with coverage ─────────────────────────────────────────

/**
 * Per plant: varieties, varieties with ≥ 1 visible listing, last updated. Id sets are queried
 * in chunks of 50 to stay under D1's 100-bound-parameter cap, as the media loaders do — the
 * catalog passed 100 crops in Nov 2026, and an unchunked IN (…) over every plant id fails.
 * Chunks are disjoint by plant, so merging the per-chunk aggregates into one map is exact.
 */
async function coverageByPlant(db: Db, plantIds?: number[]) {
  const ls = listingStatsSq(db);
  const runChunk = (ids?: number[]) =>
    db
      .select({
        plantId: varieties.plantId,
        varieties: count(varieties.id),
        withSellers: sql<number>`sum(CASE WHEN coalesce(${ls.listingCount}, 0) > 0 THEN 1 ELSE 0 END)`,
        lastVarietyUpdate: max(varieties.updatedAt),
        lastCheck: max(ls.lastChecked),
      })
      .from(varieties)
      .leftJoin(ls, eq(ls.varietyId, varieties.id))
      .where(and(activeVariety, ids ? inArray(varieties.plantId, ids) : undefined))
      .groupBy(varieties.plantId);
  const chunks: (number[] | undefined)[] = [undefined];
  if (plantIds) {
    const ids = [...new Set(plantIds)];
    chunks.length = 0;
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  }
  const out = new Map<number, { varieties: number; withSellers: number; lastUpdated: string | null }>();
  for (const chunk of chunks) {
    const rows = await runChunk(chunk);
    for (const r of rows) {
      const dates = [r.lastVarietyUpdate, r.lastCheck].filter((d): d is string => Boolean(d)).map((d) => d.slice(0, 10));
      out.set(r.plantId, { varieties: r.varieties, withSellers: Number(r.withSellers ?? 0), lastUpdated: dates.sort().at(-1) ?? null });
    }
  }
  return out;
}

const plantSelect = {
  id: plants.id,
  slug: plants.slug,
  commonName: plants.commonName,
  latinName: plants.latinName,
  description: plants.description,
  sowingNotes: plants.sowingNotes,
  ...plantRefCols,
  // Grower guide (crop detail only; the service parses the JSON text). The source id is
  // internal provenance and deliberately not selected.
  lifeCycle: plants.lifeCycle,
  hardiness: plants.hardiness,
  growerGuide: plants.growerGuide,
  categorySlug: categories.slug,
  categoryName: categories.name,
};

export interface PlantFilters {
  /** Only crops of this season class (unclassified crops never match). */
  season?: SeasonClass;
  /** Only crops having ANY of these sowing methods (unclassified crops never match). */
  methods?: SowingMethod[];
}

/** Season + method conditions on `plants` (shared by crop lists and crop/series search). */
function plantFilterConds(f: PlantFilters): (SQL | undefined)[] {
  return [f.season ? eq(plants.seasonClass, f.season) : undefined, f.methods?.length ? plantHasMethod(f.methods) : undefined];
}

/** Crop-list filters: season + method, plus the life-cycle buckets (crop lists only). */
export interface PlantListFilters extends PlantFilters {
  /** Only crops in ANY of these life-cycle buckets (crops without a life cycle never match). */
  lifeCycle?: LifeCycleParam[];
}

export async function listPlantRows(db: Db, page: Page, filters: PlantListFilters = {}) {
  const lifeCycle = filters.lifeCycle?.length ? await plantLifeCycleIn(db, filters.lifeCycle) : undefined;
  const where = and(isNull(plants.deletedAt), ...plantFilterConds(filters), lifeCycle);
  const rows = await db
    .select(plantSelect)
    .from(plants)
    .innerJoin(categories, eq(categories.id, plants.categoryId))
    .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
    .where(where)
    .orderBy(sql`lower(${plants.commonName})`, asc(plants.slug))
    .limit(page.limit)
    .offset(page.offset);
  const cov = await coverageByPlant(db, rows.map((r) => r.id));
  const [t] = await db.select({ n: count() }).from(plants).where(where);
  return {
    rows: rows.map((r) => ({ ...r, coverage: cov.get(r.id) ?? { varieties: 0, withSellers: 0, lastUpdated: null } })),
    total: t?.n ?? 0,
  };
}

export async function plantRow(db: Db, slug: string) {
  const [row] = await db
    .select(plantSelect)
    .from(plants)
    .innerJoin(categories, eq(categories.id, plants.categoryId))
    .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
    .where(and(eq(plants.slug, slug), isNull(plants.deletedAt)))
    .limit(1);
  if (!row) return null;
  const cov = await coverageByPlant(db, [row.id]);
  return { ...row, coverage: cov.get(row.id) ?? { varieties: 0, withSellers: 0, lastUpdated: null } };
}

// ─── Series ─────────────────────────────────────────────────────────────────

export async function seriesForPlant(db: Db, plantId: number) {
  return db
    .select({ slug: series.slug, name: series.name })
    .from(series)
    .where(and(eq(series.plantId, plantId), isNull(series.deletedAt)))
    .orderBy(asc(series.name));
}

export async function seriesRow(db: Db, slug: string) {
  const [row] = await db
    .select({
      id: series.id,
      slug: series.slug,
      name: series.name,
      plantSlug: plants.slug,
      commonName: plants.commonName,
      latinName: plants.latinName,
      ...plantRefCols,
    })
    .from(series)
    .innerJoin(plants, eq(plants.id, series.plantId))
    .leftJoin(seasonSources, eq(seasonSources.id, plants.seasonSourceId))
    .where(and(eq(series.slug, slug), isNull(series.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ─── Coverage + recent ──────────────────────────────────────────────────────

export async function coverageRows(db: Db) {
  const ps = await db
    .select({ id: plants.id, slug: plants.slug, commonName: plants.commonName })
    .from(plants)
    .where(isNull(plants.deletedAt))
    .orderBy(sql`lower(${plants.commonName})`, asc(plants.slug));
  const cov = await coverageByPlant(db);
  return ps.map((p) => ({ ...p, coverage: cov.get(p.id) ?? { varieties: 0, withSellers: 0, lastUpdated: null } }));
}

/** listing_events (newest first) for visible listings; filters crop + since (ISO date). */
export async function recentEventRows(db: Db, opts: { plant?: string[]; since?: string; limit: number }) {
  return db
    .select({ event: listingEvents.event, at: listingEvents.at, listingId: listingEvents.listingId })
    .from(listingEvents)
    .innerJoin(listings, eq(listings.id, listingEvents.listingId))
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(
      and(
        visibleListing,
        activeVariety,
        inArray(listingEvents.event, ["first_seen", "restocked"]),
        opts.plant?.length ? inArray(plants.slug, opts.plant) : undefined,
        opts.since ? gte(listingEvents.at, opts.since) : undefined,
      ),
    )
    .orderBy(desc(listingEvents.at), desc(listingEvents.id))
    .limit(opts.limit);
}

// ─── Search helpers (non-FTS: small tables, case-explicit LIKE) ─────────────

export async function searchPlantRows(db: Db, pattern: string, limit: number, filters: PlantFilters = {}) {
  return db
    .select({ slug: plants.slug, commonName: plants.commonName, latinName: plants.latinName })
    .from(plants)
    .where(and(isNull(plants.deletedAt), ...plantFilterConds(filters), sql`(lower(${plants.commonName}) LIKE ${pattern} OR lower(${plants.latinName}) LIKE ${pattern})`))
    .orderBy(sql`lower(${plants.commonName})`)
    .limit(limit);
}

export async function searchSeriesRows(db: Db, pattern: string, limit: number, filters: PlantFilters = {}) {
  return db
    .select({ slug: series.slug, name: series.name, commonName: plants.commonName })
    .from(series)
    .innerJoin(plants, eq(plants.id, series.plantId))
    .where(and(isNull(series.deletedAt), ...plantFilterConds(filters), sql`lower(${series.name}) LIKE ${pattern}`))
    .orderBy(sql`lower(${series.name})`)
    .limit(limit);
}

export async function searchSellerRows(db: Db, pattern: string, limit: number) {
  return db
    .select({ slug: sellers.slug, name: sellers.name, location: sellers.location })
    .from(sellers)
    .where(and(visibleSeller, sql`lower(${sellers.name}) LIKE ${pattern}`))
    .orderBy(sql`lower(${sellers.name})`)
    .limit(limit);
}

// ─── Sitemap / llms.txt ─────────────────────────────────────────────────────

export async function indexableVarietyRows(db: Db) {
  return db
    .select({ slug: varieties.slug, updatedAt: varieties.updatedAt })
    .from(varieties)
    .where(and(activeVariety, eq(varieties.indexable, true)))
    .orderBy(asc(varieties.slug));
}

export async function allSellerSlugs(db: Db) {
  return db
    .select({ slug: sellers.slug, updatedAt: sellers.updatedAt })
    .from(sellers)
    .where(visibleSeller)
    .orderBy(asc(sellers.slug));
}

export async function allPlantSlugs(db: Db) {
  return db.select({ slug: plants.slug }).from(plants).where(isNull(plants.deletedAt)).orderBy(asc(plants.slug));
}

export async function allSeriesSlugs(db: Db) {
  return db.select({ slug: series.slug, updatedAt: series.updatedAt }).from(series).where(isNull(series.deletedAt)).orderBy(asc(series.slug));
}

export async function catalogCounts(db: Db) {
  const [[v], [s], [l], [p]] = await Promise.all([
    db.select({ n: count() }).from(varieties).where(activeVariety),
    db.select({ n: count() }).from(sellers).where(visibleSeller),
    db
      .select({ n: count() })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .innerJoin(varieties, eq(varieties.id, listings.varietyId))
      .where(and(visibleListing, activeVariety)),
    db.select({ n: count() }).from(plants).where(isNull(plants.deletedAt)),
  ]);
  return { varieties: v?.n ?? 0, sellers: s?.n ?? 0, listings: l?.n ?? 0, plants: p?.n ?? 0 };
}

/** Source label for a listing's curated source row (used by the importer report / tests). */
export async function sourceLabel(db: Db, id: number) {
  const [row] = await db.select({ label: sources.label }).from(sources).where(eq(sources.id, id)).limit(1);
  return row?.label ?? null;
}
