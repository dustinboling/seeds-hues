/**
 * Admin repository (R11, R8): review_items, seller eligibility changes incl. removal, variety
 * creation + merge, and the health invariants. Catalog writes bump catalog_seq in the same
 * atomic() batch.
 */
import { and, asc, count, desc, eq, inArray, isNull, min, ne, not, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  blockedDomains,
  catalogMeta,
  listingEvents,
  listingPacketSizes,
  listings,
  plants,
  reviewItems,
  sellerNotes,
  sellers,
  series,
  users,
  varieties,
  varietyAliases,
  REVIEW_ITEM_STATUS,
  REVIEW_ITEM_TYPE,
  VISIBLE_LISTING_STATUS,
} from "@/lib/db/schema";
import { SELLER_UPDATE_FIELDS, type BadgeFilter, type ListingStateFilter, type SellerSort, type SellerUpdateField } from "@/lib/admin/sellers";
import type { ListingChip } from "@/lib/admin/listings";
import { normalizeName, slugify } from "@/lib/names";
import { atomic, type AtomicOp } from "./atomic";
import { roleAuditFor } from "./admin-auth";
import { farmOwnerAuditFor } from "./accounts";
import { ensureIngestSource, recomputeIndexable } from "./ingest";
import { waitlistCountForUser, waitlistCountForVariety } from "./waitlist";
import { CATALOG_SEQ_KEY, currentSeq, nextSeq } from "./seq";

export type ReviewType = (typeof REVIEW_ITEM_TYPE)[number];
type ReviewStatus = (typeof REVIEW_ITEM_STATUS)[number];

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
 * event (carrying `reason`, null when none was given, and `actor`, null for the key-based API)
 * land atomically, then the variety's indexable flag is recomputed.
 */
export async function removeListing(db: Db, listingId: number, reason: string | null, at: string, actor: string | null = null) {
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
    // Columns in table order: id (NULL → rowid), listing_id, event, at, reason, actor.
    db
      .insert(listingEvents)
      .select(sql`SELECT NULL, ${listingId}, 'gone', ${at}, ${reason}, ${actor} WHERE ${stillLive}`) as unknown as AtomicOp,
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

type RestoreListingResult = { restored: true; varietySlug: string; sellerSlug: string } | { restored: false; why: "not_removed"; varietySlug: string; sellerSlug: string };

/**
 * Restore a retired listing (Slice C, E2). Unknown id → null. Only a `status = 'removed'`
 * listing can be restored — anything else is a no-op naming why (`not_removed`), with
 * nothing written. Otherwise the flip to 'published' and the 'restored' event (carrying
 * `actor`, null for the key-based API) land atomically, exactly removeListing's
 * single-winner shape: a concurrent double restore has one winner and one 'restored' event.
 */
export async function restoreListing(db: Db, listingId: number, at: string, actor: string | null = null): Promise<RestoreListingResult | null> {
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
  if (l.status !== "removed") return { restored: false, why: "not_removed", ...slugs };
  // Single winner, removeListing's shape: the guarded flip is LAST, so a loser's three
  // statements all match nothing (no bump, no event, no row change).
  const stillRemoved = sql`EXISTS (SELECT 1 FROM listings WHERE id = ${listingId} AND status = 'removed')`;
  const results = await atomic(db, [
    db
      .insert(catalogMeta)
      .select(sql`SELECT ${CATALOG_SEQ_KEY}, 1 WHERE ${stillRemoved}`)
      .onConflictDoUpdate({ target: catalogMeta.key, set: { value: sql`${catalogMeta.value} + 1` } }) as unknown as AtomicOp,
    // Columns in table order: id (NULL → rowid), listing_id, event, at, reason, actor.
    db
      .insert(listingEvents)
      .select(sql`SELECT NULL, ${listingId}, 'restored', ${at}, NULL, ${actor} WHERE ${stillRemoved}`) as unknown as AtomicOp,
    db
      .update(listings)
      .set({ status: "published", updatedAt: at, updatedSeq: currentSeq() })
      .where(and(eq(listings.id, listingId), eq(listings.status, "removed")))
      .returning({ id: listings.id }) as unknown as AtomicOp,
  ]);
  const won = (results[2] as { id: number }[]).length === 1;
  if (!won) return { restored: false, why: "not_removed", ...slugs };
  await recomputeIndexable(db, [l.varietyId]);
  return { restored: true, ...slugs };
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

interface SellerRecord {
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

async function liveListingCountForSeller(db: Db, sellerId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.sellerId, sellerId), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)));
  return r?.n ?? 0;
}

