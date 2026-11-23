"use client";

/**
 * Shared in-place browse machinery (Tranche 3.1b): the 3.1a /variety layer, generalized.
 * Every filter surface (/variety, home, /crop, /search — and part 2's crop detail + seller
 * State cloud) commits filter changes through `useInPlaceBrowse` with a surface config, so
 * the discipline is one implementation, not a per-surface copy: local state initialised
 * from the server snapshot, one JSON fetch per deliberate change, last-selection-wins,
 * exactly one history entry per committed tap, in-place Back/Forward, page reset to 1,
 * soft-navigation snapshot adoption (N-D1), the §2.5.6 failure path (prior stands, control
 * reverts, one `role="alert"` line), and focus hand-off for actions that unmount their own
 * control. Pagination stays true navigation; no page-view beacon fires on a local change.
 *
 * Shape of the contract (SPEC tranche-3 §2, PB-2 multi-select Hue):
 *
 * - First paint is server-rendered and server-correct for every filter URL: links with
 *   `aria-current`, counts, the applied row (working remover/Clear-all links), the count
 *   line and the page's results are byte-correct from the server, so filtering works with
 *   JS disabled or before hydration (progressive enhancement).
 * - Filter state is local state initialised from the server-rendered value. There is
 *   deliberately NO mount reconciliation and NO setState in any effect body. URL → state
 *   re-sync happens only inside the `popstate` event callback (the sanctioned pattern) and
 *   in the soft-navigation adoption (render-time state plus a ref-sync layout effect — the
 *   effect itself sets no state).
 * - The links→buttons semantics upgrade after hydration (toggle buttons with `aria-pressed`,
 *   never `aria-current`) rides on `useSyncExternalStore`: the server snapshot replays
 *   during hydration (identical HTML, no mismatch) and the client snapshot swaps the
 *   control afterwards. Chips keep stable keys, so state changes update pressed state and
 *   counts without remounting any chip — scroll never moves and focus stays on the tapped
 *   control.
 * - Each deliberate selection commits exactly one history entry (on the fetch's success —
 *   the URL always reflects committed state); tapping the active option is a no-op;
 *   Back/Forward re-sync in place. A filter change always resets to page 1. Rapid taps
 *   settle on the last selection (stale responses are discarded). Pagination navigates
 *   through the Next router (soft navigation): the server page re-renders for the target
 *   ?page= and the new snapshot it delivers is adopted wholesale — results, counts, page
 *   and filters — so the rendered page always matches the URL (N-D1).
 * - Failure path (§2.5.6): the prior results, counts and URL stand, the control reverts to
 *   the committed state, and one `role="alert"` error line renders with the applied row.
 * - Each surface's count line is a persistent live region — its text updates, it never
 *   remounts — and it changes exactly once per committed change, in step with the visible
 *   rows. It announces no loading or intermediate states.
 * - Actions that unmount their own control (the applied row's removers and Clear all, the
 *   zero-results "Clear filters") hand focus to a control that survives the commit: the
 *   row's Clear all when the row persists, else the first group's "All" chip.
 *
 * The hook is generic over the filter-state type S (BrowseFilterState on the 3.1b
 * surfaces; part 2's surfaces bring their own state plus their own presentational bits),
 * the result-item type P, and the counts type C (BrowseCounts on the 3.1b surfaces; part
 * 2's surfaces bring their own — defaults keep every existing consumer identical).
 * `browseInPlaceConfig` builds the config for the BrowseFilterState surfaces;
 * `InPlaceFilters` is their shared filter block; `InPlaceAppliedRow` is shared by every
 * surface (its `showClearAll` prop carries the §2.6.2 single-group exception). The snapshot
 * shape itself lives in lib/in-place.ts — the one access convention (`snapshot.total`,
 * `snapshot.items`, `snapshot.counts`, direct).
 */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { BrowseFilters, ChipCount, SwatchDot } from "@/components/ui/BrowseFilters";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { ChipRemoveIcon } from "@/components/layout/icons";
