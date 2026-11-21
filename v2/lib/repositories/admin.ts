/**
 * Admin repository (R11, R8): review_items, seller eligibility changes incl. removal, variety
 * creation + merge, and the health invariants. Catalog writes bump catalog_seq in the same
 * atomic() batch.
 */
import { and, asc, count, desc, eq, inArray, isNull, min, ne, not, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  blockedDomains,
  catalogMeta,
  listingEvents,
  listings,
  plants,
  reviewItems,
  sellerNotes,
  sellers,
  series,
  varieties,
  varietyAliases,
  REVIEW_ITEM_STATUS,
  REVIEW_ITEM_TYPE,
  VISIBLE_LISTING_STATUS,
} from "@/lib/db/schema";
import { SELLER_UPDATE_FIELDS, type BadgeFilter, type ListingStateFilter, type SellerSort, type SellerUpdateField } from "@/lib/admin/sellers";
import { normalizeName, slugify } from "@/lib/names";
import { atomic, type AtomicOp } from "./atomic";
import { ensureIngestSource, recomputeIndexable } from "./ingest";
import { CATALOG_SEQ_KEY, currentSeq, nextSeq } from "./seq";

export type ReviewType = (typeof REVIEW_ITEM_TYPE)[number];
export type ReviewStatus = (typeof REVIEW_ITEM_STATUS)[number];

/** A UI-path decision maker, stamped onto the resolved row (Slice A decider trail). */
export interface Decider {
  userId: number;
  name: string;
}

// ─── review_items ───────────────────────────────────────────────────────────

export async function insertReviewItem(
  db: Db,
  row: { type: ReviewType; groupKey: string; proposal: unknown; reason: string | null; confidence: number | null; at: string },
): Promise<number> {
  const [r] = await db
    .insert(reviewItems)
    .values({
      type: row.type,
      groupKey: row.groupKey,
      proposal: JSON.stringify(row.proposal),
      reason: row.reason,
      confidence: row.confidence,
      createdAt: row.at,
    })
    .returning({ id: reviewItems.id });
  return r!.id;
}

export async function listReviewItems(
  db: Db,
  f: { type?: ReviewType; types?: ReviewType[]; status?: ReviewStatus; statuses?: ReviewStatus[]; limit: number; offset?: number; order?: "group" | "queue" },
) {
  const rows = await db
    .select()
    .from(reviewItems)
    .where(
      and(
        f.type ? eq(reviewItems.type, f.type) : undefined,
        f.types ? inArray(reviewItems.type, f.types) : undefined,
        f.status ? eq(reviewItems.status, f.status) : undefined,
        f.statuses ? inArray(reviewItems.status, f.statuses) : undefined,
      ),
    )
    // "group" is the historical API order; "queue" is oldest-first (the queue is a fairness
    // device — Slice A lists).
    .orderBy(
      ...(f.order === "queue"
        ? [asc(reviewItems.createdAt), asc(reviewItems.id)]
        : [asc(reviewItems.groupKey), asc(reviewItems.createdAt), asc(reviewItems.id)]),
    )
    .limit(f.limit)
    .offset(f.offset ?? 0);
  return rows.map((r) => ({ ...r, proposal: JSON.parse(r.proposal) as unknown }));
}

export async function reviewItemById(db: Db, id: number) {
  const [r] = await db.select().from(reviewItems).where(eq(reviewItems.id, id)).limit(1);
  return r ? { ...r, proposal: JSON.parse(r.proposal) as Record<string, unknown> } : null;
}

export async function resolveReviewItem(
  db: Db,
  id: number,
  status: Exclude<ReviewStatus, "pending">,
  at: string,
  extra: { decider?: Decider; reason?: string } = {},
): Promise<void> {
  await db
    .update(reviewItems)
    .set({
      status,
      resolvedAt: at,
      ...(extra.decider ? { decidedByUserId: extra.decider.userId, decidedByName: extra.decider.name } : {}),
      ...(extra.reason !== undefined ? { reason: extra.reason } : {}),
    })
    .where(eq(reviewItems.id, id));
}

/** A reviewer-confirmed report: stamped verified, still pending (an admin acts next). */
export async function stampReviewVerified(db: Db, id: number, name: string, at: string): Promise<void> {
  await db.update(reviewItems).set({ verifiedByName: name, verifiedAt: at }).where(eq(reviewItems.id, id));
}

/** A skipped hold: recorded as seen, never as decided — the item stays pending. */
export async function stampReviewSeen(db: Db, id: number, name: string, at: string): Promise<void> {
  await db.update(reviewItems).set({ seenByName: name, seenAt: at }).where(eq(reviewItems.id, id));
}

