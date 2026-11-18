/**
 * Demand-signal tables (canonical §5 "Outbound link tracking"): click_events, search_events,
 * variety_view_counts, daily_stats. No cookies and no IP addresses are ever stored here.
 */
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  clickEvents,
  dailyStats,
  listings,
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
