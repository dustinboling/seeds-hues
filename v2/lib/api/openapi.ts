/**
 * OpenAPI 3.1 document generated from the Zod schemas in lib/validators (single source of truth).
 * Zod 4's native JSON Schema output (draft 2020-12) is OpenAPI 3.1-compatible.
 * Internal routes (/api/revalidate, /api/track) are deliberately NOT documented.
 */
import { z } from "zod";
import * as V from "@/lib/validators";

type Json = Record<string, unknown>;

const COMPONENT_SCHEMAS = {
  CategoryRef: V.CategoryRefSchema,
  PlantRef: V.PlantRefSchema,
  SeriesRef: V.SeriesRefSchema,
  PacketSize: V.PacketSizeSchema,
  Rating: V.RatingSchema,
  ImportedRating: V.ImportedRatingSchema,
  Provenance: V.ProvenanceSchema,
  SellerRef: V.SellerRefSchema,
  VarietyRef: V.VarietyRefSchema,
  Listing: V.PublicListingSchema,
  SellerSummary: V.SellerSummarySchema,
  VarietySummary: V.VarietySummarySchema,
  VarietyListItem: V.VarietyListItemSchema,
  VarietyFacts: V.VarietyFactsSchema,
  Media: V.MediaSchema,
  PlantGuidance: V.PlantGuidanceSchema,
  VarietyDetail: V.VarietyDetailSchema,
  SellerListItem: V.SellerListItemSchema,
  SellerDetail: V.SellerDetailSchema,
  Subcategory: V.SubcategorySchema,
  Category: V.CategorySchema,
  CategoryDetail: V.CategoryDetailSchema,
  CropListItem: V.CropListItemSchema,
  GrowerGuide: V.GrowerGuideSchema,
  CropDetail: V.CropDetailSchema,
  SeriesDetail: V.SeriesDetailSchema,
  CoverageItem: V.CoverageItemSchema,
  RecentItem: V.RecentItemSchema,
  SearchResult: V.SearchResultSchema,
  SearchResponse: V.SearchResponseSchema,
  CatalogVersion: V.CatalogVersionSchema,
  SyncSnapshot: V.SyncSnapshotSchema,
  SyncChanges: V.SyncChangesSchema,
  Page: V.PageSchema,
  PageMeta: V.PageMetaSchema,
  ErrorResponse: V.ErrorBodySchema,
  Problem: V.ProblemSchema,
} as const;

export const DOCUMENTED_PATHS = [
  "/crops",
  "/crops/{slug}",
  "/varieties",
  "/varieties/{slug}",
  "/varieties/{slug}/listings",
  "/series/{slug}",
  "/sellers",
  "/sellers/{slug}",
  "/sellers/{slug}/listings",
  "/categories",
  "/categories/{slug}",
  "/search",
  "/coverage",
  "/recent",
  "/sync/snapshot",
  "/sync/changes",
  "/reports",
  "/catalog/version",
  "/catalog/snapshot/{version}.sqlite",
  "/openapi.json",
] as const;

let cachedComponents: Record<string, Json> | null = null;

export function componentSchemas(): Record<string, Json> {
  if (cachedComponents) return cachedComponents;
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(COMPONENT_SCHEMAS)) registry.add(schema, { id });
  const out = z.toJSONSchema(registry, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "any",
    uri: (id) => `#/components/schemas/${id}`,
  }) as { schemas: Record<string, Json> };
  const schemas: Record<string, Json> = {};
  for (const [id, s] of Object.entries(out.schemas)) {
    const { $schema: _drop, $id: _id, ...rest } = s as Json & { $schema?: string; $id?: string };
    void _drop;
    void _id;
    schemas[id] = rest;
  }
  cachedComponents = schemas;
  return schemas;
}

const ref = (id: keyof typeof COMPONENT_SCHEMAS) => ({ $ref: `#/components/schemas/${id}` });

function envelope(data: Json): Json {
  return {
    type: "object",
    required: ["data", "page", "meta", "error"],
    properties: { data, page: ref("Page"), meta: ref("PageMeta"), error: { type: "null" } },
  };
}

