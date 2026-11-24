"use client";

/**
 * The shop catalog block, interactive part (seller-as-shop): the "{name}'s shop" heading
 * (Ada Ruling 7's focus landing), the in-shop search field, the filter strips with
 * per-option counts, the sort control, the applied row with removers + Clear All, the
 * count line (a persistent live region), the all-sold-out notice, the results grid (or
 * a designed state), and pagination.
 *
 * Rendered by the server page with the initial shop snapshot; first paint is
 * server-rendered and server-correct for every shop URL (links with `aria-current`,
 * the GET search form, counts, the applied row, the count line), so the shop works
 * with JS disabled or before hydration. After hydration every filter/search/sort
 * change applies IN PLACE through the shared `useInPlaceBrowse` hook — with the
 * shop's settled exception: counts, narrowing, and ordering compute LOCALLY from the
 * shipped full set (no fetch), by the one definition in lib/shop-browse.ts. No
 * document reload, no Next router navigation, no scroll, no page-view beacon — and no
 * search-log entry for in-shop searches. The URL stays shareable through the History
 * API (replaceState while typing, pushState on submit / blur-with-changed-query /
 * clear). Pagination stays true navigation. This file owns only the shop's rendering;
 * the commit discipline is shared with every surface.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/layout/icons";
import { InPlaceAppliedRow, useInPlaceBrowse, type InPlaceBrowse, type InPlaceConfig } from "@/components/ui/InPlaceBrowse";
import { SwatchDot } from "@/components/ui/BrowseFilters";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { Pagination } from "@/components/ui/Pagination";
import { SortChips } from "@/components/ui/SortChips";
import { ShopVarietyGrid } from "@/components/variety/VarietyCard";
import { browsePageFromSearch, type BrowseSortParam, type ColorFamily } from "@/lib/browse";
import { PAGE_SIZE } from "@/lib/config";
import { plural } from "@/lib/format";
import { type InPlaceSnapshot } from "@/lib/in-place";
import { totalPages } from "@/lib/paging";
import {
  clearShopAll,
  equalShopBrowseFilters,
  hasActiveShopFilters,
  hasActiveShopState,
  isShopOptionActive,
  parseShopQueryParam,
  SHOP_CROP_LEGEND,
  SHOP_SORT_OPTIONS,
  shopBrowseHref,
  shopCountFor,
  shopCountLine,
  shopCountsFor,
  shopCountStateFor,
  shopCropOptions,
  shopCropsFor,
  shopBrowseFiltersFromSearch,
  shopDidYouMean,
  shopDocumentTitle,
  shopFilterParams,
  shopGroupsFor,
  shopHasFilters,
  shopHasSearch,
  shopIsAllSoldOut,
  shopName,
  shopRemoversFor,
  SHOP_BROWSE_OPTIONS,
  shopViewListings,
  type ShopBrowseState,
  type ShopCounts,
  type ShopCrop,
  type ShopFilterGroup,
  type ShopSortParam,
} from "@/lib/shop-browse";
import { SELLER_NO_LISTINGS } from "@/lib/zero-seller";
import type { PublicListing } from "@/lib/validators";

/** CS-24 (typographic apostrophes): the in-place failure line — a contract backstop here. */
const FAILURE_MESSAGE = "That didn’t apply — you’re still seeing the previous results. Try again.";

/** The server-rendered shop snapshot this block hydrates from. */
export type ShopBrowseInitial = InPlaceSnapshot<ShopBrowseState, PublicListing, ShopCounts>;

/**
 * The per-option count inside a shop chip — the BrowseFilters count dress with the
 * shop's screen-reader unit ("listings", CS-18): sighted readers see the parenthesized
 * numeral; assistive tech gets the numeral plus the unit.
 */
function ShopChipCount({ counts, group, value }: { counts: ShopCounts; group: ShopFilterGroup; value: string | null }) {
  const n = shopCountFor(counts, group, value);
  return (
    <span className="text-muted tabular-nums">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">
        {n} listings
      </span>
    </span>
  );
}

function shopLegend(g: ShopFilterGroup): string {
  return g === "crop" ? SHOP_CROP_LEGEND : SHOP_BROWSE_OPTIONS[g].legend;
}

function shopOptions(g: ShopFilterGroup, shopCrops: ShopCrop[]): { value: string | null; label: string; hue?: ColorFamily }[] {
  if (g === "crop") return shopCropOptions(shopCrops);
  return SHOP_BROWSE_OPTIONS[g].options;
}

