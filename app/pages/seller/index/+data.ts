import { render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { resolveSellerBrowse } from "../../../src/server/browse-route";

// https://vike.dev/data — the /seller browse read: strict ?page= parsing
// (true 404s), forgiving ?state= parsing (unknown codes read as All
// states, never a 404), the cached page window plus the state cloud and
// its counts. The server passes its ONE catalog client + data cache via
// pageContextInit so the revalidate purge reaches the cache this hook
// reads; the process singletons are the fallback (prerender builds never
// render this route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveSellerBrowse(api, cache, {
    search: pageContext.urlParsed.searchOriginal ?? "",
  });
  if (resolved.kind === "notFound") throw render(404);
  return { browse: resolved.data };
}

export type Data = Awaited<ReturnType<typeof data>>;
