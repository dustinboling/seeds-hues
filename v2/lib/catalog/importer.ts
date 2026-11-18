/**
 * Initial-catalog importer core (FINAL spec §6 + delta design D2). Runtime-agnostic: takes a
 * Drizzle D1 client, so the CLI (scripts/import-catalog.ts, Wrangler platform proxy) and the
 * tests share one code path.
 *
 * Flow: Zod-validate → fail-fast assertions → ONE atomic batch that wipes the curated catalog
 * tables and re-inserts batch(staged) + every row in FK order (full-replace semantics: running it
 * from any state converges to exactly catalog.json) → FTS rebuild → post-load DB assertions →
 * mark published. Event/ops tables (click_events, search_events, reports, review_items, api_keys,
 * fetch_sources, observations, crawl_jobs …) are not touched.
 */
import type { Db } from "@/lib/db/client";
import {
  categories,
  importBatches,
  listingEvents,
  listingPacketSizes,
  listings,
  plants,
  plantSowingMethods,
  priceHistory,
  sellers,
  series,
  sources,
  subcategories,
  varieties,
  varietyAliases,
  varietyTags,
} from "@/lib/db/schema";
import { atomic, type AtomicOp } from "@/lib/repositories/atomic";
import {
  catalogIsEmpty,
  insertOps,
  markBatchPublished,
  orphanCounts,
  setCatalogSeqOp,
  tableCounts,
  wipeCatalogOps,
} from "@/lib/repositories/catalog-write";
import { varietyLevelCounts } from "@/lib/repositories/catalog-stats";
import { catalogSeq } from "@/lib/repositories/seq";
import { ftsRowCount, rebuildFts, searchVarieties } from "@/lib/repositories/fts";
import { normalizeName, slugify } from "@/lib/names";
import { matchWaitlists } from "@/lib/services/waitlist-matcher";
import { CatalogInput } from "./input";
import {
  assertCatalog,
  CatalogAssertionError,
  contentLevel,
  deriveAvailability,
  deriveLastChecked,
  EXPECTED_COUNTS,
  isIndexable,
} from "./assertions";

export const INITIAL_BATCH_LABEL = "initial-catalog";

export interface ImportResult {
  status: "imported" | "replaced";
  batchId: number;
  counts: Awaited<ReturnType<typeof tableCounts>>;
  factualVarieties: number;
  indexableVarieties: number;
  catalogSeq: number;
}

export function parseCatalog(raw: unknown): CatalogInput {
  const parsed = CatalogInput.safeParse(raw);
  if (!parsed.success) {
    throw new CatalogAssertionError(
      parsed.error.issues.slice(0, 50).map((i) => `schema: ${i.path.join(".")}: ${i.message}`),
    );
  }
  assertCatalog(parsed.data);
  return parsed.data;
}

