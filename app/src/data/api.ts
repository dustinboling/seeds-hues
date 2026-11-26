/**
 * Minimal catalog read path over the existing public API (Slice 2 data layer).
 * Every method returns parsed JSON the live v2 API serves today; the later
 * slices' SSR `+data` hooks reuse this client (server-side) while client
 * surfaces call /api/v1 directly — the brief's "one backend" rule.
 *
 * Reads are paced and 429-aware (Retry-After backoff): sitemap/lastmod sweeps
 * stay inside the 120-req/min/IP budget instead of hammering the live API.
 */
import type {
  ApiAvailability,
  ApiContentLevel,
  ApiCoverageItem,
  ApiCrop,
  ApiCropDetail,
  ApiEnvelope,
  ApiGrowerGuide,
  ApiImportedRating,
  ApiMatchMethod,
  ApiMedia,
  ApiOgSeller,
  ApiPacketSize,
  ApiPlantGuidance,
  ApiPlantRef,
  ApiPollination,
  ApiProtection,
  ApiProvenance,
  ApiPublicListing,
  ApiRating,
  ApiRecentItem,
  ApiSearchResponse,
  ApiSearchResult,
  ApiSellerDetail,
  ApiSellerItem,
  ApiSellerLocation,
  ApiSellerLocationKind,
  ApiSellerRef,
  ApiSellerStatus,
  ApiSellerType,
  ApiSeriesCrop,
  ApiSeriesDetail,
  ApiVarietyDetail,
  ApiVarietyFacts,
  ApiVarietyListItem,
  ApiVarietyRef,
  ApiVarietyStatus,
  CatalogCounts,
  OpenApiDoc,
  SyncSnapshotData,
  ApiSeasonClass,
  ApiSowingMethod,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** The API answered 200 but the payload is not the shape the app consumes. */
export class ApiShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiShapeError";
  }
}

type FetchImpl = typeof fetch;

const AVAILABILITY: ReadonlySet<string> = new Set(["in_stock", "sold_out", "preorder", "shop_closed", "unknown"]);
const SEASON_CLASSES: ReadonlySet<string> = new Set(["cool_season_hardy_annual", "warm_season_tender_annual"]);
const SOWING_METHODS: ReadonlySet<string> = new Set(["direct_sow", "transplant"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reqString(row: Record<string, unknown>, key: string, what: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new ApiShapeError(`${what}: ${key} must be a string`);
  return value;
}

function reqNumber(row: Record<string, unknown>, key: string, what: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiShapeError(`${what}: ${key} must be a number`);
  return value;
}

function optString(row: Record<string, unknown>, key: string, what: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ApiShapeError(`${what}: ${key} must be a string or null`);
  return value;
}

function optNumber(row: Record<string, unknown>, key: string, what: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiShapeError(`${what}: ${key} must be a number or null`);
  return value;
}

function reqBoolean(row: Record<string, unknown>, key: string, what: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new ApiShapeError(`${what}: ${key} must be a boolean`);
  return value;
}

function reqArray(row: Record<string, unknown>, key: string, what: string): unknown[] {
  const value = row[key];
  if (!Array.isArray(value)) throw new ApiShapeError(`${what}: ${key} must be an array`);
  return value;
}

function reqRecord(row: Record<string, unknown>, key: string, what: string): Record<string, unknown> {
  const value = row[key];
  if (!isRecord(value)) throw new ApiShapeError(`${what}: ${key} must be an object`);
  return value;
}

function parseSowingMethods(row: Record<string, unknown>, key: string, what: string): ApiSowingMethod[] {
  const methods = reqArray(row, key, what);
  for (const method of methods) {
    if (typeof method !== "string" || !SOWING_METHODS.has(method)) {
      throw new ApiShapeError(`${what}: unknown sowing method ${JSON.stringify(method)}`);
    }
  }
  return methods as ApiSowingMethod[];
}

function parseCrop(row: unknown): ApiCrop {
  if (!isRecord(row)) throw new ApiShapeError("crop: row must be an object");
  return {
    slug: reqString(row, "slug", "crop"),
    commonName: reqString(row, "commonName", "crop"),
    latinName: optString(row, "latinName", "crop"),
    lifeCycle: optString(row, "lifeCycle", "crop"),
    season_class: optEnum<ApiSeasonClass>(row, "season_class", "crop", SEASON_CLASSES),
    sowing_methods: parseSowingMethods(row, "sowing_methods", "crop"),
    varietyCount: reqNumber(row, "varietyCount", "crop"),
    varietiesWithSellers: reqNumber(row, "varietiesWithSellers", "crop"),
    lastUpdated: optString(row, "lastUpdated", "crop"),
    media: reqArray(row, "media", "crop").map((m) => {
      if (!isRecord(m)) throw new ApiShapeError("crop media: row must be an object");
      return { url: reqString(m, "url", "crop media") };
    }),
  };
}

function parseCoverageItem(row: unknown): ApiCoverageItem {
  if (!isRecord(row)) throw new ApiShapeError("coverage: row must be an object");
  const crop = reqRecord(row, "crop", "coverage");
  return {
    crop: { slug: reqString(crop, "slug", "coverage crop"), name: reqString(crop, "name", "coverage crop") },
    varieties: reqNumber(row, "varieties", "coverage"),
    varieties_with_sellers: reqNumber(row, "varieties_with_sellers", "coverage"),
    last_updated: optString(row, "last_updated", "coverage"),
  };
}

function parseAvailability(value: unknown): ApiAvailability {
  if (typeof value !== "string" || !AVAILABILITY.has(value)) throw new ApiShapeError(`recent: unknown availability ${String(value)}`);
  return value as ApiAvailability;
}

function parseRecentItem(row: unknown): ApiRecentItem {
  if (!isRecord(row)) throw new ApiShapeError("recent: row must be an object");
  const listing = reqRecord(row, "listing", "recent");
  const variety = reqRecord(listing, "variety", "recent listing");
  const plant = reqRecord(variety, "plant", "recent variety");
  const seller = reqRecord(listing, "seller", "recent listing");
  const event = reqString(row, "event", "recent");
  if (event !== "first_seen" && event !== "restocked" && event !== "sold_out" && event !== "gone" && event !== "restored") {
    throw new ApiShapeError(`recent: unknown event ${event}`);
  }
  return {
    event,
    at: reqString(row, "at", "recent"),
    listing: {
      id: reqNumber(listing, "id", "recent listing"),
      availability: parseAvailability(listing.availability),
      variety: {
        slug: reqString(variety, "slug", "recent variety"),
        varietyName: reqString(variety, "varietyName", "recent variety"),
        plant: { commonName: reqString(plant, "commonName", "recent plant") },
      },
      seller: { slug: reqString(seller, "slug", "recent seller"), name: reqString(seller, "name", "recent seller") },
    },
  };
}

const SELLER_TYPES: ReadonlySet<string> = new Set(["wholesale", "retail", "specialty"]);

function parseSellerItem(row: unknown): ApiSellerItem {
  if (!isRecord(row)) throw new ApiShapeError("seller: row must be an object");
  return {
    slug: reqString(row, "slug", "seller"),
    name: reqString(row, "name", "seller"),
    type: reqEnum<ApiSellerType>(row, "type", "seller", SELLER_TYPES),
    location: optString(row, "location", "seller"),
    region: optString(row, "region", "seller"),
    country: reqString(row, "country", "seller"),
    varietyCount: reqNumber(row, "varietyCount", "seller"),
    ratingCount: reqNumber(row, "ratingCount", "seller"),
    isSmallFarm: reqBoolean(row, "isSmallFarm", "seller"),
  };
}

// --- Variety detail (Slice 3): the same JSON GET /api/v1/varieties/[slug]
// and GET /api/v1/varieties serve (v2's VarietyDetail / VarietyListItem). ---

const DATEISH = /^\d{4}-\d{2}-\d{2}/;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const HTTP_URL = /^https?:\/\//;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POLLINATION: ReadonlySet<string> = new Set(["open_pollinated", "f1_hybrid", "unknown"]);
const PROTECTION: ReadonlySet<string> = new Set(["pvp_us", "utility_patent_us", "pbr", "none_stated", "unknown"]);
const CONTENT_LEVELS: ReadonlySet<string> = new Set(["thin", "factual"]);
const MATCH_METHODS: ReadonlySet<string> = new Set(["exact", "synonym", "model", "human"]);

function reqEnum<T extends string>(row: Record<string, unknown>, key: string, what: string, allowed: ReadonlySet<string>): T {
  const value = reqString(row, key, what);
  if (!allowed.has(value)) throw new ApiShapeError(`${what}: ${key} has unknown value ${JSON.stringify(value)}`);
  return value as T;
}

function optEnum<T extends string>(
  row: Record<string, unknown>,
  key: string,
  what: string,
  allowed: ReadonlySet<string>,
): T | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ApiShapeError(`${what}: ${key} has unknown value ${JSON.stringify(value)}`);
  }
  return value as T;
}

