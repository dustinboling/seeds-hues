import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache, loadCropIndexData } from "../../../src/data/load";

// https://vike.dev/data — the crop list renders from the live API through the
// shared data cache (the "crops" entry, purged by variety/seller/crop tags).
// Prerender runs this at build; the revalidate hook re-runs it after a purge.
// The server passes its ONE catalog client + data cache via pageContextInit
// so the revalidate purge reaches the cache this hook reads (and so hermetic
// `stub:parity` serving resolves — the process singletons would read the
// literal stub: value from the env and 500); the singletons are the fallback
// for prerender builds, which never set pageContext values.
export async function data(pageContext: PageContextServer) {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  return loadCropIndexData(api, cache);
}

export type Data = Awaited<ReturnType<typeof data>>;