interface ListingSummary {
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

interface AdminSellerListFilters {
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

interface AdminSellerListing {
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

type SellerUpdate = Partial<Record<SellerUpdateField, string | string[] | null>>;

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

// ─── Slice C: listings (E1/E2), varieties + crops (F1–F3), accounts (G1/G2) ────

/** One definition of a live listing (Hue resolution 3): visible status, not deleted. */
export async function liveListingCountForVariety(db: Db, varietyId: number): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.varietyId, varietyId), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)));
  return r?.n ?? 0;
}

type RemoveVarietyResult =
  | { outcome: "removed"; id: number; slug: string; plantSlug: string }
  | { outcome: "already_removed"; id: number; slug: string; plantSlug: string }
  | { outcome: "blocked"; id: number; slug: string; plantSlug: string; liveListings: number };

/**
 * Remove a variety (Slice C, the F2 danger zone + the key API). Soft removal, no cascade
 * (Hue resolution 1): sets `deleted_at` (+ `updated_at`, `updated_seq`) in one
 * single-winner guarded write, removeListing's shape. `status` is NOT changed. Nothing
 * else is touched — the variety's listings (any status), aliases, variety tags and
 * waitlist rows all stay in the record. Unknown id → null; a second remove reports
 * `already_removed` and writes nothing; live listings present → `blocked` naming the
 * count, with nothing written. The server re-checks liveness inside the batch (the guard
 * is authoritative, not the UI's number), so a concurrent retire-then-remove race resolves
 * honestly: the batch sees one pre-state and batches never interleave.
 */
export async function removeVariety(db: Db, varietyId: number, at: string): Promise<RemoveVarietyResult | null> {
  const [v] = await db
    .select({ id: varieties.id, slug: varieties.slug, deletedAt: varieties.deletedAt, plantSlug: plants.slug })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(eq(varieties.id, varietyId))
    .limit(1);
  if (!v) return null;
  const base = { id: v.id, slug: v.slug, plantSlug: v.plantSlug };
  if (v.deletedAt !== null) return { outcome: "already_removed", ...base };
  // Cheap refusal first (no write either way); the guarded batch below re-checks.
  const live = await liveListingCountForVariety(db, varietyId);
  if (live > 0) return { outcome: "blocked", liveListings: live, ...base };
  // The status literals are the schema's VISIBLE_LISTING_STATUS ('active', 'published').
  const removable = sql`EXISTS (SELECT 1 FROM varieties v WHERE v.id = ${varietyId} AND v.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.variety_id = ${varietyId} AND l.status IN ('active', 'published') AND l.deleted_at IS NULL))`;
  const results = await atomic(db, [
    db
      .insert(catalogMeta)
      .select(sql`SELECT ${CATALOG_SEQ_KEY}, 1 WHERE ${removable}`)
      .onConflictDoUpdate({ target: catalogMeta.key, set: { value: sql`${catalogMeta.value} + 1` } }) as unknown as AtomicOp,
    db
      .update(varieties)
      .set({ deletedAt: at, updatedAt: at, updatedSeq: currentSeq() })
      .where(
        and(
          eq(varieties.id, varietyId),
          isNull(varieties.deletedAt),
          sql`NOT EXISTS (SELECT 1 FROM listings l WHERE l.variety_id = ${varietyId} AND l.status IN ('active', 'published') AND l.deleted_at IS NULL)`,
        ),
      )
      .returning({ id: varieties.id }) as unknown as AtomicOp,
  ]);
  const won = (results[1] as { id: number }[]).length === 1;
  if (!won) {
    // Lost the race: either a concurrent remove won, or a listing went live meanwhile.
    const [again] = await db.select({ deletedAt: varieties.deletedAt }).from(varieties).where(eq(varieties.id, varietyId)).limit(1);
    if (again?.deletedAt) return { outcome: "already_removed", ...base };
    return { outcome: "blocked", liveListings: await liveListingCountForVariety(db, varietyId), ...base };
  }
  await recomputeIndexable(db, [varietyId]);
  return { outcome: "removed", ...base };
}

