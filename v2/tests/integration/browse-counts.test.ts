/**
 * Tranche 3.1a — the browse payload against the real seed catalog (D1): browseVarieties'
 * items/total are identical to listVarieties for the same filters, and every per-option
 * count reconciles against a fresh independent total — across single-select options, every
 * "All", and multi-select hue toggles in both directions, including a 0-count option found
 * at test time. The payload carries no price key anywhere (T-C) and its top-level fields
 * are exactly the enumerated contract.
 *
 * Non-vacuity: fails on pre-build code — catalog.browseVarieties and countVarietyRows do
 * not exist there (and Hue filters take one family, so the toggle states are untestable).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { countVarietyRows } from "@/lib/repositories/catalog-read";
import {
  COLOR_FAMILIES,
  browseCountQueries,
  clearAllFilters,
  varietyFiltersFromBrowse,
  type BrowseFilterState,
} from "@/lib/browse";
import { pageWindow, totalPages } from "@/lib/paging";
import { PAGE_SIZE } from "@/lib/config";
import { BrowseVarietiesPayloadSchema } from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
});
afterAll(async () => {
  await t?.dispose();
});

const svc = () => createServices(t.db).catalog;
const state = (over: Partial<BrowseFilterState> = {}): BrowseFilterState => ({ ...clearAllFilters(), ...over });

/** The count matrix's totals re-derived by independent fresh queries (never the payload's). */
async function freshTotals(s: BrowseFilterState): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const q of browseCountQueries(s)) {
    out.set(`${q.group}:${q.option ?? "all"}`, await countVarietyRows(t.db, q.filters));
  }
  return out;
}

describe("browseVarieties items/total (identical to listVarieties)", () => {
  const STATES: { label: string; state: BrowseFilterState }[] = [
    { label: "unfiltered", state: state() },
    { label: "season", state: state({ season: "cool" }) },
    { label: "method + life cycle", state: state({ method: "direct", lifeCycle: "annual" }) },
    { label: "one hue", state: state({ hue: ["pink"] }) },
    { label: "two hues", state: state({ hue: ["pink", "peach"] }) },
    { label: "hues + small farms", state: state({ hue: ["pink", "peach"], smallFarm: true }) },
  ];

  for (const { label, state: s } of STATES) {
    it(`${label}: same items and total as listVarieties, page echo and pages derived`, async () => {
      const vf = varietyFiltersFromBrowse(s);
      const [a, b] = await Promise.all([
        svc().browseVarieties({ filters: s, page: pageWindow(1) }),
        svc().listVarieties({ filters: vf, page: pageWindow(1) }),
      ]);
      expect(a.total).toBe(b.total);
      expect(a.items).toEqual(b.items);
      expect(a.page).toBe(1);
      expect(a.pages).toBe(totalPages(b.total));
      expect(BrowseVarietiesPayloadSchema.safeParse(a).success).toBe(true);
    });
  }

  it("page 2 echoes page 2 with the next window (the endpoint honors ?page=)", async () => {
    const a = await svc().browseVarieties({ filters: state(), page: pageWindow(2) });
    const b = await svc().listVarieties({ page: pageWindow(2) });
    expect(a.page).toBe(2);
    expect(a.items).toEqual(b.items);
    expect(a.total).toBe(b.total);
  });
});

