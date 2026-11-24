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
  ApiCoverageItem,
  ApiCrop,
  ApiEnvelope,
  ApiRecentItem,
  ApiSellerItem,
  CatalogCounts,
  OpenApiDoc,
  SyncSnapshotData,
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

function parseCrop(row: unknown): ApiCrop {
  if (!isRecord(row)) throw new ApiShapeError("crop: row must be an object");
  return {
    slug: reqString(row, "slug", "crop"),
    commonName: reqString(row, "commonName", "crop"),
    latinName: optString(row, "latinName", "crop"),
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

function parseSellerItem(row: unknown): ApiSellerItem {
  if (!isRecord(row)) throw new ApiShapeError("seller: row must be an object");
  return {
    slug: reqString(row, "slug", "seller"),
    name: reqString(row, "name", "seller"),
    location: optString(row, "location", "seller"),
    region: optString(row, "region", "seller"),
    country: reqString(row, "country", "seller"),
    varietyCount: reqNumber(row, "varietyCount", "seller"),
  };
}

export interface CatalogApiOptions {
  /** Base URL of the API, e.g. https://seeds.hues.flowers/api/v1 (no trailing slash). */
  baseUrl: string;
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const paceMs = options.paceMs ?? DEFAULT_PACE_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const userAgent = options.userAgent ?? "seeds-hues-app/0.1 (+https://seeds.hues.flowers/about/bot)";
  // Serialize requests through one chain so sweeps pace themselves even when
  // callers fire concurrently — the live API's per-IP rate limit is shared.
  let chain: Promise<void> = Promise.resolve();

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getRaw(path: string, init?: { ifNoneMatch?: string }): Promise<{ status: number; etag: string | null; json: () => Promise<unknown> }> {
    const headers: Record<string, string> = { "User-Agent": userAgent };
    if (init?.ifNoneMatch) headers["If-None-Match"] = init.ifNoneMatch;
    for (let attempt = 0; ; attempt++) {
      const run = chain.then(() => fetchImpl(`${baseUrl}${path}`, { headers }));
      chain = run.then(
        () => sleep(paceMs),
        () => sleep(paceMs),
      );
      const res = await run;
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
