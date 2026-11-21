/**
 * The E1 listing list column: search field (a field, not a form), the All / Active /
 * Sold out / Retired chips, the removable deep-link chips (Seller / Variety), the count
 * line, and the windowed rows. Chips and rows are links with aria-current — the list
 * works with JS disabled.
 */
import { formatAdminDate } from "@/lib/admin-auth";
import { statusWordForListing, type ListingChip } from "@/lib/admin/listings";
import { listingHref } from "./urls";

export interface ListingListRow {
  id: number;
  titleRaw: string | null;
  status: string;
  availability: string | null;
  lastCheckedAt: string | null;
  deletedAt: string | null;
  varietySlug: string;
  varietyName: string;
  sellerSlug: string;
  sellerName: string;
  sellerEligibility: string;
  sellerStatus: string;
  sellerListingPolicy: string;
  sellerDeletedAt: string | null;
}

export interface ListingListParams {
  q: string | null;
  chip: ListingChip;
  seller: string | null;
  variety: string | null;
  show: number;
}

export interface ListingDeepLinks {
  seller: { slug: string; name: string } | null;
  variety: { slug: string; name: string } | null;
}

function chipClass(active: boolean): string {
  return `chip tap flex min-h-[44px] items-center ${active ? "font-semibold" : ""}`;
}

const CHIPS: { key: ListingChip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "sold_out", label: "Sold out" },
  { key: "retired", label: "Retired" },
];

export function ListingList({ rows, total, params, selected, deepLinks }: { rows: ListingListRow[]; total: number; params: ListingListParams; selected: number | null; deepLinks: ListingDeepLinks }) {
  const { q, chip, seller, variety, show } = params;
  const base = { listing: selected, q, chip, seller, variety, show };
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form method="get" action="/admin/listings" role="search" className="flex flex-col gap-2">
        {selected ? <input type="hidden" name="listing" value={selected} /> : null}
        {chip !== "all" ? <input type="hidden" name="chip" value={chip} /> : null}
        {seller ? <input type="hidden" name="seller" value={seller} /> : null}
        {variety ? <input type="hidden" name="variety" value={variety} /> : null}
        <label htmlFor="listing-search" className="font-sans text-sm font-semibold">
          Search listings
        </label>
        <div className="flex gap-2">
          <input id="listing-search" name="q" type="search" defaultValue={q ?? ""} maxLength={120} autoComplete="off" placeholder="Product title, variety, or seller" className="field min-h-[44px] w-full" />
          <button type="submit" className="btn btn-secondary shrink-0">
            Search
          </button>
        </div>
      </form>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <a key={c.key} href={listingHref({ ...base, chip: c.key })} aria-current={chip === c.key ? "true" : undefined} className={chipClass(chip === c.key)}>
            {c.label}
          </a>
        ))}
      </div>

      {seller || variety ? (
        <div className="flex flex-wrap gap-2" aria-label="Deep-link filters">
          {seller ? (
            <a href={listingHref({ ...base, seller: null })} className="chip tap flex min-h-[44px] items-center" aria-label={`Remove the seller filter, Seller: ${deepLinks.seller?.name ?? seller}`}>
              Seller: {deepLinks.seller?.name ?? seller} <span aria-hidden="true" className="ml-1 font-semibold">×</span>
            </a>
          ) : null}
          {variety ? (
            <a href={listingHref({ ...base, variety: null })} className="chip tap flex min-h-[44px] items-center" aria-label={`Remove the variety filter, Variety: ${deepLinks.variety?.name ?? variety}`}>
              Variety: {deepLinks.variety?.name ?? variety} <span aria-hidden="true" className="ml-1 font-semibold">×</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="font-sans text-sm tabular-nums text-muted" aria-live="polite">
        {total === 1 ? "1 listing" : `${total.toLocaleString("en-US")} listings`}
      </p>

      {rows.length === 0 ? (
        q || seller || variety || chip !== "all" ? (
          <div className="card p-4">
            <p className="font-serif text-[17px] leading-[1.6]">{q ? <>No listings match &apos;{q}&apos;.</> : "No listings match these filters."}</p>
            <p className="mt-3">
              <a href={listingHref({ listing: selected })} className="btn btn-secondary">
                Clear search
              </a>
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No listings in the directory yet.</p>
        )
      ) : (
        <>
          <ol className="flex min-w-0 flex-col">
            {rows.map((r) => {
              const current = r.id === selected;
              const checked = r.lastCheckedAt ? formatAdminDate(r.lastCheckedAt) : null;
              return (
                <li key={r.id}>
                  <a
                    href={`${listingHref({ listing: r.id, q, chip, seller, variety, show })}#detail`}
                    aria-current={current ? "true" : undefined}
                    className={`block rounded-[12px] border-b border-line px-3 py-3 font-sans last:border-b-0 ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                  >
                    <span className="block text-base font-semibold">{r.titleRaw || r.varietyName}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">
                      {r.varietyName} · {r.sellerName}
                    </span>
                    <span className="mt-0.5 block text-sm tabular-nums text-muted">
                      {statusWordForListing(r)} · {checked ? `Checked ${checked}` : "Not checked yet"}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="font-sans text-[13px] tabular-nums text-muted">
            Showing {rows.length} of {total.toLocaleString("en-US")}
          </p>
          {rows.length < total ? (
            <p>
              <a href={listingHref({ ...base, show: show + 50 })} className="btn btn-secondary">
                Show more
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
