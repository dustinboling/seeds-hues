import { accountStatusWord, currentRoleWords, type AccountStatusLine } from "../../lib/admin/accounts";
import { useAdminViewport } from "./viewport";
import { StatusBanner } from "./Banner";
import { NoAccess } from "./NoAccess";
import { FarmOwnerForm, RoleButton } from "./AccountForms";

/**
 * Accounts section (spec §7 G1–G2) — ported from v2's accounts page +
 * account-detail. Admin only: a reviewer lands on the wrong-role state
 * for this section, never on the data. Master–detail on iPad/desktop,
 * list screen on phones. Prop-driven: the page container fetches
 * client-side.
 */
export interface AccountRow {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  isFarmOwner: boolean;
  waitlists: number;
}

export interface AccountDetailData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  isFarmOwner: boolean;
  seller: { slug: string; name: string } | null;
  waitlists: number;
  joinedAt: string;
}

export function AccountsView({
  rows,
  total,
  selected,
  detail,
  role,
  selfId,
  sellerOptions,
  status,
  onDone,
}: {
  rows: AccountRow[];
  total: number;
  selected: number | null;
  detail: AccountDetailData | null;
  role: string;
  selfId?: number;
  sellerOptions?: { slug: string; name: string; location: string | null }[];
  status?: AccountStatusLine | null;
  onDone?: (r: { redirect: string }) => void;
}) {
  const { band } = useAdminViewport();
  const phone = band === "phone";
  const done = onDone ?? (() => {});
  if (role !== "admin") return <NoAccess variant="reviewer-accounts" />;
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">Accounts</h1>
      <div className={phone ? "admin-stack" : "admin-master-detail"}>
        {!(phone && selected) ? (
          <div className="admin-list-pane">
            <form method="get" action="/admin/accounts" role="search" className="admin-stack">
              <input id="account-search" name="q" type="search" maxLength={120} autoComplete="off" placeholder="Name or email" className="field" />
            </form>
            <p className="admin-muted-line">
              {total} {total === 1 ? "account" : "accounts"}
            </p>
            <ol className="admin-stack">
              {rows.map((r) => (
                <li key={r.id}>
                  <a href={`/admin/accounts?account=${r.id}`} aria-current={selected === r.id ? "true" : undefined} className="admin-row-link">
                    <span className="admin-row-name">{r.name || r.email}</span>
                    <span className="admin-row-facts">
                      {currentRoleWords(r.role)} · {accountStatusWord(r.status)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {!(phone && !selected) ? (
          <section aria-label="Account detail" id="detail" className="admin-detail-pane">
            {status ? <StatusBanner status={status} /> : null}
            {!detail ? (
              <div className="card admin-panel-card">
                <div aria-hidden="true" className="divider-stem" />
                <p className="admin-prose-lg">{rows.length === 0 ? "No accounts match these filters." : "Select an account to inspect it."}</p>
              </div>
            ) : (
              <div className="admin-stack">
                <header className="admin-stack-sm">
                  <h2 id="detail-title" className="admin-title-lg">
                    {detail.name || detail.email}
                  </h2>
                  <p className="admin-muted-line">
                    {detail.email} · {currentRoleWords(detail.role)} · {accountStatusWord(detail.status)}
                  </p>
                </header>
                <section aria-label="Role" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Role</h3>
                  <RoleButton account={detail.id} accountName={detail.name || detail.email} current={detail.role} self={detail.id === selfId} onDone={done} />
                </section>
                <section aria-label="Farm owner" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Farm owner</h3>
                  {detail.isFarmOwner && detail.seller ? (
                    <p className="admin-prose">
                      Owner of {detail.seller.name}.
                    </p>
                  ) : (
                    <FarmOwnerForm account={detail.id} accountName={detail.name || detail.email} options={sellerOptions ?? []} onDone={done} />
                  )}
                </section>
                <section aria-label="Waiting lists" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Waiting lists</h3>
                  <p className="admin-prose">
                    {detail.waitlists} {detail.waitlists === 1 ? "list" : "lists"}
                  </p>
                </section>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