/** Plan rows with explicit integer ids (deterministic, FK-ordered). Pure function. */
export function planRows(c: CatalogInput, batchId: number, now: string) {
  const idOf = <T extends { slug?: string; id?: string }>(arr: T[], key: (t: T) => string) =>
    new Map(arr.map((x, i) => [key(x), i + 1]));

  const sourceIds = idOf(c.sources, (s) => s.id);
  const categoryIds = idOf(c.categories, (x) => x.slug);
  const subcategoryIds = idOf(c.subcategories, (x) => x.slug);
  const plantIds = idOf(c.plants, (x) => x.slug);
  const varietyIds = idOf(c.varieties, (x) => x.slug);
  const sellerIds = idOf(c.sellers, (x) => x.slug);
  const plantBySlug = new Map(c.plants.map((p) => [p.slug, p]));
  const sourceBySlug = new Map(c.sources.map((s) => [s.id, s]));
  // Deterministic updated_seq (design D1): 1..N in import order plants → series → varieties →
  // sellers → listings; catalog_meta.catalog_seq = N.
  let seq = 0;
  const nextSeq = () => ++seq;
  const must = (m: Map<string, number>, k: string, what: string) => {
    const v = m.get(k);
    if (v === undefined) throw new CatalogAssertionError([`unresolved ${what}: ${k}`]);
    return v;
  };

  const sourceRows = c.sources.map((s) => ({
    id: must(sourceIds, s.id, "source"),
    slug: s.id,
    kind: s.kind,
    label: s.label,
    url: s.url,
    checkedDate: s.checkedDate,
    access: s.access,
  }));

  const categoryRows = c.categories.map((x) => ({
    id: must(categoryIds, x.slug, "category"),
    slug: x.slug,
    name: x.name,
    sortOrder: x.sortOrder,
  }));

  const subcategoryRows = c.subcategories.map((x) => ({
    id: must(subcategoryIds, x.slug, "subcategory"),
    categoryId: must(categoryIds, x.category, "category"),
    slug: x.slug,
    name: x.name,
  }));

  const plantRows = c.plants.map((p) => ({
    id: must(plantIds, p.slug, "plant"),
    slug: p.slug,
    commonName: p.commonName,
    latinName: p.latinName,
    description: p.description,
    sowingNotes: p.sowingNotes,
    categoryId: must(categoryIds, p.category, "category"),
    // Unclassified crops stay NULL (never defaulted into a class).
    seasonClass: p.seasonClass ?? null,
    seasonSourceId: p.seasonSource ? must(sourceIds, p.seasonSource, "season source") : null,
    sowingMethodSourceId: p.sowingMethodSource ? must(sourceIds, p.sowingMethodSource, "sowing method source") : null,
    // Crops without grower content stay NULL; the guide is stored as JSON text (as given).
    lifeCycle: p.lifeCycle ?? null,
    hardiness: p.hardiness ?? null,
    growerGuide: p.growerGuide ? JSON.stringify(p.growerGuide) : null,
    growerGuideSourceId: p.growerGuideSource ? must(sourceIds, p.growerGuideSource, "grower guide source") : null,
    updatedSeq: nextSeq(),
  }));
  // Method rows are rewritten with their plant on every import (wiped + re-inserted in the same
  // atomic batch); a crop without methods has none.
  const sowingMethodRows = c.plants.flatMap((p) =>
    [...new Set(p.sowingMethods ?? [])].map((method) => ({ plantId: must(plantIds, p.slug, "plant"), method })),
  );

  // Series rows from variety.series names; slug = <crop>-<series> (canonical §2).
  const seriesKey = (plant: string, name: string) => `${plant}\u0000${name}`;
  const seriesRows: (typeof series.$inferInsert)[] = [];
  const seriesIds = new Map<string, number>();
  for (const v of c.varieties) {
    if (!v.series) continue;
    const key = seriesKey(v.plant, v.series);
    if (seriesIds.has(key)) continue;
    const id = seriesRows.length + 1;
    seriesIds.set(key, id);
    seriesRows.push({
      id,
      slug: `${v.plant}-${slugify(v.series)}`,
      name: v.series,
      plantId: must(plantIds, v.plant, "plant"),
      createdAt: now,
      updatedAt: now,
      updatedSeq: nextSeq(),
    });
  }

  const varietyRows = c.varieties.map((v) => {
    const plant = plantBySlug.get(v.plant);
    const level = contentLevel(v, plant);
    return {
      id: must(varietyIds, v.slug, "variety"),
      plantId: must(plantIds, v.plant, "plant"),
      slug: v.slug,
      varietyName: v.varietyName,
      categoryId: must(categoryIds, plant?.category ?? "", "category"),
      subcategoryId: v.subcategory ? must(subcategoryIds, v.subcategory, "subcategory") : null,
      description: v.description,
      sowingNotes: v.sowingNotes,
      heightCm: v.heightCm,
      colorSwatch: v.colorSwatch ? v.colorSwatch.toUpperCase() : null,
      status: "active" as const,
      contentLevel: level,
      // Imported varieties are always active → indexable under the 2026-11-16 owner ruling.
      indexable: isIndexable("active"),
      protection: v.protection,
      protectionNote: v.protectionNote,
      sourceId: must(sourceIds, v.sourceId, "source"),
      seriesId: v.series ? (seriesIds.get(seriesKey(v.plant, v.series)) ?? null) : null,
      // Absent → 'unknown' (explicit unknown, never guessed).
      colorFamily: v.colorFamily ?? "unknown",
      createdAt: now,
      updatedAt: now,
      updatedSeq: nextSeq(),
    };
  });

  const tagRows = c.varieties.flatMap((v) =>
    [...new Set(v.tags)].map((tag) => ({ varietyId: must(varietyIds, v.slug, "variety"), tag })),
  );
  const aliasRows = c.varieties.flatMap((v) =>
    [...new Set(v.aliases ?? [])].map((alias) => ({
      varietyId: must(varietyIds, v.slug, "variety"),
      alias,
      nameNormalized: normalizeName(alias, plantBySlug.get(v.plant)?.commonName),
      kind: "synonym" as const,
    })),
  );

  const sellerRows = c.sellers.map((s) => ({
    id: must(sellerIds, s.slug, "seller"),
    slug: s.slug,
    name: s.name,
    type: s.type,
    homepage: s.homepage,
    description: s.description,
    orderingNotes: s.orderingNotes,
    location: s.location,
    status: s.status,
    provenance: s.provenance,
    listingPolicy: s.listingPolicy,
    platform: s.platform,
    ratingCount: 0,
    ratingSum: 0,
    ratingAverage: null,
    createdAt: now,
    updatedAt: now,
    eligibility: s.eligibility,
    approvedAt: s.approvedAt,
    termsReviewedAt: s.termsReviewedAt,
    approvalNote: s.approvalNote,
    domain: s.domain,
    crawlPolicy: s.crawlPolicy,
    claimStatus: s.claimStatus,
    country: s.country,
    region: s.region,
    shipsTo: JSON.stringify(s.shipsTo),
    isSiteOwner: s.isSiteOwner,
    importedRatingSource: s.importedRating?.source ?? null,
    importedRatingPlaceName: s.importedRating?.placeName ?? null,
    importedRatingPlaceId: s.importedRating?.placeId ?? null,
    importedRatingValue: s.importedRating?.rating ?? null,
    importedRatingCount: s.importedRating?.reviewCount ?? null,
    importedRatingFetchedAt: s.importedRating?.fetchedDate ?? null,
    updatedSeq: nextSeq(),
  }));

  const listingRows: (typeof listings.$inferInsert)[] = [];
  const packetRows: (typeof listingPacketSizes.$inferInsert)[] = [];
  const historyRows: (typeof priceHistory.$inferInsert)[] = [];
  const eventRows: (typeof listingEvents.$inferInsert)[] = [];
  // UNIQUE (seller_id, product_url, variant_key): curated listings that share one collection URL
  // per seller get variant_key "variety:<slug>" (same rule as migration 0002).
  const urlUses = new Map<string, number>();
  for (const l of c.listings) if (l.productUrl) urlUses.set(`${l.seller} ${l.productUrl}`, (urlUses.get(`${l.seller} ${l.productUrl}`) ?? 0) + 1);
  let packetId = 0;
  c.listings.forEach((l, i) => {
    const listingId = i + 1;
    const sourceId = must(sourceIds, l.sourceId, "source");
    const lastChecked = deriveLastChecked(l, sourceBySlug.get(l.sourceId)?.checkedDate ?? null) ?? now.slice(0, 10);
    eventRows.push({ id: listingId, listingId, event: "first_seen", at: lastChecked });
    listingRows.push({
      id: listingId,
      varietyId: must(varietyIds, l.variety, "variety"),
      sellerId: must(sellerIds, l.seller, "seller"),
      sourceId,
      sku: l.sku,
      productUrl: l.productUrl,
      notes: l.notes,
      status: l.status,
      createdAt: now,
      updatedAt: now,
      availability: deriveAvailability(l),
      variantKey: l.productUrl && (urlUses.get(`${l.seller} ${l.productUrl}`) ?? 0) > 1 ? `variety:${l.variety}` : "",
      externalProductId: l.sku,
      titleRaw: null,
      channel: "external",
      matchMethod: "human",
      confidence: 1,
      sourceUrl: l.productUrl,
      firstSeenAt: lastChecked,
      lastCheckedAt: lastChecked,
      updatedSeq: nextSeq(),
    });
    l.packetSizes.forEach((pk, sortOrder) => {
      packetId += 1;
      packetRows.push({
        id: packetId,
        listingId,
        label: pk.label,
        seedCount: pk.seedCount,
        priceCents: pk.priceCents,
        currency: "USD",
        priceSource: pk.priceSource,
        priceCheckDate: pk.priceCheckDate,
        inStock: pk.inStock,
        sortOrder,
      });
      if (pk.priceCents !== null && pk.priceCheckDate) {
        historyRows.push({ packetSizeId: packetId, priceCents: pk.priceCents, checkedDate: pk.priceCheckDate, sourceId });
      }
    });
  });

  const manifest = {
    label: INITIAL_BATCH_LABEL,
    note: c.batch.note,
    file: "seed-data/catalog.json",
    expected: EXPECTED_COUNTS,
    sources: c.sources.map((s) => s.id),
    sellerProvenance: Object.fromEntries(c.sellers.map((s) => [s.slug, s.provenance])),
  };

  return {
    batch: { id: batchId, label: INITIAL_BATCH_LABEL, sourceId: null, manifest, status: "staged" as const, createdAt: now },
    sourceRows,
    categoryRows,
    subcategoryRows,
    plantRows,
    sowingMethodRows,
    seriesRows,
    varietyRows,
    tagRows,
    aliasRows,
    sellerRows,
    listingRows,
    packetRows,
    historyRows,
    eventRows,
    catalogSeq: seq,
  };
}