// ─── E1/E2: the team's listing list + detail ─────────────────────────────────

interface AdminListingFilters {
  /** Product title, variety name, or seller name substring, case-insensitive. */
  q: string | null;
  chip: ListingChip;
  sellerSlug: string | null;
  varietySlug: string | null;
  limit: number;
  offset: number;
}

export interface AdminListingRow {
  id: number;
  titleRaw: string | null;
  status: string;
  availability: string | null;
  lastCheckedAt: string | null;
  deletedAt: string | null;
  varietyId: number;
  varietySlug: string;
  varietyName: string;
  sellerSlug: string;
  sellerName: string;
  sellerEligibility: string;
  sellerStatus: string;
  sellerListingPolicy: string;
  sellerDeletedAt: string | null;
}

/** The public-visibility predicate in SQL (mirrors isListingPubliclyVisible). */
function listingVisibleSql() {
  return and(
    inArray(listings.status, [...VISIBLE_LISTING_STATUS]),
    isNull(listings.deletedAt),
    eq(sellers.eligibility, "approved"),
    eq(sellers.status, "active"),
    ne(sellers.listingPolicy, "removed"),
    isNull(sellers.deletedAt),
  );
}

/**
 * The team's working list (E1): every listing incl. retired ones (a retired listing stays
 * findable under the Retired filter forever), filtered, windowed, with the exact total.
 * Chip filters (resolution 5): Active = visible AND availability ≠ sold_out; Sold out =
 * visible AND availability = sold_out; Retired = status = 'removed'.
 */
export async function listListingsAdmin(db: Db, f: AdminListingFilters): Promise<{ rows: AdminListingRow[]; total: number }> {
  const like = f.q ? `%${escapeLike(f.q.toLowerCase())}%` : null;
  const where = and(
    like ? or(sql`lower(${listings.titleRaw}) LIKE ${like} ESCAPE '\\'`, sql`lower(${varieties.varietyName}) LIKE ${like} ESCAPE '\\'`, sql`lower(${sellers.name}) LIKE ${like} ESCAPE '\\'`) : undefined,
    f.sellerSlug ? eq(sellers.slug, f.sellerSlug) : undefined,
    f.varietySlug ? eq(varieties.slug, f.varietySlug) : undefined,
    f.chip === "retired" ? eq(listings.status, "removed") : undefined,
    f.chip === "active" ? and(listingVisibleSql(), ne(listings.availability, "sold_out")) : undefined,
    f.chip === "sold_out" ? and(listingVisibleSql(), eq(listings.availability, "sold_out")) : undefined,
  );
  const base = () =>
    db
      .select({
        id: listings.id,
        titleRaw: listings.titleRaw,
        status: listings.status,
        availability: listings.availability,
        lastCheckedAt: listings.lastCheckedAt,
        deletedAt: listings.deletedAt,
        varietyId: listings.varietyId,
        varietySlug: varieties.slug,
        varietyName: varieties.varietyName,
        sellerSlug: sellers.slug,
        sellerName: sellers.name,
        sellerEligibility: sellers.eligibility,
        sellerStatus: sellers.status,
        sellerListingPolicy: sellers.listingPolicy,
        sellerDeletedAt: sellers.deletedAt,
      })
      .from(listings)
      .innerJoin(varieties, eq(varieties.id, listings.varietyId))
      .innerJoin(sellers, eq(sellers.id, listings.sellerId));
  const [rows, totalRow] = await Promise.all([
    base().where(where).orderBy(asc(listings.id)).limit(f.limit).offset(f.offset),
    db.select({ n: count() }).from(listings).innerJoin(varieties, eq(varieties.id, listings.varietyId)).innerJoin(sellers, eq(sellers.id, listings.sellerId)).where(where),
  ]);
  return { rows, total: totalRow[0]?.n ?? 0 };
}

