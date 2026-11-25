/**
 * API shapes consumed by the Slice 2 read path. The new app reads the catalog
 * through the existing public HTTP API (the architecture brief's "one backend"
 * rule: the same JSON the HTTP API returns) — these are the minimal slices of
 * those payloads this slice needs, with runtime guards in api.ts. Field names
 * follow the API (camelCase on typed endpoints, snake_case on /sync/*).
 */

/** The standard envelope: { data, page, meta, error } (v2 lib/api/http.ts). */
export interface ApiEnvelope<T> {
  data: T;
  page: { next_cursor: string | null; has_more: boolean };
  meta: {
    nextCursor: string | null;
    count: number;
    total?: number;
    catalog_seq?: number;
    generated_at: string;
  };
  error: null | { code: string; message: string };
}

/**
 * One crop with its coverage counts (GET /api/v1/crops item — the
 * CropListItem's plant half plus coverage; the category the live shape
 * carries is not read by any template and stays unmodeled).
 */
export interface ApiCrop {
  slug: string;
  commonName: string;
  latinName: string | null;
  /** The crop's life-cycle text; filter buckets derive via lifeCycleBuckets(). */
  lifeCycle: string | null;
  season_class: ApiSeasonClass | null;
  sowing_methods: ApiSowingMethod[];
  varietyCount: number;
  varietiesWithSellers: number;
  lastUpdated: string | null;
  media: { url: string }[];
}

/** One coverage row (GET /api/v1/coverage item). */
export interface ApiCoverageItem {
  crop: { slug: string; name: string };
  varieties: number;
  varieties_with_sellers: number;
  last_updated: string | null;
}

/** Listing availability word (GET /api/v1/recent listing field). */
export type ApiAvailability = "in_stock" | "sold_out" | "preorder" | "shop_closed" | "unknown";

/** One recent listing event (GET /api/v1/recent item). */
export interface ApiRecentItem {
  event: "first_seen" | "restocked" | "sold_out" | "gone" | "restored";
  at: string;
  listing: {
    id: number;
    availability: ApiAvailability;
    variety: { slug: string; varietyName: string; plant: { commonName: string } };
    seller: { slug: string; name: string };
  };
}

/** A seller's kind (v2's SELLER_TYPES, verbatim). */
export type ApiSellerType = "wholesale" | "retail" | "specialty";

/**
 * One seller row (GET /api/v1/sellers item — the SellerSummary slice the
 * seller index card renders, plus the list's variety count).
 */
export interface ApiSellerItem {
  slug: string;
  name: string;
  type: ApiSellerType;
  location: string | null;
  region: string | null;
  country: string;
  varietyCount: number;
  /** Visitor ratings submitted; the display stays "Not yet rated" (R7). */
  ratingCount: number;
  /** The seller carries the "Small farm" badge. */
  isSmallFarm: boolean;
}

/** A US state with at least one visible seller (the /seller state cloud). */
export interface ApiSellerState {
  /** USPS code, = seller.region */
  code: string;
  name: string;
  slug: string;
  sellerCount: number;
}

/** Per-option seller counts for the /seller State cloud. */
export interface ApiSellerBrowseCounts {
  all: number;
  options: Record<string, number>;
}

/** One search hit (GET /api/v1/search item — v2's SearchResult, verbatim). */
export interface ApiSearchResult {
  type: "variety" | "series" | "crop" | "seller";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  /** Set when the match came through a synonym: "also sold as {alias}". */
  matchedAlias: string | null;
}

/**
 * GET /api/v1/search response: the flat ranked list (autocomplete) plus the
 * grouped layout (the /search page). Group caps are the live service's (50
 * varieties, 5 per other group at limit 50).
 */
export interface ApiSearchResponse {
  query: string;
  /** Flat, ranked list (autocomplete). */
  results: ApiSearchResult[];
  varieties: ApiSearchResult[];
  series: ApiSearchResult[];
  crops: ApiSearchResult[];
  sellers: ApiSearchResult[];
}

