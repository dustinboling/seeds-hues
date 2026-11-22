/**
 * Visitors live (Statistics Visitors card follow-up; admin spec §7 + §15 item 5): with a
 * mocked GraphQL endpoint the card aggregates the host's pageloads only (other hosts
 * under the same site tag never counted — the mock honors the payload's own filters,
 * and the payload itself is asserted to carry site tag + seeds.hues.flowers), with
 * exact deltas, per-day trends and the honest source caption; absent secret, empty
 * evidence, or any API failure keeps the designed no-data state with no number while
 * the rest of Statistics renders its own states. Today is pinned to 2026-11-20 (UTC).
 * The read token here is a clearly-fake placeholder — never a real secret.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  CF_ANALYTICS_ACCOUNT_TAG,
  CF_ANALYTICS_SITE_TAG,
  splitVisitorsRange,
  VISITORS_GRAPHQL_URL,
  VISITORS_REQUEST_HOST,
} from "@/lib/admin/visitors";
import {
  createAdminStatisticsService,
  VISITORS_LINE_H,
  VISITORS_LINE_HOME,
  VISITORS_SOURCE,
} from "@/lib/admin/statistics";
import { runtimeEnvFrom } from "@/lib/api/env-config";
import { createServices } from "@/lib/services";
import { servicesFor } from "@/lib/services/wire";
import { StatsSnapshot } from "@/components/admin/StatsSnapshot";
import { SiteStatCard } from "@/app/admin/(protected)/statistics/_components/site-stat-card";
import { mockAnalyticsServer, type AnalyticsFixtureRow } from "../helpers/analytics-mock";

const TEST_TOKEN = "test-analytics-token";
const NOW = () => new Date("2026-11-20T12:00:00.000Z");
const HOST = "seeds.hues.flowers";
const CAPTION_7D = "Last 7 days · Nov 14 – Nov 20, 2026";
const LIVE_CAPTION_7D = `${CAPTION_7D} · ${VISITORS_SOURCE}`;
/** The first-party cards need D1; these tests read only the Visitors card (stub db → the others take their designed error states). */
const fakeDb = {} as unknown as Db;

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) out.push(d);
  return out;
}

/**
 * The 7-day window's host rows: previous period (Nov 7–13) 10/day = 70, current
 * (Nov 14–20) 5/day with Nov 20 at 50 = 80 — plus zone-mate decoys under the same
 * site tag (999+/day) and out-of-window rows that must never leak into the card.
 */
function live7dRows(): AnalyticsFixtureRow[] {
  const rows: AnalyticsFixtureRow[] = [];
  for (const d of days("2026-11-07", "2026-11-13")) rows.push({ date: d, host: HOST, count: 10 });
  for (const d of days("2026-11-14", "2026-11-19")) rows.push({ date: d, host: HOST, count: 5 });
  rows.push({ date: "2026-11-20", host: HOST, count: 50 });
  for (const d of days("2026-11-07", "2026-11-20")) rows.push({ date: d, host: "www.hues.flowers", count: 999 });
  rows.push({ date: "2026-11-15", host: "flowers.hues.flowers", count: 500 });
  rows.push({ date: "2026-11-06", host: HOST, count: 500 });
  rows.push({ date: "2026-11-21", host: HOST, count: 500 });
  return rows;
}

