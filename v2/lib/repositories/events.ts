/**
 * Demand-signal tables (canonical §5 "Outbound link tracking"): click_events, search_events,
 * variety_view_counts, daily_stats. No cookies and no IP addresses are ever stored here.
 */
import { and, count, desc, eq, gte, inArray, isNull, lte, sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  clickEvents,
  dailyStats,
  listings,
  plants,
  searchEvents,
  sellers,
  varieties,
  varietyViewCounts,
  VISIBLE_LISTING_STATUS,
} from "@/lib/db/schema";
import { atomic, type AtomicOp } from "./atomic";

export async function insertClickEvent(db: Db, row: typeof clickEvents.$inferInsert): Promise<void> {
  await db.insert(clickEvents).values(row);
}

export async function insertSearchEvent(db: Db, row: typeof searchEvents.$inferInsert): Promise<void> {
  await db.insert(searchEvents).values(row);
}

export async function activeVarietyIdBySlug(db: Db, slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: varieties.id })
    .from(varieties)
    .where(and(eq(varieties.slug, slug), eq(varieties.status, "active")))
    .limit(1);
  return row?.id ?? null;
}

/** +1 view for (UTC date, variety). */
export async function bumpVarietyView(db: Db, date: string, varietyId: number): Promise<void> {
  await db
    .insert(varietyViewCounts)
    .values({ date, varietyId, views: 1 })
    .onConflictDoUpdate({
      target: [varietyViewCounts.date, varietyViewCounts.varietyId],
      set: { views: sql`${varietyViewCounts.views} + 1` },
    });
}

/**
 * Nightly rollup: replace daily_stats for `date` with non-bot click counts per (variety, seller).
 * search_events have no daily_stats columns in the canonical table shape; they stay raw (they
 * are already one row per query) — see DELTA-REPORT.md.
 */
export async function rollupDay(db: Db, date: string): Promise<{ rows: number; clicks: number }> {
  const day = sql`substr(${clickEvents.at}, 1, 10)`;
  const ops: AtomicOp[] = [
    db.delete(dailyStats).where(eq(dailyStats.date, date)) as unknown as AtomicOp,
    db.insert(dailyStats).select(
      db
        .select({
          date: sql<string>`${date}`.as("date"),
          varietyId: clickEvents.varietyId,
          sellerId: clickEvents.sellerId,
          clicks: sql<number>`count(*)`.as("clicks"),
          soldOutClicks: sql<number>`sum(CASE WHEN ${clickEvents.availabilityAtClick} = 'sold_out' THEN 1 ELSE 0 END)`.as("sold_out_clicks"),
        })
        .from(clickEvents)
        .where(and(sql`${day} = ${date}`, eq(clickEvents.isBot, false)))
        .groupBy(clickEvents.varietyId, clickEvents.sellerId),
    ) as unknown as AtomicOp,
  ];
  await atomic(db, ops);
  const [r] = await db
    .select({ rows: count(), clicks: sql<number>`coalesce(sum(${dailyStats.clicks}), 0)` })
    .from(dailyStats)
    .where(eq(dailyStats.date, date));
  return { rows: r?.rows ?? 0, clicks: Number(r?.clicks ?? 0) };
}

