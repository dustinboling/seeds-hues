"use client";

/**
 * The /variety browse block, interactive part (Tranche 3.1a): filter chips with per-option
 * counts, the applied row with removers + Clear all, the result-count line, the results grid
 * (or zero-results state), and pagination. Rendered by the server page with the initial
 * browse payload; after hydration every filter change applies IN PLACE — local state, one
 * JSON fetch, no document reload, no Next router navigation, no scroll, no page-view beacon —
 * and keeps the URL shareable through the History API.
 *
 * Shape of the contract (SPEC tranche-3 §2, PB-2 multi-select Hue):
 *
 * - First paint is server-rendered and server-correct for every filter URL: links with
 *   `aria-current`, counts, the applied row (working remover/Clear-all links), the count line
 *   and the page's results are byte-correct from the server, so filtering works with JS
 *   disabled or before hydration (progressive enhancement).
 * - Filter state is local state initialised from the server-rendered value. There is
 *   deliberately NO mount reconciliation and NO setState in any effect body. URL → state
 *   re-sync happens only inside the `popstate` event callback (the sanctioned pattern).
 * - The links→buttons semantics upgrade after hydration (toggle buttons with `aria-pressed`,
 *   never `aria-current`, in a group labelled "Filters") rides on `useSyncExternalStore`: the
 *   server snapshot replays during hydration (identical HTML, no mismatch) and the client
 *   snapshot swaps the control afterwards. Chips keep stable keys, so state changes update
 *   pressed state and counts without remounting any chip — scroll never moves and focus stays
 *   on the tapped control.
 * - Each deliberate selection commits exactly one history entry (on the fetch's success — the
 *   URL always reflects committed state); tapping the active option is a no-op; Back/Forward
 *   re-sync in place. A filter change always resets to page 1. Rapid taps settle on the last
 *   selection (stale responses are discarded); pagination stays true navigation.
 * - Failure path (§2.5.6): the prior results, counts and URL stand, the control reverts to the
 *   committed state, and one `role="alert"` error line renders with the applied row.
 * - The count line is a persistent live region — its text updates, it never remounts — and it
 *   changes exactly once per committed change, in step with the visible rows. It announces no
 *   loading or intermediate states.
 * - Actions that unmount their own control (the applied row's removers and Clear all, the
 *   zero-results "Clear filters") hand focus to a control that survives the commit: the
 *   row's Clear all when the row persists, else the first group's "All" chip.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { BrowseFilters, ChipCount, SwatchDot } from "@/components/ui/BrowseFilters";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { Pagination } from "@/components/ui/Pagination";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { ChipRemoveIcon } from "@/components/layout/icons";
import {
  BROWSE_OPTIONS,
  browseCountLine,
  browseFiltersFromSearch,
  browseHref,
  browsePageFromSearch,
  clearAllFilters,
  clearGroup,
  equalBrowseFilters,
  filterParams,
  hasActiveFilters,
  isOptionActive,
  removersFor,
  toggleHue,
  withGroup,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type BrowseRemover,
  type ColorFamily,
} from "@/lib/browse";
import { totalPages } from "@/lib/paging";
import { EMPTY_BROWSE, SMALL_FARM_EMPTY_BROWSE } from "@/lib/small-farm";
import type { BrowseCounts, BrowseVarietiesPayload, VarietyListItem } from "@/lib/validators";

const BASE_PATH = "/variety";
const API_PATH = "/api/browse/varieties";
const GROUPS: BrowseFilterGroup[] = ["season", "method", "lifeCycle", "hue", "smallFarm"];

/** The server-rendered browse snapshot this block hydrates from. */
export interface VarietyBrowseInitial {
  state: BrowseFilterState;
  counts: BrowseCounts;
  items: VarietyListItem[];
  total: number;
  page: number;
}

function subscribeHydrated(): () => void {
  return () => {};
}

function snapshotHydrated(): boolean {
  return true;
}

function snapshotServer(): boolean {
  return false;
}

/**
 * True once the component has hydrated. `useSyncExternalStore` replays the server snapshot
 * (`false`) during the hydration pass — SSR and hydration render identical links — then flips
 * to the client snapshot (`true`) with no setState-in-effect.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydrated, snapshotHydrated, snapshotServer);
}

/** Strict narrowing for the fetched payload: malformed means the failure path, never broken cards. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCounts(value: unknown): value is BrowseCounts {
  if (!isRecord(value)) return false;
  for (const g of ["season", "method", "lifeCycle", "hue", "smallFarm"]) {
    const c = value[g];
    if (!isRecord(c) || typeof c.all !== "number") return false;
    const opts = g === "smallFarm" ? (isRecord(c) && typeof c.on === "number" ? { on: c.on } : null) : c.options;
    if (!isRecord(opts)) return false;
    for (const n of Object.values(opts)) if (typeof n !== "number") return false;
  }
  return true;
}

function isListItem(value: unknown): value is VarietyListItem {
  if (!isRecord(value)) return false;
  if (typeof value.slug !== "string" || typeof value.varietyName !== "string") return false;
  if (typeof value.sellerCount !== "number" || !Array.isArray(value.media)) return false;
  const plant = value.plant;
  return isRecord(plant) && typeof plant.slug === "string" && typeof plant.commonName === "string";
}

function isBrowsePayload(value: unknown): value is BrowseVarietiesPayload {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.items) &&
    value.items.every(isListItem) &&
    typeof value.total === "number" &&
    typeof value.page === "number" &&
    typeof value.pages === "number" &&
    isCounts(value.counts)
  );
}

/** The state a chip tap moves to: hue toggles (All clears), every other group assigns. */
function optionState(shown: BrowseFilterState, g: BrowseFilterGroup, value: string | null): BrowseFilterState {
  if (g === "hue") return value === null ? clearGroup(shown, "hue") : toggleHue(shown, value as ColorFamily);
  return withGroup(shown, g, value);
}

