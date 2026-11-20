/**
 * Admin repository (R11, R8): review_items, seller eligibility changes incl. removal, variety
 * creation + merge, and the health invariants. Catalog writes bump catalog_seq in the same
 * atomic() batch.
 */
import { and, asc, count, desc, eq, inArray, isNull, min, ne, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  blockedDomains,
  listingEvents,
  listings,
  plants,
  reviewItems,
  sellers,
  varieties,
  varietyAliases,
  REVIEW_ITEM_STATUS,
  REVIEW_ITEM_TYPE,
  VISIBLE_LISTING_STATUS,
} from "@/lib/db/schema";
import { normalizeName, slugify } from "@/lib/names";
import { atomic, type AtomicOp } from "./atomic";
import { ensureIngestSource, recomputeIndexable } from "./ingest";
import { currentSeq, nextSeq } from "./seq";

export type ReviewType = (typeof REVIEW_ITEM_TYPE)[number];
export type ReviewStatus = (typeof REVIEW_ITEM_STATUS)[number];

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

export async function listReviewItems(db: Db, f: { type?: ReviewType; status?: ReviewStatus; limit: number }) {
  const rows = await db
    .select()
    .from(reviewItems)
    .where(and(f.type ? eq(reviewItems.type, f.type) : undefined, f.status ? eq(reviewItems.status, f.status) : undefined))
    .orderBy(asc(reviewItems.groupKey), asc(reviewItems.createdAt), asc(reviewItems.id))
    .limit(f.limit);
  return rows.map((r) => ({ ...r, proposal: JSON.parse(r.proposal) as unknown }));
}

export async function reviewItemById(db: Db, id: number) {
  const [r] = await db.select().from(reviewItems).where(eq(reviewItems.id, id)).limit(1);
  return r ? { ...r, proposal: JSON.parse(r.proposal) as Record<string, unknown> } : null;
}

export async function resolveReviewItem(db: Db, id: number, status: Exclude<ReviewStatus, "pending">, at: string): Promise<void> {
  await db.update(reviewItems).set({ status, resolvedAt: at }).where(eq(reviewItems.id, id));
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
  await atomic(db, [
    ...nextSeq(db),
    db
      .update(listings)
      .set({ status: "removed", updatedAt: at, updatedSeq: currentSeq() })
      .where(eq(listings.id, listingId)) as unknown as AtomicOp,
    db.insert(listingEvents).values({ listingId, event: "gone", at, reason }) as unknown as AtomicOp,
  ]);
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

/** Save a seller's wording as a seller_alias so the next crawl matches it exactly. */
export async function addAlias(db: Db, varietyId: number, alias: string, kind: "synonym" | "seller_alias", cropCommonName: string | null) {
  await atomic(db, [
    ...nextSeq(db),
    db
      .insert(varietyAliases)
      .values({ varietyId, alias, nameNormalized: normalizeName(alias, cropCommonName), kind })
      .onConflictDoNothing() as unknown as AtomicOp,
    db.update(varieties).set({ updatedSeq: currentSeq() }).where(eq(varieties.id, varietyId)) as unknown as AtomicOp,
  ]);
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
