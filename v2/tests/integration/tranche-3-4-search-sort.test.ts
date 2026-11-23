/**
 * Tranche 3.4 §5.2–§5.3 — service-level proofs against the real seed catalog (real local
 * D1): the availability tier property on both sorted surfaces, the -recently_checked order,
 * the §5.3.2 autocomplete ranking probes, and suggestCorrection.
 *
 * Non-vacuity: fails on pre-build code — no availability sort exists (browseVarieties pins
 * "name"), the combined list orders groups-before-rank, and suggestCorrection is absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import type { BrowseFilterState } from "@/lib/browse";
import type { CropDetailFilterState } from "@/lib/crop-detail";
import { pageWindow } from "@/lib/paging";
import type { VarietyListItem } from "@/lib/validators";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
});
afterAll(async () => {
  await t?.dispose();
});

const svc = () => createServices(t.db).catalog;

const browseState = (sort: BrowseFilterState["sort"]): BrowseFilterState => ({
  season: null,
  method: null,
  lifeCycle: null,
  hue: [],
  smallFarm: false,
  sort,
});
const cropState = (sort: CropDetailFilterState["sort"]): CropDetailFilterState => ({
  hue: [],
  series: null,
  hasSellers: null,
  sort,
});

/** Availability tier (§5.2.2): in-stock listings, then any listings, then none. */
function tierOf(v: Pick<VarietyListItem, "inStockCount" | "listingCount">): number {
  return v.inStockCount > 0 ? 0 : v.listingCount > 0 ? 1 : 2;
}

/**
 * The tier property over a whole ordered set: tiers never decrease; within a tier,
 * listing counts never increase; count ties break by name ascending (slug last).
 */
function expectTierOrder(items: VarietyListItem[]): void {
  const lower = (v: VarietyListItem): string => v.varietyName.toLowerCase();
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1]!;
    const b = items[i]!;
    expect(tierOf(b), `tier decreases at ${b.slug} (after ${a.slug})`).toBeGreaterThanOrEqual(tierOf(a));
    if (tierOf(a) !== tierOf(b)) continue;
    expect(b.listingCount, `listing count rises within tier at ${b.slug}`).toBeLessThanOrEqual(a.listingCount);
    if (a.listingCount !== b.listingCount) continue;
    expect(
      lower(a) < lower(b) || (lower(a) === lower(b) && a.slug <= b.slug),
      `name order breaks within tier: ${a.slug} before ${b.slug}`,
    ).toBe(true);
  }
}

describe("availability sort (§5.2.2): the tier property on both surfaces", () => {
  it("/variety: page 1 holds every higher-tier variety; the whole set is tier-ordered", async () => {
    const filters = browseState("availability");
    const full = await svc().browseVarieties({ filters, page: pageWindow(1, 1000) });
    expect(full.total).toBeGreaterThan(24);
    expectTierOrder(full.items);
    // Page 1 contains no lower-tier variety while a higher-tier variety exists in the set:
    // every tier-0 and tier-1 slug of the whole set is on page 1.
    const page1 = await svc().browseVarieties({ filters, page: pageWindow(1) });
    const onPage1 = new Set(page1.items.map((v) => v.slug));
    for (const v of full.items) {
      if (tierOf(v) < 2) expect(onPage1.has(v.slug), `${v.slug} (tier ${tierOf(v)}) missing from page 1`).toBe(true);
    }
    expect(page1.items.filter((v) => tierOf(v) === 0)).toHaveLength(full.items.filter((v) => tierOf(v) === 0).length);
    expect(page1.items.filter((v) => tierOf(v) === 1)).toHaveLength(full.items.filter((v) => tierOf(v) === 1).length);
    // The set genuinely spans all three tiers (the property is not vacuous).
    expect(new Set(full.items.map(tierOf))).toEqual(new Set([0, 1, 2]));
  });

  it("crop detail (sweet-pea): page 1 holds every higher-tier variety; the set is tier-ordered", async () => {
    const state = cropState("availability");
    const full = (await svc().browseCrop("sweet-pea", { state, page: pageWindow(1, 1000) }))!;
    expectTierOrder(full.crop.varieties);
    const page1 = (await svc().browseCrop("sweet-pea", { state, page: pageWindow(1) }))!;
    const onPage1 = new Set(page1.crop.varieties.map((v) => v.slug));
    for (const v of full.crop.varieties) {
      if (tierOf(v) < 2) expect(onPage1.has(v.slug), `${v.slug} (tier ${tierOf(v)}) missing from page 1`).toBe(true);
    }
    expect(new Set(full.crop.varieties.map(tierOf))).toEqual(new Set([0, 1, 2]));
  });

  it("?sort=name orders A–Z; ?sort=recent orders by last check, nulls last", async () => {
    const byName = await svc().browseVarieties({ filters: browseState("name"), page: pageWindow(1, 1000) });
    const names = byName.items.map((v) => v.varietyName.toLowerCase());
    expect([...names].sort()).toEqual(names);
    const byRecent = await svc().browseVarieties({ filters: browseState("recent"), page: pageWindow(1, 1000) });
    const checked = byRecent.items.map((v) => v.lastCheckedAt);
    const firstNull = checked.findIndex((d) => d === null);
    expect(firstNull).toBeGreaterThan(-1);
    expect(checked.slice(firstNull).every((d) => d === null)).toBe(true);
    const dated = checked.slice(0, firstNull) as string[];
    expect([...dated].sort().reverse()).toEqual(dated);
  });
});

