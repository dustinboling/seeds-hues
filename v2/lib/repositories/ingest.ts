/**
 * Ingest repository (R10, canonical §4): crawl_jobs leases, fetch_sources, observations, the
 * listing upsert that auto-publishes exact matches, match context, and the R5 index-rule
 * recompute. Every catalog write bumps catalog_seq inside the same atomic() batch.
 */
import { and, asc, eq, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  agentRuns,
  blockedDomains,
  crawlJobs,
  fetchSources,
  listingEvents,
  listings,
  observations,
  plants,
  sellers,
  sources,
  varieties,
  varietyAliases,
  VISIBLE_LISTING_STATUS,
} from "@/lib/db/schema";
import { isIndexable } from "@/lib/catalog/assertions";
import { atomic, type AtomicOp } from "./atomic";
import { currentSeq, nextSeq } from "./seq";

export const LEASE_MINUTES = 15;
export const MAX_JOB_ATTEMPTS = 5;

// ─── crawl_jobs ─────────────────────────────────────────────────────────────

export async function enqueueJob(db: Db, row: { type: string; target: string; at: string }) {
  const [r] = await db
    .insert(crawlJobs)
    .values({ type: row.type, target: row.target, status: "queued", createdAt: row.at, updatedAt: row.at })
    .returning();
  return r!;
}

/** Return expired leases to the queue, then lease up to `count` runnable jobs (one statement). */
export async function leaseJobs(db: Db, count: number, now: Date) {
  const nowIso = now.toISOString();
  await db
    .update(crawlJobs)
    .set({ status: "queued", leaseExpiresAt: null, updatedAt: nowIso })
    .where(and(eq(crawlJobs.status, "leased"), lt(crawlJobs.leaseExpiresAt, nowIso)));
  const expires = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
  const runnable = db
    .select({ id: crawlJobs.id })
    .from(crawlJobs)
    // farm_summary jobs (Add Your Farm drafts) belong to scripts/farm-summaries.ts, not to ingest agents.
    .where(and(eq(crawlJobs.status, "queued"), ne(crawlJobs.type, "farm_summary"), or(isNull(crawlJobs.nextRunAt), lte(crawlJobs.nextRunAt, nowIso))))
    .orderBy(asc(crawlJobs.nextRunAt), asc(crawlJobs.id))
    .limit(count);
  return db
    .update(crawlJobs)
    .set({ status: "leased", leaseExpiresAt: expires, updatedAt: nowIso })
    .where(inArray(crawlJobs.id, runnable))
    .returning();
}

export async function jobById(db: Db, id: number) {
  const [r] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, id)).limit(1);
  return r ?? null;
}

export async function completeJob(db: Db, id: number, at: string) {
  const [r] = await db
    .update(crawlJobs)
    .set({ status: "done", leaseExpiresAt: null, updatedAt: at })
    .where(and(eq(crawlJobs.id, id), eq(crawlJobs.status, "leased")))
    .returning();
  return r ?? null;
}

/** attempts++; back off 5 min × 2^(attempts-1); after MAX_JOB_ATTEMPTS the job is failed. */
export async function failJob(db: Db, id: number, now: Date) {
  const job = await jobById(db, id);
  if (!job || job.status !== "leased") return null;
  const attempts = job.attempts + 1;
  const done = attempts >= MAX_JOB_ATTEMPTS;
  const nextRunAt = done ? null : new Date(now.getTime() + 5 * 60_000 * 2 ** (attempts - 1)).toISOString();
  const [r] = await db
    .update(crawlJobs)
    .set({ status: done ? "failed" : "queued", attempts, nextRunAt, leaseExpiresAt: null, updatedAt: now.toISOString() })
    .where(eq(crawlJobs.id, id))
    .returning();
  return r ?? null;
}

