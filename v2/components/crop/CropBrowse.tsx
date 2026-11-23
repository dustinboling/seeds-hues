"use client";

/**
 * The /crop index browse block, interactive part (Tranche 3.1b): the count line (a persistent
 * live region), filter chips with per-option counts, the applied row with removers + Clear
 * all, and the crop cards (or the filtered-empty state). Rendered by the server page with
 * the initial browse snapshot; after hydration every filter change applies IN PLACE through
 * the shared `useInPlaceBrowse` hook — local state, one JSON fetch, no document reload, no
 * Next router navigation, no scroll, no page-view beacon — keeping the URL shareable
 * through the History API. This file owns only the index's rendering; the commit discipline
 * is shared with every surface.
 */

import Link from "next/link";
import { CropCardImage } from "@/components/crop/CropCardImage";
import { InPlaceAppliedRow, InPlaceFilters, browseInPlaceConfig, useInPlaceBrowse } from "@/components/ui/InPlaceBrowse";
import { browseHref, clearAllFilters, cropIndexCountLine, hasActiveFilters, type BrowseFilterGroup, type BrowseFilterState } from "@/lib/browse";
import { plural } from "@/lib/format";
import { browsePayloadCore, isRecord, type InPlaceSnapshot } from "@/lib/in-place";
import { proseCommonName } from "@/lib/services/template";
import { EMPTY_CROP_BROWSE } from "@/lib/small-farm";
import type { CropListItem } from "@/lib/validators";

const BASE_PATH = "/crop";
const API_PATH = "/api/browse/crops";
const GROUPS: BrowseFilterGroup[] = ["season", "method"];
/** The 3.1b failure line (brief §2.5.6 contract — the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

/** The server-rendered browse snapshot this block hydrates from. */
export type CropBrowseInitial = InPlaceSnapshot<BrowseFilterState, CropListItem>;

function isCropListItem(value: unknown): value is CropListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.commonName !== "string") return false;
  if (typeof value.varietyCount !== "number" || !Array.isArray(value.media)) return false;
  return true;
}

function readPayload(json: unknown): ReturnType<typeof browsePayloadCore<CropListItem>> {
  return browsePayloadCore(json, isCropListItem);
}

export function CropBrowse({ initial }: { initial: CropBrowseInitial }) {
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
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="crop-index-count" className="mt-2 text-muted" aria-live="polite" aria-atomic="true">
        {cropIndexCountLine(committed.state, committed.total)}
      </p>
      <InPlaceFilters config={config} browse={browse} />
      <InPlaceAppliedRow config={config} browse={browse} />
      <div id="crop-results" className="mt-6" aria-busy={pending === null ? undefined : true}>
        {committed.total > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {committed.items.map((c) => (
              <li key={c.slug} className="card card-hover relative p-4 focus-within:ring-2 focus-within:ring-focus">
                <CropCardImage media={c.media} commonName={c.commonName} />
                <h2 className="text-lg font-semibold">
                  <Link href={`/crop/${c.slug}`} className="text-ink no-underline after:absolute after:inset-0 hover:underline">
                    {proseCommonName(c.commonName)}
                  </Link>
                </h2>
                {c.latinName ? (
                  <p className="text-sm text-muted">
                    <i>{c.latinName}</i>
                  </p>
                ) : null}
                <p className="text-sm text-muted">{plural(c.varietyCount, "variety", "varieties")}</p>
              </li>
            ))}
          </ul>
        ) : (
          // Filtered-empty state (ux-spec §3.5, B-12) — announced first by the count line's
          // zero above; the applied row stays visible above for recovery.
          <p className="text-muted" data-testid="crop-empty">
            {EMPTY_CROP_BROWSE}
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
    </>
  );
}