const errorResponses = (codes: number[]) =>
  Object.fromEntries(
    codes.map((c) => [
      String(c),
      {
        description:
          { 400: "Validation error", 404: "Not found", 405: "Method not allowed", 410: "Gone", 429: "Rate limited", 500: "Internal error" }[c] ??
          "Error",
        content: { "application/json": { schema: ref("ErrorResponse") } },
        ...(c === 429 ? { headers: { "Retry-After": { schema: { type: "integer" } } } } : {}),
      },
    ]),
  );

const problems = (codes: number[]) =>
  Object.fromEntries(
    codes.map((c) => [String(c), { description: `Problem (${c})`, content: { "application/problem+json": { schema: ref("Problem") } } }]),
  );

const commonHeaders = {
  ETag: { schema: { type: "string" }, description: "Strong content hash; send as If-None-Match for 304." },
  "Cache-Control": { schema: { type: "string" } },
  "X-API-Version": { schema: { type: "string", const: "1" } },
};

function ok(description: string, schema: Json): Json {
  return {
    "200": { description, headers: commonHeaders, content: { "application/json": { schema } } },
    "304": { description: "Not modified (If-None-Match matched the ETag)" },
  };
}

const p = {
  slug: { name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } },
  cursor: { name: "cursor", in: "query", schema: { type: "string" }, description: "Opaque cursor from meta.nextCursor." },
  limit: {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 24 },
    description: "Out-of-range values are clamped; non-numeric values return 400.",
  },
  filter: (name: string, description: string) => ({ name, in: "query", schema: { type: "string" }, description }),
};

function get(operationId: string, summary: string, parameters: Json[], responses: Json, tags: string[]): Json {
  return { get: { operationId, summary, tags, parameters, responses } };
}

const listParam = (name: string, description: string) => ({ name, in: "query", schema: { type: "string" }, description: `${description} (comma-separated for several)` });
/** Single-valued crop season filter (cool = Cool Season Hardy Annuals, warm = Warm Season Tender Annuals). */
const seasonParam = (scope: string) => ({
  name: "season",
  in: "query",
  schema: { type: "string", enum: ["cool", "warm"] },
  description: `${scope} whose crop is a Cool Season Hardy Annual (cool) or a Warm Season Tender Annual (warm). Unclassified crops never match; any other value returns 400.`,
});

/** Crop sowing-method filter (direct = Direct Sow, trays = Start Indoors); ANY-of. */
const methodParam = (scope: string) => ({
  name: "method",
  in: "query",
  style: "form",
  explode: true,
  schema: { type: "array", items: { type: "string", enum: ["direct", "trays"] } },
  description: `${scope} whose crop can be direct sown (direct) or started indoors and transplanted (trays). Repeat the parameter or comma-separate values; a crop with any selected method matches (a crop with both matches either). Crops without sowing-method data never match; any other value returns 400.`,
});

/** Crop life-cycle filter (annual | biennial | perennial: how the crop is grown); ANY-of. */
const lifeCycleParam = (scope: string) => ({
  name: "life_cycle",
  in: "query",
  style: "form",
  explode: true,
  schema: { type: "array", items: { type: "string", enum: [...V.LIFE_CYCLE_PARAMS] } },
  description: `${scope} whose crop is grown as an annual (annual), a biennial (biennial) or a perennial (perennial), as derived from the crop's life_cycle: a "grown as an annual" qualifier puts a tender or short-lived perennial under annual only, and "or" wordings (e.g. "Annual or biennial") count for each habit named. Repeat the parameter or comma-separate values; a crop in any selected bucket matches. Crops without a life cycle never match; any other value returns 400.`,
});

