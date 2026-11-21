/**
 * Slice D (statistics) on a throwaway D1 (Miniflare): each ranking and card total
 * equals its hand-computed value from its own table (bots excluded, the lagging
 * daily_stats rollup ignored, searches grouped by normalized term), exact deltas
 * (New / No change / ▼ 100% down) and movement against the FULL previous ranking,
 * the thin-data rule per signal, the sold-out share, searches' modal usually-finds,
 * the range-independent waitlist ranking mirroring waitlistDemand, removed-variety
 * exclusion everywhere, and per-signal error degradation. Today is pinned to
 * 2026-11-20 (UTC) through the services' clock. Seed rows use the xqzj prefix and
 * imagined users; the catalog itself is untouched apart from one removed variety.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services } from "@/lib/services";
import { createAdminStatisticsService } from "@/lib/admin/statistics";
import type { Db } from "@/lib/db/client";
import * as adminRepo from "@/lib/repositories/admin";
import * as accountsRepo from "@/lib/repositories/accounts";
import * as waitlistRepo from "@/lib/repositories/waitlist";

let t: TestD1;
let s: Services;
let sDown: Services;
let sFlat: Services;
const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);

interface SeedV {
  id: number;
  slug: string;
  name: string;
  crop: string;
}
let V: SeedV[] = [];
let Vnew: SeedV;
let Va: SeedV;
let Vb: SeedV;
let R1: SeedV;
let R2: SeedV;
let R3: SeedV;
let S: SeedV[] = [];
let Vrem: { id: number; slug: string } = { id: 0, slug: "" };
let songbirdId = 0;
let listingId = 0;
let sourceId = 0;
const userId = new Map<string, number>();

async function mkUser(tag: string, createdAt: string, verified = false): Promise<number> {
  const u = (await accountsRepo.insertUser(t.db, { email: `xqzj-${tag}@example.com`, name: `Xqzj ${tag}`, createdAt, emailVerified: verified }))!;
  userId.set(tag, u.id);
  return u.id;
}

const join = (tag: string, v: number, date: string) => waitlistRepo.joinWaitlist(t.db, userId.get(tag)!, v, `${date}T10:00:00.000Z`);
const views = (date: string, v: number, n: number) => raw("INSERT INTO variety_view_counts (date, variety_id, views) VALUES (?, ?, ?)", date, v, n).run();
const click = (date: string, v: number, availability: string, bot: boolean) =>
  raw("INSERT INTO click_events (at, listing_id, variety_id, seller_id, availability_at_click, page_type, client, visitor_day_hash, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", `${date}T10:00:00.000Z`, listingId, v, songbirdId, availability, "variety", "web", "hash", bot ? 1 : 0).run();
const search = (date: string, term: string, results: number, clicked: number | null) =>
  raw("INSERT INTO search_events (at, query_normalized, result_count, clicked_variety_id, client) VALUES (?, ?, ?, ?, ?)", `${date}T10:00:00.000Z`, term, results, clicked, "web").run();

let throwaway = 0;
async function insertListing(varietyId: number): Promise<number> {
  throwaway += 1;
  const r = await raw(
    "INSERT INTO listings (variety_id, seller_id, source_id, product_url, status, availability, title_raw, created_at, updated_at, last_checked_at) VALUES (?, ?, ?, ?, 'published', 'in_stock', ?, '2026-11-20T00:00:00.000Z', '2026-11-20T00:00:00.000Z', '2026-11-20T22:14:00.000Z') RETURNING id",
    varietyId,
    songbirdId,
    sourceId,
    `https://example.com/xqzj-stats-${throwaway}`,
    `Xqzj Stats Throwaway ${throwaway}`,
  ).first<{ id: number }>();
  return r!.id;
}

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { now: () => new Date("2026-11-20T12:00:00.000Z") });
  sDown = createServices(t.db, { now: () => new Date("2026-09-18T12:00:00.000Z") });
  sFlat = createServices(t.db, { now: () => new Date("2026-12-31T12:00:00.000Z") });

  const pool = (await raw("SELECT v.id, v.slug, v.variety_name AS name, p.common_name AS crop FROM varieties v JOIN plants p ON p.id = v.plant_id WHERE v.deleted_at IS NULL ORDER BY v.id LIMIT 26").all<SeedV>()).results;
  V = pool.slice(0, 12);
  Vnew = pool[12]!;
  Va = pool[13]!;
  Vb = pool[14]!;
  R1 = pool[15]!;
  R2 = pool[16]!;
  R3 = pool[17]!;
  S = pool.slice(18, 26);
  const plantSlug = (await raw("SELECT slug FROM plants ORDER BY id LIMIT 1").first<{ slug: string }>())!.slug;
  songbirdId = (await raw("SELECT id FROM sellers WHERE slug = 'songbird-seed-co'").first<{ id: number }>())!.id;
  listingId = (await raw("SELECT id FROM listings ORDER BY id LIMIT 1").first<{ id: number }>())!.id;
  sourceId = (await raw("SELECT id FROM sources ORDER BY id LIMIT 1").first<{ id: number }>())!.id;

  // The removed variety: the period's highest views and the most waiters — it must appear nowhere.
  const created = (await adminRepo.createVariety(t.db, { plantSlug, name: "Xqzj Removed", at: "2026-11-01T00:00:00.000Z" }))!;
  await raw("UPDATE varieties SET deleted_at = '2026-11-19T00:00:00.000Z' WHERE id = ?", created.id).run();
  Vrem = { id: created.id, slug: created.slug };

  // ─── users (accounts card: 7d cur 8 / prev 4; dataSince 2026-09-01) ────────
  await mkUser("ua1", "2026-09-01T10:00:00.000Z");
  await mkUser("ua2", "2026-09-01T11:00:00.000Z");
  await mkUser("ub1", "2026-09-06T10:00:00.000Z");
  await mkUser("u1", "2026-11-10T10:00:00.000Z");
  await mkUser("u2", "2026-11-10T11:00:00.000Z");
  await mkUser("w1", "2026-11-11T10:00:00.000Z", true);
  await mkUser("w2", "2026-11-11T11:00:00.000Z", true);
  await mkUser("u3", "2026-11-15T10:00:00.000Z");
  await mkUser("w3", "2026-11-15T11:00:00.000Z");
  await mkUser("u4", "2026-11-16T10:00:00.000Z");
  await mkUser("w4", "2026-11-16T11:00:00.000Z", true);
  await mkUser("u5", "2026-11-17T10:00:00.000Z");
  await mkUser("w5", "2026-11-17T11:00:00.000Z");
  await mkUser("u6", "2026-11-18T10:00:00.000Z");
  await mkUser("w6", "2026-11-18T11:00:00.000Z");

  // ─── waitlist joins (signups card: 7d cur 17 / prev 2; ranking: R1 3/2, R2 2/1, R3 1/0) ──
  await join("w1", R1.id, "2026-11-11");
  await join("w2", R1.id, "2026-11-07");
  await join("w3", R1.id, "2026-11-15");
  await join("w4", R2.id, "2026-11-16");
  await join("w5", R2.id, "2026-11-17");
  await join("w6", R3.id, "2026-11-18");
  for (const tag of ["w1", "w2", "w3", "w4", "w5"]) await join(tag, Vrem.id, "2026-11-18");
  for (const row of S) await join("w1", row.id, "2026-11-16");
  await insertListing(R1.id);
  await insertListing(R1.id);
  await insertListing(R2.id);

  // ─── views (7d cur 130−10i / prev 10i; dataSince 2026-10-01) ────────────────
  for (let i = 0; i < 12; i++) {
    await views("2026-11-16", V[i]!.id, 130 - 10 * (i + 1));
    await views("2026-11-10", V[i]!.id, 10 * (i + 1));
  }
  await views("2026-11-16", Vnew.id, 5);
  await views("2026-11-16", Vrem.id, 1000);
  await views("2026-10-01", V[4]!.id, 7);

  // ─── clicks (7d cur 25 / prev 10; bots + a lying rollup row excluded; dataSince 11-10) ──
  for (let i = 0; i < 5; i++) await click("2026-11-10", V[0]!.id, "in_stock", false);
  for (let i = 0; i < 5; i++) await click("2026-11-11", V[0]!.id, "in_stock", false);
  for (let i = 0; i < 9; i++) await click("2026-11-15", V[0]!.id, "in_stock", false);
  for (let i = 0; i < 3; i++) await click("2026-11-15", V[0]!.id, "sold_out", false);
  for (let i = 0; i < 6; i++) await click("2026-11-16", V[0]!.id, "in_stock", false);
  for (let i = 0; i < 2; i++) await click("2026-11-16", V[0]!.id, "sold_out", false);
  for (let i = 0; i < 5; i++) await click("2026-11-17", V[1]!.id, "in_stock", false);
  for (let i = 0; i < 50; i++) await click("2026-11-16", V[0]!.id, "in_stock", true);
  await raw("INSERT INTO daily_stats (date, variety_id, seller_id, clicks, sold_out_clicks) VALUES ('2026-11-16', ?, ?, 999, 999)", V[0]!.id, songbirdId).run();

  // ─── searches (all in the current period) ──────────────────────────────────
  await search("2026-11-16", "xqzj rose campion", 5, Va.id);
  await search("2026-11-16", "xqzj rose campion", 5, Va.id);
  await search("2026-11-16", "xqzj rose campion", 5, Vb.id);
  await search("2026-11-16", "xqzj rose campion", 5, null);
  await search("2026-11-16", "xqzj blue flax", 3, null);
  await search("2026-11-16", "xqzj blue flax", 3, null);
  await search("2026-11-17", "xqzj ghost flower", 1, Vrem.id);
  await search("2026-11-17", "xqzj ghost flower", 1, Vrem.id);
  await search("2026-11-17", "xqzj nonsense", 0, null);
  await search("2026-11-17", "xqzj nonsense", 0, null);
  await search("2026-11-17", "xqzj nonsense", 0, null);
  await search("2026-11-17", "xqzj other nothing", 0, null);
}, 180_000);

afterAll(async () => {
  await t.dispose();
});

describe("sources are the named ones", () => {
  it("views come from variety_view_counts only (click rows for the same variety change nothing)", async () => {
    const pop = await s.adminStatistics.popularity("7d", "views", 10);
    if (pop.signal !== "views") throw new Error("wrong signal");
    expect(pop.error).toBe(false);
    expect(pop.total).toBe(13);
    expect(pop.shown).toBe(10);
    // Exact values despite 30 click rows + 50 bot rows + a lying rollup row against V1.
    expect(pop.rows.map((r) => [r.slug, r.value])).toEqual(V.slice(0, 10).map((v, i) => [v.slug, 120 - 10 * i]));
    expect(pop.rows[0]).toMatchObject({ rank: 1, name: V[0]!.name, crop: V[0]!.crop });
  });

  it("clicks exclude bots and ignore the contradictory daily_stats row", async () => {
    const overview = await s.adminStatistics.overview("7d");
    const clicks = overview.cards.find((c) => c.key === "clicks")!;
    // 25 real clicks — not 75 (bots), not 1024 (the rollup lie).
    expect(clicks.total).toBe(25);
    const pop = await s.adminStatistics.popularity("7d", "clicks", 10);
    if (pop.signal !== "clicks") throw new Error("wrong signal");
    expect(pop.rows.map((r) => [r.slug, r.value])).toEqual([
      [V[0]!.slug, 20],
      [V[1]!.slug, 5],
    ]);
    // One aggregation feeds both: the card total is the ranking's sum.
    expect(clicks.total).toBe(pop.rows.reduce((n, r) => n + r.value, 0));
  });

  it("waitlist signups count waitlist_entries.created_at; new accounts count users.created_at", async () => {
    const overview = await s.adminStatistics.overview("7d");
    expect(overview.period.words).toBe("Nov 14 – Nov 20, 2026");
    const accounts = overview.cards.find((c) => c.key === "accounts")!;
    expect(accounts.total).toBe(8);
    expect(accounts.caption).toBe("Last 7 days · Nov 14 – Nov 20, 2026");
    const waitlist = overview.cards.find((c) => c.key === "waitlist")!;
    expect(waitlist.total).toBe(17);
  });

  it("searches group by query_normalized", async () => {
    const pop = await s.adminStatistics.popularity("7d", "searches", 10);
    if (pop.signal !== "searches") throw new Error("wrong signal");
    expect(pop.topTotal).toBe(5);
    expect(pop.top.map((r) => [r.term, r.count])).toEqual([
      ["xqzj rose campion", 4],
      ["xqzj nonsense", 3],
      ["xqzj blue flax", 2],
      ["xqzj ghost flower", 2],
      ["xqzj other nothing", 1],
    ]);
  });
});

describe("deltas and movement", () => {
  it("produces exact percents, New, No change and ▼ 100% down through the read model", async () => {
    const overview = await s.adminStatistics.overview("7d");
    expect(overview.cards.find((c) => c.key === "accounts")!.delta).toEqual({ kind: "up", text: "▲ 100% up" });
    expect(overview.cards.find((c) => c.key === "waitlist")!.delta).toEqual({ kind: "up", text: "▲ 750% up" });
    // 30d accounts: a full quiet previous period with a live current one reads New.
    const wide = await s.adminStatistics.overview("30d");
    const wideAccounts = wide.cards.find((c) => c.key === "accounts")!;
    expect(wideAccounts.total).toBe(12);
    expect(wideAccounts.thinLine).toBeNull();
    expect(wideAccounts.delta).toEqual({ kind: "new", text: "New" });
    // An active previous period with an empty current one reads ▼ 100% down.
    const down = await sDown.adminStatistics.overview("7d");
    const downAccounts = down.cards.find((c) => c.key === "accounts")!;
    expect(downAccounts.total).toBe(0);
    expect(downAccounts.delta).toEqual({ kind: "down", text: "▼ 100% down" });
    expect(downAccounts.trend!.summary).toBe("New accounts: none in this period.");
    // Two empty periods read No change.
    const flat = await sFlat.adminStatistics.overview("7d");
    expect(flat.cards.find((c) => c.key === "accounts")!.delta).toEqual({ kind: "no-change", text: "No change" });
  });

  it("moves against the FULL previous ranking, with New for no previous value", async () => {
    const pop = await s.adminStatistics.popularity("7d", "views", 10);
    if (pop.signal !== "views") throw new Error("wrong signal");
    expect(pop.thin).toBe(false);
    expect(pop.rows.map((r) => r.movement!.text)).toEqual(["▲ 11", "▲ 9", "▲ 7", "▲ 5", "▲ 3", "▲ 1", "▼ 1", "▼ 3", "▼ 5", "▼ 7"]);
    const wide = await s.adminStatistics.popularity("7d", "views", 25);
    if (wide.signal !== "views") throw new Error("wrong signal");
    expect(wide.shown).toBe(13);
    // Rank 11 sits below the default slice, yet its figure is true (prev rank 2 → ▼ 9).
    expect(wide.rows[10]).toMatchObject({ slug: V[10]!.slug, value: 20, movement: { kind: "down", text: "▼ 9" } });
    expect(wide.rows[11]).toMatchObject({ slug: V[11]!.slug, movement: { kind: "down", text: "▼ 11" } });
    expect(wide.rows[12]).toMatchObject({ slug: Vnew.slug, value: 5, movement: { kind: "new", text: "New" } });
  });
});

describe("thin data", () => {
  it("suppresses a thin signal's deltas and movement while totals still render", async () => {
    const overview = await s.adminStatistics.overview("7d");
    const clicks = overview.cards.find((c) => c.key === "clicks")!;
    expect(clicks.total).toBe(25);
    expect(clicks.delta).toBeNull();
    expect(clicks.thinLine).toBe("Only 11 days of data so far — comparisons start after the first full period.");
    const pop = await s.adminStatistics.popularity("7d", "clicks", 10);
    if (pop.signal !== "clicks") throw new Error("wrong signal");
    expect(pop.thin).toBe(true);
    expect(pop.thinLine).toBe("Only 11 days of data so far — comparisons start after the first full period.");
    expect(pop.rows.map((r) => r.movement)).toEqual([null, null]);
  });

  it("thins signals independently (views full while clicks thin)", async () => {
    const views = await s.adminStatistics.popularity("7d", "views", 10);
    if (views.signal !== "views") throw new Error("wrong signal");
    expect(views.thin).toBe(false);
    expect(views.thinLine).toBeNull();
    const overview = await s.adminStatistics.overview("7d");
    expect(overview.cards.find((c) => c.key === "accounts")!.thinLine).toBeNull();
  });

  it("starts a pre-dataSince trend at dataSince with the Data begins caption", async () => {
    const pop = await s.adminStatistics.popularity("12w", "views", 10);
    if (pop.signal !== "views") throw new Error("wrong signal");
    expect(pop.thin).toBe(true);
    expect(pop.thinLine).toBe("Only 51 days of data so far — comparisons start after the first full period.");
    expect(pop.caption).toBe("Last 12 weeks · Aug 29 – Nov 20, 2026 · Data begins Oct 1, 2026.");
    expect(pop.rows.map((r) => r.movement)).toEqual(pop.rows.map(() => null));
    // Totals span the whole current period, including the pre-November row.
    expect(pop.rows.find((r) => r.slug === V[0]!.slug)!.value).toBe(130);
    expect(pop.rows.find((r) => r.slug === V[4]!.slug)!.value).toBe(137);
    const overview = await s.adminStatistics.overview("12w");
    const clicks = overview.cards.find((c) => c.key === "clicks")!;
    expect(clicks.caption).toBe("Last 12 weeks · Aug 29 – Nov 20, 2026 · Data begins Nov 10, 2026.");
    expect(clicks.trend!.buckets.map((b) => b.key)).toEqual(["2026-11-10", "2026-11-14"]);
  });
});

describe("sold-out share, trends and searches", () => {
  it("names the sold-out share exactly; absent when clicks are 0", async () => {
    const pop = await s.adminStatistics.popularity("7d", "clicks", 10);
    if (pop.signal !== "clicks") throw new Error("wrong signal");
    expect(pop.soldOutLine).toBe("20% of clicks were on sold-out listings");
    const flat = await sFlat.adminStatistics.popularity("7d", "clicks", 10);
    if (flat.signal !== "clicks") throw new Error("wrong signal");
    expect(flat.rows).toEqual([]);
    expect(flat.soldOutLine).toBeNull();
  });

  it("summarizes trends in plain words with full bucket series", async () => {
    const overview = await s.adminStatistics.overview("7d");
    const clicks = overview.cards.find((c) => c.key === "clicks")!;
    expect(clicks.trend!.buckets.map((b) => b.value)).toEqual([0, 12, 8, 5, 0, 0, 0]);
    expect(clicks.trend!.summary).toBe("Clicks to sellers peaked on Sunday, Nov 15, with 12.");
    const accounts = overview.cards.find((c) => c.key === "accounts")!;
    expect(accounts.trend!.summary).toBe("New accounts peaked on Sunday, Nov 15, with 2.");
    const waitlist = overview.cards.find((c) => c.key === "waitlist")!;
    expect(waitlist.trend!.summary).toBe("Waitlist signups peaked on Monday, Nov 16, with 9.");
  });

  it("names the modal usually-finds variety and omits the clause without a click or a live variety", async () => {
    const pop = await s.adminStatistics.popularity("7d", "searches", 10);
    if (pop.signal !== "searches") throw new Error("wrong signal");
    expect(pop.top[0]).toEqual({ term: "xqzj rose campion", count: 4, finds: { slug: Va.slug, name: Va.name } });
    expect(pop.top.find((r) => r.term === "xqzj blue flax")!.finds).toBeNull();
    expect(pop.top.find((r) => r.term === "xqzj ghost flower")!.finds).toBeNull();
    expect(pop.noResults).toEqual([
      { term: "xqzj nonsense", count: 3 },
      { term: "xqzj other nothing", count: 1 },
    ]);
    expect(pop.noResultsTotal).toBe(2);
  });
});

describe("waitlist ranking", () => {
  it("mirrors waitlistDemand's order and values over visible varieties", async () => {
    const pop = await s.adminStatistics.popularity("7d", "waitlist", 25);
    if (pop.signal !== "waitlist") throw new Error("wrong signal");
    expect(pop.error).toBe(false);
    expect(pop.total).toBe(11);
    expect(pop.shown).toBe(11);
    // The head is exact (one-waiter ties order by name, so R3 is found, not indexed).
    expect(pop.rows[0]).toMatchObject({ slug: R1.slug, waiters: 3, verified: 2 });
    expect(pop.rows[0]!.sellers).toBeGreaterThanOrEqual(2);
    expect(pop.rows[1]).toMatchObject({ slug: R2.slug, waiters: 2, verified: 1 });
    expect(pop.rows[1]!.sellers).toBeGreaterThanOrEqual(1);
    expect(pop.rows.find((r) => r.slug === R3.slug)).toMatchObject({ waiters: 1, verified: 0 });
    // The full order and values match the repository ranking exactly.
    const repo = await waitlistRepo.waitlistDemandVisible(t.db, 25);
    expect(pop.rows.map((r) => [r.rank, r.slug, r.name, r.crop, r.waiters, r.verified, r.sellers])).toEqual(
      repo.map((r, i) => [i + 1, r.slug, r.name, r.crop, Number(r.waiters), Number(r.verifiedWaiters ?? 0), r.sellerCount]),
    );
    // Independent spot check from raw SQL: R1's three waiters, two verified.
    expect((await raw("SELECT count(*) n FROM waitlist_entries WHERE variety_id = ? AND notified_at IS NULL", R1.id).first<{ n: number }>())!.n).toBe(3);
    expect((await raw("SELECT count(*) n FROM waitlist_entries w JOIN users u ON u.id = w.user_id WHERE w.variety_id = ? AND w.notified_at IS NULL AND u.email_verified = 1", R1.id).first<{ n: number }>())!.n).toBe(2);
  });

  it("is identical across ranges (range-independence asserted, not assumed)", async () => {
    const a = await s.adminStatistics.popularity("7d", "waitlist", 25);
    const b = await s.adminStatistics.popularity("30d", "waitlist", 25);
    const c = await s.adminStatistics.popularity("12w", "waitlist", 25);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    const narrow = await s.adminStatistics.popularity("7d", "waitlist", 10);
    if (narrow.signal !== "waitlist") throw new Error("wrong signal");
    expect(narrow.shown).toBe(10);
    expect(narrow.total).toBe(11);
  });
});

describe("removed varieties appear in no ranking", () => {
  it("excludes the removed variety everywhere despite its leading numbers", async () => {
    // 1000 views — the period's highest — yet rank 1 is the top visible variety.
    const views = await s.adminStatistics.popularity("7d", "views", 25);
    if (views.signal !== "views") throw new Error("wrong signal");
    expect(views.rows.map((r) => r.slug)).not.toContain(Vrem.slug);
    expect(views.rows[0]!.slug).toBe(V[0]!.slug);
    // Five waiters — the most — yet the head is R1, and the key API still serves it (untouched).
    const waitlist = await s.adminStatistics.popularity("7d", "waitlist", 25);
    if (waitlist.signal !== "waitlist") throw new Error("wrong signal");
    expect(waitlist.rows.map((r) => r.slug)).not.toContain(Vrem.slug);
    expect(waitlist.rows[0]!.slug).toBe(R1.slug);
    expect((await waitlistRepo.waitlistDemand(t.db, 25)).map((r) => r.slug)).toContain(Vrem.slug);
    // The removed variety's clicks resolve to nothing in the modal lookup either.
    expect(await waitlistRepo.waitlistDemandCount(t.db)).toBe(11);
  });
});

describe("snapshot and error degradation", () => {
  it("wires the home snapshot over the fixed 7-day window with the pinned hrefs", async () => {
    const snap = await s.adminStatistics.snapshot();
    expect(snap.cards.map((c) => c.key)).toEqual(["visitors", "accounts", "waitlist", "clicks"]);
    const visitors = snap.cards.find((c) => c.key === "visitors")!;
    const accounts = snap.cards.find((c) => c.key === "accounts")!;
    const waitlist = snap.cards.find((c) => c.key === "waitlist")!;
    const clicks = snap.cards.find((c) => c.key === "clicks")!;
    expect(visitors.total).toBeNull();
    expect(visitors.href).toBe("/admin/statistics");
    expect(visitors.noData).toContain("Not connected yet");
    expect(accounts).toMatchObject({ total: 8, href: "/admin/statistics", delta: { kind: "up", text: "▲ 100% up" } });
    expect(accounts.trend!.buckets).toHaveLength(7);
    expect(waitlist).toMatchObject({ total: 17, href: "/admin/statistics?signal=waitlist" });
    expect(clicks).toMatchObject({ total: 25, href: "/admin/statistics?signal=clicks", delta: null });
    expect(clicks.thinLine).toContain("Only 11 days of data");
  });

  it("degrades per signal to its error state instead of throwing", async () => {
    const broken = createAdminStatisticsService({} as unknown as Db, { now: () => new Date("2026-11-20T12:00:00.000Z") });
    const overview = await broken.overview("7d");
    expect(overview.cards.filter((c) => c.key !== "visitors").map((c) => c.error)).toEqual([true, true, true]);
    expect(overview.cards.find((c) => c.key === "visitors")!.error).toBe(false);
    for (const signal of ["views", "clicks", "waitlist", "searches"] as const) {
      expect((await broken.popularity("7d", signal, 10)).error).toBe(true);
    }
    const snap = await broken.snapshot();
    expect(snap.cards.filter((c) => c.key !== "visitors").every((c) => c.error)).toBe(true);
  });
});