/**
 * The shop's filter strips: server links with `aria-current` before hydration, toggle
 * buttons with `aria-pressed` after — the InPlaceFilters shape (stable keys, no
 * remounts, focus stays on the tapped chip; pressed follows the optimistic state,
 * counts the committed one). Crop chips are plain text (Hue alone carries swatch
 * dots); every chip carries its locally computed count — a 0 renders and stays
 * operable.
 */
function ShopFilters({
  basePath,
  groups,
  shopCrops,
  browse,
}: {
  basePath: string;
  groups: ShopFilterGroup[];
  shopCrops: ShopCrop[];
  browse: InPlaceBrowse<ShopBrowseState, PublicListing, ShopCounts>;
}) {
  const { hydrated, committed, shown, select } = browse;
  const strips = groups.map((g) => (
    <fieldset key={g} className="min-w-0">
      <legend className="eyebrow mb-1">{shopLegend(g)}</legend>
      <FilterStrip legend={shopLegend(g)}>
        {shopOptions(g, shopCrops).map((o) =>
          hydrated ? (
            <li key={o.value ?? "all"} className="flex-none">
              <button
                type="button"
                className="chip-filter"
                aria-pressed={isShopOptionActive(shown, g, o.value)}
                data-filter={g}
                onClick={() => select((s) => shopCountStateFor(s, g, o.value))}
              >
                {o.hue ? <SwatchDot family={o.hue} /> : null}
                {o.label} <ShopChipCount counts={committed.counts} group={g} value={o.value} />
              </button>
            </li>
          ) : (
            <li key={o.value ?? "all"} className="flex-none">
              <Link
                href={shopBrowseHref(basePath, shopCountStateFor(committed.state, g, o.value))}
                scroll={false}
                className="chip-filter"
                aria-current={isShopOptionActive(committed.state, g, o.value) ? "true" : undefined}
                data-filter={g}
              >
                {o.hue ? <SwatchDot family={o.hue} /> : null}
                {o.label} <ShopChipCount counts={committed.counts} group={g} value={o.value} />
              </Link>
            </li>
          ),
        )}
      </FilterStrip>
    </fieldset>
  ));
  return hydrated ? (
    <div role="group" aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {strips}
    </div>
  ) : (
    <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {strips}
    </nav>
  );
}

/**
 * The in-shop search field: a plain GET form — NOT the SearchBox combobox; no
 * autocomplete panel. The visible label names the scope in the seller's name and is
 * the field's programmatic label (Ada Ruling 6); the placeholder exemplifies only
 * what the matcher matches (never Latin names, never aliases).
 *
 * After hydration, typing narrows in place from 2 characters (~300ms debounce) with
 * replaceState per settled update — focus never leaves the field — and the deliberate
 * act (submit, blur with a changed query, clearing via the applied row) owns the one
 * history entry. Back from a searched shop returns to the pre-search view in one step.
 */
/**
 * Whether a submit/blur owes a history entry for its effective query: a replaced entry
 * always owes one (the query settled via replaceState); a pushed entry owes one only
 * when its query differs; a foreign entry (initial load, router navigation) falls back
 * to comparing against the URL. Reading the entry — not a tracking ref — keeps
 * popstate and soft-navigation adoption correct by construction.
 */
function isPushOwed(eff: string): boolean {
  const st: unknown = window.history.state;
  if (st && typeof st === "object" && "shop" in st) {
    const entry = st as { shop?: Record<string, string>; replaced?: boolean };
    if (entry.replaced === true) return true;
    return (entry.shop?.q ?? "") !== eff;
  }
  return parseShopQueryParam(new URLSearchParams(window.location.search).get("q") ?? undefined) !== eff;
}