/** Element text (tags stripped): the honesty assertions read this, never markup. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

describe("live Visitors card", () => {
  it("aggregates the host's pageloads only, with the exact delta, per-day trend and source caption", async () => {
    const server = mockAnalyticsServer(live7dRows());
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    const overview = await svc.overview("7d");
    const visitors = overview.cards.find((c) => c.key === "visitors")!;
    expect(visitors.error).toBe(false);
    expect(visitors.noData).toBeNull();
    expect(visitors.thinLine).toBeNull();
    // 80, not 80 + 13,986 zone-mate pageloads + 1,000 out-of-window rows.
    expect(visitors.total).toBe(80);
    expect(visitors.delta).toEqual({ kind: "up", text: "▲ 14% up" });
    expect(visitors.trend!.buckets.map((b) => [b.key, b.value])).toEqual([
      ["2026-11-14", 5],
      ["2026-11-15", 5],
      ["2026-11-16", 5],
      ["2026-11-17", 5],
      ["2026-11-18", 5],
      ["2026-11-19", 5],
      ["2026-11-20", 50],
    ]);
    expect(visitors.trend!.summary).toBe("Visitors peaked on Friday, Nov 20, with 50.");
    expect(VISITORS_SOURCE).toBe("Pageloads from Cloudflare Web Analytics for seeds.hues.flowers");
    expect(visitors.caption).toBe(LIVE_CAPTION_7D);

    const html = renderToStaticMarkup(createElement(SiteStatCard, { card: visitors, retryHref: "/admin/statistics" }));
    expect(html).toContain("Visitors");
    expect(html).toContain(">80<");
    expect(html).toContain("▲ 14% up");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("Visitors peaked on Friday, Nov 20, with 50.");
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("Visitors — the numbers behind the chart");
    expect(html).toContain(LIVE_CAPTION_7D);
  });

  it("sends one RUM query carrying BOTH filters, the account node and the full window", async () => {
    const server = mockAnalyticsServer(live7dRows());
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    await svc.overview("7d");
    expect(server.seen).toHaveLength(1); // the 14-day span fits one chunk
    const req = server.seen[0]!;
    expect(req.url).toBe(VISITORS_GRAPHQL_URL);
    expect(req.method).toBe("POST");
    expect(req.authorization).toBe(`Bearer ${TEST_TOKEN}`);
    expect(req.variables).toMatchObject({
      accountTag: CF_ANALYTICS_ACCOUNT_TAG,
      siteTag: CF_ANALYTICS_SITE_TAG,
      requestHost: VISITORS_REQUEST_HOST,
      from: "2026-11-07",
      to: "2026-11-20",
    });
    expect(CF_ANALYTICS_ACCOUNT_TAG).toBe("51080ac04974bef5a30d7ceb5b79e9e2");
    expect(CF_ANALYTICS_SITE_TAG).toBe("ae44dc0d0d524ddaa5a485bc5e62e7ff");
    expect(VISITORS_REQUEST_HOST).toBe("seeds.hues.flowers");
    expect(req.query).toContain("rumPageloadEventsAdaptiveGroups");
    expect(req.query).toContain("siteTag");
    expect(req.query).toContain("requestHost");
  });

  it("chunks long ranges into contiguous ≤28-day windows, every chunk carrying both filters", async () => {
    const server = mockAnalyticsServer([]);
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    await svc.overview("12w");
    expect(server.seen).toHaveLength(6); // 168 days = six 28-day chunks
    const windows = server.seen.map((r) => [r.variables.from, r.variables.to]);
    expect(windows[0]![0]).toBe("2026-06-06");
    expect(windows[5]![1]).toBe("2026-11-20");
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = new Date(Date.parse(`${String(windows[i - 1]![1])}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      expect(windows[i]![0]).toBe(prevEnd); // contiguous, no gaps, no overlaps
    }
    for (const req of server.seen) {
      expect(req.variables).toMatchObject({ siteTag: CF_ANALYTICS_SITE_TAG, requestHost: VISITORS_REQUEST_HOST });
    }
  });

  it("splits ranges into whole-day chunks (28-day singles, 29-day pairs)", () => {
    expect(splitVisitorsRange("2026-11-07", "2026-11-20")).toEqual([{ from: "2026-11-07", to: "2026-11-20" }]);
    expect(splitVisitorsRange("2026-10-24", "2026-11-20")).toEqual([{ from: "2026-10-24", to: "2026-11-20" }]);
    expect(splitVisitorsRange("2026-10-23", "2026-11-20")).toEqual([
      { from: "2026-10-23", to: "2026-11-19" },
      { from: "2026-11-20", to: "2026-11-20" },
    ]);
  });

  it("applies the thin-data rule unchanged when the previous period is not fully covered", async () => {
    const rows: AnalyticsFixtureRow[] = [];
    for (const d of days("2026-11-16", "2026-11-20")) rows.push({ date: d, host: HOST, count: 10 });
    for (const d of days("2026-11-07", "2026-11-20")) rows.push({ date: d, host: "www.hues.flowers", count: 999 });
    const server = mockAnalyticsServer(rows);
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    const visitors = (await svc.overview("7d")).cards.find((c) => c.key === "visitors")!;
    expect(visitors.total).toBe(50);
    expect(visitors.delta).toBeNull();
    expect(visitors.thinLine).toBe("Only 5 days of data so far — comparisons start after the first full period.");
    expect(visitors.caption).toBe(`${LIVE_CAPTION_7D} · Data begins Nov 16, 2026.`);
    expect(visitors.trend!.buckets.map((b) => [b.key, b.value])).toEqual([
      ["2026-11-16", 10],
      ["2026-11-17", 10],
      ["2026-11-18", 10],
      ["2026-11-19", 10],
      ["2026-11-20", 10],
    ]);
    expect(visitors.trend!.summary).toBe("Visitors peaked on Monday, Nov 16, with 10.");
  });
});

describe("Visitors fallback", () => {
  it("without the secret the card keeps its designed no-data state and never calls the API", async () => {
    let calls = 0;
    const spy: typeof fetch = async () => {
      calls += 1;
      throw new Error("must not call the API without a token");
    };
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsFetch: spy });
    const visitors = (await svc.overview("7d")).cards.find((c) => c.key === "visitors")!;
    expect(calls).toBe(0);
    expect(visitors).toMatchObject({ total: null, delta: null, trend: null, thinLine: null, noData: VISITORS_LINE_H, error: false });
    expect(visitors.caption).toBe(CAPTION_7D); // no source clause without a number
    const html = renderToStaticMarkup(createElement(SiteStatCard, { card: visitors, retryHref: "/admin/statistics" }));
    expect(html).toContain(VISITORS_LINE_H);
    // No Stat number, no tabular figure, no delta, no hidden data table — the caption's
    // restated range dates are the only digits (spec: every card caption restates the range).
    expect(html).not.toContain("text-[32px]");
    expect(html).not.toContain("tabular-nums");
    expect(html).not.toContain("▲");
    expect(html).not.toContain("▼");
    expect(html).not.toContain("sr-only");
  });

  it("the snapshot Visitors card without the secret renders no digit anywhere", async () => {
    const svc = createAdminStatisticsService(fakeDb, { now: NOW });
    const snap = await svc.snapshot();
    const visitors = snap.cards.find((c) => c.key === "visitors")!;
    expect(visitors).toMatchObject({ total: null, noData: VISITORS_LINE_HOME, error: false });
    const html = renderToStaticMarkup(createElement(StatsSnapshot, { snapshot: snap }));
    expect(html).toContain(VISITORS_LINE_HOME);
    const visitorsText = textOf(html.slice(html.indexOf("Visitors"), html.indexOf("New accounts")));
    expect(visitorsText).not.toMatch(/\d/);
  });

  it("a successful-but-empty window stays dark: no pageloads is no evidence of collection", async () => {
    const server = mockAnalyticsServer([]);
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    const visitors = (await svc.overview("7d")).cards.find((c) => c.key === "visitors")!;
    expect(visitors).toMatchObject({ total: null, delta: null, trend: null, noData: VISITORS_LINE_H, error: false });
  });

  const BAD_PAYLOADS: [string, number, unknown][] = [
    ["http 500", 500, { data: null }],
    ["graphql errors", 200, { data: { viewer: { accounts: [] } }, errors: [{ message: "boom" }] }],
    ["errors alongside data", 200, { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ dimensions: { date: "2026-11-16" }, count: 9 }] }] } }, errors: [{ message: "partial" }] }],
    ["missing accounts", 200, { data: { viewer: {} } }],
    ["missing groups", 200, { data: { viewer: { accounts: [{}] } } }],
    ["not json", 200, null],
  ];
  it.each(BAD_PAYLOADS)("a %s response keeps the no-data state, never an error", async (_label, status, body) => {
    const bad: typeof fetch = async () =>
      body === null ? new Response("boom", { status }) : new Response(JSON.stringify(body), { status });
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: bad });
    const visitors = (await svc.overview("7d")).cards.find((c) => c.key === "visitors")!;
    expect(visitors).toMatchObject({ total: null, delta: null, trend: null, noData: VISITORS_LINE_H, error: false });
  });

  it("a network throw and a timeout keep the no-data state", async () => {
    const throwing: typeof fetch = async () => {
      throw new Error("socket hung");
    };
    const hanging: typeof fetch = () => new Promise<Response>(() => {});
    const svcThrow = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: throwing });
    expect((await svcThrow.overview("7d")).cards.find((c) => c.key === "visitors")).toMatchObject({ total: null, noData: VISITORS_LINE_H, error: false });
    const svcHang = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: hanging, analyticsTimeoutMs: 20 });
    expect((await svcHang.overview("7d")).cards.find((c) => c.key === "visitors")).toMatchObject({ total: null, noData: VISITORS_LINE_H, error: false });
  });

  it("one failed chunk fails the whole card closed — never a partial total", async () => {
    const server = mockAnalyticsServer(live7dRows());
    const flaky: typeof fetch = async (...args) => {
      const body = JSON.parse(String(args[1]?.body)) as { variables: { from: string } };
      if (body.variables.from === "2026-10-20") return new Response("bad", { status: 500 });
      return server.fetchFn(...args);
    };
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: flaky });
    const visitors = (await svc.overview("30d")).cards.find((c) => c.key === "visitors")!;
    expect(server.seen.length).toBeGreaterThan(1);
    expect(visitors).toMatchObject({ total: null, noData: VISITORS_LINE_H, error: false });
  });

  it("when the API fails, the rest of Statistics still renders its own states", async () => {
    const bad: typeof fetch = async () => new Response("bad", { status: 500 });
    const svc = createAdminStatisticsService(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: bad });
    const overview = await svc.overview("7d");
    expect(overview.cards.map((c) => c.key)).toEqual(["visitors", "accounts", "waitlist", "clicks"]);
    const html = overview.cards.map((card) => renderToStaticMarkup(createElement(SiteStatCard, { card, retryHref: "/admin/statistics" }))).join("\n");
    expect(html).toContain(VISITORS_LINE_H); // the dark card, not an error
    expect(html.match(/role="alert"/g)).toHaveLength(3); // the stub-db cards degrade per design
    expect(html.match(/Retry/g)).toHaveLength(3);
  });
});

describe("Visitors credential wiring", () => {
  it("reads the token from CF_ANALYTICS_API_TOKEN, trimmed, null when unset", () => {
    expect(runtimeEnvFrom({ CF_ANALYTICS_API_TOKEN: `  ${TEST_TOKEN}  ` }).analyticsToken).toBe(TEST_TOKEN);
    expect(runtimeEnvFrom({}).analyticsToken).toBeNull();
  });

  it("createServices carries the token and fetch override through to a live card", async () => {
    const server = mockAnalyticsServer(live7dRows());
    const services = createServices(fakeDb, { now: NOW, analyticsToken: TEST_TOKEN, analyticsFetch: server.fetchFn });
    const visitors = (await services.adminStatistics.overview("7d")).cards.find((c) => c.key === "visitors")!;
    expect(visitors.total).toBe(80);
    expect(visitors.delta).toEqual({ kind: "up", text: "▲ 14% up" });
    expect(server.seen[0]!.authorization).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("servicesFor wires the Worker secret through to a live card", async () => {
    const server = mockAnalyticsServer(live7dRows());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00.000Z"));
    vi.stubGlobal("fetch", server.fetchFn);
    try {
      const services = servicesFor(fakeDb, {
        siteUrl: "https://seeds.hues.flowers",
        corsOrigins: ["https://seeds.hues.flowers"],
        rateLimiter: null,
        snapshots: null,
        revalidateToken: null,
        analyticsToken: TEST_TOKEN,
      });
      const visitors = (await services.adminStatistics.overview("7d")).cards.find((c) => c.key === "visitors")!;
      expect(visitors.total).toBe(80);
      expect(visitors.delta).toEqual({ kind: "up", text: "▲ 14% up" });
      expect(visitors.caption).toBe(LIVE_CAPTION_7D);
      expect(server.seen[0]!.authorization).toBe(`Bearer ${TEST_TOKEN}`);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