interface AdminListingPacket {
  label: string;
  seedCount: number | null;
}

interface AdminListingEvent {
  event: string;
  at: string;
  reason: string | null;
  actor: string | null;
}

export interface AdminListingDetail extends AdminListingRow {
  productUrl: string | null;
  /** Packet sizes as captured — labels and seed counts, never prices (resolution 7). */
  packets: AdminListingPacket[];
  /** The event trail, oldest first (resolution 4). */
  history: AdminListingEvent[];
}

/** One listing with its packet sizes (no price columns selected, ever) + event trail. */
export async function listingDetailById(db: Db, id: number): Promise<AdminListingDetail | null> {
  const [l] = await db
    .select({
      id: listings.id,
      titleRaw: listings.titleRaw,
      productUrl: listings.productUrl,
      status: listings.status,
      availability: listings.availability,
      lastCheckedAt: listings.lastCheckedAt,
      deletedAt: listings.deletedAt,
      varietyId: listings.varietyId,
      varietySlug: varieties.slug,
      varietyName: varieties.varietyName,
      sellerSlug: sellers.slug,
      sellerName: sellers.name,
      sellerEligibility: sellers.eligibility,
      sellerStatus: sellers.status,
      sellerListingPolicy: sellers.listingPolicy,
      sellerDeletedAt: sellers.deletedAt,
    })
    .from(listings)
    .innerJoin(varieties, eq(varieties.id, listings.varietyId))
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(eq(listings.id, id))
    .limit(1);
  if (!l) return null;
  const [packets, history] = await Promise.all([
    db
      .select({ label: listingPacketSizes.label, seedCount: listingPacketSizes.seedCount })
      .from(listingPacketSizes)
      .where(eq(listingPacketSizes.listingId, id))
      .orderBy(asc(listingPacketSizes.sortOrder), asc(listingPacketSizes.id)),
    db
      .select({ event: listingEvents.event, at: listingEvents.at, reason: listingEvents.reason, actor: listingEvents.actor })
      .from(listingEvents)
      .where(eq(listingEvents.listingId, id))
      .orderBy(asc(listingEvents.at), asc(listingEvents.id)),
  ]);
  return { ...l, packets, history };
}

/** Deep-link chip labels (resolution 6): the seller/variety name for a filter slug. */
export async function sellerChipBySlug(db: Db, slug: string): Promise<{ slug: string; name: string } | null> {
  const [s] = await db.select({ slug: sellers.slug, name: sellers.name }).from(sellers).where(eq(sellers.slug, slug)).limit(1);
  return s ?? null;
}

export async function varietyChipBySlug(db: Db, slug: string): Promise<{ id: number; slug: string; name: string } | null> {
  const [v] = await db.select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName }).from(varieties).where(eq(varieties.slug, slug)).limit(1);
  return v ?? null;
}

// ─── F1/F2: the team's variety list + detail ─────────────────────────────────

interface AdminVarietyFilters {
  /** Variety name or alias substring, case-insensitive. */
  q: string | null;
  /** Crop (plant) slug, single-select. */
  crop: string | null;
  limit: number;
  offset: number;
}

export interface AdminVarietyRow {
  id: number;
  slug: string;
  name: string;
  status: string;
  plantSlug: string;
  commonName: string;
  /** Distinct sellers with ≥1 live listing (resolution 9). */
  liveSellers: number;
  /** Alias count (every kind except primary). */
  aliasCount: number;
  /** Set when the variety matched only through this alias (spec F1). */
  matchedAlias: string | null;
}

/**
 * The team's working list (F1): non-removed varieties (a removed variety leaves the admin
 * lists, resolution 1), filtered, windowed, with the exact total. Name matches and
 * alias-only matches merge into one A–Z list; only the window's full rows + counts are
 * fetched (the id/name pre-pass is tiny tuples).
 */
