/**
 * Pagination bounds: out-of-range pages answer a TRUE 404 (tranche 3.5).
 *
 * The defect: /variety?page=99 answered 200 with a loading skeleton shell while the
 * sibling paginated routes (/seller, /crop/[slug], /seller/[slug], /state/[slug]) already
 * answered 404. The guard (assertPageInRange → notFound()) was always in the page — the
 * segment's loading.tsx streamed a 200 shell before the guard could resolve, the same
 * mechanism PR #11 fixed on the other routes by demoting their skeletons to inner
 * Suspense fallbacks. /variety was the last route still carrying it.
 *
 * What this suite proves, and how. A test that calls the page and expects the 404 digest
 * cannot fail on the old code — the guard was always there — so the status tests below go
 * through the streamed-response model instead: the route's first flush is the REAL segment
 * shell (the loading.tsx module, resolved the way Next's file-convention router resolves
 * it: present → Suspense boundary flushing 200 before the page resolves; absent → nothing
 * can stream before the page resolves), followed by the REAL page (real data path through
 * the catalog interface, real bounds guard). HTTP streaming semantics close the loop: a
 * 404 can only be served when it resolves before the first byte. On the old code the shell
 * bytes precede the guard's 404, so the status tests FAIL there and PASS with the fix;
 * scripts/acceptance.ts re-proves the same matrix over real HTTP against a local preview.
 *
 * Totals are small fakes; every page number is DERIVED from them via totalPages() — no
 * catalog counts are hardcoded.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE } from "@/lib/config";
import { totalPages } from "@/lib/paging";
import { METHOD_PARAMS, SEASON_PARAMS } from "@/lib/validators";
import type {
  CropDetail,
  PublicListing,
  SellerDetail,
  SellerListItem,
  SellerState,
  VarietyListItem,
} from "@/lib/validators";

/** What next/navigation's notFound() throws (its message and digest). */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

const fake = vi.hoisted(() => ({
  varieties: { items: [] as unknown[], total: 0 },
  varietiesArgs: null as unknown,
  sellers: { items: [] as unknown[], total: 0 },
  seller: null as unknown,
  crop: null as unknown,
  states: [] as unknown[],
}));
const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));

import { fakeServices } from "../helpers/services-context";
import { fakeSellerDetail } from "../helpers/seller-detail";

// Imported after the mock is registered (vi.mock is hoisted above these too).
const { default: VarietiesPage } = await import("@/app/variety/page");
const { default: SellersPage } = await import("@/app/seller/page");
const { default: CropPage } = await import("@/app/crop/[slug]/page");
const { default: SellerPage } = await import("@/app/seller/[slug]/page");
const { default: StatePage } = await import("@/app/state/[slug]/page");

// The segment shell, resolved the way Next resolves it: the loading.tsx module when the
// segment carries one, nothing when it does not. Guarded by existsSync so this file runs
// both before the fix (shell present → status tests fail) and after (shell gone → pass;
// the ts-expect-error marks the pre-fix module, absent on this branch by design).
const VARIETY_SEGMENT = join(process.cwd(), "app/variety");
const { default: VarietyLoading }: { default: ComponentType | null } = existsSync(join(VARIETY_SEGMENT, "loading.tsx"))
  ? // @ts-expect-error — pre-fix module (see above); never executed on this branch.
    await import("@/app/variety/loading")
  : { default: null };
const { VarietiesSkeleton } = existsSync(join(VARIETY_SEGMENT, "skeleton.tsx"))
  ? await import("@/app/variety/skeleton")
  : { VarietiesSkeleton: null };

store.services = fakeServices({
  catalog: {
    listVarieties: async (args: unknown) => {
      fake.varietiesArgs = args;
      return fake.varieties;
    },
    listSellers: async () => fake.sellers,
    getSeller: async () => fake.seller,
    getCrop: async () => fake.crop,
    listSellerStates: async () => fake.states,
  },
});

beforeEach(() => {
  fake.varieties = { items: [], total: 0 };
  fake.varietiesArgs = null;
  fake.sellers = { items: [], total: 0 };
  fake.seller = null;
  fake.crop = null;
  fake.states = [];
});

const RATING = { state: "not_yet_rated", average: null, review_count: 0 } as const;