describe("autocomplete ranking (§5.3.2): match class first, type second", () => {
  it("ali → Alison above Calendula, California Poppy, Chinese Lantern, False Indigo", async () => {
    // limit 50: the class-3 varieties precede the class-3 crops per the within-class rule,
    // so the comparison needs a window holding all five.
    const r = await svc().search("ali", { limit: 50 });
    const at = (href: string): number => r.results.findIndex((x) => x.href === href);
    const alison = at("/variety/sweet-pea-alison");
    expect(alison).toBeGreaterThanOrEqual(0);
    for (const crop of ["calendula", "california-poppy", "chinese-lantern", "false-indigo"]) {
      const c = at(`/crop/${crop}`);
      expect(c, `${crop} missing from the combined list`).toBeGreaterThanOrEqual(0);
      expect(alison, `Alison not above ${crop}`).toBeLessThan(c);
    }
  });

  it("Alison → Alison first, then Alison Valentini", async () => {
    const r = await svc().search("Alison", { limit: 10 });
    expect(r.results[0]?.href).toBe("/variety/sweet-pea-alison");
    expect(r.results[1]?.href).toBe("/variety/sweet-pea-alison-valentini");
  });

  it("sweet pea → the Sweet Pea crop first", async () => {
    const r = await svc().search("sweet pea", { limit: 10 });
    expect(r.results[0]?.href).toBe("/crop/sweet-pea");
  });

  it("mother of pearl → exactly the one exact variety", async () => {
    const r = await svc().search("mother of pearl", { limit: 10 });
    expect(r.results[0]?.href).toBe("/variety/shirley-poppy-mother-of-pearl");
    expect(r.results).toHaveLength(1);
  });

  it("the grouped layout does not change (groups keep their shipped content)", async () => {
    const r = await svc().search("ali", { limit: 10 });
    expect(r.crops.map((c) => c.href).sort()).toEqual(
      ["/crop/calendula", "/crop/california-poppy", "/crop/chinese-lantern", "/crop/false-indigo"].sort(),
    );
    expect(r.varieties.map((v) => v.href)).toContain("/variety/sweet-pea-alison");
  });
});

describe("suggestCorrection (§5.3.4, service level)", () => {
  it("alsion → Alison (linking that search); zzqqx → no suggestion", async () => {
    expect(await svc().suggestCorrection("alsion")).toEqual({ name: "Alison", href: "/search?q=Alison" });
    expect(await svc().suggestCorrection("zzqqx")).toBe(null);
    expect(await svc().suggestCorrection("")).toBe(null);
    // An exact name is not a correction.
    expect(await svc().suggestCorrection("Alison")).toBe(null);
  });
});