export async function listVarietiesAdmin(db: Db, f: AdminVarietyFilters): Promise<{ rows: AdminVarietyRow[]; total: number }> {
  const like = f.q ? `%${escapeLike(f.q.toLowerCase())}%` : null;
  const cropWhere = f.crop ? eq(plants.slug, f.crop) : undefined;
  // Name matches (or every variety when unfiltered), A–Z.
  const nameRows = await db
    .select({ id: varieties.id, name: varieties.varietyName })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(isNull(varieties.deletedAt), cropWhere, like ? sql`lower(${varieties.varietyName}) LIKE ${like} ESCAPE '\\'` : undefined))
    .orderBy(asc(sql`lower(${varieties.varietyName})`), asc(varieties.id));
  const nameIds = new Set(nameRows.map((r) => r.id));
  // Alias-only matches: the first (A–Z) matching alias labels the row.
  let aliasRows: { varietyId: number; name: string; matchedAlias: string }[] = [];
  if (like) {
    const hits = await db
      .select({ varietyId: varietyAliases.varietyId, matchedAlias: sql<string>`min(${varietyAliases.alias})` })
      .from(varietyAliases)
      .innerJoin(varieties, eq(varieties.id, varietyAliases.varietyId))
      .innerJoin(plants, eq(plants.id, varieties.plantId))
      .where(and(isNull(varieties.deletedAt), cropWhere, ne(varietyAliases.kind, "primary"), sql`lower(${varietyAliases.alias}) LIKE ${like} ESCAPE '\\'`))
      .groupBy(varietyAliases.varietyId);
    const fresh = hits.filter((h) => !nameIds.has(h.varietyId));
    if (fresh.length > 0) {
      // Bound-parameter discipline (V20): D1 caps a statement at 100 bound parameters.
      const names: { id: number; name: string }[] = [];
      for (let i = 0; i < fresh.length; i += 50) {
        const chunk = fresh.slice(i, i + 50);
        names.push(...(await db.select({ id: varieties.id, name: varieties.varietyName }).from(varieties).where(inArray(varieties.id, chunk.map((h) => h.varietyId)))));
      }
      const byId = new Map(names.map((n) => [n.id, n.name]));
      aliasRows = fresh.map((h) => ({ varietyId: h.varietyId, name: byId.get(h.varietyId) ?? "", matchedAlias: h.matchedAlias }));
    }
  }
  const merged = [...nameRows.map((r) => ({ id: r.id, name: r.name, matchedAlias: null as string | null })), ...aliasRows.map((r) => ({ id: r.varietyId, name: r.name, matchedAlias: r.matchedAlias }))].sort(
    (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id,
  );
  const total = merged.length;
  const window = merged.slice(f.offset, f.offset + f.limit);
  if (window.length === 0) return { rows: [], total };
  const ids = window.map((r) => r.id);
  const full: { id: number; slug: string; name: string; status: string; plantSlug: string; commonName: string }[] = [];
  const liveSellers: { varietyId: number; n: number }[] = [];
  const aliasCounts: { varietyId: number; n: number }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const [f, s, a] = await Promise.all([
      db
        .select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName, status: varieties.status, plantSlug: plants.slug, commonName: plants.commonName })
        .from(varieties)
        .innerJoin(plants, eq(plants.id, varieties.plantId))
        .where(inArray(varieties.id, chunk)),
      db
        .select({ varietyId: listings.varietyId, n: sql<number>`count(distinct ${listings.sellerId})` })
        .from(listings)
        .where(and(inArray(listings.varietyId, chunk), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)))
        .groupBy(listings.varietyId),
      db
        .select({ varietyId: varietyAliases.varietyId, n: count() })
        .from(varietyAliases)
        .where(and(inArray(varietyAliases.varietyId, chunk), ne(varietyAliases.kind, "primary")))
        .groupBy(varietyAliases.varietyId),
    ]);
    full.push(...f);
    liveSellers.push(...s.map((r) => ({ varietyId: r.varietyId, n: Number(r.n) })));
    aliasCounts.push(...a);
  }
  const fullById = new Map(full.map((r) => [r.id, r]));
  const sellersById = new Map(liveSellers.map((r) => [r.varietyId, r.n]));
  const aliasesById = new Map(aliasCounts.map((r) => [r.varietyId, r.n]));
  return {
    rows: window.map((r) => ({ ...fullById.get(r.id)!, liveSellers: sellersById.get(r.id) ?? 0, aliasCount: aliasesById.get(r.id) ?? 0, matchedAlias: r.matchedAlias })),
    total,
  };
}