/**
 * The series fields the /search read-side filter needs (GET
 * /api/v1/series/[slug] subset — the same names as the full SeriesDetail,
 * the Slice 2 minimal-slice pattern, not a second shape).
 */
export interface ApiSeriesCrop {
  slug: string;
  name: string;
  plant: ApiPlantRef;
}

/**
 * Per-option counts for the /variety browse filters (v2's BrowseCounts,
 * verbatim): every chip's count under the current state — each group's
 * "All" with that group cleared, each option with that option applied
 * (hue: toggled from its current state), every other group held. The app
 * computes these read-side over one walked set; the /api/browse endpoints
 * that serve them in v2 are internal Next routes, not public API.
 */
export interface ApiBrowseCounts {
  season: { all: number; options: { cool: number; warm: number } };
  method: { all: number; options: { direct: number; trays: number } };
  lifeCycle: { all: number; options: { annual: number; biennial: number; perennial: number } };
  hue: {
    all: number;
    options: Record<
      | "white" | "blush" | "pink" | "peach" | "orange" | "yellow" | "red" | "burgundy" | "purple" | "blue" | "green"
      | "chocolate" | "mix",
      number
    >;
  };
  smallFarm: { all: number; on: number };
}

/** Catalog totals for the coverage line and llms.txt. */
export interface CatalogCounts {
  varieties: number;
  plants: number;
  sellers: number;
  listings: number;
}

/**
 * The bulk snapshot (GET /api/v1/sync/snapshot, returned raw — no envelope).
 * The sitemap's membership/segmentation source: live slugs, visibility, and
 * per-row updated_seq for lastmod verification. Only the fields the sitemap
 * and counts read are modeled here.
 */
export interface SyncSnapshotData {
  catalog_seq: number;
  schema_version: number;
  generated_at: string;
  crops: { id: number; slug: string; updated_seq: number }[];
  series: { id: number; slug: string; updated_seq: number }[];
  varieties: { id: number; slug: string; indexable: boolean; updated_seq: number }[];
  sellers: { id: number; slug: string; region: string | null; country: string; updated_seq: number }[];
  listings: { id: number; variety_id: number; seller_id: number }[];
}

/** One verified lastmod entry: the date plus the seq that verified it. */
export interface LastmodEntry {
  updated_at: string;
  updated_seq: number;
}

/**
 * The committed lastmod cache (src/data/sitemap-lastmod.json, generated by
 * `npm run gen:sitemap-lastmod`). A date is emitted for a URL only when its
 * stored seq still equals the live snapshot's seq for that row — a stale
 * cache entry omits the date, it never emits a wrong one.
 */
export interface LastmodCache {
  generated_at: string;
  catalog_seq: number;
  varieties: Record<string, LastmodEntry>;
  sellers: Record<string, LastmodEntry>;
  series: Record<string, LastmodEntry>;
}

/**
 * Variety-detail shapes (Slice 3). The same JSON the live API serves:
 * GET /api/v1/varieties/[slug] returns the full VarietyDetail (listings
 * included — the detail endpoint is the variety page's one read), and
 * GET /api/v1/varieties returns pages of VarietyListItem. Field names follow
 * the API (camelCase entity fields; snake_case on facts/provenance/rating —
 * v2's documented casing split). Runtime guards in api.ts. No price field
 * exists anywhere: prices are stored, never shown (R1).
 */

/** One packet size: label and seed count only. */
export interface ApiPacketSize {
  label: string;
  seedCount: number | null;
}

/** A seller as carried on a listing (badge flag included). */
export interface ApiSellerRef {
  slug: string;
  name: string;
  location: string | null;
  region: string | null;
  country: string;
  /** The seller carries the "Small farm" badge. */
  isSmallFarm: boolean;
}