describe("counts reconcile against fresh server totals", () => {
  it("every option and every All reconciles on a multi-hue state (≥6 options checked)", async () => {
    const s = state({ season: "warm", hue: ["pink", "peach"] });
    const payload = await svc().browseVarieties({ filters: s, page: pageWindow(1) });
    const fresh = await freshTotals(s);
    expect(fresh.size).toBeGreaterThanOrEqual(6);
    const read = (group: string, option: string | null): number => {
      const c = payload.counts[group as keyof typeof payload.counts] as { all: number; options?: Record<string, number>; on?: number };
      return option === null ? c.all : (group === "smallFarm" ? c.on : c.options?.[option]) as number;
    };
    for (const [key, total] of fresh) {
      const [group, option] = key.split(":") as [string, string];
      expect(read(group, option === "all" ? null : option), key).toBe(total);
    }
    // The active single-select options' counts are the result total itself.
    expect(payload.counts.season.options.warm).toBe(payload.total);
  });

  it("hue toggle semantics hold in both directions (selected OUT, unselected IN)", async () => {
    const s = state({ hue: ["pink", "peach"] });
    const payload = await svc().browseVarieties({ filters: s, page: pageWindow(1) });
    // Selected families count the set without them (at most the current total).
    expect(payload.counts.hue.options.pink).toBe(await countVarietyRows(t.db, { colorFamily: ["peach"] }));
    expect(payload.counts.hue.options.peach).toBe(await countVarietyRows(t.db, { colorFamily: ["pink"] }));
    expect(payload.counts.hue.options.pink).toBeLessThanOrEqual(payload.total);
    // Unselected families count the set with them added (at least the current total).
    const yellow = await countVarietyRows(t.db, { colorFamily: ["pink", "peach", "yellow"] });
    expect(payload.counts.hue.options.yellow).toBe(yellow);
    expect(yellow).toBeGreaterThanOrEqual(payload.total);
    // Hue All is the total under the other groups alone (here: everything).
    const everything = await countVarietyRows(t.db, {});
    expect(payload.counts.hue.all).toBe(everything);
  });

  it("a 0-count option renders its 0 (found at test time, never hardcoded)", async () => {
    // Narrow until some option counts 0: walk single-filter states plus small farms, then
    // pairs — the seed catalog always strands an option somewhere in this derived list.
    const singles: BrowseFilterState[] = [
      state({ season: "cool" }),
      state({ season: "warm" }),
      state({ method: "direct" }),
      state({ method: "trays" }),
      state({ lifeCycle: "annual" }),
      state({ lifeCycle: "biennial" }),
      state({ lifeCycle: "perennial" }),
      state({ hue: ["chocolate"] }),
      state({ hue: ["blue"] }),
      state({ smallFarm: true }),
    ];
    let found: { state: BrowseFilterState; key: string } | null = null;
    const candidates = [...singles];
    for (const a of singles) for (const b of singles) candidates.push({ ...a, hue: [...a.hue, ...b.hue], smallFarm: a.smallFarm || b.smallFarm, season: a.season ?? b.season, method: a.method ?? b.method, lifeCycle: a.lifeCycle ?? b.lifeCycle });
    for (const s of candidates) {
      const fresh = await freshTotals(s);
      for (const [key, total] of fresh) {
        if (total === 0) {
          found = { state: s, key };
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error("seed catalog strands no option at 0 in any derived state (reconcile premise broken)");
    const payload = await svc().browseVarieties({ filters: found.state, page: pageWindow(1) });
    const [group, option] = found.key.split(":") as [string, string];
    const c = payload.counts[group as keyof typeof payload.counts] as { all: number; options?: Record<string, number>; on?: number };
    const count = option === "all" ? c.all : group === "smallFarm" ? c.on : c.options?.[option];
    expect(count, `${found.key} under ${JSON.stringify(found.state)}`).toBe(0);
    // And it reconciles: the fresh query agrees it is 0.
    expect((await freshTotals(found.state)).get(found.key)).toBe(0);
  });

  it("rapid two-group change ends consistent (last state fully reconciles)", async () => {
    // Tap season, then — before settling — tap a hue: the committed state is both, and its
    // payload reconciles wholesale.
    const s = state({ season: "cool", hue: ["yellow"] });
    const payload = await svc().browseVarieties({ filters: s, page: pageWindow(1) });
    const fresh = await freshTotals(s);
    expect(payload.total).toBe(await countVarietyRows(t.db, varietyFiltersFromBrowse(s)));
    for (const [key, total] of fresh) {
      const [group, option] = key.split(":") as [string, string];
      const c = payload.counts[group as keyof typeof payload.counts] as { all: number; options?: Record<string, number>; on?: number };
      expect(option === "all" ? c.all : group === "smallFarm" ? c.on : c.options?.[option], key).toBe(total);
    }
  });
});

describe("payload contract (T-C: no price anywhere; fields enumerated)", () => {
  it("top-level fields are exactly items/total/page/pages/counts", async () => {
    const payload = await svc().browseVarieties({ filters: state(), page: pageWindow(1) });
    expect(Object.keys(payload).sort()).toEqual(["counts", "items", "page", "pages", "total"]);
    expect(Object.keys(payload.counts).sort()).toEqual(["hue", "lifeCycle", "method", "season", "smallFarm"]);
  });

  it("no price key appears anywhere in the serialized payload", async () => {
    const payload = await svc().browseVarieties({ filters: state({ hue: ["pink"] }), page: { offset: 0, limit: PAGE_SIZE } });
    const json = JSON.stringify(payload);
    expect(json).not.toMatch(/"[^"]*price[^"]*"\s*:/i);
    expect(json).not.toMatch(/[$€£]\s*\d/);
  });

  it("colorFamily filter takes the full set (OR within hue)", async () => {
    const one = await countVarietyRows(t.db, { colorFamily: ["pink"] });
    const two = await countVarietyRows(t.db, { colorFamily: ["pink", "peach"] });
    const families = new Set(COLOR_FAMILIES);
    expect(families.has("pink") && families.has("peach")).toBe(true);
    expect(two).toBeGreaterThanOrEqual(one);
  });
});
