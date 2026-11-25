import { render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { resolveSeriesRoute } from "../../../src/server/shop-route";

// https://vike.dev/data — the series hub's request-time read: slug
// validation, the cached full detail (no pagination on this template),
// and the true 404. The server passes its ONE catalog client + data
// cache via pageContextInit so the revalidate purge reaches the cache
// these hooks read; the process singletons are the fallback (prerender
// builds never render this route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveSeriesRoute(api, cache, { slug: pageContext.routeParams.slug ?? "" });
  if (resolved.kind === "notFound") throw render(404);
  return { detail: resolved.detail };
}

export type Data = Awaited<ReturnType<typeof data>>;