import {
  BROWSE_OPTIONS,
  browseHref,
  browsePageFromSearch,
  clearAllFilters,
  countStateFor,
  equalBrowseFilters,
  filterParams,
  hasActiveFilters,
  isOptionActive,
  removersFor,
  scopedBrowseFiltersFromSearch,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type HueMode,
} from "@/lib/browse";
import type { InPlacePayloadCore, InPlaceSnapshot } from "@/lib/in-place";
import type { BrowseCounts } from "@/lib/validators";

/** Where an unmounting action hands focus: the row's Clear all if the row survives, else the first All. */
export type InPlaceFocusTarget = "first-all" | "clear-all";

/** One applied-row remover: stable key, visible label, accessible name, clearing transition. */
export interface InPlaceRemover<S> {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: S) => S;
}

/**
 * The surface-generic in-place contract: everything the hook needs that varies per surface.
 * State transitions, equality, URL encoding and payload narrowing are callbacks, so a
 * surface with its own state type (part 2) drives the identical discipline unmodified.
 * Generic over the counts type C (BrowseCounts on the 3.1b surfaces; part 2's surfaces
 * bring their own — the default keeps every existing consumer's shape identical).
 * Surface-generic: no surface's vocabulary appears here.
 */
export interface InPlaceConfig<S, P, C = BrowseCounts> {
  /** Route path of the surface (history entries + popstate ownership). */
  basePath: string;
  /** Payload endpoint path (fetch). */
  apiPath: string;
  /** Extra params carried on history entries and fetch queries (q on /search). */
  params: Record<string, string>;
  /** The failure line's wording (each surface's shipped copy). */
  failureMessage: string;
  /** Strict payload narrowing: the commit core, or null for the failure path. */
  readPayload: (json: unknown) => InPlacePayloadCore<P, C> | null;
  /** URL → filter state, or null when the URL is not this layer's (true navigation). */
  readSearch: (search: string) => S | null;
  /** ?page= from a live search string (missing/garbage → 1). */
  pageOfSearch: (search: string) => number;
  /** Structural state equality. */
  equalStates: (a: S, b: S) => boolean;
  /** True when at least one group narrows the list. */
  hasActive: (state: S) => boolean;
  /** Clear All's target from a state: every group to All, the state's sort surviving. */
  clearAll: (state: S) => S;
  /** The applied row's removers for a state, in group order. */
  removersFor: (state: S) => InPlaceRemover<S>[];
  /** Shareable URL for a state (page dropped, extras kept). */
  hrefFor: (state: S) => string;
  /** Fetch URL for a state. */
  apiUrlFor: (state: S) => string;
  /** History state value pushed per commit. */
  historyValueFor: (state: S) => unknown;
}

/** The browse-surface config: the generic contract plus the chips' groups, hue mode and count unit. */
export interface BrowseInPlaceConfig<P> extends InPlaceConfig<BrowseFilterState, P, BrowseCounts> {
  groups: BrowseFilterGroup[];
  hueMode: HueMode;
  /** Count-unit word for the sr-only count ("varieties", "crops", "results"). */
  unit: string;
  /** The state a chip tap moves to (All clears; single assigns; multi hue toggles). */
  optionState: (shown: BrowseFilterState, group: BrowseFilterGroup, value: string | null) => BrowseFilterState;
}

/**
 * The browse-surface config factory: one call per surface, wiring the generic contract to
 * the lib/browse vocabulary. `isForeignSearch` extends popstate ownership past the filter
 * state (a popped URL whose carried params differ — q on /search — is a true navigation).
 * `withSort` is the sorted surface's (/variety): its popstate re-sync parses ?sort= like
 * its first load does, so Back/Forward across sort changes re-sync in place.
 */