export function buildOpenApiDocument(siteUrl: string): Json {
  const listing = (summary: string, op: string, filters: Json[], tag: string): Json =>
    get(op, summary, [p.slug, ...filters], { ...ok(summary, envelope({ type: "array", items: ref("Listing") })), ...errorResponses([400, 404, 410, 429, 500]) }, [tag]);
  const paths: Record<string, Json> = {
    "/crops": get(
      "listCrops",
      "All crops with coverage counts",
      [seasonParam("Only crops"), methodParam("Only crops"), lifeCycleParam("Only crops"), p.cursor, p.limit],
      { ...ok("Page of crops", envelope({ type: "array", items: ref("CropListItem") })), ...errorResponses([400, 429, 500]) },
      ["crops"],
    ),
    "/crops/{slug}": get(
      "getCrop",
      "One crop with its series and a page of its varieties",
      [p.slug, p.cursor, p.limit],
      { ...ok("Crop", envelope(ref("CropDetail"))), ...errorResponses([400, 404, 429, 500]) },
      ["crops"],
    ),
    "/varieties": get(
      "listVarieties",
      "Paged varieties",
      [
        listParam("crop", "Crop slug"),
        listParam("series", "Series slug"),
        listParam("color_family", `Hue: ${[...V.COLOR_FAMILIES, "unknown"].join(" | ")}`),
        listParam("pollination", "open_pollinated | f1_hybrid | unknown"),
        seasonParam("Only varieties"),
        methodParam("Only varieties"),
        lifeCycleParam("Only varieties"),
        { name: "has_listings", in: "query", schema: { type: "boolean" } },
        { name: "in_stock", in: "query", schema: { type: "boolean" } },
        p.filter("category", "Category slug"),
        p.filter("subcategory", "Subcategory slug"),
        p.filter("seller", "Seller slug"),
        p.filter("tag", "Tag"),
        {
          name: "sort",
          in: "query",
          schema: { type: "string", enum: ["name", "-name", "recently_checked", "-recently_checked", "listing_count", "-listing_count"], default: "name" },
        },
        p.cursor,
        p.limit,
      ],
      { ...ok("Page of varieties", envelope({ type: "array", items: ref("VarietyListItem") })), ...errorResponses([400, 429, 500]) },
      ["varieties"],
    ),
    "/varieties/{slug}": get(
      "getVariety",
      "One variety: names, facts, rating, listings",
      [p.slug],
      { ...ok("Variety", envelope(ref("VarietyDetail"))), ...errorResponses([404, 429, 500]) },
      ["varieties"],
    ),
    "/varieties/{slug}/listings": listing(
      "Published listings for a variety",
      "listVarietyListings",
      [listParam("availability", "in_stock | sold_out | preorder | shop_closed | unknown"), listParam("ships_to", "Region code")],
      "varieties",
    ),
    "/series/{slug}": get(
      "getSeries",
      "A series with its member varieties",
      [p.slug],
      { ...ok("Series", envelope(ref("SeriesDetail"))), ...errorResponses([404, 429, 500]) },
      ["series"],
    ),
    "/sellers": get(
      "listSellers",
      "Approved sellers",
      [listParam("region", "Region code, e.g. WA"), p.filter("q", "Name contains"), p.cursor, p.limit],
      { ...ok("Page of sellers", envelope({ type: "array", items: ref("SellerListItem") })), ...errorResponses([400, 429, 500]) },
      ["sellers"],
    ),
    "/sellers/{slug}": get(
      "getSeller",
      "One seller with profile, rating and listings (410 once removed at its request)",
      [p.slug],
      { ...ok("Seller", envelope(ref("SellerDetail"))), ...errorResponses([404, 410, 429, 500]) },
      ["sellers"],
    ),
    "/sellers/{slug}/listings": listing(
      "That seller's listings",
      "listSellerListings",
      [listParam("crop", "Crop slug"), listParam("availability", "Availability")],
      "sellers",
    ),
    "/categories": get(
      "listCategories",
      "Categories with subcategories and variety counts",
      [],
      { ...ok("Categories", envelope({ type: "array", items: ref("Category") })), ...errorResponses([429, 500]) },
      ["categories"],
    ),
    "/categories/{slug}": get(
      "getCategory",
      "One category and a page of its varieties",
      [p.slug, p.cursor, p.limit],
      { ...ok("Category", envelope(ref("CategoryDetail"))), ...errorResponses([400, 404, 429, 500]) },
      ["categories"],
    ),
    "/search": get(
      "search",
      "Mixed results: varieties, series, crops, sellers. Two characters search; synonyms match and are flagged (matchedAlias). 60/min/IP.",
      [
        { name: "q", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 100 } },
        listParam("type", "variety | series | crop | seller"),
        seasonParam("Only crops, series and varieties (sellers are unaffected)"),
        methodParam("Only crops, series and varieties (sellers are unaffected)"),
        listParam("color_family", `Only varieties of this hue, ${V.COLOR_FAMILIES.join(" | ")} (crops, series and sellers are unaffected)`),
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } },
      ],
      { ...ok("Search results", envelope(ref("SearchResponse"))), ...errorResponses([400, 429, 500]) },
      ["search"],
    ),
    "/coverage": get(
      "getCoverage",
      "Per crop: varieties, varieties with sellers, last updated",
      [],
      { ...ok("Coverage", envelope({ type: "array", items: ref("CoverageItem") })), ...errorResponses([429, 500]) },
      ["crops"],
    ),
    "/recent": get(
      "getRecent",
      "Recently restocked and newly listed",
      [listParam("crop", "Crop slug"), p.filter("since", "ISO date"), p.limit],
      { ...ok("Recent listing events", envelope({ type: "array", items: ref("RecentItem") })), ...errorResponses([400, 429, 500]) },
      ["listings"],
    ),
    "/sync/snapshot": get(
      "getSyncSnapshot",
      "The full public catalog for on-device storage. ETag derives from catalog_seq.",
      [],
      {
        "200": { description: "Snapshot", headers: commonHeaders, content: { "application/json": { schema: ref("SyncSnapshot") } } },
        "304": { description: "Not modified" },
        ...problems([429, 500]),
      },
      ["sync"],
    ),
    "/sync/changes": get(
      "getSyncChanges",
      "Upserts and tombstones after a catalog_seq (400 if since is ahead; 410 resync_required if out of range)",
      [
        { name: "since", in: "query", required: true, schema: { type: "integer" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000, default: 500 } },
      ],
      { ...ok("Changes", envelope(ref("SyncChanges"))), ...problems([400, 410, 429, 500]) },
      ["sync"],
    ),
    "/reports": {
      post: {
        operationId: "createReport",
        summary: "A correction, claim or removal request (3/min/IP; Turnstile token when configured)",
        tags: ["reports"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "target_type", "target_ref", "message", "contact"],
                properties: {
                  type: { type: "string", enum: ["correct", "claim", "remove"] },
                  target_type: { type: "string", enum: ["variety", "seller"] },
                  target_ref: { type: "string" },
                  message: { type: "string", minLength: 5, maxLength: 4000 },
                  contact: { type: "string", format: "email" },
                  turnstile_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Report stored and queued for review" }, ...problems([400, 403, 404, 429, 500]) },
      },
    },
    "/catalog/version": get(
      "getCatalogVersion",
      "Current published catalog version (never cached: Cache-Control no-store)",
      [],
      { ...ok("Catalog version", envelope(ref("CatalogVersion"))), ...errorResponses([429, 500]) },
      ["catalog"],
    ),
    "/catalog/snapshot/{version}.sqlite": get(
      "getCatalogSnapshot",
      "Download the published SQLite snapshot of the public catalog tables for a version",
      [{ name: "version", in: "path", required: true, schema: { type: "integer", minimum: 1 } }],
      {
        "200": {
          description: "SQLite database file",
          content: { "application/vnd.sqlite3": { schema: { type: "string", contentMediaType: "application/vnd.sqlite3" } } },
        },
        "304": { description: "Not modified" },
        ...errorResponses([404, 429, 500]),
      },
      ["catalog"],
    ),
    "/openapi.json": get(
      "getOpenApi",
      "This OpenAPI 3.1 document",
      [],
      { "200": { description: "OpenAPI document", content: { "application/json": { schema: { type: "object" } } } } },
      ["meta"],
    ),
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "seeds.hues.flowers public API",
      version: "1.0.0",
      description:
        "Catalog of flower seed varieties and the small farms that sell them. Reads are public. Envelope " +
        "{ data, page, meta, error }; page holds next_cursor + has_more, meta holds catalog_seq + generated_at. " +
        "No prices are published. Every listing carries provenance; every variety and seller carries rating " +
        '("not_yet_rated" until real reviews exist). Unknown values are explicit ("unknown" or null). ' +
        "New endpoints (sync, reports) answer errors as application/problem+json. Breaking changes ship as /api/v2.",
    },
    servers: [{ url: `${siteUrl}/api/v1` }],
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    tags: ["crops", "varieties", "series", "sellers", "listings", "categories", "search", "sync", "reports", "catalog", "meta"].map((name) => ({ name })),
    paths,
    components: { schemas: componentSchemas() },
  };
}