function reqDateish(row: Record<string, unknown>, key: string, what: string): string {
  const value = reqString(row, key, what);
  if (!DATEISH.test(value)) throw new ApiShapeError(`${what}: ${key} must be an ISO date or timestamp`);
  return value;
}

function optDateish(row: Record<string, unknown>, key: string, what: string): string | null {
  const value = optString(row, key, what);
  if (value !== null && !DATEISH.test(value)) throw new ApiShapeError(`${what}: ${key} must be an ISO date or timestamp`);
  return value;
}

function reqHttpUrl(row: Record<string, unknown>, key: string, what: string): string {
  const value = reqString(row, key, what);
  if (!HTTP_URL.test(value)) throw new ApiShapeError(`${what}: ${key} must be an http(s) URL`);
  return value;
}

function optHttpUrl(row: Record<string, unknown>, key: string, what: string): string | null {
  const value = optString(row, key, what);
  if (value !== null && !HTTP_URL.test(value)) throw new ApiShapeError(`${what}: ${key} must be an http(s) URL`);
  return value;
}

function reqPositiveInt(row: Record<string, unknown>, key: string, what: string): number {
  const value = reqNumber(row, key, what);
  if (!Number.isInteger(value) || value <= 0) throw new ApiShapeError(`${what}: ${key} must be a positive integer`);
  return value;
}

function optInt(row: Record<string, unknown>, key: string, what: string): number | null {
  const value = optNumber(row, key, what);
  if (value !== null && !Number.isInteger(value)) throw new ApiShapeError(`${what}: ${key} must be an integer or null`);
  return value;
}

function parseMedia(row: unknown): ApiMedia {
  if (!isRecord(row)) throw new ApiShapeError("media: row must be an object");
  const thumb = row.thumbUrl;
  if (thumb !== undefined && typeof thumb !== "string") throw new ApiShapeError("media: thumbUrl must be a string");
  return {
    url: reqString(row, "url", "media"),
    licence: reqString(row, "licence", "media"),
    credit: reqString(row, "credit", "media"),
    ...(thumb !== undefined ? { thumbUrl: thumb } : {}),
  };
}

function parsePacketSize(row: unknown): ApiPacketSize {
  if (!isRecord(row)) throw new ApiShapeError("packet: row must be an object");
  return { label: reqString(row, "label", "packet"), seedCount: optInt(row, "seedCount", "packet") };
}

function parseSellerRef(row: unknown): ApiSellerRef {
  if (!isRecord(row)) throw new ApiShapeError("seller ref: row must be an object");
  return {
    slug: reqString(row, "slug", "seller ref"),
    name: reqString(row, "name", "seller ref"),
    location: optString(row, "location", "seller ref"),
    region: optString(row, "region", "seller ref"),
    country: reqString(row, "country", "seller ref"),
    isSmallFarm: reqBoolean(row, "isSmallFarm", "seller ref"),
  };
}

function parsePlantRef(row: unknown): ApiPlantRef {
  if (!isRecord(row)) throw new ApiShapeError("plant: row must be an object");
  const methods = reqArray(row, "sowing_methods", "plant");
  for (const method of methods) {
    if (typeof method !== "string" || !SOWING_METHODS.has(method)) {
      throw new ApiShapeError(`plant: unknown sowing method ${JSON.stringify(method)}`);
    }
  }
  return {
    slug: reqString(row, "slug", "plant"),
    commonName: reqString(row, "commonName", "plant"),
    latinName: optString(row, "latinName", "plant"),
    lifeCycle: optString(row, "lifeCycle", "plant"),
    season_class: optEnum<ApiSeasonClass>(row, "season_class", "plant", SEASON_CLASSES),
    season_source_label: optString(row, "season_source_label", "plant"),
    sowing_methods: methods as ApiSowingMethod[],
    sowing_method_source_label: optString(row, "sowing_method_source_label", "plant"),
  };
}

function parseVarietyRef(row: unknown): ApiVarietyRef {
  if (!isRecord(row)) throw new ApiShapeError("variety ref: row must be an object");
  const swatch = optString(row, "colorSwatch", "variety ref");
  if (swatch !== null && !HEX.test(swatch)) throw new ApiShapeError("variety ref: colorSwatch must be a hex color");
  return {
    slug: reqString(row, "slug", "variety ref"),
    varietyName: reqString(row, "varietyName", "variety ref"),
    plant: parsePlantRef(reqRecord(row, "plant", "variety ref")),
    colorSwatch: swatch,
    colorFamily: reqString(row, "colorFamily", "variety ref"),
    media: reqArray(row, "media", "variety ref").map(parseMedia),
    cropMedia: reqArray(row, "cropMedia", "variety ref").map(parseMedia),
  };
}

