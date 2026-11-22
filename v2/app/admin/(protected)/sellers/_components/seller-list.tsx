/**
 * The D1 seller list column: search field (a field, not a form), two single-select chip
 * groups (classification; listing state), the sort menu, the count line and the rows.
 * Chips and rows are links with aria-current — the list works with JS disabled.
 */
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { statusWordFor, type BadgeFilter, type ListingStateFilter, type SellerSort } from "@/lib/admin/sellers";
import { sellerHref } from "./urls";

export interface SellerListRow {
  slug: string;
  name: string;
  location: string | null;
  status: string;
  eligibility: string;
  listingPolicy: string;
  deletedAt: string | null;
  isSmallFarm: boolean;
  liveListings: number;
}

export interface SellerListParams {
  q: string | null;
  badge: BadgeFilter;
  state: ListingStateFilter;
  sort: SellerSort;
}

const SORT_LABELS: Record<SellerSort, string> = { name: "Name A–Z", listings: "Most listings", updated: "Recently updated" };

export function SellerList({ rows, total, params, selected }: { rows: SellerListRow[]; total: number; params: SellerListParams; selected: string | null }) {
  const { q, badge, state, sort } = params;
  const chip = (label: string, href: string, active: boolean) => (
    <a href={href} aria-current={active ? "true" : undefined} className="chip-filter">
      {label}
    </a>
  );
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form method="get" action="/admin/sellers" role="search" className="flex flex-col gap-2">
        {selected ? <input type="hidden" name="seller" value={selected} /> : null}
        {badge !== "all" ? <input type="hidden" name="badge" value={badge} /> : null}
        {state !== "all" ? <input type="hidden" name="state" value={state} /> : null}
        {sort !== "name" ? <input type="hidden" name="sort" value={sort} /> : null}
        <label htmlFor="seller-search" className="font-sans text-sm font-semibold">
          Search sellers
        </label>
        <div className="flex gap-2">
          <input id="seller-search" name="q" type="search" defaultValue={q ?? ""} maxLength={120} autoComplete="off" placeholder="Seller name" className="field min-h-target w-full" />
          <button type="submit" className="btn btn-secondary shrink-0">
            Search
          </button>
        </div>
      </form>

      <div role="group" aria-label="Filter by classification" className="flex flex-wrap gap-2">
        {chip("All", sellerHref({ seller: selected, q, state, sort }), badge === "all")}
        {chip("Small farm", sellerHref({ seller: selected, q, badge: "small", state, sort }), badge === "small")}
        {chip("Not small farm", sellerHref({ seller: selected, q, badge: "not_small", state, sort }), badge === "not_small")}
      </div>
      <div role="group" aria-label="Filter by listing state" className="flex flex-wrap gap-2">
        {chip("All", sellerHref({ seller: selected, q, badge, sort }), state === "all")}
        {chip("Active", sellerHref({ seller: selected, q, badge, state: "active", sort }), state === "active")}
        {chip("Not active", sellerHref({ seller: selected, q, badge, state: "not_active", sort }), state === "not_active")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-sm tabular-nums text-muted" aria-live="polite">
          {total === 1 ? "1 seller" : `${total} sellers`}
        </p>
        <details className="relative">
          <summary className="btn btn-secondary cursor-pointer">Sort: {SORT_LABELS[sort]}</summary>
          <ul className="absolute right-0 z-30 mt-1 flex min-w-[12rem] flex-col rounded-control border border-line-strong bg-surface p-1 shadow-sheet">
            {(Object.keys(SORT_LABELS) as SellerSort[]).map((key) => (
              <li key={key}>
                <a
                  href={sellerHref({ seller: selected, q, badge, state, sort: key })}
                  aria-current={key === sort ? "true" : undefined}
                  className={`block rounded-inner px-3 py-2.5 font-sans text-[15px] ${key === sort ? "bg-leaf-50 font-semibold" : "hover:bg-paper-deep"}`}
                >
                  {SORT_LABELS[key]}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {rows.length === 0 ? (
        q ? (
          <div className="card p-4">
            <p className="font-serif text-[17px] leading-[1.6]">No sellers match &apos;{q}&apos;.</p>
            <p className="mt-3">
              <a href={sellerHref({ seller: selected, badge, state, sort })} className="btn btn-secondary">
                Clear search
              </a>
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No sellers in the directory yet.</p>
        )
      ) : (
        <ol className="flex min-w-0 flex-col">
          {rows.map((r) => {
            const current = r.slug === selected;
            return (
              <li key={r.slug}>
                <a
                  href={`${sellerHref({ seller: r.slug, q, badge, state, sort })}#detail`}
                  aria-current={current ? "true" : undefined}
                  className={`block rounded-control border-b border-line px-3 py-3 font-sans last:border-b-0 ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold">
                    {r.name}
                    {r.isSmallFarm ? <SmallFarmBadge /> : null}
                  </span>
                  {r.location ? <span className="mt-0.5 block text-sm text-ink-soft">{r.location}</span> : null}
                  <span className="mt-0.5 block text-sm tabular-nums text-muted">
                    {r.liveListings === 1 ? "1 listing" : `${r.liveListings} listings`} · {statusWordFor(r)}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
