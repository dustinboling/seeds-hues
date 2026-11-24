/**
 * Seller State-cloud filter model — ported from v2/lib/seller-browse.ts
 * (same vocabulary, same state, same URL encoding, same count semantics):
 * the ONE home shared by the server page and the hydrated in-place layer,
 * so the two can never disagree on what a filter state means.
 *
 * One group ("state", single-select), one URL parameter (?state=, a USPS
 * code). Parsing is forgiving (unknown codes ignored → All states, never a
 * 404) exactly as the page always parsed. Counts are the All-states total
 * plus each state chip's seller count — static per catalog state, served
 * atomically with the results.
 *
 * Client-safe by construction: the only runtime imports are lib/format
 * (plural, pure) and lib/browse (the title suffix/template helpers, pure).
 */
import { documentTitleFor, titlePageSuffix } from "./browse";
import { plural } from "./format";
import type { ApiSellerBrowseCounts } from "../data/types";

/** The /seller active filter: the selected USPS code, or null for All states. */
export interface SellerBrowseState {
  state: string | null;
}

export type SellerBrowseGroup = "state";

/** Query-param name (the shipped name, unchanged). */
export const SELLER_STATE_PARAM = "state";

/** Eyebrow legend (the shipped legend, unchanged). */
export const SELLER_STATE_LEGEND = "State";

/** A state option the cloud renders (code + name; the counts come from the payload). */
export interface SellerStateOption {
  code: string;
  name: string;
  slug: string;
}

/** No filter active (All states). */
export function clearSellerBrowseFilters(): SellerBrowseState {
  return { state: null };
}

/** True when a state narrows the list (the applied row shows iff this is true). */
export function hasActiveSellerFilters(state: SellerBrowseState): boolean {
  return state.state !== null;
}

/** Structural equality. */
export function equalSellerBrowseFilters(a: SellerBrowseState, b: SellerBrowseState): boolean {
  return a.state === b.state;
}

/** Whether the option reads active (single-select equality). */
export function isSellerOptionActive(state: SellerBrowseState, value: string | null): boolean {
  return value === state.state;
}

/** The state a chip tap moves to (All clears; a code assigns). */
export function sellerCountStateFor(state: SellerBrowseState, option: string | null): SellerBrowseState {
  if (option === state.state) return state;
  return { state: option };
}

/* ── URL ── */

/** The filter params to carry on links (e.g. pagination) — the active state only. */
export function sellerFilterParams(state: SellerBrowseState): Record<string, string> {
  return state.state ? { [SELLER_STATE_PARAM]: state.state } : {};
}

/**
 * Link for a filter state: ?page= is never carried (a changed filter
 * starts at page 1). The server chips AND the hydrated layer's History API
 * update share this, so the two can never disagree on the shareable URL.
 */
export function sellerBrowseHref(basePath: string, state: SellerBrowseState): string {
  const p = new URLSearchParams(sellerFilterParams(state));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Link for one chip: the state with that option applied. */
export function sellerChipHref(basePath: string, _state: SellerBrowseState, value: string | null): string {
  return sellerBrowseHref(basePath, { state: value });
}

/* ── Parsing (page query → state; forgiving — unknown codes are All, never a 404) ── */

type RawParam = string | string[] | undefined;

/**
 * ?state= for /seller: a USPS code (any case, trimmed) that has sellers —
 * anything else (absent, garbage, a state with no sellers) is All states.
 * The valid codes are the states that have sellers, passed in so the page
 * and the popstate re-sync share the one rule.
 */
export function parseSellerStateParam(raw: RawParam, states: Pick<SellerStateOption, "code">[]): string | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();
  if (!v) return null;
  return states.some((s) => s.code === v) ? v : null;
}

/** Page query → filter state. */
export function readSellerBrowseFilters(
  sp: Record<string, string | string[] | undefined>,
  states: Pick<SellerStateOption, "code">[],
): SellerBrowseState {
  return { state: parseSellerStateParam(sp.state, states) };
}

/**
 * Client-side mirror of readSellerBrowseFilters: reads the filter state
 * back from a live `location.search` string (a leading "?" is tolerated).
 * The hydrated layer's popstate handler re-syncs through this, so
 * Back/Forward apply the same rule as first load.
 */
export function sellerBrowseFiltersFromSearch(search: string, states: Pick<SellerStateOption, "code">[]): SellerBrowseState {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const all = q.getAll(SELLER_STATE_PARAM);
  const raw: RawParam = all.length > 1 ? all : (all[0] as string | undefined);
  return { state: parseSellerStateParam(raw, states) };
}

/* ── Count line, removers ── */

/**
 * The /seller result-count line's text core (the shipped phrasing,
 * preserved): the page's <p> renders this plus, when filtered, the
 * /state/{slug} link, plus the page echo. The server page and the hydrated
 * swap share this builder for the text they both render.
 */
export function sellerBrowseCountText(state: SellerBrowseState, total: number, states: SellerStateOption[]): string {
  if (state.state) {
    const name = states.find((s) => s.code === state.state)?.name ?? state.state;
    return `${plural(total, "seller")} in ${name}.`;
  }
  return `${plural(total, "seller")} — US farms and seed companies of every size. Sellers do not pay for placement.`;
}

/**
 * The /seller title the server renders for a filter state + page: the
 * selected state's name, or the unfiltered title at rest (an unknown code
 * reads as All states — the same forgiving rule as parsing), plus the page
 * suffix. The head builder shares this, so SSR and the in-place title sync
 * can never disagree.
 */
export function sellerBrowseTitle(state: SellerBrowseState, states: SellerStateOption[], page: number): string {
  const active = state.state ? (states.find((s) => s.code === state.state) ?? null) : null;
  return `${active ? `Seed sellers in ${active.name}` : "Flower seed sellers"}${titlePageSuffix(page)}`;
}

/** The /seller document.title for a committed (state, page). */
export function sellerDocumentTitle(state: SellerBrowseState, states: SellerStateOption[], page: number): string {
  return documentTitleFor(sellerBrowseTitle(state, states, page));
}

/**
 * One applied-row remover: its stable key, its visible label ("{Group}:
 * {Value}"), its accessible name ("Remove the {Group} filter, {Value}"),
 * and the clearing transition. At most one (single group, single-select)
 * — Clear All is omitted on this surface (the §2.6.2 bounded exception:
 * "All states" remains the reset).
 */
export interface SellerBrowseRemover {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: SellerBrowseState) => SellerBrowseState;
}

/** The applied row's removers for a state: the single State remover, or none. */
export function sellerRemoversFor(state: SellerBrowseState, states: SellerStateOption[]): SellerBrowseRemover[] {
  if (!state.state) return [];
  const name = states.find((s) => s.code === state.state)?.name ?? state.state;
  return [
    {
      key: "state",
      label: `${SELLER_STATE_LEGEND}: ${name}`,
      removeLabel: `Remove the ${SELLER_STATE_LEGEND} filter, ${name}`,
      clear: () => clearSellerBrowseFilters(),
    },
  ];
}

/**
 * One chip's count from a computed ApiSellerBrowseCounts: value null is
 * "All states", otherwise the state's USPS code. A 0 renders and stays
 * operable (unreachable in practice — every rendered state has sellers —
 * but the rule stands).
 */
export function sellerCountFor(counts: ApiSellerBrowseCounts, value: string | null): number {
  return value === null ? counts.all : (counts.options[value] ?? 0);
}
