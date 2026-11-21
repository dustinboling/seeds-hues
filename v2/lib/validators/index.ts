/**
 * Zod schemas — single source of truth for repository/service outputs AND the /api/v1 contract
 * (OpenAPI 3.1 is generated from these in lib/api/openapi.ts).
 *
 * Delta (canonical spec 2026-11-16):
 *  - R1: NO price field exists in any public schema (prices are stored, never shown).
 *  - Every listing carries `provenance`; every variety and seller carries `rating`.
 *  - Unknown is explicit: enums are "unknown", numbers null — never omitted.
 *  - Casing: pre-existing entity fields stay camelCase (additive-only change). Objects and
 *    endpoints introduced by the canonical spec use its snake_case names (rating, provenance,
 *    facts, page, coverage, recent, sync) — see DELTA-REPORT.md "Divergences".
 */
import { z } from "zod";
import {
  AVAILABILITY,
  CLAIM_STATUS,
  CONTENT_LEVELS,
  IMPORTED_RATING_SOURCES,
  LISTING_EVENT,
  MATCH_METHOD,
  POLLINATION,
  PROTECTION,
  SEASON_CLASSES,
  SELLER_TYPES,
  SOWING_METHODS,
} from "@/lib/db/schema";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slug");
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const httpUrl = z.string().url().refine((u) => /^https?:\/\//.test(u), "http(s) URL");
const dateish = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "ISO date or timestamp");

export const AvailabilitySchema = z.enum(AVAILABILITY).meta({ id: "Availability" });

export const RatingSchema = z
  .object({
    state: z.enum(["not_yet_rated", "rated"]),
    average: z.number().min(1).max(5).nullable(),
    review_count: z.number().int().nonnegative(),
  })
  .refine((r) => (r.state === "not_yet_rated" ? r.average === null : r.review_count >= 3 && r.average !== null), {
    message: "an average exists only once a subject is rated (≥ 3 reviews)",
  })
  .meta({ id: "Rating", description: '"Not yet rated" is a stored state; the average is null until rated.' });

export const ProvenanceSchema = z
  .object({
    source_url: httpUrl.nullable(),
    /** = listing.last_checked_at */
    retrieved_at: dateish.nullable(),
    method: z.enum(MATCH_METHOD),
    confidence: z.number().min(0).max(1),
  })
  .meta({ id: "Provenance" });

export const CategoryRefSchema = z.object({ slug, name: z.string().min(1) }).meta({ id: "CategoryRef" });

export const SeasonClassSchema = z.enum(SEASON_CLASSES).meta({
  id: "SeasonClass",
  description: "Crop season class (The Gardener's Workshop seed categories). null = not classified.",
});

/** Display labels for season classes (UI + docs). */
export const SEASON_LABELS: Record<z.infer<typeof SeasonClassSchema>, string> = {
  cool_season_hardy_annual: "Cool Season Hardy Annuals",
  warm_season_tender_annual: "Warm Season Tender Annuals",
};

/** Short query-param values (`?season=cool|warm`) ↔ season classes. */
export const SEASON_PARAMS = { cool: "cool_season_hardy_annual", warm: "warm_season_tender_annual" } as const;
export type SeasonParam = keyof typeof SEASON_PARAMS;

export const SowingMethodSchema = z.enum(SOWING_METHODS).meta({
  id: "SowingMethod",
  description: "How a crop is sown (Floret Library sowing notes): direct_sow and/or transplant (start indoors).",
});

/** Display labels for sowing methods (UI + docs). */
export const SOWING_METHOD_LABELS: Record<z.infer<typeof SowingMethodSchema>, string> = {
  direct_sow: "Direct Sow",
  transplant: "Start indoors",
};

/** Short query-param values (`?method=direct|trays`) ↔ sowing methods. */
export const METHOD_PARAMS = { direct: "direct_sow", trays: "transplant" } as const;
export type MethodParam = keyof typeof METHOD_PARAMS;

