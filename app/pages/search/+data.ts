import type { PageContextServer } from "vike/types";
import { getCatalogApi, getDataCache, type SearchBrowseData } from "../../src/data/load";
import { resolveSearch } from "../../src/server/browse-route";

// https://vike.dev/data — the /search read: the trimmed ?q= (capped at 100
// chars, never an error) plus the single-select filter state, served the
// grouped results with their counts matrix and the zero-results
// did-you-mean. Search never 404s: a bare query renders the guidance form
// and an empty result set renders the zero-results state. The server
// passes its ONE catalog client + data cache via pageContextInit so the
// revalidate purge reaches the cache this hook reads; the process
// singletons are the fallback (prerender builds never render this route).
export async function data(pageContext: PageContextServer): Promise<{ q: string; result: SearchBrowseData | null }> {
  const api = pageContext.catalogApi ?? getCatalogApi();
  const cache = pageContext.dataCache ?? getDataCache();
  const resolved = await resolveSearch(api, cache, {
    search: pageContext.urlParsed.searchOriginal ?? "",
  });
  if (resolved.kind === "empty") return { q: "", result: null };
  return { q: resolved.data.q, result: resolved.data };
}

export type Data = Awaited<ReturnType<typeof data>>;