export async function countReviewItems(db: Db, f: { types?: ReviewType[]; statuses?: ReviewStatus[] }): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(reviewItems)
    .where(and(f.types ? inArray(reviewItems.type, f.types) : undefined, f.statuses ? inArray(reviewItems.status, f.statuses) : undefined));
  return r?.n ?? 0;
}

/** Waiting items in these types strictly older than (createdAt, id) — the "3 of 8" rank. */
export async function countOlderWaiting(db: Db, types: ReviewType[], createdAt: string, id: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(reviewItems)
    .where(
      and(
        inArray(reviewItems.type, types),
        eq(reviewItems.status, "pending"),
        sql`(${reviewItems.createdAt} < ${createdAt} OR (${reviewItems.createdAt} = ${createdAt} AND ${reviewItems.id} < ${id}))`,
      ),
    );
  return r?.n ?? 0;
}

/** Decision history for a queue: newest first. */
export async function listDecidedReviewItems(db: Db, f: { types: ReviewType[]; limit: number; offset?: number }) {
  const rows = await db
    .select()
    .from(reviewItems)
    .where(and(inArray(reviewItems.type, f.types), ne(reviewItems.status, "pending")))
    .orderBy(desc(reviewItems.resolvedAt), desc(reviewItems.id))
    .limit(f.limit)
    .offset(f.offset ?? 0);
  return rows.map((r) => ({ ...r, proposal: JSON.parse(r.proposal) as unknown }));
}

/**
 * The pending hold for this (normalized held name, candidate variety) pair, if any — the
 * feed is idempotent on it: re-submitting a pending hold returns the existing item.
 */
export async function findPendingDuplicateHold(db: Db, groupKey: string, candidateVarietyId: number) {
  const rows = await db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.type, "duplicate_hold"), eq(reviewItems.status, "pending"), eq(reviewItems.groupKey, groupKey)))
    .orderBy(asc(reviewItems.id));
  for (const r of rows) {
    const p = JSON.parse(r.proposal) as Record<string, unknown>;
    const candidate = p.candidate as Record<string, unknown> | undefined;
    if (candidate && Number(candidate.variety_id) === candidateVarietyId) return { ...r, proposal: p };
  }
  return null;
}

export async function reviewQueueStats(db: Db) {
  const [r] = await db
    .select({ depth: count(), oldest: min(reviewItems.createdAt) })
    .from(reviewItems)
    .where(eq(reviewItems.status, "pending"));
  return { depth: r?.depth ?? 0, oldest: r?.oldest ?? null };
}

// ─── sellers ────────────────────────────────────────────────────────────────

export async function createCandidateSeller(
  db: Db,
  c: { name: string; homepage: string; domain: string; at: string },
): Promise<{ id: number; slug: string }> {
  let slug = slugify(c.name) || slugify(c.domain);
  const [clash] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, slug)).limit(1);
  if (clash) slug = `${slug}-${slugify(c.domain)}`.slice(0, 80);
  await atomic(db, [
    ...nextSeq(db),
    db.insert(sellers).values({
      slug,
      name: c.name,
      type: "specialty",
      homepage: c.homepage,
      domain: c.domain,
      provenance: "research-candidate",
      eligibility: "candidate",
      crawlPolicy: "manual_only",
      createdAt: c.at,
      updatedAt: c.at,
      updatedSeq: currentSeq(),
    }) as unknown as AtomicOp,
  ]);
  const [r] = await db.select({ id: sellers.id, slug: sellers.slug }).from(sellers).where(eq(sellers.slug, slug)).limit(1);
  return r!;
}

export async function setSellerEligibility(db: Db, sellerId: number, eligibility: "approved" | "rejected", at: string, note?: string) {
  const ops: AtomicOp[] = [
    ...nextSeq(db),
    db
      .update(sellers)
      .set({
        eligibility,
        ...(eligibility === "approved" ? { approvedAt: at } : {}),
        ...(note ? { approvalNote: note } : {}),
        updatedAt: at,
        updatedSeq: currentSeq(),
      })
      .where(eq(sellers.id, sellerId)) as unknown as AtomicOp,
  ];
  if (eligibility === "rejected") {
    // A rejected seller's listings come down with it (health invariant: no published listing
    // from an unapproved seller).
    ops.push(
      ...nextSeq(db),
      db
        .update(listings)
        .set({ status: "rejected", updatedAt: at, updatedSeq: currentSeq() })
        .where(and(eq(listings.sellerId, sellerId), inArray(listings.status, [...VISIBLE_LISTING_STATUS]))) as unknown as AtomicOp,
    );
  }
  await atomic(db, ops);
}

