import Link from "next/link";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { BROWSE_SORT_OPTIONS, type BrowseSortParam } from "@/lib/browse";

/**
 * The sort control (Tranche 3.4 §5.2): a single-select chip group labeled "Sort" — exactly
 * three options, built from .chip-filter, no per-option counts (an order has no count to
 * show). Rendered on the sorted surfaces (/variety, crop detail, shops) after the filter
 * groups and before the applied row, riding the in-place contract: links with aria-current
 * as the no-JS floor, toggle buttons with aria-pressed after hydration (the InPlaceFilters
 * shape — stable keys, no remounts, focus stays on the tapped chip). A sort change commits
 * through the surface's `select` like any filter tap: one history entry, page reset to 1,
 * the count line's ordering phrase announcing the new order. `options` carries a
 * surface's labels (the shop's "In stock first" for ?sort=availability); the default is
 * the browse control's shipped options.
 */
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
    <li key={o.value} className="flex-none">
      {hydrated ? (
        <button
          type="button"
          className="chip-filter"
          aria-pressed={sort === o.value}
          data-sort={o.value}
          onClick={() => onSelect(o.value)}
        >
          {o.label}
        </button>
      ) : (
        <Link
          href={hrefFor(o.value)}
          scroll={false}
          className="chip-filter"
          aria-current={sort === o.value ? "true" : undefined}
          data-sort={o.value}
        >
          {o.label}
        </Link>
      )}
    </li>
  ));
  const group = (
    <fieldset className="min-w-0">
      <legend className="eyebrow mb-1">Sort</legend>
      <FilterStrip legend="Sort">{chips}</FilterStrip>
    </fieldset>
  );
  return hydrated ? (
    <div role="group" aria-label="Sort" className="mt-3">
      {group}
    </div>
  ) : (
    <nav aria-label="Sort" className="mt-3">
      {group}
    </nav>
  );
}
