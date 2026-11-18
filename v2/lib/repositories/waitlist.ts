/**
 * Waiting lists + the notification outbox (USER-ACCOUNTS-DESIGN §4/§4a). PRIVATE data.
 *
 * Outbox dedupe is the UNIQUE (user_id, variety_id, channel) index: the matcher inserts with
 * ON CONFLICT DO NOTHING, so re-runs and overlapping publishes never queue a second alert.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { listings, notificationOutbox, plants, sellers, users, varieties, waitlistEntries } from "@/lib/db/schema";
import { activeVariety, visibleListing } from "./catalog-read";

/** D1 allows 100 bound parameters per statement; outbox rows bind 6 each. */
const INSERT_CHUNK = 12;

export async function varietyBySlug(db: Db, slug: string) {
  const [r] = await db
    .select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName, crop: plants.commonName })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(eq(varieties.slug, slug), activeVariety))
    .limit(1);
  return r ?? null;
}

/** Visible listing count per variety (only varieties with ≥ 1 are returned). */
export async function visibleListingCounts(db: Db, varietyIds: number[] | null): Promise<Map<number, number>> {
  const rows = await db
    .select({ varietyId: listings.varietyId, n: count() })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(visibleListing, varietyIds ? inArray(listings.varietyId, varietyIds) : undefined))
    .groupBy(listings.varietyId);
  return new Map(rows.map((r) => [r.varietyId, r.n]));
}

/** The newest visible listing per variety (the alert's /go link + seller name). */
export async function latestVisibleListings(db: Db, varietyIds: number[]) {
  if (varietyIds.length === 0) return new Map<number, { listingId: number; sellerName: string; sellerSlug: string }>();
  const rows = await db
    .select({ id: listings.id, varietyId: listings.varietyId, sellerName: sellers.name, sellerSlug: sellers.slug })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(visibleListing, inArray(listings.varietyId, varietyIds)))
    .orderBy(desc(listings.id));
  const out = new Map<number, { listingId: number; sellerName: string; sellerSlug: string }>();
  for (const r of rows) if (!out.has(r.varietyId)) out.set(r.varietyId, { listingId: r.id, sellerName: r.sellerName, sellerSlug: r.sellerSlug });
  return out;
}

/** listing id → seller name, for the given listings that are still publicly visible. */
export async function visibleListingSellers(db: Db, listingIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < listingIds.length; i += 90) {
    const rows = await db
      .select({ id: listings.id, sellerName: sellers.name })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .where(and(visibleListing, inArray(listings.id, listingIds.slice(i, i + 90))));
    for (const r of rows) out.set(r.id, r.sellerName);
  }
  return out;
}

export async function queuedCount(db: Db, channel: "email" | "sms"): Promise<number> {
  const [r] = await db.select({ n: count() }).from(notificationOutbox).where(and(eq(notificationOutbox.channel, channel), eq(notificationOutbox.status, "queued")));
  return r?.n ?? 0;
}

export async function isListingVisible(db: Db, listingId: number): Promise<boolean> {
  const [r] = await db
    .select({ id: listings.id })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(eq(listings.id, listingId), visibleListing))
    .limit(1);
  return Boolean(r);
}

// ─── entries ────────────────────────────────────────────────────────────────

/** true when a new entry was created (UNIQUE (user, variety) makes a second join a no-op). */
export async function joinWaitlist(db: Db, userId: number, varietyId: number, at: string): Promise<boolean> {
  const rows = await db.insert(waitlistEntries).values({ userId, varietyId, createdAt: at }).onConflictDoNothing().returning({ id: waitlistEntries.id });
  return rows.length > 0;
}

export async function leaveWaitlist(db: Db, userId: number, varietyId: number): Promise<boolean> {
  const rows = await db.delete(waitlistEntries).where(and(eq(waitlistEntries.userId, userId), eq(waitlistEntries.varietyId, varietyId))).returning({ id: waitlistEntries.id });
  await db
    .update(notificationOutbox)
    .set({ status: "suppressed", detail: "left_list" })
    .where(and(eq(notificationOutbox.userId, userId), eq(notificationOutbox.varietyId, varietyId), eq(notificationOutbox.status, "queued")));
  return rows.length > 0;
}