export async function importCatalog(
  db: Db,
  raw: unknown,
  opts: { log?: (msg: string) => void; now?: string } = {},
): Promise<ImportResult> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? new Date().toISOString();
  const catalog = parseCatalog(raw);
  log("✓ catalog.json validated (Zod) and pre-load assertions passed");

  const wasEmpty = await catalogIsEmpty(db);
  const batchId = 1;
  const plan = planRows(catalog, batchId, now);
  const ops: AtomicOp[] = [
    ...wipeCatalogOps(db),
    ...insertOps(db, sources, plan.sourceRows),
    db.insert(importBatches).values(plan.batch) as unknown as AtomicOp,
    ...insertOps(db, categories, plan.categoryRows),
    ...insertOps(db, subcategories, plan.subcategoryRows),
    ...insertOps(db, plants, plan.plantRows),
    ...insertOps(db, plantSowingMethods, plan.sowingMethodRows),
    ...insertOps(db, series, plan.seriesRows),
    ...insertOps(db, varieties, plan.varietyRows),
    ...insertOps(db, varietyTags, plan.tagRows),
    ...insertOps(db, varietyAliases, plan.aliasRows),
    ...insertOps(db, sellers, plan.sellerRows),
    ...insertOps(db, listings, plan.listingRows),
    ...insertOps(db, listingPacketSizes, plan.packetRows),
    ...insertOps(db, priceHistory, plan.historyRows),
    ...insertOps(db, listingEvents, plan.eventRows),
    setCatalogSeqOp(db, plan.catalogSeq),
  ];
  await atomic(db, ops);
  log(`✓ ${wasEmpty ? "loaded" : "replaced"} batch ${INITIAL_BATCH_LABEL} (${ops.length} statements, one atomic batch)`);

  await rebuildFts(db);
  log("✓ FTS index rebuilt");

  await postLoadAssertions(db, plan);
  log("✓ post-load assertions passed (counts, approvals, provenance, orphans, FTS, seq)");

  await markBatchPublished(db, batchId, new Date().toISOString());
  log(`✓ batch ${INITIAL_BATCH_LABEL} marked published`);

  // Publish trigger (Phase 3): a bulk import can give waited-for varieties their first listing.
  // Full set (null = every variety with un-notified waiters); the outbox UNIQUE dedupes.
  const matched = await matchWaitlists(db, null);
  if (matched.queued.email + matched.queued.sms > 0) log(`✓ waiting lists: ${matched.queued.email} email + ${matched.queued.sms} text alerts queued`);
  return summarise(db, wasEmpty ? "imported" : "replaced", batchId);
}

