/**
 * seeds.hues.flowers v2 — D1 (SQLite) schema. Spec: V2-BUILD-SPEC-FINAL.md §2 + V2-BUILD-SPEC.md §3.1.
 *
 * Portability (§3.4): integer internal PKs (no hand-written AUTOINCREMENT), slugs are the only
 * public identifiers, integer cents, booleans via Drizzle boolean mode, ISO-8601 text timestamps,
 * enums as TEXT + CHECK constraints (map 1:1 to Postgres CHECK / enum types).
 */
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const SOURCE_KINDS = ["catalog", "shop-check", "research", "owner"] as const;
export const SOURCE_ACCESS = ["public", "login_gated"] as const;
export const VARIETY_STATUS = ["active", "draft", "discontinued", "merged"] as const;
export const POLLINATION = ["open_pollinated", "f1_hybrid", "unknown"] as const;
/** Crop season classes (The Gardener's Workshop seed categories). NULL = not classified. */
export const SEASON_CLASSES = ["cool_season_hardy_annual", "warm_season_tender_annual"] as const;
/** Crop sowing methods (Floret sowing notes). A crop has 0..2 rows in plant_sowing_methods. */
export const SOWING_METHODS = ["direct_sow", "transplant"] as const;
export const CONTENT_LEVELS = ["thin", "factual"] as const;
export const PROTECTION = ["pvp_us", "utility_patent_us", "pbr", "none_stated", "unknown"] as const;
export const SELLER_TYPES = ["wholesale", "retail", "specialty"] as const;
export const SELLER_STATUS = ["active", "inactive", "pending"] as const;
export const SELLER_PROVENANCE = ["owner-named", "research-candidate", "sourcing-check"] as const;
export const LISTING_POLICY = ["full", "no_prices", "removed"] as const;
export const SELLER_PLATFORMS = ["shopify", "woocommerce", "squarespace", "other"] as const;
/** Third-party aggregate ratings imported per seller (brief #4). Never our own rating. */
export const IMPORTED_RATING_SOURCES = ["Google"] as const;
/** Legacy curated values (active/inactive/unverified) + canonical §2 values. 'active' = published. */
export const LISTING_STATUS = [
  "active",
  "inactive",
  "unverified",
  "pending",
  "published",
  "stale",
  "gone",
  "rejected",
  "removed",
] as const;
/** Listing statuses that are publicly visible. */
export const VISIBLE_LISTING_STATUS = ["active", "published"] as const;
export const AVAILABILITY = ["in_stock", "sold_out", "preorder", "shop_closed", "unknown"] as const;
export const LISTING_CHANNEL = ["external", "marketplace", "fulfilled_by_hues"] as const;
export const MATCH_METHOD = ["exact", "synonym", "model", "human"] as const;
export const ELIGIBILITY = ["candidate", "approved", "rejected", "removed_by_request"] as const;
export const CRAWL_POLICY = ["feed", "html", "manual_only", "opted_out"] as const;
export const CLAIM_STATUS = ["unclaimed", "claimed"] as const;
export const NAME_KIND = ["primary", "synonym", "trade_name", "misspelling", "seller_alias"] as const;
export const LISTING_EVENT = ["first_seen", "restocked", "sold_out", "gone", "restored"] as const;
export const REPORT_TYPE = ["correct", "claim", "remove"] as const;
export const REPORT_TARGET = ["variety", "seller"] as const;
export const REPORT_STATUS = ["open", "resolved", "dismissed"] as const;
export const FETCH_KIND = ["web", "human", "seller"] as const;
export const OBSERVATION_STATUS = ["published", "queued", "rejected"] as const;
export const REVIEW_ITEM_TYPE = ["listing_match", "new_variety", "seller_candidate", "seller_correction", "removal", "duplicate_hold"] as const;
export const REVIEW_ITEM_STATUS = ["pending", "approved", "rejected", "merged"] as const;
export const CRAWL_JOB_STATUS = ["queued", "leased", "done", "failed"] as const;
export const BATCH_STATUS = ["staged", "published", "rolled_back"] as const;
export const MATCH_STATUS = ["pending", "approved", "rejected"] as const;
export const REVIEW_STATUS = ["pending", "approved", "rejected"] as const;
// Phase 3 (migration 0008): accounts, waiting lists, Add Your Farm.
export const USER_STATUS = ["active", "banned"] as const;
// Slice 0 (migration 0012): admin section roles. 'visitor' is every account's default;
// reviewer/admin are granted by an admin (the Accounts UI lands in Slice C).
export const USER_ROLES = ["visitor", "reviewer", "admin"] as const;
export const AUTH_ATTEMPT_SCOPES = ["ip", "pair"] as const;
export const FARM_OWNER_ACTIONS = ["granted", "revoked"] as const;
export const NOTIFY_CHANNELS = ["email", "sms"] as const;
export const OUTBOX_STATUS = ["queued", "sent", "suppressed", "failed"] as const;
export const FARM_SUBMISSION_STATUS = ["pending", "approved", "rejected"] as const;
export const DRAFT_STATUS = ["pending", "ready", "failed"] as const;

const inList = (col: string, values: readonly string[]) =>
  sql.raw(`${col} IN (${values.map((v) => `'${v}'`).join(", ")})`);

const nowIso = () => new Date().toISOString();

