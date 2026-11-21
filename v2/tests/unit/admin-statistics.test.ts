/**
 * Slice D (statistics + legacy retirement) without a database: range/signal/show
 * params, UTC period math, 12-week bucketing, deltas, movement, the thin-data rule,
 * trend summaries, href composition, and the rendered TrendBars / controls / cards /
 * tables / snapshot (visitors honesty, pinned lines, empty states, error states).
 * Children ride as trailing createElement arguments, never as props.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { navFor } from "@/lib/admin-auth";
import {
  dailyTrend,
  NO_CLICKS_LINE,
  NO_FRUITLESS_LINE,
  NO_RESULTS_LINE,
  NO_SEARCHES_LINE,
  NO_VIEWS_LINE,
  NO_WAITERS_LINE,
  parseStatisticsParams,
  RANGE_DAYS,
  SHOW_DEFAULT,
  SHOW_WIDE,
  soldOutLine,
  statDelta,
  statMovement,
  statPeriod,
  statisticsHref,
  thinState,
  trendSummary,
  VISITORS_LINE_H,
  VISITORS_LINE_HOME,
  WAITLIST_RANGE_LINE,
  weeklyTrend,
  type SearchesPopularity,
  type SiteCardData,
  type StatPeriod,
  type ViewsClicksPopularity,
  type WaitlistPopularity,
} from "@/lib/admin/statistics";
import { farmSubmissionAdminEmail } from "@/lib/services/messages";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatsSnapshot } from "@/components/admin/StatsSnapshot";
import { TrendBars } from "@/components/admin/TrendBars";
import { PopularityTables } from "@/app/admin/(protected)/statistics/_components/popularity";
import { SignalControl, TimeRangeControl } from "@/app/admin/(protected)/statistics/_components/time-range-control";
import { SiteStatCard } from "@/app/admin/(protected)/statistics/_components/site-stat-card";

const TODAY = "2026-11-20";

describe("range math", () => {
  it("pins the 7d/30d/12w periods (current ends today UTC, spans exactly n days; previous is the equal span immediately before)", () => {
    expect(RANGE_DAYS).toEqual({ "7d": 7, "30d": 30, "12w": 84 });
    const d7 = statPeriod(TODAY, "7d");
    expect([d7.start, d7.end, d7.prevStart, d7.prevEnd, d7.days]).toEqual(["2026-11-14", "2026-11-20", "2026-11-07", "2026-11-13", 7]);
    expect(d7.words).toBe("Nov 14 – Nov 20, 2026");
    expect(d7.caption).toBe("Last 7 days · Nov 14 – Nov 20, 2026");
    const d30 = statPeriod(TODAY, "30d");
    expect([d30.start, d30.end, d30.prevStart, d30.prevEnd, d30.days]).toEqual(["2026-10-22", "2026-11-20", "2026-09-22", "2026-10-21", 30]);
    expect(d30.words).toBe("Oct 22 – Nov 20, 2026");
    expect(d30.caption).toBe("Last 30 days · Oct 22 – Nov 20, 2026");
    const w12 = statPeriod(TODAY, "12w");
    expect([w12.start, w12.end, w12.prevStart, w12.prevEnd, w12.days]).toEqual(["2026-08-29", "2026-11-20", "2026-06-06", "2026-08-28", 84]);
    expect(w12.words).toBe("Aug 29 – Nov 20, 2026");
    expect(w12.caption).toBe("Last 12 weeks · Aug 29 – Nov 20, 2026");
  });

  it("renders both years when the range spans New Year", () => {
    expect(statPeriod("2027-01-03", "7d").words).toBe("Dec 28, 2026 – Jan 3, 2027");
  });

  it("falls back to the defaults on invalid params", () => {
    expect(parseStatisticsParams({})).toEqual({ range: "7d", signal: "views", show: SHOW_DEFAULT });
    expect(parseStatisticsParams({ range: "9d", signal: "bots", show: "99" })).toEqual({ range: "7d", signal: "views", show: SHOW_DEFAULT });
    expect(parseStatisticsParams({ range: "30d", signal: "clicks", show: "25" })).toEqual({ range: "30d", signal: "clicks", show: SHOW_WIDE });
  });

  it("composes range + signal + show into one href, omitting defaults", () => {
    expect(statisticsHref({})).toBe("/admin/statistics");
    expect(statisticsHref({ range: "7d", signal: "views", show: 10 })).toBe("/admin/statistics");
    expect(statisticsHref({ range: "30d", signal: "clicks", show: 25 })).toBe("/admin/statistics?range=30d&signal=clicks&show=25");
    expect(statisticsHref({ signal: "waitlist" })).toBe("/admin/statistics?signal=waitlist");
  });
});

describe("trend bucketing", () => {
  const byDay = new Map([
    ["2026-11-14", 1],
    ["2026-11-16", 4],
    ["2026-11-20", 2],
  ]);

  it("builds one daily bucket per day, zero-filling gaps", () => {
    const buckets = dailyTrend("2026-11-14", "2026-11-20", byDay);
    expect(buckets.map((b) => [b.key, b.label, b.value])).toEqual([
      ["2026-11-14", "Nov 14", 1],
      ["2026-11-15", "Nov 15", 0],
      ["2026-11-16", "Nov 16", 4],
      ["2026-11-17", "Nov 17", 0],
      ["2026-11-18", "Nov 18", 0],
      ["2026-11-19", "Nov 19", 0],
      ["2026-11-20", "Nov 20", 2],
    ]);
  });

  it("buckets 12w into twelve 7-day buckets ending today, oldest first", () => {
    const full = new Map<string, number>();
    for (let d = "2026-08-29"; d <= "2026-11-20"; d = addDay(d)) full.set(d, 1);
    const buckets = weeklyTrend("2026-08-29", "2026-11-20", full);
    expect(buckets).toHaveLength(12);
    expect(buckets[0]).toEqual({ key: "2026-08-29", label: "Aug 29 – Sep 4", value: 7 });
    expect(buckets[11]).toEqual({ key: "2026-11-14", label: "Nov 14 – Nov 20", value: 7 });
    expect(buckets.map((b) => b.key)).toEqual([
      "2026-08-29",
      "2026-09-05",
      "2026-09-12",
      "2026-09-19",
      "2026-09-26",
      "2026-10-03",
      "2026-10-10",
      "2026-10-17",
      "2026-10-24",
      "2026-10-31",
      "2026-11-07",
      "2026-11-14",
    ]);
  });

  it("starts a thin 12w trend at dataSince with a short first bucket", () => {
    const buckets = weeklyTrend("2026-11-10", "2026-11-20", new Map([["2026-11-15", 12]]));
    expect(buckets).toEqual([
      { key: "2026-11-10", label: "Nov 10 – Nov 13", value: 0 },
      { key: "2026-11-14", label: "Nov 14 – Nov 20", value: 12 },
    ]);
  });

  function addDay(d: string): string {
    return new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }
});

describe("deltas and movement", () => {
  it("renders arrow + percent + word, never color alone", () => {
    expect(statDelta(112, 100)).toEqual({ kind: "up", text: "▲ 12% up" });
    expect(statDelta(95, 100)).toEqual({ kind: "down", text: "▼ 5% down" });
    expect(statDelta(8, 4)).toEqual({ kind: "up", text: "▲ 100% up" });
  });

  it("pins the edges: New, No change, and ▼ 100% down", () => {
    expect(statDelta(5, 0)).toEqual({ kind: "new", text: "New" });
    expect(statDelta(7, 7)).toEqual({ kind: "no-change", text: "No change" });
    expect(statDelta(0, 0)).toEqual({ kind: "no-change", text: "No change" });
    expect(statDelta(0, 9)).toEqual({ kind: "down", text: "▼ 100% down" });
  });

  it("moves by previous rank minus current rank, with New for no previous value", () => {
    expect(statMovement(1, 3)).toEqual({ kind: "up", text: "▲ 2" });
    expect(statMovement(4, 3)).toEqual({ kind: "down", text: "▼ 1" });
    expect(statMovement(2, 2)).toEqual({ kind: "same", text: "—" });
    expect(statMovement(5, null)).toEqual({ kind: "new", text: "New" });
  });
});

describe("thin data", () => {
  const period: StatPeriod = statPeriod(TODAY, "7d");

  it("suppresses comparisons when the previous period starts before dataSince", () => {
    const thin = thinState("2026-11-10", period.prevStart, period.start, TODAY);
    expect(thin.thin).toBe(true);
    expect(thin.days).toBe(11);
    expect(thin.thinLine).toBe("Only 11 days of data so far — comparisons start after the first full period.");
    expect(thin.dataBegins).toBeNull();
  });

  it("keeps comparisons once the previous period is fully covered", () => {
    const full = thinState("2026-11-07", period.prevStart, period.start, TODAY);
    expect(full.thin).toBe(false);
    expect(full.thinLine).toBeNull();
    expect(full.dataBegins).toBeNull();
  });

  it("adds Data begins when the current period also starts before dataSince", () => {
    const thin = thinState("2026-11-16", period.prevStart, period.start, TODAY);
    expect(thin.thin).toBe(true);
    expect(thin.dataBegins).toBe("Data begins Nov 16, 2026.");
  });

  it("has no lines at all when the signal has no history", () => {
    expect(thinState(null, period.prevStart, period.start, TODAY)).toEqual({ thin: true, days: null, thinLine: null, dataBegins: null });
  });
});

describe("trend summaries and sold-out share", () => {
  it("peaks in plain words (earliest peak wins ties), weekly and daily", () => {
    const buckets = dailyTrend("2026-11-14", "2026-11-20", new Map([["2026-11-17", 9]]));
    expect(trendSummary("Clicks to sellers", buckets, false)).toBe("Clicks to sellers peaked on Tuesday, Nov 17, with 9.");
    const weekly = weeklyTrend("2026-11-14", "2026-11-20", new Map([["2026-11-15", 12]]));
    expect(trendSummary("Clicks to sellers", weekly, true)).toBe("Clicks to sellers peaked in the week of Nov 14, with 12.");
  });

  it("names a zero period with history as none, never a blank chart", () => {
    const buckets = dailyTrend("2026-11-14", "2026-11-20", new Map());
    expect(trendSummary("Waitlist signups", buckets, false)).toBe("Waitlist signups: none in this period.");
  });

  it("shares the sold-out percent, absent when clicks are 0", () => {
    expect(soldOutLine(25, 5)).toBe("20% of clicks were on sold-out listings");
    expect(soldOutLine(0, 0)).toBeNull();
  });
});

// ─── Components ─────────────────────────────────────────────────────────────

const CAPTION_7D = "Last 7 days · Nov 14 – Nov 20, 2026";
const BUCKETS_7D = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map((d, i) => ({
  key: d,
  label: d.slice(5),
  value: i === 3 ? 9 : 1,
}));

function liveCard(over: Partial<SiteCardData> = {}): SiteCardData {
  return {
    key: "clicks",
    label: "Clicks to sellers",
    href: "/admin/statistics?signal=clicks",
    caption: CAPTION_7D,
    total: 25,
    delta: { kind: "up", text: "▲ 12% up" },
    trend: { buckets: BUCKETS_7D, summary: "Clicks to sellers peaked on Tuesday, Nov 17, with 9." },
    thinLine: null,
    noData: null,
    error: false,
    ...over,
  };
}

/** Element text (tags stripped): the visitors honesty assertions read this, never markup. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

describe("TrendBars", () => {
  it("renders one bar per bucket plus the visible summary and the hidden data table", () => {
    const html = renderToStaticMarkup(createElement(TrendBars, { label: "Clicks to sellers", buckets: BUCKETS_7D, summary: "Clicks to sellers peaked on Tuesday, Nov 17, with 9.", size: "full" }));
    expect(html).toContain("Clicks to sellers peaked on Tuesday, Nov 17, with 9.");
    expect(html).toContain("bg-leaf-50");
    expect(html.match(/bg-leaf(?!-)/g)).toHaveLength(7);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Clicks to sellers — the numbers behind the chart");
    expect(html).toContain("11-17");
    expect(html).toContain(">9<");
  });

  it("hides the visible summary at snapshot scale (it lives in the card's accessible name)", () => {
    const html = renderToStaticMarkup(createElement(TrendBars, { label: "Clicks to sellers", buckets: BUCKETS_7D, summary: "Clicks to sellers peaked on Tuesday, Nov 17, with 9.", size: "mini", hideSummary: true }));
    expect(html).not.toContain("figcaption");
    expect(html).toContain('class="sr-only"');
  });
});

describe("controls", () => {
  it("the range control restates the range in words and preserves signal + show", () => {
    const html = renderToStaticMarkup(createElement(TimeRangeControl, { range: "30d", signal: "clicks", show: 25, words: "Oct 22 – Nov 20, 2026" }));
    expect(html).toContain("Oct 22 – Nov 20, 2026");
    expect(html).toContain("7 days");
    expect(html).toContain("30 days");
    expect(html).toContain("12 weeks");
    expect(html).toContain('href="/admin/statistics?range=30d&amp;signal=clicks&amp;show=25"');
    expect(html).toContain('href="/admin/statistics?signal=clicks&amp;show=25"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("the signal switcher carries the four signals and preserves range + show", () => {
    const html = renderToStaticMarkup(createElement(SignalControl, { range: "30d", signal: "searches", show: 10 }));
    for (const label of ["Views", "Clicks to sellers", "Waitlist", "Searches"]) expect(html).toContain(label);
    expect(html).toContain('href="/admin/statistics?range=30d&amp;signal=clicks"');
    expect(html).toContain('href="/admin/statistics?range=30d"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });
});

describe("H site cards", () => {
  it("a live card renders number, delta, chart + summary + hidden table, and the range caption", () => {
    const html = renderToStaticMarkup(createElement(SiteStatCard, { card: liveCard(), retryHref: "/admin/statistics" }));
    expect(html).toContain("Clicks to sellers");
    expect(html).toContain(">25<");
    expect(html).toContain("▲ 12% up");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("Clicks to sellers peaked on Tuesday, Nov 17, with 9.");
    expect(html).toContain('class="sr-only"');
    expect(html).toContain(CAPTION_7D);
    expect(html).not.toContain('href="/admin/statistics?signal=clicks"'); // H cards are not links
  });

  it("a thin card swaps the delta for the thin line while the total still renders", () => {
    const html = renderToStaticMarkup(
      createElement(SiteStatCard, { card: liveCard({ delta: null, thinLine: "Only 11 days of data so far — comparisons start after the first full period." }), retryHref: "/admin/statistics" }),
    );
    expect(html).toContain(">25<");
    expect(html).not.toContain("▲ 12% up");
    expect(html).toContain("Only 11 days of data so far — comparisons start after the first full period.");
  });

  it("a no-data card shows its line and caption with no number", () => {
    const html = renderToStaticMarkup(
      createElement(SiteStatCard, { card: liveCard({ key: "accounts", label: "New accounts", href: "/admin/statistics", total: null, delta: null, trend: null, noData: "No accounts created yet." }), retryHref: "/admin/statistics" }),
    );
    expect(html).toContain("No accounts created yet.");
    expect(html).toContain(CAPTION_7D);
    // No Stat number, no tabular figure, no delta — the caption's dates are the only digits.
    expect(html).not.toContain("text-[32px]");
    expect(html).not.toContain("tabular-nums");
    expect(html).not.toContain("▲");
    expect(html).not.toContain("▼");
  });

  it("the H Visitors card pins the not-connected line with no number", () => {
    expect(VISITORS_LINE_H).toBe("Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.");
    const html = renderToStaticMarkup(
      createElement(SiteStatCard, { card: liveCard({ key: "visitors", label: "Visitors", href: "/admin/statistics", total: null, delta: null, trend: null, noData: VISITORS_LINE_H }), retryHref: "/admin/statistics" }),
    );
    expect(html).toContain(VISITORS_LINE_H);
    expect(html).not.toContain("text-[32px]");
    expect(html).not.toContain("tabular-nums");
  });

  it("a failed card degrades to its error state with Retry, never a blank", () => {
    const html = renderToStaticMarkup(createElement(SiteStatCard, { card: liveCard({ total: null, delta: null, trend: null, error: true }), retryHref: "/admin/statistics?signal=clicks" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("didn&#x27;t load");
    expect(html).toContain('href="/admin/statistics?signal=clicks"');
    expect(html).toContain("Retry");
  });
});

describe("home snapshot", () => {
  const cards: SiteCardData[] = [
    { key: "visitors", label: "Visitors", href: "/admin/statistics", caption: CAPTION_7D, total: null, delta: null, trend: null, thinLine: null, noData: VISITORS_LINE_HOME, error: false },
    { key: "accounts", label: "New accounts", href: "/admin/statistics", caption: CAPTION_7D, total: 8, delta: { kind: "up", text: "▲ 100% up" }, trend: { buckets: BUCKETS_7D, summary: "New accounts peaked on Tuesday, Nov 17, with 9." }, thinLine: null, noData: null, error: false },
    { key: "waitlist", label: "Waitlist signups", href: "/admin/statistics?signal=waitlist", caption: CAPTION_7D, total: 17, delta: { kind: "up", text: "▲ 750% up" }, trend: { buckets: BUCKETS_7D, summary: "Waitlist signups peaked on Tuesday, Nov 17, with 9." }, thinLine: null, noData: null, error: false },
    { key: "clicks", label: "Clicks to sellers", href: "/admin/statistics?signal=clicks", caption: CAPTION_7D, total: 25, delta: null, trend: { buckets: BUCKETS_7D, summary: "Clicks to sellers peaked on Tuesday, Nov 17, with 9." }, thinLine: "Only 11 days of data so far — comparisons start after the first full period.", noData: null, error: false },
  ];

  it("renders totals, deltas-or-thin-lines, 7-bar trends and the pinned hrefs", () => {
    const html = renderToStaticMarkup(createElement(StatsSnapshot, { snapshot: { cards } }));
    expect(html).toContain(">8<");
    expect(html).toContain(">17<");
    expect(html).toContain(">25<");
    expect(html).toContain("▲ 100% up");
    expect(html).toContain("Only 11 days of data so far — comparisons start after the first full period.");
    expect(html.match(/bg-leaf(?!-)/g)).toHaveLength(21); // three live cards × seven mini bars
    expect(html).toContain('href="/admin/statistics?signal=clicks"');
    expect(html).toContain('href="/admin/statistics?signal=waitlist"');
    expect(html).toContain('aria-label="New accounts, 8, ▲ 100% up, New accounts peaked on Tuesday, Nov 17, with 9."');
  });

  it("keeps the Visitors card numberless with the short not-connected line", () => {
    expect(VISITORS_LINE_HOME).toBe("Not connected yet — visitor counts come from Cloudflare Web Analytics.");
    const html = renderToStaticMarkup(createElement(StatsSnapshot, { snapshot: { cards } }));
    expect(html).toContain(VISITORS_LINE_HOME);
    const visitorsText = textOf(html.slice(html.indexOf("Visitors"), html.indexOf("New accounts")));
    expect(visitorsText).not.toMatch(/\d/);
  });

  it("degrades per card and per band, never blanking the dashboard", () => {
    const oneBad = renderToStaticMarkup(createElement(StatsSnapshot, { snapshot: { cards: cards.map((c) => (c.key === "clicks" ? { ...c, error: true } : c)) } }));
    expect(oneBad).toContain(">8<"); // the live cards still render
    expect(oneBad).toContain('role="alert"');
    const bandBad = renderToStaticMarkup(createElement(StatsSnapshot, { snapshot: null }));
    expect(bandBad).toContain('role="alert"');
    expect(bandBad).toContain('href="/admin"');
    expect(bandBad).toContain("Try again");
  });
});

describe("popularity tables", () => {
  const views: ViewsClicksPopularity = {
    signal: "views",
    title: "Most viewed varieties",
    valueLabel: "Views",
    rows: [
      { rank: 1, slug: "chantilly-purple", name: "Chantilly Purple", crop: "Snapdragon", value: 120, movement: { kind: "up", text: "▲ 11" } },
      { rank: 2, slug: "kings-ransom", name: "King’s Ransom", crop: "Sweet pea", value: 110, movement: { kind: "new", text: "New" } },
    ],
    shown: 2,
    total: 12,
    thin: false,
    thinLine: null,
    emptyLine: NO_VIEWS_LINE,
    soldOutLine: null,
    caption: CAPTION_7D,
    error: false,
  };

  it("ranks with F2 + public links, crop, value and movement, widening via ?show=25", () => {
    const html = renderToStaticMarkup(createElement(PopularityTables, { data: views, range: "7d", signal: "views", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain("Most viewed varieties");
    expect(html).toContain('href="/admin/varieties?variety=chantilly-purple"');
    expect(html).toContain('href="/variety/chantilly-purple"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Snapdragon");
    expect(html).toContain(">120<");
    expect(html).toContain("▲ 11");
    expect(html).toContain(">New<");
    expect(html).toContain("scope=");
    expect(html).toContain("Showing 2 of 12.");
    expect(html).toContain('href="/admin/statistics?show=25"');
    expect(html).toContain("Show top 25");
    expect(html).toContain(CAPTION_7D);
  });

  it("omits the movement column and carries the thin line when thin", () => {
    const thin = { ...views, thin: true, thinLine: "Only 11 days of data so far — comparisons start after the first full period.", rows: views.rows.map((r) => ({ ...r, movement: null })) };
    const html = renderToStaticMarkup(createElement(PopularityTables, { data: thin, range: "7d", signal: "views", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain(">120<"); // totals still render
    expect(html).not.toContain("Movement");
    expect(html).not.toContain("▲ 11");
    expect(html).toContain("Only 11 days of data so far — comparisons start after the first full period.");
  });

  it("renders the empty line when the ranking has no rows", () => {
    expect(NO_VIEWS_LINE).toBe("No views recorded in this period.");
    expect(NO_CLICKS_LINE).toBe("No clicks recorded in this period.");
    const html = renderToStaticMarkup(createElement(PopularityTables, { data: { ...views, rows: [], shown: 0, total: 0 }, range: "7d", signal: "views", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain(NO_VIEWS_LINE);
    expect(html).not.toContain("Show top 25");
  });

  it("carries the sold-out share on the clicks card", () => {
    const clicks = { ...views, signal: "clicks" as const, title: "Top varieties by clicks", valueLabel: "Clicks", emptyLine: NO_CLICKS_LINE, soldOutLine: "20% of clicks were on sold-out listings" };
    const html = renderToStaticMarkup(createElement(PopularityTables, { data: clicks, range: "7d", signal: "clicks", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain("20% of clicks were on sold-out listings");
  });

  it("renders the waitlist ranking with waiters, verified and sellers — no movement, ever", () => {
    expect(WAITLIST_RANGE_LINE).toBe("The current waiting list — it doesn’t change with the date range.");
    expect(NO_WAITERS_LINE).toBe("No one is waiting on a variety yet.");
    const data: WaitlistPopularity = {
      signal: "waitlist",
      rows: [{ rank: 1, slug: "chantilly-purple", name: "Chantilly Purple", crop: "Snapdragon", waiters: 3, verified: 2, sellers: 1 }],
      shown: 1,
      total: 1,
      caption: WAITLIST_RANGE_LINE,
      error: false,
    };
    const html = renderToStaticMarkup(createElement(PopularityTables, { data, range: "30d", signal: "waitlist", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain("Most-waited varieties");
    expect(html).toContain("Waiters");
    expect(html).toContain("Verified");
    expect(html).toContain("Sellers");
    expect(html).not.toContain("Movement");
    expect(html).not.toContain("▲");
    expect(html).toContain(WAITLIST_RANGE_LINE);
    const empty = renderToStaticMarkup(createElement(PopularityTables, { data: { ...data, rows: [], shown: 0, total: 0 }, range: "7d", signal: "waitlist", show: 10, retryHref: "/admin/statistics" }));
    expect(empty).toContain(NO_WAITERS_LINE);
  });

  it("renders top searches with usually-finds, omitting the clause when nothing followed", () => {
    expect(NO_SEARCHES_LINE).toBe("No searches recorded in this period.");
    const data: SearchesPopularity = {
      signal: "searches",
      top: [
        { term: "xqzj rose campion", count: 4, finds: { slug: "rose-campion", name: "Rose Campion" } },
        { term: "xqzj blue flax", count: 2, finds: null },
      ],
      topShown: 2,
      topTotal: 2,
      noResults: [{ term: "xqzj nonsense", count: 3 }],
      noResultsShown: 1,
      noResultsTotal: 1,
      caption: CAPTION_7D,
      error: false,
    };
    const html = renderToStaticMarkup(createElement(PopularityTables, { data, range: "7d", signal: "searches", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain("Top searches");
    expect(html).toContain("xqzj rose campion");
    expect(html).toContain("usually finds");
    expect(html).toContain('href="/admin/varieties?variety=rose-campion"');
    expect(html).toContain("Rose Campion");
    expect(html).toContain(NO_RESULTS_LINE);
    expect(html).toContain("xqzj nonsense");
    expect(html.match(/usually finds/g)).toHaveLength(2); // the phone + desktop renderings of the one clause
    expect(html.match(/admin\/varieties\?variety=/g)).toHaveLength(1); // omitted for the clickless term
  });

  it("renders both searches empty states with their pinned lines", () => {
    expect(NO_RESULTS_LINE).toBe("People looked for these and found nothing.");
    expect(NO_FRUITLESS_LINE).toBe("No fruitless searches in this period — every search found something.");
    const data: SearchesPopularity = { signal: "searches", top: [], topShown: 0, topTotal: 0, noResults: [], noResultsShown: 0, noResultsTotal: 0, caption: CAPTION_7D, error: false };
    const html = renderToStaticMarkup(createElement(PopularityTables, { data, range: "7d", signal: "searches", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain(NO_SEARCHES_LINE);
    expect(html).toContain(NO_RESULTS_LINE);
    expect(html).toContain(NO_FRUITLESS_LINE);
  });

  it("degrades a failed signal to its error state with Retry", () => {
    const html = renderToStaticMarkup(createElement(PopularityTables, { data: { ...views, error: true }, range: "7d", signal: "views", show: 10, retryHref: "/admin/statistics" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("didn&#x27;t load");
    expect(html).toContain("Retry");
  });
});

describe("navigation (Slice 0 note N4)", () => {
  const REVIEWER = { name: "Rae Reviewer", email: "rae@example.com", role: "reviewer" };
  const ADMIN = { name: "Ann Admin", email: "ann@example.com", role: "admin" };

  it("navFor seats Statistics between Varieties and Accounts for both roles", () => {
    expect(navFor("reviewer").map((i) => i.key)).toEqual(["home", "review", "sellers", "listings", "varieties", "statistics"]);
    expect(navFor("admin").map((i) => i.key)).toEqual(["home", "review", "sellers", "listings", "varieties", "statistics", "accounts"]);
    const stats = navFor("reviewer").find((i) => i.key === "statistics")!;
    expect(stats).toMatchObject({ label: "Statistics", href: "/admin/statistics", adminOnly: false, shortLabel: "Stats" });
  });

  it("the phone tab bar is the five pinned tabs with Stats", () => {
    for (const viewer of [REVIEWER, ADMIN]) {
      const html = renderToStaticMarkup(createElement(AdminShell, { viewer, section: "statistics", reviewTotal: 0 }, createElement("p", null, "body")));
      expect(html).toContain("grid-cols-5");
      expect(html).toContain('href="/admin/statistics"');
      const tabs = html.slice(html.indexOf("grid-cols-5"));
      const order = [">Home<", ">Review<", ">Sellers<", ">Stats<", ">More<"].map((t) => tabs.indexOf(t));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });

  it("the More page does not gain Statistics (spec §6: Listings, Varieties, Accounts)", () => {
    const src = readFileSync(join(process.cwd(), "app/admin/(protected)/more/page.tsx"), "utf8");
    expect(src).toContain('"listings"');
    expect(src).toContain('"varieties"');
    expect(src).toContain('"accounts"');
    expect(src).not.toContain("statistics");
  });
});

describe("legacy retirement", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(join(process.cwd(), dir))) {
      const p = join(dir, name);
      if (statSync(join(process.cwd(), p)).isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }

  it("/admin/waitlist, /admin/waitlist/action and /admin/login are not routes any more", () => {
    expect(existsSync(join(process.cwd(), "app/admin/waitlist"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/admin/login"))).toBe(false);
    expect(existsSync(join(process.cwd(), "lib/admin-session.ts"))).toBe(false);
  });

  it("no file in app/, lib/ or components/ imports the deleted lib/admin-session module", () => {
    const files = ["app", "lib", "components"].flatMap(walk);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => readFileSync(join(process.cwd(), f), "utf8").includes("lib/admin-session"));
    expect(offenders).toEqual([]);
  });

  it("the farm-submission notice links to the new seller queue in both bodies", () => {
    const email = farmSubmissionAdminEmail({ site: "https://seeds.hues.flowers", to: "dustin@example.com", id: 7, farmName: "Fixture Farm", city: "Junction City", state: "OR", website: "https://example.com", contactName: "Fran", contactEmail: "fran@example.com", declared: false });
    expect(email.html).toContain('href="https://seeds.hues.flowers/admin/review?queue=sellers"');
    expect(email.html).toContain("Open the review queue");
    expect(email.text).toContain("Review queue: https://seeds.hues.flowers/admin/review?queue=sellers");
    expect(email.html).not.toContain("/admin/waitlist");
    expect(email.text).not.toContain("/admin/waitlist");
  });
});