export async function jobStats(db: Db) {
  const rows = await db.select({ status: crawlJobs.status, n: sql<number>`count(*)` }).from(crawlJobs).groupBy(crawlJobs.status);
  const out: Record<string, number> = { queued: 0, leased: 0, done: 0, failed: 0 };
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

export async function insertAgentRun(db: Db, row: { agent: string; model: string | null; promptVersion: string | null; at: string }) {
  const [r] = await db
    .insert(agentRuns)
    .values({ agent: row.agent, model: row.model, promptVersion: row.promptVersion, createdAt: row.at })
    .returning({ id: agentRuns.id });
  return r!.id;
}

// ─── fetch_sources ──────────────────────────────────────────────────────────

export type FetchSourceRow = typeof fetchSources.$inferSelect;

/** Idempotent on (url, content_hash): returns the existing row on a repeat. */
export async function upsertFetchSource(db: Db, row: typeof fetchSources.$inferInsert): Promise<{ row: FetchSourceRow; created: boolean }> {
  const inserted = await db.insert(fetchSources).values(row).onConflictDoNothing().returning();
  if (inserted[0]) return { row: inserted[0], created: true };
  const [existing] = await db
    .select()
    .from(fetchSources)
    .where(and(eq(fetchSources.url, row.url), eq(fetchSources.contentHash, row.contentHash)))
    .limit(1);
  return { row: existing!, created: false };
}

export async function fetchSourceById(db: Db, id: number): Promise<FetchSourceRow | null> {
  const [r] = await db.select().from(fetchSources).where(eq(fetchSources.id, id)).limit(1);
  return r ?? null;
}

// ─── sellers / domains / varieties for validation ───────────────────────────

const sellerCols = {
  id: sellers.id,
  slug: sellers.slug,
  name: sellers.name,
  domain: sellers.domain,
  homepage: sellers.homepage,
  eligibility: sellers.eligibility,
  crawlPolicy: sellers.crawlPolicy,
  status: sellers.status,
  listingPolicy: sellers.listingPolicy,
  deletedAt: sellers.deletedAt,
};

/** Seller by numeric id or slug (canonical: path segments accept a slug or an ID). */
export async function sellerByRef(db: Db, ref: string | number) {
  const where = typeof ref === "number" || /^\d+$/.test(ref) ? eq(sellers.id, Number(ref)) : eq(sellers.slug, ref);
  const [r] = await db.select(sellerCols).from(sellers).where(where).limit(1);
  return r ?? null;
}

export async function sellerByDomain(db: Db, domain: string) {
  const [r] = await db.select(sellerCols).from(sellers).where(eq(sellers.domain, domain)).limit(1);
  return r ?? null;
}

export function domainAndParents(host: string): string[] {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) out.push(labels.slice(i).join("."));
  return out;
}

/** True when any host — or any parent domain of it (shop.farm.com → farm.com) — is blocked. */
export async function isBlockedDomain(db: Db, hosts: string[]): Promise<boolean> {
  const list = [...new Set(hosts.filter(Boolean).flatMap((h) => domainAndParents(h)))];
  if (list.length === 0) return false;
  const [r] = await db.select({ d: blockedDomains.domain }).from(blockedDomains).where(inArray(blockedDomains.domain, list)).limit(1);
  return Boolean(r);
}

export async function blockedDomainList(db: Db): Promise<string[]> {
  return (await db.select({ d: blockedDomains.domain }).from(blockedDomains)).map((r) => r.d);
}

export async function varietyForMatch(db: Db, ref: string | number) {
  const where = typeof ref === "number" || /^\d+$/.test(String(ref)) ? eq(varieties.id, Number(ref)) : eq(varieties.slug, String(ref));
  const [v] = await db
    .select({
      id: varieties.id,
      slug: varieties.slug,
      name: varieties.varietyName,
      status: varieties.status,
      plantSlug: plants.slug,
      commonName: plants.commonName,
    })
    .from(varieties)
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(where, isNull(varieties.deletedAt)))
    .limit(1);
  if (!v) return null;
  const names = await db
    .select({ alias: varietyAliases.alias, normalized: varietyAliases.nameNormalized, kind: varietyAliases.kind })
    .from(varietyAliases)
    .where(eq(varietyAliases.varietyId, v.id));
  return { ...v, names };
}

/** GET /ingest/match-context?crop= — the crop's active varieties with every known name. */
export async function matchContextRows(db: Db, cropSlug: string) {
  const [plant] = await db.select({ id: plants.id, slug: plants.slug, commonName: plants.commonName }).from(plants).where(eq(plants.slug, cropSlug)).limit(1);
  if (!plant) return null;
  const vs = await db
    .select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName })
    .from(varieties)
    .where(and(eq(varieties.plantId, plant.id), eq(varieties.status, "active"), isNull(varieties.deletedAt)))
    .orderBy(asc(varieties.varietyName));
  const names = vs.length
    ? await db
        .select({ varietyId: varietyAliases.varietyId, alias: varietyAliases.alias, normalized: varietyAliases.nameNormalized, kind: varietyAliases.kind })
        .from(varietyAliases)
        .where(inArray(varietyAliases.varietyId, vs.map((v) => v.id)))
    : [];
  return { plant, varieties: vs.map((v) => ({ ...v, names: names.filter((n) => n.varietyId === v.id) })) };
}

// ─── observations ───────────────────────────────────────────────────────────

export async function insertObservation(db: Db, row: typeof observations.$inferInsert): Promise<number> {
  const [r] = await db.insert(observations).values(row).returning({ id: observations.id });
  return r!.id;
}

// ─── listings (publish path) ────────────────────────────────────────────────

const INGEST_SOURCE_SLUG = "src-ingest-api";

