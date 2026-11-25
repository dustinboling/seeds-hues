/**
 * Slice 8 parity dataset: the production-shaped catalog the parity crawl
 * serves the built app against. Provenance: shopCatalogState() (the base
 * fake catalog + Slice 5 shops/hubs — the fullest prior dataset) grafted
 * with the Slice 4 testbloom entries (50 varieties + 24 sellers + crop +
 * series, for the /variety + /seller pagination tails), every testbloom
 * seller relocated to Ohio plus one more (25 OH sellers — the paginated
 * state the Slice 5 residual risk names), and synthesized detail reads
 * for every snapshot row so every sitemap URL resolves.
 *
 * Deliberate approximations (fixture scope, not app behavior): synthesized
 * variety-detail listings reference real sellers without joining those
 * sellers' shop grids (shop↔variety listing identity is approximate —
 * Slice 5 proved the real fan-out on its shared rows); the testbloom
 * crop keeps its browse-catalog counts (50/38) while its hub walks zero
 * members (its varieties' plant refs are sweet-pea/cosmos, as designed
 * in the browse fixtures — the hub renders the honest empty grid).
 *
 * NOT added here: the 30 sunflower detail reads. The shop catalog's
 * snapshot lists them but its API cannot serve them — the parity harness
 * must catch that incoherence red (it does), and the fix lands in
 * shop-catalog.ts (Step 2), not here.
 */
import type {
  ApiPlantGuidance,
  ApiPublicListing,
  ApiSellerDetail,
  ApiSellerItem,
  ApiSellerRef,
  ApiVarietyDetail,
  ApiVarietyListItem,
} from "../../src/data/types";
import type { FakeCatalogState } from "../unit/fake-catalog";
import { shopCatalogState } from "../unit/shop-catalog";
import { TESTBLOOM_CROP, TESTBLOOM_SERIES, testbloomSeller, testbloomVariety } from "../unit/browse-catalog";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** The 25th Ohio seller (the 24 grafted testbloom sellers relocate to OH below). */
function testbloomSeller25(): ApiSellerItem {
  return {
    slug: "testbloom-farm-25",
    name: "Testbloom Farm 25",
    type: "retail",
    location: "Columbus, OH",
    region: "OH",
    country: "US",
    varietyCount: 2,
    ratingCount: 0,
    isSmallFarm: true,
  };
}

function sellerRefOf(item: ApiSellerItem): ApiSellerRef {
  return {
    slug: item.slug,
    name: item.name,
    location: item.location,
    region: item.region,
    country: item.country,
    isSmallFarm: item.isSmallFarm,
  };
}

const AVAILABILITY: ApiPublicListing["availability"][] = ["in_stock", "sold_out", "preorder", "in_stock"];

/** Minimal but valid detail listings for a synthesized variety (one per seller while sellers last). */
function synthesizedListings(variety: ApiVarietyListItem, sellers: ApiSellerItem[], idBase: number): ApiPublicListing[] {
  const count = Math.min(variety.sellerCount, sellers.length);
  const listings: ApiPublicListing[] = [];
  for (let i = 0; i < count; i++) {
    const seller = sellers[(idBase + i) % sellers.length]!;
    const availability = AVAILABILITY[(idBase + i) % AVAILABILITY.length]!;
    const checked = `2026-11-${pad2(10 + ((idBase + i) % 15))}T08:00:00.000Z`;
    const productUrl = `https://shop.example.com/${seller.slug}/${variety.slug}`;
    listings.push({
      id: idBase + i,
      variety: {
        slug: variety.slug,
        varietyName: variety.varietyName,
        plant: structuredClone(variety.plant),
        colorSwatch: null,
        colorFamily: variety.colorFamily,
        media: [],
        cropMedia: [],
      },
      seller: sellerRefOf(seller),
      availability,
      lastCheckedAt: availability === "preorder" && (idBase + i) % 2 === 0 ? null : checked,
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      goUrl: `https://seeds.hues.flowers/go/${idBase + i}`,
      productUrl,
      notes: null,
      status: "published",
      packetSizes: [{ label: "25 seeds", seedCount: 25 }],
      provenance: { source_url: productUrl, retrieved_at: checked, method: "human", confidence: 0.95 },
      sourceLabel: null,
    });
  }
  return listings;
}

