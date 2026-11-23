"use client";

/**
 * The home "Browse by crop" block, interactive part (Tranche 3.1b): the count line (a
 * persistent live region, unconditional — at rest it reads the unfiltered crop total),
 * filter chips with per-option counts, the applied row with removers + Clear all, and the
 * crop packet grid (or the filtered-empty state). Rendered by the server page with the
 * initial browse snapshot; after hydration every filter change applies IN PLACE through
 * the shared `useInPlaceBrowse` hook — local state, one JSON fetch, no document reload, no
 * Next router navigation, no scroll, no page-view beacon — keeping the URL shareable
 * through the History API. This file owns only the home section's rendering; the commit
 * discipline is shared with every surface.
 */

import Link from "next/link";
import { CropCardImage } from "@/components/crop/CropCardImage";
import { InPlaceAppliedRow, InPlaceFilters, browseInPlaceConfig, useInPlaceBrowse } from "@/components/ui/InPlaceBrowse";
import { clearAllFilters, cropBrowseCountLine, hasActiveFilters, type BrowseFilterGroup, type BrowseFilterState } from "@/lib/browse";
import { shortCommonName } from "@/lib/format";
import { browsePayloadCore, isRecord, type InPlaceSnapshot } from "@/lib/in-place";
import { EMPTY_CROP_BROWSE } from "@/lib/small-farm";
import type { CropListItem } from "@/lib/validators";

const BASE_PATH = "/";
const API_PATH = "/api/browse/crops";
const GROUPS: BrowseFilterGroup[] = ["season", "method"];
/** The 3.1b failure line (brief §2.5.6 contract — the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

/** The server-rendered browse snapshot this block hydrates from. */
export type HomeBrowseInitial = InPlaceSnapshot<BrowseFilterState, CropListItem>;

function isCropListItem(value: unknown): value is CropListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.commonName !== "string") return false;
  if (typeof value.varietyCount !== "number" || !Array.isArray(value.media)) return false;
  return true;
}

function readPayload(json: unknown): ReturnType<typeof browsePayloadCore<CropListItem>> {
  return browsePayloadCore(json, isCropListItem);
}

export function HomeBrowse({ initial }: { initial: HomeBrowseInitial }) {
  const config = browseInPlaceConfig<CropListItem>({
    basePath: BASE_PATH,
    apiPath: API_PATH,
    groups: GROUPS,
    hueMode: "single",
    unit: "crops",
    failureMessage: FAILURE_MESSAGE,
    readPayload,
  });
  const browse = useInPlaceBrowse(initial, config);
  const { hydrated, committed, pending, select } = browse;

  return (
    <>
      {/* Persistent live region: unconditional, text updates, never remounts — exactly one announcement per commit. */}
      <p className="mt-3 text-muted" data-testid="filter-result" aria-live="polite" aria-atomic="true">
        {cropBrowseCountLine(committed.state, committed.total)}
      </p>
      <InPlaceFilters config={config} browse={browse} />
      <InPlaceAppliedRow config={config} browse={browse} />
      <div aria-busy={pending === null ? undefined : true}>
        {committed.total > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {committed.items.map((c) => (
              <li key={c.slug} className="h-full">
                {/* Vintage seed packet, revised 2026-11-16 at the owner's direction: the crop
                    illustration as packet art on top, the crop name centred at the BOTTOM in a
                    fixed-height zone, and NO seed-house imprint line. No counts — the owner
                    asked for the variety/seller count lines off the homepage cards. Every card
                    is the same height: full-height link, fixed-aspect art, fixed name zone. */}
                <Link
                  href={`/crop/${c.slug}`}
                  className="card card-hover packet tap flex h-full flex-col items-center p-4 text-center no-underline"
                >
                  <span className="block w-full">
                    <CropCardImage media={c.media} commonName={c.commonName} />
                  </span>
                  <span aria-hidden="true" className="divider-stem-mini mt-1" />
                  <span className="flex h-[3.5rem] items-center justify-center">
                    <span className="line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">{shortCommonName(c.commonName)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // Filtered-empty state (ux-spec §3.5, B-12) — announced first by the count line's
          // zero above; the applied row stays visible above for recovery.
          <p className="mt-4 text-muted" data-testid="home-crop-empty">
            {EMPTY_CROP_BROWSE}
            {hasActiveFilters(committed.state) ? (
              <>
                {" "}
                {hydrated ? (
                  <button type="button" className="link-button" onClick={() => select(() => clearAllFilters(), "first-all")}>
                    Clear filters
                  </button>
                ) : (
                  <Link href={BASE_PATH} scroll={false}>
                    Clear filters
                  </Link>
                )}
                .
              </>
            ) : null}
          </p>
        )}
      </div>
    </>
  );
}
