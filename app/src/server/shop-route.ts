/**
 * The shop/hub routes' request-time decisions: slug validation, the cached
 * detail reads, the removed-seller split (gone vs missing through the
 * uncached status lookup), the crop's strict filter validation, shop/crop
 * state parsing, and the range checks. The Vike +data hooks are thin
 * throws over these (redirect() is never needed here — render(404) for
 * unknowns, render(410) for removed sellers); the unit suite drives them
 * directly against the fake catalog and the HTTP suite proves the wire
 * behavior.
 *
 * Static redirects NEVER live here: ?page=1, plural legacy paths, and
 * legacy ?s= slugs throw from +onBeforeRoute (redirects.ts) before
 * routing — so these resolvers treat ?page=1 as page 1 and never see a
 * legacy slug.
 */
import type { CatalogApi } from "../data/api";
import type { DataCache } from "../data/cache";
import { compareVarietyAvailability } from "../data/browse";
import {
  getCatalogApi,
  getDataCache,
  loadCropDetail,
  loadCropIndexData,
  loadSellerDetail,
  loadSellerStates,
  loadSeriesDetail,
  loadStateDetail,
  type StateDetailData,
} from "../data/load";
import type { ApiCropDetail, ApiCropDetailCounts, ApiPublicListing, ApiSellerDetail, ApiSeriesDetail, ApiVarietyListItem } from "../data/types";
import {
  cropDetailCountsFor,
  cropDetailParamsValid,
  cropHuesForFamilies,
  narrowCropVarieties,
  readCropDetailFilters,
  type CropDetailFilterState,
  type CropHue,
} from "../lib/crop-detail";
import { pageInRange, pageWindow, parsePageParam, totalPages, type RawParam } from "../lib/paging";
import { PAGE_SIZE } from "../site";
import {
  hasActiveShopState,
  readShopBrowseFilters,
  shopCountsFor,
  shopCropsFor,
  shopViewListings,
  type ShopBrowseState,
  type ShopCounts,
  type ShopCrop,
} from "../lib/shop-browse";
import { isSlug } from "./redirects";

/** A live query string as a page-query-shaped record (repeats stay arrays — first wins, v2's rule). */
function searchToParams(search: string): Record<string, string | string[] | undefined> {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(q.keys())) {
    const all = q.getAll(key);
    out[key] = all.length > 1 ? all : (all[0] as string | undefined);
  }
  return out;
}

export type ShopRouteResult =
  | {
      kind: "ok";
      seller: ApiSellerDetail;
      state: ShopBrowseState;
      counts: ShopCounts;
      items: ApiPublicListing[];
      total: number;
      page: number;
      pages: number;
      /** Filters/search shape the view (noindex + clean canonical). ?sort= is an ordering, not state. */
      stated: boolean;
      /** The global crop vocabulary (?crop= validity + remover labels). */
      crops: ShopCrop[];
    }
  | { kind: "gone" }
  | { kind: "notFound" };

export async function resolveShopRoute(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { slug: string; search: string },
): Promise<ShopRouteResult> {
  if (!isSlug(request.slug)) return { kind: "notFound" };
  const sp: Record<string, RawParam> = searchToParams(request.search);
  const page = parsePageParam(sp.page);
  if (page === null) return { kind: "notFound" };
  const seller = await loadSellerDetail(request.slug, api, cache);
  if (!seller) {
    // No detail: the status lookup splits removed (410) from unknown
    // (404). Removed sellers never render — the Gone page answers first.
    const status = await api.sellerStatus(request.slug);
    return status.status === "gone" ? { kind: "gone" } : { kind: "notFound" };
  }
  // The shop view for the URL's state, from the seller's complete listing
  // set — every shop state server-renders correctly from its URL alone
  // (the no-JS floor). Bounds hold against the NARROWED total: an
  // out-of-range page under a filter or query answers a true 404, as the
  // unfiltered shop already does.
  const { crops } = await loadCropIndexData(api, cache);
  const vocabulary = crops.map((c) => ({ slug: c.slug }));
  const state = readShopBrowseFilters(sp, vocabulary);
  const view = shopViewListings(seller.listings, state);
  const total = view.length;
  if (!pageInRange(page, total)) return { kind: "notFound" };
  const { offset, limit } = pageWindow(page, PAGE_SIZE);
  return {
    kind: "ok",
    seller,
    state,
    counts: shopCountsFor(seller.listings, state, shopCropsFor(seller.listings)),
    items: view.slice(offset, offset + limit),
    total,
    page,
    pages: totalPages(total, PAGE_SIZE),
    stated: hasActiveShopState(state),
    crops: crops.map((c) => ({ slug: c.slug, commonName: c.commonName })),
  };
}

