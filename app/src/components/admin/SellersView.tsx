import { formatAdminDateTime } from "../../lib/admin/auth";
import { isPubliclyListed, platformLabel, roleLabel, shipsToWords, statusWordFor, type SellerStatusLine } from "../../lib/admin/sellers";
import { useAdminViewport } from "./viewport";
import { StatusBanner } from "./Banner";
import { ClassifyButton, DeactivateButton, EditSellerButton, NoteComposer, ReactivateForm, RemoveSellerButton, type SellerEditDefaults } from "./SellerForms";

/**
 * Sellers section (spec §7 D1–D5) — ported from v2's sellers page +
 * seller-detail: the working list + seller detail, master–detail on
 * iPad/desktop, list screen on phones. One screen, both roles — the
 * reviewer sees the identical layout with actions absent. Internal
 * notes are admin-only (both roles read/add), never public.
 * Prop-driven: the page container fetches list + detail client-side.
 */
export interface SellerRow {
  slug: string;
  name: string;
  location: string | null;
  region: string | null;
  isSmallFarm: boolean;
  status: string;
  eligibility: string;
  listings: number;
}

export interface SellerDetailData {
  slug: string;
  name: string;
  type: string;
  platform: string | null;
  homepage: string | null;
  contactEmail: string | null;
  csPhone: string | null;
  csEmail: string | null;
  location: string | null;
  locations: { kind: string; label: string; primary: boolean }[];
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
  status: string;
  eligibility: string;
  listingPolicy: string;
  deletedAt?: string | null;
  isSmallFarm: boolean;
  liveListingCount: number;
  listings: { id: number; titleRaw: string | null; status: string; varietyName: string; varietySlug: string }[];
  notes: { id: number; authorName: string; authorRole: string; body: string; createdAt: string }[];
}

function listingStatusWord(status: string): string {
  return status ? status[0]!.toUpperCase() + status.slice(1) : "Unknown";
}