/** One own-work illustration (media table row). */
export interface ApiMedia {
  url: string;
  licence: string;
  credit: string;
  /** Deprecated, no longer populated; kept optional for compatibility. */
  thumbUrl?: string;
}

export type ApiSeasonClass = "cool_season_hardy_annual" | "warm_season_tender_annual";
export type ApiSowingMethod = "direct_sow" | "transplant";
export type ApiPollination = "open_pollinated" | "f1_hybrid" | "unknown";
export type ApiProtection = "pvp_us" | "utility_patent_us" | "pbr" | "none_stated" | "unknown";
export type ApiContentLevel = "thin" | "factual";
export type ApiMatchMethod = "exact" | "synonym" | "model" | "human";

/** A crop as carried on variety payloads. */
export interface ApiPlantRef {
  slug: string;
  commonName: string;
  latinName: string | null;
  lifeCycle: string | null;
  season_class: ApiSeasonClass | null;
  season_source_label: string | null;
  sowing_methods: ApiSowingMethod[];
  sowing_method_source_label: string | null;
}

/** A crop with its guidance prose (the variety-detail form). */
export interface ApiPlantGuidance extends ApiPlantRef {
  description: string | null;
  sowingNotes: string | null;
}

/** "Not yet rated" is a stored state; the average is null until rated. */
export interface ApiRating {
  state: "not_yet_rated" | "rated";
  average: number | null;
  review_count: number;
}

/** Every listing carries its provenance. */
export interface ApiProvenance {
  source_url: string | null;
  /** = listing.last_checked_at */
  retrieved_at: string | null;
  method: ApiMatchMethod;
  confidence: number;
}

/** A variety as carried on a listing. */
export interface ApiVarietyRef {
  slug: string;
  varietyName: string;
  plant: ApiPlantRef;
  colorSwatch: string | null;
  colorFamily: string;
  /** The variety's own plates, media-id order; [] when none, never omitted. */
  media: ApiMedia[];
  /** Its crop's plates; [] when none, never omitted. */
  cropMedia: ApiMedia[];
}

/** The ONE public listing shape — variety pages, seller pages, listings endpoints. */
export interface ApiPublicListing {
  id: number;
  variety: ApiVarietyRef;
  seller: ApiSellerRef;
  availability: ApiAvailability;
  lastCheckedAt: string | null;
  firstSeenAt: string | null;
  /** Outbound click route: logs the click and 302s to the farm's page. */
  goUrl: string;
  productUrl: string | null;
  notes: string | null;
  status: "published";
  packetSizes: ApiPacketSize[];
  provenance: ApiProvenance;
  sourceLabel: string | null;
}

export interface ApiCategoryRef {
  slug: string;
  name: string;
}

export interface ApiSeriesRef {
  slug: string;
  name: string;
}

/** A variety in a list or summary: counts are live, sellers distinct. */
export interface ApiVarietySummary {
  slug: string;
  varietyName: string;
  plant: ApiPlantRef;
  category: ApiCategoryRef;
  subcategory: ApiCategoryRef | null;
  series: ApiSeriesRef | null;
  colorSwatch: string | null;
  colorFamily: string;
  /** Published listings from approved sellers. */
  listingCount: number;
  /** Distinct sellers behind listingCount. */
  sellerCount: number;
  inStockCount: number;
  /** Latest last_checked_at across its listings; null with no listings. */
  lastCheckedAt: string | null;
  indexable: boolean;
  rating: ApiRating;
}

/** Variety facts: unknown is explicit ("unknown" or null, never omitted). */
export interface ApiVarietyFacts {
  color_family: string;
  pollination: ApiPollination;
  height_cm: { min: number | null; max: number | null };
  days_to_bloom: { min: number | null; max: number | null };
}