/**
 * Life-cycle filter buckets (`?life_cycle=annual|biennial|perennial`): how the crop is grown,
 * derived from plants.life_cycle by lifeCycleBuckets() in lib/life-cycle.ts (never stored).
 */
export const LIFE_CYCLE_PARAMS = ["annual", "biennial", "perennial"] as const;
export type LifeCycleParam = (typeof LIFE_CYCLE_PARAMS)[number];
export const LIFE_CYCLE_LABELS: Record<LifeCycleParam, string> = { annual: "Annual", biennial: "Biennial", perennial: "Perennial" };

/**
 * Variety colour families ("Hue") — the ONE vocabulary for catalog input, filters and UI.
 * varieties.color_family also holds 'unknown' (the column default), which is never an input
 * value: a variety without a family is simply unknown.
 */
export const COLOR_FAMILIES = [
  "white",
  "blush",
  "pink",
  "peach",
  "orange",
  "yellow",
  "red",
  "burgundy",
  "purple",
  "blue",
  "green",
  "chocolate",
  "mix",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** Representative swatch per colour family (UI chips). mix = null: drawn as a conic gradient. */
export const COLOR_FAMILY_SWATCHES: Record<ColorFamily, string | null> = {
  white: "#F7F3E8",
  blush: "#F2C4CE",
  pink: "#E87A9E",
  peach: "#F5A97F",
  orange: "#E8813A",
  yellow: "#EFC93F",
  red: "#C03434",
  burgundy: "#7A2440",
  purple: "#8B6BAE",
  blue: "#5B7FBF",
  green: "#7A9A4D",
  chocolate: "#6B4A35",
  mix: null,
};

/** Display labels for colour families (chips + result lines). */
export const COLOR_FAMILY_LABELS: Record<ColorFamily, string> = {
  white: "White",
  blush: "Blush",
  pink: "Pink",
  peach: "Peach",
  orange: "Orange",
  yellow: "Yellow",
  red: "Red",
  burgundy: "Burgundy",
  purple: "Purple",
  blue: "Blue",
  green: "Green",
  chocolate: "Chocolate",
  mix: "Mixed",
};

export const PlantRefSchema = z
  .object({
    slug,
    commonName: z.string().min(1),
    latinName: z.string().min(1).nullable(),
    season_class: SeasonClassSchema.nullable(),
    /** Label of the source the season class came from; null when unclassified. */
    season_source_label: z.string().nullable(),
    /** How the crop is sown, canonical order (direct_sow, transplant); [] = not classified. */
    sowing_methods: z.array(SowingMethodSchema),
    /** Label of the source the sowing methods came from; null when there are none. */
    sowing_method_source_label: z.string().nullable(),
  })
  .meta({ id: "PlantRef", description: "A crop (canonical name for what v2 calls a plant)." });

export const SeriesRefSchema = z.object({ slug, name: z.string().min(1) }).meta({ id: "SeriesRef" });

export const PacketSizeSchema = z
  .object({ label: z.string().min(1), seedCount: z.number().int().positive().nullable() })
  .meta({ id: "PacketSize", description: "Packet label and seed count. Prices are never exposed (R1)." });

export const SellerRefSchema = z
  .object({
    slug,
    name: z.string().min(1),
    location: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().min(2),
    /** The seller carries the "Small farm" badge (a recorded judgment call, not a measured size). */
    isSmallFarm: z.boolean(),
  })
  .meta({ id: "SellerRef" });

/**
 * Own-work illustration (media table), shared by varieties and crops. `url` is media.r2_key as
 * stored: for artwork served from the app's public assets that is the public path, e.g.
 * /artwork/<file>.webp (variety) or /artwork/crops/<plant-slug>.webp (crop). Pages render it
 * through lib/images (R2 original + on-the-fly transformation at images.seeds.hues.flowers).
 * `thumbUrl` is DEPRECATED and no longer populated (since the 2026-11-18 image migration card
 * sizes are transformations of `url`); it stays optional so the API contract is backward-compatible.
 */
export const MediaSchema = z
  .object({
    url: z.string().min(1),
    licence: z.string().min(1),
    credit: z.string().min(1),
    /** Deprecated: no longer populated (2026-11-18); kept optional for backward compatibility. */
    thumbUrl: z
      .string()
      .min(1)
      .optional()
      .meta({ deprecated: true, description: "Deprecated; no longer populated. Card sizes are transformations of `url`." }),
  })
  .meta({ id: "Media" });

export const VarietyRefSchema = z
  .object({
    slug,
    varietyName: z.string().min(1),
    plant: PlantRefSchema,
    colorSwatch: hex.nullable(),
    /** The variety's own plates, media-id order; [] when none, never omitted. */
    media: z.array(MediaSchema),
    /** Its plant's (crop's) plates, media-id order; [] when none, never omitted. */
    cropMedia: z.array(MediaSchema),
  })
  .meta({ id: "VarietyRef" });

/** The ONE public listing shape — variety pages, seller pages, listings endpoints, /recent, /sync. */
export const PublicListingSchema = z
  .object({
    id: z.number().int().positive(),
    variety: VarietyRefSchema,
    seller: SellerRefSchema,
    availability: AvailabilitySchema,
    lastCheckedAt: dateish.nullable(),
    firstSeenAt: dateish.nullable(),
    /** Outbound click route: logs the click and 302s to the farm's page with UTM tags. */
    goUrl: httpUrl,
    productUrl: httpUrl.nullable(),
    notes: z.string().nullable(),
    status: z.literal("published"),
    packetSizes: z.array(PacketSizeSchema),
    provenance: ProvenanceSchema,
    /** Label of the curated source record (shown when provenance.source_url is null). */
    sourceLabel: z.string().nullable(),
  })
  .meta({ id: "Listing" });

/**
 * A third-party aggregate rating imported for a seller (brief #4). It is NOT our rating: our own
 * `rating` stays "not_yet_rated", and this never feeds it, ratingAverage or structured data.
 * The source exposes the aggregate and count only — there is no review text.
 */
export const ImportedRatingSchema = z
  .object({
    source: z.enum(IMPORTED_RATING_SOURCES),
    placeName: z.string().min(1),
    placeId: z.string().min(1),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().int().nonnegative(),
    /** YYYY-MM-DD the aggregate was fetched. */
    fetchedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .meta({
    id: "ImportedRating",
    description: "Third-party aggregate (e.g. Google) shown separately from our rating; null when none was imported.",
  });

export const SellerSummarySchema = z
  .object({
    slug,
    name: z.string().min(1),
    type: z.enum(SELLER_TYPES),
    location: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().min(2),
    homepage: httpUrl.nullable(),
    ratingCount: z.number().int().nonnegative(),
    /** Always null until real ratings exist (R7). */
    ratingAverage: z.number().min(1).max(5).nullable(),
    rating: RatingSchema,
    /** Never omitted: null when no third-party rating was imported. */
    importedRating: ImportedRatingSchema.nullable(),
    /** The seller carries the "Small farm" badge (a recorded judgment call, not a measured size). */
    isSmallFarm: z.boolean(),
  })
  .refine((s) => s.ratingCount > 0 || s.ratingAverage === null, {
    message: "ratingAverage must be null while ratingCount is 0",
  })
  .meta({ id: "SellerSummary" });

export const VarietySummarySchema = z
  .object({
    slug,
    varietyName: z.string().min(1),
    plant: PlantRefSchema,
    category: CategoryRefSchema,
    subcategory: CategoryRefSchema.nullable(),
    series: SeriesRefSchema.nullable(),
    colorSwatch: hex.nullable(),
    colorFamily: z.string().min(1),
    /** Published listings from approved sellers. */
    listingCount: z.number().int().nonnegative(),
    inStockCount: z.number().int().nonnegative(),
    /** Latest last_checked_at across its listings; null with no listings. */
    lastCheckedAt: dateish.nullable(),
    indexable: z.boolean(),
    rating: RatingSchema,
  })
  .meta({ id: "VarietySummary" });

export const PlantGuidanceSchema = PlantRefSchema.extend({
  description: z.string().nullable(),
  sowingNotes: z.string().nullable(),
}).meta({ id: "PlantGuidance" });

const range = z.object({ min: z.number().int().nullable(), max: z.number().int().nullable() });

export const VarietyFactsSchema = z
  .object({
    color_family: z.string().min(1),
    pollination: z.enum(POLLINATION),
    height_cm: range,
    days_to_bloom: range,
  })
  .meta({ id: "VarietyFacts", description: 'Unknown is explicit: "unknown" or null, never omitted.' });

/**
 * A variety in a list (/varieties, crop/series/category details): the summary plus its media,
 * ordered by media id ([] when none, never omitted). Media carries no thumbUrl; cards render
 * 480/768-wide transformations of `url` (lib/images).
 */
export const VarietyListItemSchema = VarietySummarySchema.extend({
  media: z.array(MediaSchema),
}).meta({ id: "VarietyListItem" });

/** Variety-path names kept for existing imports; same schema as MediaSchema. */
export const VarietyMediaSchema = MediaSchema;

export const VarietyDetailSchema = VarietySummarySchema.extend({
  plant: PlantGuidanceSchema,
  description: z.string().nullable(),
  /** Deterministic text built only from sourced structured facts; used when description is null. */
  templateDescription: z.string().min(1),
  /** Answer sentence built only from data (canonical §5 GEO). */
  answer: z.string().min(1),
  sowingNotes: z.string().nullable(),
  heightCm: z.number().int().positive().nullable(),
  facts: VarietyFactsSchema,
  tags: z.array(z.string()),
  aliases: z.array(z.string()),
  protection: z.enum(PROTECTION),
  protectionNote: z.string().nullable(),
  contentLevel: z.enum(CONTENT_LEVELS),
  updatedAt: z.string(),
  /** In-stock first, then by seller name. */
  listings: z.array(PublicListingSchema),
  /** Ordered by media id; [] when the variety has none (never null, never omitted). */
  media: z.array(MediaSchema),
}).meta({ id: "VarietyDetail" });

export const SellerListItemSchema = SellerSummarySchema.safeExtend({
  varietyCount: z.number().int().nonnegative(),
}).meta({ id: "SellerListItem" });

export const SellerDetailSchema = SellerSummarySchema.safeExtend({
  description: z.string().nullable(),
  orderingNotes: z.string().nullable(),
  varietyCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  claimStatus: z.enum(CLAIM_STATUS),
  shipsTo: z.array(z.string()),
  /** true only for Hues itself (disclosure). */
  isSiteOwner: z.boolean(),
  listings: z.array(PublicListingSchema),
}).meta({ id: "SellerDetail" });

/** A US state with at least one visible seller (/seller?state= chips, /state/{slug} pages). */
export const SellerStateSchema = z
  .object({
    /** USPS code, = seller.region */
    code: z.string().regex(/^[A-Z]{2}$/),
    name: z.string().min(1),
    slug,
    sellerCount: z.number().int().positive(),
  })
  .meta({ id: "SellerState" });

export const SubcategorySchema = CategoryRefSchema.extend({
  varietyCount: z.number().int().nonnegative(),
}).meta({ id: "Subcategory" });

export const CategorySchema = CategoryRefSchema.extend({
  varietyCount: z.number().int().nonnegative(),
  subcategories: z.array(SubcategorySchema),
}).meta({ id: "Category" });

export const CategoryDetailSchema = CategorySchema.extend({
  varieties: z.array(VarietyListItemSchema),
}).meta({ id: "CategoryDetail" });

export const CropListItemSchema = PlantRefSchema.extend({
  category: CategoryRefSchema,
  varietyCount: z.number().int().nonnegative(),
  varietiesWithSellers: z.number().int().nonnegative(),
  /** Latest variety update or listing check for this crop (YYYY-MM-DD); null when unknown. */
  lastUpdated: dateish.nullable(),
  /** Crop illustrations ordered by media id; [] when none (never omitted). */
  media: z.array(MediaSchema),
}).meta({ id: "CropListItem" });

const guideText = z.string().min(1).nullable();

/**
 * A crop's grower guide (crop-page grower guide task). Unknown is explicit: every field is
 * present, null when the content has none (never filled in); a section with no content is null.
 * No source attribution is carried (internal provenance only).
 */
export const GrowerGuideSchema = z
  .object({
    growing: z
      .object({
        sowing: guideText,
        germination: guideText,
        transplanting: guideText,
        days_to_bloom: guideText,
        spacing: guideText,
        growing: guideText,
        /** Harvesting for the vase; null when the content has none. */
        harvest_for_cutting: guideText,
        /** Short closing notes; [] when none. */
        good_to_know: z.array(z.string().min(1)),
      })
      .nullable(),
    seed_saving: z
      .object({
        /** As written in the content (e.g. "easy", "moderate"). */
        difficulty: guideText,
        when_to_harvest: guideText,
        how_to_collect: guideText,
        cleaning: guideText,
        drying: guideText,
        storage: guideText,
        pollination_notes: guideText,
      })
      .nullable(),
  })
  .meta({ id: "GrowerGuide", description: "Growing, harvest and seed-saving notes for a crop. null fields = not known." });

export const CropDetailSchema = CropListItemSchema.extend({
  description: z.string().nullable(),
  sowingNotes: z.string().nullable(),
  /** e.g. "Annual", "Hardy annual"; null when not known. */
  life_cycle: z.string().min(1).nullable(),
  /** e.g. "Hardy annual — seedlings tolerate light frost."; null when not known. */
  hardiness: z.string().min(1).nullable(),
  /** null when the crop has no grower content. */
  grower_guide: GrowerGuideSchema.nullable(),
  series: z.array(SeriesRefSchema),
  varieties: z.array(VarietyListItemSchema),
}).meta({ id: "CropDetail" });

export const SeriesDetailSchema = SeriesRefSchema.extend({
  crop: PlantRefSchema,
  varietyCount: z.number().int().nonnegative(),
  varietiesWithSellers: z.number().int().nonnegative(),
  varieties: z.array(VarietyListItemSchema),
}).meta({ id: "SeriesDetail" });

export const CoverageItemSchema = z
  .object({
    crop: z.object({ slug, name: z.string().min(1) }),
    varieties: z.number().int().nonnegative(),
    varieties_with_sellers: z.number().int().nonnegative(),
    last_updated: dateish.nullable(),
  })
  .meta({ id: "CoverageItem" });

export const RecentItemSchema = z
  .object({ event: z.enum(LISTING_EVENT), at: dateish, listing: PublicListingSchema })
  .meta({ id: "RecentItem" });

export const SEARCH_TYPES = ["variety", "series", "crop", "seller"] as const;

export const SearchResultSchema = z
  .object({
    type: z.enum(SEARCH_TYPES),
    slug,
    title: z.string().min(1),
    subtitle: z.string(),
    href: z.string().startsWith("/"),
    /** Set when the match came through a synonym: the UI shows "also sold as {alias}". */
    matchedAlias: z.string().nullable(),
  })
  .meta({ id: "SearchResult" });

export const SearchResponseSchema = z
  .object({
    query: z.string(),
    /** Flat, ranked list (autocomplete). */
    results: z.array(SearchResultSchema),
    varieties: z.array(SearchResultSchema),
    series: z.array(SearchResultSchema),
    crops: z.array(SearchResultSchema),
    sellers: z.array(SearchResultSchema),
  })
  .meta({ id: "SearchResponse" });

// ─── Sync (canonical §3 "Bulk sync for native apps"; snake_case, new in the delta) ─────────

export const SyncCropSchema = z
  .object({
    id: z.number().int(),
    slug,
    common_name: z.string(),
    latin_name: z.string().nullable(),
    category: z.string(),
    season_class: SeasonClassSchema.nullable(),
    season_source_id: z.number().int().nullable(),
    sowing_methods: z.array(SowingMethodSchema),
    sowing_method_source_id: z.number().int().nullable(),
    updated_seq: z.number().int(),
  })
  .meta({ id: "SyncCrop" });
export const SyncSeriesSchema = z
  .object({ id: z.number().int(), slug, name: z.string(), crop_id: z.number().int(), updated_seq: z.number().int() })
  .meta({ id: "SyncSeries" });
export const SyncVarietySchema = z
  .object({
    id: z.number().int(),
    slug,
    name: z.string(),
    crop_id: z.number().int(),
    series_id: z.number().int().nullable(),
    color_swatch: hex.nullable(),
    color_family: z.string(),
    pollination: z.enum(POLLINATION),
    height_cm: z.number().int().nullable(),
    days_to_bloom: range,
    indexable: z.boolean(),
    rating: RatingSchema,
    updated_seq: z.number().int(),
  })
  .meta({ id: "SyncVariety" });
export const SyncNameSchema = z
  .object({ variety_id: z.number().int(), name: z.string(), kind: z.string() })
  .meta({ id: "SyncName" });
export const SyncSellerSchema = z
  .object({
    id: z.number().int(),
    slug,
    name: z.string(),
    location: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string(),
    homepage: httpUrl.nullable(),
    ships_to: z.array(z.string()),
    claim_status: z.enum(CLAIM_STATUS),
    rating: RatingSchema,
    /** Third-party aggregate, separate from `rating`; null when none was imported. */
    imported_rating: z
      .object({
        source: z.enum(IMPORTED_RATING_SOURCES),
        place_name: z.string().min(1),
        place_id: z.string().min(1),
        rating: z.number().min(0).max(5),
        review_count: z.number().int().nonnegative(),
        fetched_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .nullable(),
    /** The seller carries the "Small farm" badge. */
    is_small_farm: z.boolean(),
    updated_seq: z.number().int(),
  })
  .meta({ id: "SyncSeller" });
export const SyncListingSchema = z
  .object({
    id: z.number().int(),
    variety_id: z.number().int(),
    seller_id: z.number().int(),
    availability: AvailabilitySchema,
    last_checked_at: dateish.nullable(),
    first_seen_at: dateish.nullable(),
    go_url: httpUrl,
    product_url: httpUrl.nullable(),
    provenance: ProvenanceSchema,
    updated_seq: z.number().int(),
  })
  .meta({ id: "SyncListing" });
export const SYNC_TYPES = ["crop", "series", "variety", "seller", "listing"] as const;
export const SyncDeleteSchema = z
  .object({ type: z.enum(SYNC_TYPES), id: z.number().int(), merged_into: z.number().int().optional() })
  .meta({ id: "SyncDelete" });
export const SyncSnapshotSchema = z
  .object({
    catalog_seq: z.number().int().nonnegative(),
    schema_version: z.number().int().positive(),
    generated_at: z.string(),
    crops: z.array(SyncCropSchema),
    series: z.array(SyncSeriesSchema),
    varieties: z.array(SyncVarietySchema),
    names: z.array(SyncNameSchema),
    sellers: z.array(SyncSellerSchema),
    listings: z.array(SyncListingSchema),
  })
  .meta({ id: "SyncSnapshot" });
export const SyncChangesSchema = z
  .object({
    upserts: z.object({
      crops: z.array(SyncCropSchema),
      series: z.array(SyncSeriesSchema),
      varieties: z.array(SyncVarietySchema),
      names: z.array(SyncNameSchema),
      sellers: z.array(SyncSellerSchema),
      listings: z.array(SyncListingSchema),
    }),
    deletes: z.array(SyncDeleteSchema),
    next_seq: z.number().int().nonnegative(),
    has_more: z.boolean(),
  })
  .meta({ id: "SyncChanges" });

export const CatalogVersionSchema = z
  .object({
    /** 0 means nothing has been published yet. */
    version: z.number().int().nonnegative(),
    publishedAt: z.string().nullable(),
    snapshotUrl: z.string().nullable(),
  })
  .meta({ id: "CatalogVersion" });

export const PageMetaSchema = z
  .object({
    nextCursor: z.string().nullable().optional(),
    /** Items in this response. */
    count: z.number().int().nonnegative().optional(),
    /** Items across all pages (list endpoints). */
    total: z.number().int().nonnegative().optional(),
    catalog_seq: z.number().int().nonnegative(),
    generated_at: z.string(),
  })
  .meta({ id: "PageMeta" });

export const PageSchema = z
  .object({ next_cursor: z.string().nullable(), has_more: z.boolean() })
  .meta({ id: "Page" });

export const ErrorCodeSchema = z.enum([
  "not_found",
  "gone",
  "validation_error",
  "rate_limited",
  "method_not_allowed",
  "unauthorized",
  "internal",
]);

export const ErrorBodySchema = z
  .object({
    data: z.null(),
    meta: z.null(),
    error: z.object({ code: ErrorCodeSchema, message: z.string() }),
  })
  .meta({ id: "ErrorResponse" });

export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    code: z.string(),
  })
  .meta({ id: "Problem", description: "application/problem+json (RFC 9457) with a stable `code`." });

export type Availability = z.infer<typeof AvailabilitySchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type CategoryRef = z.infer<typeof CategoryRefSchema>;
export type PlantRef = z.infer<typeof PlantRefSchema>;
export type SeasonClass = z.infer<typeof SeasonClassSchema>;
export type SowingMethod = z.infer<typeof SowingMethodSchema>;
export type SeriesRef = z.infer<typeof SeriesRefSchema>;
export type PacketSize = z.infer<typeof PacketSizeSchema>;
export type SellerRef = z.infer<typeof SellerRefSchema>;
export type VarietyRef = z.infer<typeof VarietyRefSchema>;
export type PublicListing = z.infer<typeof PublicListingSchema>;
export type SellerSummary = z.infer<typeof SellerSummarySchema>;
export type VarietySummary = z.infer<typeof VarietySummarySchema>;
export type VarietyFacts = z.infer<typeof VarietyFactsSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type VarietyListItem = z.infer<typeof VarietyListItemSchema>;
export type VarietyMedia = Media;
export type VarietyDetail = z.infer<typeof VarietyDetailSchema>;
export type SellerListItem = z.infer<typeof SellerListItemSchema>;
export type SellerDetail = z.infer<typeof SellerDetailSchema>;
export type ImportedRating = z.infer<typeof ImportedRatingSchema>;
export type SellerState = z.infer<typeof SellerStateSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type CategoryDetail = z.infer<typeof CategoryDetailSchema>;
export type CropListItem = z.infer<typeof CropListItemSchema>;
export type CropDetail = z.infer<typeof CropDetailSchema>;
export type GrowerGuide = z.infer<typeof GrowerGuideSchema>;
export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;
export type CoverageItem = z.infer<typeof CoverageItemSchema>;
export type RecentItem = z.infer<typeof RecentItemSchema>;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type CatalogVersion = z.infer<typeof CatalogVersionSchema>;
export type SyncSnapshot = z.infer<typeof SyncSnapshotSchema>;
export type SyncChanges = z.infer<typeof SyncChangesSchema>;
export type SyncDelete = z.infer<typeof SyncDeleteSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