function varietyItem(i: number): VarietyListItem {
  return {
    slug: `test-variety-${i}`,
    varietyName: `Test Variety ${i}`,
    plant: {
      slug: "test-crop",
      commonName: "Test Crop",
      latinName: null,
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
    },
    category: { slug: "test-category", name: "Test category" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 1,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: null,
    indexable: true,
    rating: { ...RATING },
    media: [],
  };
}

function sellerItem(i: number): SellerListItem {
  return {
    slug: `test-seller-${i}`,
    name: `Test Seller ${i}`,
    type: "specialty",
    location: "Junction City, OR",
    region: "OR",
    country: "US",
    homepage: `https://test-seller-${i}.example/`,
    ratingCount: 0,
    ratingAverage: null,
    rating: { ...RATING },
    importedRating: null,
    isSmallFarm: false,
    varietyCount: i,
  };
}

function listingItem(id: number): PublicListing {
  return {
    id,
    variety: {
      slug: `test-variety-${id}`,
      varietyName: `Test Variety ${id}`,
      plant: {
        slug: "test-crop",
        commonName: "Test Crop",
        latinName: null,
        season_class: null,
        season_source_label: null,
        sowing_methods: [],
        sowing_method_source_label: null,
      },
      colorSwatch: null,
      media: [],
      cropMedia: [],
    },
    seller: {
      slug: "hollyhock-test-farm",
      name: "Hollyhock Test Farm",
      location: "Junction City, OR",
      region: "OR",
      country: "US",
      isSmallFarm: false,
    },
    availability: "in_stock",
    lastCheckedAt: null,
    firstSeenAt: null,
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: [],
    provenance: { source_url: null, retrieved_at: null, method: "human", confidence: 1 },
    sourceLabel: null,
  };
}

const CROP: CropDetail = {
  slug: "test-crop",
  commonName: "Test Crop",
  latinName: null,
  season_class: null,
  season_source_label: null,
  sowing_methods: [],
  sowing_method_source_label: null,
  category: { slug: "test-category", name: "Test category" },
  varietyCount: 0,
  varietiesWithSellers: 0,
  lastUpdated: null,
  media: [],
  description: null,
  sowingNotes: null,
  life_cycle: null,
  hardiness: null,
  grower_guide: null,
  series: [],
  varieties: [],
};

const OREGON: SellerState = { code: "OR", name: "Oregon", slug: "oregon", sellerCount: 1 };

type Search = Record<string, string | string[] | undefined>;
const sp = (params: Search) => Promise.resolve(params);

/** An absurd page: far past the end, always well-formed (parsePage allows up to 6 digits). */
const absurdPage = (last: number): number => last * 100;

/** Items for rendering page `page` of a `total`-row list (the last page holds the remainder). */
function pageItems<T>(make: (i: number) => T, total: number, page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return Array.from({ length: Math.min(PAGE_SIZE, total - start) }, (_, k) => make(start + k + 1));
}

/**
 * The route's first flush: the real segment shell when the segment carries a loading
 * boundary, the empty string when nothing can stream before the page resolves.
 */
function firstFlushBytes(): string {
  return VarietyLoading ? renderToStaticMarkup(createElement(VarietyLoading)) : "";
}

type Outcome = { status: 200; html: string } | { status: 404 };

/** Resolve the real page: render (200) or the guard's 404 digest; anything else rethrows. */
async function resolvePage(page: Promise<ReactElement>): Promise<Outcome> {
  try {
    return { status: 200, html: renderToStaticMarkup(await page) };
  } catch (e) {
    if (e instanceof Error && e.message.includes(NOT_FOUND_DIGEST)) return { status: 404 };
    throw e;
  }
}

/**
 * The streamed status: a 404 the guard resolves after the shell flushed is already a 200 —
 * the status commits with the first byte.
 */
function streamedStatus(shell: string, outcome: Outcome): 200 | 404 {
  return outcome.status === 404 && shell === "" ? 404 : 200;
}

async function streamedVariety(params: Search): Promise<{ status: 200 | 404; outcome: Outcome; shell: string }> {
  const shell = firstFlushBytes();
  const outcome = await resolvePage(VarietiesPage({ searchParams: sp(params) }) as Promise<ReactElement>);
  return { status: streamedStatus(shell, outcome), outcome, shell };
}

describe("streamed status: the /variety bounds check resolves before the first byte", () => {
  const TOTAL = 2 * PAGE_SIZE;
  const LAST = totalPages(TOTAL);

  it("the last page streams 200 with its items (unchanged by the fix)", async () => {
    fake.varieties = { items: pageItems(varietyItem, TOTAL, LAST), total: TOTAL };
    const { status, outcome } = await streamedVariety({ page: String(LAST) });
    expect(status).toBe(200);
    if (outcome.status !== 200) throw new Error("expected the last page to render");
    expect(outcome.html).toContain(`${TOTAL} varieties`);
    expect(outcome.html).toContain(`Page ${LAST} of ${LAST}.`);
    expect(outcome.html).toContain("Test Variety 25");
  });

  it("one past the end answers a true 404, not a 200 shell", async () => {
    fake.varieties = { items: [], total: TOTAL };
    const { status, shell } = await streamedVariety({ page: String(LAST + 1) });
    expect(shell, "bytes flushed before the guard resolved").toBe("");
    expect(status).toBe(404);
  });

  it("an absurd page answers a true 404", async () => {
    fake.varieties = { items: [], total: TOTAL };
    const { status } = await streamedVariety({ page: String(absurdPage(LAST)) });
    expect(status).toBe(404);
  });

  it("a malformed page answers a true 404", async () => {
    fake.varieties = { items: [], total: TOTAL };
    const { status } = await streamedVariety({ page: "0" });
    expect(status).toBe(404);
  });
});

describe("the bound is the filtered total", () => {
  it("?season=cool bounds against the cool total (multi-page filter)", async () => {
    const TOTAL = 2 * PAGE_SIZE + 1;
    const LAST = totalPages(TOTAL);
    fake.varieties = { items: pageItems(varietyItem, TOTAL, LAST), total: TOTAL };
    const last = await streamedVariety({ season: "cool", page: String(LAST) });
    expect(last.status).toBe(200);
    if (last.outcome.status !== 200) throw new Error("expected the last filtered page to render");
    expect(last.outcome.html).toContain(`Page ${LAST} of ${LAST}.`);
    const args = fake.varietiesArgs as { filters?: { season?: unknown[] } };
    expect(args.filters?.season).toEqual([SEASON_PARAMS.cool]);

    fake.varieties = { items: [], total: TOTAL };
    expect((await streamedVariety({ season: "cool", page: String(LAST + 1) })).status).toBe(404);
    expect((await streamedVariety({ season: "cool", page: String(absurdPage(LAST)) })).status).toBe(404);
  });

  it("?method=trays bounds against the trays total (single-page filter)", async () => {
    const TOTAL = PAGE_SIZE - 1;
    const LAST = totalPages(TOTAL);
    expect(LAST).toBe(1);
    fake.varieties = { items: pageItems(varietyItem, TOTAL, LAST), total: TOTAL };
    const first = await streamedVariety({ method: "trays" });
    expect(first.status).toBe(200);
    const args = fake.varietiesArgs as { filters?: { methods?: unknown[] } };
    expect(args.filters?.methods).toEqual([METHOD_PARAMS.trays]);

    fake.varieties = { items: [], total: TOTAL };
    expect((await streamedVariety({ method: "trays", page: "2" })).status).toBe(404);
    expect((await streamedVariety({ method: "trays", page: String(absurdPage(LAST)) })).status).toBe(404);
  });
});

describe("bounds matrix: every paginated route at last / last+1 / absurd", () => {
  it("/seller", async () => {
    const TOTAL = 2 * PAGE_SIZE + 1;
    const LAST = totalPages(TOTAL);
    fake.sellers = { items: pageItems(sellerItem, TOTAL, LAST), total: TOTAL };
    const last = await resolvePage(SellersPage({ searchParams: sp({ page: String(LAST) }) }) as Promise<ReactElement>);
    expect(last.status).toBe(200);
    if (last.status !== 200) throw new Error("expected the last sellers page to render");
    expect(last.html).toContain(`${TOTAL} sellers`);
    expect(last.html).toContain(`Page ${LAST} of ${LAST}.`);

    fake.sellers = { items: [], total: TOTAL };
    expect(
      (await resolvePage(SellersPage({ searchParams: sp({ page: String(LAST + 1) }) }) as Promise<ReactElement>)).status,
    ).toBe(404);
    expect(
      (await resolvePage(SellersPage({ searchParams: sp({ page: String(absurdPage(LAST)) }) }) as Promise<ReactElement>)).status,
    ).toBe(404);
  });

  it("/crop/[slug]", async () => {
    const TOTAL = PAGE_SIZE + 1;
    const LAST = totalPages(TOTAL);
    const params = Promise.resolve({ slug: CROP.slug });
    fake.crop = { crop: { ...CROP, varietyCount: TOTAL, varieties: pageItems(varietyItem, TOTAL, LAST) }, total: TOTAL, colorFamilies: [] };
    const last = await resolvePage(CropPage({ params, searchParams: sp({ page: String(LAST) }) }) as Promise<ReactElement>);
    expect(last.status).toBe(200);
    if (last.status !== 200) throw new Error("expected the last crop page to render");
    expect(last.html).toContain(`Page ${LAST} of ${LAST}.`);

    fake.crop = { crop: { ...CROP, varietyCount: TOTAL, varieties: [] }, total: TOTAL, colorFamilies: [] };
    expect((await resolvePage(CropPage({ params, searchParams: sp({ page: String(LAST + 1) }) }) as Promise<ReactElement>)).status).toBe(
      404,
    );
    expect(
      (await resolvePage(CropPage({ params, searchParams: sp({ page: String(absurdPage(LAST)) }) }) as Promise<ReactElement>)).status,
    ).toBe(404);
  });

  it("/seller/[slug]", async () => {
    const TOTAL = 2 * PAGE_SIZE + 1;
    const LAST = totalPages(TOTAL);
    const params = Promise.resolve({ slug: "hollyhock-test-farm" });
    const seller: SellerDetail = fakeSellerDetail({
      slug: "hollyhock-test-farm",
      name: "Hollyhock Test Farm",
      homepage: "https://hollyhock-test-farm.example/",
      varietyCount: TOTAL,
      listings: Array.from({ length: TOTAL }, (_, k) => listingItem(k + 1)),
    });
    fake.seller = seller;
    const last = await resolvePage(SellerPage({ params, searchParams: sp({ page: String(LAST) }) }) as Promise<ReactElement>);
    expect(last.status).toBe(200);
    if (last.status !== 200) throw new Error("expected the last seller page to render");
    expect(last.html).toContain(`${TOTAL} listings`);
    expect(last.html).toContain(`page ${LAST} of ${LAST}`);
    // The page slices the full listing set itself: the last page shows the final listing.
    expect(last.html).toContain(`Test Variety ${TOTAL}`);

    expect((await resolvePage(SellerPage({ params, searchParams: sp({ page: String(LAST + 1) }) }) as Promise<ReactElement>)).status).toBe(
      404,
    );
    expect(
      (await resolvePage(SellerPage({ params, searchParams: sp({ page: String(absurdPage(LAST)) }) }) as Promise<ReactElement>)).status,
    ).toBe(404);
  });

  it("/state/[slug]", async () => {
    const TOTAL = 2 * PAGE_SIZE;
    const LAST = totalPages(TOTAL);
    fake.states = [{ ...OREGON, sellerCount: TOTAL }];
    fake.sellers = { items: pageItems(sellerItem, TOTAL, LAST), total: TOTAL };
    const params = Promise.resolve({ slug: OREGON.slug });
    const last = await resolvePage(StatePage({ params, searchParams: sp({ page: String(LAST) }) }) as Promise<ReactElement>);
    expect(last.status).toBe(200);
    if (last.status !== 200) throw new Error("expected the last state page to render");
    expect(last.html).toContain(`${TOTAL} seed sellers in Oregon list seed`);
    expect(last.html).toContain(`Page ${LAST} of ${LAST}.`);

    fake.sellers = { items: [], total: TOTAL };
    expect((await resolvePage(StatePage({ params, searchParams: sp({ page: String(LAST + 1) }) }) as Promise<ReactElement>)).status).toBe(
      404,
    );
    expect(
      (await resolvePage(StatePage({ params, searchParams: sp({ page: String(absurdPage(LAST)) }) }) as Promise<ReactElement>)).status,
    ).toBe(404);
  });
});

describe("the skeleton survives as the inner fallback, content unchanged", () => {
  it("the guard resolves before the page returns its Suspense boundary (wiring pin)", () => {
    const src = readFileSync(join(VARIETY_SEGMENT, "page.tsx"), "utf8");
    const guardAt = src.indexOf("assertPageInRange(page, total);");
    const suspenseAt = src.indexOf("<Suspense fallback={<VarietiesSkeleton />}>");
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(suspenseAt).toBeGreaterThan(guardAt);
  });

  it.runIf(VarietiesSkeleton !== null)("genuine loads announce exactly as before", () => {
    if (!VarietiesSkeleton) throw new Error("unreachable: gated by runIf");
    const h = renderToStaticMarkup(createElement(VarietiesSkeleton));
    expect(h).toContain("Loading varieties…");
    expect(h).toContain("Flower seed varieties");
    // Grid + pagination geometry stand-ins (the wide browse grid, the pager row).
    expect(h).toContain("sm:grid-cols-4 lg:grid-cols-5");
    expect(h).toContain("mt-8 flex items-center justify-center gap-2");
  });
});
