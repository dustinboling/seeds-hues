import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache, loadApiDocsData } from "../../src/data/load";

// https://vike.dev/data — the endpoint inventory renders from the live
// OpenAPI document (GET /api/v1/openapi.json) through the shared data cache,
// exactly like v2 renders from its local OpenAPI builder. The server passes
// its ONE catalog client + data cache via pageContextInit so the revalidate
// purge reaches the cache this hook reads (and so hermetic `stub:parity`
// serving resolves — the process singletons would read the literal stub:
// value from the env and 500); the singletons are the fallback for
// prerender builds, which never set pageContext values.
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  return loadApiDocsData(api, cache);
}

export type Data = Awaited<ReturnType<typeof data>>;
