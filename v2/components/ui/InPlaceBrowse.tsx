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
 * - Every commit syncs document.title to the title the server renders for the committed
 *   state (B-1 item 3) — once, in step with the visible swap — on the surfaces whose
 *   title varies with state (/variety, /seller, crop detail). A commit still in flight
 *   ~200ms after the tap shows the pending cue until the swap (SPEC §2.5.3 as amended
 *   2026-11-23: perceptible by ~0.4s).
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

/**
 * Where an unmounting action hands focus: the row's Clear all if the row survives, else
 * the first All — or the shop heading ("heading") on surfaces whose landing is a heading
 * (seller-as-shop, Ada Ruling 7: the shop <h2>, never the first All).
 */
export type InPlaceFocusTarget = "first-all" | "clear-all" | "heading";

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
  /** Payload endpoint path (fetch). Unused when computeLocal is set. */
  apiPath?: string;
  /** Extra params carried on history entries and fetch queries (q on /search). */
  params: Record<string, string>;
  /** The failure line's wording (each surface's shipped copy). */
  failureMessage: string;
  /** The failure line's dress. Default keeps every existing surface identical. */
  failureClassName?: string;
  /** Clear All's label for a state. Default is the shipped "Clear all filters". */
  clearAllLabel?: (state: S) => string;
  /**
   * Where an unmounting action hands focus when the applied row is removed: the first
   * All by default; the shop heading on surfaces whose landing is a heading (Ada
   * Ruling 7). The row-survives landing stays Clear all everywhere.
   */
  emptyRowFocus?: InPlaceFocusTarget;
  /** Strict payload narrowing: the commit core, or null for the failure path. */
  readPayload: (json: unknown) => InPlacePayloadCore<P, C> | null;
  /**
   * Local commit computation (seller-as-shop's settled exception): when set, commits
   * compute the core from data in hand instead of fetching — the same discipline
   * (last-selection-wins, one history entry, popstate, adoption, failure path, focus,
   * title sync), no network. A throw or null takes the §2.5.6 failure path.
   */
  computeLocal?: (state: S) => InPlacePayloadCore<P, C> | null;
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
  /** Fetch URL for a state. Unused when computeLocal is set. */
  apiUrlFor?: (state: S) => string;
  /** History state value pushed per commit. */
  historyValueFor: (state: S) => unknown;
  /**
   * Full document.title for a committed (state, page) — the title the server renders for
   * that state (B-1 item 3). Set on every commit (filter, sort, Clear All, remover,
   * popstate restore, soft-navigation adoption), once, in step with the visible swap.
   * Absent when the surface's title is state-independent (home, /crop, /search): the hook
   * leaves the title untouched and Next owns soft-navigation titles.
   */
  titleFor?: (state: S, page: number) => string | null;
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
  titleFor?: (state: BrowseFilterState, page: number) => string | null;
}): BrowseInPlaceConfig<P> {
  const params = opts.params ?? {};
  return {
    basePath: opts.basePath,
    apiPath: opts.apiPath,
    params,
    titleFor: opts.titleFor,
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
  /**
   * True once a commit has been in flight ~200ms — the results region shows the
   * pending cue until the swap (SPEC §2.5.3 as amended 2026-11-23: perceptible by
   * ~0.4s; the ~200ms appearance delay keeps instant updates from flashing it).
   * Cleared synchronously with every settle, so the cue never survives onto
   * swapped results.
   */
  pendingCue: boolean;
  /**
   * One deliberate selection: optimistic control state, then the commit; the entry and
   * the results swap land together on success. `push` false replaces the current entry
   * instead of pushing (as-you-type search: replaceState while typing, pushState on the
   * deliberate act). Tapping the already-active option is a no-op either way.
   */
  select: (compute: (current: S) => S, focus?: InPlaceFocusTarget | null, push?: boolean) => void;
  /**
   * Push the current intent as a history entry even though nothing changed (a search
   * submit or blur whose query already settled via replaceState still owes its entry).
   */
  pushCurrent: () => void;
  firstAllRef: RefObject<HTMLButtonElement | null>;
  clearAllRef: RefObject<HTMLButtonElement | null>;
  /**
   * The heading landing for "heading" focus targets. Attach with a callback ref
   * (`ref={(el) => { browse.headingRef.current = el; }}`) — the landing element's type
   * is the surface's, so a direct object-ref attach would not typecheck.
   */
  headingRef: RefObject<HTMLElement | null>;
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
  // The visible pending cue (SPEC §2.5.3 as amended 2026-11-23). The timer arms when a
  // commit starts and restarts when a newer tap supersedes it (pending identity changes);
  // every settle path clears the cue synchronously with the swap. The ~200ms appearance
  // delay keeps instant updates from flashing the cue; slower updates show it well
  // before the ~0.4s perceptibility bound.
  const [pendingCue, setPendingCue] = useState(false);
  useEffect(() => {
    if (pending === null) return;
    const t = setTimeout(() => setPendingCue(true), 200);
    return () => clearTimeout(t);
  }, [pending]);
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
  const headingRef = useRef<HTMLElement | null>(null);
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
    setPendingCue(false);
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
      // Soft-navigation adoption carries its page: assert the committed state's server
      // title (Next sets it from the navigated route's metadata; the builders are shared
      // so this is the same string — idempotent, never a flicker).
      const title = configRef.current.titleFor?.(committed.state, committed.page);
      if (title != null) document.title = title;
    }
  }, [committed]);

  // The one commit path (taps and popstate share it): last id wins; stale responses —
  // success or failure — are discarded. Pushes exactly one history entry per committed
  // tap (or replaces the current entry for push:false); popstate commits without pushing
  // (the entry already exists). With computeLocal the core is computed from data in hand
  // instead of fetched — same discipline, no network.
  const fetchCommitted = useCallback(async (next: S, push: boolean): Promise<void> => {
    const id = ++requestRef.current;
    const settle = (core: InPlacePayloadCore<P, C> | null): void => {
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
      setPendingCue(false);
      if (push) {
        window.history.pushState(configRef.current.historyValueFor(next), "", configRef.current.hrefFor(next));
      } else {
        // A replaced entry carries the marker: surfaces that mix replace and push
        // (as-you-type search) read it back to tell a settled-but-unpushed query from
        // a pushed one. Only push:false commits (the shop's typing path) ever write it.
        const v = configRef.current.historyValueFor(next);
        window.history.replaceState(typeof v === "object" && v !== null ? { ...v, replaced: true } : v, "", configRef.current.hrefFor(next));
      }
      // Title sync (B-1 item 3): the committed state's server title, once, in step with
      // the visible swap and the history entry — no flicker through intermediate states.
      // A commit always resets to page 1, so the page echo is 1 by construction.
      const title = configRef.current.titleFor?.(next, 1);
      if (title != null) document.title = title;
    };
    const fail = (aborted: boolean): void => {
      if (aborted || id !== requestRef.current) return;
      // Failure path (§2.5.6): the prior results, counts and URL stand untouched; the control
      // reverts to the committed state; one error line renders with the applied row.
      intentRef.current = committedRef.current.state;
      focusRef.current = null;
      setPending(null);
      setPendingCue(false);
      setFailed(true);
    };
    const compute = configRef.current.computeLocal;
    if (compute) {
      try {
        settle(compute(next));
      } catch {
        fail(false);
      }
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(configRef.current.apiUrlFor!(next), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`browse fetch answered ${res.status}`);
      const json: unknown = await res.json();
      settle(configRef.current.readPayload(json));
    } catch {
      fail(controller.signal.aborted);
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
        setPendingCue(false);
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
    const target =
      focusRef.current === "clear-all" ? clearAllRef.current : focusRef.current === "heading" ? headingRef.current : firstAllRef.current;
    focusRef.current = null;
    target?.focus();
  }, [committed]);

  // One deliberate selection: optimistic control state, then the commit; the entry and the
  // results swap land together on success. Tapping the already-active option is a no-op: no
  // entry, no commit, no change. The transition computes from the latest intent (not the
  // render's state), so rapid taps compose instead of clobbering each other.
  const select = (compute: (current: S) => S, focus: InPlaceFocusTarget | null = null, push = true): void => {
    const next = compute(intentRef.current);
    if (config.equalStates(next, intentRef.current)) return;
    intentRef.current = next;
    focusRef.current = focus;
    setPending(next);
    setFailed(false);
    void fetchCommitted(next, push);
  };

  // Push the current intent as a history entry even though nothing changed (a search
  // submit or blur whose query already settled via replaceState still owes its entry).
  const pushCurrent = useCallback((): void => {
    const next = intentRef.current;
    window.history.pushState(configRef.current.historyValueFor(next), "", configRef.current.hrefFor(next));
  }, []);

  return {
    hydrated,
    committed,
    pending,
    shown: pending ?? committed.state,
    failed,
    pendingCue,
    select,
    pushCurrent,
    firstAllRef,
    clearAllRef,
    headingRef,
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
 * The row-removal focus landing, Clear All's label, and the failure line's dress ride
 * the config's emptyRowFocus / clearAllLabel / failureClassName — every default keeps
 * the shipped surfaces identical. Surface-generic: props and config, no surface branch.
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
  const emptiedFocus = config.emptyRowFocus ?? "first-all";
  const clearLabel = config.clearAllLabel ? config.clearAllLabel(shown) : "Clear all filters";
  const removerControl = (r: InPlaceRemover<S>) =>
    hydrated ? (
      <button
        type="button"
        className="chip-filter chip-removable"
        aria-label={r.removeLabel}
        data-filter-remove={r.key}
        onClick={() => select(r.clear, config.hasActive(r.clear(shown)) ? "clear-all" : emptiedFocus)}
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
          <button ref={clearAllRef} type="button" className="chip-filter" onClick={() => select((s) => config.clearAll(s), emptiedFocus)}>
            {clearLabel}
          </button>
        ) : (
          <Link href={config.hrefFor(config.clearAll(shown))} scroll={false} className="chip-filter">
            {clearLabel}
          </Link>
        )
      ) : null}
      {failed ? (
        <p role="alert" className={config.failureClassName ?? "font-medium text-warn"}>
          {config.failureMessage}
        </p>
      ) : null}
    </div>
  );
}