/** A valid variety detail synthesized from its list row (facts complete, prose short, listings coherent). */
function synthesizedDetail(variety: ApiVarietyListItem, sellers: ApiSellerItem[], idBase: number): ApiVarietyDetail {
  const listings = synthesizedListings(variety, sellers, idBase);
  const sellerCount = new Set(listings.map((l) => l.seller.slug)).size;
  const plant: ApiPlantGuidance = {
    ...structuredClone(variety.plant),
    description: `${variety.plant.commonName} grown for cut flowers.`,
    sowingNotes: "Sow after frost.",
  };
  return {
    slug: variety.slug,
    varietyName: variety.varietyName,
    plant,
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: variety.series ? { ...variety.series } : null,
    colorSwatch: null,
    colorFamily: variety.colorFamily,
    listingCount: listings.length,
    sellerCount,
    inStockCount: listings.filter((l) => l.availability === "in_stock").length,
    lastCheckedAt: listings[0]?.lastCheckedAt ?? null,
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    description: `${variety.varietyName} is a synthesized parity variety of ${variety.plant.commonName}.`,
    templateDescription: `${variety.varietyName} is a ${variety.plant.commonName} variety.`,
    answer:
      sellerCount === 0
        ? `No seller found selling ${variety.varietyName} yet.`
        : `${sellerCount} seller${sellerCount === 1 ? "" : "s"} list${sellerCount === 1 ? "s" : ""} ${variety.varietyName}.`,
    sowingNotes: "Sow after frost.",
    heightCm: 90,
    facts: {
      color_family: variety.colorFamily,
      pollination: "open_pollinated",
      height_cm: { min: 90, max: 90 },
      days_to_bloom: { min: 70, max: 80 },
    },
    tags: [],
    aliases: [],
    protection: "none_stated",
    protectionNote: null,
    contentLevel: "factual",
    updatedAt: "2026-11-20T00:00:00.000Z",
    listings,
    media: [],
  };
}

/** A valid shop detail for a grafted seller (two listings over testbloom varieties). */
function synthesizedSellerDetail(item: ApiSellerItem, varieties: ApiVarietyListItem[], idBase: number): ApiSellerDetail {
  const listings = [0, 1].map((k) => {
    const variety = varieties[(idBase + k) % varieties.length]!;
    const productUrl = `https://shop.example.com/${item.slug}/${variety.slug}`;
    return {
      id: idBase + k,
      variety: {
        slug: variety.slug,
        varietyName: variety.varietyName,
        plant: structuredClone(variety.plant),
        colorSwatch: null,
        colorFamily: variety.colorFamily,
        media: [],
        cropMedia: [],
      },
      seller: sellerRefOf(item),
      availability: (k === 0 ? "in_stock" : "sold_out") as ApiPublicListing["availability"],
      lastCheckedAt: "2026-11-20T08:00:00.000Z",
      firstSeenAt: "2026-09-01T00:00:00.000Z",
      goUrl: `https://seeds.hues.flowers/go/${idBase + k}`,
      productUrl,
      notes: null,
      status: "published" as const,
      packetSizes: [{ label: "25 seeds", seedCount: 25 }],
      provenance: {
        source_url: productUrl,
        retrieved_at: "2026-11-20T08:00:00.000Z",
        method: "human" as const,
        confidence: 0.95,
      },
      sourceLabel: null,
    };
  });
  return {
    slug: item.slug,
    name: item.name,
    type: item.type,
    location: item.location,
    region: item.region,
    country: item.country,
    homepage: `https://www.${item.slug}.example.com`,
    ratingCount: 0,
    ratingAverage: null,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    importedRating: null,
    isSmallFarm: item.isSmallFarm,
    description: `${item.name} is a synthesized parity seller in Columbus, Ohio.`,
    orderingNotes: null,
    varietyCount: listings.length,
    updatedAt: "2026-11-15T00:00:00.000Z",
    claimStatus: "unclaimed",
    shipsTo: ["US"],
    isSiteOwner: false,
    listings,
    customerServicePhone: null,
    customerServiceEmail: null,
    locations: [],
  };
}