function ShopSearch({
  basePath,
  sellerName,
  browse,
}: {
  basePath: string;
  sellerName: string;
  browse: InPlaceBrowse<ShopBrowseState, PublicListing, ShopCounts>;
}) {
  const { hydrated, committed, select, pushCurrent } = browse;
  const [value, setValue] = useState(committed.state.q);
  // External resync (popstate, soft-navigation adoption, row-driven clears): when the
  // committed query changes to something the field's own content did not produce, the
  // field re-syncs to it. Own debounced commits match the field and pass through
  // untouched — the field is never rewritten by the system.
  const [lastQ, setLastQ] = useState(committed.state.q);
  if (lastQ !== committed.state.q) {
    setLastQ(committed.state.q);
    if (committed.state.q !== parseShopQueryParam(value)) {
      setValue(committed.state.q);
    }
  }
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const eff = parseShopQueryParam(value);
      select((s) => (s.q === eff ? s : { ...s, q: eff }), null, false);
    }, 300);
    return () => clearTimeout(t);
  }, [value, hydrated, select]);
  // The deliberate act's entry: commit first (pushing when the intent changed), then —
  // on the microtask, past the settle — push the entry still owed when the intent
  // already held the query (it settled earlier via replaceState).
  const commitDeliberate = () => {
    const eff = parseShopQueryParam(value);
    select((s) => (s.q === eff ? s : { ...s, q: eff }), null, true);
    queueMicrotask(() => {
      if (isPushOwed(eff)) pushCurrent();
    });
  };
  // The no-JS floor carries the active filters/sort through hidden inputs (page
  // dropped) — submitting searches within the filtered, sorted view.
  const carried = shopFilterParams(committed.state);
  delete carried.q;
  return (
    <div className="mt-4">
      <form role="search" action={basePath} method="get" onSubmit={hydrated ? (e) => { e.preventDefault(); commitDeliberate(); } : undefined}>
        <label htmlFor="shop-search" className="eyebrow mb-1 block">
          Search {shopName(sellerName)}
        </label>
        <div className="relative w-full">
          {Object.entries(carried).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input
            id="shop-search"
            type="search"
            name="q"
            inputMode="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Variety or flower name…"
            value={value}
            maxLength={100}
            onChange={(e) => setValue(e.target.value)}
            onBlur={hydrated ? () => commitDeliberate() : undefined}
            className="w-full rounded-search border-2 border-line-strong bg-surface h-12 text-base pl-10 pr-24 text-ink placeholder:text-muted focus:border-leaf focus:outline-none focus-visible:outline-3 focus-visible:outline-focus"
          />
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-leaf-600">
            <SearchIcon />
          </span>
          <button type="submit" className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2">
            Search
          </button>
        </div>
      </form>
    </div>
  );
}

