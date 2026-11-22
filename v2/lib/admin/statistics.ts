/**
 * Statistics read model (Slice D, spec §7 H + §7 B snapshot wiring): range/signal
 * params, UTC period math, deltas, movement, the thin-data rule, trend bucketing and
 * summaries, and the service that shapes repository rows into fully-computed page data.
 * Pages and components receive plain data (numbers, deltas, sentences, flags) — never
 * raw rows to interpret. "Now" arrives as an argument (or the service's clock), never
 * from the clock inside a pure helper. Read-only: no writes, no role branches.
 */
import type { Db } from "@/lib/db/client";
import { formatAdminDate } from "@/lib/admin-auth";
import * as accountsRepo from "@/lib/repositories/accounts";
import * as events from "@/lib/repositories/events";
import * as waitlist from "@/lib/repositories/waitlist";

// ─── Params (?range= ?signal= ?show= — they compose) ─────────────────────────

export type StatRange = "7d" | "30d" | "12w";
export type StatSignal = "views" | "clicks" | "waitlist" | "searches";

export const RANGE_DAYS: Record<StatRange, number> = { "7d": 7, "30d": 30, "12w": 84 };
export const RANGE_LABELS: Record<StatRange, string> = { "7d": "7 days", "30d": "30 days", "12w": "12 weeks" };
const RANGE_LAST_LABELS: Record<StatRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "12w": "Last 12 weeks" };
export const SIGNAL_LABELS: Record<StatSignal, string> = { views: "Views", clicks: "Clicks to sellers", waitlist: "Waitlist", searches: "Searches" };

/** Top 10 by default; `?show=25` widens the ranking in place. Anything else is 10. */
export const SHOW_DEFAULT = 10;
export const SHOW_WIDE = 25;

function parseStatRange(v: string | null | undefined): StatRange {
  return v === "30d" || v === "12w" ? v : "7d";
}

function parseStatSignal(v: string | null | undefined): StatSignal {
  return v === "clicks" || v === "waitlist" || v === "searches" ? v : "views";
}

function parseStatShow(v: string | null | undefined): number {
  return v === "25" ? SHOW_WIDE : SHOW_DEFAULT;
}

interface StatisticsParams {
  range: StatRange;
  signal: StatSignal;
  show: number;
}

export function parseStatisticsParams(sp: { range?: string | null; signal?: string | null; show?: string | null }): StatisticsParams {
  return { range: parseStatRange(sp.range), signal: parseStatSignal(sp.signal), show: parseStatShow(sp.show) };
}

export interface StatisticsLinkParams {
  range?: StatRange | null;
  signal?: StatSignal | null;
  show?: number | null;
}

/** Statistics links (defaults omitted); the section's `_components/urls.ts` re-exports this. */
export function statisticsHref(p: StatisticsLinkParams): string {
  const params = new URLSearchParams();
  if (p.range && p.range !== "7d") params.set("range", p.range);
  if (p.signal && p.signal !== "views") params.set("signal", p.signal);
  if (p.show && p.show !== SHOW_DEFAULT) params.set("show", String(p.show));
  const query = params.toString();
  return `/admin/statistics${query ? `?${query}` : ""}`;
}

// ─── UTC day math (the event tables' own bucketing) ──────────────────────────

const DAY_MS = 86_400_000;