/** The curated `sources` row that ingest-created rows point at (their real URL is in provenance). */
export async function ensureIngestSource(db: Db): Promise<number> {
  await db
    .insert(sources)
    .values({ slug: INGEST_SOURCE_SLUG, kind: "shop-check", label: "Ingest API observation (evidence-verified snapshot)", access: "public" })
    .onConflictDoNothing();
  const [r] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, INGEST_SOURCE_SLUG)).limit(1);
  return r!.id;
}

export interface ObservedListing {
  sellerId: number;
  varietyId: number;
  productUrl: string;
  variantKey: string;
  externalProductId: string | null;
  titleRaw: string | null;
  availability: "in_stock" | "sold_out" | "preorder" | "shop_closed" | "unknown";
  matchMethod: "exact" | "synonym" | "model" | "human";
  confidence: number;
  sourceUrl: string;
  checkedAt: string;
}

export type ListingEvent = "first_seen" | "restocked" | "sold_out" | "gone";

function eventFor(prev: { availability: string; status: string } | null, next: ObservedListing["availability"]): ListingEvent | null {
  if (!prev) return "first_seen";
  const wasVisible = (VISIBLE_LISTING_STATUS as readonly string[]).includes(prev.status);
  // Back in stock after being out (or after the listing was hidden) is a restock; unknown → in
  // stock is only a first reading, not a restock.
  if (next === "in_stock" && (!wasVisible || ["sold_out", "shop_closed", "preorder"].includes(prev.availability))) return "restocked";
  if (next === "sold_out" && wasVisible && prev.availability !== "sold_out") return "sold_out";
  return null;
}

/**
 * Create or update the listing keyed by (seller, product URL, variant). Provenance is copied
 * from the observation; a listing_events row is written on a state change. One atomic batch.
 */
export async function upsertObservedListing(db: Db, o: ObservedListing): Promise<{ listingId: number; created: boolean; event: ListingEvent | null }> {
  const key = and(eq(listings.sellerId, o.sellerId), eq(listings.productUrl, o.productUrl), eq(listings.variantKey, o.variantKey));
  const [prev] = await db.select({ id: listings.id, availability: listings.availability, status: listings.status }).from(listings).where(key).limit(1);
  const event = eventFor(prev ?? null, o.availability);
  const fields = {
    varietyId: o.varietyId,
    availability: o.availability,
    externalProductId: o.externalProductId,
    titleRaw: o.titleRaw,
    matchMethod: o.matchMethod,
    confidence: o.confidence,
    sourceUrl: o.sourceUrl,
    lastCheckedAt: o.checkedAt,
    status: "published" as const,
    deletedAt: null,
    updatedAt: o.checkedAt,
  };
  const ops: AtomicOp[] = [...nextSeq(db)];
  if (prev) {
    ops.push(db.update(listings).set({ ...fields, updatedSeq: currentSeq() }).where(eq(listings.id, prev.id)) as unknown as AtomicOp);
  } else {
    const sourceId = await ensureIngestSource(db);
    ops.push(
      db.insert(listings).values({
        ...fields,
        sellerId: o.sellerId,
        productUrl: o.productUrl,
        variantKey: o.variantKey,
        sourceId,
        firstSeenAt: o.checkedAt,
        createdAt: o.checkedAt,
        updatedSeq: currentSeq(),
      }) as unknown as AtomicOp,
    );
  }
  if (event) {
    ops.push(
      db.insert(listingEvents).values({
        listingId: sql<number>`(SELECT id FROM listings WHERE seller_id = ${o.sellerId} AND product_url = ${o.productUrl} AND variant_key = ${o.variantKey})`,
        event,
        at: o.checkedAt,
      }) as unknown as AtomicOp,
    );
  }
  await atomic(db, ops);
  const [row] = await db.select({ id: listings.id }).from(listings).where(key).limit(1);
  await recomputeIndexable(db, [o.varietyId]);
  return { listingId: row!.id, created: !prev, event };
}

/**
 * Re-derive `indexable` for the given varieties; bumps seq only for rows that change.
 * Owner ruling 2026-11-16: indexable ⟺ the variety is active and not soft-deleted —
 * listing counts and notes no longer play any part.
 */
export async function recomputeIndexable(db: Db, varietyIds: number[]): Promise<void> {
  const ids = [...new Set(varietyIds)];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: varieties.id, indexable: varieties.indexable, status: varieties.status, deletedAt: varieties.deletedAt })
    .from(varieties)
    .where(inArray(varieties.id, ids));
  const ops: AtomicOp[] = [];
  for (const r of rows) {
    const want = isIndexable(r.status, r.deletedAt);
    if (want !== r.indexable) {
      ops.push(...nextSeq(db), db.update(varieties).set({ indexable: want, updatedSeq: currentSeq() }).where(eq(varieties.id, r.id)) as unknown as AtomicOp);
    }
  }
  await atomic(db, ops);
}