/**
 * The "Small farm" badge (Open Directory): a recorded judgment call, independent of eligibility.
 * Bumps catalog_seq + the seller's updated_seq so sync/snapshot consumers see the change. No
 * listing side-effects: badging or unbadging a seller never publishes or unpublishes a listing.
 * Returns the slugs of the varieties this seller lists — their (ISR) pages render the badge on the
 * seller's rows, so the caller revalidates them.
 */
export async function setSellerSmallFarm(
  db: Db,
  sellerId: number,
  isSmallFarm: boolean,
  at: string,
): Promise<{ varietySlugs: string[] }> {
  await atomic(db, [
    ...nextSeq(db),
    db
      .update(sellers)
      .set({ isSmallFarm, updatedAt: at, updatedSeq: currentSeq() })
      .where(eq(sellers.id, sellerId)) as unknown as AtomicOp,
  ]);
  const rows = await db
    .selectDistinct({ slug: varieties.slug })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(and(eq(listings.sellerId, sellerId), ne(listings.status, "removed"), isNull(listings.deletedAt)));
  return { varietySlugs: rows.map((r) => r.slug).sort() };
}

/**
 * Removal at the seller's request (R8): eligibility → removed_by_request, every listing →
 * removed, domain → blocked_domains. Returns the slugs whose pages must be revalidated.
 */
export async function removeSeller(db: Db, sellerId: number, reason: string, at: string) {
  const [s] = await db.select({ slug: sellers.slug, domain: sellers.domain }).from(sellers).where(eq(sellers.id, sellerId)).limit(1);
  if (!s) return null;
  const affected = await db
    .select({ id: listings.id, varietyId: listings.varietyId, slug: varieties.slug })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(and(eq(listings.sellerId, sellerId), ne(listings.status, "removed")));
  const ops: AtomicOp[] = [
    ...nextSeq(db),
    db
      .update(sellers)
      .set({ eligibility: "removed_by_request", updatedAt: at, updatedSeq: currentSeq() })
      .where(eq(sellers.id, sellerId)) as unknown as AtomicOp,
    ...nextSeq(db),
    db
      .update(listings)
      .set({ status: "removed", updatedAt: at, updatedSeq: currentSeq() })
      .where(eq(listings.sellerId, sellerId)) as unknown as AtomicOp,
  ];
  for (const l of affected) {
    ops.push(db.insert(listingEvents).values({ listingId: l.id, event: "gone", at, reason }) as unknown as AtomicOp);
  }
  if (s.domain) {
    ops.push(db.insert(blockedDomains).values({ domain: s.domain, reason, createdAt: at }).onConflictDoNothing() as unknown as AtomicOp);
  }
  await atomic(db, ops);
  await recomputeIndexable(db, affected.map((a) => a.varietyId));
  return { sellerSlug: s.slug, domain: s.domain, listings: affected.length, varietySlugs: [...new Set(affected.map((a) => a.slug))] };
}

/**
 * Remove one listing (admin). Unknown id → null. Already removed → `alreadyRemoved: true` with
 * nothing written (no second 'gone' event, no seq bump). Otherwise the status flip and the 'gone'
 * event (carrying `reason`, null when none was given) land atomically, then the variety's
 * indexable flag is recomputed.
 */
export async function removeListing(db: Db, listingId: number, reason: string | null, at: string) {
  const [l] = await db
    .select({
      status: listings.status,
      varietyId: listings.varietyId,
      varietySlug: varieties.slug,
      sellerSlug: sellers.slug,
    })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!l) return null;
  const slugs = { varietySlug: l.varietySlug, sellerSlug: l.sellerSlug };
  if (l.status === "removed") return { alreadyRemoved: true, ...slugs };
  // Single winner (a concurrent remove can pass the SELECT above too). D1 runs a batch as one
  // transaction and batches never interleave, so every statement below sees the same pre-state as
  // long as the guarded flip is LAST: the seq bump and the 'gone' event are written only while the
  // listing is still live (INSERT … SELECT … WHERE), then the flip itself is guarded the same way.
  // A loser's three statements all match nothing: no bump, no event, no row change.
  const stillLive = sql`EXISTS (SELECT 1 FROM listings WHERE id = ${listingId} AND status <> 'removed')`;
  const results = await atomic(db, [
    // = nextSeq(), conditional (INSERT … SELECT needs the WHERE to disambiguate ON CONFLICT).
    db
      .insert(catalogMeta)
      .select(sql`SELECT ${CATALOG_SEQ_KEY}, 1 WHERE ${stillLive}`)
      .onConflictDoUpdate({ target: catalogMeta.key, set: { value: sql`${catalogMeta.value} + 1` } }) as unknown as AtomicOp,
    // Columns in table order: id (NULL → rowid), listing_id, event, at, reason.
    db
      .insert(listingEvents)
      .select(sql`SELECT NULL, ${listingId}, 'gone', ${at}, ${reason} WHERE ${stillLive}`) as unknown as AtomicOp,
    db
      .update(listings)
      .set({ status: "removed", updatedAt: at, updatedSeq: currentSeq() })
      .where(and(eq(listings.id, listingId), ne(listings.status, "removed")))
      .returning({ id: listings.id }) as unknown as AtomicOp,
  ]);
  const won = (results[2] as { id: number }[]).length === 1;
  if (!won) return { alreadyRemoved: true, ...slugs };
  await recomputeIndexable(db, [l.varietyId]);
  return { alreadyRemoved: false, ...slugs };
}

