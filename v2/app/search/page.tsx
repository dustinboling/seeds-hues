import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { BrowseFilters, activeFilterLabels, type BrowseFilterState } from "@/components/ui/BrowseFilters";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { parseHueParam, parseMethodParam, parseSeasonParam } from "@/lib/paging";
import { METHOD_PARAMS, SEASON_PARAMS, type SearchResult } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readQ(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 100);
}

// X10 / S2: search results are noindex,follow and canonical to /search.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQ((await searchParams).q);
  return pageMetadata({
    title: q ? `Search: ${q}` : "Search flower seeds",
    description: "Search flower seed varieties, crops, series and sellers by any name a variety goes by.",
    path: "/search",
    noindex: true,
    follow: true,
  });
}

const GROUPS = [
  ["crops", "Crops"],
  ["series", "Series"],
  ["varieties", "Varieties"],
  ["sellers", "Sellers"],
] as const;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = readQ(sp.q);
  const filters: BrowseFilterState = {
    season: parseSeasonParam(sp.season),
    method: parseMethodParam(sp.method),
    lifeCycle: null,
    hue: parseHueParam(sp.color_family),
    smallFarm: false,
  };
  const active = activeFilterLabels(filters);
  const navKey = [q, filters.season, filters.method, filters.hue].join("|");
  const { catalog } = await getServices();
  const r = q
    ? await catalog.search(q, {
        limit: 50,
        season: filters.season ? SEASON_PARAMS[filters.season] : undefined,
        methods: filters.method ? [METHOD_PARAMS[filters.method]] : undefined,
        colorFamily: filters.hue ? [filters.hue] : undefined,
        logClient: "web/search-page",
      })
    : null;
  const groups = GROUPS.map(([key, label]) => ({ key, label, items: (r?.[key] ?? []) as SearchResult[] })).filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

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
      ) : (
        <>
        <section id="search-results" className="mt-8" aria-labelledby="results-title">
          <h2 id="results-title" className="text-xl font-semibold" aria-live="polite" aria-atomic="true">
            {total > 0
              ? [`${total} result${total === 1 ? "" : "s"} for “${q}”`, ...active].join(" · ")
              : active.length
                ? `No results for “${q}” · ${active.join(" · ")}`
                : "Not in the catalog yet"}
          </h2>
          <BrowseFilters basePath="/search" state={filters} groups={["season", "method", "hue"]} params={{ q }} />
          {total === 0 ? (
            <>
            <ThemeArt name="empty-search" className="art-frame mx-auto mt-4 h-[220px] w-auto" />
            <p className="mt-2 text-muted" data-testid="zero-results">
              Nothing matches “{q}”. Check the spelling or try fewer words — or{" "}
              <Link href="/report?type=correct">tell us about a variety or seller we’re missing</Link>.
            </p>
            </>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="mt-6">
                <h3 className="eyebrow">{g.label}</h3>
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
                  {g.items.map((x) => (
                    <li key={`${x.type}-${x.slug}`}>
                      <Link href={x.href} className="tap flex flex-col px-4 py-3 no-underline hover:bg-leaf-50">
                        <span className="font-medium text-ink">{x.title}</span>
                        <span className="text-sm text-muted">{x.subtitle}</span>
                        {x.matchedAlias ? <span className="text-sm text-muted">also sold as “{x.matchedAlias}”</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
        <ResultsScrollClamp targetId="results-title" regionId="search-results" navKey={navKey} />
        </>
      )}
    </>
  );
}
