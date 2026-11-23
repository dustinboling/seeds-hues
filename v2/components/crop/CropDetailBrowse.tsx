"use client";

/**
 * The crop-detail browse block, interactive part (Tranche 3.1b-2): filter chips with
 * per-option counts (Sellers, multi-select Hue with swatch dots, Series), the Sort control,
 * the applied row with removers + Clear all, the result-count line (a persistent live
 * region), the variety grid (or the preserved empty states), and pagination. Rendered by the server page with
 * the initial browse snapshot; after hydration every filter change applies IN PLACE through
 * the shared `useInPlaceBrowse` hook — local state, one JSON fetch, no document reload, no
 * Next router navigation, no scroll, no page-view beacon — keeping the URL shareable
 * through the History API. This file owns only the crop page's rendering; the commit
 * discipline is shared with every surface.
 */

import Link from "next/link";
import { CropDetailFilterButtons, CropDetailFilters, cropDetailGroups } from "@/components/crop/CropDetailFilters";
import { InPlaceAppliedRow, useInPlaceBrowse, type InPlaceConfig } from "@/components/ui/InPlaceBrowse";
import { Pagination } from "@/components/ui/Pagination";
import { SortChips } from "@/components/ui/SortChips";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { browsePageFromSearch, type BrowseSortParam } from "@/lib/browse";
import {
  clearCropDetailFilters,
  cropCountStateFor,
  cropDetailCountLine,
  cropDetailFiltersFromSearch,
  cropDetailHref,
  cropFilterParams,
  cropRemoversFor,
  equalCropDetailFilters,
  hasActiveCropFilters,
  isCropDetailCountsPayload,
  type CropDetailFilterState,
  type CropDetailGroup,
  type CropHue,
} from "@/lib/crop-detail";
import { shortCommonName, titleCaseTag } from "@/lib/format";
import { inPlacePayloadCore, isRecord, type InPlaceSnapshot } from "@/lib/in-place";
import { totalPages } from "@/lib/paging";
import { proseCommonName } from "@/lib/services/template";
import { zeroSellerSentence } from "@/lib/zero-seller";
import type { CropDetailCounts, SeriesRef, VarietyListItem } from "@/lib/validators";

const API_BASE = "/api/browse/crops";
/** The 3.1b failure line (brief §2.5.6 contract — the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

/** The server-rendered browse snapshot this block hydrates from. */
export type CropDetailBrowseInitial = InPlaceSnapshot<CropDetailFilterState, VarietyListItem, CropDetailCounts>;

function isListItem(value: unknown): value is VarietyListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.varietyName !== "string") return false;
  if (typeof value.sellerCount !== "number" || !Array.isArray(value.media)) return false;
  const plant = value.plant;
  return isRecord(plant) && typeof plant.slug === "string" && typeof plant.commonName === "string";
}

export function CropDetailBrowse({
  slug,
  initial,
  hues,
  series,
  commonName,
  varietiesWithSellers,
}: {
  slug: string;
  initial: CropDetailBrowseInitial;
  hues: CropHue[];
  series: SeriesRef[];
  commonName: string;
  varietiesWithSellers: number;
}) {
  const basePath = `/crop/${slug}`;
  const apiPath = `${API_BASE}/${slug}`;
  const groups = cropDetailGroups(series);
  const seriesName = (s: string): string => series.find((r) => r.slug === s)?.name ?? titleCaseTag(s);
  const config: InPlaceConfig<CropDetailFilterState, VarietyListItem, CropDetailCounts> = {
    basePath,
    apiPath,
    params: {},
    failureMessage: FAILURE_MESSAGE,
    readPayload: (json) => inPlacePayloadCore(json, isListItem, isCropDetailCountsPayload),
    readSearch: cropDetailFiltersFromSearch,
    pageOfSearch: browsePageFromSearch,
    equalStates: equalCropDetailFilters,
    hasActive: hasActiveCropFilters,
    clearAll: clearCropDetailFilters,
    removersFor: (state) => cropRemoversFor(state, { seriesName }),
    hrefFor: (state) => cropDetailHref(basePath, state),
    apiUrlFor: (state) => {
      const qs = new URLSearchParams(cropFilterParams(state)).toString();
      return qs ? `${apiPath}?${qs}` : apiPath;
    },
    historyValueFor: (state) => ({ browse: cropFilterParams(state) }),
  };
  const browse = useInPlaceBrowse(initial, config);
  const { hydrated, committed, pending, shown, select, firstAllRef } = browse;
  const pages = totalPages(committed.total);
  const short = shortCommonName(commonName);
  const showZeroSeller = committed.state.hasSellers === true && varietiesWithSellers === 0;

  return (
    <>
      {hydrated ? (
        <CropDetailFilterButtons
          state={shown}
          counts={committed.counts}
          hues={hues}
          series={series}
          groups={groups}
          onSelect={(g: CropDetailGroup, v: string | null) => select((s) => cropCountStateFor(s, g, v))}
          firstAllRef={firstAllRef}
        />
      ) : (
        <CropDetailFilters basePath={basePath} state={committed.state} counts={committed.counts} hues={hues} series={series} />
      )}
      <SortChips
        sort={hydrated ? shown.sort : committed.state.sort}
        hrefFor={(sort: BrowseSortParam) => cropDetailHref(basePath, { ...committed.state, sort })}
        onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort }))}
        hydrated={hydrated}
      />
      <InPlaceAppliedRow config={config} browse={browse} />
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="crop-results-count" className="mt-4 text-muted" aria-live="polite" aria-atomic="true">
        {cropDetailCountLine(committed.state, committed.total, committed.page, pages)}
      </p>
      {/* Pending indication (§2.5.3's state discipline): busy while a filter change is in
          flight. Cleared on settle — the attribute is absent then, so settled markup is
          byte-identical with or without this line. */}
      <div id="crop-variety-results" className="mt-3" aria-busy={pending === null ? undefined : true}>
        {committed.total > 0 ? (
          <VarietyGrid items={committed.items} />
        ) : showZeroSeller ? (
          <p className="text-muted">
            {zeroSellerSentence(proseCommonName(commonName))} Join a waiting list on any variety page and we will let you know when a
            seller lists one.{" "}
            {hydrated ? (
              <button type="button" className="link-button" onClick={() => select((s) => clearCropDetailFilters(s), "first-all")}>
                Clear filters
              </button>
            ) : (
              <Link href={cropDetailHref(basePath, clearCropDetailFilters(committed.state))} scroll={false}>
                Clear filters
              </Link>
            )}
            .
          </p>
        ) : (
          <p className="text-muted">
            No varieties match.{" "}
            {hydrated ? (
              <button type="button" className="link-button" onClick={() => select((s) => clearCropDetailFilters(s), "first-all")}>
                Clear filters
              </button>
            ) : (
              <Link href={cropDetailHref(basePath, clearCropDetailFilters(committed.state))} scroll={false}>
                Clear filters
              </Link>
            )}
            .
          </p>
        )}
      </div>
      <Pagination
        basePath={basePath}
        page={committed.page}
        totalPages={pages}
        extra={cropFilterParams(committed.state)}
        label={`${short} variety pages`}
      />
    </>
  );
}