interface VarietyAliasDetail {
  alias: string;
  kind: string;
  source: string | null;
  decisionItemId: number | null;
  decidedByName: string | null;
  createdAt: string | null;
}

/** A variety's other names (every kind except primary), A–Z, with provenance (F2). */
async function aliasesForVariety(db: Db, varietyId: number): Promise<VarietyAliasDetail[]> {
  return db
    .select({ alias: varietyAliases.alias, kind: varietyAliases.kind, source: varietyAliases.source, decisionItemId: varietyAliases.decisionItemId, decidedByName: varietyAliases.decidedByName, createdAt: varietyAliases.createdAt })
    .from(varietyAliases)
    .where(and(eq(varietyAliases.varietyId, varietyId), ne(varietyAliases.kind, "primary")))
    .orderBy(asc(varietyAliases.alias));
}

/**
 * Delete one alias row + bump the variety's seq (the catalog's seq conventions, like
 * addAlias). RA-1 is enforced by the caller (the service refuses decision aliases before
 * reaching here). True when a row went.
 */
export async function removeAlias(db: Db, varietyId: number, alias: string): Promise<boolean> {
  const results = await atomic(db, [
    ...nextSeq(db),
    db.delete(varietyAliases).where(and(eq(varietyAliases.varietyId, varietyId), eq(varietyAliases.alias, alias))).returning({ alias: varietyAliases.alias }) as unknown as AtomicOp,
    db.update(varieties).set({ updatedSeq: currentSeq() }).where(eq(varieties.id, varietyId)) as unknown as AtomicOp,
  ]);
  return (results[1] as { alias: string }[]).length === 1;
}

interface AdminVarietyListingState {
  status: string;
  availability: string | null;
  deletedAt: string | null;
  sellerEligibility: string;
  sellerStatus: string;
  sellerListingPolicy: string;
  sellerDeletedAt: string | null;
}

export interface AdminVarietyDetail {
  id: number;
  slug: string;
  name: string;
  status: string;
  plantSlug: string;
  commonName: string;
  latinName: string | null;
  seriesName: string | null;
  /** The variety's listings for the resolution-5 status-word breakdown (any status). */
  listingStates: AdminVarietyListingState[];
  aliases: VarietyAliasDetail[];
  waitlistCount: number;
}

/**
 * One admin variety view (F2): public facts plus the machinery underneath. Removed
 * varieties (deleted_at set) return null — they left the admin lists (resolution 1).
 */
export async function varietyDetailBySlugAdmin(db: Db, slug: string): Promise<AdminVarietyDetail | null> {
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
    .where(and(eq(varieties.slug, slug), isNull(varieties.deletedAt)))
    .limit(1);
  if (!v) return null;
  const [listingStates, aliases, waitlistCount] = await Promise.all([
    db
      .select({
        status: listings.status,
        availability: listings.availability,
        deletedAt: listings.deletedAt,
        sellerEligibility: sellers.eligibility,
        sellerStatus: sellers.status,
        sellerListingPolicy: sellers.listingPolicy,
        sellerDeletedAt: sellers.deletedAt,
      })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .where(eq(listings.varietyId, v.id))
      .orderBy(asc(listings.id)),
    aliasesForVariety(db, v.id),
    waitlistCountForVariety(db, v.id),
  ]);
  return { ...v, listingStates, aliases, waitlistCount };
}

export type VarietyColorPatch = { colorFamily?: string; colorSwatch?: string | null };