/** The four demand lists (canonical §5): bots excluded. `since` is an ISO date. */
export async function demandStats(db: Db, since: string, limit: number) {
  const visibleCount = db
    .select({ varietyId: listings.varietyId, n: count().as("n") })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(inArray(listings.status, [...VISIBLE_LISTING_STATUS]), eq(sellers.eligibility, "approved")))
    .groupBy(listings.varietyId)
    .as("vc");
  const [topClicked, topSoldOut, zeroResults, zeroSellerViews] = await Promise.all([
    db
      .select({ slug: varieties.slug, name: varieties.varietyName, clicks: count() })
      .from(clickEvents)
      .innerJoin(varieties, eq(varieties.id, clickEvents.varietyId))
      .where(and(gte(clickEvents.at, since), eq(clickEvents.isBot, false)))
      .groupBy(varieties.id)
      .orderBy(desc(count()), varieties.slug)
      .limit(limit),
    db
      .select({ slug: varieties.slug, name: varieties.varietyName, clicks: count() })
      .from(clickEvents)
      .innerJoin(varieties, eq(varieties.id, clickEvents.varietyId))
      .where(and(gte(clickEvents.at, since), eq(clickEvents.isBot, false), eq(clickEvents.availabilityAtClick, "sold_out")))
      .groupBy(varieties.id)
      .orderBy(desc(count()), varieties.slug)
      .limit(limit),
    db
      .select({ query: searchEvents.queryNormalized, searches: count() })
      .from(searchEvents)
      .where(and(gte(searchEvents.at, since), eq(searchEvents.resultCount, 0)))
      .groupBy(searchEvents.queryNormalized)
      .orderBy(desc(count()), searchEvents.queryNormalized)
      .limit(limit),
    db
      .select({ slug: varieties.slug, name: varieties.varietyName, views: sql<number>`sum(${varietyViewCounts.views})` })
      .from(varietyViewCounts)
      .innerJoin(varieties, eq(varieties.id, varietyViewCounts.varietyId))
      .leftJoin(visibleCount, eq(visibleCount.varietyId, varieties.id))
      .where(and(gte(varietyViewCounts.date, since.slice(0, 10)), sql`coalesce(${visibleCount.n}, 0) = 0`))
      .groupBy(varieties.id)
      .orderBy(desc(sql`sum(${varietyViewCounts.views})`), varieties.slug)
      .limit(limit),
  ]);
  return {
    top_clicked_varieties: topClicked,
    top_sold_out_clicks: topSoldOut,
    top_zero_result_searches: zeroResults,
    top_zero_seller_views: zeroSellerViews.map((r) => ({ ...r, views: Number(r.views) })),
  };
}

// ─── admin statistics (Slice D): period reads over UTC calendar days ────────
//
// Every read here buckets by the event tables' own day (`variety_view_counts.date`,
// `substr(at, 1, 10)` for the streams) so the numbers and the words describe the same
// days. Variety-scoped reads join admin-visible varieties only (`deleted_at IS NULL`,
// the F1 discipline): a removed variety never appears in a ranking. Clicks always
// exclude bots and always read `click_events` directly — never the lagging nightly
// `daily_stats` rollup.

/** UTC-day bucket for an event-stream instant. */
const streamDay = (col: SQLWrapper) => sql<string>`substr(${col}, 1, 10)`;

/** Per-variety current/previous-period values for one ranking signal. */
export interface VarietyPeriodCounts {
  varietyId: number;
  slug: string;
  name: string;
  crop: string;
  cur: number;
  prev: number;
}