export function browseInPlaceConfig<P>(opts: {
  basePath: string;
  apiPath: string;
  groups: BrowseFilterGroup[];
  hueMode: HueMode;
  unit: string;
  params?: Record<string, string>;
  failureMessage: string;
  readPayload: (json: unknown) => InPlacePayloadCore<P> | null;
  isForeignSearch?: (search: string) => boolean;
  withSort?: boolean;
}): BrowseInPlaceConfig<P> {
  const params = opts.params ?? {};
  return {
    basePath: opts.basePath,
    apiPath: opts.apiPath,
    params,
    groups: opts.groups,
    hueMode: opts.hueMode,
    unit: opts.unit,
    failureMessage: opts.failureMessage,
    readPayload: opts.readPayload,
    readSearch: (search) =>
      opts.isForeignSearch?.(search)
        ? null
        : scopedBrowseFiltersFromSearch(search, opts.groups, opts.hueMode, opts.withSort ?? false),
    pageOfSearch: browsePageFromSearch,
    equalStates: equalBrowseFilters,
    hasActive: hasActiveFilters,
    clearAll: clearAllFilters,
    optionState: (shown, group, value) => countStateFor(shown, group, value, opts.hueMode),
    removersFor,
    hrefFor: (state) => browseHref(opts.basePath, state, params),
    apiUrlFor: (state) => {
      const qs = new URLSearchParams({ ...params, ...filterParams(state) }).toString();
      return qs ? `${opts.apiPath}?${qs}` : opts.apiPath;
    },
    historyValueFor: (state) => ({ browse: filterParams(state) }),
  };
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

/**
 * Layout effect on the client, passive on the server — the SSR-safe shape for the effects
 * below that must run synchronously at commit (React warns for a bare useLayoutEffect during
 * server rendering).
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** What the hook hands its surface: committed + optimistic state, the commit action, focus refs. */
export interface InPlaceBrowse<S, P, C = BrowseCounts> {
  hydrated: boolean;
  committed: InPlaceSnapshot<S, P, C>;
  pending: S | null;
  /** The state the controls show: optimistic while a change is in flight, else committed. */
  shown: S;
  failed: boolean;
  select: (compute: (current: S) => S, focus?: InPlaceFocusTarget | null) => void;
  firstAllRef: RefObject<HTMLButtonElement | null>;
  clearAllRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The in-place commit discipline, surface-generic. The comments below are the 3.1a
 * rationale, unchanged — generalizing the layer moved the code, not the reasoning.
 */
export function useInPlaceBrowse<S, P, C = BrowseCounts>(
  initial: InPlaceSnapshot<S, P, C>,
  config: InPlaceConfig<S, P, C>,
): InPlaceBrowse<S, P, C> {
  const hydrated = useHydrated();
  // Last server-confirmed snapshot: results, counts and URL all reflect this. First paint is
  // already server-correct, so there is deliberately no mount reconciliation here.
  const [committed, setCommitted] = useState<InPlaceSnapshot<S, P, C>>(initial);
  // Optimistic filter state awaiting its fetch (null when settled). Chips and the applied row
  // follow this; results, counts, pagination and the count line follow `committed` only.
  const [pending, setPending] = useState<S | null>(null);
  const [failed, setFailed] = useState(false);
  // Last-selection-wins: every fetch takes an id; only the latest id may settle.
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Latest intent (mirrors pending, or committed when settled). A ref — not the pending
  // state — so two taps inside one frame still base the second on the first.
  const intentRef = useRef<S>(initial.state);
  const committedRef = useRef<InPlaceSnapshot<S, P, C>>(initial);
  const focusRef = useRef<InPlaceFocusTarget | null>(null);
  const firstAllRef = useRef<HTMLButtonElement | null>(null);
  const clearAllRef = useRef<HTMLButtonElement | null>(null);
  // Effect-maintained config mirror: handler identities stay stable (no ref access during
  // render) while the fetch and popstate paths always read the latest surface config.
  const configRef = useRef(config);
  useIsomorphicLayoutEffect(() => {
    configRef.current = config;
  });

  // Soft-navigation adoption (N-D1): turning a page re-renders the server page, which delivers
  // a NEW `initial` — the target page's items, counts, total and page — to this still-mounted
  // component. React preserves client state across that navigation, so the delivered snapshot
  // is adopted wholesale: it is by definition committed (its URL is already in the bar), which
  // clears pending/failed. In-place filter commits never re-render the server tree (History
  // API only), so `initial` keeps its identity through them and this never fires for them.
  // Render-time derived state (React's sanctioned previous-render pattern): state only — the
  // mirrors re-base in the layout effect below, and every effect body stays setState-free.
  const [lastInitial, setLastInitial] = useState<InPlaceSnapshot<S, P, C>>(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setCommitted(initial);
    setPending(null);
    setFailed(false);
  }

  // Adoption follow-through: the mirrors re-base on the adopted snapshot (page AND filters)
  // and any in-flight filter fetch is invalidated — a navigation is the latest intent, and a
  // stale filter response must not clobber the adopted page. Layout timing, so the sync lands
  // in the same commit: a fetch settling between a passive effect and its commit could
  // otherwise commit stale first. The identity check makes this a no-op for fetch commits —
  // fetchCommitted syncs its own mirror synchronously — so only adoptions take this path.
  // Declared before the focus handoff so a killed request can never fire for the adopted page.
  useIsomorphicLayoutEffect(() => {
    if (committedRef.current !== committed) {
      committedRef.current = committed;
      intentRef.current = committed.state;
      focusRef.current = null;
      requestRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [committed]);

  // The one fetch path (taps and popstate share it): last id wins; stale responses — success
  // or failure — are discarded. Pushes exactly one history entry per committed tap; popstate
  // commits without pushing (the entry already exists).
  const fetchCommitted = useCallback(async (next: S, push: boolean): Promise<void> => {
    const id = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(configRef.current.apiUrlFor(next), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`browse fetch answered ${res.status}`);
      const json: unknown = await res.json();
      const core = configRef.current.readPayload(json);
      if (!core) throw new Error("browse payload failed its shape check");
      if (id !== requestRef.current) return;
      const snapshot: InPlaceSnapshot<S, P, C> = {
        state: next,
        counts: core.counts,
        items: core.items,
        total: core.total,
        page: 1,
      };
      committedRef.current = snapshot;
      setCommitted(snapshot);
      setPending(null);
      if (push) window.history.pushState(configRef.current.historyValueFor(next), "", configRef.current.hrefFor(next));
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
  // subscribes. No entry is pushed here — the entry already exists. A popped URL the layer
  // does not own (another surface, a pagination boundary, a changed carried param) is a
  // true navigation to the server state instead — the enhancement owns filter states, never
  // pages or queries.
  useEffect(() => {
    const onPopState = (): void => {
      const cfg = configRef.current;
      const search = window.location.search;
      const here = `${window.location.pathname}${search}`;
      const state = window.location.pathname === cfg.basePath ? cfg.readSearch(search) : null;
      if (state === null || cfg.pageOfSearch(search) !== committedRef.current.page) {
        // A pop the enhancement does not own leaves its owned state: follow it with a true
        // navigation. router.push would stack a new entry instead of following the pop, so the
        // History API escape hatch is the correct tool.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(here);
        return;
      }
      intentRef.current = state;
      if (cfg.equalStates(state, committedRef.current.state)) {
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
  const select = (compute: (current: S) => S, focus: InPlaceFocusTarget | null = null): void => {
    const next = compute(intentRef.current);
    if (config.equalStates(next, intentRef.current)) return;
    intentRef.current = next;
    focusRef.current = focus;
    setPending(next);
    setFailed(false);
    void fetchCommitted(next, true);
  };

  return {
    hydrated,
    committed,
    pending,
    shown: pending ?? committed.state,
    failed,
    select,
    firstAllRef,
    clearAllRef,
  };
}

/**
 * The browse-surface filter block: server links with `aria-current` before hydration,
 * toggle buttons with `aria-pressed` after — stable keys, so state changes update pressed
 * state and counts without remounting any chip. The page's one Small farm legend line sits
 * directly under the Sellers strip, exactly where it always did.
 */
export function InPlaceFilters<P>({
  config,
  browse,
}: {
  config: BrowseInPlaceConfig<P>;
  browse: InPlaceBrowse<BrowseFilterState, P>;
}) {
  const { hydrated, committed, shown, select, firstAllRef } = browse;
  if (!hydrated) {
    return (
      <BrowseFilters
        basePath={config.basePath}
        state={committed.state}
        groups={config.groups}
        params={config.params}
        hueMode={config.hueMode}
        counts={committed.counts}
        unit={config.unit}
      />
    );
  }
  return (
    <div role="group" aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {config.groups.map((g) => (
        <fieldset key={g} className="min-w-0">
          <legend className="eyebrow mb-1">{BROWSE_OPTIONS[g].legend}</legend>
          <FilterStrip legend={BROWSE_OPTIONS[g].legend}>
            {BROWSE_OPTIONS[g].options.map((o) => (
              <li key={o.value ?? "all"} className="flex-none">
                <button
                  ref={g === config.groups[0] && o.value === null ? firstAllRef : undefined}
                  type="button"
                  className="chip-filter"
                  aria-pressed={isOptionActive(shown, g, o.value, config.hueMode)}
                  data-filter={g}
                  onClick={() => select((s) => config.optionState(s, g, o.value))}
                >
                  {o.hue ? <SwatchDot family={o.hue} /> : null}
                  {o.label} <ChipCount counts={committed.counts} group={g} value={o.value} unit={config.unit} />
                </button>
              </li>
            ))}
          </FilterStrip>
          {/* The page's one legend line (ux-spec §5.1): directly under the Sellers strip. */}
          {g === "smallFarm" ? <SmallFarmLegend className="mt-1" /> : null}
        </fieldset>
      ))}
    </div>
  );
}

/**
 * The applied row: one remover per active group (one per hue family under multi-select),
 * Clear all, and the failure line's slot. Absent when nothing is active — unless the
 * failure line needs its slot. Server floor: working links; hydrated: buttons.
 * `showClearAll` (default true) omits the Clear All control when false — the §2.6.2
 * bounded exception for single-group surfaces whose All chip remains the reset.
 * Surface-generic: a boolean prop, no surface branch.
 */
export function InPlaceAppliedRow<S, P, C = BrowseCounts>({
  config,
  browse,
  showClearAll = true,
}: {
  config: InPlaceConfig<S, P, C>;
  browse: InPlaceBrowse<S, P, C>;
  showClearAll?: boolean;
}) {
  const { shown, hydrated, failed, select, clearAllRef } = browse;
  const removers: InPlaceRemover<S>[] = config.removersFor(shown);
  // Absent when nothing is active — unless the failure line needs its slot.
  if (removers.length === 0 && !failed) return null;
  const removerControl = (r: InPlaceRemover<S>) =>
    hydrated ? (
      <button
        type="button"
        className="chip-filter chip-removable"
        aria-label={r.removeLabel}
        data-filter-remove={r.key}
        onClick={() => select(r.clear, config.hasActive(r.clear(shown)) ? "clear-all" : "first-all")}
      >
        {r.label}
        <ChipRemoveIcon className="size-(--chip-removable-glyph-size)" />
      </button>
    ) : (
      <Link
        href={config.hrefFor(r.clear(shown))}
        scroll={false}
        className="chip-filter chip-removable"
        aria-label={r.removeLabel}
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
      {removers.length > 0 && showClearAll ? (
        hydrated ? (
          <button ref={clearAllRef} type="button" className="chip-filter" onClick={() => select((s) => config.clearAll(s), "first-all")}>
            Clear all filters
          </button>
        ) : (
          <Link href={config.hrefFor(config.clearAll(shown))} scroll={false} className="chip-filter">
            Clear all filters
          </Link>
        )
      ) : null}
      {failed ? (
        <p role="alert" className="font-medium text-warn">
          {config.failureMessage}
        </p>
      ) : null}
    </div>
  );
}
