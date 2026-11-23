"use client";

/**
 * The /seller browse block, interactive part (Tranche 3.1b-2): the count line (a persistent
 * live region), the State cloud with per-state counts, the applied row (the single State
 * remover — Clear All is omitted here per §2.6.2's bounded exception, "All states" remains
 * the reset), and the seller grid. Rendered by the server page with the initial browse
 * snapshot; after hydration every filter change applies IN PLACE through the shared
 * `useInPlaceBrowse` hook — local state, one JSON fetch, no document reload, no Next router
 * navigation, no scroll, no page-view beacon — keeping the URL shareable through the
 * History API. This file owns only the seller index's rendering; the commit discipline is
 * shared with every surface.
 */

import Link from "next/link";
import { SellerCard } from "@/components/seller/SellerCard";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { StateFilter } from "@/components/seller/StateFilter";
import { InPlaceAppliedRow, useInPlaceBrowse, type InPlaceConfig } from "@/components/ui/InPlaceBrowse";
import { Pagination } from "@/components/ui/Pagination";
import { browsePageFromSearch } from "@/lib/browse";
import { inPlacePayloadCore, isRecord, type InPlaceSnapshot } from "@/lib/in-place";
import { totalPages } from "@/lib/paging";
import {
  clearSellerBrowseFilters,
  equalSellerBrowseFilters,
  hasActiveSellerFilters,
  isSellerBrowseCountsPayload,
  sellerBrowseCountText,
  sellerBrowseFiltersFromSearch,
  sellerBrowseHref,
  sellerDocumentTitle,
  sellerFilterParams,
  sellerRemoversFor,
  type SellerBrowseState,
} from "@/lib/seller-browse";
import type { SellerBrowseCounts, SellerListItem, SellerState } from "@/lib/validators";

const BASE_PATH = "/seller";
const API_PATH = "/api/browse/sellers";
/** The 3.1b failure line (brief §2.5.6 contract — the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

/** The server-rendered browse snapshot this block hydrates from. */
export type SellerBrowseInitial = InPlaceSnapshot<SellerBrowseState, SellerListItem, SellerBrowseCounts>;

function isListItem(value: unknown): value is SellerListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.name !== "string") return false;
  if (typeof value.varietyCount !== "number" || typeof value.isSmallFarm !== "boolean") return false;
  return true;
}

export function SellerBrowse({ initial, states }: { initial: SellerBrowseInitial; states: SellerState[] }) {
  const config: InPlaceConfig<SellerBrowseState, SellerListItem, SellerBrowseCounts> = {
    basePath: BASE_PATH,
    apiPath: API_PATH,
    params: {},
    failureMessage: FAILURE_MESSAGE,
    readPayload: (json) => inPlacePayloadCore(json, isListItem, isSellerBrowseCountsPayload),
    readSearch: (search) => sellerBrowseFiltersFromSearch(search, states),
    pageOfSearch: browsePageFromSearch,
    equalStates: equalSellerBrowseFilters,
    hasActive: hasActiveSellerFilters,
    clearAll: clearSellerBrowseFilters,
    removersFor: (state) => sellerRemoversFor(state, states),
    hrefFor: (state) => sellerBrowseHref(BASE_PATH, state),
    apiUrlFor: (state) => {
      const qs = new URLSearchParams(sellerFilterParams(state)).toString();
      return qs ? `${API_PATH}?${qs}` : API_PATH;
    },
    historyValueFor: (state) => ({ browse: sellerFilterParams(state) }),
    titleFor: (state, page) => sellerDocumentTitle(state, states, page),
  };
  const browse = useInPlaceBrowse(initial, config);
  const { committed, pending, pendingCue } = browse;
  const pages = totalPages(committed.total);
  const active = states.find((s) => s.code === committed.state.state) ?? null;

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="seller-results-count" className="mt-2 max-w-2xl text-muted" aria-live="polite" aria-atomic="true">
        {active ? (
          <>
            {sellerBrowseCountText(committed.state, committed.total, states)} <Link href={`/state/${active.slug}`}>Seed sellers in {active.name}</Link>.
          </>
        ) : (
          <>{sellerBrowseCountText(committed.state, committed.total, states)}</>
        )}
        {pages > 1 ? ` Page ${committed.page} of ${pages}.` : ""}
      </p>
      {/* Badge legend (ux §5.3, copy-deck §5.5): once, at index level, above the state filter. */}
      <SmallFarmLegend className="mt-1 max-w-2xl" />
      <StateFilter basePath={BASE_PATH} states={states} browse={browse} />
      <InPlaceAppliedRow config={config} browse={browse} showClearAll={false} />
      {/* Pending indication (§2.5.3's state discipline): busy while a filter change is in
          flight. Cleared on settle — the attribute is absent then, so settled markup is
          byte-identical with or without this line. D-B1-2: past ~1s in flight the region
          also dims (an owned opacity utility — no new color, no spinner, no skeleton). */}
      <div
        id="seller-results"
        className={pendingCue ? "opacity-50" : undefined}
        aria-busy={pending === null ? undefined : true}
      >
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {committed.items.map((s) => (
            <li key={s.slug}>
              <SellerCard s={s} smallFarmBadge />
            </li>
          ))}
        </ul>
      </div>
      <Pagination
        basePath={BASE_PATH}
        page={committed.page}
        totalPages={pages}
        extra={sellerFilterParams(committed.state)}
        label="Sellers pages"
      />
    </>
  );
}