function addDaysUtc(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function diffDaysUtc(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** "Nov 18" — a UTC day in words, no year (falls back to the input when unparseable). */
function shortDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const month = Number(m[2]);
  const date = Number(m[3]);
  if (month < 1 || month > 12 || date < 1 || date > 31) return day;
  return `${MONTHS[month - 1]} ${date}`;
}

/** "Tuesday" — the UTC day's weekday ("" when unparseable). */
function weekdayOf(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return "";
  return WEEKDAYS[new Date(t).getUTCDay()]!;
}

/** "Nov 14 – Nov 20, 2026" (both ends full when the range spans New Year). */
function rangeWords(start: string, end: string): string {
  if (start.slice(0, 4) !== end.slice(0, 4)) return `${formatAdminDate(start, start)} – ${formatAdminDate(end, end)}`;
  return `${shortDay(start)} – ${formatAdminDate(end, end)}`;
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export interface StatPeriod {
  /** Current period: today (UTC) plus the preceding n−1 days. */
  start: string;
  end: string;
  /** The equal-length span immediately before it. */
  prevStart: string;
  prevEnd: string;
  days: number;
  /** "Nov 14 – Nov 20, 2026". */
  words: string;
  /** "Last 7 days · Nov 14 – Nov 20, 2026" — every card caption restates the range. */
  caption: string;
}

export function statPeriod(today: string, range: StatRange): StatPeriod {
  const days = RANGE_DAYS[range];
  const start = addDaysUtc(today, -(days - 1));
  const prevEnd = addDaysUtc(start, -1);
  const prevStart = addDaysUtc(start, -days);
  const words = rangeWords(start, today);
  return { start, end: today, prevStart, prevEnd, days, words, caption: `${RANGE_LAST_LABELS[range]} · ${words}` };
}

// ─── Deltas (current vs the previous equal period) ───────────────────────────

export type DeltaKind = "up" | "down" | "new" | "no-change";

interface StatDelta {
  kind: DeltaKind;
  /** "▲ 12% up" / "▼ 5% down" / "New" / "No change" — arrow + number + word, never color alone. */
  text: string;
}

/**
 * Percent = round((cur − prev) / prev × 100). Pinned edges: prev = 0 with cur > 0
 * reads "New" (no percent, no infinity); equal periods read "No change"; cur = 0
 * with prev > 0 reads "▼ 100% down".
 */
export function statDelta(cur: number, prev: number): StatDelta {
  if (cur === prev) return { kind: "no-change", text: "No change" };
  if (prev === 0) return { kind: "new", text: "New" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (cur > prev) return { kind: "up", text: `▲ ${pct}% up` };
  return { kind: "down", text: `▼ ${-pct}% down` };
}

// ─── Movement (ranking position vs the FULL previous ranking) ────────────────

export type MovementKind = "up" | "down" | "same" | "new";

interface RankMovement {
  kind: MovementKind;
  /** "▲ 2" / "▼ 1" / "—" / "New". */
  text: string;
}

/** Movement = previous rank − current rank; no previous-period value reads "New". */
export function statMovement(curRank: number, prevRank: number | null): RankMovement {
  if (prevRank === null) return { kind: "new", text: "New" };
  const d = prevRank - curRank;
  if (d === 0) return { kind: "same", text: "—" };
  return d > 0 ? { kind: "up", text: `▲ ${d}` } : { kind: "down", text: `▼ ${-d}` };
}

// ─── Thin data (the honesty rule) ────────────────────────────────────────────

interface ThinState {
  /** True when the previous period starts before `dataSince` — deltas and movement are suppressed. */
  thin: boolean;
  /** Days from `dataSince` through today, inclusive (null when the signal has no history). */
  days: number | null;
  /** "Only {n} days of data so far — comparisons start after the first full period." */
  thinLine: string | null;
  /** "Data begins {friendly date}." — appended to the caption when the current period also starts before `dataSince`. */
  dataBegins: string | null;
}

export function thinState(dataSince: string | null, prevStart: string, curStart: string, today: string): ThinState {
  if (!dataSince) return { thin: true, days: null, thinLine: null, dataBegins: null };
  const days = diffDaysUtc(dataSince, today) + 1;
  const thin = prevStart < dataSince;
  return {
    thin,
    days,
    thinLine: thin ? `Only ${days} ${days === 1 ? "day" : "days"} of data so far — comparisons start after the first full period.` : null,
    dataBegins: curStart < dataSince ? `Data begins ${formatAdminDate(dataSince, dataSince)}.` : null,
  };
}

// ─── Trend bucketing + summaries ─────────────────────────────────────────────

export interface TrendBucket {
  /** The bucket's first UTC day (the peak summary's date). */
  key: string;
  /** "Nov 18" (daily) or "Nov 14 – Nov 20" (weekly) — the hidden table's label. */
  label: string;
  value: number;
}

/** One bucket per day from `from` through `end` (7d/30d). */
export function dailyTrend(from: string, end: string, byDay: ReadonlyMap<string, number>): TrendBucket[] {
  const out: TrendBucket[] = [];
  for (let d = from; d <= end; d = addDaysUtc(d, 1)) out.push({ key: d, label: shortDay(d), value: byDay.get(d) ?? 0 });
  return out;
}

/**
 * Consecutive 7-day buckets ending today, oldest first (12w). The first bucket may
 * be shorter than 7 days when the trend begins at `dataSince` rather than the range
 * start (thin data).
 */
export function weeklyTrend(from: string, end: string, byDay: ReadonlyMap<string, number>): TrendBucket[] {
  const out: TrendBucket[] = [];
  let bucketEnd = end;
  while (bucketEnd >= from) {
    const fullStart = addDaysUtc(bucketEnd, -6);
    const bucketStart = fullStart < from ? from : fullStart;
    let value = 0;
    for (let d = bucketStart; d <= bucketEnd; d = addDaysUtc(d, 1)) value += byDay.get(d) ?? 0;
    out.unshift({
      key: bucketStart,
      label: bucketStart === bucketEnd ? shortDay(bucketStart) : `${shortDay(bucketStart)} – ${shortDay(bucketEnd)}`,
      value,
    });
    bucketEnd = addDaysUtc(bucketStart, -1);
  }
  return out;
}

/**
 * The chart's one-sentence summary in plain words. Peak form (earliest peak wins
 * ties): "{Label} peaked on {Weekday, Mon D}, with {n}." (weekly: "{Label} peaked
 * in the week of {Mon D}, with {n}."). A zero total with history: "{Label}: none in
 * this period."
 */
export function trendSummary(label: string, buckets: TrendBucket[], weekly: boolean): string {
  let total = 0;
  let peak: TrendBucket | null = null;
  for (const b of buckets) {
    total += b.value;
    if (peak === null || b.value > peak.value) peak = b;
  }
  if (peak === null || total === 0) return `${label}: none in this period.`;
  const n = peak.value.toLocaleString("en-US");
  return weekly ? `${label} peaked in the week of ${shortDay(peak.key)}, with ${n}.` : `${label} peaked on ${weekdayOf(peak.key)}, ${shortDay(peak.key)}, with ${n}.`;
}

// ─── Pinned copy ─────────────────────────────────────────────────────────────

/** Visitors has no live source in this slice — the card ships in its designed no-data state. */
export const VISITORS_LINE_H = "Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.";
export const VISITORS_LINE_HOME = "Not connected yet — visitor counts come from Cloudflare Web Analytics.";

/** The waitlist ranking is current, not period-bound — its caption says so. */
export const WAITLIST_RANGE_LINE = "The current waiting list — it doesn’t change with the date range.";

export const NO_RESULTS_LINE = "People looked for these and found nothing.";
export const NO_FRUITLESS_LINE = "No fruitless searches in this period — every search found something.";
export const NO_SEARCHES_LINE = "No searches recorded in this period.";
export const NO_VIEWS_LINE = "No views recorded in this period.";
export const NO_CLICKS_LINE = "No clicks recorded in this period.";
export const NO_WAITERS_LINE = "No one is waiting on a variety yet.";

/** A signal with no history at all renders its card's composed no-data line instead of a chart. */
const NO_ACCOUNTS_YET = "No accounts created yet.";
const NO_SIGNUPS_YET = "No waitlist signups yet.";
const NO_CLICKS_YET = "No clicks to sellers yet.";

/** Demand the directory can't yet serve, named: "{p}% of clicks were on sold-out listings". */
export function soldOutLine(total: number, soldOut: number): string | null {
  if (total <= 0) return null;
  return `${Math.round((100 * soldOut) / total)}% of clicks were on sold-out listings`;
}

// ─── Page data (fully computed — components render, never interpret) ────────

type SiteCardKey = "visitors" | "accounts" | "waitlist" | "clicks";

interface TrendChartData {
  buckets: TrendBucket[];
  summary: string;
}

export interface SiteCardData {
  key: SiteCardKey;
  label: string;
  /** The snapshot card's tap target (H cards are not links). */
  href: string;
  caption: string;
  /** Null when the card shows no number (no-data, visitors, error). */
  total: number | null;
  /** Null when suppressed (thin data) or when the card shows no number. */
  delta: StatDelta | null;
  trend: TrendChartData | null;
  thinLine: string | null;
  /** The composed no-data line (visitors pinned line; other signals' "yet" lines). */
  noData: string | null;
  error: boolean;
}

export interface RankRowData {
  rank: number;
  slug: string;
  name: string;
  crop: string;
  value: number;
  /** Null when thin (the movement column is omitted) — movement exists only where both periods are fully covered. */
  movement: RankMovement | null;
}

export interface ViewsClicksPopularity {
  signal: "views" | "clicks";
  title: string;
  /** The value column's header ("Views" / "Clicks"). */
  valueLabel: string;
  rows: RankRowData[];
  shown: number;
  total: number;
  thin: boolean;
  thinLine: string | null;
  emptyLine: string;
  /** Clicks only, when in-period non-bot clicks > 0. */
  soldOutLine: string | null;
  caption: string;
  error: boolean;
}

export interface WaitlistRowData {
  rank: number;
  slug: string;
  name: string;
  crop: string;
  waiters: number;
  verified: number;
  sellers: number;
}

export interface WaitlistPopularity {
  signal: "waitlist";
  rows: WaitlistRowData[];
  shown: number;
  total: number;
  caption: string;
  error: boolean;
}

export interface SearchRowData {
  term: string;
  count: number;
  /** The modal clicked variety ("usually finds {variety}") — null when no click followed or that variety was removed. */
  finds: { slug: string; name: string } | null;
}

export interface SearchesPopularity {
  signal: "searches";
  top: SearchRowData[];
  topShown: number;
  topTotal: number;
  noResults: { term: string; count: number }[];
  noResultsShown: number;
  noResultsTotal: number;
  caption: string;
  error: boolean;
}

export type PopularityData = ViewsClicksPopularity | WaitlistPopularity | SearchesPopularity;

interface StatisticsOverview {
  period: StatPeriod;
  /** Visitors, New accounts, Waitlist signups, Clicks to sellers — in that order. */
  cards: SiteCardData[];
}

export interface StatisticsSnapshot {
  /** The same four cards over the fixed 7-day window. */
  cards: SiteCardData[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

/** Ranks by value desc, slug asc — ties share no rank number; every position is exact. */
function byValueThenSlug(a: { cur: number; slug: string }, b: { cur: number; slug: string }): number {
  return b.cur - a.cur || (a.slug < b.slug ? -1 : 1);
}

function prevByValueThenSlug(a: { prev: number; slug: string }, b: { prev: number; slug: string }): number {
  return b.prev - a.prev || (a.slug < b.slug ? -1 : 1);
}

export function createAdminStatisticsService(db: Db, deps: { now?: () => Date } = {}) {
  const now = deps.now ?? (() => new Date());
  const today = () => now().toISOString().slice(0, 10);

  function errorCard(key: SiteCardKey, label: string, href: string, caption: string): SiteCardData {
    return { key, label, href, caption, total: null, delta: null, trend: null, thinLine: null, noData: null, error: true };
  }

  function visitorsCard(period: StatPeriod, home: boolean): SiteCardData {
    return {
      key: "visitors",
      label: "Visitors",
      href: "/admin/statistics",
      caption: period.caption,
      total: null,
      delta: null,
      trend: null,
      thinLine: null,
      noData: home ? VISITORS_LINE_HOME : VISITORS_LINE_H,
      error: false,
    };
  }

  /** One live site card: total, delta-or-thin-line, trend, caption. A failed signal degrades to that card's error state — never a thrown page. */
  async function siteCard(
    key: Exclude<SiteCardKey, "visitors">,
    label: string,
    href: string,
    period: StatPeriod,
    weekly: boolean,
    noData: string,
    since: () => Promise<string | null>,
    daily: (from: string, to: string) => Promise<{ date: string; n: number }[]>,
  ): Promise<SiteCardData> {
    try {
      const dataSince = await since();
      if (!dataSince) {
        return { key, label, href, caption: period.caption, total: null, delta: null, trend: null, thinLine: null, noData, error: false };
      }
      const thin = thinState(dataSince, period.prevStart, period.start, today());
      const byDay = new Map((await daily(period.prevStart, period.end)).map((r) => [r.date, r.n]));
      let cur = 0;
      let prev = 0;
      for (const [d, n] of byDay) {
        if (d >= period.start) cur += n;
        else prev += n;
      }
      const from = period.start < dataSince ? dataSince : period.start;
      const buckets = weekly ? weeklyTrend(from, period.end, byDay) : dailyTrend(from, period.end, byDay);
      return {
        key,
        label,
        href,
        caption: thin.dataBegins ? `${period.caption} · ${thin.dataBegins}` : period.caption,
        total: cur,
        delta: thin.thin ? null : statDelta(cur, prev),
        trend: { buckets, summary: trendSummary(label, buckets, weekly) },
        thinLine: thin.thinLine,
        noData: null,
        error: false,
      };
    } catch {
      return errorCard(key, label, href, period.caption);
    }
  }

  /** The Views/Clicks ranking: full aggregation for both periods, movement against the full previous ranking. */
  async function rankedPopularity(signal: "views" | "clicks", period: StatPeriod, show: number): Promise<ViewsClicksPopularity> {
    const title = signal === "views" ? "Most viewed varieties" : "Top varieties by clicks";
    const valueLabel = signal === "views" ? "Views" : "Clicks";
    const emptyLine = signal === "views" ? NO_VIEWS_LINE : NO_CLICKS_LINE;
    const failed: ViewsClicksPopularity = {
      signal,
      title,
      valueLabel,
      rows: [],
      shown: 0,
      total: 0,
      thin: false,
      thinLine: null,
      emptyLine,
      soldOutLine: null,
      caption: period.caption,
      error: true,
    };
    try {
      const dataSince = (await events.signalDataSince(db))[signal];
      const thin = thinState(dataSince, period.prevStart, period.start, today());
      const agg =
        signal === "views"
          ? await events.viewCountsByVariety(db, period.prevStart, period.start, period.end)
          : await events.clickCountsByVariety(db, period.prevStart, period.start, period.end);
      const curRanked = agg.filter((r) => r.cur > 0).sort(byValueThenSlug);
      const prevRank = new Map(
        agg
          .filter((r) => r.prev > 0)
          .sort(prevByValueThenSlug)
          .map((r, i) => [r.varietyId, i + 1] as const),
      );
      const rows: RankRowData[] = curRanked.slice(0, show).map((r, i) => ({
        rank: i + 1,
        slug: r.slug,
        name: r.name,
        crop: r.crop,
        value: r.cur,
        movement: thin.thin ? null : statMovement(i + 1, prevRank.get(r.varietyId) ?? null),
      }));
      let soldOut: string | null = null;
      if (signal === "clicks") {
        const t = await events.clickTotals(db, period.start, period.end);
        soldOut = soldOutLine(t.total, t.soldOut);
      }
      return {
        signal,
        title,
        valueLabel,
        rows,
        shown: rows.length,
        total: curRanked.length,
        thin: thin.thin,
        thinLine: thin.thinLine,
        emptyLine,
        soldOutLine: soldOut,
        caption: thin.dataBegins ? `${period.caption} · ${thin.dataBegins}` : period.caption,
        error: false,
      };
    } catch {
      return failed;
    }
  }

  /** The waitlist ranking: `waitlistDemand`'s order and values over visible varieties — current, not period-bound. */
  async function waitlistPopularity(show: number): Promise<WaitlistPopularity> {
    try {
      const [rows, total] = await Promise.all([waitlist.waitlistDemandVisible(db, SHOW_WIDE), waitlist.waitlistDemandCount(db)]);
      const sliced: WaitlistRowData[] = rows.slice(0, show).map((r, i) => ({
        rank: i + 1,
        slug: r.slug,
        name: r.name,
        crop: r.crop,
        waiters: Number(r.waiters),
        verified: Number(r.verifiedWaiters ?? 0),
        sellers: r.sellerCount,
      }));
      return { signal: "waitlist", rows: sliced, shown: sliced.length, total, caption: WAITLIST_RANGE_LINE, error: false };
    } catch {
      return { signal: "waitlist", rows: [], shown: 0, total: 0, caption: WAITLIST_RANGE_LINE, error: true };
    }
  }

  /** Searches: top terms (with the modal "usually finds" click) + the no-results table. No movement. */
  async function searchesPopularity(period: StatPeriod, show: number): Promise<SearchesPopularity> {
    const failed: SearchesPopularity = { signal: "searches", top: [], topShown: 0, topTotal: 0, noResults: [], noResultsShown: 0, noResultsTotal: 0, caption: period.caption, error: true };
    try {
      const groups = await events.searchTermClicks(db, period.start, period.end);
      const byTerm = new Map<string, { total: number; clicks: { id: number; n: number }[] }>();
      for (const g of groups) {
        const entry = byTerm.get(g.term) ?? { total: 0, clicks: [] };
        entry.total += g.n;
        if (g.clickedVarietyId !== null) entry.clicks.push({ id: g.clickedVarietyId, n: g.n });
        byTerm.set(g.term, entry);
      }
      const terms = [...byTerm.entries()].map(([term, v]) => {
        let modalId: number | null = null;
        let modalN = 0;
        for (const c of v.clicks) {
          if (c.n > modalN || (c.n === modalN && (modalId === null || c.id < modalId))) {
            modalId = c.id;
            modalN = c.n;
          }
        }
        return { term, total: v.total, modalId };
      });
      terms.sort((a, b) => b.total - a.total || (a.term < b.term ? -1 : 1));
      const slugs = await events.visibleVarietySlugs(
        db,
        terms.map((t) => t.modalId).filter((id): id is number => id !== null),
      );
      const top: SearchRowData[] = terms.slice(0, show).map((t) => ({
        term: t.term,
        count: t.total,
        finds: t.modalId === null ? null : (slugs.get(t.modalId) ?? null),
      }));
      const noRes = await events.searchNoResults(db, period.start, period.end);
      const noResults = noRes.slice(0, show).map((r) => ({ term: r.term, count: r.n }));
      return {
        signal: "searches",
        top,
        topShown: top.length,
        topTotal: terms.length,
        noResults,
        noResultsShown: noResults.length,
        noResultsTotal: noRes.length,
        caption: period.caption,
        error: false,
      };
    } catch {
      return failed;
    }
  }

  return {
    /** H's site band: the four cards over `range` (visitors in its no-data state). */
    async overview(range: StatRange): Promise<StatisticsOverview> {
      const t = today();
      const period = statPeriod(t, range);
      const weekly = range === "12w";
      const [accounts, waitlistCard, clicks] = await Promise.all([
        siteCard("accounts", "New accounts", "/admin/statistics", period, weekly, NO_ACCOUNTS_YET, () => accountsRepo.accountsDataSince(db), (from, to) => accountsRepo.accountsCreatedDaily(db, from, to)),
        siteCard("waitlist", "Waitlist signups", statisticsHref({ range, signal: "waitlist" }), period, weekly, NO_SIGNUPS_YET, () => waitlist.waitlistDataSince(db), (from, to) => waitlist.waitlistSignupsDaily(db, from, to)),
        siteCard("clicks", "Clicks to sellers", statisticsHref({ range, signal: "clicks" }), period, weekly, NO_CLICKS_YET, () => events.signalDataSince(db).then((s) => s.clicks), (from, to) => events.clicksDaily(db, from, to)),
      ]);
      return { period, cards: [visitorsCard(period, false), accounts, waitlistCard, clicks] };
    },

    /** H's popularity centerpiece for the selected signal. */
    async popularity(range: StatRange, signal: StatSignal, show: number): Promise<PopularityData> {
      const period = statPeriod(today(), range);
      const wide = show >= SHOW_WIDE ? SHOW_WIDE : SHOW_DEFAULT;
      if (signal === "waitlist") return waitlistPopularity(wide);
      if (signal === "searches") return searchesPopularity(period, wide);
      return rankedPopularity(signal, period, wide);
    },

    /** The home snapshot: the four cards over the fixed 7-day window. */
    async snapshot(): Promise<StatisticsSnapshot> {
      const period = statPeriod(today(), "7d");
      const [accounts, waitlistCard, clicks] = await Promise.all([
        siteCard("accounts", "New accounts", "/admin/statistics", period, false, NO_ACCOUNTS_YET, () => accountsRepo.accountsDataSince(db), (from, to) => accountsRepo.accountsCreatedDaily(db, from, to)),
        siteCard("waitlist", "Waitlist signups", "/admin/statistics?signal=waitlist", period, false, NO_SIGNUPS_YET, () => waitlist.waitlistDataSince(db), (from, to) => waitlist.waitlistSignupsDaily(db, from, to)),
        siteCard("clicks", "Clicks to sellers", "/admin/statistics?signal=clicks", period, false, NO_CLICKS_YET, () => events.signalDataSince(db).then((s) => s.clicks), (from, to) => events.clicksDaily(db, from, to)),
      ]);
      return { cards: [visitorsCard(period, true), accounts, waitlistCard, clicks] };
    },
  };
}
