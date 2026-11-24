/**
 * Tranche 3.5 — out-of-range pagination answers a true HTTP 404 on every paginated route.
 *
 * Mechanism: each list page guards with assertPageInRange(page, total), which throws
 * next/navigation's notFound() (the NEXT_HTTP_ERROR_FALLBACK;404 digest). Next serves the
 * standard not-found page with a 404 status — but only when the throw resolves BEFORE the
 * first bytes stream, because the first flush commits the response status. A segment
 * loading.tsx breaks that ordering: Next streams its fallback shell with 200 while the page
 * is still fetching, so the guard's 404 resolves too late (the soft-404 defect PR #11 fixed
 * on the seller/crop/state routes by removing their segment shells; /variety was the last
 * route still carrying one).
 *
 * The /variety 404 probes below therefore go through the real render/streaming path: each
 * kicks the real page component off against a gated catalog, proves the guard cannot settle
 * while data is in flight, streams whatever shell the segment's loading boundary (resolved
 * by Next's own file convention) would flush in that window, and only then releases the
 * data and requires the 404 digest. On main the shell streams and these probes FAIL; on the
 * branch no shell exists and they PASS. A probe that only awaited the page component would
 * pass on main — the guard already throws there — so it cannot count (brief §Proof).
 *
 * The other paginated routes (/seller, /seller/[slug], /crop/[slug], /state/[slug]) are
 * proof-only controls: last page renders, last+1 and an absurd page 404. Totals derive from
 * PAGE_SIZE and last pages from totalPages(); nothing here hardcodes a catalog count.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_SIZE } from "@/lib/config";
import { totalPages } from "@/lib/paging";
import { stateBySlug } from "@/lib/data/states";
import {
  COLOR_FAMILIES,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_PARAMS,
  varietyFiltersFromBrowse,
  type BrowseFilterState,
} from "@/lib/browse";
import type { Page, VarietyFilters } from "@/lib/repositories/catalog-read";
import type { BrowseCropResult, BrowseSellersResult, Paged } from "@/lib/services/catalog";
import type { CropDetailFilterState } from "@/lib/crop-detail";
import type { SellerBrowseState } from "@/lib/seller-browse";
import type {
  BrowseCounts,
  BrowseVarietiesPayload,
  CropDetail,
  CropDetailCounts,
  PublicListing,
  SellerDetail,
  SellerListItem,
  SellerState,
  VarietyListItem,
} from "@/lib/validators";

/** What next/navigation's notFound() throws (its message and digest). */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

/** Filtered and unfiltered catalog sizes, each a function of PAGE_SIZE (never a literal count). */
const U_VARIETY = PAGE_SIZE * 2 + 1; // unfiltered /variety: 3 pages
const F_SEASON = PAGE_SIZE + 1; // ?season=cool: 2 pages
const F_METHOD = PAGE_SIZE * 3 + 1; // ?method=direct: 4 pages
const F_SMALL_FARM = PAGE_SIZE; // ?small_farm=true: exactly 1 page
const T_SELLER = PAGE_SIZE + 1; // /seller: 2 pages
const L_LISTINGS = PAGE_SIZE * 2 + 1; // /seller/[slug] listings: 3 pages
const C_CROP = PAGE_SIZE + 1; // /crop/[slug] varieties: 2 pages
const T_STATE = PAGE_SIZE * 2 + 1; // /state/[slug] sellers: 3 pages

/** Largest format-valid ?page= — parsePage (lib/paging) allows at most six digits. */
const ABSURD_PAGE = 10 ** 6 - 1;

const fake = vi.hoisted(() => ({
  states: [] as unknown[],
  seller: null as unknown,
}));
const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));

import { fakeServices } from "../helpers/services-context";
import { fakeSellerDetail } from "../helpers/seller-detail";

// Imported after the mock is registered (vi.mock is hoisted above these too).
const { default: VarietiesPage } = await import("@/app/variety/page");
const { default: SellersPage } = await import("@/app/seller/page");
const { default: SellerPage } = await import("@/app/seller/[slug]/page");
const { default: CropPage } = await import("@/app/crop/[slug]/page");
const { default: StatePage } = await import("@/app/state/[slug]/page");

const plant = {
  slug: "sweet-pea",
  commonName: "Sweet Pea",
  latinName: "Lathyrus odoratus",
  lifeCycle: null,
  season_class: null,
  season_source_label: null,
  sowing_methods: [],
  sowing_method_source_label: null,
} as const;

