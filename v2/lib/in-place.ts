/**
 * Shared in-place browse machinery, types + pure guards (Tranche 3.1b): the ONE home of the
 * snapshot contract every filter surface (/variety, home, /crop, /search — and part 2's crop
 * detail + seller State cloud) consumes. No surface declares its own snapshot shape and no
 * consumer reads through a nested `.payload`: the payload's fields sit directly on the
 * snapshot, so `snapshot.total`, `snapshot.items` and `snapshot.counts` typecheck everywhere.
 *
 * Client-safe by construction: types only, plus narrowing guards with zero runtime imports.
 * The hook and the shared filter/applied-row components live in
 * components/ui/InPlaceBrowse.tsx; the filter vocabulary and transitions stay in lib/browse.ts.
 */
import type { BrowseCounts } from "@/lib/validators";

/**
 * The server-confirmed browse snapshot (SPEC §2.5.6): results, total and per-option counts,
 * atomically, for one applied filter set. First paint and every in-place update consume this
 * identical shape per surface, so SSR and in-place can never disagree.
 *
 * S is the surface's filter-state type (BrowseFilterState on the 3.1b surfaces; part 2's
 * surfaces bring their own), P the surface's result-item type. `page` is the rendered page —
 * always 1 on surfaces without pagination; a filter change resets it to 1 everywhere.
 */
export interface InPlaceSnapshot<S, P> {
  state: S;
  counts: BrowseCounts;
  items: P[];
  total: number;
  page: number;
}

/** The narrowed core of an in-place payload: what a commit swaps in (page is always reset to 1). */
export interface InPlacePayloadCore<P> {
  items: P[];
  total: number;
  counts: BrowseCounts;
}

/** Strict narrowing for unknown JSON: objects only. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Strict narrowing for the per-option counts matrix: every group present with its All cell
 * and every option cell a number (the schema's mirror, without zod — client-safe). A 0 is a
 * valid count, never a missing one; malformed means the failure path, never broken chips.
 */
export function isBrowseCountsPayload(value: unknown): value is BrowseCounts {
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

/**
 * Strict narrowing for an in-place payload body: a non-negative total, positive page/pages
 * echoes, the counts matrix, and an items array every element of which passes the surface's
 * item guard. Returns the commit core, or null — the caller takes the §2.5.6 failure path.
 */
export function browsePayloadCore<P>(json: unknown, isItem: (value: unknown) => value is P): InPlacePayloadCore<P> | null {
  if (!isRecord(json)) return null;
  if (!Array.isArray(json.items) || !json.items.every(isItem)) return null;
  if (typeof json.total !== "number" || !Number.isInteger(json.total) || json.total < 0) return null;
  if (typeof json.page !== "number" || !Number.isInteger(json.page) || json.page < 1) return null;
  if (typeof json.pages !== "number" || !Number.isInteger(json.pages) || json.pages < 1) return null;
  if (!isBrowseCountsPayload(json.counts)) return null;
  return { items: json.items, total: json.total, counts: json.counts };
}