/** Where an unmounting action hands focus: the row's Clear all if the row survives, else the first All. */
type FocusTarget = "first-all" | "clear-all";

function AppliedRow({
  shown,
  hydrated,
  failed,
  onAction,
  clearAllRef,
}: {
  shown: BrowseFilterState;
  hydrated: boolean;
  failed: boolean;
  onAction: (compute: (current: BrowseFilterState) => BrowseFilterState, focus: FocusTarget) => void;
  clearAllRef: RefObject<HTMLButtonElement | null>;
}) {
  const removers: BrowseRemover[] = removersFor(shown);
  // Absent when nothing is active — unless the failure line needs its slot.
  if (removers.length === 0 && !failed) return null;
  const removerControl = (r: BrowseRemover) =>
    hydrated ? (
      <button
        type="button"
        className="chip-filter chip-removable"
        aria-label={`Remove ${r.label}`}
        data-filter-remove={r.key}
        onClick={() => onAction(r.clear, hasActiveFilters(r.clear(shown)) ? "clear-all" : "first-all")}
      >
        {r.label}
        <ChipRemoveIcon className="size-(--chip-removable-glyph-size)" />
      </button>
    ) : (
      <Link
        href={browseHref(BASE_PATH, r.clear(shown))}
        scroll={false}
        className="chip-filter chip-removable"
        aria-label={`Remove ${r.label}`}
        data-filter-remove={r.key}
      >
        {r.label}
        <ChipRemoveIcon className="size-(--chip-removable-glyph-size)" />
      </Link>
    );
  return (
    <div role="group" aria-label="Applied filters" className="mt-3 flex flex-wrap items-center gap-2" data-testid="applied-filters">
      {removers.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2">
          {removers.map((r) => (
            <li key={r.key}>{removerControl(r)}</li>
          ))}
        </ul>
      ) : null}
      {removers.length > 0 ? (
        hydrated ? (
          <button ref={clearAllRef} type="button" className="chip-filter" onClick={() => onAction(() => clearAllFilters(), "first-all")}>
            Clear all
          </button>
        ) : (
          <Link href={BASE_PATH} scroll={false} className="chip-filter">
            Clear all
          </Link>
        )
      ) : null}
      {failed ? <p role="alert" className="font-medium text-warn">Couldn&apos;t update the list — the last results are still shown.</p> : null}
    </div>
  );
}