/** The full parity fixture state: shop/hub catalog + testbloom entries + Ohio + coherent reads. */
export function parityCatalogState(): FakeCatalogState {
  const state = shopCatalogState();

  const varieties: ApiVarietyListItem[] = [];
  for (let nn = 1; nn <= 50; nn++) varieties.push(testbloomVariety(nn));
  state.listItems = [...state.listItems, ...varieties];

  // All 24 grafted sellers relocate to Ohio (region + location rewritten
  // together — never one without the other), plus the 25th: Ohio carries
  // exactly 25 sellers, so /state/ohio?page=2 exists with one seller.
  const sellers: ApiSellerItem[] = [];
  for (let nn = 1; nn <= 24; nn++) {
    const relocated = testbloomSeller(nn);
    relocated.location = "Columbus, OH";
    relocated.region = "OH";
    sellers.push(relocated);
  }
  sellers.push(testbloomSeller25());
  state.sellers = [...state.sellers, ...sellers];

  state.crops = [...state.crops, structuredClone(TESTBLOOM_CROP)];
  state.seriesCatalog = [...state.seriesCatalog, { ...TESTBLOOM_SERIES }];

  // Coherent detail reads for every grafted row (sellers first — variety
  // listings reference them).
  for (const seller of sellers) {
    state.sellerDetails[seller.slug] = synthesizedSellerDetail(seller, varieties, 9000 + sellers.indexOf(seller) * 2);
  }
  for (const variety of varieties) {
    state.details[variety.slug] = synthesizedDetail(variety, sellers, 8000 + varieties.indexOf(variety) * 4);
  }

  // Snapshot rows for every grafted entry (membership + segmentation read
  // these): one variety row each, one seller row each, one listing row per
  // with-seller variety, and the crop + series rows the sitemap needs.
  const varietyRows = varieties.map((v, i) => ({ id: 100 + i, slug: v.slug, indexable: true, updated_seq: 100 + i }));
  const sellerRows = sellers.map((s, i) => ({
    id: 100 + i,
    slug: s.slug,
    region: s.region,
    country: s.country,
    updated_seq: 200 + i,
  }));
  const listingRows = varieties
    .filter((v) => v.sellerCount > 0)
    .map((v, i) => ({ id: 1000 + i, variety_id: 100 + varieties.indexOf(v), seller_id: 1 }));
  state.snapshot = {
    ...state.snapshot,
    varieties: [...state.snapshot.varieties, ...varietyRows],
    sellers: [...state.snapshot.sellers, ...sellerRows],
    listings: [...state.snapshot.listings, ...listingRows],
    crops: [...state.snapshot.crops, { id: 4, slug: TESTBLOOM_CROP.slug, updated_seq: 15 }],
    series: [...state.snapshot.series, { id: 4, slug: TESTBLOOM_SERIES.slug, updated_seq: 16 }],
  };
  return state;
}

/** The Ohio seller slugs in served (lower(name), slug) order — the crawl's paginated-state proof. */
export function ohioSellerSlugs(): string[] {
  const sellers: ApiSellerItem[] = [];
  for (let nn = 1; nn <= 24; nn++) {
    const relocated = testbloomSeller(nn);
    relocated.location = "Columbus, OH";
    relocated.region = "OH";
    sellers.push(relocated);
  }
  sellers.push(testbloomSeller25());
  return sellers
    .slice()
    .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0))
    .map((s) => s.slug);
}
