import { Fragment } from "react";
import { formatAdminDate } from "../../lib/admin/auth";
import { CORRECTION_FIELD_LABELS, LISTING_REJECT_REASONS, QUEUES, RETIRE_REASONS, itemRefParam, queueDef, verifiedLine, type ItemRef, type QueueKey, type StatusLine } from "../../lib/admin/review";
import { useAdminViewport } from "./viewport";
import { StatusBanner } from "./Banner";
import { DecideForm, DuplicateDecideForm, ReasonDecideForm } from "./DecideForms";

/**
 * Review section (spec §7 C0–C5) — ported from v2's review page + detail
 * views: the queue workspace with master–detail on iPad/desktop (list
 * column + detail pane) and the stacked list → detail on phones. Queues
 * process oldest-first; decisions post to the session-authorized decide
 * handler. Prop-driven: the page container fetches queue + detail
 * client-side and navigates to the handler's redirect after each
 * decision (the pane advances with its status line).
 */
export interface ReviewRow {
  ref: ItemRef;
  type: string;
  name: string;
  facts: string;
  createdAt: string;
  source: string | null;
}

export interface DecidedRow {
  ref: ItemRef;
  type: string;
  name: string;
  outcome: string;
  decider: string | null;
  at: string;
}

// Loose detail shapes: the stub serves the full hydration; every field
// the pane renders is optional so partial reads degrade to honest gaps.
export interface ReviewDetail extends Record<string, unknown> {
  type: string;
  name?: string;
  createdAt?: string;
  extractedName?: string;
  match?: string;
  listing?: { sellerName?: string; isSmallFarm?: boolean; titleRaw?: string | null; productUrl?: string | null; packets?: { label: string; seedCount: number }[] | string[] } | null;
  variety?: { kind?: string; name?: string; slug?: string; cropCommon?: string; crop?: string; seriesName?: string | null; sellerCount?: number } | null;
  held?: { name?: string; cropCommon?: string; crop?: string | null; sellerName?: string | null; sellerSlug?: string | null; titleRaw?: string | null; productUrl?: string | null } | null;
  existing?: { name?: string; slug?: string; cropCommon?: string; commonName?: string; seriesName?: string | null; latinName?: string | null; sellerCount?: number; aliases?: string[]; listings?: { sellerName?: string; titleRaw?: string | null; productUrl?: string | null }[] } | null;
  stale?: boolean;
  candidateName?: string;
  evidenceQuote?: string | null;
  holdReason?: string | null;
  comparison?: { cropLine?: string; nameLine?: string; sellerLine?: string } | null;
  verifiedBy?: string | null;
  reportType?: string | null;
  message?: string | null;
  targetType?: string;
  targetRef?: string;
  seller?: { name?: string; slug?: string; location?: string | null; region?: string | null; liveListingCount?: number } | null;
  varietyTarget?: { name?: string; slug?: string; commonName?: string } | null;
  fields?: Record<string, string | string[] | null>;
  hasFields?: boolean;
  listingRef?: { id?: number; live?: boolean; titleRaw?: string | null; varietyName?: string; sellerName?: string } | null;
  website?: string | null;
  domain?: string | null;
  farmName?: string;
  contactName?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  growsText?: string;
  varietiesText?: string;
  businessPhone?: string;
  wholesale?: string;
  notes?: string;
  rank?: { rank: number; total: number } | null;
}

