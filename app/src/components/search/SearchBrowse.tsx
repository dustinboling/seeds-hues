/**
 * The /search results block, interactive part — ported from
 * v2/components/search/SearchBrowse.tsx (same results heading, same filter
 * chips with per-option counts, same applied row with removers + Clear all
 * that keeps q, same grouped results or zero-results state with its
 * did-you-mean suggestion; plain anchors instead of next/link).
 *
 * Rendered by the server page with the initial search snapshot; after
 * hydration every filter change applies IN PLACE through Vike's client
 * router — one navigation per deliberate change, no document reload, no
 * scroll, no page-view beacon — keeping the URL shareable. The commit
 * discipline (pending cue, aria-busy, popstate, adoption, failure path,
 * focus) is the shared `useInPlaceNav` hook; this file owns only /search's
 * rendering: its heading, groups, and zero-results state. The query itself
 * never changes in place (a new query is a navigation): a popped URL
 * carrying a different query is foreign to this layer.
 */
import { ThemeArt } from "../ThemeArt";
import type { SearchBrowseData } from "../../data/load";
import {
  activeFilterLabels,
  browseHref,
  clearAllFilters,
  equalBrowseFilters,
  hasActiveFilters,
  removersFor,
  scopedBrowseFiltersFromSearch,
  type BrowseFilterGroup,
  type BrowseFilterState,
} from "../../lib/browse";
import { AppliedRow } from "../browse/AppliedRow";
import { BrowseFilters } from "../browse/BrowseFilters";
import { useInPlaceNav, type NavigateFn } from "../browse/InPlaceNav";

const BASE_PATH = "/search";
const GROUPS = ["season", "method", "lifeCycle", "hue"] as const satisfies readonly BrowseFilterGroup[];
/** The 3.1b failure line (the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

// The match keys are the singular SearchResult types: the re-group below
// compares x.type === key, so plural keys would silently drop every group
// but series. Labels keep the shipped plural wording; order is the shipped
// grouped layout.
const GROUP_DEFS = [
  ["crop", "Crops"],
  ["series", "Series"],
  ["variety", "Varieties"],
  ["seller", "Sellers"],
] as const;

export function SearchBrowse({ initial, q, navigateFn }: { initial: SearchBrowseData; q: string; navigateFn?: NavigateFn }) {
  const browse = useInPlaceNav<BrowseFilterState>({
    committed: initial.state,
    page: 1,
    equalStates: equalBrowseFilters,
    hrefFor: (state) => browseHref(BASE_PATH, state, { q }),
    parseHref: (href) => {
      const url = new URL(href, "http://localhost");
      if (url.pathname !== BASE_PATH) return null;
      // A popped URL carrying a different query is not this layer's (true
      // navigation) — the query itself never changes in place.
      if ((url.searchParams.get("q") ?? "").trim().slice(0, 100) !== q) return null;
      return scopedBrowseFiltersFromSearch(url.search, [...GROUPS], "single");
    },
    navigateFn,
  });
  const { committed, pending, pendingCue } = browse;
  // The snapshot groups, flattened for the commit model and re-grouped here
  // for rendering (the query never changes in place, so the groups are the
  // committed ones).
  const items = [...initial.crops, ...initial.series, ...initial.varieties, ...initial.sellers];
  const active = activeFilterLabels(committed);
  const title =
    initial.total > 0
      ? [`${initial.total} result${initial.total === 1 ? "" : "s"} for “${q}”`, ...active].join(" · ")
      : active.length
        ? `No results for “${q}” · ${active.join(" · ")}`
        : "Not in the catalog yet";
  const groups = GROUP_DEFS.map(([key, label]) => ({
    key,
    label,
    items: items.filter((x) => x.type === key),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <h2 id="results-title" className="search-results-title" aria-live="polite" aria-atomic="true">
        {title}
      </h2>
      <BrowseFilters basePath={BASE_PATH} groups={[...GROUPS]} params={{ q }} hueMode="single" counts={initial.counts} unit="results" browse={browse} />
      <AppliedRow
        browse={browse}
        removers={removersFor(browse.shown)}
        hasActive={hasActiveFilters}
        clearAll={clearAllFilters}
        hrefFor={(state) => browseHref(BASE_PATH, state, { q })}
        failureMessage={FAILURE_MESSAGE}
      />
      {/* Pending cue (§2.5.3 as amended 2026-11-23): past ~200ms in flight the region carries the leaf hairline + wash. */}
      <div className={pendingCue ? "browse-pending" : undefined} aria-busy={pending === null ? undefined : true}>
        {initial.total === 0 ? (
          <>
            <ThemeArt name="empty-search" className="art-frame search-empty-art" />
            <p className="search-empty-copy" data-testid="zero-results">
              Nothing matches “{q}”. Check the spelling or try fewer words — or{" "}
              <a href="/report?type=correct">tell us about a variety or seller we’re missing</a>.
            </p>
            {initial.suggestion ? (
              <p className="search-empty-copy" data-testid="did-you-mean">
                Did you mean{" "}
                <a href={initial.suggestion.href}>
                  <strong>{initial.suggestion.name}</strong>
                </a>
                ?
              </p>
            ) : null}
          </>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="search-results-group">
              <h3 className="eyebrow">{g.label}</h3>
              <ul className="search-results-list">
                {g.items.map((x) => (
                  <li key={`${x.type}-${x.slug}`}>
                    <a href={x.href} className="search-result-link">
                      <span className="search-result-title">{x.title}</span>
                      <span className="search-result-subtitle">{x.subtitle}</span>
                      {x.matchedAlias ? <span className="search-result-subtitle">also sold as “{x.matchedAlias}”</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </>
  );
}