export async function entryFor(db: Db, userId: number, varietyId: number) {
  const [r] = await db.select().from(waitlistEntries).where(and(eq(waitlistEntries.userId, userId), eq(waitlistEntries.varietyId, varietyId))).limit(1);
  return r ?? null;
}

/** A user's entries with variety + crop names, newest first. */
export async function entriesForUser(db: Db, userId: number) {
  return db
    .select({
      varietyId: waitlistEntries.varietyId,
      createdAt: waitlistEntries.createdAt,
      notifiedAt: waitlistEntries.notifiedAt,
      slug: varieties.slug,
      name: varieties.varietyName,
      crop: plants.commonName,
    })
    .from(waitlistEntries)
    .innerJoin(varieties, eq(varieties.id, waitlistEntries.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(eq(waitlistEntries.userId, userId))
    .orderBy(desc(waitlistEntries.createdAt), desc(waitlistEntries.id));
}

export async function waitlistCountForUser(db: Db, userId: number): Promise<number> {
  const [r] = await db.select({ n: count() }).from(waitlistEntries).where(eq(waitlistEntries.userId, userId));
  return r?.n ?? 0;
}

/** Variety ids a user waits on and has not yet been alerted for. */
export async function pendingVarietyIdsForUser(db: Db, userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: waitlistEntries.varietyId })
    .from(waitlistEntries)
    .where(and(eq(waitlistEntries.userId, userId), isNull(waitlistEntries.notifiedAt)));
  return rows.map((r) => r.id);
}

/** Un-notified waiters on these varieties with their channel eligibility inputs. */
export async function unnotifiedWaiters(db: Db, varietyIds: number[]) {
  if (varietyIds.length === 0) return [];
  return db
    .select({
      userId: waitlistEntries.userId,
      varietyId: waitlistEntries.varietyId,
      emailVerified: users.emailVerified,
      smsOptIn: users.smsOptIn,
      alertPhone: users.alertPhone,
      alertPhoneVerified: users.alertPhoneVerified,
      status: users.status,
    })
    .from(waitlistEntries)
    .innerJoin(users, eq(users.id, waitlistEntries.userId))
    .where(and(inArray(waitlistEntries.varietyId, varietyIds), isNull(waitlistEntries.notifiedAt)));
}

/** Variety ids that have at least one un-notified waiter. */
export async function varietiesWithPendingWaiters(db: Db): Promise<number[]> {
  const rows = await db.selectDistinct({ id: waitlistEntries.varietyId }).from(waitlistEntries).where(isNull(waitlistEntries.notifiedAt));
  return rows.map((r) => r.id);
}

export async function markNotified(db: Db, pairs: { userId: number; varietyId: number }[], at: string): Promise<void> {
  for (const p of pairs) {
    await db
      .update(waitlistEntries)
      .set({ notifiedAt: at })
      .where(and(eq(waitlistEntries.userId, p.userId), eq(waitlistEntries.varietyId, p.varietyId), isNull(waitlistEntries.notifiedAt)));
  }
}

// ─── outbox ─────────────────────────────────────────────────────────────────

export type OutboxInsert = { userId: number; varietyId: number; listingId: number; channel: "email" | "sms"; queuedAt: string };

/** Insert with dedupe; returns the number of rows actually created. */
export async function enqueueOutbox(db: Db, rows: OutboxInsert[]): Promise<number> {
  let created = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const out = await db.insert(notificationOutbox).values(chunk).onConflictDoNothing().returning({ id: notificationOutbox.id });
    created += out.length;
  }
  return created;
}