const CORRECTABLE = ["name", "location", "region", "homepage", "description", "orderingNotes", "shipsTo"] as const;
export type SellerCorrection = Partial<Record<(typeof CORRECTABLE)[number], string | string[] | null>>;

export async function applySellerCorrection(db: Db, sellerId: number, fields: SellerCorrection, at: string): Promise<string[]> {
  const set: Record<string, unknown> = {};
  for (const k of CORRECTABLE) {
    if (!(k in fields)) continue;
    const v = fields[k];
    set[k] = k === "shipsTo" ? JSON.stringify(Array.isArray(v) && v.length ? v : ["unknown"]) : v;
  }
  const changed = Object.keys(set);
  if (changed.length === 0) return [];
  await atomic(db, [
    ...nextSeq(db),
    db.update(sellers).set({ ...set, updatedAt: at, updatedSeq: currentSeq() }).where(eq(sellers.id, sellerId)) as unknown as AtomicOp,
  ]);
  return changed;
}

// ─── varieties ──────────────────────────────────────────────────────────────

export async function plantBySlug(db: Db, slug: string) {
  const [p] = await db
    .select({ id: plants.id, slug: plants.slug, commonName: plants.commonName, categoryId: plants.categoryId })
    .from(plants)
    .where(and(eq(plants.slug, slug), isNull(plants.deletedAt)))
    .limit(1);
  return p ?? null;
}

/** Create a variety from an approved new_variety proposal (plus its primary name row). */
export async function createVariety(db: Db, v: { plantSlug: string; name: string; at: string }): Promise<{ id: number; slug: string } | null> {
  const plant = await plantBySlug(db, v.plantSlug);
  if (!plant) return null;
  const sourceId = await ensureIngestSource(db);
  let slug = slugify(`${plant.slug} ${v.name}`);
  const [clash] = await db.select({ id: varieties.id }).from(varieties).where(eq(varieties.slug, slug)).limit(1);
  if (clash) slug = `${slug}-${Date.parse(v.at).toString(36)}`.slice(0, 80);
  await atomic(db, [
    ...nextSeq(db),
    db.insert(varieties).values({
      plantId: plant.id,
      categoryId: plant.categoryId,
      slug,
      varietyName: v.name,
      sourceId,
      status: "active",
      createdAt: v.at,
      updatedAt: v.at,
      updatedSeq: currentSeq(),
    }) as unknown as AtomicOp,
    db.insert(varietyAliases).values({
      varietyId: sql<number>`(SELECT id FROM varieties WHERE slug = ${slug})`,
      alias: v.name,
      nameNormalized: normalizeName(v.name, plant.commonName),
      kind: "primary",
    }) as unknown as AtomicOp,
  ]);
  const [r] = await db.select({ id: varieties.id, slug: varieties.slug }).from(varieties).where(eq(varieties.slug, slug)).limit(1);
  return r ?? null;
}

export interface AliasProvenance {
  source: string;
  decisionItemId: number;
  decidedByName: string;
  createdAt: string;
}

/**
 * Save a seller's wording as a seller_alias so the next crawl matches it exactly. Only
 * duplicate decisions pass provenance (source = 'duplicate_decision'); everything else
 * leaves it NULL (= legacy/manual). When the alias already exists on the variety it is
 * never duplicated (the PK forbids it) — provenance is filled in only where absent, so a
 * recorded decision trail is never overwritten.
 */
export async function addAlias(
  db: Db,
  varietyId: number,
  alias: string,
  kind: "synonym" | "seller_alias",
  cropCommonName: string | null,
  provenance?: AliasProvenance,
) {
  const ops: AtomicOp[] = [
    ...nextSeq(db),
    db
      .insert(varietyAliases)
      .values({
        varietyId,
        alias,
        nameNormalized: normalizeName(alias, cropCommonName),
        kind,
        ...(provenance ? { source: provenance.source, decisionItemId: provenance.decisionItemId, decidedByName: provenance.decidedByName, createdAt: provenance.createdAt } : {}),
      })
      .onConflictDoNothing() as unknown as AtomicOp,
  ];
  if (provenance) {
    ops.push(
      db
        .update(varietyAliases)
        .set({ source: provenance.source, decisionItemId: provenance.decisionItemId, decidedByName: provenance.decidedByName, createdAt: provenance.createdAt })
        .where(and(eq(varietyAliases.varietyId, varietyId), eq(varietyAliases.alias, alias), isNull(varietyAliases.source))) as unknown as AtomicOp,
    );
  }
  ops.push(db.update(varieties).set({ updatedSeq: currentSeq() }).where(eq(varieties.id, varietyId)) as unknown as AtomicOp);
  await atomic(db, ops);
}

