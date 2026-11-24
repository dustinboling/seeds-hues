/**
 * The applied row: one remover per active group (one per hue family under
 * multi-select), Clear all, and the failure line's slot — ported from
 * v2's InPlaceAppliedRow (same removers, same labels, same failure slot;
 * plain anchors instead of next/link). Absent when nothing is active —
 * unless the failure line needs its slot. Server floor: working links;
 * hydrated: buttons. `showClearAll` (default true) omits the Clear All
 * control when false — the §2.6.2 bounded exception for single-group
 * surfaces whose All chip remains the reset.
 */
import { ChipRemoveIcon } from "../icons";
import type { InPlaceNav } from "./InPlaceNav";

/** One applied-row remover: stable key, visible label, accessible name, clearing transition. */
export interface AppliedRemover<S> {
  key: string;
  label: string;
  removeLabel: string;
  clear: (state: S) => S;
}

export function AppliedRow<S>({
  browse,
  removers,
  hasActive,
  clearAll,
  clearAllLabel = "Clear all filters",
  hrefFor,
  showClearAll = true,
  failureMessage,
}: {
  browse: InPlaceNav<S>;
  /** The applied row's removers for the SHOWN state, in group order. */
  removers: AppliedRemover<S>[];
  /** True when at least one group narrows the list. */
  hasActive: (state: S) => boolean;
  /** Clear All's target from a state: every group to All, the state's sort surviving. */
  clearAll: (state: S) => S;
  clearAllLabel?: string;
  /** Shareable URL for a state (page dropped, extras kept). */
  hrefFor: (state: S) => string;
  showClearAll?: boolean;
  /** The failure line's wording (each surface's shipped copy). */
  failureMessage: string;
}) {
  const { shown, hydrated, failed, select, clearAllRef } = browse;
  // Absent when nothing is active — unless the failure line needs its slot.
  if (removers.length === 0 && !failed) return null;
  const removerControl = (r: AppliedRemover<S>) =>
    hydrated ? (
      <button
        type="button"
        className="chip-filter chip-removable"
        aria-label={r.removeLabel}
        data-filter-remove={r.key}
        onClick={() => select(r.clear, hasActive(r.clear(shown)) ? "clear-all" : "first-all")}
      >
        {r.label}
        <ChipRemoveIcon />
      </button>
    ) : (
      <a
        href={hrefFor(r.clear(shown))}
        className="chip-filter chip-removable"
        aria-label={r.removeLabel}
        data-filter-remove={r.key}
        data-vike="false"
      >
        {r.label}
        <ChipRemoveIcon />
      </a>
    );
  return (
    <div role="group" aria-label="Applied filters" className="applied-filters" data-testid="applied-filters">
      {removers.length > 0 ? (
        <ul className="applied-filters-list">
          {removers.map((r) => (
            <li key={r.key}>{removerControl(r)}</li>
          ))}
        </ul>
      ) : null}
      {removers.length > 0 && showClearAll ? (
        hydrated ? (
          <button ref={clearAllRef} type="button" className="chip-filter" onClick={() => select((s) => clearAll(s), "first-all")}>
            {clearAllLabel}
          </button>
        ) : (
          <a href={hrefFor(clearAll(shown))} className="chip-filter" data-vike="false">
            {clearAllLabel}
          </a>
        )
      ) : null}
      {failed ? (
        <p role="alert" className="browse-failure">
          {failureMessage}
        </p>
      ) : null}
    </div>
  );
}
