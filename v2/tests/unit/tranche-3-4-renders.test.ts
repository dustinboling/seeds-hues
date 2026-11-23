/**
 * Tranche 3.4 — server-rendered surfaces (no-JS floors): the home cap lifts under a filter,
 * ?sort= server-renders in the service's order with the sort links floor on both surfaces,
 * and the sibling rail queries the availability order.
 *
 * Non-vacuity: fails on pre-build code — no home cap exists to lift, no sort links render
 * on either surface, and listVarieties is called without a sort.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  counts: { varieties: 0, sellers: 0, listings: 0, plants: 0 },
  crops: { items: [] as unknown[], total: 0 },
  coverage: [] as unknown[],
  recent: [] as unknown[],
  variety: null as unknown,
  varieties: { items: [] as unknown[], total: 0 },
  varietyFilters: null as unknown,
  crop: null as unknown,
  cropState: null as unknown,
  siblings: { items: [] as unknown[], total: 0 },
  siblingOpts: null as unknown,
}));
const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
// The search widget needs router context; the grids, rails and count lines do not.
vi.mock("@/components/search/SearchBox", () => ({ SearchBox: () => null }));

import { fakeServices } from "../helpers/services-context";
import type {
  BrowseCounts,
  CropDetail,
  CropDetailCounts,
  CropListItem,
  VarietyDetail,
  VarietyListItem,
} from "@/lib/validators";

const { default: HomePage } = await import("@/app/page");
const { default: VarietiesPage } = await import("@/app/variety/page");
const { default: CropPage } = await import("@/app/crop/[slug]/page");
const { default: SearchPage } = await import("@/app/search/page");
const { VarietyView } = await import("@/app/variety/[slug]/variety-view");

store.services = fakeServices({
  catalog: {
    counts: async () => fake.counts,
    browseCrops: async () => ({ ...fake.crops, page: 1, pages: 1, counts: zeroBrowseCounts() }),
    coverage: async () => fake.coverage,
    recent: async () => fake.recent,
    browseVarieties: async (opts: { filters: unknown }) => {
      fake.varietyFilters = opts.filters;
      return { ...fake.varieties, page: 1, pages: 1, counts: zeroBrowseCounts() };
    },
    browseCrop: async (_slug: string, opts: { state: unknown }) => {
      fake.cropState = opts.state;
      return fake.crop === null ? null : { ...(fake.crop as object), page: 1, pages: 1, counts: zeroCropDetailCounts() };
    },
    getVariety: async () => fake.variety,
    listVarieties: async (opts: unknown) => {
      fake.siblingOpts = opts;
      return fake.siblings;
    },
    browseSearch: async () => ({ crops: [], series: [], varieties: [], sellers: [], total: 0, page: 1, pages: 1, counts: zeroBrowseCounts() }),
    suggestCorrection: async () => ({ name: "Alison", href: "/search?q=Alison" }),
  },
});

beforeEach(() => {
  fake.counts = { varieties: 0, sellers: 0, listings: 0, plants: 0 };
  fake.crops = { items: [], total: 0 };
  fake.coverage = [];
  fake.recent = [];
  fake.variety = null;
  fake.varieties = { items: [], total: 0 };
  fake.varietyFilters = null;
  fake.crop = null;
  fake.cropState = null;
  fake.siblings = { items: [], total: 0 };
  fake.siblingOpts = null;
});

function zeroBrowseCounts(): BrowseCounts {
  const z = { all: 0, options: {} };
  return {
    season: { all: 0, options: { cool: 0, warm: 0 } },
    method: { all: 0, options: { direct: 0, trays: 0 } },
    lifeCycle: { all: 0, options: { annual: 0, biennial: 0, perennial: 0 } },
    hue: {
      ...z,
      options: {
        white: 0, blush: 0, pink: 0, peach: 0, orange: 0, yellow: 0, red: 0,
        burgundy: 0, purple: 0, blue: 0, green: 0, chocolate: 0, mix: 0,
      },
    },
    smallFarm: { all: 0, on: 0 },
  };
}

function zeroCropDetailCounts(): CropDetailCounts {
  return { sellers: { all: 0, has: 0, none: 0 }, hue: { all: 0, options: {} }, series: { all: 0, options: {} } };
}

const plant = {
  slug: "stock",
  commonName: "Stock",
  latinName: "Matthiola incana",
  season_class: null,
  season_source_label: null,
  sowing_methods: [],
  sowing_method_source_label: null,
} as const;

function cropItem(i: number, withSellers: number): CropListItem {
  return {
    ...plant,
    slug: `crop-${String(i).padStart(2, "0")}`,
    commonName: `Crop ${String(i).padStart(2, "0")}`,
    sowing_methods: [],
    category: { slug: "flowers", name: "Flowers" },
    varietyCount: 4,
    varietiesWithSellers: withSellers,
    lastUpdated: "2026-11-20",
    media: [],
  };
}

function varietyItem(slug: string, name: string): VarietyListItem {
  return {
    slug,
    varietyName: name,
    plant: { ...plant, sowing_methods: [] },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 1,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: "2026-11-15",
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    media: [],
  };
}

describe("home cap (§5.1): the cap lifts under an active filter", () => {
  // 15 crops, deliberately unshuffled in payload order: sellers counts 14..0 so the resting
  // order must re-sort (sellers desc) and the cap must cut the three with the fewest.
  const items = Array.from({ length: 15 }, (_, k) => cropItem(k, 14 - k));

  it("at rest the grid shows 12 in the resting order with the see-all line", async () => {
    fake.crops = { items, total: 15 };
    const h = renderToStaticMarkup((await HomePage({ searchParams: Promise.resolve({}) })) as ReactElement);
    const grid = [...h.matchAll(/href="\/crop\/([a-z0-9-]+)"/g)].map((m) => m[1]!);
    expect(grid).toHaveLength(12);
    expect(grid[0]).toBe("crop-00"); // 14 varieties with sellers: first
    expect(grid).not.toContain("crop-12");
    expect(grid).not.toContain("crop-13");
    expect(grid).not.toContain("crop-14");
    expect(h).toContain("Showing 12 of 15 crops");
    expect(h).toMatch(/<a[^>]*href="\/crop"[^>]*>see all crops<\/a>/);
  });

  it("under an active home filter every match shows and the count line states the total", async () => {
    fake.crops = { items, total: 15 };
    const h = renderToStaticMarkup((await HomePage({ searchParams: Promise.resolve({ season: "cool" }) })) as ReactElement);
    const grid = [...h.matchAll(/href="\/crop\/([a-z0-9-]+)"/g)].map((m) => m[1]!);
    expect(grid).toHaveLength(15);
    expect(h).toContain("15 crops · Cool Season Hardy Annuals");
    expect(h).not.toContain("see all crops");
  });
});

describe("sort no-JS floor (§5.2): ?sort= server-renders with working sort links", () => {
  it("?sort=name on /variety renders A–Z with the sort links floor and the resting phrase", async () => {
    const items = [varietyItem("a", "Alison"), varietyItem("m", "Mother of Pearl"), varietyItem("z", "Zinnia")];
    fake.varieties = { items, total: 3 };
    const h = renderToStaticMarkup((await VarietiesPage({ searchParams: Promise.resolve({ sort: "name" }) })) as ReactElement);
    expect(fake.varietyFilters).toMatchObject({ sort: "name" });
    const links = [...h.matchAll(/href="\/variety\/([a-z])"/g)].map((m) => m[1]!);
    expect(links).toEqual(["a", "m", "z"]);
    expect(h).toContain("3 varieties, alphabetical.");
    expect(h).toContain('href="/variety?sort=availability"');
    expect(h).toContain('href="/variety?sort=recent"');
    // The resting Name A–Z chip is current and links the bare list (absent ?sort= is name).
    expect(h).toMatch(/aria-current="true"[^>]*data-sort="name"/);
    expect(h).toMatch(/<a[^>]*data-sort="name"[^>]*href="\/variety"/);
  });

  it("?sort=availability on /variety renders the service's order with the true phrase", async () => {
    const items = [varietyItem("z", "Zinnia"), varietyItem("a", "Alison")];
    fake.varieties = { items, total: 2 };
    const h = renderToStaticMarkup(
      (await VarietiesPage({ searchParams: Promise.resolve({ sort: "availability" }) })) as ReactElement,
    );
    expect(fake.varietyFilters).toMatchObject({ sort: "availability" });
    const links = [...h.matchAll(/href="\/variety\/([a-z])"/g)].map((m) => m[1]!);
    expect(links).toEqual(["z", "a"]);
    expect(h).toContain("2 varieties, most sellers first.");
    expect(h).not.toContain("alphabetical.");
  });

  it("?sort=recent on a crop page renders the links floor with the true phrase", async () => {
    const crop: CropDetail = {
      ...plant,
      sowing_methods: [],
      category: { slug: "flowers", name: "Flowers" },
      varietyCount: 2,
      varietiesWithSellers: 1,
      lastUpdated: "2026-11-20",
      media: [],
      description: null,
      sowingNotes: null,
      life_cycle: null,
      hardiness: null,
      grower_guide: null,
      series: [],
      varieties: [varietyItem("a", "Alison"), varietyItem("m", "Mother of Pearl")],
    };
    fake.crop = { crop, total: 2, colorFamilies: [] };
    const h = renderToStaticMarkup(
      (await CropPage({ params: Promise.resolve({ slug: "stock" }), searchParams: Promise.resolve({ sort: "recent" }) })) as ReactElement,
    );
    expect(fake.cropState).toMatchObject({ sort: "recent" });
    expect(h).toContain("2 varieties, most recently checked first.");
    expect(h).toContain('href="/crop/stock?sort=availability"');
    // The resting Name A–Z chip links the bare crop page (absent ?sort= is name).
    expect(h).toMatch(/<a[^>]*data-sort="name"[^>]*href="\/crop\/stock"/);
    expect(h).toMatch(/aria-current="true"[^>]*data-sort="recent"/);
    expect(h).not.toContain("alphabetical.");
  });
});

describe('sibling rail (§5.2.6): the "More varieties" six come from the availability order', () => {
  it("queries listVarieties with the availability sort and renders six minus self", async () => {
    const v: VarietyDetail = {
      slug: "stock-katz-mix",
      varietyName: "Katz Mix",
      plant: { ...plant, sowing_methods: [], description: null, sowingNotes: null },
      category: { slug: "flowers", name: "Flowers" },
      subcategory: null,
      series: null,
      colorSwatch: null,
      colorFamily: "mix",
      listingCount: 0,
      sellerCount: 0,
      inStockCount: 0,
      lastCheckedAt: null,
      indexable: true,
      rating: { state: "not_yet_rated", average: null, review_count: 0 },
      description: null,
      templateDescription: "Katz Mix is a Stock variety.",
      answer: "No seller lists Katz Mix yet.",
      sowingNotes: null,
      heightCm: null,
      facts: { color_family: "mix", pollination: "unknown", height_cm: { min: null, max: null }, days_to_bloom: { min: null, max: null } },
      tags: [],
      aliases: [],
      protection: "unknown",
      protectionNote: null,
      contentLevel: "thin",
      updatedAt: "2026-11-16",
      listings: [],
      media: [],
    };
    fake.variety = v;
    fake.siblings = {
      items: [varietyItem("stock-katz-mix", "Katz Mix"), ...[1, 2, 3, 4, 5, 6].map((i) => varietyItem(`sib-${i}`, `Sibling ${i}`))],
      total: 7,
    };
    const h = renderToStaticMarkup((await VarietyView({ slug: "stock-katz-mix", smallFarmOnly: false })) as ReactElement);
    expect(fake.siblingOpts).toMatchObject({ sort: "availability" });
    expect(h).toContain("More stock varieties");
    for (const i of [1, 2, 3, 4, 5, 6]) expect(h).toContain(`/variety/sib-${i}`);
  });
});

describe("did-you-mean (§5.3.4): the zero-results state offers the near match as a link", () => {
  it('renders "Did you mean Alison?" linking that search', async () => {
    const h = renderToStaticMarkup((await SearchPage({ searchParams: Promise.resolve({ q: "alsion" }) })) as ReactElement);
    expect(h).toContain("Nothing matches");
    expect(h).toMatch(/Did you mean\s*<a[^>]*href="\/search\?q=Alison"[^>]*>\s*<strong>Alison<\/strong>\s*<\/a>\s*\?/);
  });
});
