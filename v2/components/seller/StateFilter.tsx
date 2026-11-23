"use client";

import Link from "next/link";
import { StateShape } from "@/components/seller/StateShape";
import type { InPlaceBrowse } from "@/components/ui/InPlaceBrowse";
import { isSellerOptionActive, sellerChipHref, sellerCountFor, sellerCountStateFor } from "@/lib/seller-browse";
import type { SellerBrowseState } from "@/lib/seller-browse";
import type { SellerBrowseCounts, SellerListItem, SellerState } from "@/lib/validators";

/**
 * State filter for the seller index (Tranche 3.1b-2): the counted cloud, in the BrowseFilters
 * chip style — single-select, "All states" clears it. Before hydration the chips are plain
 * server-rendered links (the no-JS floor: the active chip carries aria-current="true");
 * after hydration they are toggle buttons with aria-pressed. Cloud layout, counts and glyphs
 * are unchanged either way (the sanctioned counted-cloud exception, §2.3): each chip pairs
 * the state outline (decorative) with the state name and its seller count as text. Options
 * are only the states that have sellers (catalog.listSellerStates()); counts come from the
 * browse payload's counts matrix, which carries the cloud's own numbers.
 */
export function StateFilter({
  basePath,
  states,
  browse,
}: {
  basePath: string;
  states: SellerState[];
  browse: InPlaceBrowse<SellerBrowseState, SellerListItem, SellerBrowseCounts>;
}) {
  const { hydrated, committed, shown, select, firstAllRef } = browse;
  const counts = committed.counts;
  const total = sellerCountFor(counts, null);
  const allActive = hydrated ? isSellerOptionActive(shown, null) : isSellerOptionActive(committed.state, null);

  const allChip = hydrated ? (
    <button
      ref={firstAllRef}
      type="button"
      className="chip-filter"
      aria-pressed={allActive}
      data-filter="state"
      onClick={() => select((s) => sellerCountStateFor(s, null))}
    >
      All states
      <span className="ml-1.5 text-muted">
        {total}
        <span className="sr-only"> sellers</span>
      </span>
    </button>
  ) : (
    <Link
      href={sellerChipHref(basePath, committed.state, null)}
      scroll={false}
      className="chip-filter"
      aria-current={allActive ? "true" : undefined}
      data-filter="state"
    >
      All states
      <span className="ml-1.5 text-muted">
        {total}
        <span className="sr-only"> sellers</span>
      </span>
    </Link>
  );

  const stateChips = states.map((s) => {
    const n = sellerCountFor(counts, s.code);
    const on = hydrated ? isSellerOptionActive(shown, s.code) : isSellerOptionActive(committed.state, s.code);
    return (
      <li key={s.code}>
        {hydrated ? (
          <button
            type="button"
            className="chip-filter gap-1.5"
            aria-pressed={on}
            data-filter="state"
            data-state={s.code}
            onClick={() => select((st) => sellerCountStateFor(st, s.code))}
          >
            <StateShape region={s.code} size={18} />
            {s.name}
            <span className="text-muted">
              {n}
              <span className="sr-only"> {n === 1 ? "seller" : "sellers"}</span>
            </span>
          </button>
        ) : (
          <Link
            href={sellerChipHref(basePath, committed.state, s.code)}
            scroll={false}
            className="chip-filter gap-1.5"
            aria-current={on ? "true" : undefined}
            data-filter="state"
            data-state={s.code}
          >
            <StateShape region={s.code} size={18} />
            {s.name}
            <span className="text-muted">
              {n}
              <span className="sr-only"> {n === 1 ? "seller" : "sellers"}</span>
            </span>
          </Link>
        )}
      </li>
    );
  });

  const cloud = (
    <fieldset className="min-w-0">
      <legend className="eyebrow mb-1">State</legend>
      <ul className="flex flex-wrap items-center gap-2">
        <li>{allChip}</li>
        {stateChips}
      </ul>
    </fieldset>
  );

  // The links→buttons semantics upgrade after hydration (never aria-current on a button).
  if (!hydrated) {
    return (
      <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
        {cloud}
      </nav>
    );
  }
  return (
    <div role="group" aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {cloud}
    </div>
  );
}