/** Queued rows for a channel with everything the drain needs to render the message. */
export async function queuedOutbox(db: Db, channel: "email" | "sms", limit: number) {
  return db
    .select({
      id: notificationOutbox.id,
      userId: notificationOutbox.userId,
      varietyId: notificationOutbox.varietyId,
      listingId: notificationOutbox.listingId,
      attempts: notificationOutbox.attempts,
      queuedAt: notificationOutbox.queuedAt,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      notifyOptOut: users.notifyOptOut,
      userStatus: users.status,
      smsOptIn: users.smsOptIn,
      alertPhone: users.alertPhone,
      alertPhoneVerified: users.alertPhoneVerified,
      varietySlug: varieties.slug,
      varietyName: varieties.varietyName,
      crop: plants.commonName,
    })
    .from(notificationOutbox)
    .innerJoin(users, eq(users.id, notificationOutbox.userId))
    .innerJoin(varieties, eq(varieties.id, notificationOutbox.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(eq(notificationOutbox.channel, channel), eq(notificationOutbox.status, "queued")))
    .orderBy(asc(notificationOutbox.queuedAt), asc(notificationOutbox.id))
    .limit(limit);
}

export async function setOutboxStatus(
  db: Db,
  ids: number[],
  set: { status: "sent" | "suppressed" | "failed" | "queued"; sentAt?: string | null; detail?: string | null; bumpAttempts?: boolean },
): Promise<void> {
  if (ids.length === 0) return;
  for (let i = 0; i < ids.length; i += 90) {
    await db
      .update(notificationOutbox)
      .set({
        status: set.status,
        ...(set.sentAt !== undefined ? { sentAt: set.sentAt } : {}),
        ...(set.detail !== undefined ? { detail: set.detail } : {}),
        ...(set.bumpAttempts ? { attempts: sql`${notificationOutbox.attempts} + 1` } : {}),
      })
      .where(inArray(notificationOutbox.id, ids.slice(i, i + 90)));
  }
}

/** Remove queued rows (e.g. the variety has no visible listing any more) so a later publish re-queues them. */
export async function deleteOutboxRows(db: Db, ids: number[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 90) await db.delete(notificationOutbox).where(inArray(notificationOutbox.id, ids.slice(i, i + 90)));
}

export async function outboxForUser(db: Db, userId: number) {
  return db.select().from(notificationOutbox).where(eq(notificationOutbox.userId, userId)).orderBy(asc(notificationOutbox.id));
}

/** Suppress a user's queued rows on one channel (STOP, opt-out). */
export async function suppressQueued(db: Db, userId: number, channel: "email" | "sms" | null, detail: string): Promise<void> {
  await db
    .update(notificationOutbox)
    .set({ status: "suppressed", detail })
    .where(and(eq(notificationOutbox.userId, userId), eq(notificationOutbox.status, "queued"), channel ? eq(notificationOutbox.channel, channel) : undefined));
}

// ─── admin demand view ──────────────────────────────────────────────────────

/** Varieties ranked by active waiter count (entries not yet alerted), with crop + seller count. */
export async function waitlistDemand(db: Db, limit: number) {
  const waiters = sql<number>`count(${waitlistEntries.id})`;
  const rows = await db
    .select({
      varietyId: varieties.id,
      slug: varieties.slug,
      name: varieties.varietyName,
      crop: plants.commonName,
      waiters,
      verifiedWaiters: sql<number>`sum(CASE WHEN ${users.emailVerified} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(waitlistEntries)
    .innerJoin(users, eq(users.id, waitlistEntries.userId))
    .innerJoin(varieties, eq(varieties.id, waitlistEntries.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(isNull(waitlistEntries.notifiedAt))
    .groupBy(varieties.id)
    .orderBy(desc(waiters), asc(varieties.varietyName))
    .limit(limit);
  const counts = await visibleListingCounts(db, rows.map((r) => r.varietyId));
  return rows.map((r) => ({ ...r, sellerCount: counts.get(r.varietyId) ?? 0 }));
}

export async function waitlistTotals(db: Db) {
  const [all] = await db.select({ n: count() }).from(waitlistEntries);
  const [active] = await db.select({ n: count() }).from(waitlistEntries).where(isNull(waitlistEntries.notifiedAt));
  const [alerted] = await db.select({ n: count() }).from(waitlistEntries).where(isNotNull(waitlistEntries.notifiedAt));
  return { memberships: all?.n ?? 0, active: active?.n ?? 0, alerted: alerted?.n ?? 0 };
}

export async function outboxStatusCounts(db: Db) {
  const rows = await db
    .select({ channel: notificationOutbox.channel, status: notificationOutbox.status, n: count() })
    .from(notificationOutbox)
    .groupBy(notificationOutbox.channel, notificationOutbox.status);
  return rows;
}
