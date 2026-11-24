/**
 * The variety route's request-time decisions: slug validation, the cached
 * detail read, the merged-slug redirect (preserving ?small_farm=true), and
 * the 404. The Vike +data hook is a thin throw over this (redirect() for
 * redirects, render(404) for unknowns); the unit suite drives it directly
 * against the fake catalog and the HTTP suite proves the wire behavior.
 */
import type { CatalogApi } from "../data/api";
import type { DataCache } from "../data/cache";
import { getCatalogApi, getDataCache, loadVarietyDetail, loadVarietySiblings } from "../data/load";
import type { ApiVarietyDetail, ApiVarietyListItem } from "../data/types";
import { smallFarmOnlyFromSearch } from "../lib/small-farm";
import { isVarietySlug } from "./redirects";

export type VarietyRouteResult =
  | { kind: "ok"; detail: ApiVarietyDetail; siblings: ApiVarietyListItem[]; smallFarmOnly: boolean }
  | { kind: "redirect"; location: string }
  | { kind: "notFound" };

export async function resolveVarietyRoute(
  api: CatalogApi = getCatalogApi(),
  cache: DataCache = getDataCache(),
  request: { slug: string; search: string },
): Promise<VarietyRouteResult> {
  if (!isVarietySlug(request.slug)) return { kind: "notFound" };
  const detail = await loadVarietyDetail(request.slug, api, cache);
  if (!detail) {
    const target = await api.mergedVarietyTarget(request.slug);
    if (!target) return { kind: "notFound" };
    const smallFarmOnly = smallFarmOnlyFromSearch(request.search);
    return {
      kind: "redirect",
      location: smallFarmOnly ? `/variety/${target}?small_farm=true` : `/variety/${target}`,
    };
  }
  const siblings = await loadVarietySiblings(detail.plant.slug, detail.slug, api, cache);
  return { kind: "ok", detail, siblings, smallFarmOnly: smallFarmOnlyFromSearch(request.search) };
}