/** One alias row with its provenance (the duplicate-decision audit + Slice C's F2). */
export async function aliasRow(db: Db, varietyId: number, alias: string) {
  const [r] = await db
    .select()
    .from(varietyAliases)
    .where(and(eq(varietyAliases.varietyId, varietyId), eq(varietyAliases.alias, alias)))
    .limit(1);
  return r ?? null;
}

/**
 * Merge `loserId` into `winnerId`: loser → status merged + merged_into_id; its names (and its
 * primary name, as a synonym) and listings move to the winner. Listings keep their own key
 * (seller, URL, variant) so no uniqueness clash can arise.
 */
export async function mergeVarieties(db: Db, loserId: number, winnerId: number, at: string) {
  const [loser] = await db
    .select({ id: varieties.id, name: varieties.varietyName, slug: varieties.slug, commonName: plants.commonName })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(eq(varieties.id, loserId))
    .limit(1);
  const [winner] = await db.select({ id: varieties.id, slug: varieties.slug }).from(varieties).where(and(eq(varieties.id, winnerId), eq(varieties.status, "active"))).limit(1);
  if (!loser || !winner || loser.id === winner.id) return null;
  const names = await db.select().from(varietyAliases).where(eq(varietyAliases.varietyId, loserId));
  const moved = [
    ...names.map((n) => ({ ...n, varietyId: winnerId, kind: n.kind === "primary" ? ("synonym" as const) : n.kind })),
    { varietyId: winnerId, alias: loser.name, nameNormalized: normalizeName(loser.name, loser.commonName), kind: "synonym" as const },
  ];
  const ops: AtomicOp[] = [];
  for (const n of moved) ops.push(db.insert(varietyAliases).values(n).onConflictDoNothing() as unknown as AtomicOp);
  ops.push(
    db.delete(varietyAliases).where(eq(varietyAliases.varietyId, loserId)) as unknown as AtomicOp,
    ...nextSeq(db),
    db.update(listings).set({ varietyId: winnerId, updatedAt: at, updatedSeq: currentSeq() }).where(eq(listings.varietyId, loserId)) as unknown as AtomicOp,
    ...nextSeq(db),
    db
      .update(varieties)
      .set({ status: "merged", mergedIntoId: winnerId, indexable: false, updatedAt: at, updatedSeq: currentSeq() })
      .where(eq(varieties.id, loserId)) as unknown as AtomicOp,
    ...nextSeq(db),
    db.update(varieties).set({ updatedAt: at, updatedSeq: currentSeq() }).where(eq(varieties.id, winnerId)) as unknown as AtomicOp,
  );
  await atomic(db, ops);
  await recomputeIndexable(db, [winnerId]);
  return { loserSlug: loser.slug, winnerSlug: winner.slug };
}

// ─── Slice A detail hydration (the queue workspaces read through these) ───────

export interface VarietyDetail {
  id: number;
  slug: string;
  name: string;
  status: string;
  plantSlug: string;
  commonName: string;
  latinName: string | null;
  seriesName: string | null;
  /** Distinct sellers with a visible listing. */
  sellerCount: number;
  /** Alternate names (every kind except primary), A–Z. */
  aliases: string[];
  /** Listing evidence, oldest first (capped — the count above stays exact). */
  listings: { sellerName: string; sellerSlug: string; titleRaw: string | null; productUrl: string | null }[];
}

/** A variety with its crop, series, alternate names and listing evidence (any status). */
export async function varietyDetailById(db: Db, id: number): Promise<VarietyDetail | null> {
  const [v] = await db
    .select({
      id: varieties.id,
      slug: varieties.slug,
      name: varieties.varietyName,
      status: varieties.status,
      plantSlug: plants.slug,
      commonName: plants.commonName,
      latinName: plants.latinName,
      seriesName: series.name,
    })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .leftJoin(series, eq(series.id, varieties.seriesId))
    .where(eq(varieties.id, id))
    .limit(1);
  if (!v) return null;
  const live = and(eq(listings.varietyId, id), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt));
  const [aliases, sellerRows, listingRows] = await Promise.all([
    db
      .select({ alias: varietyAliases.alias })
      .from(varietyAliases)
      .where(and(eq(varietyAliases.varietyId, id), ne(varietyAliases.kind, "primary")))
      .orderBy(asc(varietyAliases.alias)),
    db.selectDistinct({ sellerId: listings.sellerId }).from(listings).where(live),
    db
      .select({ sellerName: sellers.name, sellerSlug: sellers.slug, titleRaw: listings.titleRaw, productUrl: listings.productUrl })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .where(live)
      .orderBy(asc(listings.id))
      .limit(25),
  ]);
  return {
    ...v,
    sellerCount: sellerRows.length,
    aliases: aliases.map((a) => a.alias),
    listings: listingRows,
  };
}

