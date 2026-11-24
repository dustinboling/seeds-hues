/**
 * Slice 3 test stub: the fake catalog behind the live API's HTTP wire
 * shapes. The built app under test points SEEDS_API_BASE at this server, so
 * the contract suite drives the real SSR path (Vike renderPage over HTTP)
 * against deterministic fixture data — no network, no live catalog reads.
 *
 * Wire fidelity: list endpoints emit v2's envelope
 * ({data, page:{next_cursor,has_more}, meta:{nextCursor,count,total,
 * generated_at}, error:null}); detail endpoints emit the one() form; unknown
 * slugs 404 with a v2-shaped error body. Every response is cloned: a real
 * API returns fresh JSON per fetch, never a live reference — without this
 * the app's caches would alias the state and no test could observe
 * staleness (the invalidation proof would be vacuous).
 *
 * The stub also plays the deployment's second role: the app-internal
 * GET /api/internal/variety-status/[slug] lookup (served by the new Worker's
 * own mount in production — Slice 9) reads from the same fixture state.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FakeCatalogState } from "../unit/fake-catalog";
import {
  stubSearch,
  stubSellerMatches,
  stubSortSellers,
  stubSortVarieties,
  stubVarietyMatches,
  type StubSeriesSeed,
  type StubVarietySort,
} from "./catalog-filter";
import { rederive } from "./derived";

const GENERATED_AT = "2026-11-24T00:00:00.000Z";

function envelope(data: unknown[], opts: { nextCursor: string | null; total: number }) {
  return {
    data,
    page: { next_cursor: opts.nextCursor, has_more: opts.nextCursor !== null },
    meta: { nextCursor: opts.nextCursor, count: data.length, total: opts.total, generated_at: GENERATED_AT },
    error: null,
  };
}

function one(data: unknown) {
  return {
    data,
    page: { next_cursor: null, has_more: false },
    meta: { nextCursor: null, count: 1, generated_at: GENERATED_AT },
    error: null,
  };
}

function notFound(what: string) {
  return { data: null, error: { code: "not_found", message: `${what} not found` } };
}

function validationError(message: string) {
  return { data: null, error: { code: "validation_error", message } };
}

/** Repeatable and/or comma-separated list param (v2's listParam vocabulary). */
function listValues(search: URLSearchParams, key: string): string[] {
  return search
    .getAll(key)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** v2's boolParam: true|1 → true, false|0 → false, anything else → 400. */
function boolParam(search: URLSearchParams, key: string): boolean | undefined | "invalid" {
  const raw = search.get(key);
  if (raw === null || raw === "") return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return "invalid";
}

const VARIETY_SORTS = ["name", "-name", "recently_checked", "-recently_checked", "listing_count", "-listing_count"] as const;
const SEASONS = ["cool", "warm"] as const;
const METHODS = ["direct", "trays"] as const;
const LIFE_CYCLES = ["annual", "biennial", "perennial"] as const;
const SEARCH_TYPES = ["variety", "series", "crop", "seller"] as const;

function paged(items: unknown[], search: URLSearchParams) {
  const limit = Math.max(1, Math.min(Number(search.get("limit") ?? "24") || 24, 100));
  const offset = Math.max(0, Number(search.get("cursor") ?? "0") || 0);
  const slice = items.slice(offset, offset + limit);
  const next = offset + slice.length;
  return envelope(slice, { nextCursor: next < items.length ? String(next) : null, total: items.length });
}

export interface StubApi {
  /** Base URL, e.g. http://127.0.0.1:PORT (SEEDS_API_BASE = `${url}/api/v1`). */
  url: string;
  state: FakeCatalogState;
  close: () => Promise<void>;
}

export async function startStubApi(state: FakeCatalogState): Promise<StubApi> {
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: unknown, headers: Record<string, string> = {}): void => {
      const text = JSON.stringify(structuredClone(body));
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
      res.end(text);
    };
    try {
      const url = new URL(req.url ?? "/", "http://stub");
      const path = url.pathname;
      if (req.method !== "GET") {
        send(405, { error: { code: "method_not_allowed", message: "stub serves GET only" } });
        return;
      }
      if (path === "/api/v1/crops") {
        send(200, paged(state.crops, url.searchParams));
        return;
      }
      if (path === "/api/v1/sellers") {
        const q = url.searchParams.get("q")?.trim() ?? undefined;
        if (q && q.length > 100) {
          send(400, validationError("q must be at most 100 characters"));
          return;
        }
        const smallFarm = boolParam(url.searchParams, "small_farm");
        if (smallFarm === "invalid") {
          send(400, validationError("small_farm must be true or false"));
          return;
        }
        const regions = listValues(url.searchParams, "region").map((r) => r.toUpperCase());
        const items = stubSortSellers(
          state.sellers.filter((s) => stubSellerMatches(s, { region: regions, q, smallFarmOnly: smallFarm })),
        );
        send(200, paged(items, url.searchParams));
        return;
      }
      if (path === "/api/v1/coverage") {
        send(200, envelope(state.coverage, { nextCursor: null, total: state.coverage.length }));
        return;
      }
      if (path === "/api/v1/recent") {
        const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? "6") || 6, 100));
        const items = state.recent.slice(0, limit);
        send(200, envelope(items, { nextCursor: null, total: state.recent.length }));
        return;
      }
      if (path === "/api/v1/sync/snapshot") {
        send(200, state.snapshot, { ETag: `seq-${state.snapshot.catalog_seq}` });
        return;
      }
      if (path === "/api/v1/varieties") {
        const sortRaw = url.searchParams.get("sort") ?? "name";
        if (!(VARIETY_SORTS as readonly string[]).includes(sortRaw)) {
          // Live-faithful: "availability" is deliberately NOT in VARIETY_SORTS
          // — the app sorts it read-side and must never send it.
          send(400, validationError(`sort must be one of ${VARIETY_SORTS.join(", ")}`));
          return;
        }
        const seasonRaw = url.searchParams.get("season");
        if (seasonRaw !== null && !(SEASONS as readonly string[]).includes(seasonRaw)) {
          send(400, validationError(`season has an invalid value "${seasonRaw.slice(0, 40)}"`));
          return;
        }
        const methods = listValues(url.searchParams, "method");
        if (methods.length > 10 || methods.some((m) => !(METHODS as readonly string[]).includes(m))) {
          send(400, validationError("method has an invalid value"));
          return;
        }
        const lifeCycle = listValues(url.searchParams, "life_cycle");
        if (lifeCycle.length > 10 || lifeCycle.some((b) => !(LIFE_CYCLES as readonly string[]).includes(b))) {
          send(400, validationError("life_cycle has an invalid value"));
          return;
        }
        const smallFarm = boolParam(url.searchParams, "small_farm");
        if (smallFarm === "invalid") {
          send(400, validationError("small_farm must be true or false"));
          return;
        }
        const plants = listValues(url.searchParams, "plant").concat(listValues(url.searchParams, "crop"));
        const colors = listValues(url.searchParams, "color_family");
        const smallFarmSlugs = new Set(state.smallFarmVarieties);
        const pool = stubSortVarieties(
          state.listItems.filter((item) =>
            stubVarietyMatches(
              item,
              {
                plant: plants,
                season: seasonRaw ?? undefined,
                methods,
                lifeCycle,
                colorFamily: colors,
                smallFarmOnly: smallFarm || undefined,
              },
              smallFarmSlugs,
            ),
          ),
          sortRaw as StubVarietySort,
        );
        send(200, paged(pool, url.searchParams));
        return;
      }
      if (path === "/api/v1/search") {
        const q = url.searchParams.get("q") ?? "";
        const limitRaw = url.searchParams.get("limit");
        if (limitRaw !== null && !/^-?\d+$/.test(limitRaw.trim())) {
          send(400, validationError("limit must be an integer"));
          return;
        }
        const types = listValues(url.searchParams, "type");
        if (types.some((t) => !(SEARCH_TYPES as readonly string[]).includes(t))) {
          send(400, validationError("type has an invalid value"));
          return;
        }
        const seasonRaw = url.searchParams.get("season");
        if (seasonRaw !== null && !(SEASONS as readonly string[]).includes(seasonRaw)) {
          send(400, validationError(`season has an invalid value "${seasonRaw.slice(0, 40)}"`));
          return;
        }
        const methods = listValues(url.searchParams, "method");
        if (methods.some((m) => !(METHODS as readonly string[]).includes(m))) {
          send(400, validationError("method has an invalid value"));
          return;
        }
        const seasonClass =
          seasonRaw === "cool" ? "cool_season_hardy_annual" : seasonRaw === "warm" ? "warm_season_tender_annual" : undefined;
        const methodClasses = methods.map((m) => (m === "direct" ? "direct_sow" : "transplant"));
        const response = stubSearch(
          {
            varieties: state.listItems,
            smallFarmSlugs: new Set(state.smallFarmVarieties),
            crops: state.crops,
            series: state.seriesCatalog,
            sellers: state.sellers,
          },
          q,
          {
            limit: limitRaw === null ? 10 : Number.parseInt(limitRaw, 10),
            types: types as ("variety" | "series" | "crop" | "seller")[],
            season: seasonClass,
            methods: methodClasses,
            colorFamily: listValues(url.searchParams, "color_family"),
          },
        );
        send(200, one(response));
        return;
      }
      const varietyDetail = /^\/api\/v1\/varieties\/([^/]+)$/.exec(path);
      if (varietyDetail) {
        const detail = state.details[varietyDetail[1]!];
        if (!detail) {
          send(404, notFound("variety"));
          return;
        }
        // The live API derives these at read time; the stub does the same.
        send(200, one(rederive(detail)));
        return;
      }
      const sellerDetail = /^\/api\/v1\/sellers\/([^/]+)$/.exec(path);
      if (sellerDetail) {
        const seller = state.sellers.find((s) => s.slug === sellerDetail[1]);
        if (!seller) {
          send(404, notFound("seller"));
          return;
        }
        // The OG card reads a subset of the full SellerDetail (same names).
        send(200, one({ slug: seller.slug, name: seller.name, location: seller.location, varietyCount: seller.varietyCount }));
        return;
      }
      const cropDetail = /^\/api\/v1\/crops\/([^/]+)$/.exec(path);
      if (cropDetail) {
        const crop = state.crops.find((c) => c.slug === cropDetail[1]);
        if (!crop) {
          send(404, notFound("crop"));
          return;
        }
        send(200, one(crop));
        return;
      }
      const seriesDetail = /^\/api\/v1\/series\/([^/]+)$/.exec(path);
      if (seriesDetail) {
        const seed: StubSeriesSeed | undefined = state.seriesCatalog.find((s) => s.slug === seriesDetail[1]);
        const crop = seed ? state.crops.find((c) => c.slug === seed.plantSlug) : undefined;
        if (!seed || !crop) {
          send(404, notFound("series"));
          return;
        }
        // The SeriesDetail's crop is the full plant ref; its variety set is
        // the pool's members (honest counts, not placeholders).
        const members = state.listItems.filter((item) => item.series?.slug === seed.slug);
        send(
          200,
          one({
            slug: seed.slug,
            name: seed.name,
            crop: {
              slug: crop.slug,
              commonName: crop.commonName,
              latinName: crop.latinName,
              lifeCycle: crop.lifeCycle,
              season_class: crop.season_class,
              season_source_label: null,
              sowing_methods: crop.sowing_methods,
              sowing_method_source_label: null,
            },
            varietyCount: members.length,
            varietiesWithSellers: members.filter((m) => m.listingCount > 0).length,
            varieties: members,
          }),
        );
        return;
      }
      if (path === "/api/v1/openapi.json") {
        send(200, state.openapi);
        return;
      }
      const varietyStatus = /^\/api\/internal\/variety-status\/([^/]+)$/.exec(path);
      if (varietyStatus) {
        const slug = varietyStatus[1]!;
        if (Object.hasOwn(state.details, slug)) {
          send(200, { status: "active", merged_into: null });
          return;
        }
        const target = state.merged[slug];
        if (target) {
          send(200, { status: "merged", merged_into: target });
          return;
        }
        send(200, { status: "unknown", merged_into: null });
        return;
      }
      send(404, { error: { code: "not_found", message: "stub has no such path" } });
    } catch (error) {
      send(500, { error: { code: "stub_error", message: String(error) } });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("stub: could not bind an ephemeral port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
