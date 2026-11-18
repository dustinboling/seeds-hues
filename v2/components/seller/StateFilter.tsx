import Link from "next/link";
import { StateShape } from "@/components/seller/StateShape";
import type { SellerState } from "@/lib/validators";

/** /seller?state= link for a chip (null = all states). ?page= is never carried. */
export function stateFilterHref(basePath: string, code: string | null): string {
  return code ? `${basePath}?state=${encodeURIComponent(code)}` : basePath;
}

/**
 * State filter for the seller index (links only, no client JS), in the BrowseFilters chip style:
 * single-select, "All states" clears it, the active chip carries aria-current="true". Each chip
 * pairs the state outline (decorative) with the state name and its seller count as text.
 * Options are only the states that have sellers (catalog.listSellerStates()).
 */
export function StateFilter({ basePath, states, active }: { basePath: string; states: SellerState[]; active: string | null }) {
  const total = states.reduce((n, s) => n + s.sellerCount, 0);
  return (
    <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
      <fieldset className="min-w-0">
        <legend className="eyebrow mb-1">State</legend>
        <ul className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href={stateFilterHref(basePath, null)}
              className={`chip tap ${active === null ? "font-semibold" : ""}`}
              aria-current={active === null ? "true" : undefined}
              data-filter="state"
            >
              All states
              <span className="ml-1.5 text-muted">
                {total}
                <span className="sr-only"> sellers</span>
              </span>
            </Link>
          </li>
          {states.map((s) => {
            const on = s.code === active;
            return (
              <li key={s.code}>
                <Link
                  href={stateFilterHref(basePath, s.code)}
                  className={`chip tap gap-1.5 ${on ? "font-semibold" : ""}`}
                  aria-current={on ? "true" : undefined}
                  data-filter="state"
                  data-state={s.code}
                >
                  <StateShape region={s.code} size={18} />
                  {s.name}
                  <span className="text-muted">
                    {s.sellerCount}
                    <span className="sr-only"> {s.sellerCount === 1 ? "seller" : "sellers"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </nav>
  );
}
