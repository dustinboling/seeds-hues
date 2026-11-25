import { redirect, render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { RESTING_FLOOR, WAITLIST_PARAM, parseFloorState } from "../../../src/lib/waitlist-floor";
import { resolveVarietyRoute } from "../../../src/server/variety-route";

// https://vike.dev/data — the variety page's request-time read: slug
// validation, the cached detail + sibling reads, the merged-slug 301
// (preserving ?small_farm=true), the true 404, and the no-JS waitlist
// floor state (?waitlist=… — unknown values degrade to the resting floor
// at parse, but any present waitlist param marks the render transient,
// hence noindexed). The server passes its ONE catalog client + data cache
// via pageContextInit so the revalidate purge reaches the cache these
// hooks read; the process singletons are the fallback (prerender builds
// never render this route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const search = pageContext.urlParsed.searchOriginal ?? "";
  const resolved = await resolveVarietyRoute(api, cache, {
    slug: pageContext.routeParams.slug ?? "",
    search,
  });
  if (resolved.kind === "redirect") throw redirect(resolved.location, 301);
  if (resolved.kind === "notFound") throw render(404);
  const params = new URLSearchParams(search);
  const query: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    query[key] = all.length > 1 ? all : all[0];
  }
  const floor = params.has(WAITLIST_PARAM) ? parseFloorState(query) : RESTING_FLOOR;
  return {
    detail: resolved.detail,
    siblings: resolved.siblings,
    smallFarmOnly: resolved.smallFarmOnly,
    floor,
    floorTransient: params.has(WAITLIST_PARAM),
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