function parseProvenance(row: unknown): ApiProvenance {
  if (!isRecord(row)) throw new ApiShapeError("provenance: row must be an object");
  const confidence = reqNumber(row, "confidence", "provenance");
  if (confidence < 0 || confidence > 1) throw new ApiShapeError("provenance: confidence must be 0–1");
  return {
    source_url: optHttpUrl(row, "source_url", "provenance"),
    retrieved_at: optDateish(row, "retrieved_at", "provenance"),
    method: reqEnum<ApiMatchMethod>(row, "method", "provenance", MATCH_METHODS),
    confidence,
  };
}

function parseRating(row: unknown): ApiRating {
  if (!isRecord(row)) throw new ApiShapeError("rating: row must be an object");
  const state = reqString(row, "state", "rating");
  if (state !== "not_yet_rated" && state !== "rated") throw new ApiShapeError(`rating: unknown state ${state}`);
  return { state, average: optNumber(row, "average", "rating"), review_count: reqNumber(row, "review_count", "rating") };
}

function parsePublicListing(row: unknown): ApiPublicListing {
  if (!isRecord(row)) throw new ApiShapeError("listing: row must be an object");
  if (row.status !== "published") throw new ApiShapeError("listing: status must be published");
  return {
    id: reqPositiveInt(row, "id", "listing"),
    variety: parseVarietyRef(reqRecord(row, "variety", "listing")),
    seller: parseSellerRef(reqRecord(row, "seller", "listing")),
    availability: parseAvailability(row.availability),
    lastCheckedAt: optDateish(row, "lastCheckedAt", "listing"),
    firstSeenAt: optDateish(row, "firstSeenAt", "listing"),
    goUrl: reqHttpUrl(row, "goUrl", "listing"),
    productUrl: optHttpUrl(row, "productUrl", "listing"),
    notes: optString(row, "notes", "listing"),
    status: "published",
    packetSizes: reqArray(row, "packetSizes", "listing").map(parsePacketSize),
    provenance: parseProvenance(reqRecord(row, "provenance", "listing")),
    sourceLabel: optString(row, "sourceLabel", "listing"),
  };
}

function parseCategoryRef(row: unknown, what: string): { slug: string; name: string } {
  if (!isRecord(row)) throw new ApiShapeError(`${what}: row must be an object`);
  return { slug: reqString(row, "slug", what), name: reqString(row, "name", what) };
}

function parseRange(row: unknown, what: string): { min: number | null; max: number | null } {
  if (!isRecord(row)) throw new ApiShapeError(`${what}: row must be an object`);
  return { min: optInt(row, "min", what), max: optInt(row, "max", what) };
}

function parseVarietyFacts(row: unknown): ApiVarietyFacts {
  if (!isRecord(row)) throw new ApiShapeError("facts: row must be an object");
  return {
    color_family: reqString(row, "color_family", "facts"),
    pollination: reqEnum<ApiPollination>(row, "pollination", "facts", POLLINATION),
    height_cm: parseRange(row.height_cm, "facts height"),
    days_to_bloom: parseRange(row.days_to_bloom, "facts bloom"),
  };
}

function parsePlantGuidance(row: unknown): ApiPlantGuidance {
  if (!isRecord(row)) throw new ApiShapeError("plant: row must be an object");
  return {
    ...parsePlantRef(row),
    description: optString(row, "description", "plant"),
    sowingNotes: optString(row, "sowingNotes", "plant"),
  };
}

/** The summary fields shared by VarietyDetail and VarietyListItem. */
function parseVarietySummary(row: Record<string, unknown>, what: string) {
  const swatch = optString(row, "colorSwatch", what);
  if (swatch !== null && !HEX.test(swatch)) throw new ApiShapeError(`${what}: colorSwatch must be a hex color`);
  const series = row.series;
  if (series !== null && !isRecord(series)) throw new ApiShapeError(`${what}: series must be an object or null`);
  const subcategory = row.subcategory;
  if (subcategory !== null && !isRecord(subcategory)) throw new ApiShapeError(`${what}: subcategory must be an object or null`);
  return {
    slug: reqString(row, "slug", what),
    varietyName: reqString(row, "varietyName", what),
    category: parseCategoryRef(row.category, `${what} category`),
    subcategory: subcategory ? parseCategoryRef(subcategory, `${what} subcategory`) : null,
    series: series ? { slug: reqString(series, "slug", `${what} series`), name: reqString(series, "name", `${what} series`) } : null,
    colorSwatch: swatch,
    colorFamily: reqString(row, "colorFamily", what),
    listingCount: reqNumber(row, "listingCount", what),
    sellerCount: reqNumber(row, "sellerCount", what),
    inStockCount: reqNumber(row, "inStockCount", what),
    lastCheckedAt: optDateish(row, "lastCheckedAt", what),
    indexable: reqBoolean(row, "indexable", what),
    rating: parseRating(reqRecord(row, "rating", what)),
  };
}

function parseVarietyDetail(row: unknown): ApiVarietyDetail {
  if (!isRecord(row)) throw new ApiShapeError("variety detail: row must be an object");
  const tags = reqArray(row, "tags", "variety detail");
  const aliases = reqArray(row, "aliases", "variety detail");
  for (const tag of tags) {
    if (typeof tag !== "string") throw new ApiShapeError("variety detail: tags must be strings");
  }
  for (const alias of aliases) {
    if (typeof alias !== "string") throw new ApiShapeError("variety detail: aliases must be strings");
  }
  return {
    ...parseVarietySummary(row, "variety detail"),
    plant: parsePlantGuidance(reqRecord(row, "plant", "variety detail")),
    description: optString(row, "description", "variety detail"),
    templateDescription: reqString(row, "templateDescription", "variety detail"),
    answer: reqString(row, "answer", "variety detail"),
    sowingNotes: optString(row, "sowingNotes", "variety detail"),
    heightCm: optInt(row, "heightCm", "variety detail"),
    facts: parseVarietyFacts(reqRecord(row, "facts", "variety detail")),
    tags: tags as string[],
    aliases: aliases as string[],
    protection: reqEnum<ApiProtection>(row, "protection", "variety detail", PROTECTION),
    protectionNote: optString(row, "protectionNote", "variety detail"),
    contentLevel: reqEnum<ApiContentLevel>(row, "contentLevel", "variety detail", CONTENT_LEVELS),
    updatedAt: reqDateish(row, "updatedAt", "variety detail"),
    listings: reqArray(row, "listings", "variety detail").map(parsePublicListing),
    media: reqArray(row, "media", "variety detail").map(parseMedia),
  };
}

