/**
 * The /variety browse block, interactive part — ported from
 * v2/components/variety/VarietyBrowse.tsx (same chips with per-option
 * counts, same Sort control, same applied row with removers + Clear all,
 * same result-count line, same results grid or zero-results state, same
 * pagination; plain anchors instead of next/link): filter chips with
 * per-option counts, the Sort control, the applied row, the count line,
 * the results grid, and pagination.
 *
 * Rendered by the server page with the initial browse snapshot; after
 * hydration every filter change applies IN PLACE through Vike's client
 * router — one navigation per deliberate change, no document reload, no
 * scroll, no page-view beacon — keeping the URL shareable. The commit
 * discipline (pending cue, aria-busy, popstate, adoption, failure path,
 * focus) is the shared `useInPlaceNav` hook; this file owns only
 * /variety's rendering: its count line, results grid, empty state, and
 * pagination.
 */
import { VarietyGrid } from "../variety/VarietyCard";
import type { VarietyBrowseData } from "../../data/load";
import {
  browseCountLine,
  browseFiltersFromSearch,
  browseHref,
  clearAllFilters,
  equalBrowseFilters,
  filterParams,
  hasActiveFilters,
  removersFor,
  varietyDocumentTitle,
  type BrowseFilterState,
  type BrowseSortParam,
} from "../../lib/browse";
import { totalPages } from "../../lib/paging";
import { EMPTY_BROWSE, SMALL_FARM_EMPTY_BROWSE } from "../../lib/small-farm";
import { AppliedRow } from "../browse/AppliedRow";
import { BrowseFilters } from "../browse/BrowseFilters";
import { useInPlaceNav, type NavigateFn } from "../browse/InPlaceNav";
import { Pagination } from "../browse/Pagination";
import { SortChips } from "../browse/SortChips";

const BASE_PATH = "/variety";
const GROUPS = ["season", "method", "lifeCycle", "hue", "smallFarm"] as const;
/** The shipped 3.1a failure line — Quinn's 3.1-K gate pinned this wording. */
const FAILURE_MESSAGE = "Couldn't update the list — the last results are still shown.";

export function VarietyBrowse({ initial, navigateFn }: { initial: VarietyBrowseData; navigateFn?: NavigateFn }) {
  const browse = useInPlaceNav<BrowseFilterState>({
    committed: initial.state,
    page: initial.page,
    equalStates: equalBrowseFilters,
    hrefFor: (state) => browseHref(BASE_PATH, state),
    parseHref: (href) => {
      const url = new URL(href, "http://localhost");
      return url.pathname === BASE_PATH ? browseFiltersFromSearch(url.search, "multi") : null;
    },
    titleFor: (state, page) => varietyDocumentTitle(state, page),
    navigateFn,
  });
  const { hydrated, committed, pending, pendingCue, shown, select } = browse;
  const pages = totalPages(initial.total);

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="variety-results-count" className="browse-count" aria-live="polite" aria-atomic="true">
        {browseCountLine(committed, initial.total, initial.page, pages)}
      </p>
      <BrowseFilters basePath={BASE_PATH} groups={[...GROUPS]} hueMode="multi" counts={initial.counts} unit="varieties" browse={browse} />
      <SortChips
        sort={hydrated ? shown.sort : committed.sort}
        hrefFor={(sort: BrowseSortParam) => browseHref(BASE_PATH, { ...committed, sort })}
        onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort }))}
        hydrated={hydrated}
      />
      <AppliedRow
        browse={browse}
        removers={removersFor(shown)}
        hasActive={hasActiveFilters}
        clearAll={clearAllFilters}
        hrefFor={(state) => browseHref(BASE_PATH, state)}
        failureMessage={FAILURE_MESSAGE}
      />
      {/* Pending indication (§2.5.3 as amended 2026-11-23): busy while a filter change
          is in flight, so assistive tech hears an update coming instead of a stale list
          stated as current. Cleared on settle — the attribute is absent then, so settled
          markup is byte-identical with or without this line. Past ~200ms in flight the
          region also shows the pending cue (a leaf hairline + wash from the token layer —
          no new color, no spinner, no skeleton). */}
      <div id="variety-results" className={pendingCue ? "browse-results browse-pending" : "browse-results"} aria-busy={pending === null ? undefined : true}>
        {initial.total > 0 ? (
          <VarietyGrid items={initial.items} wide />
        ) : (
          // Empty state — announced first by the count line's zero above.
          <p className="browse-empty" data-testid="variety-empty">
            {committed.smallFarm ? SMALL_FARM_EMPTY_BROWSE : EMPTY_BROWSE}
            {hasActiveFilters(committed) ? (
              <>
                {" "}
                {hydrated ? (
                  <button type="button" className="link-button" onClick={() => select((s) => clearAllFilters(s), "first-all")}>
                    Clear filters
                  </button>
                ) : (
                  <a href={browseHref(BASE_PATH, clearAllFilters(committed))} data-vike="false">
                    Clear filters
                  </a>
                )}
                .
              </>
            ) : null}
          </p>
        )}
      </div>
      <Pagination
        basePath={BASE_PATH}
        page={initial.page}
        totalPages={pages}
        extra={filterParams(committed)}
        label="Varieties pages"
        onNavigate={hydrated ? browse.onAnchorNavigate : undefined}
      />
    </>
  );
}
