/**
 * Soft-404 regression (production acceptance run 2026-11-20): an unknown seller or crop
 * slug must answer a TRUE HTTP 404. In this stack (Next 16 on OpenNext/Cloudflare) the
 * working pattern for a searchParams-reading dynamic route is the state route's:
 * `export const dynamic = "force-dynamic"` plus `notFound()` for unknown params, which
 * throws NEXT_HTTP_ERROR_FALLBACK;404 so Next serves the not-found page with a 404
 * status. (The variety route is the ISR variant of the same rule — revalidate +
 * dynamicParams + generateStaticParams: [] + notFound() — but seller and crop read
 * searchParams (?page=, filters), so force-dynamic is their mechanism.)
 *
 * Rendered through the real page components against a fake in-process catalog
 * (tests/unit/state-plates.test.ts pattern): bad slugs reject with the 404 digest while
 * valid slugs render unchanged. The route-config pins below guard the mechanism itself,
 * which in-process rendering cannot see; scripts/acceptance.ts asserts the same slugs
 * over real HTTP (GET /seller/does-not-exist → 404, /crop/does-not-exist → 404).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CropDetail, SellerDetail } from "@/lib/validators";

/** What next/navigation's notFound() throws (its message and digest). */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

const fake = vi.hoisted(() => ({
  seller: null as unknown,
  crop: null as unknown,
  states: [] as unknown[],
}));
vi.mock("@/lib/services/context", () => ({
  getServices: async () => ({
    catalog: {
      getSeller: async () => fake.seller,
      getCrop: async () => fake.crop,
      listSellerStates: async () => fake.states,
    },
  }),
}));

// Imported after the mock is registered (vi.mock is hoisted above these too).
const { default: SellerPage, generateMetadata: sellerMetadata } = await import("@/app/seller/[slug]/page");
const { default: CropPage, generateMetadata: cropMetadata } = await import("@/app/crop/[slug]/page");
const { default: StatePage } = await import("@/app/state/[slug]/page");

beforeEach(() => {
  fake.seller = null;
  fake.crop = null;
  fake.states = [];
});

const SELLER: SellerDetail = {
  slug: "hollyhock-test-farm",
  name: "Hollyhock Test Farm",
  type: "specialty",
  location: "Junction City, OR",
  region: "OR",
  country: "US",
  homepage: "https://hollyhock-test-farm.example/",
  ratingCount: 0,
  ratingAverage: null,
  rating: { state: "not_yet_rated", average: null, review_count: 0 },
  importedRating: null,
  isSmallFarm: false,
  description: "A test farm.",
  orderingNotes: null,
  varietyCount: 0,
  updatedAt: "2026-11-20T00:00:00.000Z",
  claimStatus: "unclaimed",
  shipsTo: ["US"],
  isSiteOwner: false,
  listings: [],
};

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

describe("unknown seller slugs 404", () => {
  it("a well-formed but unknown slug throws the 404 digest (never renders with 200)", async () => {
    await expect(
      SellerPage({ params: Promise.resolve({ slug: "does-not-exist" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("a malformed slug throws the 404 digest too", async () => {
    await expect(
      SellerPage({ params: Promise.resolve({ slug: "not a slug!!" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("stays on the noindex not-found metadata (the state/variety convention)", async () => {
    await expect(
      sellerMetadata({ params: Promise.resolve({ slug: "does-not-exist" }), searchParams: Promise.resolve({}) }),
    ).resolves.toEqual({ title: "Seller not found", robots: { index: false, follow: true } });
  });

  it("a valid seller still renders unchanged", async () => {
    fake.seller = SELLER;
    const el = (await SellerPage({
      params: Promise.resolve({ slug: SELLER.slug }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const h = renderToStaticMarkup(el);
    expect(h).toContain("Hollyhock Test Farm");
    // The self URL (breadcrumb + Organization JSON-LD carry the absolute page URL).
    expect(h).toContain("/seller/hollyhock-test-farm");
    expect(h).toContain("No listings for this seller yet.");
  });
});

describe("unknown crop slugs 404", () => {
  it("a well-formed but unknown slug throws the 404 digest (never renders with 200)", async () => {
    await expect(
      CropPage({ params: Promise.resolve({ slug: "does-not-exist" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("a malformed slug throws the 404 digest too", async () => {
    await expect(
      CropPage({ params: Promise.resolve({ slug: "not a slug!!" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("stays on the noindex not-found metadata (the state/variety convention)", async () => {
    await expect(
      cropMetadata({ params: Promise.resolve({ slug: "does-not-exist" }), searchParams: Promise.resolve({}) }),
    ).resolves.toEqual({ title: "Crop not found", robots: { index: false, follow: true } });
  });

  it("a valid crop still renders unchanged", async () => {
    fake.crop = { crop: CROP, total: 0, colorFamilies: [] };
    const el = (await CropPage({
      params: Promise.resolve({ slug: CROP.slug }),
      searchParams: Promise.resolve({}),
    })) as ReactElement;
    const h = renderToStaticMarkup(el);
    expect(h).toContain("Test Crop seeds");
    expect(h).toContain('href="/crop/test-crop"');
    expect(h).toContain("0 varieties cataloged");
    expect(h).toContain("No varieties match.");
  });
});

describe("control: the state route's identical mechanism", () => {
  it("an unknown state slug throws the same 404 digest", async () => {
    await expect(
      StatePage({ params: Promise.resolve({ slug: "does-not-exist" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND_DIGEST);
  });
});

describe("route config pins (the mechanism in-process rendering cannot see)", () => {
  const sellerSrc = readFileSync(join(process.cwd(), "app/seller/[slug]/page.tsx"), "utf8");
  const cropSrc = readFileSync(join(process.cwd(), "app/crop/[slug]/page.tsx"), "utf8");

  it("seller + crop stay force-dynamic and route unknown params through notFound()", () => {
    for (const [name, src] of [
      ["seller", sellerSrc],
      ["crop", cropSrc],
    ] as const) {
      expect(src, name).toContain('export const dynamic = "force-dynamic"');
      expect(src, name).toContain('import { notFound } from "next/navigation"');
      expect(src, name).toContain("notFound()");
    }
  });
});
