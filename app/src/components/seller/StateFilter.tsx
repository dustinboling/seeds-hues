/**
 * State filter for the seller index — ported from
 * v2/components/seller/StateFilter.tsx (same counted cloud, same
 * single-select "All states" reset; plain anchors instead of next/link):
 * before hydration the chips are plain server-rendered links (the no-JS
 * floor: the active chip carries aria-current="true"); after hydration
 * they are toggle buttons with aria-pressed. Cloud layout, counts, and
 * labels are unchanged either way: each chip pairs the state name with
 * its seller count as text. Options are only the states that have
 * sellers; counts come from the browse payload's counts matrix.
 *
 * Recorded delta (brief-scoped): the state-outline glyphs (StateShape)
 * are a separate frozen item — chips render name + count only, exactly
 * the information v2's chips carry as text.
 */
import {
  isSellerOptionActive,
  sellerChipHref,
  sellerCountFor,
  sellerCountStateFor,
  type SellerBrowseState,
  type SellerStateOption,
} from "../../lib/seller-browse";
import type { ApiSellerBrowseCounts } from "../../data/types";
import type { InPlaceNav } from "../browse/InPlaceNav";

export function StateFilter({
  basePath,
  states,
  counts,
  browse,
}: {
  basePath: string;
  states: SellerStateOption[];
  counts: ApiSellerBrowseCounts;
  browse: InPlaceNav<SellerBrowseState>;
}) {
  const { hydrated, committed, shown, select, firstAllRef } = browse;
  const total = sellerCountFor(counts, null);
  const allActive = hydrated ? isSellerOptionActive(shown, null) : isSellerOptionActive(committed, null);

  const allChip = hydrated ? (
    <button
      ref={firstAllRef}
      type="button"
      className="chip-filter"
      aria-pressed={allActive}
      data-filter="state"
      onClick={() => select((s) => sellerCountStateFor(s, null))}
    >
      All states{" "}
      <span className="chip-count-plain">
        {total}
        <span className="sr-only"> sellers</span>
      </span>
    </button>
  ) : (
    <a
      href={sellerChipHref(basePath, committed, null)}
      className="chip-filter"
      aria-current={allActive ? "true" : undefined}
      data-filter="state"
      data-vike="false"
    >
      All states{" "}
      <span className="chip-count-plain">
        {total}
        <span className="sr-only"> sellers</span>
      </span>
    </a>
  );

  const stateChips = states.map((s) => {
    const n = sellerCountFor(counts, s.code);
    const on = hydrated ? isSellerOptionActive(shown, s.code) : isSellerOptionActive(committed, s.code);
    return (
      <li key={s.code}>
        {hydrated ? (
          <button
            type="button"
            className="chip-filter"
            aria-pressed={on}
            data-filter="state"
            data-state={s.code}
            onClick={() => select((st) => sellerCountStateFor(st, s.code))}
          >
            {s.name}{" "}
            <span className="chip-count-plain">
              {n}
              <span className="sr-only"> {n === 1 ? "seller" : "sellers"}</span>
            </span>
          </button>
        ) : (
          <a
            href={sellerChipHref(basePath, committed, s.code)}
            className="chip-filter"
            aria-current={on ? "true" : undefined}
            data-filter="state"
            data-state={s.code}
            data-vike="false"
          >
            {s.name}{" "}
            <span className="chip-count-plain">
              {n}
              <span className="sr-only"> {n === 1 ? "seller" : "sellers"}</span>
            </span>
          </a>
        )}
      </li>
    );
  });

  const cloud = (
    <fieldset className="browse-filter-group">
      <legend className="eyebrow">State</legend>
      <ul className="state-cloud">
        <li>{allChip}</li>
        {stateChips}
      </ul>
    </fieldset>
  );

  // The links→buttons semantics upgrade after hydration (never aria-current on a button).
  if (!hydrated) {
    return (
      <nav aria-label="Filters" className="browse-filters">
        {cloud}
      </nav>
    );
  }
  return (
    <div role="group" aria-label="Filters" className="browse-filters">
      {cloud}
    </div>
  );
}