// ─── Provenance ──────────────────────────────────────────────────────────────

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: SOURCE_KINDS }).notNull(),
    label: text("label").notNull(),
    url: text("url"),
    checkedDate: text("checked_date"),
    access: text("access", { enum: SOURCE_ACCESS }).notNull().default("public"),
  },
  () => [
    check("sources_kind_chk", inList("kind", SOURCE_KINDS)),
    check("sources_access_chk", inList("access", SOURCE_ACCESS)),
  ],
);

export const importBatches = sqliteTable(
  "import_batches",
  {
    id: integer("id").primaryKey(),
    label: text("label").notNull().unique(),
    // Nullable: the initial catalog batch spans several sources (all listed in `manifest`).
    sourceId: integer("source_id").references(() => sources.id),
    manifest: text("manifest", { mode: "json" }).notNull(),
    status: text("status", { enum: BATCH_STATUS }).notNull().default("staged"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    publishedAt: text("published_at"),
  },
  () => [check("import_batches_status_chk", inList("status", BATCH_STATUS))],
);

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const subcategories = sqliteTable(
  "subcategories",
  {
    id: integer("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("subcategories_category_slug_uq").on(t.categoryId, t.slug),
    index("subcategories_category_idx").on(t.categoryId),
  ],
);

export const plants = sqliteTable(
  "plants",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    commonName: text("common_name").notNull(),
    // Nullable since the Floret import (migration 0003): a crop whose scientific name is
    // not sourced stays NULL (explicit unknown) — never invented.
    latinName: text("latin_name"),
    description: text("description"),
    sowingNotes: text("sowing_notes"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    updatedSeq: integer("updated_seq").notNull().default(0),
    deletedAt: text("deleted_at"),
    // Season class (migration 0005). Catalog data with its source; NULL = not classified
    // (explicit unknown — never defaulted into a class).
    seasonClass: text("season_class", { enum: SEASON_CLASSES }),
    seasonSourceId: integer("season_source_id").references(() => sources.id),
    // Source of the crop's sowing methods (migration 0006; the methods themselves live in
    // plant_sowing_methods). NULL exactly when the crop has no method rows.
    sowingMethodSourceId: integer("sowing_method_source_id").references(() => sources.id),
    // Grower guide (migration 0009): life cycle + hardiness (header fact) and the guide content
    // (growing, harvest-for-cutting, seed saving) as one JSON text value, validated on read by
    // GrowerGuideSchema. NULL = no content (never defaulted). grower_guide_source_id records the
    // internal source of all three; it is provenance only and is never displayed.
    lifeCycle: text("life_cycle"),
    hardiness: text("hardiness"),
    growerGuide: text("grower_guide"),
    growerGuideSourceId: integer("grower_guide_source_id").references(() => sources.id),
  },
  (t) => [
    index("plants_updated_seq_idx").on(t.updatedSeq),
    uniqueIndex("plants_names_uq").on(t.commonName, t.latinName),
    index("plants_category_idx").on(t.categoryId),
    // Nullable enum: explicit IS NULL arm, as for sellers.platform.
    check("plants_season_class_chk", sql`season_class IS NULL OR ${inList("season_class", SEASON_CLASSES)}`),
  ],
);

/** A breeder's named series (canonical §2). Each colour is its own variety with series_id set. */
export const series = sqliteTable(
  "series",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
    updatedSeq: integer("updated_seq").notNull().default(0),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("series_plant_idx").on(t.plantId), index("series_updated_seq_idx").on(t.updatedSeq)],
);

export const varieties = sqliteTable(
  "varieties",
  {
    id: integer("id").primaryKey(),
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    slug: text("slug").notNull().unique(),
    varietyName: text("variety_name").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    subcategoryId: integer("subcategory_id").references(() => subcategories.id),
    description: text("description"),
    sowingNotes: text("sowing_notes"),
    heightCm: integer("height_cm"),
    colorSwatch: text("color_swatch"),
    status: text("status", { enum: VARIETY_STATUS }).notNull().default("active"),
    contentLevel: text("content_level", { enum: CONTENT_LEVELS }).notNull().default("thin"),
    indexable: integer("indexable", { mode: "boolean" }).notNull().default(false),
    protection: text("protection", { enum: PROTECTION }).notNull().default("unknown"),
    protectionNote: text("protection_note"),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    seriesId: integer("series_id").references(() => series.id),
    colorFamily: text("color_family").notNull().default("unknown"),
    pollination: text("pollination", { enum: POLLINATION }).notNull().default("unknown"),
    daysToBloomMin: integer("days_to_bloom_min"),
    daysToBloomMax: integer("days_to_bloom_max"),
    mergedIntoId: integer("merged_into_id").references((): AnySQLiteColumn => varieties.id),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
    updatedSeq: integer("updated_seq").notNull().default(0),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("varieties_plant_idx").on(t.plantId),
    index("varieties_series_idx").on(t.seriesId),
    index("varieties_updated_seq_idx").on(t.updatedSeq),
    index("varieties_category_idx").on(t.categoryId),
    index("varieties_subcategory_idx").on(t.subcategoryId),
    index("varieties_source_idx").on(t.sourceId),
    index("varieties_status_name_idx").on(t.status, t.varietyName),
    check("varieties_status_chk", inList("status", VARIETY_STATUS)),
    check("varieties_content_level_chk", inList("content_level", CONTENT_LEVELS)),
    check("varieties_protection_chk", inList("protection", PROTECTION)),
    check("varieties_height_chk", sql`height_cm IS NULL OR height_cm > 0`),
    check("varieties_pollination_chk", inList("pollination", POLLINATION)),
    check("varieties_merged_chk", sql`status <> 'merged' OR merged_into_id IS NOT NULL`),
  ],
);

export const varietyTags = sqliteTable(
  "variety_tags",
  {
    varietyId: integer("variety_id")
      .notNull()
      .references(() => varieties.id),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.varietyId, t.tag] }), index("variety_tags_tag_idx").on(t.tag)],
);