/** varietyDetailById by slug (report targets are slugs). */
export async function varietyDetailBySlug(db: Db, slug: string): Promise<VarietyDetail | null> {
  const [v] = await db.select({ id: varieties.id }).from(varieties).where(eq(varieties.slug, slug)).limit(1);
  return v ? varietyDetailById(db, v.id) : null;
}

/**
 * Follow a merged-away variety to its surviving target (the C4 stale-candidate path):
 * the active variety at the end of the chain, or null when the chain ends nowhere live.
 */
export async function resolveVarietyTarget(db: Db, id: number): Promise<{ id: number; slug: string } | null> {
  let current = id;
  for (let hops = 0; hops < 10; hops++) {
    const [v] = await db
      .select({ id: varieties.id, slug: varieties.slug, status: varieties.status, mergedIntoId: varieties.mergedIntoId })
      .from(varieties)
      .where(eq(varieties.id, current))
      .limit(1);
    if (!v) return null;
    if (v.status === "active") return { id: v.id, slug: v.slug };
    if (v.status !== "merged" || !v.mergedIntoId) return null;
    current = v.mergedIntoId;
  }
  return null;
}

export interface SellerRecord {
  id: number;
  slug: string;
  name: string;
  homepage: string | null;
  domain: string | null;
  location: string | null;
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
  status: string;
  eligibility: string;
  isSmallFarm: boolean;
  liveListingCount: number;
}

/** A seller's record as the report views show it, plus its live listing count. */
export async function sellerRecordByRef(db: Db, ref: string | number): Promise<SellerRecord | null> {
  const where = typeof ref === "number" || /^\d+$/.test(String(ref)) ? eq(sellers.id, Number(ref)) : eq(sellers.slug, String(ref));
  const [s] = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      name: sellers.name,
      homepage: sellers.homepage,
      domain: sellers.domain,
      location: sellers.location,
      region: sellers.region,
      country: sellers.country,
      shipsTo: sellers.shipsTo,
      description: sellers.description,
      orderingNotes: sellers.orderingNotes,
      status: sellers.status,
      eligibility: sellers.eligibility,
      isSmallFarm: sellers.isSmallFarm,
    })
    .from(sellers)
    .where(where)
    .limit(1);
  if (!s) return null;
  return { ...s, liveListingCount: await liveListingCountForSeller(db, s.id) };
}

export async function liveListingCountForSeller(db: Db, sellerId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.sellerId, sellerId), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)));
  return r?.n ?? 0;
}

export interface ListingSummary {
  id: number;
  titleRaw: string | null;
  productUrl: string | null;
  status: string;
  varietySlug: string;
  varietyName: string;
  sellerSlug: string;
  sellerName: string;
}

/** One listing with its variety + seller (the retire-from-report routing). */
export async function listingSummaryById(db: Db, id: number): Promise<ListingSummary | null> {
  const [l] = await db
    .select({
      id: listings.id,
      titleRaw: listings.titleRaw,
      productUrl: listings.productUrl,
      status: listings.status,
      varietySlug: varieties.slug,
      varietyName: varieties.varietyName,
      sellerSlug: sellers.slug,
      sellerName: sellers.name,
    })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(eq(listings.id, id))
    .limit(1);
  return l ?? null;
}

// ─── Slice B: the Sellers section (D1 list, D2 detail, D3 update, notes) ──────

export interface AdminSellerListFilters {
  /** Name substring, case-insensitive. */
  q: string | null;
  badge: BadgeFilter;
  state: ListingStateFilter;
  sort: SellerSort;
}

export interface AdminSellerListRow {
  id: number;
  slug: string;
  name: string;
  type: string;
  location: string | null;
  status: string;
  eligibility: string;
  listingPolicy: string;
  deletedAt: string | null;
  isSmallFarm: boolean;
  updatedAt: string;
  liveListings: number;
}

/** The public-listing predicate in SQL (mirrors isPubliclyListed in lib/admin/sellers.ts). */
function publiclyListedSql() {
  return and(eq(sellers.eligibility, "approved"), eq(sellers.status, "active"), ne(sellers.listingPolicy, "removed"), isNull(sellers.deletedAt));
}

