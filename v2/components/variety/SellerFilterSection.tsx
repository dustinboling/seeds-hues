"use client";

/**
 * Variety-page sellers section, interactive part (chips + count line + legend + listing list +
 * filtered-empty state). Rendered by the server view with the variety's full listing set and
 * its server-rendered filter state; after hydration the All sellers / Small farms only control
 * toggles IN PLACE — local state, no document reload, no Next router navigation, no scroll,
 * no page-view beacon — and keeps the URL shareable through the History API.
 *
 * Shape of the contract (Open Directory, ux-spec §4 + Nadia's in-place criteria):
 *
 * - First paint is server-rendered and server-correct for BOTH URLs (the bare route and the
 *   middleware-rewritten small-farms variant): links with `aria-current`, the count line, the
 *   legend, and the Quiet Ledger-ordered list are byte-identical to the old server markup, so
 *   the filter works with JS disabled or before hydration (progressive enhancement).
 * - Filter state is `useState` initialised from the server-rendered value. There is deliberately
 *   NO mount reconciliation and NO setState in any effect body. URL → state re-sync happens
 *   only inside the `popstate` event callback (the sanctioned pattern).
 * - The links→toggle-buttons semantics upgrade after hydration (toggle buttons with
 *   `aria-pressed` in a group labelled "Filter sellers", no `aria-current`) rides on
 *   `useSyncExternalStore`: the server snapshot replays during hydration (identical HTML, no
 *   mismatch) and the client snapshot swaps the control afterwards. The swapped buttons then
 *   persist across toggles — only pressed state, count text, and rows change — so scroll never
 *   moves and focus stays on the tapped control.
 * - Each deliberate selection pushes exactly one history entry; tapping the active option is a
 *   no-op; Back/Forward re-sync in place. The one action that unmounts itself (the B = 0
 *   filtered-empty "Show all sellers") hands focus to the "All sellers" chip after its commit.
 */

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { ListingRow } from "@/components/variety/ListingRow";
import {
  SMALL_FARM_CHIP_LABEL,
  sellerFilterView,
  smallFarmEmptyVariety,
  smallFarmOnlyFromSearch,
  varietyFilterHref,
} from "@/lib/small-farm";
import type { PublicListing } from "@/lib/validators";

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
 * Seller filter chips (ux-spec §4.1, in-place build): before hydration, ordinary navigation —
 * real links to the same public URLs with `aria-current` on the active chip (prefetch off: the
 * other variant is never navigated to once hydrated, so prefetching it would only waste the
 * sibling ISR entry). Once hydrated, one mutually exclusive filter control: toggle buttons
 * with `aria-pressed`, never `aria-current`, in a group labelled "Filter sellers".
 */
function SellerFilterChips({
  slug,
  smallFarmOnly,
  hydrated,
  onSelect,
  allSellersRef,
}: {
  slug: string;
  smallFarmOnly: boolean;
  hydrated: boolean;
  onSelect: (next: boolean) => void;
  allSellersRef: RefObject<HTMLButtonElement | null>;
}) {
  if (!hydrated) {
    const chip = (label: string, href: string, active: boolean) => (
      <Link
        href={href}
        scroll={false}
        prefetch={false}
        className="chip-filter"
        aria-current={active ? "true" : undefined}
        data-filter="smallFarm"
      >
        {label}
      </Link>
    );
    return (
      <nav aria-label="Filter sellers" className="mt-3 flex flex-wrap items-center gap-2" data-testid="variety-seller-filter">
        <span className="text-sm font-semibold">Sellers:</span>
        {chip("All sellers", varietyFilterHref(slug, false), !smallFarmOnly)}
        {chip(SMALL_FARM_CHIP_LABEL, varietyFilterHref(slug, true), smallFarmOnly)}
      </nav>
    );
  }
  return (
    <div role="group" aria-label="Filter sellers" className="mt-3 flex flex-wrap items-center gap-2" data-testid="variety-seller-filter">
      <span className="text-sm font-semibold">Sellers:</span>
      <button
        ref={allSellersRef}
        type="button"
        aria-pressed={!smallFarmOnly}
        onClick={() => onSelect(false)}
        className="chip-filter"
        data-filter="smallFarm"
      >
        All sellers
      </button>
      <button
        type="button"
        aria-pressed={smallFarmOnly}
        onClick={() => onSelect(true)}
        className="chip-filter"
        data-filter="smallFarm"
      >
        {SMALL_FARM_CHIP_LABEL}
      </button>
    </div>
  );
}