function varietyItem(i: number): VarietyListItem {
  return {
    slug: `test-variety-${i}`,
    varietyName: `Test Variety ${i}`,
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
    cropMedia: [],
  };
}

function sellerItem(i: number, region = "OR"): SellerListItem {
  return {
    slug: `test-farm-${i}`,
    name: `Test Farm ${i}`,
    type: "specialty",
    location: null,
    region,
    country: "US",
    homepage: null,
    ratingCount: 0,
    ratingAverage: null,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    importedRating: null,
    isSmallFarm: false,
    varietyCount: 0,
  };
}

function listingItem(id: number): PublicListing {
  return {
    id,
    variety: {
      slug: `test-variety-${id}`,
      varietyName: `Test Variety ${id}`,
      plant: { ...plant, sowing_methods: [] },
      colorSwatch: null,
      colorFamily: "unknown",
      media: [],
      cropMedia: [],
    },
    seller: {
      slug: "hollyhock-test-farm",
      name: "Hollyhock Test Farm",
      location: null,
      region: "OR",
      country: "US",
      isSmallFarm: false,
    },
    availability: "in_stock",
    lastCheckedAt: "2026-11-15",
    firstSeenAt: "2026-11-15",
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: `https://hollyhock-test-farm.example/${id}`,
    notes: null,
    status: "published",
    packetSizes: [{ label: "Packet", seedCount: 10 }],
    provenance: { source_url: null, retrieved_at: "2026-11-15", method: "human", confidence: 1 },
    sourceLabel: "Shop check",
  };
}

