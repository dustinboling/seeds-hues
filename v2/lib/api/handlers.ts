/**
 * /api/v1 endpoint handlers. Each is a thin adapter: parse + validate query → call the shared
 * service → return data/meta/page. Route files only bind these to paths.
 */
import { AVAILABILITY, POLLINATION } from "@/lib/db/schema";
import { VARIETY_SORTS, type VarietySort } from "@/lib/repositories/catalog-read";
import {
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEARCH_TYPES,
  SEASON_PARAMS,
  type LifeCycleParam,
  type MethodParam,
  type SearchType,
  type SeasonClass,
  type SeasonParam,
  type SowingMethod,
} from "@/lib/validators";
import { SyncRangeError } from "@/lib/services/sync";
import { ApiError, notFound, validationError } from "./errors";
import { CACHE_LONG, CACHE_NO_STORE, sha256Hex, etagMatches, baseHeaders } from "./http";
import { encodeCursor, parseLimit, readCursorPage, type CursorPage } from "./pagination";
import { Problem } from "./problem";
import type { ApiHandler, ApiOk } from "./route";
import { buildOpenApiDocument } from "./openapi";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/;

function slugParam(v: string | undefined, name: string): string {
  if (!v || !SLUG.test(v) || v.length > 160) throw notFound(name);
  return v;
}

function optionalSlug(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  if (v === null || v === "") return undefined;
  if (!SLUG.test(v) || v.length > 160) throw validationError(`${key} must be a slug`);
  return v;
}

/** Comma-separated exact-match values (canonical §3 filters). */
function listParam(url: URL, key: string, allowed?: readonly string[], re = SLUG): string[] | undefined {
  const v = url.searchParams.get(key);
  if (v === null || v === "") return undefined;
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 20) throw validationError(`${key} takes 1–20 comma-separated values`);
  for (const p of parts) {
    if (allowed ? !allowed.includes(p) : !re.test(p) || p.length > 160) {
      throw validationError(`${key} has an invalid value "${p.slice(0, 40)}"${allowed ? ` (one of ${allowed.join(", ")})` : ""}`);
    }
  }
  return parts;
}

/** `season=cool|warm` (one value) → the crop season class. */
function seasonParam(url: URL): SeasonClass | undefined {
  const v = url.searchParams.get("season");
  if (v === null || v === "") return undefined;
  if (!Object.hasOwn(SEASON_PARAMS, v)) {
    throw validationError(`season has an invalid value "${v.slice(0, 40)}" (one of ${Object.keys(SEASON_PARAMS).join(", ")})`);
  }
  return SEASON_PARAMS[v as SeasonParam];
}

/**
 * `method=direct|trays` → sowing methods. Repeatable (`method=direct&method=trays`) and/or
 * comma-separated (`method=direct,trays`); a crop matches when it has ANY of them.
 */
function methodParam(url: URL): SowingMethod[] | undefined {
  const parts = url.searchParams
    .getAll("method")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length > 10) throw validationError("method takes at most 10 values");
  for (const v of parts) {
    if (!Object.hasOwn(METHOD_PARAMS, v)) {
      throw validationError(`method has an invalid value "${v.slice(0, 40)}" (one of ${Object.keys(METHOD_PARAMS).join(", ")})`);
    }
  }
  return [...new Set(parts.map((v) => METHOD_PARAMS[v as MethodParam]))];
}

/**
 * `life_cycle=annual|biennial|perennial` → life-cycle buckets (how the crop is grown; see
 * lib/life-cycle.ts). Repeatable and/or comma-separated like `method`; a crop matches when it is
 * in ANY of them.
 */
function lifeCycleParam(url: URL): LifeCycleParam[] | undefined {
  const parts = url.searchParams
    .getAll("life_cycle")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length > 10) throw validationError("life_cycle takes at most 10 values");
  for (const v of parts) {
    if (!(LIFE_CYCLE_PARAMS as readonly string[]).includes(v)) {
      throw validationError(`life_cycle has an invalid value "${v.slice(0, 40)}" (one of ${LIFE_CYCLE_PARAMS.join(", ")})`);
    }
  }
  return LIFE_CYCLE_PARAMS.filter((b) => parts.includes(b));
}

/** Colour family list (`color_family=blush,pink`). */
const colorFamilyParam = (url: URL) => listParam(url, "color_family", undefined, /^[a-z_-]{1,40}$/);

function boolParam(url: URL, key: string): boolean | undefined {
  const v = url.searchParams.get(key);
  if (v === null || v === "") return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  throw validationError(`${key} must be true or false`);
}

function paged(page: CursorPage, items: unknown[], total: number): ApiOk {
  const next = page.offset + items.length;
  const nextCursor = items.length > 0 && next < total ? encodeCursor(next, page.queryKey) : null;
  return {
    data: items,
    meta: { nextCursor, count: items.length, total },
    page: { next_cursor: nextCursor, has_more: nextCursor !== null },
  };
}

