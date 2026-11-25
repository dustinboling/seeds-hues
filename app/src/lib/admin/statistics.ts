/**
 * Statistics read model — ported pure half of v2/lib/admin/statistics.ts
 * (Slice D): range/signal params, UTC period math, deltas, movement, the
 * thin-data rule, trend bucketing and summaries, pinned copy, and the page
 * data interfaces. The DB-backed service stays server-side; pages and
 * components receive plain data — never raw rows to interpret.
 */
import { formatAdminDate } from "./auth";

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

/**
 * Visitors falls back to its designed no-data state whenever the Web Analytics read
 * token is unset or the API fails — the card shows the line and no number, never an
 * error. The live card captions its number with VISITORS_SOURCE instead.
 */
export const VISITORS_LINE_H = "Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.";
export const VISITORS_LINE_HOME = "Not connected yet — visitor counts come from Cloudflare Web Analytics.";
/** The live Visitors caption's source clause: what the number counts and where it comes from. */
export const VISITORS_SOURCE = "Pageloads from Cloudflare Web Analytics for seeds.hues.flowers";

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
