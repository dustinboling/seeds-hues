/**
 * The shop catalog block, interactive part (seller-as-shop) — ported from
 * v2/components/seller/ShopBrowse.tsx (same heading, search field, filter
 * strips with per-option counts, sort control, applied row, count line,
 * all-sold-out notice, results grid or designed states, pagination; plain
 * anchors instead of next/link): the "{name}'s shop" heading, the in-shop
 * search field, the filter strips with per-option counts, the sort
 * control, the applied row with removers + Clear All, the count line (a
 * persistent live region), the all-sold-out notice, the results grid (or
 * a designed state), and pagination.
 *
 * Rendered by the server page with the initial shop snapshot; first paint
 * is server-rendered and server-correct for every shop URL (links with
 * `aria-current`, the GET search form, counts, the applied row, the count
 * line), so the shop works with JS disabled or before hydration. After
 * hydration every filter/search/sort change applies IN PLACE through
 * Vike's client router — one navigation per deliberate change, no
 * document reload, no scroll, no page-view beacon — and no search-log
 * entry for in-shop searches. The URL stays shareable. Pagination stays
 * true navigation unless hydrated (then intercepted in place). The commit
 * discipline is the shared `useInPlaceNav` hook; this file owns only the
 * shop's rendering.
 *
 * Recorded platform delta: the shop search commits on the deliberate acts
 * (submit, blur with a changed query, clearing via the applied row) — v2
 * also narrows while typing via replaceState, which Vike's push-only
 * navigate cannot mirror without spamming history.
 */
import { useState } from "react";
import { SearchIcon } from "../icons";
import { ShopVarietyGrid } from "../variety/VarietyCard";
import { AppliedRow } from "../browse/AppliedRow";
import { SwatchDot } from "../browse/BrowseFilters";
import { FilterStrip } from "../browse/FilterStrip";
import { useInPlaceNav, type InPlaceNav, type NavigateFn } from "../browse/InPlaceNav";
import { Pagination } from "../browse/Pagination";
import { SortChips } from "../browse/SortChips";
import type { BrowseSortParam, ColorFamily } from "../../lib/browse";
import { plural } from "../../lib/format";
import { totalPages } from "../../lib/paging";
import { SELLER_NO_LISTINGS } from "../../lib/zero-seller";
import type { ApiPublicListing } from "../../data/types";
import {
  SHOP_BROWSE_OPTIONS,
  SHOP_CROP_LEGEND,
  SHOP_SORT_OPTIONS,
  clearShopAll,
  equalShopBrowseFilters,
  hasActiveShopFilters,
  hasActiveShopState,
  isShopOptionActive,
  parseShopQueryParam,
  shopBrowseFiltersFromSearch,
  shopBrowseHref,
  shopCountFor,
  shopCountLine,
  shopCountStateFor,
  shopCropOptions,
  shopCropsFor,
  shopDidYouMean,
  shopDocumentTitle,
  shopFilterParams,
  shopGroupsFor,
  shopHasFilters,
  shopHasSearch,
  shopIsAllSoldOut,
  shopName,
  shopRemoversFor,
  type ShopBrowseState,
  type ShopCounts,
  type ShopCrop,
  type ShopFilterGroup,
  type ShopSortParam,
} from "../../lib/shop-browse";

/** The in-place failure line — a contract backstop here. */
const FAILURE_MESSAGE = "That didn’t apply — you’re still seeing the previous results. Try again.";

/** The server-rendered shop snapshot this block hydrates from. */
export interface ShopBrowseInitial {
  state: ShopBrowseState;
  counts: ShopCounts;
  items: ApiPublicListing[];
  total: number;
  page: number;
}

/**
 * The per-option count inside a shop chip — the BrowseFilters count dress
 * with the shop's screen-reader unit ("listings"): sighted readers see
 * the parenthesized numeral; assistive tech gets the numeral plus the
 * unit.
 */
