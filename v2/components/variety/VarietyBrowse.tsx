"use client";

/**
 * The /variety browse block, interactive part (Tranche 3.1a; 3.1b rides the shared in-place
 * machinery): filter chips with per-option counts, the Sort control, the applied row with
 * removers + Clear all, the result-count line, the results grid (or zero-results state), and
 * pagination.
 * Rendered by the server page with the initial browse snapshot; after hydration every
 * filter change applies IN PLACE — local state, one JSON fetch, no document reload, no Next
 * router navigation, no scroll, no page-view beacon — and keeps the URL shareable through
 * the History API. The commit discipline (fetch, history, popstate, adoption, failure path,
 * focus) is the shared `useInPlaceBrowse` hook; this file owns only /variety's rendering:
 * its count line, results grid, empty state and pagination.
 */

import Link from "next/link";
import { InPlaceAppliedRow, InPlaceFilters, browseInPlaceConfig, useInPlaceBrowse } from "@/components/ui/InPlaceBrowse";
import { Pagination } from "@/components/ui/Pagination";
import { SortChips } from "@/components/ui/SortChips";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import {
  browseCountLine,
  browseHref,
  clearAllFilters,
  filterParams,
  hasActiveFilters,
  varietyDocumentTitle,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type BrowseSortParam,
} from "@/lib/browse";
import { browsePayloadCore, isRecord, type InPlaceSnapshot } from "@/lib/in-place";
import { totalPages } from "@/lib/paging";
import { EMPTY_BROWSE, SMALL_FARM_EMPTY_BROWSE } from "@/lib/small-farm";
import type { VarietyListItem } from "@/lib/validators";

const BASE_PATH = "/variety";
const API_PATH = "/api/browse/varieties";
const GROUPS: BrowseFilterGroup[] = ["season", "method", "lifeCycle", "hue", "smallFarm"];
/** The shipped 3.1a failure line — Quinn's 3.1-K gate pinned this wording. */
const FAILURE_MESSAGE = "Couldn't update the list — the last results are still shown.";

/** The server-rendered browse snapshot this block hydrates from. */
export type VarietyBrowseInitial = InPlaceSnapshot<BrowseFilterState, VarietyListItem>;

function isListItem(value: unknown): value is VarietyListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.varietyName !== "string") return false;
  if (typeof value.sellerCount !== "number" || !Array.isArray(value.media)) return false;
  const plant = value.plant;
  return isRecord(plant) && typeof plant.slug === "string" && typeof plant.commonName === "string";
}

function readPayload(json: unknown): ReturnType<typeof browsePayloadCore<VarietyListItem>> {
  return browsePayloadCore(json, isListItem);
}

export function VarietyBrowse({ initial }: { initial: VarietyBrowseInitial }) {
  const config = browseInPlaceConfig<VarietyListItem>({
    basePath: BASE_PATH,
    apiPath: API_PATH,
    groups: GROUPS,
    hueMode: "multi",
    unit: "varieties",
    failureMessage: FAILURE_MESSAGE,
    readPayload,
    withSort: true,
    titleFor: (state, page) => varietyDocumentTitle(state, page),
  });
  const browse = useInPlaceBrowse(initial, config);
  const { hydrated, committed, pending, pendingCue, shown, select } = browse;
  const pages = totalPages(committed.total);

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="variety-results-count" className="mt-2 text-muted" aria-live="polite" aria-atomic="true">
        {browseCountLine(committed.state, committed.total, committed.page, pages)}
      </p>
      <InPlaceFilters config={config} browse={browse} />
      <SortChips
        sort={hydrated ? shown.sort : committed.state.sort}
        hrefFor={(sort: BrowseSortParam) => browseHref(BASE_PATH, { ...committed.state, sort })}
        onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort }))}
        hydrated={hydrated}
      />
      <InPlaceAppliedRow config={config} browse={browse} />
      {/* Pending indication (§2.5.3's state discipline): busy while a filter change is in
          flight, so assistive tech hears an update coming instead of a stale list stated as
          current. Cleared on settle — the attribute is absent then, so settled markup is
          byte-identical with or without this line. D-B1-2: past ~1s in flight the region
          also dims (an owned opacity utility — no new color, no spinner, no skeleton). */}
      <div
        id="variety-results"
        className={pendingCue ? "mt-6 opacity-50" : "mt-6"}
        aria-busy={pending === null ? undefined : true}
      >
        {committed.total > 0 ? (
          <VarietyGrid items={committed.items} wide />
        ) : (
          // Empty state (ux-spec §3.5) — announced first by the count line's zero above.
          <p className="text-muted" data-testid="variety-empty">
            {committed.state.smallFarm ? SMALL_FARM_EMPTY_BROWSE : EMPTY_BROWSE}
            {hasActiveFilters(committed.state) ? (
              <>
                {" "}
                {hydrated ? (
                  <button type="button" className="link-button" onClick={() => select((s) => clearAllFilters(s), "first-all")}>
                    Clear filters
                  </button>
                ) : (
                  <Link href={browseHref(BASE_PATH, clearAllFilters(committed.state))} scroll={false}>
                    Clear filters
                  </Link>
                )}
                .
              </>
            ) : null}
          </p>
        )}
      </div>
      <Pagination
        basePath={BASE_PATH}
        page={committed.page}
        totalPages={pages}
        extra={filterParams(committed.state)}
        label="Varieties pages"
      />
    </>
  );
}