/** Crop sowing methods (migration 0006), modelled on variety_tags. No rows = not classified. */
export const plantSowingMethods = sqliteTable(
  "plant_sowing_methods",
  {
    plantId: integer("plant_id")
      .notNull()
      .references(() => plants.id),
    method: text("method", { enum: SOWING_METHODS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.plantId, t.method] }),
    index("plant_sowing_methods_method_idx").on(t.method),
    check("plant_sowing_methods_method_chk", inList("method", SOWING_METHODS)),
  ],
);

export const varietyAliases = sqliteTable(
  "variety_aliases",
  {
    varietyId: integer("variety_id")
      .notNull()
      .references(() => varieties.id),
    alias: text("alias").notNull(),
    /** lib/names.ts normalizeName(): lowercase, accent/punctuation-free, crop + pack-size words dropped. */
    nameNormalized: text("name_normalized").notNull().default(""),
    kind: text("kind", { enum: NAME_KIND }).notNull().default("synonym"),
    // Slice A (migration 0013): provenance, written only by duplicate decisions
    // (source = 'duplicate_decision'). NULL = legacy/manual. Never selected into any public
    // payload, snapshot, sitemap or search response (the snapshot allowlist names its columns).
    source: text("source"),
    decisionItemId: integer("decision_item_id"),
    decidedByName: text("decided_by_name"),
    createdAt: text("created_at"),
  },
  (t) => [
    primaryKey({ columns: [t.varietyId, t.alias] }),
    index("variety_aliases_name_normalized_idx").on(t.nameNormalized),
    check("variety_aliases_kind_chk", inList("kind", NAME_KIND)),
  ],
);

// ─── Sellers + listings ──────────────────────────────────────────────────────

export const sellers = sqliteTable(
  "sellers",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: text("type", { enum: SELLER_TYPES }).notNull(),
    homepage: text("homepage"),
    description: text("description"),
    orderingNotes: text("ordering_notes"),
    location: text("location"),
    status: text("status", { enum: SELLER_STATUS }).notNull().default("active"),
    provenance: text("provenance", { enum: SELLER_PROVENANCE }).notNull(),
    listingPolicy: text("listing_policy", { enum: LISTING_POLICY }).notNull().default("full"),
    platform: text("platform", { enum: SELLER_PLATFORMS }),
    ratingCount: integer("rating_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingAverage: real("rating_average"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
    // Canonical §2 approval + crawl fields. NOTE: the canonical CHECK
    // (approved ⇒ terms_reviewed_at NOT NULL) is deliberately NOT enforced: terms review is a
    // Week 1 owner task (DELTA-PLAN-DEC16 §(a) §2).
    eligibility: text("eligibility", { enum: ELIGIBILITY }).notNull().default("candidate"),
    approvedAt: text("approved_at"),
    termsReviewedAt: text("terms_reviewed_at"),
    approvalNote: text("approval_note"),
    domain: text("domain"),
    crawlPolicy: text("crawl_policy", { enum: CRAWL_POLICY }).notNull().default("manual_only"),
    claimStatus: text("claim_status", { enum: CLAIM_STATUS }).notNull().default("unclaimed"),
    country: text("country").notNull().default("US"),
    region: text("region"),
    /** JSON array of region codes; ["unknown"] when not sourced. */
    shipsTo: text("ships_to").notNull().default('["unknown"]'),
    isSiteOwner: integer("is_site_owner", { mode: "boolean" }).notNull().default(false),
    // "Small farm" badge (Open Directory, migration 0010): a recorded judgment call (Hue/Dustin),
    // not a measured size. true = the seller presents as a small family farm or small seed seller.
    // Set only through the admin path (repositories/admin.ts setSellerSmallFarm); never set by the
    // crawler/ingester. One fact in one place: listings and varieties derive it through the join.
    isSmallFarm: integer("is_small_farm", { mode: "boolean" }).notNull().default(false),
    /** Private — never in any public payload. */
    contactEmail: text("contact_email"),
    updatedSeq: integer("updated_seq").notNull().default(0),
    deletedAt: text("deleted_at"),
    // Imported third-party aggregate (brief #4, migration 0007): all six set or all NULL. Kept
    // apart from rating_count / rating_average, which are OUR rating and stay "Not yet rated".
    importedRatingSource: text("imported_rating_source", { enum: IMPORTED_RATING_SOURCES }),
    importedRatingPlaceName: text("imported_rating_place_name"),
    importedRatingPlaceId: text("imported_rating_place_id"),
    importedRatingValue: real("imported_rating_value"),
    importedRatingCount: integer("imported_rating_count"),
    /** YYYY-MM-DD the aggregate was fetched. */
    importedRatingFetchedAt: text("imported_rating_fetched_at"),
  },
  (t) => [
    index("sellers_status_name_idx").on(t.status, t.name),
    uniqueIndex("sellers_domain_uq").on(t.domain).where(sql`domain IS NOT NULL`),
    index("sellers_updated_seq_idx").on(t.updatedSeq),
    check("sellers_eligibility_chk", inList("eligibility", ELIGIBILITY)),
    check("sellers_crawl_policy_chk", inList("crawl_policy", CRAWL_POLICY)),
    check("sellers_claim_status_chk", inList("claim_status", CLAIM_STATUS)),
    check("sellers_type_chk", inList("type", SELLER_TYPES)),
    check("sellers_status_chk", inList("status", SELLER_STATUS)),
    check("sellers_provenance_chk", inList("provenance", SELLER_PROVENANCE)),
    check("sellers_listing_policy_chk", inList("listing_policy", LISTING_POLICY)),
    check("sellers_platform_chk", sql`platform IS NULL OR ${inList("platform", SELLER_PLATFORMS)}`),
    // R7: the average stays NULL until a real rating exists.
    check("sellers_rating_average_chk", sql`rating_count > 0 OR rating_average IS NULL`),
    check("sellers_imported_rating_source_chk", sql`imported_rating_source IS NULL OR ${inList("imported_rating_source", IMPORTED_RATING_SOURCES)}`),
    check("sellers_imported_rating_value_chk", sql`imported_rating_value IS NULL OR (imported_rating_value >= 0 AND imported_rating_value <= 5)`),
    check("sellers_imported_rating_count_chk", sql`imported_rating_count IS NULL OR imported_rating_count >= 0`),
  ],
);