function escapeLike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * The team's working list (D1): every seller incl. candidates, filtered and sorted. ~84 rows —
 * the full filtered list comes back, no windowing; `total` is the exact filtered count.
 */
export async function listSellersAdmin(db: Db, f: AdminSellerListFilters): Promise<{ rows: AdminSellerListRow[]; total: number }> {
  const liveCounts = db
    .select({ sellerId: listings.sellerId, n: count().as("n") })
    .from(listings)
    .where(and(inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)))
    .groupBy(listings.sellerId)
    .as("live_counts");
  const rows = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      name: sellers.name,
      type: sellers.type,
      location: sellers.location,
      status: sellers.status,
      eligibility: sellers.eligibility,
      listingPolicy: sellers.listingPolicy,
      deletedAt: sellers.deletedAt,
      isSmallFarm: sellers.isSmallFarm,
      updatedAt: sellers.updatedAt,
      liveListings: sql<number>`coalesce(${liveCounts.n}, 0)`,
    })
    .from(sellers)
    .leftJoin(liveCounts, eq(sellers.id, liveCounts.sellerId))
    .where(
      and(
        // Case-insensitive substring (SQLite LIKE is ASCII-folding; lower() both sides makes
        // it explicit; LIKE has no default escape, so the ESCAPE clause makes \% \_ literal).
        f.q ? sql`lower(${sellers.name}) LIKE ${`%${escapeLike(f.q.toLowerCase())}%`} ESCAPE '\\'` : undefined,
        f.badge === "all" ? undefined : eq(sellers.isSmallFarm, f.badge === "small"),
        f.state === "all" ? undefined : f.state === "active" ? publiclyListedSql() : not(publiclyListedSql()!),
      ),
    )
    .orderBy(
      ...(f.sort === "listings"
        ? [desc(sql`coalesce(${liveCounts.n}, 0)`), asc(sql`lower(${sellers.name})`), asc(sellers.id)]
        : f.sort === "updated"
          ? [desc(sellers.updatedAt), asc(sellers.id)]
          : [asc(sql`lower(${sellers.name})`), asc(sellers.id)]),
    );
  return { rows, total: rows.length };
}

export interface AdminSellerListing {
  id: number;
  titleRaw: string | null;
  productUrl: string | null;
  status: string;
  varietyName: string;
  varietySlug: string;
}

export interface SellerNote {
  id: number;
  authorUserId: number;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

/** Notes newest-first (the D5 panel order). Served only through admin-authorized handlers. */
export async function listSellerNotes(db: Db, sellerId: number): Promise<SellerNote[]> {
  return db
    .select({ id: sellerNotes.id, authorUserId: sellerNotes.authorUserId, authorName: sellerNotes.authorName, authorRole: sellerNotes.authorRole, body: sellerNotes.body, createdAt: sellerNotes.createdAt })
    .from(sellerNotes)
    .where(eq(sellerNotes.sellerId, sellerId))
    .orderBy(desc(sellerNotes.createdAt), desc(sellerNotes.id));
}

/** One note, authored by the decider (name + role snapshotted at posting time). */
export async function addSellerNote(db: Db, n: { sellerId: number; authorUserId: number; authorName: string; authorRole: string; body: string; at: string }): Promise<number> {
  const [r] = await db
    .insert(sellerNotes)
    .values({ sellerId: n.sellerId, authorUserId: n.authorUserId, authorName: n.authorName, authorRole: n.authorRole, body: n.body, createdAt: n.at })
    .returning({ id: sellerNotes.id });
  return r!.id;
}

export interface AdminSellerDetail {
  id: number;
  slug: string;
  name: string;
  type: string;
  platform: string | null;
  homepage: string | null;
  contactEmail: string | null;
  location: string | null;
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
  status: string;
  eligibility: string;
  listingPolicy: string;
  deletedAt: string | null;
  isSmallFarm: boolean;
  updatedAt: string;
  liveListingCount: number;
  /** The seller's first listings (the read-only D2 block). */
  listings: AdminSellerListing[];
  notes: SellerNote[];
}

/** The full admin record (incl. contactEmail — admin-side only) + listings + notes. */
export async function sellerDetailBySlug(db: Db, slug: string): Promise<AdminSellerDetail | null> {
  const [s] = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      name: sellers.name,
      type: sellers.type,
      platform: sellers.platform,
      homepage: sellers.homepage,
      contactEmail: sellers.contactEmail,
      location: sellers.location,
      region: sellers.region,
      country: sellers.country,
      shipsTo: sellers.shipsTo,
      description: sellers.description,
      orderingNotes: sellers.orderingNotes,
      status: sellers.status,
      eligibility: sellers.eligibility,
      listingPolicy: sellers.listingPolicy,
      deletedAt: sellers.deletedAt,
      isSmallFarm: sellers.isSmallFarm,
      updatedAt: sellers.updatedAt,
    })
    .from(sellers)
    .where(eq(sellers.slug, slug))
    .limit(1);
  if (!s) return null;
  const [liveListingCount, firstListings, notes] = await Promise.all([
    liveListingCountForSeller(db, s.id),
    db
      .select({ id: listings.id, titleRaw: listings.titleRaw, productUrl: listings.productUrl, status: listings.status, varietyName: varieties.varietyName, varietySlug: varieties.slug })
      .from(listings)
      .innerJoin(varieties, eq(varieties.id, listings.varietyId))
      .where(and(eq(listings.sellerId, s.id), isNull(listings.deletedAt)))
      .orderBy(asc(listings.id))
      .limit(5),
    listSellerNotes(db, s.id),
  ]);
  return { ...s, liveListingCount, listings: firstListings, notes };
}

