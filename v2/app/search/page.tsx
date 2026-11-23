import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchBrowse, type SearchBrowseInitial } from "@/components/search/SearchBrowse";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { parseSearchQueryParam, readBrowseFiltersForGroups } from "@/lib/browse";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// X10 / S2: search results are noindex,follow and canonical to /search.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseSearchQueryParam((await searchParams).q);
  return pageMetadata({
    title: q ? `Search: ${q}` : "Search flower seeds",
    description: "Search flower seed varieties, crops, series and sellers by any name a variety goes by.",
    path: "/search",
    noindex: true,
    follow: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = parseSearchQueryParam(sp.q);
  // /search stays single-select hue (Item 3.1b spreads the core): today's parse rule, one family at most.
  const filters = readBrowseFiltersForGroups(sp, ["season", "method", "lifeCycle", "hue"], "single");
  // Every filter group joins navKey, so ResultsScrollClamp fires on each results navigation (ux-spec §3.4.2).
  // In-place changes never re-render this server tree, so the clamp cannot fire for them.
  const navKey = [q, filters.season, filters.method, filters.lifeCycle, filters.hue].join("|");
  const { catalog } = await getServices();
  // The browse payload: the grouped results plus the per-option counts describing them —
  // the identical contract GET /api/browse/search serves the in-place layer.
  const payload = q ? await catalog.browseSearch(q, { filters }) : null;
  const initial: SearchBrowseInitial | null = payload
    ? {
        state: filters,
        counts: payload.counts,
        items: [...payload.crops, ...payload.series, ...payload.varieties, ...payload.sellers],
        total: payload.total,
        page: 1,
      }
    : null;

  return (
    <>
      <h1 className="text-3xl font-semibold text-leaf">Search</h1>
      <div className="mt-4 max-w-2xl">
        <SearchBox defaultValue={q} label="Search flower seeds" autoFocus={!q} />
      </div>
      {!q ? (
        <section className="mt-8" aria-labelledby="browse-title">
          <h2 id="browse-title" className="text-xl font-semibold">
            Not sure what to search for?
          </h2>
          <p className="mt-2 text-muted">
            Try a crop (“sweet pea”), a variety (“King’s Ransom”) or a Latin name (“Papaver”). Two letters are enough to
            start; names a variety is also sold under match too.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            <li>
              <Link href="/crop" className="chip-filter">
                Browse by crop
              </Link>
            </li>
            <li>
              <Link href="/variety" className="chip-filter">
                Browse all varieties
              </Link>
            </li>
            <li>
              <Link href="/seller" className="chip-filter">
                Browse sellers
              </Link>
            </li>
          </ul>
        </section>
      ) : initial ? (
        <>
        <section id="search-results" className="mt-8" aria-labelledby="results-title">
          <SearchBrowse initial={initial} q={q} />
        </section>
        <ResultsScrollClamp targetId="results-title" regionId="search-results" navKey={navKey} />
        </>
      ) : null}
    </>
  );
}