const CROP: CropDetail = {
  slug: "test-crop",
  commonName: "Test Crop",
  latinName: null,
  lifeCycle: null,
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

function sellerWithListings(n: number): SellerDetail {
  return fakeSellerDetail({
    slug: "hollyhock-test-farm",
    name: "Hollyhock Test Farm",
    homepage: "https://hollyhock-test-farm.example/",
    listings: Array.from({ length: n }, (_, i) => listingItem(i + 1)),
  });
}

type VarietyQuery = { filters?: VarietyFilters; page: Page };

/** The fake answers per-filter totals so each filtered view has its own bound, like production. */
async function defaultListVarieties(opts: VarietyQuery): Promise<Paged<VarietyListItem>> {
  const f = opts.filters ?? {};
  let total = U_VARIETY;
  if (f.season?.length) total = F_SEASON;
  else if (f.methods?.length) total = F_METHOD;
  else if (f.smallFarmOnly) total = F_SMALL_FARM;
  const n = Math.max(0, Math.min(opts.page.limit, total - opts.page.offset));
  return { items: Array.from({ length: n }, (_, i) => varietyItem(i)), total };
}

/** Swappable so the streaming probes can gate the catalog on a deferred (see below). */
let listVarietiesImpl: (opts: VarietyQuery) => Promise<Paged<VarietyListItem>> = defaultListVarieties;

type BrowseQuery = { filters: BrowseFilterState; page: Page };

/** Zero counts in the schema's shape (option keys derived from the vocabulary, never listed). */
function zeroCounts(): BrowseCounts {
  const zeros = <K extends string>(keys: readonly K[]): Record<K, number> =>
    Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  return {
    season: { all: 0, options: zeros(Object.keys(SEASON_PARAMS) as (keyof typeof SEASON_PARAMS)[]) },
    method: { all: 0, options: zeros(Object.keys(METHOD_PARAMS) as (keyof typeof METHOD_PARAMS)[]) },
    lifeCycle: { all: 0, options: zeros(LIFE_CYCLE_PARAMS) },
    hue: { all: 0, options: zeros(COLOR_FAMILIES) },
    smallFarm: { all: 0, on: 0 },
  };
}

/** The /variety fake serves the browse payload through the same swappable totals. */
async function fakeBrowseVarieties(opts: BrowseQuery): Promise<BrowseVarietiesPayload> {
  const r = await listVarietiesImpl({ filters: varietyFiltersFromBrowse(opts.filters), page: opts.page });
  return {
    ...r,
    page: Math.floor(opts.page.offset / opts.page.limit) + 1,
    pages: totalPages(r.total, opts.page.limit),
    counts: zeroCounts(),
  };
}

async function fakeListSellers(page: Page, filters?: { region?: string[] }): Promise<Paged<SellerListItem>> {
  const total = filters?.region?.length ? T_STATE : T_SELLER;
  const n = Math.max(0, Math.min(page.limit, total - page.offset));
  return { items: Array.from({ length: n }, (_, i) => sellerItem(i)), total };
}

function cropResult(page: Page): { crop: CropDetail; total: number; colorFamilies: string[] } {
  const n = Math.max(0, Math.min(page.limit, C_CROP - page.offset));
  return {
    crop: { ...CROP, varietyCount: C_CROP, varieties: Array.from({ length: n }, (_, i) => varietyItem(i)) },
    total: C_CROP,
    colorFamilies: [],
  };
}

/** Zeroed crop-detail counts in the schema's shape (chips render, nothing narrows). */
function zeroCropDetailCounts(): CropDetailCounts {
  return { sellers: { all: 0, has: 0, none: 0 }, hue: { all: 0, options: {} }, series: { all: 0, options: {} } };
}

/** The /seller fake serves the browse payload through the same swappable totals. */
async function fakeBrowseSellers(opts: { state: SellerBrowseState; page: Page }): Promise<BrowseSellersResult> {
  const r = await fakeListSellers(opts.page, opts.state.state ? { region: [opts.state.state] } : undefined);
  const states = fake.states as SellerState[];
  return {
    ...r,
    page: Math.floor(opts.page.offset / opts.page.limit) + 1,
    pages: totalPages(r.total, opts.page.limit),
    counts: { all: r.total, options: Object.fromEntries(states.map((s) => [s.code, s.sellerCount])) },
    states,
  };
}

/** The /crop/[slug] fake serves the browse payload through the same swappable totals. */
async function fakeBrowseCrop(_slug: string, opts: { state: CropDetailFilterState; page: Page }): Promise<BrowseCropResult> {
  const r = cropResult(opts.page);
  return {
    ...r,
    page: Math.floor(opts.page.offset / opts.page.limit) + 1,
    pages: totalPages(r.total, opts.page.limit),
    counts: zeroCropDetailCounts(),
  };
}

store.services = fakeServices({
  catalog: {
    listVarieties: (opts: VarietyQuery) => listVarietiesImpl(opts),
    browseVarieties: (opts: BrowseQuery) => fakeBrowseVarieties(opts),
    listSellers: (page: Page, filters?: { region?: string[] }) => fakeListSellers(page, filters),
    listSellerStates: async () => fake.states,
    getSeller: async () => fake.seller,
    getCrop: async (_slug: string, opts: { page: Page }) => cropResult(opts.page),
    // Tranche 3.1b-2: the seller + crop pages render from the browse payload (items + total
    // + counts), the identical contract their /api/browse routes serve the in-place layer.
    browseSellers: (opts: { state: SellerBrowseState; page: Page }) => fakeBrowseSellers(opts),
    browseCrop: (_slug: string, opts: { state: CropDetailFilterState; page: Page }) => fakeBrowseCrop(_slug, opts),
  },
});

beforeEach(() => {
  listVarietiesImpl = defaultListVarieties;
  fake.states = [{ ...stateBySlug("oregon")!, sellerCount: T_STATE }];
  fake.seller = sellerWithListings(L_LISTINGS);
});

type SearchParams = Record<string, string | string[] | undefined>;

async function renderVariety(sp: SearchParams): Promise<string> {
  return renderToStaticMarkup((await VarietiesPage({ searchParams: Promise.resolve(sp) })) as ReactElement);
}

async function renderSellers(sp: SearchParams): Promise<string> {
  return renderToStaticMarkup((await SellersPage({ searchParams: Promise.resolve(sp) })) as ReactElement);
}

async function renderSellerDetail(slug: string, sp: SearchParams): Promise<string> {
  const el = (await SellerPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) })) as ReactElement;
  return renderToStaticMarkup(el);
}

async function renderCrop(slug: string, sp: SearchParams): Promise<string> {
  const el = (await CropPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) })) as ReactElement;
  return renderToStaticMarkup(el);
}

async function renderState(slug: string, sp: SearchParams): Promise<string> {
  const el = (await StatePage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) })) as ReactElement;
  return renderToStaticMarkup(el);
}

