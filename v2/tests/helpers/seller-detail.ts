/**
 * Fake SellerDetail factory (refactor R2 §4): one complete, valid SellerDetail with
 * per-file overrides. Replaces the hand-built literals in the page-render and SEO unit
 * tests; each adopted file keeps its own field values via overrides and every one of
 * its assertions. The default passes SellerDetailSchema (the seller-states adoption
 * asserts so, as it did for its literal).
 */
import type { SellerDetail } from "@/lib/validators";

export function fakeSellerDetail(overrides: Partial<SellerDetail> = {}): SellerDetail {
  return {
    slug: "test-farm",
    name: "Test Farm",
    type: "specialty",
    location: "Junction City, OR",
    region: "OR",
    country: "US",
    homepage: "https://test-farm.example/",
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
    ...overrides,
  };
}
