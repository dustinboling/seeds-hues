/**
 * The /seller browse block, interactive part — ported from
 * v2/components/seller/SellerBrowse.tsx (same count line live region,
 * same State cloud, same applied row with the single State remover and NO
 * Clear All per §2.6.2's bounded exception, same seller grid; plain
 * anchors instead of next/link). Rendered by the server page with the
 * initial browse snapshot; after hydration every filter change applies IN
 * PLACE through Vike's client router. This file owns only the seller
 * index's rendering; the commit discipline is the shared useInPlaceNav.
 */
import { SmallFarmLegend } from "./SmallFarmBadge";
import { SellerCard } from "./SellerCard";
import { StateFilter } from "./StateFilter";
import type { SellerBrowseData } from "../../data/load";
import { totalPages } from "../../lib/paging";
import {
  clearSellerBrowseFilters,
  equalSellerBrowseFilters,
  hasActiveSellerFilters,
  sellerBrowseCountText,
  sellerBrowseFiltersFromSearch,
  sellerDocumentTitle,
  sellerBrowseHref,
  sellerFilterParams,
  sellerRemoversFor,
  type SellerBrowseState,
} from "../../lib/seller-browse";
import { AppliedRow } from "../browse/AppliedRow";
import { useInPlaceNav, type NavigateFn } from "../browse/InPlaceNav";
import { Pagination } from "../browse/Pagination";

const BASE_PATH = "/seller";
/** The 3.1b failure line (the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

export function SellerBrowse({ initial, navigateFn }: { initial: SellerBrowseData; navigateFn?: NavigateFn }) {
  const browse = useInPlaceNav<SellerBrowseState>({
    committed: initial.state,
    page: initial.page,
    equalStates: equalSellerBrowseFilters,
    hrefFor: (state) => sellerBrowseHref(BASE_PATH, state),
    parseHref: (href) => {
      const url = new URL(href, "http://localhost");
      return url.pathname === BASE_PATH ? sellerBrowseFiltersFromSearch(url.search, initial.states) : null;
    },
    titleFor: (state, page) => sellerDocumentTitle(state, initial.states, page),
    navigateFn,
  });
  const { hydrated, committed, pending, pendingCue } = browse;
  const pages = totalPages(initial.total);
  const active = initial.states.find((s) => s.code === committed.state) ?? null;

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="seller-results-count" className="browse-count browse-count-narrow" aria-live="polite" aria-atomic="true">
        {active ? (
          <>
            {sellerBrowseCountText(committed, initial.total, initial.states)}{" "}
            <a href={`/state/${active.slug}`}>Seed sellers in {active.name}</a>
            .
          </>
        ) : (
          <>{sellerBrowseCountText(committed, initial.total, initial.states)}</>
        )}
        {pages > 1 ? ` Page ${initial.page} of ${pages}.` : ""}
      </p>
      {/* Badge legend: once, at index level, above the state filter. */}
      <SmallFarmLegend className="browse-legend-narrow" />
      <StateFilter basePath={BASE_PATH} states={initial.states} counts={initial.counts} browse={browse} />
      <AppliedRow
        browse={browse}
        removers={sellerRemoversFor(browse.shown, initial.states)}
        hasActive={hasActiveSellerFilters}
        clearAll={clearSellerBrowseFilters}
        hrefFor={(state) => sellerBrowseHref(BASE_PATH, state)}
        showClearAll={false}
        failureMessage={FAILURE_MESSAGE}
      />
      {/* Pending indication (§2.5.3 as amended 2026-11-23): busy while a filter change
          is in flight. Cleared on settle — the attribute is absent then, so settled markup
          is byte-identical with or without this line. Past ~200ms in flight the region
          also shows the pending cue (a leaf hairline + wash from the token layer — no new
          color, no spinner, no skeleton). */}
      <div
        id="seller-results"
        className={pendingCue ? "browse-results browse-pending" : "browse-results"}
        aria-busy={pending === null ? undefined : true}
      >
        <ul className="seller-grid">
          {initial.items.map((s) => (
            <li key={s.slug}>
              <SellerCard s={s} smallFarmBadge />
            </li>
          ))}
        </ul>
      </div>
      <Pagination
        basePath={BASE_PATH}
        page={initial.page}
        totalPages={pages}
        extra={sellerFilterParams(committed)}
        label="Sellers pages"
        onNavigate={hydrated ? browse.onAnchorNavigate : undefined}
      />
    </>
  );
}