export const listings = sqliteTable(
  "listings",
  {
    id: integer("id").primaryKey(),
    varietyId: integer("variety_id")
      .notNull()
      .references(() => varieties.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    sku: text("sku"),
    productUrl: text("product_url"),
    notes: text("notes"),
    status: text("status", { enum: LISTING_STATUS }).notNull().default("active"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
    availability: text("availability", { enum: AVAILABILITY }).notNull().default("unknown"),
    variantKey: text("variant_key").notNull().default(""),
    externalProductId: text("external_product_id"),
    titleRaw: text("title_raw"),
    channel: text("channel", { enum: LISTING_CHANNEL }).notNull().default("external"),
    matchMethod: text("match_method", { enum: MATCH_METHOD }).notNull().default("human"),
    confidence: real("confidence").notNull().default(1),
    sourceUrl: text("source_url"),
    firstSeenAt: text("first_seen_at"),
    lastCheckedAt: text("last_checked_at"),
    updatedSeq: integer("updated_seq").notNull().default(0),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    // SQLite treats NULL product_urls as distinct (curated listings without a product page).
    uniqueIndex("listings_seller_url_variant_uq").on(t.sellerId, t.productUrl, t.variantKey),
    index("listings_variety_idx").on(t.varietyId),
    index("listings_seller_idx").on(t.sellerId),
    index("listings_source_idx").on(t.sourceId),
    index("listings_status_idx").on(t.status),
    index("listings_updated_seq_idx").on(t.updatedSeq),
    check("listings_status_chk", inList("status", LISTING_STATUS)),
    check("listings_availability_chk", inList("availability", AVAILABILITY)),
    check("listings_channel_chk", inList("channel", LISTING_CHANNEL)),
    check("listings_match_method_chk", inList("match_method", MATCH_METHOD)),
    check("listings_confidence_chk", sql`confidence BETWEEN 0 AND 1`),
  ],
);

export const listingPacketSizes = sqliteTable(
  "listing_packet_sizes",
  {
    id: integer("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    label: text("label").notNull(),
    seedCount: integer("seed_count"),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("USD"),
    priceSource: text("price_source"),
    priceCheckDate: text("price_check_date"),
    inStock: integer("in_stock", { mode: "boolean" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("packet_sizes_listing_price_idx").on(t.listingId, t.priceCents),
    // HR1/S8: a price is only stored together with its source + check date.
    check(
      "packet_sizes_price_provenance_chk",
      sql`price_cents IS NULL OR (price_source IS NOT NULL AND price_check_date IS NOT NULL)`,
    ),
    check("packet_sizes_price_chk", sql`price_cents IS NULL OR price_cents >= 0`),
  ],
);

export const priceHistory = sqliteTable(
  "price_history",
  {
    id: integer("id").primaryKey(),
    packetSizeId: integer("packet_size_id")
      .notNull()
      .references(() => listingPacketSizes.id),
    priceCents: integer("price_cents"),
    checkedDate: text("checked_date").notNull(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
  },
  (t) => [
    index("price_history_packet_idx").on(t.packetSizeId),
    index("price_history_source_idx").on(t.sourceId),
  ],
);

// ─── Pipeline + publish ──────────────────────────────────────────────────────

export const matchQueue = sqliteTable(
  "match_queue",
  {
    id: integer("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => importBatches.id),
    candidatePayload: text("candidate_payload", { mode: "json" }).notNull(),
    confidence: real("confidence"),
    status: text("status", { enum: MATCH_STATUS }).notNull().default("pending"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("match_queue_batch_idx").on(t.batchId),
    check("match_queue_status_chk", inList("status", MATCH_STATUS)),
  ],
);

export const catalogPublish = sqliteTable(
  "catalog_publish",
  {
    // Monotonic version, assigned explicitly by publish-catalog.ts (X12).
    version: integer("version").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => importBatches.id),
    snapshotKey: text("snapshot_key"),
    publishedAt: text("published_at").notNull(),
  },
  (t) => [index("catalog_publish_batch_idx").on(t.batchId)],
);

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey(),
    varietyId: integer("variety_id").references(() => varieties.id),
    sellerId: integer("seller_id").references(() => sellers.id),
    // Plant (crop) artwork, migration 0004. r2_key holds the public path, as for varieties.
    plantId: integer("plant_id").references(() => plants.id),
    r2Key: text("r2_key").notNull(),
    licence: text("licence").notNull(),
    credit: text("credit").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("media_variety_idx").on(t.varietyId),
    index("media_seller_idx").on(t.sellerId),
    index("media_plant_idx").on(t.plantId),
  ],
);

export const outboundClicks = sqliteTable(
  "outbound_clicks",
  {
    id: integer("id").primaryKey(),
    listingId: integer("listing_id").references(() => listings.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    targetUrl: text("target_url").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("outbound_clicks_seller_idx").on(t.sellerId),
    index("outbound_clicks_listing_idx").on(t.listingId),
  ],
);

// ─── Delta (canonical spec 2026-11-16): events, demand, removal, ingest, admin ────────────

/** Global change counter for /sync (key 'catalog_seq'). Bumped by nextSeq() in repositories. */
export const catalogMeta = sqliteTable("catalog_meta", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const listingEvents = sqliteTable(
  "listing_events",
  {
    id: integer("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    event: text("event", { enum: LISTING_EVENT }).notNull(),
    at: text("at").notNull(),
    /** Why a 'gone' event happened (admin removals); NULL = none given / not applicable. */
    reason: text("reason"),
    /** Who recorded the event (admin display name); NULL = the key-based API or the importer. */
    actor: text("actor"),
  },
  (t) => [
    index("listing_events_listing_idx").on(t.listingId),
    index("listing_events_at_idx").on(t.at),
    check("listing_events_event_chk", inList("event", LISTING_EVENT)),
  ],
);

// Event tables carry plain integer ids (no FKs): they are append-only logs that must survive a
// full re-import of the curated catalog, which re-creates catalog rows with the same ids.
export const clickEvents = sqliteTable(
  "click_events",
  {
    id: integer("id").primaryKey(),
    at: text("at").notNull(),
    listingId: integer("listing_id").notNull(),
    varietyId: integer("variety_id").notNull(),
    sellerId: integer("seller_id").notNull(),
    availabilityAtClick: text("availability_at_click").notNull(),
    pageType: text("page_type").notNull(),
    referrerHost: text("referrer_host"),
    client: text("client").notNull(),
    /** sha256(salt|ip|UTC date) — the IP itself is never stored. */
    visitorDayHash: text("visitor_day_hash").notNull(),
    isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("click_events_at_idx").on(t.at), index("click_events_variety_idx").on(t.varietyId)],
);

export const searchEvents = sqliteTable(
  "search_events",
  {
    id: integer("id").primaryKey(),
    at: text("at").notNull(),
    queryNormalized: text("query_normalized").notNull(),
    resultCount: integer("result_count").notNull(),
    clickedVarietyId: integer("clicked_variety_id"),
    client: text("client").notNull(),
  },
  (t) => [index("search_events_at_idx").on(t.at)],
);

export const varietyViewCounts = sqliteTable(
  "variety_view_counts",
  {
    date: text("date").notNull(),
    varietyId: integer("variety_id").notNull(),
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.date, t.varietyId] })],
);

export const dailyStats = sqliteTable(
  "daily_stats",
  {
    date: text("date").notNull(),
    varietyId: integer("variety_id").notNull(),
    sellerId: integer("seller_id").notNull(),
    clicks: integer("clicks").notNull().default(0),
    soldOutClicks: integer("sold_out_clicks").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.date, t.varietyId, t.sellerId] })],
);

export const blockedDomains = sqliteTable("blocked_domains", {
  domain: text("domain").primaryKey(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});

export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey(),
    type: text("type", { enum: REPORT_TYPE }).notNull(),
    targetType: text("target_type", { enum: REPORT_TARGET }).notNull(),
    targetRef: text("target_ref").notNull(),
    message: text("message").notNull(),
    contact: text("contact").notNull(),
    status: text("status", { enum: REPORT_STATUS }).notNull().default("open"),
    /** "verified" | "not_configured" */
    turnstile: text("turnstile").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    resolvedAt: text("resolved_at"),
  },
  () => [
    check("reports_type_chk", inList("type", REPORT_TYPE)),
    check("reports_target_type_chk", inList("target_type", REPORT_TARGET)),
    check("reports_status_chk", inList("status", REPORT_STATUS)),
  ],
);

export const sellerClaims = sqliteTable(
  "seller_claims",
  {
    id: integer("id").primaryKey(),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [index("seller_claims_seller_idx").on(t.sellerId)],
);

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label").notNull(),
  /** JSON array of scopes, e.g. ["ingest"] or ["admin"]. */
  scopes: text("scopes").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
});