const one = (data: unknown): ApiOk => ({ data, meta: { nextCursor: null, count: 1 } });

export const listVarieties: ApiHandler = async ({ url, services }) => {
  const page = readCursorPage(url);
  const sortRaw = url.searchParams.get("sort") ?? "name";
  if (!(VARIETY_SORTS as readonly string[]).includes(sortRaw)) {
    throw validationError(`sort must be one of ${VARIETY_SORTS.join(", ")}`);
  }
  const crop = listParam(url, "crop") ?? listParam(url, "plant");
  const season = seasonParam(url);
  const filters = {
    category: optionalSlug(url, "category"),
    subcategory: optionalSlug(url, "subcategory"),
    plant: crop,
    series: listParam(url, "series"),
    colorFamily: colorFamilyParam(url),
    pollination: listParam(url, "pollination", POLLINATION),
    hasListings: boolParam(url, "has_listings"),
    inStock: boolParam(url, "in_stock"),
    seller: optionalSlug(url, "seller"),
    tag: optionalSlug(url, "tag"),
    season: season ? [season] : undefined,
    methods: methodParam(url),
    lifeCycle: lifeCycleParam(url),
  };
  const { items, total } = await services.catalog.listVarieties({
    filters,
    sort: sortRaw as VarietySort,
    page: { offset: page.offset, limit: page.limit },
  });
  return paged(page, items, total);
};

export const getVariety: ApiHandler = async ({ params, services }) => {
  const v = await services.catalog.getVariety(slugParam(params.slug, "variety"));
  if (!v) throw notFound("variety");
  return one(v);
};

export const listVarietyListings: ApiHandler = async ({ url, params, services }) => {
  const ls = await services.catalog.varietyListings(slugParam(params.slug, "variety"), {
    availability: listParam(url, "availability", AVAILABILITY),
    shipsTo: listParam(url, "ships_to", undefined, /^[A-Za-z]{2,10}$/),
  });
  if (!ls) throw notFound("variety");
  return { data: ls, meta: { nextCursor: null, count: ls.length, total: ls.length } };
};

export const listSellers: ApiHandler = async ({ url, services }) => {
  const page = readCursorPage(url);
  const q = url.searchParams.get("q")?.trim();
  if (q && q.length > 100) throw validationError("q must be at most 100 characters");
  const { items, total } = await services.catalog.listSellers(
    { offset: page.offset, limit: page.limit },
    { region: listParam(url, "region", undefined, /^[A-Za-z]{2,10}$/)?.map((r) => r.toUpperCase()), q: q || undefined },
  );
  return paged(page, items, total);
};

export const getSeller: ApiHandler = async ({ params, services }) => {
  const slug = slugParam(params.slug, "seller");
  const s = await services.catalog.getSeller(slug);
  if (!s) {
    if ((await services.catalog.sellerStatus(slug)) === "gone") throw new ApiError(410, "gone", "seller removed at its request");
    throw notFound("seller");
  }
  return one(s);
};

export const listSellerListings: ApiHandler = async ({ url, params, services }) => {
  const slug = slugParam(params.slug, "seller");
  const ls = await services.catalog.sellerListings(slug, {
    availability: listParam(url, "availability", AVAILABILITY),
    plant: listParam(url, "crop"),
  });
  if (!ls) {
    if ((await services.catalog.sellerStatus(slug)) === "gone") throw new ApiError(410, "gone", "seller removed at its request");
    throw notFound("seller");
  }
  return { data: ls, meta: { nextCursor: null, count: ls.length, total: ls.length } };
};

export const listCategories: ApiHandler = async ({ services }) => {
  const items = await services.catalog.listCategories();
  return { data: items, meta: { nextCursor: null, count: items.length, total: items.length } };
};

export const getCategory: ApiHandler = async ({ url, params, services }) => {
  const page = readCursorPage(url);
  const r = await services.catalog.getCategory(slugParam(params.slug, "category"), { offset: page.offset, limit: page.limit });
  if (!r) throw notFound("category");
  const p = paged(page, r.category.varieties, r.total);
  return { ...p, data: r.category, meta: { ...p.meta, count: r.category.varieties.length } };
};

export const listCrops: ApiHandler = async ({ url, services }) => {
  const page = readCursorPage(url);
  const season = seasonParam(url);
  const methods = methodParam(url);
  const lifeCycle = lifeCycleParam(url);
  const { items, total } = await services.catalog.listCrops({ offset: page.offset, limit: page.limit }, { season, methods, lifeCycle });
  return paged(page, items, total);
};

export const getCrop: ApiHandler = async ({ url, params, services }) => {
  const page = readCursorPage(url);
  const r = await services.catalog.getCrop(slugParam(params.slug, "crop"), { page: { offset: page.offset, limit: page.limit } });
  if (!r) throw notFound("crop");
  const p = paged(page, r.crop.varieties, r.total);
  return { ...p, data: r.crop };
};