/** The crop hub snapshot: the head fields plus one filtered page window and its counts. */
export interface CropHubData {
  crop: ApiCropDetail;
  state: CropDetailFilterState;
  counts: ApiCropDetailCounts;
  hues: CropHue[];
  series: { slug: string; name: string }[];
  items: ApiVarietyListItem[];
  total: number;
  page: number;
  pages: number;
}

/** Read-side recent order: freshest lastCheckedAt first, unchecked last, then name A–Z. */
function compareCropRecent(a: ApiVarietyListItem, b: ApiVarietyListItem): number {
  if (a.lastCheckedAt === b.lastCheckedAt) {
    return (
      a.varietyName.toLowerCase().localeCompare(b.varietyName.toLowerCase()) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
    );
  }
  if (a.lastCheckedAt === null) return 1;
  if (b.lastCheckedAt === null) return -1;
  return a.lastCheckedAt < b.lastCheckedAt ? 1 : -1;
}

function orderCropItems(items: ApiVarietyListItem[], state: CropDetailFilterState): ApiVarietyListItem[] {
  // The walked set rests in Name A–Z (the API's default sort), and
  // narrowing preserves it — only the other two sorts reorder.
  if (state.sort === "availability") {
    return [...items].sort(compareVarietyAvailability);
  }
  if (state.sort === "recent") {
    return [...items].sort(compareCropRecent);
  }
  return items;
}

export type CropRouteResult = { kind: "ok"; data: CropHubData } | { kind: "notFound" };

export async function resolveCropRoute(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { slug: string; search: string },
): Promise<CropRouteResult> {
  if (!isSlug(request.slug)) return { kind: "notFound" };
  const sp: Record<string, RawParam> = searchToParams(request.search);
  // The strict parse is deliberate (Bea §3.4): malformed filter values
  // 404 — unlike the browse pages' forgiving parse.
  if (!cropDetailParamsValid(sp)) return { kind: "notFound" };
  const page = parsePageParam(sp.page);
  if (page === null) return { kind: "notFound" };
  const walked = await loadCropDetail(request.slug, api, cache);
  if (!walked) return { kind: "notFound" };
  const state = readCropDetailFilters(sp);
  const ordered = orderCropItems(narrowCropVarieties(walked.items, state), state);
  const total = ordered.length;
  if (!pageInRange(page, total)) return { kind: "notFound" };
  const { offset, limit } = pageWindow(page, PAGE_SIZE);
  const hues = cropHuesForFamilies([...new Set(walked.items.map((v) => v.colorFamily))]);
  return {
    kind: "ok",
    data: {
      crop: walked.detail,
      state,
      counts: cropDetailCountsFor(walked.items, state, hues, walked.detail.series.map((s) => s.slug)),
      hues,
      series: walked.detail.series,
      items: ordered.slice(offset, offset + limit),
      total,
      page,
      pages: totalPages(total, PAGE_SIZE),
    },
  };
}

export type SeriesRouteResult = { kind: "ok"; detail: ApiSeriesDetail } | { kind: "notFound" };

export async function resolveSeriesRoute(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { slug: string },
): Promise<SeriesRouteResult> {
  if (!isSlug(request.slug)) return { kind: "notFound" };
  const detail = await loadSeriesDetail(request.slug, api, cache);
  if (!detail) return { kind: "notFound" };
  return { kind: "ok", detail };
}

export type StateRouteResult = { kind: "ok"; data: StateDetailData } | { kind: "notFound" };

export async function resolveStateRoute(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { slug: string; search: string },
): Promise<StateRouteResult> {
  if (!isSlug(request.slug)) return { kind: "notFound" };
  const sp: Record<string, RawParam> = searchToParams(request.search);
  const page = parsePageParam(sp.page);
  if (page === null) return { kind: "notFound" };
  // A state page exists iff it has a visible seller — any other slug,
  // including a real state with no sellers, is a true 404.
  const states = await loadSellerStates(api, cache);
  const found = states.find((s) => s.slug === request.slug) ?? null;
  if (!found) return { kind: "notFound" };
  const data = await loadStateDetail(found.code, page, api, cache);
  if (!data || !pageInRange(page, data.total)) return { kind: "notFound" };
  return { kind: "ok", data };
}
