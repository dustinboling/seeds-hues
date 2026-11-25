import { aliasLabel, type VarietyStatusLine } from "../../lib/admin/varieties";
import { formatAdminDate } from "../../lib/admin/auth";
import { useAdminViewport } from "./viewport";
import { StatusBanner } from "./Banner";
import { AliasAddForm, VarietyRemoveForm } from "./VarietyForms";

/**
 * Varieties section (spec §7 F1–F3) — ported from v2's varieties page +
 * variety-detail: the working list + variety detail with the segmented
 * Varieties | Crops head, master–detail on iPad/desktop, list screen on
 * phones. Both roles read; admins add/remove aliases and remove
 * varieties. RA-1: decision aliases render with no remove control.
 * Prop-driven: the page container fetches client-side.
 */
export interface VarietyRow {
  slug: string;
  name: string;
  crop: string;
  cropCommon: string;
  sellers: number;
  aliases: number;
  matchedAlias: string | null;
}

export interface VarietyDetailData {
  slug: string;
  name: string;
  crop: string;
  cropCommon: string;
  liveListingCount: number;
  listingCounts: { word: string; n: number }[];
  listingTotal: number;
  waiters: number;
  aliases: { alias: string; source: string; decidedByName: string | null; createdAt: string | null }[];
}

export function VarietiesView({
  rows,
  total,
  selected,
  detail,
  role,
  status,
  onDone,
}: {
  rows: VarietyRow[];
  total: number;
  selected: string | null;
  detail: VarietyDetailData | null;
  role: string;
  status?: VarietyStatusLine | null;
  onDone?: (r: { redirect: string }) => void;
}) {
  const { band } = useAdminViewport();
  const phone = band === "phone";
  const done = onDone ?? (() => {});
  const isAdmin = role === "admin";
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">Varieties</h1>
      <div role="group" aria-label="Varieties section" className="admin-row">
        <a href="/admin/varieties" aria-current="true" className="admin-chip">
          Varieties
        </a>
        <a href="/admin/varieties?tab=crops" className="admin-chip">
          Crops
        </a>
      </div>
      <div className={phone ? "admin-stack" : "admin-master-detail"}>
        {!(phone && selected) ? (
          <div className="admin-list-pane">
            <form method="get" action="/admin/varieties" role="search" className="admin-stack">
              <input id="variety-search" name="q" type="search" maxLength={120} autoComplete="off" placeholder="Variety or another name" className="field" />
            </form>
            <p className="admin-muted-line">
              {total} {total === 1 ? "variety" : "varieties"}
            </p>
            <ol className="admin-stack">
              {rows.map((r) => (
                <li key={r.slug}>
                  <a href={`/admin/varieties?variety=${r.slug}`} aria-current={selected === r.slug ? "true" : undefined} className="admin-row-link">
                    <span className="admin-row-name">{r.name}</span>
                    <span className="admin-row-facts">
                      {r.sellers} {r.sellers === 1 ? "seller" : "sellers"} · {r.aliases} {r.aliases === 1 ? "other name" : "other names"}
                    </span>
                    {r.matchedAlias ? <span className="admin-row-source">Matched another name: &lsquo;{r.matchedAlias}&rsquo;</span> : null}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {!(phone && !selected) ? (
          <section aria-label="Variety detail" id="detail" className="admin-detail-pane">
            {status ? <StatusBanner status={status} /> : null}
            {!detail ? (
              <div className="card admin-panel-card">
                <div aria-hidden="true" className="divider-stem" />
                <p className="admin-prose-lg">{rows.length === 0 ? "No varieties match these filters." : "Select a variety to inspect it."}</p>
              </div>
            ) : (
              <div className="admin-stack">
                <header className="admin-stack-sm">
                  <h2 id="detail-title" className="admin-title-lg">
                    {detail.name}
                  </h2>
                  <p className="admin-muted-line">{detail.cropCommon}</p>
                </header>
                <section aria-label="Listings summary" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Listings</h3>
                  {detail.listingCounts.length === 0 ? (
                    <p className="admin-prose-muted">No listings yet.</p>
                  ) : (
                    <ul className="admin-plain-list">
                      {detail.listingCounts.map((c) => (
                        <li key={c.word} className="admin-plain-row">
                          {c.word}: {c.n}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="admin-prose">
                    <a href={`/admin/listings?variety=${detail.slug}`} className="admin-link-strong">
                      See all in Listings
                    </a>
                  </p>
                </section>
                <section aria-label="Waitlist" className="card admin-panel-card">
                  <h3 className="admin-panel-title">Waitlist</h3>
                  <p className="admin-prose">
                    <a href="/admin/statistics?signal=waitlist" className="admin-link-strong">
                      {detail.waiters} {detail.waiters === 1 ? "waiter" : "waiters"}
                    </a>
                  </p>
                </section>
                <section aria-label="Other names" className="card admin-panel-card">
                  <div className="admin-section-head">
                    <h3 className="admin-panel-title">Other names</h3>
                    {isAdmin ? <AliasAddForm variety={detail.slug} onDone={done} /> : null}
                  </div>
                  {detail.aliases.length === 0 ? (
                    <p className="admin-prose-muted">No other names yet.</p>
                  ) : (
                    <ul className="admin-plain-list">
                      {detail.aliases.map((a) => (
                        <li key={a.alias} className="admin-plain-row">
                          <span className="admin-strong">{a.alias}</span>
                          <span className="admin-muted-line"> · {aliasLabel({ source: a.source, decidedByName: a.decidedByName }, a.createdAt ? formatAdminDate(a.createdAt) : null)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {isAdmin ? (
                  <section aria-labelledby="danger-heading" className="admin-danger-zone">
                    <h3 id="danger-heading" className="admin-heading">
                      Danger zone
                    </h3>
                    <VarietyRemoveForm variety={detail.slug} varietyName={detail.name} liveListings={detail.liveListingCount} onDone={done} />
                  </section>
                ) : null}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function CropsView({ rows }: { rows: { slug: string; commonName: string; varietyCount: number }[] }) {
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">Varieties</h1>
      <div role="group" aria-label="Varieties section" className="admin-row">
        <a href="/admin/varieties" className="admin-chip">
          Varieties
        </a>
        <a href="/admin/varieties?tab=crops" aria-current="true" className="admin-chip">
          Crops
        </a>
      </div>
      <ol className="admin-stack">
        {rows.map((c) => (
          <li key={c.slug}>
            <a href={`/admin/varieties?crop=${c.slug}`} className="admin-row-link">
              <span className="admin-row-name">{c.commonName}</span>
              <span className="admin-row-facts">
                {c.varietyCount} {c.varietyCount === 1 ? "variety" : "varieties"}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
