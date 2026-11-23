"use client";

/**
 * The /search results block, interactive part (Tranche 3.1b): the results heading (the
 * page's persistent live region), filter chips with per-option counts, the applied row
 * with removers + Clear all (Clear All keeps q), and the grouped results (or the
 * zero-results state with its did-you-mean suggestion, when one qualifies). Rendered by the
 * server page with the initial browse snapshot; after
 * hydration every filter change applies IN PLACE through the shared `useInPlaceBrowse`
 * hook — local state, one JSON fetch, no document reload, no Next router navigation, no
 * scroll, no page-view beacon — keeping the URL shareable through the History API. The
 * query itself never changes in place (a new query is a navigation): the snapshot items
 * are the flattened groups, re-grouped here for rendering. This file owns only /search's
 * rendering; the commit discipline is shared with every surface.
 */

import Link from "next/link";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { InPlaceAppliedRow, InPlaceFilters, browseInPlaceConfig, useInPlaceBrowse } from "@/components/ui/InPlaceBrowse";
import { activeFilterLabels, type BrowseFilterGroup, type BrowseFilterState } from "@/lib/browse";
import { isBrowseCountsPayload, isRecord, type InPlacePayloadCore, type InPlaceSnapshot } from "@/lib/in-place";
import type { SearchResult } from "@/lib/validators";

const BASE_PATH = "/search";
const API_PATH = "/api/browse/search";
const GROUPS: BrowseFilterGroup[] = ["season", "method", "lifeCycle", "hue"];
/** The 3.1b failure line (brief §2.5.6 contract — the wording stands for every new surface). */
const FAILURE_MESSAGE = "That filter didn't apply — you're still seeing the previous results. Try again.";

// The match keys are the singular SearchResult types (lib/validators SEARCH_TYPES): the
// re-group below compares x.type === key, so plural keys silently drop every group but
// series. Labels keep the shipped plural wording; order is the shipped grouped layout.
const GROUP_DEFS = [
  ["crop", "Crops"],
  ["series", "Series"],
  ["variety", "Varieties"],
  ["seller", "Sellers"],
] as const;

/** The server-rendered browse snapshot this block hydrates from (items are the flattened groups). */
export type SearchBrowseInitial = InPlaceSnapshot<BrowseFilterState, SearchResult>;

function isSearchResult(value: unknown): value is SearchResult {
  if (!isRecord(value)) return false;
  const t = value.type;
  if (t !== "variety" && t !== "series" && t !== "crop" && t !== "seller") return false;
  if (typeof value.slug !== "string" || typeof value.title !== "string") return false;
  if (typeof value.subtitle !== "string" || typeof value.href !== "string") return false;
  const alias = value.matchedAlias;
  return alias === null || typeof alias === "string";
}

/** Strict narrowing for the grouped search payload: the four groups flatten to the commit items. */
function readPayload(json: unknown): InPlacePayloadCore<SearchResult> | null {
  if (!isRecord(json)) return null;
  const groups: SearchResult[][] = [];
  for (const key of ["crops", "series", "varieties", "sellers"]) {
    const list: unknown = json[key];
    if (!Array.isArray(list) || !list.every(isSearchResult)) return null;
    groups.push(list);
  }
  if (typeof json.total !== "number" || !Number.isInteger(json.total) || json.total < 0) return null;
  if (typeof json.page !== "number" || !Number.isInteger(json.page) || json.page < 1) return null;
  if (typeof json.pages !== "number" || !Number.isInteger(json.pages) || json.pages < 1) return null;
  if (!isBrowseCountsPayload(json.counts)) return null;
  return { items: groups.flat(), total: json.total, counts: json.counts };
}

export function SearchBrowse({
  initial,
  q,
  suggestion,
}: {
  initial: SearchBrowseInitial;
  q: string;
  /** Did-you-mean (§5.3.4): the zero-results state's single near-match, or null. */
  suggestion: { name: string; href: string } | null;
}) {
  const config = browseInPlaceConfig<SearchResult>({
    basePath: BASE_PATH,
    apiPath: API_PATH,
    groups: GROUPS,
    hueMode: "single",
    unit: "results",
    params: { q },
    failureMessage: FAILURE_MESSAGE,
    readPayload,
    // A popped URL carrying a different query is not this layer's (true navigation) —
    // the query itself never changes in place.
    isForeignSearch: (search) => new URLSearchParams(search).get("q")?.trim().slice(0, 100) !== q,
  });
  const browse = useInPlaceBrowse(initial, config);
  const { committed, pending, pendingCue } = browse;
  const active = activeFilterLabels(committed.state);
  const title =
    committed.total > 0
      ? [`${committed.total} result${committed.total === 1 ? "" : "s"} for “${q}”`, ...active].join(" · ")
      : active.length
        ? `No results for “${q}” · ${active.join(" · ")}`
        : "Not in the catalog yet";
  const groups = GROUP_DEFS.map(([key, label]) => ({
    key,
    label,
    items: committed.items.filter((x) => x.type === key),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <h2 id="results-title" className="text-xl font-semibold" aria-live="polite" aria-atomic="true">
        {title}
      </h2>
      <InPlaceFilters config={config} browse={browse} />
      <InPlaceAppliedRow config={config} browse={browse} />
      {/* D-B1-2: past ~1s in flight the region dims (an owned opacity utility). */}
      <div className={pendingCue ? "opacity-50" : undefined} aria-busy={pending === null ? undefined : true}>
        {committed.total === 0 ? (
          <>
            <ThemeArt name="empty-search" className="art-frame mx-auto mt-4 h-[220px] w-auto" />
            <p className="mt-2 text-muted" data-testid="zero-results">
              Nothing matches “{q}”. Check the spelling or try fewer words — or{" "}
              <Link href="/report?type=correct">tell us about a variety or seller we’re missing</Link>.
            </p>
            {suggestion ? (
              <p className="mt-2 text-muted" data-testid="did-you-mean">
                Did you mean{" "}
                <Link href={suggestion.href}>
                  <strong>{suggestion.name}</strong>
                </Link>
                ?
              </p>
            ) : null}
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
      </div>
    </>
  );
}
