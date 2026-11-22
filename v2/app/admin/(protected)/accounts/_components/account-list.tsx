/**
 * The G1 account list column: search field (a field, not a form — name, display name,
 * or email), the count line, and the windowed rows (name, email, joined date, flag
 * chips). Rows are links with aria-current — the list works with JS disabled. Admin
 * only: reviewers never reach this list (the page renders NoAccess for them).
 */
import { formatAdminDate } from "@/lib/admin-auth";
import { shownName } from "@/lib/admin/accounts";
import { accountHref } from "./urls";

export interface AccountListRow {
  id: number;
  name: string;
  displayName: string | null;
  email: string;
  createdAt: string;
  role: string;
  isFarmOwner: boolean;
}

export interface AccountListParams {
  q: string | null;
  show: number;
}

export function AccountList({ rows, total, params, selected }: { rows: AccountListRow[]; total: number; params: AccountListParams; selected: number | null }) {
  const { q, show } = params;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form method="get" action="/admin/accounts" role="search" className="flex flex-col gap-2">
        {selected ? <input type="hidden" name="account" value={selected} /> : null}
        <label htmlFor="account-search" className="font-sans text-sm font-semibold">
          Search accounts
        </label>
        <div className="flex gap-2">
          <input id="account-search" name="q" type="search" defaultValue={q ?? ""} maxLength={120} autoComplete="off" placeholder="Name or email" className="field min-h-target w-full" />
          <button type="submit" className="btn btn-secondary shrink-0">
            Search
          </button>
        </div>
      </form>

      <p className="font-sans text-sm tabular-nums text-muted" aria-live="polite">
        {total === 1 ? "1 account" : `${total.toLocaleString("en-US")} accounts`}
      </p>

      {rows.length === 0 ? (
        q ? (
          <div className="card p-4">
            <p className="font-serif text-[17px] leading-[1.6]">No accounts match &apos;{q}&apos;.</p>
            <p className="mt-3">
              <a href={accountHref({ account: selected })} className="btn btn-secondary">
                Clear search
              </a>
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No accounts yet.</p>
        )
      ) : (
        <>
          <ol className="flex min-w-0 flex-col">
            {rows.map((r) => {
              const current = r.id === selected;
              return (
                <li key={r.id}>
                  <a
                    href={`${accountHref({ account: r.id, q, show })}#detail`}
                    aria-current={current ? "true" : undefined}
                    className={`block rounded-control border-b border-line px-3 py-3 font-sans last:border-b-0 ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                  >
                    <span className="block text-base font-semibold">{shownName(r)}</span>
                    <span className="mt-0.5 block break-all text-sm text-ink-soft">{r.email}</span>
                    <span className="mt-0.5 block text-sm tabular-nums text-muted">Joined {formatAdminDate(r.createdAt)}</span>
                    {r.role === "admin" || r.role === "reviewer" || r.isFarmOwner ? (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.role === "admin" ? <span className="chip-tag">Admin</span> : null}
                        {r.role === "reviewer" ? <span className="chip-tag">Reviewer</span> : null}
                        {r.isFarmOwner ? <span className="chip-tag">Farm owner</span> : null}
                      </span>
                    ) : null}
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
              <a href={accountHref({ account: selected, q, show: show + 50 })} className="btn btn-secondary">
                Show more
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