export const fetchSources = sqliteTable(
  "fetch_sources",
  {
    id: integer("id").primaryKey(),
    url: text("url").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    httpStatus: integer("http_status").notNull(),
    contentHash: text("content_hash").notNull(),
    snapshotKey: text("snapshot_key").notNull(),
    robotsAllowed: integer("robots_allowed", { mode: "boolean" }).notNull(),
    kind: text("kind", { enum: FETCH_KIND }).notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("fetch_sources_url_hash_uq").on(t.url, t.contentHash),
    check("fetch_sources_kind_chk", inList("kind", FETCH_KIND)),
  ],
);

export const agentRuns = sqliteTable("agent_runs", {
  id: integer("id").primaryKey(),
  agent: text("agent").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costUsd: real("cost_usd"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});

export const observations = sqliteTable(
  "observations",
  {
    id: integer("id").primaryKey(),
    fetchSourceId: integer("fetch_source_id").references(() => fetchSources.id),
    agentRunId: integer("agent_run_id").references(() => agentRuns.id),
    sellerId: integer("seller_id"),
    payload: text("payload").notNull(),
    status: text("status", { enum: OBSERVATION_STATUS }).notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("observations_source_idx").on(t.fetchSourceId),
    check("observations_status_chk", inList("status", OBSERVATION_STATUS)),
  ],
);

export const reviewItems = sqliteTable(
  "review_items",
  {
    id: integer("id").primaryKey(),
    type: text("type", { enum: REVIEW_ITEM_TYPE }).notNull(),
    groupKey: text("group_key").notNull(),
    proposal: text("proposal").notNull(),
    reason: text("reason"),
    confidence: real("confidence"),
    status: text("status", { enum: REVIEW_ITEM_STATUS }).notNull().default("pending"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    resolvedAt: text("resolved_at"),
    // Slice A (migration 0013): the decider trail. decided_by_user_id has no FK — the trail
    // outlives the account (the farm_submissions.user_id precedent). NULL = resolved through
    // the key-based API, which stamps no decider.
    decidedByUserId: integer("decided_by_user_id"),
    decidedByName: text("decided_by_name"),
    verifiedByName: text("verified_by_name"),
    verifiedAt: text("verified_at"),
    seenByName: text("seen_by_name"),
    seenAt: text("seen_at"),
  },
  (t) => [
    index("review_items_status_type_idx").on(t.status, t.type),
    index("review_items_group_idx").on(t.groupKey),
    check("review_items_type_chk", inList("type", REVIEW_ITEM_TYPE)),
    check("review_items_status_chk", inList("status", REVIEW_ITEM_STATUS)),
  ],
);

export const crawlJobs = sqliteTable(
  "crawl_jobs",
  {
    id: integer("id").primaryKey(),
    type: text("type").notNull(),
    target: text("target").notNull(),
    status: text("status", { enum: CRAWL_JOB_STATUS }).notNull().default("queued"),
    leaseExpiresAt: text("lease_expires_at"),
    attempts: integer("attempts").notNull().default(0),
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    index("crawl_jobs_status_idx").on(t.status, t.nextRunAt),
    check("crawl_jobs_status_chk", inList("status", CRAWL_JOB_STATUS)),
  ],
);

export const ingestIdempotency = sqliteTable("ingest_idempotency", {
  key: text("key").primaryKey(),
  endpoint: text("endpoint").notNull(),
  /** JSON {status, body} of the first response. */
  response: text("response").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
});

// ─── Accounts, waiting lists, Add Your Farm (Phase 3, migration 0008) ────────
//
// PRIVATE tables: never in the snapshot allowlist, the sync payloads or the public API
// (guardrail: tests/unit/account-privacy.test.ts). Catalog ids they carry (variety_id,
// listing_id, seller_id) are plain integers with no FK, like the event tables above, so a full
// re-import of the curated catalog (which deletes and re-creates catalog rows with the same ids)
// never collides with account data.

/**
 * A Seed Directory account (USER-ACCOUNTS-DESIGN §5). The Phase 1 stub (id, email, display_name,
 * created_at) is extended in place; display_name stays for the 3b "show my first name only"
 * review name. email keeps its Phase 1 NOT NULL + UNIQUE: the IVR-phase phone-only accounts
 * (design §4a) will need it relaxed by a table rebuild — noted, not done in Phase 3.
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey(),
    /** Stored lowercased. */
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    name: text("name").notNull().default(""),
    /** US number, normalized to 10 digits. Half of the sign-in pair: never displayed publicly. */
    phone: text("phone").notNull().default(""),
    /** Account data, never rendered publicly. Nullable only for future IVR starter accounts. */
    zip: text("zip"),
    /** Derived from zip by lookupZone() at entry, e.g. "8b". */
    usdaZone: text("usda_zone"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    emailVerifiedAt: text("email_verified_at"),
    /** Global unsubscribe from waiting-list alerts (email and text). */
    notifyOptOut: integer("notify_opt_out", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: USER_STATUS }).notNull().default("active"),
    /** SELF-REPORTED at signup — intent only, grants nothing. */
    farmOwnerDeclared: integer("farm_owner_declared", { mode: "boolean" }).notNull().default(false),
    /** The VERIFIED flag — admin-set only (farm_owner_audit records every change). */
    isFarmOwner: integer("is_farm_owner", { mode: "boolean" }).notNull().default(false),
    /** The farm this account owns (sellers.id; no FK — see above). Confers nothing while is_farm_owner is false. */
    sellerId: integer("seller_id"),
    /** SMS alert number (10 digits); defaults to the account phone. Verified per number. */
    alertPhone: text("alert_phone"),
    alertPhoneVerified: integer("alert_phone_verified", { mode: "boolean" }).notNull().default(false),
    smsOptIn: integer("sms_opt_in", { mode: "boolean" }).notNull().default(false),
    smsOptInAt: text("sms_opt_in_at"),
    updatedAt: text("updated_at"),
    /** Admin section role (migration 0012). Server-resolved only; never trusted from the client. */
    role: text("role", { enum: USER_ROLES }).notNull().default("visitor"),
  },
  (t) => [
    index("users_phone_idx").on(t.phone),
    index("users_alert_phone_idx").on(t.alertPhone),
    check("users_status_chk", inList("status", USER_STATUS)),
    check("users_role_chk", inList("role", USER_ROLES)),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /** SHA-256 hex of the raw cookie token; the token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Admin section (Slice 0, migration 0012) ────────────────────────────────
// PRIVATE tables, like the account tables above: served only through the admin session.

/** Admin sessions: the elevated layer, separate from the visitor `sessions` table. */
export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /** SHA-256 hex of the raw cookie token; the token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at"),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

/** Admin sign-in codes (email channel only). Same rules as the account codes. */
export const adminSigninCodes = sqliteTable(
  "admin_signin_codes",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /** The address the code was sent to. */
    email: text("email").notNull(),
    /** SHA-256 hex of `${salt}:${code}`. */
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    invalidatedAt: text("invalidated_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("admin_signin_codes_user_idx").on(t.userId, t.createdAt)],
);

/** Append-only record of every account role change. user_id has no FK: the trail outlives the account. */
export const roleAudit = sqliteTable(
  "role_audit",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id").notNull(),
    /** Who made the change (name or label). */
    actor: text("actor").notNull(),
    fromRole: text("from_role").notNull(),
    toRole: text("to_role").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("role_audit_user_idx").on(t.userId)],
);

/**
 * Seller internal notes (Slice B, migration 0014): the team's private memory about a seller.
 * PRIVATE — never in the snapshot allowlist, the sync payloads or the public API. Append-only
 * in v1 (no edit/delete UI). author_user_id has no FK and the name + role snapshot beside it
 * (the Slice A decider-trail precedent): the trail outlives the account.
 */
export const sellerNotes = sqliteTable(
  "seller_notes",
  {
    id: integer("id").primaryKey(),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    authorUserId: integer("author_user_id").notNull(),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("seller_notes_seller_created_idx").on(t.sellerId, t.createdAt)],
);

/** Failed sign-in attempts (rate limiting): keys are SHA-256 hashes — no IP or phone in clear. */
export const authAttempts = sqliteTable(
  "auth_attempts",
  {
    id: integer("id").primaryKey(),
    scope: text("scope", { enum: AUTH_ATTEMPT_SCOPES }).notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("auth_attempts_key_idx").on(t.scope, t.keyHash, t.createdAt), check("auth_attempts_scope_chk", inList("scope", AUTH_ATTEMPT_SCOPES))],
);

/** One-time email-ownership codes (design §2a). Only one live code per user (resend invalidates). */
export const emailVerificationCodes = sqliteTable(
  "email_verification_codes",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /** The address the code was sent to (an email change re-runs the flow for the new one). */
    email: text("email").notNull(),
    /** SHA-256 hex of `${salt}:${code}`. */
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    invalidatedAt: text("invalidated_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("email_codes_user_idx").on(t.userId, t.createdAt)],
);

/** Alert-number codes sent by SMS (design §4a) — same shape and rules, keyed by (user, phone). */
export const phoneVerificationCodes = sqliteTable(
  "phone_verification_codes",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    invalidatedAt: text("invalidated_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("phone_codes_user_idx").on(t.userId, t.createdAt)],
);

/** Append-only record of every is_farm_owner change. user_id has no FK: the trail outlives the account. */
export const farmOwnerAudit = sqliteTable(
  "farm_owner_audit",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id").notNull(),
    /** Admin identity: the API key label used. */
    actor: text("actor").notNull(),
    action: text("action", { enum: FARM_OWNER_ACTIONS }).notNull(),
    sellerId: integer("seller_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("farm_owner_audit_user_idx").on(t.userId), check("farm_owner_audit_action_chk", inList("action", FARM_OWNER_ACTIONS))],
);

export const waitlistEntries = sqliteTable(
  "waitlist_entries",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    varietyId: integer("variety_id").notNull(),
    createdAt: text("created_at").notNull(),
    /** NULL until an alert was actually SENT (not when queued). First-found only. */
    notifiedAt: text("notified_at"),
  },
  (t) => [uniqueIndex("waitlist_user_variety_uq").on(t.userId, t.varietyId), index("waitlist_variety_idx").on(t.varietyId, t.notifiedAt)],
);

/**
 * Pending recognized-contact joins (Tranche 3.2, SPEC §3.3 (iii)): when an existing email is
 * submitted to the join path, the code issued for it is recorded here together with the
 * variety it was issued for (plus the submitter's channel choice, applied at verify time).
 * One row per user — a re-issue replaces it, mirroring the one-live-code rule — consumed when
 * verification establishes the session and completes the join in the same step. PRIVATE.
 */
export const waitlistPendingJoins = sqliteTable("waitlist_pending_joins", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  /** Catalog id, a plain integer with no FK (the 0008 convention — the importer re-creates catalog rows). */
  varietyId: integer("variety_id").notNull(),
  /** Normalized 10-digit number when the text channel was chosen, else NULL. */
  phone: text("phone"),
  smsOptIn: integer("sms_opt_in", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    varietyId: integer("variety_id").notNull(),
    /** The listing whose publish triggered the alert (the /go/{id} link). */
    listingId: integer("listing_id").notNull(),
    channel: text("channel", { enum: NOTIFY_CHANNELS }).notNull(),
    status: text("status", { enum: OUTBOX_STATUS }).notNull().default("queued"),
    queuedAt: text("queued_at").notNull(),
    sentAt: text("sent_at"),
    attempts: integer("attempts").notNull().default(0),
    /** Last error code / suppression reason. */
    detail: text("detail"),
  },
  (t) => [
    // Dedupe: one alert per user per variety per channel — re-runs and overlapping imports are safe.
    uniqueIndex("outbox_user_variety_channel_uq").on(t.userId, t.varietyId, t.channel),
    index("outbox_status_channel_idx").on(t.status, t.channel, t.queuedAt),
    check("outbox_channel_chk", inList("channel", NOTIFY_CHANNELS)),
    check("outbox_status_chk", inList("status", OUTBOX_STATUS)),
  ],
);

/** Add Your Farm submissions (design §9; field list locked 2026-11-16). Nothing auto-publishes. */
export const farmSubmissions = sqliteTable(
  "farm_submissions",
  {
    id: integer("id").primaryKey(),
    /** Submitting account when signed in (no FK: the queue item outlives a deleted account). */
    userId: integer("user_id"),
    farmName: text("farm_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    city: text("city").notNull(),
    /** USPS code. */
    state: text("state").notNull(),
    website: text("website").notNull(),
    /** "About your farm". */
    growsText: text("grows_text").notNull(),
    /** "Varieties you want listed", one per line. */
    varietiesText: text("varieties_text").notNull(),
    authorized: integer("authorized", { mode: "boolean" }).notNull(),
    /** The farm's public contact number (10 digits) — never the account phone. */
    businessPhone: text("business_phone").notNull(),
    gbpUrl: text("gbp_url"),
    instagramUrl: text("instagram_url"),
    tiktokUrl: text("tiktok_url"),
    facebookUrl: text("facebook_url"),
    wholesale: integer("wholesale", { mode: "boolean" }),
    notes: text("notes"),
    /** "verified" | "dev_bypass" */
    turnstile: text("turnstile").notNull(),
    status: text("status", { enum: FARM_SUBMISSION_STATUS }).notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    /** The seller record linked at approval (no FK). */
    sellerId: integer("seller_id"),
    // Auto-drafted profile summary (brief #3 addendum): a DRAFT for the admin, never published.
    draftStatus: text("draft_status", { enum: DRAFT_STATUS }).notNull().default("pending"),
    draftSummary: text("draft_summary"),
    /** JSON [{claim, quote, url}] — only claims whose quote was found verbatim in the fetched text. */
    draftEvidence: text("draft_evidence"),
    /** JSON of machine-SUGGESTED values (city, state, socials, phone) — shown beside, never over, the submitted ones. */
    suggestedFields: text("suggested_fields"),
    draftNote: text("draft_note"),
    draftedAt: text("drafted_at"),
    // Slice A (migration 0013): the C2 decline sheet's optional reason, kept on the record.
    decisionNote: text("decision_note"),
  },
  (t) => [
    index("farm_submissions_status_idx").on(t.status, t.createdAt),
    index("farm_submissions_email_idx").on(t.contactEmail),
    index("farm_submissions_state_idx").on(t.state),
    check("farm_submissions_status_chk", inList("status", FARM_SUBMISSION_STATUS)),
    check("farm_submissions_draft_status_chk", inList("draft_status", DRAFT_STATUS)),
  ],
);

/** Private tables (accounts, alerts, farm submissions, admin section). Asserted absent from snapshot + sync output. */
export const PRIVATE_ACCOUNT_TABLES = [
  "users",
  "sessions",
  "auth_attempts",
  "email_verification_codes",
  "phone_verification_codes",
  "farm_owner_audit",
  "waitlist_entries",
  "waitlist_pending_joins",
  "notification_outbox",
  "farm_submissions",
  "admin_sessions",
  "admin_signin_codes",
  "role_audit",
  "seller_notes",
] as const;

// ─── Future stubs (empty in Phase 1; no app code path reads or writes them) ──

export const sellerAccounts = sqliteTable(
  "seller_accounts",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    role: text("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sellerId] }), index("seller_accounts_seller_idx").on(t.sellerId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => sellers.id),
    rating: integer("rating").notNull(),
    body: text("body"),
    status: text("status", { enum: REVIEW_STATUS }).notNull().default("pending"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex("reviews_user_seller_uq").on(t.userId, t.sellerId),
    index("reviews_seller_idx").on(t.sellerId),
    check("reviews_rating_chk", sql`rating BETWEEN 1 AND 5`),
    check("reviews_status_chk", inList("status", REVIEW_STATUS)),
  ],
);
