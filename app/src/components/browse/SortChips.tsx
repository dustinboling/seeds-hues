/**
 * The sort control — ported from v2/components/ui/SortChips.tsx (same
 * single-select chip group labeled "Sort", same three options, no
 * per-option counts; plain anchors instead of next/link): links with
 * aria-current as the no-JS floor, toggle buttons with aria-pressed after
 * hydration. A sort change commits through the surface's `select` like any
 * filter tap: one history entry, page reset to 1, the count line's
 * ordering phrase announcing the new order.
 */
import { FilterStrip } from "./FilterStrip";
import { BROWSE_SORT_OPTIONS, type BrowseSortParam } from "../../lib/browse";

export function SortChips({
  sort,
  hrefFor,
  onSelect,
  hydrated,
  options = BROWSE_SORT_OPTIONS,
}: {
  /** The shown sort: committed on the server floor, optimistic once hydrated. */
  sort: BrowseSortParam;
  /** No-JS link for choosing a sort (page dropped, filters kept — the href builders). */
  hrefFor: (sort: BrowseSortParam) => string;
  /** Hydrated tap: commit a sort through the surface's select. */
  onSelect: (sort: BrowseSortParam) => void;
  hydrated: boolean;
  options?: readonly { value: BrowseSortParam; label: string }[];
}) {
  const chips = options.map((o) => (
    <li key={o.value} className="browse-chip-item">
      {hydrated ? (
        <button type="button" className="chip-filter" aria-pressed={sort === o.value} data-sort={o.value} onClick={() => onSelect(o.value)}>
          {o.label}
        </button>
      ) : (
        <a
          href={hrefFor(o.value)}
          className="chip-filter"
          aria-current={sort === o.value ? "true" : undefined}
          data-sort={o.value}
          data-vike="false"
        >
          {o.label}
        </a>
      )}
    </li>
  ));
  const group = (
    <fieldset className="browse-filter-group">
      <legend className="eyebrow">Sort</legend>
      <FilterStrip legend="Sort">{chips}</FilterStrip>
    </fieldset>
  );
  return hydrated ? (
    <div role="group" aria-label="Sort" className="browse-sort">
      {group}
    </div>
  ) : (
    <nav aria-label="Sort" className="browse-sort">
      {group}
    </nav>
  );
}
