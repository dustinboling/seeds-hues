import { redirect, render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { resolveVarietyRoute } from "../../../src/server/variety-route";

// https://vike.dev/data — the variety page's request-time read: slug
// validation, the cached detail + sibling reads, the merged-slug 301
// (preserving ?small_farm=true), and the true 404. The server passes its
// ONE catalog client + data cache via pageContextInit so the revalidate
// purge reaches the cache these hooks read; the process singletons are the
// fallback (prerender builds never render this route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveVarietyRoute(api, cache, {
    slug: pageContext.routeParams.slug ?? "",
    search: pageContext.urlParsed.searchOriginal ?? "",
  });
  if (resolved.kind === "redirect") throw redirect(resolved.location, 301);
  if (resolved.kind === "notFound") throw render(404);
  return { detail: resolved.detail, siblings: resolved.siblings, smallFarmOnly: resolved.smallFarmOnly };
}

export type Data = Awaited<ReturnType<typeof data>>;