export const getSeries: ApiHandler = async ({ params, services }) => {
  const s = await services.catalog.getSeries(slugParam(params.slug, "series"));
  if (!s) throw notFound("series");
  return one(s);
};

export const coverage: ApiHandler = async ({ services }) => {
  const items = await services.catalog.coverage();
  return { data: items, meta: { nextCursor: null, count: items.length, total: items.length } };
};

export const recent: ApiHandler = async ({ url, services }) => {
  const since = url.searchParams.get("since") ?? undefined;
  if (since !== undefined && !DATE.test(since)) throw validationError("since must be an ISO date (YYYY-MM-DD)");
  const items = await services.catalog.recent({ plant: listParam(url, "crop"), since, limit: parseLimit(url.searchParams.get("limit"), 24, 100) });
  return { data: items, meta: { nextCursor: null, count: items.length } };
};

export const search: ApiHandler = async ({ req, url, services }) => {
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) throw validationError("q is required (at least 1 character)");
  if (q.length > 100) throw validationError("q must be at most 100 characters");
  const limit = parseLimit(url.searchParams.get("limit"), 10, 50);
  const types = listParam(url, "type", SEARCH_TYPES) as SearchType[] | undefined;
  const season = seasonParam(url);
  const methods = methodParam(url);
  const colorFamily = colorFamilyParam(url);
  const client = req.headers.get("x-client")?.slice(0, 40) || "api";
  const r = await services.catalog.search(q, { limit, types, season, methods, colorFamily, logClient: client });
  return { data: r, meta: { nextCursor: null, count: r.results.length }, cacheControl: CACHE_NO_STORE };
};

export const catalogVersion: ApiHandler = async ({ services, env }) => {
  const v = await services.catalog.catalogVersion(env.siteUrl);
  return { ...one(v), cacheControl: CACHE_NO_STORE };
};

export const catalogSnapshot: ApiHandler = async ({ req, params, env }) => {
  const m = /^(\d{1,9})\.sqlite$/.exec(params.file ?? "");
  if (!m) throw notFound("snapshot");
  const version = Number(m[1]);
  if (!env.snapshots) throw notFound("snapshot");
  const obj = await env.snapshots.get(`snapshots/catalog-v${version}.sqlite`);
  if (!obj) throw notFound(`snapshot for catalog version ${version}`);
  const etag = obj.httpEtag;
  const headers: Record<string, string> = {
    ...baseHeaders(),
    "Content-Type": "application/vnd.sqlite3",
    "Content-Disposition": `attachment; filename="seeds-catalog-v${version}.sqlite"`,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
  };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    obj.body.cancel().catch(() => {});
    return new Response(null, { status: 304, headers });
  }
  headers["Content-Length"] = String(obj.size);
  if (req.method === "HEAD") {
    obj.body.cancel().catch(() => {});
    return new Response(null, { status: 200, headers });
  }
  return new Response(obj.body, { status: 200, headers });
};

/** GET /sync/snapshot — ETag derives from catalog_seq, checked before the snapshot is built. */
export const syncSnapshot: ApiHandler = async ({ req, services }) => {
  const seq = await services.sync.catalogSeq();
  const etag = `"seq-${seq}"`;
  const headers = {
    ...baseHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    ETag: etag,
  };
  if (etagMatches(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  const snap = await services.sync.snapshot();
  return new Response(req.method === "HEAD" ? null : JSON.stringify(snap), { status: 200, headers });
};

export const syncChanges: ApiHandler = async ({ url, services }) => {
  const raw = url.searchParams.get("since");
  if (raw === null || !/^-?\d{1,12}$/.test(raw)) throw new Problem(400, "validation_error", "since must be an integer catalog_seq");
  const limit = parseLimit(url.searchParams.get("limit"), 500, 1000);
  try {
    const c = await services.sync.changes(Number(raw), limit);
    return { data: c, meta: { nextCursor: null, count: c.deletes.length + Object.values(c.upserts).reduce((n, a) => n + a.length, 0) }, cacheControl: CACHE_NO_STORE };
  } catch (err) {
    if (err instanceof SyncRangeError) throw new Problem(err.status, err.code, err.message);
    throw err;
  }
};

export const openApi: ApiHandler = async ({ req, env }) => {
  const doc = buildOpenApiDocument(env.siteUrl);
  const text = JSON.stringify(doc);
  const etag = `"${(await sha256Hex(text)).slice(0, 32)}"`;
  const headers = { ...baseHeaders(), "Content-Type": "application/json; charset=utf-8", "Cache-Control": CACHE_LONG, ETag: etag };
  if (etagMatches(req.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
  return new Response(req.method === "HEAD" ? null : text, { status: 200, headers });
};

export const unknownEndpoint: ApiHandler = async () => {
  throw notFound("endpoint");
};