/** Drain a React stream to a string (the bytes the response would flush). */
async function streamToString(el: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(el);
  await stream.allReady;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

type ShellModule = { default?: () => ReactElement };

/**
 * The bytes Next would flush for the segment while the page is in flight: the segment's
 * loading boundary, resolved by the same file convention Next routes by. No boundary file
 * means no shell can precede the guard — the empty string, honestly measured.
 */
async function streamSegmentShell(relativePath: string): Promise<string> {
  const abs = join(process.cwd(), relativePath);
  if (!existsSync(abs)) return "";
  const mod = (await import(pathToFileURL(abs).href)) as ShellModule;
  if (!mod.default) return "";
  return streamToString(createElement(mod.default));
}

/**
 * Full status-through-streaming proof for one out-of-range /variety view: the guard cannot
 * settle while the catalog is in flight (still pending after a macrotask), whatever shell
 * the segment would stream in that window is measured (it must be zero bytes — any bytes
 * commit HTTP 200 before the 404 can resolve), and once data arrives the page rejects with
 * the 404 digest. On main the shell streams and this fails; without the segment shell it
 * passes.
 */
async function expectVarietyTrue404(sp: SearchParams, total: number): Promise<void> {
  let release = (_v: BrowseVarietiesPayload): void => {
    throw new Error("catalog gate not armed");
  };
  const gated = new Promise<BrowseVarietiesPayload>((res) => {
    release = res;
  });
  listVarietiesImpl = () => gated;
  try {
    const pending = VarietiesPage({ searchParams: Promise.resolve(sp) });
    await new Promise((r) => setImmediate(r));
    const state = await Promise.race([
      pending.then(
        () => "settled" as const,
        () => "settled" as const,
      ),
      Promise.resolve("pending" as const),
    ]);
    expect(state).toBe("pending");
    const shell = await streamSegmentShell("app/variety/loading.tsx");
    expect(shell.length, "segment shell bytes flushed before the 404 resolved — the response is already 200").toBe(0);
    release({ items: [], total, page: 1, pages: totalPages(total), counts: zeroCounts() });
    await expect(pending).rejects.toThrow(NOT_FOUND_DIGEST);
  } finally {
    listVarietiesImpl = defaultListVarieties;
  }
}

describe("/variety pagination bounds (true 404s)", () => {
  const last = totalPages(U_VARIETY);

  it("the last page renders exactly as today (200 content, in-range unchanged)", async () => {
    const h = await renderVariety({ page: String(last) });
    expect(h).toContain(`Page ${last} of ${last}.`);
    expect(h).toContain("Test Variety 0");
    expect(h).toContain('href="/variety/test-variety-0"');
  });

  it("last page + 1 answers a true 404 with nothing streamed before the guard", async () => {
    await expectVarietyTrue404({ page: String(last + 1) }, U_VARIETY);
  });

  it("an absurd page answers a true 404 with nothing streamed before the guard", async () => {
    await expectVarietyTrue404({ page: String(ABSURD_PAGE) }, U_VARIETY);
  });

  it("the bound is the filtered total: the unfiltered last page 404s once filtered past the filtered end", async () => {
    // Premise guard: the unfiltered last page sits past the season-filtered end, so this
    // probe genuinely straddles the two bounds (it fails loudly here if totals ever drift).
    expect(totalPages(F_SEASON) + 1).toBe(last);
    const h = await renderVariety({ page: String(last) });
    expect(h).toContain(`Page ${last} of ${last}.`);
    await expectVarietyTrue404({ season: "cool", page: String(last) }, F_SEASON);
  });

  const FILTERED: { label: string; sp: SearchParams; total: number }[] = [
    { label: "?season=cool", sp: { season: "cool" }, total: F_SEASON },
    { label: "?method=direct", sp: { method: "direct" }, total: F_METHOD },
    { label: "?small_farm=true", sp: { small_farm: "true" }, total: F_SMALL_FARM },
  ];
  for (const v of FILTERED) {
    const vlast = totalPages(v.total);
    it(`${v.label}: last page renders 200 content`, async () => {
      const h = await renderVariety({ ...v.sp, page: String(vlast) });
      if (vlast > 1) expect(h).toContain(`Page ${vlast} of ${vlast}.`);
      else expect(h).not.toContain("Page 1 of");
      expect(h).toContain("Test Variety 0");
    });
    it(`${v.label}: last page + 1 answers a true 404 through the streaming path`, async () => {
      await expectVarietyTrue404({ ...v.sp, page: String(vlast + 1) }, v.total);
    });
    it(`${v.label}: an absurd page answers a true 404 through the streaming path`, async () => {
      await expectVarietyTrue404({ ...v.sp, page: String(ABSURD_PAGE) }, v.total);
    });
  }
});

describe("control routes (already true-404; proof only — this change must not alter them)", () => {
  it("/seller: last page renders, last+1 and absurd 404", async () => {
    const last = totalPages(T_SELLER);
    const h = await renderSellers({ page: String(last) });
    expect(h).toContain(`Page ${last} of ${last}.`);
    expect(h).toContain("Test Farm 0");
    await expect(SellersPage({ searchParams: Promise.resolve({ page: String(last + 1) }) })).rejects.toThrow(
      NOT_FOUND_DIGEST,
    );
    await expect(SellersPage({ searchParams: Promise.resolve({ page: String(ABSURD_PAGE) }) })).rejects.toThrow(
      NOT_FOUND_DIGEST,
    );
  });

  it("/seller/[slug]: last page renders, last+1 and absurd 404", async () => {
    const last = totalPages(L_LISTINGS);
    const h = await renderSellerDetail("hollyhock-test-farm", { page: String(last) });
    expect(h).toContain(`page ${last} of ${last}`);
    expect(h).toContain(`Test Variety ${L_LISTINGS}`);
    const slug = { slug: "hollyhock-test-farm" };
    await expect(
      SellerPage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(last + 1) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
    await expect(
      SellerPage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(ABSURD_PAGE) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("/crop/[slug]: last page renders, last+1 and absurd 404", async () => {
    const last = totalPages(C_CROP);
    const h = await renderCrop("test-crop", { page: String(last) });
    expect(h).toContain(`Page ${last} of ${last}.`);
    expect(h).toContain("Test Variety 0");
    const slug = { slug: "test-crop" };
    await expect(
      CropPage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(last + 1) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
    await expect(
      CropPage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(ABSURD_PAGE) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("/state/[slug]: last page renders, last+1 and absurd 404", async () => {
    const last = totalPages(T_STATE);
    const h = await renderState("oregon", { page: String(last) });
    expect(h).toContain(`Page ${last} of ${last}.`);
    expect(h).toContain("Test Farm 0");
    const slug = { slug: "oregon" };
    await expect(
      StatePage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(last + 1) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
    await expect(
      StatePage({ params: Promise.resolve(slug), searchParams: Promise.resolve({ page: String(ABSURD_PAGE) }) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });
});

describe("segment shells (the status-committing mechanism)", () => {
  it("/variety carries no segment loading boundary, so the guard resolves before anything streams", () => {
    expect(existsSync(join(process.cwd(), "app/variety/loading.tsx"))).toBe(false);
  });

  it("the control routes carry no segment loading boundary either (their 404s' premise)", () => {
    for (const seg of ["app/seller", "app/seller/[slug]", "app/crop", "app/crop/[slug]", "app/state/[slug]"]) {
      expect(existsSync(join(process.cwd(), seg, "loading.tsx")), seg).toBe(false);
    }
  });
});

/** The variety loading UI, wherever this revision keeps it: the post-fix skeleton, else the segment shell. */
async function loadVarietyShell(): Promise<ReactElement> {
  const skel = join(process.cwd(), "app/variety/skeleton.tsx");
  if (existsSync(skel)) {
    const mod = (await import(pathToFileURL(skel).href)) as { VarietiesSkeleton?: () => ReactElement };
    if (!mod.VarietiesSkeleton) throw new Error("app/variety/skeleton.tsx exports no VarietiesSkeleton");
    return createElement(mod.VarietiesSkeleton);
  }
  const mod = (await import(pathToFileURL(join(process.cwd(), "app/variety/loading.tsx")).href)) as ShellModule;
  if (!mod.default) throw new Error("no variety shell module found");
  return createElement(mod.default);
}

describe("variety loading skeleton (unchanged in content by the move)", () => {
  it("announces and draws the same shell the segment always streamed", async () => {
    const h = renderToStaticMarkup(await loadVarietyShell());
    expect(h).toContain("Loading varieties…");
    // Wide grid, ten cards, five filter groups, pagination row — the loading.tsx geometry, verbatim.
    expect(h).toContain("lg:grid-cols-5");
    expect(h.match(/card packet/g) ?? []).toHaveLength(10);
    expect(h.match(/flex-nowrap/g) ?? []).toHaveLength(5);
    expect(h).toContain("mt-8 flex items-center justify-center gap-2");
  });
});