export function SellersView({
  rows,
  total,
  selected,
  detail,
  role,
  status,
  onDone,
}: {
  rows: SellerRow[];
  total: number;
  selected: string | null;
  detail: SellerDetailData | null;
  role: string;
  status?: SellerStatusLine | null;
  onDone?: (r: { redirect: string }) => void;
}) {
  const { band } = useAdminViewport();
  const phone = band === "phone";
  const done = onDone ?? (() => {});
  const isAdmin = role === "admin";
  const listed = detail ? isPubliclyListed({ eligibility: detail.eligibility, status: detail.status, listingPolicy: detail.listingPolicy, deletedAt: detail.deletedAt ?? null }) : false;
  const editDefaults: SellerEditDefaults | null = detail
    ? { seller: detail.slug, name: detail.name, type: detail.type, platform: detail.platform, homepage: detail.homepage, contactEmail: detail.contactEmail, location: detail.location, region: detail.region, country: detail.country, shipsTo: detail.shipsTo, description: detail.description, orderingNotes: detail.orderingNotes }
    : null;
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">Sellers</h1>
      <div className={phone ? "admin-stack" : "admin-master-detail"}>
        {!(phone && selected) ? (
          <div className="admin-list-pane">
            <form method="get" action="/admin/sellers" role="search" className="admin-stack">
              <input id="seller-search" name="q" type="search" maxLength={120} autoComplete="off" placeholder="Seller name" className="field" />
            </form>
            <p className="admin-muted-line">
              {total} {total === 1 ? "seller" : "sellers"}
            </p>
            <ol className="admin-stack">
              {rows.map((r) => (
                <li key={r.slug}>
                  <a href={`/admin/sellers?seller=${r.slug}`} aria-current={selected === r.slug ? "true" : undefined} className="admin-row-link">
                    <span className="admin-row-name">{r.name}</span>
                    <span className="admin-row-facts">
                      {[r.location, r.isSmallFarm ? "Small farm" : null].filter(Boolean).join(" · ")}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {!(phone && !selected) ? (
          <section aria-label="Seller detail" id="detail" className="admin-detail-pane">
            {status ? <StatusBanner status={status} /> : null}
            {!detail ? (
              <div className="card admin-panel-card">
                <div aria-hidden="true" className="divider-stem" />
                <p className="admin-prose-lg">{rows.length === 0 ? "No sellers in the directory yet." : "Select a seller to inspect them."}</p>
              </div>
            ) : (
              <div className="admin-stack">
                {detail.status === "inactive" ? (
                  <div role="status" className="admin-warn-card">
                    <p className="admin-prose">This seller is deactivated — their page and listings are hidden from the public site.</p>
                    {isAdmin ? <ReactivateForm seller={detail.slug} onDone={done} /> : null}
                  </div>
                ) : null}
                <header className="admin-stack-sm">
                  <h2 id="detail-title" className="admin-title-lg">
                    {detail.name}
                  </h2>
                  <p className="admin-seller-line">
                    {detail.isSmallFarm ? <span className="admin-badge">Small Farm</span> : <span className="admin-muted">Not a small farm</span>}
                    <span aria-hidden="true" className="admin-muted">
                      ·
                    </span>
                    <span>{statusWordFor({ eligibility: detail.eligibility, status: detail.status, listingPolicy: detail.listingPolicy, deletedAt: detail.deletedAt ?? null })}</span>
                  </p>
                  {listed ? (
                    <p className="admin-prose">
                      <a href={`/seller/${detail.slug}`} className="admin-link-strong">
                        View public page
                      </a>
                    </p>
                  ) : null}
                </header>
                <section aria-labelledby="info-heading" id="info" className="card admin-panel-card">
                  <div className="admin-section-head">
                    <h3 id="info-heading" className="admin-heading">
                      Information
                    </h3>
                    {isAdmin && editDefaults ? <EditSellerButton defaults={editDefaults} onDone={done} /> : null}
                  </div>
                  <dl className="admin-dl">
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Website</dt>
                      <dd className="admin-dd">{detail.homepage ? <a href={detail.homepage} rel="noopener noreferrer" target="_blank" className="admin-link">{detail.homepage}</a> : <span className="admin-muted">Not set</span>}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Location</dt>
                      <dd className="admin-dd">{detail.location ?? <span className="admin-muted">Not set</span>}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Region</dt>
                      <dd className="admin-dd">{detail.region ?? <span className="admin-muted">Not set</span>}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Country</dt>
                      <dd className="admin-dd">{detail.country}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Ships to</dt>
                      <dd className="admin-dd">{shipsToWords(detail.shipsTo)}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Contact email</dt>
                      <dd className="admin-dd">{detail.contactEmail ?? <span className="admin-muted">Not set</span>}</dd>
                    </div>
                    {detail.csPhone || detail.csEmail ? (
                      <div className="admin-dl-row">
                        <dt className="admin-dt">Customer service</dt>
                        <dd className="admin-dd">{[detail.csPhone, detail.csEmail].filter(Boolean).join(" · ")}</dd>
                      </div>
                    ) : null}
                    {detail.locations.length > 1 ? (
                      <div className="admin-dl-row">
                        <dt className="admin-dt">Locations</dt>
                        <dd className="admin-dd">
                          <ul className="admin-plain-list">
                            {detail.locations.map((l, i) => (
                              <li key={i}>
                                {l.label} ({l.kind}
                                {l.primary ? ", primary" : ""})
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    ) : null}
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Seller type</dt>
                      <dd className="admin-dd">{detail.type}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Platform</dt>
                      <dd className="admin-dd">{platformLabel(detail.platform)}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Description</dt>
                      <dd className="admin-dd">{detail.description ?? <span className="admin-muted">Not set</span>}</dd>
                    </div>
                    <div className="admin-dl-row">
                      <dt className="admin-dt">Ordering notes</dt>
                      <dd className="admin-dd">{detail.orderingNotes ?? <span className="admin-muted">Not set</span>}</dd>
                    </div>
                  </dl>
                </section>
                <section aria-labelledby="classification-heading" id="classification" className="card admin-panel-card">
                  <div className="admin-section-head">
                    <h3 id="classification-heading" className="admin-heading">
                      Classification
                    </h3>
                    {isAdmin ? <ClassifyButton seller={detail.slug} sellerName={detail.name} isSmallFarm={detail.isSmallFarm} isCandidate={detail.eligibility === "candidate"} onDone={done} /> : null}
                  </div>
                  <p className="admin-prose">{detail.isSmallFarm ? <span className="admin-badge">Small Farm</span> : <span>Not a small farm — no badge is shown.</span>}</p>
                </section>
                <section aria-labelledby="notes-heading" id="notes" className="admin-notes-card">
                  <p className="admin-notes-eyebrow">
                    <span id="notes-heading">Internal notes — never shown on the public site</span>
                  </p>
                  <div className="admin-row">
                    <NoteComposer seller={detail.slug} onDone={done} />
                  </div>
                  {detail.notes.length === 0 ? (
                    <p className="admin-prose-lg">No notes yet. Notes are only visible inside admin — add anything the team should know about this seller.</p>
                  ) : (
                    <ol className="admin-stack">
                      {detail.notes.map((n) => (
                        <li key={n.id} className="admin-note">
                          <p className="admin-prose-lg">{n.body}</p>
                          <p className="admin-muted-line">
                            {n.authorName} · {roleLabel(n.authorRole)} · {formatAdminDateTime(n.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <section aria-labelledby="listings-heading" className="card admin-panel-card">
                  <h3 id="listings-heading" className="admin-heading">
                    Listings
                  </h3>
                  <p className="admin-muted-line">{detail.liveListingCount === 1 ? "1 listing" : `${detail.liveListingCount} listings`}</p>
                  {detail.listings.length === 0 ? (
                    <p className="admin-prose-muted">No listings yet.</p>
                  ) : (
                    <ol className="admin-plain-list">
                      {detail.listings.map((l) => (
                        <li key={l.id} className="admin-plain-row">
                          <a href={`/go/${l.id}`} rel="nofollow noopener noreferrer" className="admin-link-strong">
                            {l.titleRaw || l.varietyName}
                          </a>{" "}
                          <span className="admin-muted-line">on {l.varietyName}</span> <span className="admin-muted-line">· {listingStatusWord(l.status)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="admin-prose">
                    <a href={`/admin/listings?seller=${detail.slug}`} className="admin-link-strong">
                      See all in Listings
                    </a>
                  </p>
                </section>
                {isAdmin ? (
                  <section aria-labelledby="danger-heading" className="admin-danger-zone">
                    <h3 id="danger-heading" className="admin-heading">
                      Danger zone
                    </h3>
                    <div className="admin-row">
                      <DeactivateButton seller={detail.slug} sellerName={detail.name} listingCount={detail.liveListingCount} onDone={done} />
                      <RemoveSellerButton seller={detail.slug} sellerName={detail.name} listingCount={detail.liveListingCount} onDone={done} />
                    </div>
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