function parseVarietyListItem(row: unknown): ApiVarietyListItem {
  if (!isRecord(row)) throw new ApiShapeError("variety list item: row must be an object");
  return {
    ...parseVarietySummary(row, "variety list item"),
    plant: parsePlantRef(reqRecord(row, "plant", "variety list item")),
    media: reqArray(row, "media", "variety list item").map(parseMedia),
    cropMedia: reqArray(row, "cropMedia", "variety list item").map(parseMedia),
  };
}

function parseOgSeller(row: unknown): ApiOgSeller {
  if (!isRecord(row)) throw new ApiShapeError("og seller: row must be an object");
  return {
    slug: reqString(row, "slug", "og seller"),
    name: reqString(row, "name", "og seller"),
    location: optString(row, "location", "og seller"),
    varietyCount: reqNumber(row, "varietyCount", "og seller"),
  };
}

const SEARCH_TYPES: ReadonlySet<string> = new Set(["variety", "series", "crop", "seller"]);

function parseSearchResult(row: unknown): ApiSearchResult {
  if (!isRecord(row)) throw new ApiShapeError("search result: row must be an object");
  const type = reqString(row, "type", "search result");
  if (!SEARCH_TYPES.has(type)) throw new ApiShapeError(`search result: unknown type ${JSON.stringify(type)}`);
  const href = reqString(row, "href", "search result");
  if (!href.startsWith("/")) throw new ApiShapeError("search result: href must be a site path");
  return {
    type: type as ApiSearchResult["type"],
    slug: reqString(row, "slug", "search result"),
    title: reqString(row, "title", "search result"),
    subtitle: reqString(row, "subtitle", "search result"),
    href,
    matchedAlias: optString(row, "matchedAlias", "search result"),
  };
}

function parseSearchResponse(row: unknown): ApiSearchResponse {
  if (!isRecord(row)) throw new ApiShapeError("search: response must be an object");
  const list = (key: "results" | "varieties" | "series" | "crops" | "sellers"): ApiSearchResult[] =>
    reqArray(row, key, "search").map(parseSearchResult);
  return {
    query: reqString(row, "query", "search"),
    results: list("results"),
    varieties: list("varieties"),
    series: list("series"),
    crops: list("crops"),
    sellers: list("sellers"),
  };
}

function parseSeriesCrop(row: unknown): ApiSeriesCrop {
  if (!isRecord(row)) throw new ApiShapeError("series: row must be an object");
  return {
    slug: reqString(row, "slug", "series"),
    name: reqString(row, "name", "series"),
    plant: parsePlantRef(reqRecord(row, "crop", "series")),
  };
}

function parseVarietyStatus(row: unknown): ApiVarietyStatus {
  if (!isRecord(row)) throw new ApiShapeError("variety status: row must be an object");
  const status = reqString(row, "status", "variety status");
  if (status !== "active" && status !== "merged" && status !== "unknown") {
    throw new ApiShapeError(`variety status: unknown status ${JSON.stringify(status)}`);
  }
  const mergedInto = optString(row, "merged_into", "variety status");
  if (status === "merged") {
    // A merge with no valid target must fail loudly (500): redirecting
    // nowhere — or to an unvalidated string — would corrupt the redirect map.
    if (!mergedInto || !SLUG_PATTERN.test(mergedInto)) throw new ApiShapeError("variety status: merged_into must be a slug");
    return { status, merged_into: mergedInto };
  }
  return { status, merged_into: null };
}

// --- Shop/hub details (Slice 5): the same JSON GET /api/v1/sellers/[slug],
// GET /api/v1/crops/[slug], and GET /api/v1/series/[slug] serve. ---

