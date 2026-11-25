import { render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { resolveStateRoute } from "../../../src/server/shop-route";

// https://vike.dev/data — the state hub's request-time read: slug
// validation, the visible-seller state lookup (anything else 404s,
// including real states with no sellers), and the range check. The server
// passes its ONE catalog client + data cache via pageContextInit so the
// revalidate purge reaches the cache these hooks read; the process
// singletons are the fallback (prerender builds never render this
// route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveStateRoute(api, cache, {
    slug: pageContext.routeParams.slug ?? "",
    search: pageContext.urlParsed.searchOriginal ?? "",
  });
  if (resolved.kind === "notFound") throw render(404);
  return { hub: resolved.data };
}

export type Data = Awaited<ReturnType<typeof data>>;
