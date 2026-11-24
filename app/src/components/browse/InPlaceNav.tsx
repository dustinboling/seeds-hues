/**
 * In-place navigation over Vike's client router: filter/sort/remover/Clear
 * commits and page turns swap the results region without a full-page
 * reload, with the pending cue exactly as the live site behaves (the
 * region carries the leaf hairline + wash past ~200ms in flight, and
 * aria-busy while loading). The clean parameterized URLs stay the
 * crawlable truth — this layer introduces no new URLs.
 *
 * Contract (v2's useInPlaceBrowse discipline, adapted to Vike):
 * - First paint is server-rendered and server-correct for every filter
 *   URL, so filtering works with JS disabled or before hydration
 *   (progressive enhancement).
 * - Filter state is local intent initialised from the server-rendered
 *   value. There is deliberately NO mount reconciliation and NO setState in
 *   any effect body. New props (Vike re-rendered with new data) are adopted
 *   wholesale — results, counts, page, and filters — so the rendered page
 *   always matches the URL.
 * - Each deliberate selection navigates exactly once (Vike pushes one
 *   history entry, keeps scroll, and syncs the title); tapping the active
 *   option is a no-op (no entry, no commit). Back/Forward re-sync in place
 *   through Vike's own popstate handling plus this layer's intent re-sync.
 * - Rapid taps settle on the last selection (stale navigations are
 *   discarded by id). A filter change always resets to page 1 (the href
 *   builders drop ?page=).
 * - Actions that unmount their own control (removers, Clear all) hand
 *   focus to a control that survives the commit.
 * - Every commit syncs document.title to the title the server renders for
 *   the committed state — once, in step with the visible swap (idempotent
 *   with Vike's own title sync: same builder, same string; set only when
 *   different).
 *
 * Platform deltas from v2, recorded (not silent): chips stay ANCHORED
 * pre-hydration and upgrade to buttons post-hydration (v2's own shape);
 * pagination stays anchors always, opted out of Vike's automatic link
 * interception (data-vike="false") so this layer's explicit navigate() —
 * with keepScrollPosition and the pending cue — is the single commit path
 * (Vike would otherwise double-navigate: its interceptor ignores
 * preventDefault). On a failed commit Vike hard-loads the target URL —
 * the server truth — instead of v2's stand-plus-alert; the failure line
 * below covers only a navigate() that rejects without navigating.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type RefObject,
} from "react";

/** Where an unmounting action hands focus: the row's Clear all if the row survives, else the first All. */
export type InPlaceFocusTarget = "first-all" | "clear-all";

/** Programmatic in-place navigation (Vike client router, scroll kept). Injected in tests. */
export type NavigateFn = (href: string) => Promise<void>;

/** The production navigate: Vike's client router, loaded on demand (never on the server). */
export async function vikeNavigate(href: string): Promise<void> {
  const { navigate } = await import("vike/client/router");
  await navigate(href, { keepScrollPosition: true });
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
 * True once the component has hydrated. `useSyncExternalStore` replays the
 * server snapshot (`false`) during the hydration pass — SSR and hydration
 * render identical links — then flips to the client snapshot (`true`) with
 * no setState-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydrated, snapshotHydrated, snapshotServer);
}

/** Layout effect on the client, passive on the server (React warns for a bare useLayoutEffect during SSR). */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** What the hook hands its surface: committed + optimistic state, the commit actions, focus refs. */
export interface InPlaceNav<S> {
  hydrated: boolean;
  /** The optimistic target state awaiting its navigation (null when settled). */
  pending: S | null;
  /** The navigation target href (null when settled). */
  pendingHref: string | null;
  /**
   * True once a commit has been in flight ~200ms — the results region shows
   * the pending cue until the swap (SPEC §2.5.3 as amended 2026-11-23:
   * perceptible by ~0.4s; the ~200ms appearance delay keeps instant
   * updates from flashing it). Cleared synchronously with every settle.
   */
  pendingCue: boolean;
  failed: boolean;
  /** The server-confirmed state (results, counts, pagination, and count lines follow this only). */
  committed: S;
  /** The state the controls show: optimistic while a change is in flight, else committed. */
  shown: S;
  /**
   * One deliberate selection: optimistic control state, then the
   * navigation; the entry and the results swap land together on success.
   * Tapping the already-active option is a no-op either way. The
   * transition computes from the latest intent (not the render's state),
   * so rapid taps compose instead of clobbering each other.
   */
  select: (compute: (current: S) => S, focus?: InPlaceFocusTarget | null) => void;
  /**
   * Pagination turn: same filter state, new page href. A no-op when the
   * href is the current URL.
   */
  go: (href: string) => void;
  /**
   * Anchor click guard for pagination: modified clicks and non-left
   * buttons keep native behavior; plain left clicks navigate in place.
   */
  onAnchorNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  firstAllRef: RefObject<HTMLButtonElement | null>;
  clearAllRef: RefObject<HTMLButtonElement | null>;
}