const SELLER_LOCATION_KINDS: ReadonlySet<string> = new Set(["physical", "warehouse", "mailing"]);
const CLAIM_STATUSES: ReadonlySet<string> = new Set(["unclaimed", "claimed"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function reqNonnegInt(row: Record<string, unknown>, key: string, what: string): number {
  const value = reqNumber(row, key, what);
  if (!Number.isInteger(value) || value < 0) throw new ApiShapeError(`${what}: ${key} must be a non-negative integer`);
  return value;
}

function reqStrings(row: Record<string, unknown>, key: string, what: string): string[] {
  const values = reqArray(row, key, what);
  for (const v of values) {
    if (typeof v !== "string") throw new ApiShapeError(`${what}: ${key} must be an array of strings`);
  }
  return values as string[];
}

function parseSellerLocation(row: unknown): ApiSellerLocation {
  if (!isRecord(row)) throw new ApiShapeError("seller location: row must be an object");
  return {
    kind: reqEnum<ApiSellerLocationKind>(row, "kind", "seller location", SELLER_LOCATION_KINDS),
    street: optString(row, "street", "seller location"),
    city: reqString(row, "city", "seller location"),
    state: reqString(row, "state", "seller location"),
    zip: optString(row, "zip", "seller location"),
    isPrimary: reqBoolean(row, "isPrimary", "seller location"),
  };
}

function parseImportedRating(row: unknown): ApiImportedRating {
  if (!isRecord(row)) throw new ApiShapeError("imported rating: row must be an object");
  const source = reqString(row, "source", "imported rating");
  if (source !== "Google") throw new ApiShapeError(`imported rating: unknown source ${JSON.stringify(source)}`);
  const rating = reqNumber(row, "rating", "imported rating");
  if (rating < 0 || rating > 5) throw new ApiShapeError("imported rating: rating must be 0–5");
  const fetchedDate = reqString(row, "fetchedDate", "imported rating");
  if (!DATE_ONLY.test(fetchedDate)) throw new ApiShapeError("imported rating: fetchedDate must be YYYY-MM-DD");
  return {
    source,
    placeName: reqString(row, "placeName", "imported rating"),
    placeId: reqString(row, "placeId", "imported rating"),
    rating,
    reviewCount: reqNonnegInt(row, "reviewCount", "imported rating"),
    fetchedDate,
  };
}

function parseSellerDetail(row: unknown): ApiSellerDetail {
  if (!isRecord(row)) throw new ApiShapeError("seller detail: row must be an object");
  const imported = row.importedRating;
  if (imported !== null && !isRecord(imported)) throw new ApiShapeError("seller detail: importedRating must be an object or null");
  return {
    slug: reqString(row, "slug", "seller detail"),
    name: reqString(row, "name", "seller detail"),
    type: reqEnum(row, "type", "seller detail", SELLER_TYPES),
    location: optString(row, "location", "seller detail"),
    region: optString(row, "region", "seller detail"),
    country: reqString(row, "country", "seller detail"),
    homepage: optHttpUrl(row, "homepage", "seller detail"),
    ratingCount: reqNonnegInt(row, "ratingCount", "seller detail"),
    ratingAverage: optNumber(row, "ratingAverage", "seller detail"),
    rating: parseRating(reqRecord(row, "rating", "seller detail")),
    importedRating: imported ? parseImportedRating(imported) : null,
    isSmallFarm: reqBoolean(row, "isSmallFarm", "seller detail"),
    description: optString(row, "description", "seller detail"),
    orderingNotes: optString(row, "orderingNotes", "seller detail"),
    varietyCount: reqNonnegInt(row, "varietyCount", "seller detail"),
    updatedAt: reqDateish(row, "updatedAt", "seller detail"),
    claimStatus: reqEnum(row, "claimStatus", "seller detail", CLAIM_STATUSES),
    shipsTo: reqStrings(row, "shipsTo", "seller detail"),
    isSiteOwner: reqBoolean(row, "isSiteOwner", "seller detail"),
    listings: reqArray(row, "listings", "seller detail").map(parsePublicListing),
    customerServicePhone: optString(row, "customerServicePhone", "seller detail"),
    customerServiceEmail: optString(row, "customerServiceEmail", "seller detail"),
    locations: reqArray(row, "locations", "seller detail").map(parseSellerLocation),
  };
}

function parseSellerStatus(row: unknown): ApiSellerStatus {
  if (!isRecord(row)) throw new ApiShapeError("seller status: row must be an object");
  const status = reqString(row, "status", "seller status");
  if (status !== "ok" && status !== "gone" && status !== "missing") {
    throw new ApiShapeError(`seller status: unknown status ${JSON.stringify(status)}`);
  }
  return { status };
}

function optGuideText(row: Record<string, unknown>, key: string, what: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ApiShapeError(`${what}: ${key} must be a string or null`);
  return value;
}

function parseGrowerGuide(row: unknown): ApiGrowerGuide | null {
  if (row === null || row === undefined) return null;
  if (!isRecord(row)) throw new ApiShapeError("grower guide: row must be an object or null");
  const growing = row.growing;
  const seedSaving = row.seed_saving;
  if (growing !== null && growing !== undefined && !isRecord(growing)) {
    throw new ApiShapeError("grower guide: growing must be an object or null");
  }
  if (seedSaving !== null && seedSaving !== undefined && !isRecord(seedSaving)) {
    throw new ApiShapeError("grower guide: seed_saving must be an object or null");
  }
  return {
    growing:
      growing == null
        ? null
        : {
            sowing: optGuideText(growing, "sowing", "grower guide"),
            germination: optGuideText(growing, "germination", "grower guide"),
            transplanting: optGuideText(growing, "transplanting", "grower guide"),
            days_to_bloom: optGuideText(growing, "days_to_bloom", "grower guide"),
            spacing: optGuideText(growing, "spacing", "grower guide"),
            growing: optGuideText(growing, "growing", "grower guide"),
            harvest_for_cutting: optGuideText(growing, "harvest_for_cutting", "grower guide"),
            good_to_know: reqStrings(growing, "good_to_know", "grower guide"),
          },
    seed_saving:
      seedSaving == null
        ? null
        : {
            difficulty: optGuideText(seedSaving, "difficulty", "grower guide"),
            when_to_harvest: optGuideText(seedSaving, "when_to_harvest", "grower guide"),
            how_to_collect: optGuideText(seedSaving, "how_to_collect", "grower guide"),
            cleaning: optGuideText(seedSaving, "cleaning", "grower guide"),
            drying: optGuideText(seedSaving, "drying", "grower guide"),
            storage: optGuideText(seedSaving, "storage", "grower guide"),
            pollination_notes: optGuideText(seedSaving, "pollination_notes", "grower guide"),
          },
  };
}

function parseCropDetail(row: unknown): ApiCropDetail {
  if (!isRecord(row)) throw new ApiShapeError("crop detail: row must be an object");
  const series = reqArray(row, "series", "crop detail");
  return {
    slug: reqString(row, "slug", "crop detail"),
    commonName: reqString(row, "commonName", "crop detail"),
    latinName: optString(row, "latinName", "crop detail"),
    lifeCycle: optString(row, "lifeCycle", "crop detail"),
    season_class: optEnum<ApiSeasonClass>(row, "season_class", "crop detail", SEASON_CLASSES),
    sowing_methods: parseSowingMethods(row, "sowing_methods", "crop detail"),
    varietyCount: reqNonnegInt(row, "varietyCount", "crop detail"),
    varietiesWithSellers: reqNonnegInt(row, "varietiesWithSellers", "crop detail"),
    lastUpdated: optString(row, "lastUpdated", "crop detail"),
    media: reqArray(row, "media", "crop detail").map((m) => {
      if (!isRecord(m)) throw new ApiShapeError("crop detail media: row must be an object");
      return { url: reqString(m, "url", "crop detail media") };
    }),
    description: optString(row, "description", "crop detail"),
    sowingNotes: optString(row, "sowingNotes", "crop detail"),
    life_cycle: optString(row, "life_cycle", "crop detail"),
    hardiness: optString(row, "hardiness", "crop detail"),
    grower_guide: parseGrowerGuide(row.grower_guide),
    series: series.map((s) => parseCategoryRef(s, "crop detail series")),
    varieties: reqArray(row, "varieties", "crop detail").map(parseVarietyListItem),
  };
}

function parseSeriesDetail(row: unknown): ApiSeriesDetail {
  if (!isRecord(row)) throw new ApiShapeError("series detail: row must be an object");
  return {
    slug: reqString(row, "slug", "series detail"),
    name: reqString(row, "name", "series detail"),
    plant: parsePlantRef(reqRecord(row, "crop", "series detail")),
    varietyCount: reqNonnegInt(row, "varietyCount", "series detail"),
    varietiesWithSellers: reqNonnegInt(row, "varietiesWithSellers", "series detail"),
    varieties: reqArray(row, "varieties", "series detail").map(parseVarietyListItem),
  };
}

export interface CatalogApiOptions {
  /** Base URL of the API, e.g. https://seeds.hues.flowers/api/v1 (no trailing slash). */
  baseUrl: string;
  /**
   * Origin of the app's internal reads (the /api/internal/* mount).
   * Default: baseUrl with its trailing /api/v1 stripped (same deployment).
   */
  internalBaseUrl?: string;
  fetchImpl?: FetchImpl;
  /** Base delay between paged/detail requests (ms). Default 350. */
  paceMs?: number;
  /** 429 retries per request. Default 5. */
  maxRetries?: number;
  userAgent?: string;
}

const DEFAULT_PACE_MS = 350;
const DEFAULT_MAX_RETRIES = 5;

/**
 * The catalog API client. One instance per base URL; prerender `+data` hooks
 * and the machine-file generators share it through the data cache.
 */
export function createCatalogApi(options: CatalogApiOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const internalBase = (options.internalBaseUrl ?? baseUrl.replace(/\/api\/v1$/, "")).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const paceMs = options.paceMs ?? DEFAULT_PACE_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const userAgent = options.userAgent ?? "seeds-hues-app/0.1 (+https://seeds.hues.flowers/about/bot)";
  // Pace state is a PLAIN NUMBER — the earliest timestamp (ms) the next
  // fetch may start — never a promise. The Worker shares one client per
  // isolate across requests, and under workerd's
  // handle_cross_request_promise_resolution a promise created by a request
  // that has since ended can never settle: a stored chain's trailing sleep
  // would outlive its response, poison the isolate, and 500 every later
  // fresh read. Each call reserves its slot synchronously (concurrent
  // callers take successive slots, so fetches still start >= paceMs apart
  // even when callers fire concurrently — the live API's per-IP rate limit
  // is shared) and awaits only a sleep created within its own call.
  let nextSlotMs = 0;

  const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

  /** Reserve this call's start slot; sleep the remainder within this call only. */
  async function takePaceSlot(): Promise<void> {
    const nowMs = Date.now();
    const slot = Math.max(nowMs, nextSlotMs);
    nextSlotMs = slot + paceMs;
    const waitMs = slot - nowMs;
    if (waitMs > 0) await sleep(waitMs);
  }

  async function getRaw(path: string, init?: { ifNoneMatch?: string }): Promise<{ status: number; etag: string | null; json: () => Promise<unknown> }> {
    const headers: Record<string, string> = { "User-Agent": userAgent };
    if (init?.ifNoneMatch) headers["If-None-Match"] = init.ifNoneMatch;
    for (let attempt = 0; ; attempt++) {
      await takePaceSlot();
      const res = await fetchImpl(`${baseUrl}${path}`, { headers });
      if (res.status === 429 && attempt < maxRetries) {
        const waitMs = Number(res.headers.get("retry-after") ?? "10") * 1000;
        await sleep(Number.isFinite(waitMs) ? waitMs + 250 : 10_250);
        continue;
      }
      if (res.status === 304) return { status: 304, etag: null, json: async () => null };
      if (!res.ok) throw new ApiRequestError(`GET ${path} -> HTTP ${res.status}`, res.status);
      return { status: res.status, etag: res.headers.get("etag"), json: () => res.json() as Promise<unknown> };
    }
  }

  function parseEnvelope<T>(json: unknown, path: string, parseItem: (row: unknown) => T): ApiEnvelope<T[]> {
    if (!isRecord(json)) throw new ApiShapeError(`${path}: envelope must be an object`);
    const error = json.error;
    if (error !== null && error !== undefined) {
      const code = isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
      throw new ApiRequestError(`GET ${path} -> API error ${code}`, 200);
    }
    const meta = reqRecord(json, "meta", `${path} envelope`);
    const page = reqRecord(json, "page", `${path} envelope`);
    const nextCursor = meta.nextCursor;
    if (nextCursor !== null && typeof nextCursor !== "string") throw new ApiShapeError(`${path}: meta.nextCursor must be a string or null`);
    return {
      data: reqArray(json, "data", `${path} envelope`).map(parseItem),
      page: {
        next_cursor: typeof page.next_cursor === "string" ? page.next_cursor : null,
        has_more: page.has_more === true,
      },
      meta: {
        nextCursor,
        count: reqNumber(meta, "count", `${path} meta`),
        total: optNumber(meta, "total", `${path} meta`) ?? undefined,
        catalog_seq: optNumber(meta, "catalog_seq", `${path} meta`) ?? undefined,
        generated_at: reqString(meta, "generated_at", `${path} meta`),
      },
      error: null,
    };
  }

  async function walkList<T>(path: string, params: Record<string, string>, parseItem: (row: unknown) => T): Promise<{ items: T[]; total: number }> {
    const items: T[] = [];
    let cursor: string | null = null;
    let total = 0;
    for (;;) {
      const query = new URLSearchParams({ ...params, ...(cursor ? { cursor } : {}) });
      const res = await getRaw(`${path}?${query.toString()}`);
      const envelope = parseEnvelope(await res.json(), path, parseItem);
      items.push(...envelope.data);
      total = envelope.meta.total ?? total;
      cursor = envelope.page.next_cursor;
      if (!envelope.page.has_more || !cursor) break;
    }
    return { items, total: total || items.length };
  }

  return {
    /** Every crop with coverage counts + media (the /crop index + home grid source). */
    async listCrops(): Promise<{ items: ApiCrop[]; total: number }> {
      return walkList("/crops", { limit: "100" }, parseCrop);
    },
    /** Every visible seller (llms.txt + counts source). */
    async listSellers(): Promise<{ items: ApiSellerItem[]; total: number }> {
      return walkList("/sellers", { limit: "100" }, parseSellerItem);
    },
    /** Per-crop coverage (the home coverage line source). */
    async coverage(): Promise<ApiCoverageItem[]> {
      const res = await getRaw("/coverage");
      return parseEnvelope(await res.json(), "/coverage", parseCoverageItem).data;
    },
    /** Latest listing events (the home recent strip). */
    async recent(limit: number): Promise<ApiRecentItem[]> {
      const res = await getRaw(`/recent?${new URLSearchParams({ limit: String(limit) }).toString()}`);
      return parseEnvelope(await res.json(), "/recent", parseRecentItem).data;
    },
    /**
     * The bulk snapshot (sitemap membership + listings count). Conditional:
     * pass the cached ETag (seq-N) and a 304 resolves { notModified: true }
     * without transferring the ~1 MB body.
     */
    async snapshot(ifNoneMatch?: string): Promise<{ notModified: true } | { data: SyncSnapshotData; etag: string | null }> {
      const res = await getRaw("/sync/snapshot", ifNoneMatch ? { ifNoneMatch } : undefined);
      if (res.status === 304) return { notModified: true };
      const json = await res.json();
      if (!isRecord(json)) throw new ApiShapeError("/sync/snapshot: body must be an object");
      const reqRows = (key: string): Record<string, unknown>[] =>
        reqArray(json, key, "/sync/snapshot").map((row) => {
          if (!isRecord(row)) throw new ApiShapeError(`/sync/snapshot: ${key} row must be an object`);
          return row;
        });
      return {
        data: {
          catalog_seq: reqNumber(json, "catalog_seq", "/sync/snapshot"),
          schema_version: reqNumber(json, "schema_version", "/sync/snapshot"),
          generated_at: reqString(json, "generated_at", "/sync/snapshot"),
          crops: reqRows("crops").map((r) => ({ id: reqNumber(r, "id", "sync crop"), slug: reqString(r, "slug", "sync crop"), updated_seq: reqNumber(r, "updated_seq", "sync crop") })),
          series: reqRows("series").map((r) => ({ id: reqNumber(r, "id", "sync series"), slug: reqString(r, "slug", "sync series"), updated_seq: reqNumber(r, "updated_seq", "sync series") })),
          varieties: reqRows("varieties").map((r) => ({
            id: reqNumber(r, "id", "sync variety"),
            slug: reqString(r, "slug", "sync variety"),
            indexable: reqBoolean(r, "indexable", "sync variety"),
            updated_seq: reqNumber(r, "updated_seq", "sync variety"),
          })),
          sellers: reqRows("sellers").map((r) => ({
            id: reqNumber(r, "id", "sync seller"),
            slug: reqString(r, "slug", "sync seller"),
            region: optString(r, "region", "sync seller"),
            country: reqString(r, "country", "sync seller"),
            updated_seq: reqNumber(r, "updated_seq", "sync seller"),
          })),
          listings: reqRows("listings").map((r) => ({ id: reqNumber(r, "id", "sync listing"), variety_id: reqNumber(r, "variety_id", "sync listing"), seller_id: reqNumber(r, "seller_id", "sync listing") })),
        },
        etag: res.etag,
      };
    },
    /** Catalog totals (coverage line, llms.txt, hubs). Listings come from the snapshot. */
    async counts(getSnapshot: () => Promise<SyncSnapshotData>): Promise<CatalogCounts> {
      const [varieties, plants, sellers, snap] = await Promise.all([
        getRaw("/varieties?limit=1").then(async (r) => parseEnvelope(await r.json(), "/varieties", (row) => row).meta.total ?? 0),
        getRaw("/crops?limit=1").then(async (r) => parseEnvelope(await r.json(), "/crops", (row) => row).meta.total ?? 0),
        getRaw("/sellers?limit=1").then(async (r) => parseEnvelope(await r.json(), "/sellers", (row) => row).meta.total ?? 0),
        getSnapshot(),
      ]);
      return { varieties, plants, sellers, listings: snap.listings.length };
    },
    /**
     * One variety with its listings, media, facts, and prose (GET
     * /api/v1/varieties/[slug]) — the variety page's one read. Unknown or
     * merged slugs 404 at the API and resolve null here (merged slugs
     * redirect via mergedVarietyTarget, below).
     */
    async getVarietyDetail(slug: string): Promise<ApiVarietyDetail | null> {
      try {
        const res = await getRaw(`/varieties/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/varieties/${slug}: detail must be an object`);
        return parseVarietyDetail(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
    /**
     * Every variety of the given crops (the sibling-strip source). The public
     * API has no availability sort (v2 keeps that vocabulary service-side),
     * so this walks the whole filtered set and the loader applies v2's
     * availability comparator read-side.
     */
    async listVarietyListItems(opts: { plant: string[] }): Promise<{ items: ApiVarietyListItem[]; total: number }> {
      return walkList("/varieties", { limit: "100", plant: opts.plant.join(",") }, parseVarietyListItem);
    },
    /**
     * Slice 4 browse reads. The live API's cursors are opaque (offset +
     * query fingerprint — v2's pagination.ts), so no caller can jump to an
     * arbitrary page: every read walks from offset 0 and the loader slices,
     * sorts, and counts read-side over the walked set.
     *
     * sort is the v1 vocabulary only ("name" | "-recently_checked" here —
     * the browse surface's two server sorts): "availability" is deliberately
     * NOT in VARIETY_SORTS (the live API 400s it), so the loader applies
     * v2's availability comparator read-side over the walked set.
     */
    async walkVarieties(
      filters: { season?: string; methods?: string[]; lifeCycle?: string[]; colorFamily?: string[]; smallFarmOnly?: boolean },
      sort: "name" | "-recently_checked",
    ): Promise<{ items: ApiVarietyListItem[]; total: number }> {
      const params: Record<string, string> = { limit: "100", sort };
      if (filters.season) params.season = filters.season;
      if (filters.methods?.length) params.method = filters.methods.join(",");
      if (filters.lifeCycle?.length) params.life_cycle = filters.lifeCycle.join(",");
      if (filters.colorFamily?.length) params.color_family = filters.colorFamily.join(",");
      if (filters.smallFarmOnly) params.small_farm = "true";
      return walkList("/varieties", params, parseVarietyListItem);
    },
    /** The filtered variety total (one limit=1 read — the counts matrix's out-of-walk cells). */
    async countVarieties(filters: {
      season?: string;
      methods?: string[];
      lifeCycle?: string[];
      colorFamily?: string[];
      smallFarmOnly?: boolean;
    }): Promise<number> {
      const params: Record<string, string> = { limit: "1" };
      if (filters.season) params.season = filters.season;
      if (filters.methods?.length) params.method = filters.methods.join(",");
      if (filters.lifeCycle?.length) params.life_cycle = filters.lifeCycle.join(",");
      if (filters.colorFamily?.length) params.color_family = filters.colorFamily.join(",");
      if (filters.smallFarmOnly) params.small_farm = "true";
      const res = await getRaw(`/varieties?${new URLSearchParams(params).toString()}`);
      return parseEnvelope(await res.json(), "/varieties", (row) => row).meta.total ?? 0;
    },
    /**
     * Every visible seller, optionally narrowed to USPS regions (the seller
     * index's one walk — the state cloud, its counts, and the page window
     * all derive read-side from this set).
     */
    async walkSellers(filters: { region?: string[] } = {}): Promise<{ items: ApiSellerItem[]; total: number }> {
      const params: Record<string, string> = { limit: "100" };
      if (filters.region?.length) params.region = filters.region.join(",");
      return walkList("/sellers", params, parseSellerItem);
    },
    /**
     * The /search read: one UNFILTERED grouped response (limit 50 — the live
     * caps are then 50 varieties, 5 per other group, exactly v2's
     * browseSearch caps). v1's search takes no life_cycle filter and no
     * hue-per-group semantics, so the loader applies every filter read-side
     * over this response — the same matches v2's count matrix recomputes
     * per state, computed once and filtered locally.
     */
    async searchWide(q: string): Promise<ApiSearchResponse> {
      const res = await getRaw(`/search?${new URLSearchParams({ q, limit: "50" }).toString()}`);
      const json = await res.json();
      if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError("/search: response must be an object");
      return parseSearchResponse(json.data);
    },
    /**
     * A series' crop (GET /api/v1/series/[slug] subset — the plant-level
     * fields the /search read-side filter needs for series results). Read
     * once per matched series slug (≤5 per search, cached). Unknown slugs
     * 404 at the API and resolve null.
     */
    async seriesCrop(slug: string): Promise<ApiSeriesCrop | null> {
      try {
        const res = await getRaw(`/series/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/series/${slug}: detail must be an object`);
        return parseSeriesCrop(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
    /**
     * One seller with its full listing set, contacts, and locations (GET
     * /api/v1/sellers/[slug]) — the shop page's one read. Unknown slugs
     * 404 and removed sellers 410 at the API; both resolve null here and
     * the route splits gone from missing through sellerStatus, below (the
     * status lookup is the source of truth, like v2's middleware).
     */
    async getSellerDetail(slug: string): Promise<ApiSellerDetail | null> {
      try {
        const res = await getRaw(`/sellers/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/sellers/${slug}: detail must be an object`);
        return parseSellerDetail(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && (error.status === 404 || error.status === 410)) return null;
        throw error;
      }
    },
    /**
     * The removed-seller lookup (GET /api/internal/seller-status/[slug] —
     * v2's shipped precedent): ok/gone/missing. Non-200s throw (fail
     * closed, like the variety-status lookup): a silent 404 for a removed
     * seller would corrupt the index signal.
     */
    async sellerStatus(slug: string): Promise<ApiSellerStatus> {
      const res = await fetchImpl(`${internalBase}/api/internal/seller-status/${slug}`, {
        headers: { "User-Agent": userAgent },
      });
      if (!res.ok) throw new ApiRequestError(`GET /api/internal/seller-status/${slug} -> HTTP ${res.status}`, res.status);
      return parseSellerStatus((await res.json()) as unknown);
    },
    /**
     * One crop with its FULL variety set: the public crops/[slug] endpoint
     * serves resting Name A–Z windows (cursor-paged, no filter params), so
     * this walks every window and assembles the set the hub filters,
     * sorts, and paginates read-side. Unknown slugs 404 at the API and
     * resolve null.
     */
    async walkCropDetail(slug: string): Promise<{ detail: ApiCropDetail; total: number } | null> {
      let cursor: string | null = null;
      let head: ApiCropDetail | null = null;
      const varieties: ApiVarietyListItem[] = [];
      for (;;) {
        const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
        let res;
        try {
          res = await getRaw(`/crops/${slug}?${query.toString()}`);
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 404) return null;
          throw error;
        }
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) {
          throw new ApiShapeError(`/crops/${slug}: detail must be an object`);
        }
        const window = parseCropDetail(json.data);
        if (!head) head = window;
        varieties.push(...window.varieties);
        const pageInfo = reqRecord(json, "page", `/crops/${slug} envelope`);
        const next = typeof pageInfo.next_cursor === "string" ? pageInfo.next_cursor : null;
        if (pageInfo.has_more !== true || !next) break;
        cursor = next;
      }
      if (!head) return null;
      return { detail: { ...head, varieties }, total: varieties.length };
    },
    /**
     * One series with ALL its varieties (GET /api/v1/series/[slug]) — the
     * series hub's one read (no pagination on this template). Unknown
     * slugs 404 at the API and resolve null.
     */
    async getSeriesDetail(slug: string): Promise<ApiSeriesDetail | null> {
      try {
        const res = await getRaw(`/series/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/series/${slug}: detail must be an object`);
        return parseSeriesDetail(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
    /**
     * The merged-variety lookup (GET /api/internal/variety-status/[slug]):
     * the survivor's slug for a merged slug, null otherwise. Non-200s throw
     * (fail closed, like v2's page): a silent null would 404 a merged slug
     * instead of redirecting it.
     */
    async mergedVarietyTarget(slug: string): Promise<string | null> {
      const res = await fetchImpl(`${internalBase}/api/internal/variety-status/${slug}`, {
        headers: { "User-Agent": userAgent },
      });
      if (!res.ok) throw new ApiRequestError(`GET /api/internal/variety-status/${slug} -> HTTP ${res.status}`, res.status);
      const status = parseVarietyStatus((await res.json()) as unknown);
      return status.status === "merged" ? status.merged_into : null;
    },
    /** The seller fields the OG card reads (subset of GET /sellers/[slug]). */
    async ogSeller(slug: string): Promise<ApiOgSeller | null> {
      try {
        const res = await getRaw(`/sellers/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/sellers/${slug}: detail must be an object`);
        return parseOgSeller(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
    /** The crop fields the OG card reads (GET /crops/[slug], the list shape). */
    async ogCrop(slug: string): Promise<ApiCrop | null> {
      try {
        const res = await getRaw(`/crops/${slug}`);
        const json = await res.json();
        if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/crops/${slug}: detail must be an object`);
        return parseCrop(json.data);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
    /** A variety's updatedAt (lastmod refresh — the list endpoint carries no date). */
    async varietyUpdatedAt(slug: string): Promise<string> {
      const res = await getRaw(`/varieties/${slug}`);
      const json = await res.json();
      if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/varieties/${slug}: detail must be an object`);
      return reqString(json.data, "updatedAt", `/varieties/${slug}`);
    },
    /** A seller's updatedAt (lastmod refresh). */
    async sellerUpdatedAt(slug: string): Promise<string> {
      const res = await getRaw(`/sellers/${slug}`);
      const json = await res.json();
      if (!isRecord(json) || !isRecord(json.data)) throw new ApiShapeError(`/sellers/${slug}: detail must be an object`);
      return reqString(json.data, "updatedAt", `/sellers/${slug}`);
    },
    /** The OpenAPI document (the api-docs page renders from this, verbatim). */
    async openapi(): Promise<OpenApiDoc> {
      const res = await getRaw("/openapi.json");
      const json = await res.json();
      if (!isRecord(json)) throw new ApiShapeError("/openapi.json: document must be an object");
      const info = reqRecord(json, "info", "/openapi.json");
      const paths = reqRecord(json, "paths", "/openapi.json");
      for (const [path, item] of Object.entries(paths)) {
        if (!isRecord(item)) throw new ApiShapeError(`/openapi.json: path ${path} must be an object`);
      }
      return {
        info: { description: reqString(info, "description", "/openapi.json info"), version: reqString(info, "version", "/openapi.json info") },
        paths: paths as OpenApiDoc["paths"],
      };
    },
  };
}

export type CatalogApi = ReturnType<typeof createCatalogApi>;
