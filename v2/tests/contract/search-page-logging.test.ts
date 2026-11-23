/**
 * N1 pin (PR #51 gate) — /search page-view search_events logging.
 *
 * The 3.1b-1 completion rewired /search onto catalog.browseSearch, which never logs,
 * dropping the page-view row the pre-completion page wrote via
 * catalog.search(q, { logClient: "web/search-page" }). The repair restores it: the page
 * passes logClient "web/search-page" to browseSearch, writing exactly one row per
 * server render with the same shape (query_normalized, result_count, client; the
 * clicked variety stays null). In-place refinements through GET /api/browse/search
 * never set logClient, so they stay silent.
 *
 * Non-vacuity: fails on pre-repair code — the page render writes zero rows there.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));
// The search widget needs router context; the page-view log fires while the server
// component runs, before any client JSX is built.
vi.mock("@/components/search/SearchBox", () => ({ SearchBox: () => null }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as searchRoute from "@/app/api/browse/search/route";
import { readBrowseFiltersForGroups } from "@/lib/browse";

const { default: SearchPage } = await import("@/app/search/page");

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: "x", clickSalt: "x" };
});
afterAll(async () => {
  await t?.dispose();
});

/** The search_events columns the page-view log writes (the pre-completion shape). */
interface SearchEventRow {
  query_normalized: string;
  result_count: number;
  clicked_variety_id: number | null;
  client: string;
}

async function eventCount(): Promise<number> {
  return (await t.env.DB.prepare("SELECT count(*) n FROM search_events").first<{ n: number }>())!.n;
}

async function latestRow(): Promise<SearchEventRow | null> {
  return t.env.DB.prepare(
    "SELECT query_normalized, result_count, clicked_variety_id, client FROM search_events ORDER BY id DESC LIMIT 1",
  ).first<SearchEventRow>();
}

describe("/search page-view logging (N1 pin)", () => {
  it("one /search render writes exactly one web/search-page row with the rendered total", async () => {
    const before = await eventCount();
    // The expected total comes from the same service call the page renders with —
    // without logClient, so the probe itself stays silent (asserted below).
    const expected = await createServices(t.db).catalog.browseSearch("zinnia", {
      filters: readBrowseFiltersForGroups({}, ["season", "method", "lifeCycle", "hue"], "single"),
    });
    expect(expected.total).toBeGreaterThan(0);
    expect(await eventCount()).toBe(before);

    await SearchPage({ searchParams: Promise.resolve({ q: "zinnia" }) });

    expect(await eventCount()).toBe(before + 1);
    expect(await latestRow()).toEqual({
      query_normalized: "zinnia",
      result_count: expected.total,
      clicked_variety_id: null,
      client: "web/search-page",
    });
  });

  it("a browse refinement (GET /api/browse/search) writes no row", async () => {
    const before = await eventCount();
    const res = await searchRoute.GET(
      new Request("https://seeds.hues.flowers/api/browse/search?q=zinnia&life_cycle=perennial"),
    );
    expect(res.status).toBe(200);
    expect(await eventCount()).toBe(before);
  });
});