export function VarietyBrowse({ initial }: { initial: VarietyBrowseInitial }) {
  const hydrated = useHydrated();
  // Last server-confirmed snapshot: results, counts and URL all reflect this. First paint is
  // already server-correct, so there is deliberately no mount reconciliation here.
  const [committed, setCommitted] = useState<VarietyBrowseInitial>(initial);
  // Optimistic filter state awaiting its fetch (null when settled). Chips and the applied row
  // follow this; results, counts, pagination and the count line follow `committed` only.
  const [pending, setPending] = useState<BrowseFilterState | null>(null);
  const [failed, setFailed] = useState(false);
  // Last-selection-wins: every fetch takes an id; only the latest id may settle.
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Latest intent (mirrors pending, or committed when settled). A ref — not the pending
  // state — so two taps inside one frame still base the second on the first.
  const intentRef = useRef<BrowseFilterState>(initial.state);
  const committedRef = useRef<VarietyBrowseInitial>(initial);
  const focusRef = useRef<FocusTarget | null>(null);
  const firstAllRef = useRef<HTMLButtonElement | null>(null);
  const clearAllRef = useRef<HTMLButtonElement | null>(null);

  // The one fetch path (taps and popstate share it): last id wins; stale responses — success
  // or failure — are discarded. Pushes exactly one history entry per committed tap; popstate
  // commits without pushing (the entry already exists).
  const fetchCommitted = useCallback(async (next: BrowseFilterState, push: boolean): Promise<void> => {
    const id = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams(filterParams(next));
    const qs = params.toString();
    try {
      const res = await fetch(qs ? `${API_PATH}?${qs}` : API_PATH, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`browse fetch answered ${res.status}`);
      const json: unknown = await res.json();
      if (!isBrowsePayload(json)) throw new Error("browse payload failed its shape check");
      if (id !== requestRef.current) return;
      const snapshot: VarietyBrowseInitial = {
        state: next,
        counts: json.counts,
        items: json.items,
        total: json.total,
        page: 1,
      };
      committedRef.current = snapshot;
      setCommitted(snapshot);
      setPending(null);
      if (push) window.history.pushState({ browse: filterParams(next) }, "", browseHref(BASE_PATH, next));
    } catch {
      if (controller.signal.aborted || id !== requestRef.current) return;
      // Failure path (§2.5.6): the prior results, counts and URL stand untouched; the control
      // reverts to the committed state; one error line renders with the applied row.
      intentRef.current = committedRef.current.state;
      focusRef.current = null;
      setPending(null);
      setFailed(true);
    }
  }, []);

  // Back/Forward move between filter states in place: re-sync from the live URL. setState
  // inside this event callback is the sanctioned pattern; the effect body itself only
  // subscribes. No entry is pushed here — the entry already exists. A popped page that is not
  // the rendered one (a pagination boundary was crossed) is a true navigation to the server
  // state instead — the enhancement owns filter states, never pages.
  useEffect(() => {
    const onPopState = (): void => {
      const search = window.location.search;
      const here = `${window.location.pathname}${search}`;
      if (window.location.pathname !== BASE_PATH || browsePageFromSearch(search) !== committedRef.current.page) {
        // A pop across a pagination boundary (or off this surface) leaves the enhancement's
        // owned state: follow it with a true navigation. router.push would stack a new entry
        // instead of following the pop, so the History API escape hatch is the correct tool.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(here);
        return;
      }
      const state = browseFiltersFromSearch(search, "multi");
      intentRef.current = state;
      if (equalBrowseFilters(state, committedRef.current.state)) {
        setPending(null);
        setFailed(false);
        return;
      }
      setPending(state);
      setFailed(false);
      void fetchCommitted(state, false);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [fetchCommitted]);

  // Focus handoff for the actions that unmount their own control. When their commit lands, the
  // surviving target takes focus. Plain DOM focus — no setState. Chip toggles never set the
  // request, so focus stays on the tapped control.
  useEffect(() => {
    if (focusRef.current === null) return;
    const target = focusRef.current === "clear-all" ? clearAllRef.current : firstAllRef.current;
    focusRef.current = null;
    target?.focus();
  }, [committed]);

  // One deliberate selection: optimistic control state, then the fetch; the entry and the
  // results swap land together on success. Tapping the already-active option is a no-op: no
  // entry, no fetch, no change. The transition computes from the latest intent (not the
  // render's state), so rapid taps compose instead of clobbering each other.
  const select = (compute: (current: BrowseFilterState) => BrowseFilterState, focus: FocusTarget | null = null): void => {
    const next = compute(intentRef.current);
    if (equalBrowseFilters(next, intentRef.current)) return;
    intentRef.current = next;
    focusRef.current = focus;
    setPending(next);
    setFailed(false);
    void fetchCommitted(next, true);
  };

  const shown = pending ?? committed.state;
  const pages = totalPages(committed.total);

  return (
    <>
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      <p id="variety-results-count" className="mt-2 text-muted" aria-live="polite" aria-atomic="true">
        {browseCountLine(committed.state, committed.total, committed.page, pages)}
      </p>
      {hydrated ? (
        <div role="group" aria-label="Filters" className="mt-4 flex flex-col gap-3">
          {GROUPS.map((g) => (
            <fieldset key={g} className="min-w-0">
              <legend className="eyebrow mb-1">{BROWSE_OPTIONS[g].legend}</legend>
              <FilterStrip legend={BROWSE_OPTIONS[g].legend}>
                {BROWSE_OPTIONS[g].options.map((o) => (
                  <li key={o.value ?? "all"} className="flex-none">
                    <button
                      ref={g === "season" && o.value === null ? firstAllRef : undefined}
                      type="button"
                      className="chip-filter"
                      aria-pressed={isOptionActive(shown, g, o.value, "multi")}
                      data-filter={g}
                      onClick={() => select((s) => optionState(s, g, o.value))}
                    >
                      {o.hue ? <SwatchDot family={o.hue} /> : null}
                      {o.label} <ChipCount counts={committed.counts} group={g} value={o.value} />
                    </button>
                  </li>
                ))}
              </FilterStrip>
              {/* The page's one legend line (ux-spec §5.1): directly under the Sellers strip. */}
              {g === "smallFarm" ? <SmallFarmLegend className="mt-1" /> : null}
            </fieldset>
          ))}
        </div>
      ) : (
        <BrowseFilters basePath={BASE_PATH} state={committed.state} groups={GROUPS} hueMode="multi" counts={committed.counts} />
      )}
      <AppliedRow
        shown={shown}
        hydrated={hydrated}
        failed={failed}
        onAction={(compute, focus) => select(compute, focus)}
        clearAllRef={clearAllRef}
      />
      <div id="variety-results" className="mt-6">
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