function QueueNav({ active, counts }: { active: QueueKey; counts: Record<string, number> }) {
  return (
    <nav aria-label="Queues" className="admin-stack">
      <ul className="admin-stack">
        {QUEUES.map((q) => (
          <li key={q.key}>
            <a href={`/admin/review?queue=${q.key}`} aria-current={q.key === active ? "true" : undefined} className="admin-queue-link">
              {q.name} ({counts[q.key] ?? 0})
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function QueueList({ queue, rows, total, selected, decided, decidedRows, decidedTotal }: { queue: QueueKey; rows: ReviewRow[]; total: number; selected: ItemRef | null; decided: boolean; decidedRows: DecidedRow[]; decidedTotal: number }) {
  return (
    <div className="admin-stack">
      <div role="group" aria-label="List segment" className="admin-row">
        <a href={`/admin/review?queue=${queue}`} aria-current={!decided ? "true" : undefined} className="admin-chip">
          Waiting ({total})
        </a>
        <a href={`/admin/review?queue=${queue}&decided=1`} aria-current={decided ? "true" : undefined} className="admin-chip">
          Decided ({decidedTotal})
        </a>
      </div>
      {decided ? (
        <ol className="admin-stack">
          {decidedRows.map((r) => (
            <li key={`${r.ref.kind}-${r.ref.id}`}>
              <a href={`/admin/review?queue=${queue}&decided=1&item=${itemRefParam(r.ref)}`} aria-current={selected?.kind === r.ref.kind && selected?.id === r.ref.id ? "true" : undefined} className="admin-row-link">
                <span className="admin-row-name">{r.name}</span>
                <span className="admin-row-facts">{r.outcome}</span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="admin-stack">
          {rows.map((r) => (
            <li key={`${r.ref.kind}-${r.ref.id}`}>
              <a href={`/admin/review?queue=${queue}&item=${itemRefParam(r.ref)}`} aria-current={selected?.kind === r.ref.kind && selected?.id === r.ref.id ? "true" : undefined} className="admin-row-link">
                <span className="admin-row-name">{r.name}</span>
                <span className="admin-row-facts">{r.facts}</span>
                {r.source ? <span className="admin-row-source">{r.source}</span> : null}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ListingPane({ detail, role, queue, show, onDone }: { detail: ReviewDetail; role: string; queue: QueueKey; show: string; onDone: (r: { redirect: string }) => void }) {
  void role;
  const isNew = detail.type === "new_variety";
  const varietyName = detail.variety?.name ?? detail.extractedName ?? detail.name ?? "";
  const packets = detail.listing?.packets ?? [];
  const packetWords = packets.map((p) => (typeof p === "string" ? p : `${p.label} (${p.seedCount} seeds)`)).join(" · ");
  const ctx = { queue, show, created_at: String(detail.createdAt ?? ""), variety_name: varietyName };
  return (
    <article aria-labelledby="review-detail-title" className="admin-stack">
      <header>
        <h2 id="review-detail-title" className="admin-title-lg">
          {detail.extractedName ?? detail.name}
        </h2>
        <p className="admin-muted-line">
          {isNew ? "New variety" : "Listing match"} · {formatAdminDate(typeof detail.createdAt === "string" ? detail.createdAt : null)}
        </p>
      </header>
      <section aria-label="The listing" className="card admin-panel-card">
        <h3 className="admin-panel-title">The listing</h3>
        <p className="admin-seller-line">
          <span className="admin-strong">{detail.listing?.sellerName ?? "Unknown seller"}</span>
          {detail.listing?.isSmallFarm ? <span className="admin-badge">Small Farm</span> : null}
        </p>
        {detail.listing?.titleRaw ? <p className="admin-prose">{detail.listing.titleRaw}</p> : null}
        {detail.listing?.productUrl ? (
          <p className="admin-prose">
            <a href={detail.listing.productUrl} target="_blank" rel="noreferrer" className="admin-link">
              Open the product page
            </a>
          </p>
        ) : null}
        {packetWords ? <p className="admin-muted-line">Packet sizes: {packetWords}</p> : null}
      </section>
      <p aria-hidden="true" className="admin-connector">
        matched to
      </p>
      <section aria-label="The variety" className="card admin-panel-card">
        <h3 className="admin-panel-title">The variety</h3>
        {detail.variety?.kind === "existing" ? (
          <Fragment>
            <p className="admin-strong">{detail.variety.name}</p>
            <p className="admin-muted-line">
              {detail.variety.cropCommon}
              {detail.variety.seriesName ? ` · ${detail.variety.seriesName} series` : null} · {detail.variety.sellerCount ?? 0} {(detail.variety.sellerCount ?? 0) === 1 ? "seller" : "sellers"}
            </p>
            {detail.variety.slug ? (
              <p className="admin-prose">
                <a href={`/variety/${detail.variety.slug}`} target="_blank" rel="noreferrer" className="admin-link">
                  Open the public page
                </a>
              </p>
            ) : null}
          </Fragment>
        ) : (
          <Fragment>
            <p className="admin-prose">
              Approving will create <span className="admin-strong">{detail.variety?.name ?? varietyName}</span> ({detail.variety?.crop ?? "unknown"}).
            </p>
            <p className="admin-muted-line">It gets its own public page, with this listing on it.</p>
          </Fragment>
        )}
      </section>
      {detail.match ? <p className="admin-muted-line">Why the machine matched it: {detail.match}</p> : null}
      <div className="admin-decision-bar">
        <p className="admin-prose">Publishing puts this listing on {varietyName}&rsquo;s public page, linking to the seller&rsquo;s product page.</p>
        <div className="admin-row">
          <DecideForm action={isNew ? "add_variety" : "publish_listing"} kind="review" id={Number((detail.ref as ItemRef | undefined)?.id ?? 0)} ctx={ctx} submitLabel={isNew ? "Add the variety" : "Publish listing"} onDone={onDone} />
          <ReasonDecideForm action="reject_listing" kind="review" id={Number((detail.ref as ItemRef | undefined)?.id ?? 0)} ctx={{ queue, show, created_at: String(detail.createdAt ?? "") }} reasons={LISTING_REJECT_REASONS} buttonLabel="Reject" sheetTitle="Reject this listing" submitLabel="Reject" onDone={onDone} />
        </div>
      </div>
    </article>
  );
}

function CandidatePane({ detail, queue, show, onDone }: { detail: ReviewDetail; queue: QueueKey; show: string; onDone: (r: { redirect: string }) => void }) {
  const id = Number((detail.ref as ItemRef | undefined)?.id ?? 0);
  const ctx = { queue, show, created_at: String(detail.createdAt ?? "") };
  return (
    <article aria-labelledby="review-detail-title" className="admin-stack">
      <header>
        <h2 id="review-detail-title" className="admin-title-lg">
          {detail.name}
        </h2>
        <p className="admin-muted-line">Seller candidate · {formatAdminDate(typeof detail.createdAt === "string" ? detail.createdAt : null)}</p>
      </header>
      <section aria-label="The candidate" className="card admin-panel-card">
        <h3 className="admin-panel-title">The candidate</h3>
        {detail.domain ? <p className="admin-prose">{detail.domain}</p> : null}
        {detail.website ? (
          <p className="admin-prose">
            <a href={detail.website} target="_blank" rel="noreferrer" className="admin-link">
              Open the website
            </a>
          </p>
        ) : null}
      </section>
      <div className="admin-decision-bar">
        <p className="admin-prose">Approving creates the seller as a candidate — finish their details in Sellers.</p>
        <div className="admin-row">
          <DecideForm action="approve_candidate" kind="review" id={id} ctx={ctx} submitLabel="Approve candidate" onDone={onDone} />
          <ReasonDecideForm action="decline_candidate" kind="review" id={id} ctx={ctx} buttonLabel="Decline" sheetTitle="Decline this candidate" submitLabel="Decline" onDone={onDone} />
        </div>
      </div>
    </article>
  );
}

function FarmPane({ detail, queue, show, onDone }: { detail: ReviewDetail; queue: QueueKey; show: string; onDone: (r: { redirect: string }) => void }) {
  const id = Number((detail.ref as ItemRef | undefined)?.id ?? 0);
  const ctx = { queue, show, created_at: String(detail.createdAt ?? "") };
  const rows: [string, unknown][] = [
    ["Contact", detail.contactName],
    ["Email", detail.contactEmail],
    ["Place", detail.city && detail.state ? `${detail.city}, ${detail.state}` : null],
    ["Website", detail.website],
    ["Grows", detail.growsText],
    ["Varieties", detail.varietiesText],
    ["Phone", detail.businessPhone],
    ["Wholesale", detail.wholesale],
    ["Notes", detail.notes],
  ];
  return (
    <article aria-labelledby="review-detail-title" className="admin-stack">
      <header>
        <h2 id="review-detail-title" className="admin-title-lg">
          {detail.farmName ?? detail.name}
        </h2>
        <p className="admin-muted-line">Add Your Farm submission · {formatAdminDate(typeof detail.createdAt === "string" ? detail.createdAt : null)}</p>
      </header>
      <section aria-label="The submission" className="card admin-panel-card">
        <h3 className="admin-panel-title">The submission</h3>
        <dl className="admin-dl">
          {rows.map(([term, value]) =>
            typeof value === "string" && value ? (
              <div key={term} className="admin-dl-row">
                <dt className="admin-dt">{term}</dt>
                <dd className="admin-dd">{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
      </section>
      <div className="admin-decision-bar">
        <p className="admin-prose">Approving creates the seller as a candidate — finish their details in Sellers.</p>
        <div className="admin-row">
          <DecideForm action="approve_farm" kind="farm" id={id} ctx={ctx} submitLabel="Approve submission" onDone={onDone} />
          <ReasonDecideForm action="decline_farm" kind="farm" id={id} ctx={ctx} buttonLabel="Decline" sheetTitle="Decline this submission" submitLabel="Decline" onDone={onDone} />
        </div>
      </div>
    </article>
  );
}

function DuplicatePane({ detail, queue, show, onDone }: { detail: ReviewDetail; queue: QueueKey; show: string; onDone: (r: { redirect: string }) => void }) {
  const id = Number((detail.ref as ItemRef | undefined)?.id ?? 0);
  const held = detail.held?.name ?? detail.name ?? "";
  const existing = detail.existing;
  const ctx = { queue, show, created_at: String(detail.createdAt ?? ""), held_name: held, candidate_name: existing?.name ?? detail.candidateName ?? "" };
  return (
    <article aria-labelledby="review-detail-title" className="admin-stack">
      <header>
        <h2 id="review-detail-title" className="admin-title-lg">
          {held}
        </h2>
        <p className="admin-muted-line">Possible duplicate · held {formatAdminDate(typeof detail.createdAt === "string" ? detail.createdAt : null)}</p>
      </header>
      <p className="admin-compare-mini">
        Comparing: &lsquo;{held}&rsquo; ↔ &lsquo;{existing?.name ?? detail.candidateName}&rsquo;
      </p>
      <div className="admin-two-col">
        <section aria-label="The held variety" className="card admin-panel-card">
          <p className="admin-eyebrow">The held variety</p>
          <h3 className="admin-heading">{held}</h3>
          <p className="admin-muted-line">{detail.held?.cropCommon ?? detail.held?.crop ?? "Unknown crop"}</p>
          <h4 className="admin-small-heading">Who sells it</h4>
          {detail.held?.sellerName ? (
            <ul className="admin-plain-list">
              <li className="admin-plain-row">
                <p className="admin-strong">{detail.held.sellerName}</p>
                {detail.held.titleRaw ? <p className="admin-muted-line">{detail.held.titleRaw}</p> : null}
                {detail.held.productUrl ? (
                  <p>
                    <a href={detail.held.productUrl} target="_blank" rel="noreferrer" className="admin-link">
                      Open the product page
                    </a>
                  </p>
                ) : null}
              </li>
            </ul>
          ) : (
            <p className="admin-muted-line">No sellers on record.</p>
          )}
        </section>
        {existing ? (
          <section aria-label="The variety already in the directory" className="card admin-panel-card">
            <p className="admin-eyebrow">The variety already in the directory</p>
            <h3 className="admin-heading">{existing.name}</h3>
            <p className="admin-muted-line">
              {existing.cropCommon ?? existing.commonName}
              {existing.seriesName ? ` · ${existing.seriesName} series` : ""}
            </p>
            <h4 className="admin-small-heading">Who sells it</h4>
            {(existing.listings?.length ?? 0) === 0 ? (
              <p className="admin-muted-line">No sellers on record.</p>
            ) : (
              <ul className="admin-plain-list">
                {(existing.listings ?? []).map((l, i) => (
                  <li key={i} className="admin-plain-row">
                    <p className="admin-strong">{l.sellerName}</p>
                    {l.titleRaw ? <p className="admin-muted-line">{l.titleRaw}</p> : null}
                    {l.productUrl ? (
                      <p>
                        <a href={l.productUrl} target="_blank" rel="noreferrer" className="admin-link">
                          Open the product page
                        </a>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="admin-muted-line">
              {existing.sellerCount ?? 0} {(existing.sellerCount ?? 0) === 1 ? "seller" : "sellers"}
              {(existing.aliases?.length ?? 0) > 0 ? ` · also called ${(existing.aliases ?? []).join(", ")}` : null}
            </p>
            {existing.slug ? (
              <p className="admin-prose">
                <a href={`/variety/${existing.slug}`} target="_blank" rel="noreferrer" className="admin-link">
                  Open the public page
                </a>
              </p>
            ) : null}
          </section>
        ) : (
          <section aria-label="The variety already in the directory" className="card admin-panel-card">
            <p className="admin-eyebrow">The variety already in the directory</p>
            <p className="admin-prose">The held-as match (&lsquo;{detail.candidateName}&rsquo;) is no longer in the directory — it was merged or removed while this hold waited.</p>
          </section>
        )}
      </div>
      {detail.comparison ? (
        <ul aria-label="Comparison" className="card admin-compare-list">
          <li>{detail.comparison.cropLine}</li>
          <li>{Detail.comparison.nameLine}</li>
          <li>{detail.comparison.sellerLine}</li>
        </ul>
      ) : null}
      {detail.holdReason || detail.evidenceQuote ? (
        <section aria-label="Why the scout held it" className="card admin-panel-card">
          <h3 className="admin-panel-title">Why the scout held it</h3>
          {detail.holdReason ? <p className="admin-prose">{detail.holdReason}</p> : null}
          {detail.evidenceQuote ? <p className="admin-muted-line">“{detail.evidenceQuote}”</p> : null}
        </section>
      ) : null}
      <div className="admin-decision-bar">
        <DuplicateDecideForm id={id} held={held} existing={existing?.name ?? detail.candidateName ?? ""} ctx={ctx} onDone={onDone} />
      </div>
    </article>
  );
}

function formatFieldValue(v: string | string[] | null): string {
  if (v === null) return "—";
  return Array.isArray(v) ? v.join(", ") : v;
}

function currentFor(seller: ReviewDetail["seller"], key: string): string {
  if (!seller) return "—";
  const record = seller as unknown as Record<string, unknown>;
  switch (key) {
    case "name":
    case "location":
    case "region":
    case "homepage":
    case "description":
    case "orderingNotes": {
      const v = record[key];
      return typeof v === "string" && v ? v : "—";
    }
    case "shipsTo": {
      const v = record.shipping ?? record.shipsTo;
      return typeof v === "string" && v ? v : "—";
    }
    default:
      return "—";
  }
}

function ReportPane({ detail, role, queue, show, onDone }: { detail: ReviewDetail; role: string; queue: QueueKey; show: string; onDone: (r: { redirect: string }) => void }) {
  const admin = role === "admin";
  const id = Number((detail.ref as ItemRef | undefined)?.id ?? 0);
  const base = { queue, show, created_at: String(detail.createdAt ?? "") };
  const isRemoval = detail.type === "removal";
  const sellerRemoval = isRemoval && detail.targetType === "seller";
  const varietyRemoval = isRemoval && detail.targetType === "variety";
  const structuredSellerCorrection = !isRemoval && detail.hasFields === true && detail.targetType === "seller";
  const freeForm = !isRemoval && detail.hasFields !== true;
  const canConfirm = !admin && (isRemoval || Boolean(detail.listingRef) || freeForm || (detail.hasFields === true && !structuredSellerCorrection));
  const sellerName = detail.seller?.name ?? detail.targetRef ?? "";
  const verified = verifiedLine(detail.verifiedBy ?? null);
  const fields = detail.fields ?? {};
  return (
    <article aria-labelledby="review-detail-title" className="admin-stack">
      <header>
        <h2 id="review-detail-title" className="admin-title-lg">
          {detail.name}
        </h2>
        <p className="admin-muted-line">Reported {formatAdminDate(typeof detail.createdAt === "string" ? detail.createdAt : null)}</p>
        {verified ? <p className="admin-verified-line">{verified}</p> : null}
      </header>
      {detail.message ? (
        <section aria-label="The reporter's words" className="card admin-panel-card">
          <h3 className="admin-panel-title">The reporter&rsquo;s words</h3>
          <p className="admin-prose-lg">{detail.message}</p>
        </section>
      ) : null}
      <section aria-label="What it concerns" className="card admin-panel-card">
        <h3 className="admin-panel-title">What it concerns</h3>
        {detail.seller ? (
          <div className="admin-prose">
            <p className="admin-strong">{detail.seller.name}</p>
            <p className="admin-muted-line">
              {[detail.seller.location, detail.seller.region].filter(Boolean).join(", ") || "No location on record"} · {detail.seller.liveListingCount ?? 0}{" "}
              {(detail.seller.liveListingCount ?? 0) === 1 ? "listing" : "listings"}
            </p>
            {detail.seller.slug ? (
              <p>
                <a href={`/seller/${detail.seller.slug}`} target="_blank" rel="noreferrer" className="admin-link">
                  Open the seller&rsquo;s public page
                </a>
              </p>
            ) : null}
          </div>
        ) : detail.varietyTarget ? (
          <div className="admin-prose">
            <p className="admin-strong">{detail.varietyTarget.name}</p>
            <p className="admin-muted-line">{detail.varietyTarget.commonName}</p>
            {detail.varietyTarget.slug ? (
              <p>
                <a href={`/variety/${detail.varietyTarget.slug}`} target="_blank" rel="noreferrer" className="admin-link">
                  Open the public page
                </a>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="admin-muted-line">{detail.targetRef || "Unknown target"}</p>
        )}
        {detail.listingRef ? (
          <div className="admin-nested-block">
            <p className="admin-strong">{detail.listingRef.titleRaw ?? `Listing #${detail.listingRef.id}`}</p>
            <p className="admin-muted-line">
              On &lsquo;{detail.listingRef.varietyName}&rsquo; · sold by {detail.listingRef.sellerName}
            </p>
          </div>
        ) : null}
      </section>
      {detail.hasFields ? (
        <section aria-label="Reported and currently shown values" className="card admin-panel-card">
          <h3 className="admin-panel-title">Reported | Currently shown</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Reported</th>
                <th scope="col">Currently shown</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fields).map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{CORRECTION_FIELD_LABELS[key] ?? key}</th>
                  <td>{formatFieldValue(value)}</td>
                  <td className="admin-muted">{detail.targetType === "seller" ? currentFor(detail.seller, key) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {freeForm && detail.seller ? <p className="admin-muted-line">To apply this correction, edit the seller from their record in Sellers.</p> : null}
      {varietyRemoval ? <p className="admin-muted-line">Variety removals are handled from the variety&rsquo;s record.</p> : null}
      <div className="admin-decision-bar">
        {structuredSellerCorrection ? <p className="admin-prose">Applying updates the seller&rsquo;s record right away.</p> : null}
        <div className="admin-row">
          {structuredSellerCorrection ? (
            <DecideForm action="apply_correction" kind="review" id={id} ctx={{ ...base, seller_name: sellerName }} submitLabel="Apply the correction" onDone={onDone} />
          ) : null}
          {sellerRemoval && admin ? (
            <ReasonDecideForm
              action="apply_removal"
              kind="review"
              id={id}
              ctx={{ ...base, seller_name: sellerName }}
              buttonLabel="Apply removal"
              sheetTitle={`Remove ${sellerName}?`}
              submitLabel="Remove seller"
              consequence={`Removing ${sellerName} takes their page and ${detail.seller?.liveListingCount ?? 0} ${(detail.seller?.liveListingCount ?? 0) === 1 ? "listing" : "listings"} off the public site. This can be undone by Hue from the record, not from this screen.`}
              danger
              hideReason
              onDone={onDone}
            />
          ) : null}
          {detail.listingRef && admin ? (
            <ReasonDecideForm
              action="retire_listing"
              kind="review"
              id={id}
              ctx={{ ...base, listing_id: String(detail.listingRef.id ?? ""), variety_name: detail.listingRef.varietyName ?? "" }}
              reasons={RETIRE_REASONS}
              buttonLabel="Retire the listing"
              sheetTitle="Retire this listing?"
              submitLabel="Retire listing"
              consequence={`This listing will come off '${detail.listingRef.varietyName ?? ""}'s page. The seller's other listings stay.`}
              danger
              onDone={onDone}
            />
          ) : null}
          {canConfirm ? <DecideForm action="confirm_report" kind="review" id={id} ctx={base} submitLabel="Confirm report" onDone={onDone} /> : null}
          <ReasonDecideForm action="dismiss_report" kind="review" id={id} ctx={base} buttonLabel="Dismiss" sheetTitle="Dismiss this report" submitLabel="Dismiss" onDone={onDone} />
        </div>
      </div>
    </article>
  );
}

export function ReviewView({
  queue,
  rows,
  total,
  selected,
  detail,
  role,
  counts,
  decided,
  decidedRows,
  decidedTotal,
  status,
  onDone,
}: {
  queue: QueueKey;
  rows: ReviewRow[];
  total: number;
  selected: ItemRef | null;
  detail: ReviewDetail | null;
  role: string;
  counts?: Record<string, number>;
  decided?: boolean;
  decidedRows?: DecidedRow[];
  decidedTotal?: number;
  status?: StatusLine | null;
  onDone?: (r: { redirect: string }) => void;
}) {
  const { band } = useAdminViewport();
  const phone = band === "phone";
  const done = onDone ?? (() => {});
  const show = "25";
  const rank = detail?.rank ?? null;
  const empty = queueDef(queue)?.empty ?? "Nothing waiting here.";
  return (
    <div className="admin-stack">
      <header className="admin-page-head">
        <h1 className="admin-title-lg">Review</h1>
        {!decided && rank && selected ? (
          <p className="admin-page-meta" aria-label={`Item ${rank.rank} of ${rank.total}`}>
            {rank.rank} of {rank.total}
          </p>
        ) : null}
      </header>
      <div className={phone ? "admin-stack" : "admin-master-detail"}>
        {!(phone && selected) ? (
          <div className="admin-list-pane">
            <QueueNav active={queue} counts={counts ?? {}} />
            <QueueList queue={queue} rows={rows} total={total} selected={selected} decided={decided === true} decidedRows={decidedRows ?? []} decidedTotal={decidedTotal ?? 0} />
          </div>
        ) : null}
        {!(phone && !selected) ? (
          <section aria-label="Decision" id="detail" className="admin-detail-pane">
            {status ? (
              <div className="admin-status-wrap">
                <StatusBanner status={status} />
              </div>
            ) : null}
            {!detail ? (
              <div className="card admin-panel-card">
                <div aria-hidden="true" className="divider-stem" />
                <p className="admin-prose-lg">{empty}</p>
              </div>
            ) : detail.type === "listing_match" || detail.type === "new_variety" ? (
              <ListingPane detail={detail} role={role} queue={queue} show={show} onDone={done} />
            ) : detail.type === "seller_candidate" ? (
              <CandidatePane detail={detail} queue={queue} show={show} onDone={done} />
            ) : detail.type === "farm_submission" ? (
              <FarmPane detail={detail} queue={queue} show={show} onDone={done} />
            ) : detail.type === "duplicate_hold" ? (
              <DuplicatePane detail={detail} queue={queue} show={show} onDone={done} />
            ) : (
              <ReportPane detail={detail} role={role} queue={queue} show={show} onDone={done} />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