/**
 * The admin-key variety color write (Tranche 1.8): sets exactly the submitted fields —
 * colorFamily and/or colorSwatch (null clears the swatch) — and reports the changed-field
 * list back. Same conventions as updateSellerFields (seq bump, updatedAt, the changed
 * list); an unchanged save writes nothing. The caller normalizes the hex to uppercase.
 */
export async function updateVarietyColor(db: Db, varietyId: number, patch: VarietyColorPatch, at: string): Promise<("color_family" | "color_swatch")[]> {
  const [cur] = await db
    .select({ colorFamily: varieties.colorFamily, colorSwatch: varieties.colorSwatch })
    .from(varieties)
    .where(eq(varieties.id, varietyId))
    .limit(1);
  if (!cur) return [];
  const set: Record<string, unknown> = {};
  if (patch.colorFamily !== undefined && patch.colorFamily !== cur.colorFamily) set.colorFamily = patch.colorFamily;
  if (patch.colorSwatch !== undefined && patch.colorSwatch !== cur.colorSwatch) set.colorSwatch = patch.colorSwatch;
  const changed = Object.keys(set).map((k) => (k === "colorFamily" ? "color_family" : "color_swatch") as "color_family" | "color_swatch");
  if (changed.length === 0) return [];
  await atomic(db, [
    ...nextSeq(db),
    db.update(varieties).set({ ...set, updatedAt: at, updatedSeq: currentSeq() }).where(eq(varieties.id, varietyId)) as unknown as AtomicOp,
  ]);
  return changed;
}

/**
 * The admin-key variety description write (decision 28): sets the description (null clears
 * it to NULL) and reports the changed-field list back. Same conventions as
 * updateVarietyColor (seq bump, updatedAt, the changed list); an unchanged save writes
 * nothing.
 */
export async function updateVarietyDescription(db: Db, varietyId: number, description: string | null, at: string): Promise<["description"] | []> {
  const [cur] = await db
    .select({ description: varieties.description })
    .from(varieties)
    .where(eq(varieties.id, varietyId))
    .limit(1);
  if (!cur) return [];
  if (description === cur.description) return [];
  await atomic(db, [
    ...nextSeq(db),
    db.update(varieties).set({ description, updatedAt: at, updatedSeq: currentSeq() }).where(eq(varieties.id, varietyId)) as unknown as AtomicOp,
  ]);
  return ["description"];
}

/** A variety ref for writes: a numeric id or a slug (removed varieties resolve too — the effect itself reports already_removed). */
export async function varietyRefBySlugOrId(db: Db, ref: string): Promise<{ id: number; slug: string; name: string } | null> {
  const byId = /^\d{1,12}$/.test(ref.trim());
  const [v] = await db
    .select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName })
    .from(varieties)
    .where(byId ? eq(varieties.id, Number(ref.trim())) : eq(varieties.slug, ref.trim()))
    .limit(1);
  return v ?? null;
}

// ─── F3: crops (orientation only — browse, never edit) ───────────────────────

export interface AdminCropRow {
  slug: string;
  commonName: string;
  /** Active, non-removed varieties of the crop. */
  varietyCount: number;
  /** Distinct sellers with ≥1 live listing across the crop's non-removed varieties. */
  sellerCount: number;
}

export async function listCropsAdmin(db: Db): Promise<AdminCropRow[]> {
  const crops = await db
    .select({ id: plants.id, slug: plants.slug, commonName: plants.commonName })
    .from(plants)
    .where(isNull(plants.deletedAt))
    .orderBy(asc(sql`lower(${plants.commonName})`), asc(plants.id));
  if (crops.length === 0) return [];
  // No id filter: every crop's counts are needed, and the full id list would overflow
  // D1's 100-bound-parameter cap (V20) — the aggregates scan, the map below narrows.
  const [varietyCounts, sellerCounts] = await Promise.all([
    db
      .select({ plantId: varieties.plantId, n: count() })
      .from(varieties)
      .where(and(eq(varieties.status, "active"), isNull(varieties.deletedAt)))
      .groupBy(varieties.plantId),
    db
      .select({ plantId: varieties.plantId, n: sql<number>`count(distinct ${listings.sellerId})` })
      .from(listings)
      .innerJoin(varieties, eq(varieties.id, listings.varietyId))
      .where(and(isNull(varieties.deletedAt), inArray(listings.status, [...VISIBLE_LISTING_STATUS]), isNull(listings.deletedAt)))
      .groupBy(varieties.plantId),
  ]);
  const varietiesByPlant = new Map(varietyCounts.map((r) => [r.plantId, r.n]));
  const sellersByPlant = new Map(sellerCounts.map((r) => [r.plantId, Number(r.n)]));
  return crops.map((c) => ({ slug: c.slug, commonName: c.commonName, varietyCount: varietiesByPlant.get(c.id) ?? 0, sellerCount: sellersByPlant.get(c.id) ?? 0 }));
}

