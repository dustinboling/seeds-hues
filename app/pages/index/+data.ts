import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache, loadHomeData } from "../../src/data/load";

// https://vike.dev/data — counts, coverage, recent events, and the crop
// window render from the live API through the shared data cache. Prerender
// runs this at build so the first HTML carries current data; the revalidate
// hook purges these entries on every catalog write (Bea §9). The server
// passes its ONE catalog client + data cache via pageContextInit so the
// revalidate purge reaches the cache this hook reads (and so hermetic
// `stub:parity` serving resolves — the process singletons would read the
// literal stub: value from the env and 500); the singletons are the
// fallback for prerender builds, which never set pageContext values.
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  return loadHomeData(api, cache);
}

export type Data = Awaited<ReturnType<typeof data>>;
