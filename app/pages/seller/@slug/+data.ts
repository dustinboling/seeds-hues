import { render } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache } from "../../../src/data/load";
import { resolveShopRoute } from "../../../src/server/shop-route";

// https://vike.dev/data — the shop page's request-time read: slug
// validation, the cached seller detail, the gone/missing split (removed
// sellers 410 before render), shop-state parsing, and the true 404. The
// server passes its ONE catalog client + data cache via pageContextInit
// so the revalidate purge reaches the cache these hooks read; the process
// singletons are the fallback (prerender builds never render this route).
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveShopRoute(api, cache, {
    slug: pageContext.routeParams.slug ?? "",
    search: pageContext.urlParsed.searchOriginal ?? "",
  });
  if (resolved.kind === "gone") throw render(410);
  if (resolved.kind === "notFound") throw render(404);
  return { shop: resolved };
}

export type Data = Awaited<ReturnType<typeof data>>;