// ─── G1/G2: accounts (Admin only — reviewers never receive this data) ───────

interface AdminAccountFilters {
  /** Name, displayName, or email substring, case-insensitive. */
  q: string | null;
  limit: number;
  offset: number;
}

export interface AdminAccountRow {
  id: number;
  name: string;
  displayName: string | null;
  email: string;
  createdAt: string;
  role: string;
  status: string;
  isFarmOwner: boolean;
}

/** The team's account list (G1): windowed, with the exact total. No browsing, order, or message data — there is none to show. */
export async function listAccountsAdmin(db: Db, f: AdminAccountFilters): Promise<{ rows: AdminAccountRow[]; total: number }> {
  const like = f.q ? `%${escapeLike(f.q.toLowerCase())}%` : null;
  // Shown name = displayName, else name, else the email (empty strings fall through).
  const shown = sql`lower(COALESCE(NULLIF(${users.displayName}, ''), NULLIF(${users.name}, ''), ${users.email}))`;
  const where = like ? or(sql`lower(${users.name}) LIKE ${like} ESCAPE '\\'`, sql`lower(${users.displayName}) LIKE ${like} ESCAPE '\\'`, sql`lower(${users.email}) LIKE ${like} ESCAPE '\\'`) : undefined;
  const [rows, totalRow] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, createdAt: users.createdAt, role: users.role, status: users.status, isFarmOwner: users.isFarmOwner })
      .from(users)
      .where(where)
      .orderBy(asc(shown), asc(users.id))
      .limit(f.limit)
      .offset(f.offset),
    db.select({ n: count() }).from(users).where(where),
  ]);
  return { rows, total: totalRow[0]?.n ?? 0 };
}

export interface AdminAccountDetail {
  id: number;
  name: string;
  displayName: string | null;
  email: string;
  phone: string;
  createdAt: string;
  role: string;
  status: string;
  isFarmOwner: boolean;
  sellerId: number | null;
  /** The bound farm, when one is set (null when the id points nowhere). */
  farmSeller: { id: number; slug: string; name: string } | null;
  waitlistCount: number;
  roleAudit: { id: number; actor: string; fromRole: string; toRole: string; createdAt: string }[];
  farmOwnerAudit: { id: number; actor: string; action: string; sellerId: number | null; createdAt: string }[];
}

/** One account with its waitlist count, role trail and farm-owner trail (G2). */
export async function accountDetailById(db: Db, id: number): Promise<AdminAccountDetail | null> {
  const [u] = await db
    .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, phone: users.phone, createdAt: users.createdAt, role: users.role, status: users.status, isFarmOwner: users.isFarmOwner, sellerId: users.sellerId })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!u) return null;
  const [waitlistCount, roleAudit, farmOwnerAudit, farmSellerRows] = await Promise.all([
    waitlistCountForUser(db, id),
    roleAuditFor(db, id),
    farmOwnerAuditFor(db, id),
    u.sellerId ? db.select({ id: sellers.id, slug: sellers.slug, name: sellers.name }).from(sellers).where(eq(sellers.id, u.sellerId)).limit(1) : Promise.resolve([]),
  ]);
  return { ...u, farmSeller: farmSellerRows[0] ?? null, waitlistCount, roleAudit, farmOwnerAudit };
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
