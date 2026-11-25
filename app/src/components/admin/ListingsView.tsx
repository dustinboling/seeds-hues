import { formatAdminDate } from "../../lib/admin/auth";
import { listingEventLine, type ListingStatusLine } from "../../lib/admin/listings";
import { useAdminViewport } from "./viewport";
import { StatusBanner } from "./Banner";
import { RestoreForm, RetireForm } from "./ListingForms";

/**
 * Listings section (spec §7 E1–E2) — ported from v2's listings page +
 * listing-detail: the working list + listing detail, master–detail on
 * iPad/desktop, list screen on phones. Both roles read; admins retire
 * and restore. Packet sizes show as label + seed count — prices NEVER
 * render anywhere. Prop-driven: the page container fetches client-side.
 */
export interface ListingRow {
  id: number;
  title: string;
  varietyName: string;
  varietySlug: string;
  sellerName: string;
  sellerSlug: string;
  status: string;
  lastCheckedAt: string | null;
}

export interface ListingDetailData {
  id: number;
  title: string;
  varietyName: string;
  varietySlug: string;
  sellerName: string;
  sellerSlug: string;
  productUrl: string | null;
  status: string;
  packets: { label: string; seedCount: number }[];
  lastCheckedAt: string | null;
  history: { event: string; at: string; actor: string | null; reason: string | null; words: string }[];
}

function statusWord(status: string): string {
  if (status === "removed") return "Retired";
  return status ? status[0]!.toUpperCase() + status.slice(1) : "Unknown";
}

export function ListingsView({
  rows,
  total,
  selected,
  detail,
  role,
  status,
  onDone,
}: {
  rows: ListingRow[];
  total: number;
  selected: number | null;
  detail: ListingDetailData | null;
  role: string;
  status?: ListingStatusLine | null;
  onDone?: (r: { redirect: string }) => void;
}) {
  const { band } = useAdminViewport();
  const phone = band === "phone";
  const done = onDone ?? (() => {});
  const isAdmin = role === "admin";
  const retired = detail?.status === "removed";
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">Listings</h1>
      <div className={phone ? "admin-stack" : "admin-master-detail"}>
        {!(phone && selected) ? (
          <div className="admin-list-pane">
            <form method="get" action="/admin/listings" role="search" className="admin-stack">
              <input id="listing-search" name="q" type="search" maxLength={120} autoComplete="off" placeholder="Product title, variety, or seller" className="field" />
            </form>
            <p className="admin-muted-line">
              {total} {total === 1 ? "listing" : "listings"}
            </p>
            <ol className="admin-stack">
              {rows.map((r) => (
                <li key={r.id}>
                  <a href={`/admin/listings?listing=${r.id}`} aria-current={selected === r.id ? "true" : undefined} className="admin-row-link">
                    <span className="admin-row-name">{r.title}</span>
                    <span className="admin-row-facts">
                      {r.varietyName} · {r.sellerName} · {statusWord(r.status)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {!(phone && !selected) ? (
          <section aria-label="Listing detail" id="detail" className="admin-detail-pane">
            {status ? <StatusBanner status={status} /> : null}
            {!detail ? (
              <div className="card admin-panel-card">
                <div aria-hidden="true" className="divider-stem" />
                <p className="admin-prose-lg">{rows.length === 0 ? "No listings match these filters." : "Select a listing to inspect it."}</p>
              </div>
            ) : (
              <div className="admin-stack">
                <header className="admin-stack-sm">
                  <h2 id="detail-title" className="admin-title-lg">
                    {detail.title}
                  </h2>
                  <p className="admin-muted-line">
                    {statusWord(detail.status)} · {detail.lastCheckedAt ? `Checked ${formatAdminDate(detail.lastCheckedAt)}` : "Not checked yet"}
                  </p>
                </header>
                {detail.productUrl ? (
                  <p className="admin-prose">
                    <a href={detail.productUrl} target="_blank" rel="noreferrer" className="admin-link">
                      Open the product page
                    </a>
                  </p>
                ) : null}
                <section aria-label="Packet sizes" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Packet sizes</h3>
                  {detail.packets.length === 0 ? (
                    <p className="admin-prose-muted">No packet sizes on record.</p>
                  ) : (
                    <ul className="admin-plain-list">
                      {detail.packets.map((p, i) => (
                        <li key={i} className="admin-plain-row">
                          {p.label} ({p.seedCount} seeds)
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-label="History" className="card admin-panel-card">
                  <h3 className="admin-panel-title">History</h3>
                  {detail.history.length === 0 ? (
                    <p className="admin-prose-muted">No history yet.</p>
                  ) : (
                    <ol className="admin-plain-list">
                      {detail.history.map((h, i) => (
                        <li key={i} className="admin-plain-row">
                          {listingEventLine({ event: h.event, reason: h.reason, actor: h.actor }, formatAdminDate(h.at, h.at))}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                {isAdmin ? (
                  <div className="admin-decision-bar">{retired ? <RestoreForm listing={detail.id} onDone={done} /> : <RetireForm listing={detail.id} varietyName={detail.varietyName} onDone={done} />}</div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