export function ShopBrowse({
  basePath,
  sellerName,
  baseTitle,
  initial,
  full,
  crops,
}: {
  /** Route path of the shop (history entries + popstate ownership). */
  basePath: string;
  sellerName: string;
  /** The seller title the server renders (the in-place title sync shares it). */
  baseTitle: string;
  initial: ShopBrowseInitial;
  /** The seller's COMPLETE listing set — the in-place layer computes from this. */
  full: PublicListing[];
  /** The global crop vocabulary (?crop= validity + remover labels). */
  crops: ShopCrop[];
}) {
  const total = full.length;
  const shopCrops = shopCropsFor(full);
  const groups = shopGroupsFor(full);
  const config: InPlaceConfig<ShopBrowseState, PublicListing, ShopCounts> = {
    basePath,
    params: {},
    failureMessage: FAILURE_MESSAGE,
    failureClassName: "w-full font-sans text-sm text-warn",
    clearAllLabel: (s) => (s.q !== "" ? "Clear search and filters" : "Clear all filters"),
    emptyRowFocus: "heading",
    readPayload: () => null, // Unused: computeLocal commits never fetch.
    computeLocal: (state) => {
      const view = shopViewListings(full, state);
      return { items: view.slice(0, PAGE_SIZE), total: view.length, counts: shopCountsFor(full, state, shopCrops) };
    },
    readSearch: (search) => shopBrowseFiltersFromSearch(search, crops),
    pageOfSearch: browsePageFromSearch,
    equalStates: equalShopBrowseFilters,
    hasActive: hasActiveShopState,
    clearAll: clearShopAll,
    removersFor: (state) => shopRemoversFor(state, crops),
    hrefFor: (state) => shopBrowseHref(basePath, state),
    historyValueFor: (state) => ({ shop: shopFilterParams(state) }),
    titleFor: (state, page) => shopDocumentTitle(baseTitle, page),
  };
  const browse = useInPlaceBrowse(initial, config);
  const { hydrated, committed, pending, pendingCue, shown, select, headingRef } = browse;
  const pages = totalPages(committed.total);
  const showSearch = shopHasSearch(total);
  const showTools = shopHasFilters(total);
  // The sort group follows the committed query (like the count line): its unmounting
  // and the line's ordering-phrase change land in the same update (Ada Ruling 8).
  const showSort = showTools && committed.state.q === "";
  const suggestion = committed.state.q !== "" && committed.total === 0 ? shopDidYouMean(committed.state.q, full) : null;
  // The in-place cascade: the grid and empty states animate only after a
  // visitor-initiated change — never on first load, never on pagination navigation
  // (the key drops the page, so page turns never remount), never under reduced motion
  // (the shipped media rule removes it).
  const [touched, setTouched] = useState(false);
  const firstSnapshot = useRef(initial);
  useEffect(() => {
    if (committed !== firstSnapshot.current) setTouched(true);
  }, [committed]);

  return (
    <>
      <h2
        id="seller-varieties"
        tabIndex={-1}
        ref={(el) => {
          headingRef.current = el;
        }}
        className="text-2xl font-semibold focus:outline-3 focus:outline-focus focus:outline-offset-2"
      >
        {shopName(sellerName)}
      </h2>
      {showSearch ? <ShopSearch basePath={basePath} sellerName={sellerName} browse={browse} /> : null}
      {showTools && groups.length > 0 ? <ShopFilters basePath={basePath} groups={groups} shopCrops={shopCrops} browse={browse} /> : null}
      {showSort ? (
        // The sort group is absent while a query is active (relevance owns the order)
        // and returns with its prior selection intact when the query clears. When no
        // group discriminates, the 4px wrapper restores the block's 16px top step.
        groups.length > 0 ? (
          <SortChips
            sort={hydrated ? shown.sort : committed.state.sort}
            hrefFor={(sort: BrowseSortParam) => shopBrowseHref(basePath, { ...committed.state, sort: sort as ShopSortParam })}
            onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort: sort as ShopSortParam }))}
            hydrated={hydrated}
            options={SHOP_SORT_OPTIONS}
          />
        ) : (
          <div className="mt-1">
            <SortChips
              sort={hydrated ? shown.sort : committed.state.sort}
              hrefFor={(sort: BrowseSortParam) => shopBrowseHref(basePath, { ...committed.state, sort: sort as ShopSortParam })}
              onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort: sort as ShopSortParam }))}
              hydrated={hydrated}
              options={SHOP_SORT_OPTIONS}
            />
          </div>
        )
      ) : null}
      <InPlaceAppliedRow config={config} browse={browse} />
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      {total === 0 ? (
        <p className="mt-1 text-muted">{plural(committed.total, "listing")}</p>
      ) : (
        <p id="seller-results-count" className={`${showTools ? "mt-3" : "mt-1"} text-muted tabular-nums`} aria-live="polite" aria-atomic="true">
          {shopCountLine(committed.state, committed.total, committed.page, pages)}
        </p>
      )}
      {shopIsAllSoldOut(full) ? (
        <p className="mt-1 text-ink-soft">
          {sellerName} has nothing in stock right now — listings are shown with their last checked dates.
        </p>
      ) : null}
      {/* Pending indication (§2.5.3 as amended 2026-11-23): busy while a change is in
          flight. Cleared on settle — the attribute is absent then, so settled markup
          is byte-identical with or without this line. Past ~200ms in flight the region
          also shows the pending cue. */}
      <div id="shop-results" className={pendingCue ? "browse-pending" : undefined} aria-busy={pending === null ? undefined : true}>
        {committed.total > 0 ? (
          <ShopVarietyGrid
            key={shopBrowseHref(basePath, committed.state)}
            listings={committed.items}
            className={`mt-3${touched ? " listing-swap" : ""}`}
          />
        ) : total === 0 ? (
          <p className="mt-3 text-muted">
            {SELLER_NO_LISTINGS} <Link href="/variety">Browse all varieties</Link>.
          </p>
        ) : committed.state.q !== "" ? (
          <>
            <p className={`mt-3${touched ? " listing-swap" : ""}`} data-testid="shop-no-matches">
              No matches for “{committed.state.q}” in {shopName(sellerName)}.
            </p>
            {hasActiveShopFilters(committed.state) ? <p className="mt-1 text-muted">With the current filters applied.</p> : null}
            {suggestion ? (
              <p className="mt-2 text-muted" data-testid="shop-did-you-mean">
                Did you mean{" "}
                <Link href={shopBrowseHref(basePath, { ...committed.state, q: suggestion })} scroll={false}>
                  {suggestion}
                </Link>
                ?
              </p>
            ) : null}
          </>
        ) : (
          <p className={`mt-3${touched ? " listing-swap" : ""}`} data-testid="shop-zero-combination">
            No listings in {shopName(sellerName)} match those filters.
          </p>
        )}
      </div>
      {committed.total > 0 ? (
        <Pagination
          basePath={basePath}
          page={committed.page}
          totalPages={pages}
          extra={shopFilterParams(committed.state)}
          label={`${sellerName} listing pages`}
        />
      ) : null}
    </>
  );
}