export function SellerFilterSection({
  slug,
  varietyName,
  listings,
  initialSmallFarmOnly,
}: {
  /** Variety slug, for the shareable filter URLs. */
  slug: string;
  /** Variety name, for the filtered-empty wording. */
  varietyName: string;
  /** The variety's FULL listing set, already loaded by the page — the filter never fetches. */
  listings: PublicListing[];
  /** Server-rendered filter state: false on /variety/{slug}, true on ?small_farm=true. */
  initialSmallFarmOnly: boolean;
}) {
  const hydrated = useHydrated();
  // Local filter state, initialised from the server-rendered state. First paint is already
  // server-correct for BOTH URLs, so there is deliberately no mount reconciliation here.
  const [smallFarmOnly, setSmallFarmOnly] = useState(initialSmallFarmOnly);
  // B = 0 pages render no control on first load (ux-spec §4.3). Once the visitor leaves the
  // filtered-empty state through an in-place toggle, the control appears and stays, so the
  // filter remains operable and the empty-state action has an "All sellers" focus target.
  const [filterTouched, setFilterTouched] = useState(false);
  const allSellersRef = useRef<HTMLButtonElement>(null);
  // Focus handoff request: the filter state whose commit should move focus to "All sellers".
  // Set only by the filtered-empty "Show all sellers" action, which unmounts itself.
  const pendingFocusRef = useRef<boolean | null>(null);

  // Back/Forward move between the two filter states in place: re-sync state from the live URL.
  // setState inside this event callback is the sanctioned pattern; the effect body itself only
  // subscribes. No entry is pushed here — the entry already exists.
  useEffect(() => {
    const onPopState = (): void => {
      setSmallFarmOnly(smallFarmOnlyFromSearch(window.location.search));
      setFilterTouched(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Focus handoff for the one action that unmounts itself: the filtered-empty "Show all
  // sellers" button. When the requested filter state commits, the "All sellers" chip is in the
  // tree and takes focus. Plain DOM focus — no setState. Chip toggles never set the request,
  // so focus stays on the tapped control.
  useEffect(() => {
    if (pendingFocusRef.current === smallFarmOnly) {
      pendingFocusRef.current = null;
      allSellersRef.current?.focus();
    }
  }, [smallFarmOnly]);

  // One deliberate selection: exactly one history entry, no router navigation, no scroll, no
  // beacon (ViewBeacon lives outside this section and its varietySlug never changes here).
  // Tapping the already-active option is a no-op: no entry, no change.
  const select = (next: boolean): void => {
    if (next === smallFarmOnly) return;
    setSmallFarmOnly(next);
    setFilterTouched(true);
    window.history.pushState({ smallFarmOnly: next }, "", varietyFilterHref(slug, next));
  };

  const showAllInPlace = (): void => {
    if (!smallFarmOnly) return;
    pendingFocusRef.current = false;
    select(false);
  };

  const sf = sellerFilterView(listings, smallFarmOnly);
  // Quiet Ledger sorting (2026-11-20): in-stock listings above sold-out in the card stack.
  // Applied to the filter's shown set as a stable view-layer sort — sellerFilterView narrows
  // first and never re-sorts; this then orders in stock, everything else in its existing
  // order, then sold out, without disturbing order within groups.
  const availabilityRank = (a: (typeof listings)[number]["availability"]) =>
    a === "in_stock" ? 0 : a === "sold_out" ? 2 : 1;
  const sortedListings = [...sf.shown].sort((a, b) => availabilityRank(a.availability) - availabilityRank(b.availability));
  const showChips = sf.showControl || (filterTouched && sf.total > 0 && sf.badged === 0);

  return (
    <>
      {showChips ? (
        <SellerFilterChips
          slug={slug}
          smallFarmOnly={smallFarmOnly}
          hydrated={hydrated}
          onSelect={select}
          allSellersRef={allSellersRef}
        />
      ) : null}
      {/* Always present when N > 0, so the live region never depends on state (ux-spec §4.4). */}
      <p id="variety-listing-count" className="mt-2 text-muted" aria-live="polite" aria-atomic="true">
        {sf.countLine}
      </p>
      {sf.showLegend ? <SmallFarmLegend className="mt-1" /> : null}
      <div id="variety-listings">
        {sortedListings.length > 0 ? (
          <ul key={smallFarmOnly ? "small-farms" : "all"} className={`mt-3 flex flex-col gap-3${filterTouched ? " listing-swap" : ""}`}>
            {sortedListings.map((l) => (
              <li key={l.id}>
                <ListingRow listing={l} />
              </li>
            ))}
          </ul>
        ) : (
          // B = 0 reached by a hand-shared ?small_farm=true link (ux-spec §4.3).
          <p key={smallFarmOnly ? "small-farms" : "all"} className={`mt-3 text-muted${filterTouched ? " listing-swap" : ""}`} data-testid="variety-small-farm-empty">
            {smallFarmEmptyVariety(varietyName)}{" "}
            {hydrated ? (
              <button type="button" className="link-button" onClick={showAllInPlace}>
                Show all sellers
              </button>
            ) : (
              <Link href={varietyFilterHref(slug, false)} scroll={false} prefetch={false}>
                Show all sellers
              </Link>
            )}
            .
          </p>
        )}
      </div>
    </>
  );
}