export function useInPlaceNav<S>(opts: {
  /** The server-confirmed snapshot identity (re-created per navigation — adoption keys on it). */
  committed: S;
  /** The committed page (for the title sync). */
  page: number;
  /** Structural state equality. */
  equalStates: (a: S, b: S) => boolean;
  /** Shareable URL for a state (page dropped, extras kept). */
  hrefFor: (state: S) => string;
  /** URL → filter state, or null when the URL is not this layer's. */
  parseHref: (href: string) => S | null;
  /** Full document.title for a committed (state, page) — the title the server renders. */
  titleFor?: (state: S, page: number) => string | null;
  navigateFn?: NavigateFn;
}): InPlaceNav<S> {
  const hydrated = useHydrated();
  const navigateFn = opts.navigateFn ?? vikeNavigate;
  const [pending, setPending] = useState<{ href: string; state: S } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingCue, setPendingCue] = useState(false);
  // Last-selection-wins: every navigation takes an id; only the latest id may settle.
  const requestRef = useRef(0);
  // Latest intent (mirrors pending, or committed when settled). A ref — not
  // the pending state — so two taps inside one frame still base the second
  // on the first.
  const intentRef = useRef<S>(opts.committed);
  const focusRef = useRef<InPlaceFocusTarget | null>(null);
  const firstAllRef = useRef<HTMLButtonElement | null>(null);
  const clearAllRef = useRef<HTMLButtonElement | null>(null);
  // Effect-maintained opts mirror: handler identities stay stable while
  // the navigation and popstate paths always read the latest callbacks.
  const optsRef = useRef(opts);
  useIsomorphicLayoutEffect(() => {
    optsRef.current = opts;
  });

  // The visible pending cue. The timer arms when a commit starts and
  // restarts when a newer tap supersedes it (pending identity changes);
  // every settle path clears the cue synchronously with the swap.
  useEffect(() => {
    if (pending === null) return;
    const t = setTimeout(() => setPendingCue(true), 200);
    return () => clearTimeout(t);
  }, [pending]);

  // Navigation adoption: Vike re-rendered with a NEW committed snapshot
  // (its data object identity changes per navigation — pageContext JSON is
  // parsed fresh every time, so even Back/Forward to cached data re-keys).
  // The delivered snapshot is by definition committed (its URL is already
  // in the bar): adopt it wholesale — clear pending/failed, re-base
  // intent, hand off focus, sync the title. Render-time derived state
  // (React's sanctioned previous-render pattern); the mirrors re-base in
  // the layout effect below, and every effect body stays setState-free.
  const [lastCommitted, setLastCommitted] = useState<S>(opts.committed);
  if (lastCommitted !== opts.committed) {
    setLastCommitted(opts.committed);
    setPending(null);
    setPendingCue(false);
    setFailed(false);
  }

  // Adoption follow-through: intent re-bases on the adopted snapshot
  // and the title syncs to the committed state's server title. No
  // request-id bump here — the navigation that caused this adoption is by
  // definition the latest intent, and its continuation still owes the
  // focus handoff (bumping would mark it stale and swallow the handoff).
  useEffect(() => {
    intentRef.current = opts.committed;
    const title = optsRef.current.titleFor?.(opts.committed, opts.page);
    if (title != null && typeof document !== "undefined" && document.title !== title) document.title = title;
  }, [opts.committed, opts.page]);

  const focusHandoff = useCallback((): void => {
    if (focusRef.current === null) return;
    const target = focusRef.current === "clear-all" ? clearAllRef.current : firstAllRef.current;
    focusRef.current = null;
    target?.focus();
  }, []);

  // Back/Forward move between filter states in place: Vike navigates to
  // the popped URL and re-renders (adoption above aligns everything), but
  // intent re-syncs HERE, synchronously — the URL is already the popped
  // one when popstate fires — so a tap landing between the pop and the
  // re-render bases on the popped state, not the stale one. setState
  // inside this event callback is the sanctioned pattern; the effect body
  // itself only subscribes. No entry is pushed here — it already exists.
  useEffect(() => {
    const onPopState = (): void => {
      const parsed = optsRef.current.parseHref(window.location.href);
      if (parsed !== null) intentRef.current = parsed;
      focusRef.current = null;
      // A pop is the latest intent: invalidate any in-flight commit.
      requestRef.current += 1;
      setPending(null);
      setPendingCue(false);
      setFailed(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // The one commit path: last id wins; stale responses are discarded. The
  // settle clears nothing itself — adoption on the new props does that —
  // except hands off focus (the new DOM is committed when navigate()
  // resolves). A rejection takes the failure path: the prior results,
  // counts, and URL stand, the control reverts to the committed state, and
  // the surface renders its role=alert line. (Vike preempts most failures
  // with a hard load of the target URL — the server truth — so this path
  // covers only a navigate() that rejects without navigating.)
  const commit = useCallback(
    async (href: string, id: number): Promise<void> => {
      try {
        await navigateFn(href);
      } catch {
        if (id !== requestRef.current) return;
        intentRef.current = optsRef.current.committed;
        focusRef.current = null;
        setPending(null);
        setPendingCue(false);
        setFailed(true);
        return;
      }
      if (id !== requestRef.current) return;
      focusHandoff();
    },
    [navigateFn, focusHandoff],
  );

  const select = useCallback(
    (compute: (current: S) => S, focus: InPlaceFocusTarget | null = null): void => {
      const next = compute(intentRef.current);
      if (optsRef.current.equalStates(next, intentRef.current)) return;
      intentRef.current = next;
      focusRef.current = focus;
      const href = optsRef.current.hrefFor(next);
      setPending({ href, state: next });
      setFailed(false);
      void commit(href, ++requestRef.current);
    },
    [commit],
  );

  const go = useCallback(
    (href: string): void => {
      if (typeof window !== "undefined" && new URL(href, window.location.origin).href === window.location.href) return;
      if (pending?.href === href) return;
      focusRef.current = null;
      setPending({ href, state: intentRef.current });
      setFailed(false);
      void commit(href, ++requestRef.current);
    },
    [commit, pending],
  );

  const onAnchorNavigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string): void => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(href);
    },
    [go],
  );

  return {
    hydrated,
    pending: pending?.state ?? null,
    pendingHref: pending?.href ?? null,
    pendingCue,
    failed,
    committed: opts.committed,
    shown: pending?.state ?? opts.committed,
    select,
    go,
    onAnchorNavigate,
    firstAllRef,
    clearAllRef,
  };
}