export type SellerUpdate = Partial<Record<SellerUpdateField, string | string[] | null>>;

/**
 * The general admin seller update (Hue resolution 1): the full D3 field set — CORRECTABLE
 * plus type, platform, country, contactEmail. Same conventions as applySellerCorrection
 * (seq bump, updatedAt, the changed-field list back); the structured-correction path keeps
 * its narrower set. type/platform arrive validated against the schema enums; platform null
 * clears it (the D3 "none" option). Never touches eligibility — a D3 save alone never
 * publishes (resolution 4).
 */
export async function updateSellerFields(db: Db, sellerId: number, fields: SellerUpdate, at: string): Promise<string[]> {
  const [cur] = await db
    .select({
      name: sellers.name,
      type: sellers.type,
      platform: sellers.platform,
      homepage: sellers.homepage,
      contactEmail: sellers.contactEmail,
      location: sellers.location,
      region: sellers.region,
      country: sellers.country,
      shipsTo: sellers.shipsTo,
      description: sellers.description,
      orderingNotes: sellers.orderingNotes,
    })
    .from(sellers)
    .where(eq(sellers.id, sellerId))
    .limit(1);
  if (!cur) return [];
  const set: Record<string, unknown> = {};
  for (const k of SELLER_UPDATE_FIELDS) {
    if (!(k in fields)) continue;
    const v = fields[k];
    // The changed list is diffed against the stored row (an unchanged save writes nothing
    // and reports "No changes to save."), so the D2 status line stays honest on every path.
    const next = k === "shipsTo" ? JSON.stringify(Array.isArray(v) && v.length ? v : ["unknown"]) : k === "platform" ? (typeof v === "string" && v ? v : null) : v;
    if (cur[k] === next) continue;
    set[k] = next;
  }
  const changed = Object.keys(set);
  if (changed.length === 0) return [];
  await atomic(db, [...nextSeq(db), db.update(sellers).set({ ...set, updatedAt: at, updatedSeq: currentSeq() }).where(eq(sellers.id, sellerId)) as unknown as AtomicOp]);
  return changed;
}

/** Visible listings' variety slugs — the ISR pages a seller write must revalidate. */
export async function sellerVisibleVarietySlugs(db: Db, sellerId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ slug: varieties.slug })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .where(and(eq(listings.sellerId, sellerId), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)));
  return rows.map((r) => r.slug).sort();
}

/**
 * Deactivate (→ inactive) / reactivate (→ active). Nothing is deleted; the public layer keys
 * visibility off status through visibleSeller, so an inactive seller has no public page, is
 * absent from the directory and search, and its listings leave the public variety pages —
 * while the admin record stays fully visible (resolution 2).
 */
export async function setSellerStatus(db: Db, sellerId: number, status: "active" | "inactive", at: string): Promise<{ varietySlugs: string[] }> {
  await atomic(db, [
    ...nextSeq(db),
    db.update(sellers).set({ status, updatedAt: at, updatedSeq: currentSeq() }).where(eq(sellers.id, sellerId)) as unknown as AtomicOp,
  ]);
  return { varietySlugs: await sellerVisibleVarietySlugs(db, sellerId) };
}

// ─── health (invariants) ────────────────────────────────────────────────────

/** Visible listings with their seller's state, for the invariant checks in the service. */
export async function publishedListingsForHealth(db: Db) {
  return db
    .select({
      id: listings.id,
      productUrl: listings.productUrl,
      sellerSlug: sellers.slug,
      sellerDomain: sellers.domain,
      eligibility: sellers.eligibility,
    })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)))
    .orderBy(desc(listings.id));
}