function ShopChipCount({ counts, group, value }: { counts: ShopCounts; group: ShopFilterGroup; value: string | null }) {
  const n = shopCountFor(counts, group, value);
  return (
    <span className="browse-chip-count">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">{n} listings</span>
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
 * The shop's filter strips: server links with `aria-current` before
 * hydration, toggle buttons with `aria-pressed` after (stable keys, no
 * remounts, focus stays on the tapped chip; pressed follows the
 * optimistic state, counts the committed one). Crop chips are plain text
 * (Hue alone carries swatch dots); every chip carries its locally
 * computed count — a 0 renders and stays operable.
 */
function ShopFilters({
  basePath,
  groups,
  shopCrops,
  browse,
  snapshot,
}: {
  basePath: string;
  groups: ShopFilterGroup[];
  shopCrops: ShopCrop[];
  browse: InPlaceNav<ShopBrowseState>;
  snapshot: ShopBrowseInitial;
}) {
  const { hydrated, shown, select } = browse;
  const committed = snapshot;
  const strips = groups.map((g) => (
    <fieldset key={g} className="browse-filter-group">
      <legend className="eyebrow">{shopLegend(g)}</legend>
      <FilterStrip legend={shopLegend(g)}>
        {shopOptions(g, shopCrops).map((o) =>
          hydrated ? (
            <li key={o.value ?? "all"} className="browse-chip-item">
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
            <li key={o.value ?? "all"} className="browse-chip-item">
              <a
                href={shopBrowseHref(basePath, shopCountStateFor(committed.state, g, o.value))}
                className="chip-filter"
                aria-current={isShopOptionActive(committed.state, g, o.value) ? "true" : undefined}
                data-filter={g}
                data-vike="false"
              >
                {o.hue ? <SwatchDot family={o.hue} /> : null}
                {o.label} <ShopChipCount counts={committed.counts} group={g} value={o.value} />
              </a>
            </li>
          ),
        )}
      </FilterStrip>
    </fieldset>
  ));
  return hydrated ? (
    <div role="group" aria-label="Filters" className="browse-filters">
      {strips}
    </div>
  ) : (
    <nav aria-label="Filters" className="browse-filters">
      {strips}
    </nav>
  );
}

/**
 * The in-shop search field: a plain GET form — NOT the SearchBox combobox;
 * no autocomplete panel. The visible label names the scope in the
 * seller's name and is the field's programmatic label; the placeholder
 * exemplifies only what the matcher matches (never Latin names, never
 * aliases).
 *
 * After hydration the deliberate act (submit, blur with a changed query,
 * clearing via the applied row) commits in place through the shared
 * navigation — focus never leaves the field on submit.
 */
function ShopSearch({
  basePath,
  sellerName,
  browse,
  snapshot,
}: {
  basePath: string;
  sellerName: string;
  browse: InPlaceNav<ShopBrowseState>;
  snapshot: ShopBrowseInitial;
}) {
  const { hydrated, select } = browse;
  const committed = snapshot;
  const [value, setValue] = useState(committed.state.q);
  // External resync (popstate, soft-navigation adoption, row-driven
  // clears): when the committed query changes to something the field's
  // own content did not produce, the field re-syncs to it.
  const [lastQ, setLastQ] = useState(committed.state.q);
  if (lastQ !== committed.state.q) {
    setLastQ(committed.state.q);
    if (committed.state.q !== parseShopQueryParam(value)) {
      setValue(committed.state.q);
    }
  }
  const commitDeliberate = () => {
    const eff = parseShopQueryParam(value);
    select((s) => (s.q === eff ? s : { ...s, q: eff }));
  };
  // The no-JS floor carries the active filters/sort through hidden inputs
  // (page dropped) — submitting searches within the filtered, sorted view.
  const carried = shopFilterParams(committed.state);
  delete carried.q;
  return (
    <div className="shop-search">
      <form
        role="search"
        action={basePath}
        method="get"
        onSubmit={
          hydrated
            ? (e) => {
                e.preventDefault();
                commitDeliberate();
              }
            : undefined
        }
      >
        <label htmlFor="shop-search" className="eyebrow shop-search-label">
          Search {shopName(sellerName)}
        </label>
        <div className="shop-search-field">
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
            className="shop-search-input"
          />
          <span className="shop-search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <button type="submit" className="btn btn-primary shop-search-submit">
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
  navigateFn,
}: {
  /** Route path of the shop (history entries + popstate ownership). */
  basePath: string;
  sellerName: string;
  /** The seller title the server renders (the in-place title sync shares it). */
  baseTitle: string;
  initial: ShopBrowseInitial;
  /** The seller's COMPLETE listing set — bands, groups, and did-you-mean read this. */
  full: ApiPublicListing[];
  /** The global crop vocabulary (?crop= validity + remover labels). */
  crops: ShopCrop[];
  navigateFn?: NavigateFn;
}) {
  const total = full.length;
  const shopCrops = shopCropsFor(full);
  const groups = shopGroupsFor(full);
  const browseBase = useInPlaceNav<ShopBrowseState>({
    committed: initial.state,
    page: initial.page,
    equalStates: equalShopBrowseFilters,
    hrefFor: (state) => shopBrowseHref(basePath, state),
    parseHref: (href) => {
      const url = new URL(href, "http://localhost");
      return url.pathname === basePath ? shopBrowseFiltersFromSearch(url.search, crops) : null;
    },
    titleFor: (_state, page) => shopDocumentTitle(baseTitle, page),
    navigateFn,
  });
  // The committed snapshot's counts/items/total/page ride beside the
  // nav's committed state (results follow the server snapshot only).
  const { hydrated, pending, pendingCue, shown, select } = browseBase;
  const committed = initial;
  const pages = totalPages(committed.total);
  const showSearch = shopHasSearch(total);
  const showTools = shopHasFilters(total);
  // The sort group follows the committed query (like the count line): its
  // unmounting and the line's ordering-phrase change land in the same
  // update. Absent while a query is active (relevance owns the order) and
  // returns with its prior selection intact when the query clears.
  const showSort = showTools && committed.state.q === "";
  const suggestion = committed.state.q !== "" && committed.total === 0 ? shopDidYouMean(committed.state.q, full) : null;

  return (
    <>
      <h2 id="seller-varieties" tabIndex={-1} className="shop-heading">
        {shopName(sellerName)}
      </h2>
      {showSearch ? <ShopSearch basePath={basePath} sellerName={sellerName} browse={browseBase} snapshot={committed} /> : null}
      {showTools && groups.length > 0 ? (
        <ShopFilters basePath={basePath} groups={groups} shopCrops={shopCrops} browse={browseBase} snapshot={committed} />
      ) : null}
      {showSort ? (
        groups.length > 0 ? (
          <SortChips
            sort={hydrated ? shown.sort : committed.state.sort}
            hrefFor={(sort: BrowseSortParam) => shopBrowseHref(basePath, { ...committed.state, sort: sort as ShopSortParam })}
            onSelect={(sort: BrowseSortParam) => select((s) => (s.sort === sort ? s : { ...s, sort: sort as ShopSortParam }))}
            hydrated={hydrated}
            options={SHOP_SORT_OPTIONS}
          />
        ) : (
          <div className="shop-sort-alone">
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
      <AppliedRow
        browse={browseBase}
        removers={shopRemoversFor(shown, crops)}
        hasActive={hasActiveShopState}
        clearAll={clearShopAll}
        clearAllLabel={shown.q !== "" ? "Clear search and filters" : "Clear all filters"}
        hrefFor={(state) => shopBrowseHref(basePath, state)}
        failureMessage={FAILURE_MESSAGE}
      />
      {/* Persistent live region: text updates, never remounts — exactly one announcement per commit. */}
      {total === 0 ? (
        <p className="shop-count shop-count-empty">{plural(committed.total, "listing")}</p>
      ) : (
        <p id="seller-results-count" className="shop-count" aria-live="polite" aria-atomic="true">
          {shopCountLine(committed.state, committed.total, committed.page, pages)}
        </p>
      )}
      {shopIsAllSoldOut(full) ? (
        <p className="shop-all-sold-out">
          {sellerName} has nothing in stock right now — listings are shown with their last checked dates.
        </p>
      ) : null}
      {/* Pending indication: busy while a change is in flight. Cleared on
          settle — the attribute is absent then, so settled markup is
          byte-identical with or without this line. Past ~200ms in flight
          the region also shows the pending cue. */}
      <div id="shop-results" className={pendingCue ? "shop-results browse-pending" : "shop-results"} aria-busy={pending === null ? undefined : true}>
        {committed.total > 0 ? (
          <ShopVarietyGrid listings={committed.items} className="shop-grid" />
        ) : total === 0 ? (
          <p className="shop-empty">
            {SELLER_NO_LISTINGS} <a href="/variety">Browse all varieties</a>.
          </p>
        ) : committed.state.q !== "" ? (
          <>
            <p className="shop-no-matches" data-testid="shop-no-matches">
              No matches for “{committed.state.q}” in {shopName(sellerName)}.
            </p>
            {hasActiveShopFilters(committed.state) ? <p className="shop-no-matches-filters">With the current filters applied.</p> : null}
            {suggestion ? (
              <p className="shop-did-you-mean" data-testid="shop-did-you-mean">
                Did you mean{" "}
                <a href={shopBrowseHref(basePath, { ...committed.state, q: suggestion })} data-vike="false">
                  {suggestion}
                </a>
                ?
              </p>
            ) : null}
          </>
        ) : (
          <p className="shop-zero-combination" data-testid="shop-zero-combination">
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
          onNavigate={hydrated ? browseBase.onAnchorNavigate : undefined}
        />
      ) : null}
    </>
  );
}