/** GET /api/v1/varieties/[slug]: the summary plus prose, facts, listings, media. */
export interface ApiVarietyDetail extends ApiVarietySummary {
  plant: ApiPlantGuidance;
  description: string | null;
  /** Deterministic text built only from sourced structured facts. */
  templateDescription: string;
  /** Answer sentence built only from data. */
  answer: string;
  sowingNotes: string | null;
  heightCm: number | null;
  facts: ApiVarietyFacts;
  tags: string[];
  aliases: string[];
  protection: ApiProtection;
  protectionNote: string | null;
  contentLevel: ApiContentLevel;
  updatedAt: string;
  /** In-stock first, then by seller name. */
  listings: ApiPublicListing[];
  /** Ordered by media id; [] when the variety has none (never omitted). */
  media: ApiMedia[];
}

/** A variety in a list (GET /api/v1/varieties item): summary plus media. */
export interface ApiVarietyListItem extends ApiVarietySummary {
  media: ApiMedia[];
  cropMedia: ApiMedia[];
}

/**
 * The merged-variety lookup (GET /api/internal/variety-status/[slug], served
 * by the app's own Worker in production — Slice 9 mount — and by the test
 * stub in this tree; v2's /api/internal/seller-status/[slug] is the
 * precedent). Merged slugs name their survivor; anything else is active or
 * unknown. Always 200: it is a lookup, not a fetch.
 */
export interface ApiVarietyStatus {
  status: "active" | "merged" | "unknown";
  merged_into: string | null;
}

/**
 * The seller fields the OG card reads (GET /api/v1/sellers/[slug] subset —
 * the same names as the full SellerDetail, the Slice 2 minimal-slice
 * pattern, not a second shape).
 */
export interface ApiOgSeller {
  slug: string;
  name: string;
  location: string | null;
  varietyCount: number;
}

/**
 * Shop/hub detail shapes (Slice 5). The same JSON the live API serves:
 * GET /api/v1/sellers/[slug] returns the full SellerDetail (listings
 * included — the shop page's one read, paginated read-side); GET
 * /api/v1/crops/[slug] returns the CropDetail with a paged varieties window
 * (meta.total is the full count — the hub walks and filters read-side);
 * GET /api/v1/series/[slug] returns the full SeriesDetail. Field names
 * follow the API (camelCase entity fields; the crop's life_cycle/hardiness
 * and grower_guide keep v2's snake_case). No price field exists anywhere:
 * prices are stored, never shown (R1).
 */

/** A seller's kind of place (v2's SELLER_LOCATION_KINDS, verbatim). */
export type ApiSellerLocationKind = "physical" | "warehouse" | "mailing";

/**
 * One qualifying recorded location (the set the shop page's Locations area
 * renders, in §5.2 order: primary first, then kind, state, city).
 */
export interface ApiSellerLocation {
  kind: ApiSellerLocationKind;
  street: string | null;
  city: string;
  state: string;
  zip: string | null;
  isPrimary: boolean;
}

/** Third-party aggregate (e.g. Google) shown apart from our own rating. */
export interface ApiImportedRating {
  source: "Google";
  placeName: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  /** YYYY-MM-DD the aggregate was fetched. */
  fetchedDate: string;
}

/**
 * GET /api/v1/sellers/[slug]: the SellerSummary slice plus prose, the full
 * listing set, the published customer-service contacts, and the qualifying
 * recorded locations. Removed sellers 410 at the API (gone) and resolve
 * through sellerStatus, below.
 */
export interface ApiSellerDetail {
  slug: string;
  name: string;
  type: ApiSellerType;
  location: string | null;
  region: string | null;
  country: string;
  homepage: string | null;
  ratingCount: number;
  /** Always null until real ratings exist (R7). */
  ratingAverage: number | null;
  rating: ApiRating;
  /** Never omitted: null when no third-party rating was imported. */
  importedRating: ApiImportedRating | null;
  /** The seller carries the "Small farm" badge. */
  isSmallFarm: boolean;
  description: string | null;
  orderingNotes: string | null;
  varietyCount: number;
  updatedAt: string;
  claimStatus: "unclaimed" | "claimed";
  shipsTo: string[];
  /** True only for Hues itself (disclosure). */
  isSiteOwner: boolean;
  listings: ApiPublicListing[];
  /** The published customer-service phone (display form); null when unpublished. Never omitted. */
  customerServicePhone: string | null;
  /** The published customer-service email, in full; null when unpublished. Never omitted. */
  customerServiceEmail: string | null;
  /** The seller's qualifying recorded locations, in §5.2 order; [] when none. */
  locations: ApiSellerLocation[];
}