/** Views per admin-visible variety, split at `curStart` (`[prevStart, end]` window). */
export async function viewCountsByVariety(db: Db, prevStart: string, curStart: string, end: string): Promise<VarietyPeriodCounts[]> {
  const rows = await db
    .select({
      varietyId: varieties.id,
      slug: varieties.slug,
      name: varieties.varietyName,
      crop: plants.commonName,
      cur: sql<number>`sum(CASE WHEN ${varietyViewCounts.date} >= ${curStart} THEN ${varietyViewCounts.views} ELSE 0 END)`,
      prev: sql<number>`sum(CASE WHEN ${varietyViewCounts.date} < ${curStart} THEN ${varietyViewCounts.views} ELSE 0 END)`,
    })
    .from(varietyViewCounts)
    .innerJoin(varieties, eq(varieties.id, varietyViewCounts.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(gte(varietyViewCounts.date, prevStart), lte(varietyViewCounts.date, end), isNull(varieties.deletedAt)))
    .groupBy(varieties.id);
  return rows.map((r) => ({ ...r, cur: Number(r.cur), prev: Number(r.prev) }));
}

/** Non-bot clicks per admin-visible variety, split at `curStart` (`[prevStart, end]` window). */
export async function clickCountsByVariety(db: Db, prevStart: string, curStart: string, end: string): Promise<VarietyPeriodCounts[]> {
  const day = streamDay(clickEvents.at);
  const rows = await db
    .select({
      varietyId: varieties.id,
      slug: varieties.slug,
      name: varieties.varietyName,
      crop: plants.commonName,
      cur: sql<number>`sum(CASE WHEN ${day} >= ${curStart} THEN 1 ELSE 0 END)`,
      prev: sql<number>`sum(CASE WHEN ${day} < ${curStart} THEN 1 ELSE 0 END)`,
    })
    .from(clickEvents)
    .innerJoin(varieties, eq(varieties.id, clickEvents.varietyId))
    .innerJoin(plants, eq(plants.id, varieties.plantId))
    .where(and(sql`${day} >= ${prevStart}`, sql`${day} <= ${end}`, eq(clickEvents.isBot, false), isNull(varieties.deletedAt)))
    .groupBy(varieties.id);
  return rows.map((r) => ({ ...r, cur: Number(r.cur), prev: Number(r.prev) }));
}

/** Non-bot clicks in `[start, end]` (visible varieties): the total and the sold-out share's numerator. */
export async function clickTotals(db: Db, start: string, end: string): Promise<{ total: number; soldOut: number }> {
  const day = streamDay(clickEvents.at);
  const [r] = await db
    .select({
      total: count(),
      soldOut: sql<number | null>`sum(CASE WHEN ${clickEvents.availabilityAtClick} = 'sold_out' THEN 1 ELSE 0 END)`,
    })
    .from(clickEvents)
    .innerJoin(varieties, eq(varieties.id, clickEvents.varietyId))
    .where(and(sql`${day} >= ${start}`, sql`${day} <= ${end}`, eq(clickEvents.isBot, false), isNull(varieties.deletedAt)));
  return { total: r?.total ?? 0, soldOut: Number(r?.soldOut ?? 0) };
}

/** Non-bot clicks per UTC day in `[start, end]` (visible varieties) — the trend series. */
export async function clicksDaily(db: Db, start: string, end: string): Promise<{ date: string; n: number }[]> {
  const day = streamDay(clickEvents.at);
  const rows = await db
    .select({ date: day, n: count() })
    .from(clickEvents)
    .innerJoin(varieties, eq(varieties.id, clickEvents.varietyId))
    .where(and(sql`${day} >= ${start}`, sql`${day} <= ${end}`, eq(clickEvents.isBot, false), isNull(varieties.deletedAt)))
    .groupBy(day)
    .orderBy(day);
  return rows;
}

/** Searches per (term, clicked variety) in `[start, end]` — top terms and their modal click derive from this. */
export async function searchTermClicks(db: Db, start: string, end: string): Promise<{ term: string; clickedVarietyId: number | null; n: number }[]> {
  const day = streamDay(searchEvents.at);
  return db
    .select({ term: searchEvents.queryNormalized, clickedVarietyId: searchEvents.clickedVarietyId, n: count() })
    .from(searchEvents)
    .where(and(sql`${day} >= ${start}`, sql`${day} <= ${end}`))
    .groupBy(searchEvents.queryNormalized, searchEvents.clickedVarietyId);
}

/** Terms searched with no results in `[start, end]`, most-searched first. */
export async function searchNoResults(db: Db, start: string, end: string): Promise<{ term: string; n: number }[]> {
  const day = streamDay(searchEvents.at);
  return db
    .select({ term: searchEvents.queryNormalized, n: count() })
    .from(searchEvents)
    .where(and(sql`${day} >= ${start}`, sql`${day} <= ${end}`, eq(searchEvents.resultCount, 0)))
    .groupBy(searchEvents.queryNormalized)
    .orderBy(desc(count()), searchEvents.queryNormalized);
}

/** Slugs + names for admin-visible varieties only (a removed variety resolves to nothing — no F2 to land on). */
export async function visibleVarietySlugs(db: Db, ids: number[]): Promise<Map<number, { slug: string; name: string }>> {
  const out = new Map<number, { slug: string; name: string }>();
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return out;
  for (let i = 0; i < uniq.length; i += 90) {
    const rows = await db
      .select({ id: varieties.id, slug: varieties.slug, name: varieties.varietyName })
      .from(varieties)
      .where(and(inArray(varieties.id, uniq.slice(i, i + 90)), isNull(varieties.deletedAt)));
    for (const r of rows) out.set(r.id, { slug: r.slug, name: r.name });
  }
  return out;
}

/**
 * Each signal's `dataSince` (the thin-data rule's input): earliest views date, earliest
 * non-bot click day (bot rows are not the signal), earliest search day. Null when the
 * signal has no history at all.
 */
export async function signalDataSince(db: Db): Promise<{ views: string | null; clicks: string | null; searches: string | null }> {
  const [v] = await db.select({ d: sql<string | null>`min(${varietyViewCounts.date})` }).from(varietyViewCounts);
  const [c] = await db
    .select({ d: sql<string | null>`min(substr(${clickEvents.at}, 1, 10))` })
    .from(clickEvents)
    .where(eq(clickEvents.isBot, false));
  const [s] = await db.select({ d: sql<string | null>`min(substr(${searchEvents.at}, 1, 10))` }).from(searchEvents);
  return { views: v?.d ?? null, clicks: c?.d ?? null, searches: s?.d ?? null };
}
