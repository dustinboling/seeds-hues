/**
 * The crop-detail browse block, interactive part — ported from
 * v2/components/crop/CropDetailBrowse.tsx (same filter chips with
 * per-option counts, same Sort control, same applied row, same
 * result-count line, same variety grid or preserved empty states, same
 * pagination; plain anchors instead of next/link): filter chips with
 * per-option counts (Sellers, multi-select Hue with swatch dots, Series),
 * the Sort control, the applied row with removers + Clear all, the
 * result-count line (a persistent live region), the variety grid (or the
 * preserved empty states), and pagination.
 *
 * Rendered by the server page with the initial browse snapshot; after
 * hydration every filter change applies IN PLACE through Vike's client
 * router — one navigation per deliberate change, no document reload, no
 * scroll, no page-view beacon — keeping the URL shareable. The commit
 * discipline is the shared `useInPlaceNav` hook; this file owns only the
 * crop page's rendering.
 */
import { VarietyGrid } from "../variety/VarietyCard";
import { AppliedRow } from "../browse/AppliedRow";
import { useInPlaceNav, type NavigateFn } from "../browse/InPlaceNav";
import { Pagination } from "../browse/Pagination";
import { SortChips } from "../browse/SortChips";
import { CropDetailFilters } from "./CropDetailFilters";
import type { BrowseSortParam } from "../../lib/browse";
import { proseCommonName, shortCommonName, titleCaseTag } from "../../lib/format";
import { totalPages } from "../../lib/paging";
import { zeroSellerSentence } from "../../lib/zero-seller";
import type { ApiCropDetailCounts, ApiSeriesRef, ApiVarietyListItem } from "../../data/types";
import {
  clearCropDetailFilters,
  cropDetailCountLine,
  cropDetailDocumentTitle,
  cropDetailFiltersFromSearch,
  cropDetailHref,
  cropFilterParams,
  cropRemoversFor,
  equalCropDetailFilters,
  hasActiveCropFilters,
  type CropDetailFilterState,
} from "../../lib/crop-detail";

/** The 3.1b failure line — the wording stands for every new surface. */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

/** The server-rendered browse snapshot this block hydrates from. */
export interface CropDetailBrowseInitial {
  state: CropDetailFilterState;
  counts: ApiCropDetailCounts;
  items: ApiVarietyListItem[];
  total: number;
  page: number;
}

export function CropDetailBrowse({
  slug,
  initial,
  hues,
  series,
  commonName,
  latinName,
  varietyCount,
  varietiesWithSellers,
  navigateFn,
}: {
  slug: string;
  initial: CropDetailBrowseInitial;
  hues: Parameters<typeof CropDetailFilters>[0]["hues"];
  series: ApiSeriesRef[];
  commonName: string;
  latinName: string | null;
  varietyCount: number;
  varietiesWithSellers: number;
  navigateFn?: NavigateFn;
}) {
  const basePath = `/crop/${slug}`;
  const browse = useInPlaceNav<CropDetailFilterState>({
    committed: initial.state,
    page: initial.page,
    equalStates: equalCropDetailFilters,
    hrefFor: (state) => cropDetailHref(basePath, state),
    parseHref: (href) => {
      const url = new URL(href, "http://localhost");
      return url.pathname === basePath ? cropDetailFiltersFromSearch(url.search) : null;
    },
    // The crop title names no filters — only the page suffix moves (page reset to 1).
    titleFor: (_state, page) => cropDetailDocumentTitle({ commonName, latinName, varietyCount, varietiesWithSellers }, page),
    navigateFn,
  });
  const { hydrated, pending, pendingCue, shown, select } = browse;
  const seriesName = (s: string): string => series.find((r) => r.slug === s)?.name ?? titleCaseTag(s);
  const pages = totalPages(initial.total);
  const short = shortCommonName(commonName);
  const showZeroSeller = initial.state.hasSellers === true && varietiesWithSellers === 0;

  return (
    <>
      <CropDetailFilters basePath={basePath} state={initial.state} counts={initial.counts} hues={hues} series={series} browse={browse} />
      <SortChips
        sort={hydrated ? shown.sort : initial.state.sort}
        hrefFor={(sort: BrowseSortParam) => cropDetailHref(basePath, { ...initial.state, sort })}
        onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort }))}
        hydrated={hydrated}
      />
      <AppliedRow
        browse={browse}
        removers={cropRemoversFor(shown, { seriesName })}
        hasActive={hasActiveCropFilters}
        clearAll={clearCropDetailFilters}
        hrefFor={(state) => cropDetailHref(basePath, state)}
        failureMessage={FAILURE_MESSAGE}
      />
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="crop-results-count" className="browse-count browse-count-crop" aria-live="polite" aria-atomic="true">
        {cropDetailCountLine(initial.state, initial.total, initial.page, pages)}
      </p>
      {/* Pending indication: busy while a filter change is in flight.
          Cleared on settle — the attribute is absent then, so settled markup
          is byte-identical with or without this line. Past ~200ms in flight
          the region also shows the pending cue. */}
      <div
        id="crop-variety-results"
        className={pendingCue ? "browse-results browse-results-crop browse-pending" : "browse-results browse-results-crop"}
        aria-busy={pending === null ? undefined : true}
      >
        {initial.total > 0 ? (
          <VarietyGrid items={initial.items} />
        ) : showZeroSeller ? (
          <p className="browse-empty">
            {zeroSellerSentence(proseCommonName(commonName))} Join a waiting list on any variety page and we will let you know when a
            seller lists one.{" "}
            {hydrated ? (
              <button type="button" className="link-button" onClick={() => select((s) => clearCropDetailFilters(s), "first-all")}>
                Clear filters
              </button>
            ) : (
              <a href={cropDetailHref(basePath, clearCropDetailFilters(initial.state))} data-vike="false">
                Clear filters
              </a>
            )}
            .
          </p>
        ) : (
          <p className="browse-empty">
            No varieties match.{" "}
            {hydrated ? (
              <button type="button" className="link-button" onClick={() => select((s) => clearCropDetailFilters(s), "first-all")}>
                Clear filters
              </button>
            ) : (
              <a href={cropDetailHref(basePath, clearCropDetailFilters(initial.state))} data-vike="false">
                Clear filters
              </a>
            )}
            .
          </p>
        )}
      </div>
      <Pagination
        basePath={basePath}
        page={initial.page}
        totalPages={pages}
        extra={cropFilterParams(initial.state)}
        label={`${short} variety pages`}
        onNavigate={hydrated ? browse.onAnchorNavigate : undefined}
      />
    </>
  );
}