/**
 * The removed-seller lookup (GET /api/internal/seller-status/[slug] —
 * v2's shipped precedent): "ok" (visible), "gone" (removed at the
 * seller's request → 410), or "missing" (→ 404). Always 200: it is a
 * lookup, not a fetch.
 */
export interface ApiSellerStatus {
  status: "ok" | "gone" | "missing";
}

/** A crop's grower guide (null fields = not known; a null section = no content). */
export interface ApiGrowerGuide {
  growing: {
    sowing: string | null;
    germination: string | null;
    transplanting: string | null;
    days_to_bloom: string | null;
    spacing: string | null;
    growing: string | null;
    /** Harvesting for the vase; null when the content has none. */
    harvest_for_cutting: string | null;
    /** Short closing notes; [] when none. */
    good_to_know: string[];
  } | null;
  seed_saving: {
    /** As written in the content (e.g. "easy", "moderate"). */
    difficulty: string | null;
    when_to_harvest: string | null;
    how_to_collect: string | null;
    cleaning: string | null;
    drying: string | null;
    storage: string | null;
    pollination_notes: string | null;
  } | null;
}

/**
 * GET /api/v1/crops/[slug]: the crop list fields plus guidance prose,
 * life-cycle/hardiness facts, the grower guide, the crop's series, and the
 * varieties WINDOW for the requested page (meta.total is the full count).
 */
export interface ApiCropDetail {
  slug: string;
  commonName: string;
  latinName: string | null;
  lifeCycle: string | null;
  season_class: ApiSeasonClass | null;
  sowing_methods: ApiSowingMethod[];
  varietyCount: number;
  varietiesWithSellers: number;
  lastUpdated: string | null;
  media: { url: string }[];
  description: string | null;
  sowingNotes: string | null;
  /** e.g. "Annual", "Hardy annual"; null when not known. */
  life_cycle: string | null;
  /** e.g. "Hardy annual — seedlings tolerate light frost."; null when not known. */
  hardiness: string | null;
  /** Null when the crop has no grower content. */
  grower_guide: ApiGrowerGuide | null;
  series: ApiSeriesRef[];
  /** The requested page's window (resting Name A–Z from the API). */
  varieties: ApiVarietyListItem[];
}

/** GET /api/v1/series/[slug]: the series, its crop, and ALL its varieties. */
export interface ApiSeriesDetail {
  slug: string;
  name: string;
  plant: ApiPlantRef;
  varietyCount: number;
  varietiesWithSellers: number;
  varieties: ApiVarietyListItem[];
}

/**
 * Per-option result counts for the crop-detail filters (v2's
 * CropDetailCounts, verbatim): sellers tri-state, hue options, series
 * options. The app computes these read-side over one walked set; the
 * /api/browse endpoints that serve them in v2 are internal Next routes,
 * not public API.
 */
export interface ApiCropDetailCounts {
  sellers: { all: number; has: number; none: number };
  hue: { all: number; options: Record<string, number> };
  series: { all: number; options: Record<string, number> };
}

/** One OpenAPI operation parameter (GET /api/v1/openapi.json). */
export interface OpenApiParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface OpenApiOperation {
  summary?: string;
  parameters?: OpenApiParam[];
}

/** The endpoint inventory slice of the OpenAPI document (the api-docs source). */
export interface OpenApiDoc {
  info: { description: string; version: string };
  paths: Record<string, { get?: OpenApiOperation; post?: OpenApiOperation }>;
}