async function postLoadAssertions(db: Db, plan: ReturnType<typeof planRows>): Promise<void> {
  const problems: string[] = [];
  const counts = await tableCounts(db);
  for (const [k, expected] of Object.entries(EXPECTED_COUNTS)) {
    const got = counts[k as keyof typeof counts];
    if (got !== expected) problems.push(`DB count ${k}: expected ${expected}, got ${got}`);
  }
  if (counts.priceHistory !== plan.historyRows.length)
    problems.push(`price_history rows: expected ${plan.historyRows.length}, got ${counts.priceHistory}`);
  if (counts.plantSowingMethods !== plan.sowingMethodRows.length)
    problems.push(`plant_sowing_methods rows: expected ${plan.sowingMethodRows.length}, got ${counts.plantSowingMethods}`);
  if (counts.series !== plan.seriesRows.length) problems.push(`series rows: expected ${plan.seriesRows.length}, got ${counts.series}`);
  if (counts.listingEvents !== counts.listings) problems.push(`listing_events ${counts.listingEvents} ≠ listings ${counts.listings}`);
  if (counts.approvedSellers !== counts.sellers) problems.push(`approved sellers ${counts.approvedSellers} ≠ sellers ${counts.sellers}`);
  if (counts.listingsWithoutCheckDate !== 0) problems.push(`${counts.listingsWithoutCheckDate} listings without last_checked_at`);
  if (counts.media !== 0) problems.push("media must ship empty");
  if (counts.matchQueue !== 0) problems.push("match_queue must be empty in Phase 1");
  for (const [k, n] of Object.entries(await orphanCounts(db))) if (n !== 0) problems.push(`${k}: ${n}`);
  const fts = await ftsRowCount(db);
  if (fts !== counts.varieties) problems.push(`FTS rows ${fts} ≠ varieties ${counts.varieties}`);
  const smoke = await searchVarieties(db, "sweet pea", { limit: 5 });
  if (smoke.length === 0) problems.push('FTS smoke query "sweet pea" returned nothing');
  const seqNow = await catalogSeq(db);
  if (seqNow !== plan.catalogSeq) problems.push(`catalog_seq ${seqNow} ≠ ${plan.catalogSeq}`);
  if (problems.length) throw new CatalogAssertionError(problems);
}

async function summarise(db: Db, status: ImportResult["status"], batchId: number): Promise<ImportResult> {
  const counts = await tableCounts(db);
  const levels = await varietyLevelCounts(db);
  return {
    status,
    batchId,
    counts,
    factualVarieties: levels.factual,
    indexableVarieties: levels.indexable,
    catalogSeq: await catalogSeq(db),
  };
}
