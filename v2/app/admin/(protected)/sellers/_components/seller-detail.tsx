/**
 * D2 seller detail (Slice B): one screen, both roles — the Reviewer sees the identical
 * layout with actions absent (§5 rule 2). Header, Information, Classification, Internal
 * notes, Listings, and the Admin-only danger zone, in that order.
 */
import type { ReactNode } from "react";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { formatAdminDateTime } from "@/lib/admin-auth";
import { isPubliclyListed, platformLabel, roleLabel, shipsToWords, statusWordFor } from "@/lib/admin/sellers";
import { sellerTypeLabel } from "@/lib/format";
import { AddNoteButton, ClassifyButton, DeactivateButton, EditSellerButton, RemoveButton, type SellerCtx, type SellerEditDefaults } from "./seller-sheets";

export interface SellerDetailListing {
  id: number;
  titleRaw: string | null;
  status: string;
  varietyName: string;
  varietySlug: string;
}

export interface SellerDetailNote {
  id: number;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface SellerDetailData {
  slug: string;
  name: string;
  type: string;
  platform: string | null;
  homepage: string | null;
  contactEmail: string | null;
  location: string | null;
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
  status: string;
  eligibility: string;
  listingPolicy: string;
  deletedAt: string | null;
  isSmallFarm: boolean;
  liveListingCount: number;
  listings: SellerDetailListing[];
  notes: SellerDetailNote[];
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="size-4 shrink-0">
      <path d="M8 1.5a3.5 3.5 0 0 1 3.5 3.5V7h.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.5V5A3.5 3.5 0 0 1 8 1.5Zm0 2A1.5 1.5 0 0 0 6.5 5v2h3V5A1.5 1.5 0 0 0 8 3.5Z" />
    </svg>
  );
}

function CautionIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.5 0-.9.4-.9.9v3.1c0 .5.4.9.9.9s.9-.4.9-.9V6.6c0-.5-.4-.9-.9-.9Zm0 6.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

function typeLabel(type: string): string {
  return type === "wholesale" || type === "retail" || type === "specialty" ? sellerTypeLabel(type) : type;
}

function listingStatusWord(status: string): string {
  return status ? status[0]!.toUpperCase() + status.slice(1) : "Unknown";
}

function InfoRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 admin:grid-cols-[10rem_minmax(0,1fr)] admin:gap-3">
      <dt className="font-sans text-sm font-semibold text-ink-soft">{term}</dt>
      <dd className="min-w-0 font-sans text-base">{children}</dd>
    </div>
  );
}

function NotSet() {
  return <span className="text-muted">Not set</span>;
}

export function SellerDetail({
  detail: d,
  role,
  ctx,
  backHref,
  updatedLine,
  classifiedLine,
  genericStatus,
  typeOptions,
  platformOptions,
}: {
  detail: SellerDetailData;
  role: string;
  ctx: SellerCtx;
  backHref: string;
  updatedLine: string | null;
  classifiedLine: string | null;
  genericStatus: { text: string } | null;
  typeOptions: { value: string; label: string }[];
  platformOptions: { value: string; label: string }[];
}) {
  const isAdmin = role === "admin";
  const listed = isPubliclyListed(d);
  const deactivated = d.status === "inactive";
  const editDefaults: SellerEditDefaults = {
    slug: d.slug,
    name: d.name,
    type: d.type,
    platform: d.platform,
    homepage: d.homepage,
    contactEmail: d.contactEmail,
    location: d.location,
    region: d.region,
    country: d.country,
    shipsTo: d.shipsTo,
    description: d.description,
    orderingNotes: d.orderingNotes,
  };
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="admin:hidden">
        <a href={backHref} className="font-sans text-[15px] font-semibold text-link underline">
          ← All sellers
        </a>
      </p>
      {genericStatus ? <StatusBanner status={genericStatus} /> : null}

      {deactivated ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-line-strong bg-warn-50 p-4">
          <span className="flex min-w-0 flex-1 items-start gap-2 text-warn">
            <CautionIcon />
            <span className="font-sans text-base text-ink">This seller is deactivated — their page and listings are hidden from the public site.</span>
          </span>
          {isAdmin ? (
            <form method="post" action="/admin/sellers/actions">
              <input type="hidden" name="action" value="reactivate" />
              <input type="hidden" name="seller" value={d.slug} />
              {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
              {ctx.badge !== "all" ? <input type="hidden" name="badge" value={ctx.badge} /> : null}
              {ctx.state !== "all" ? <input type="hidden" name="state" value={ctx.state} /> : null}
              {ctx.sort !== "name" ? <input type="hidden" name="sort" value={ctx.sort} /> : null}
              <button type="submit" className="btn btn-secondary">
                Reactivate
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <header className="flex flex-col gap-2">
        <h2 id="detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {d.name}
        </h2>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-[15px]">
          {d.isSmallFarm ? <SmallFarmBadge size="large" /> : <span className="text-ink-soft">Not a small farm</span>}
          <span className="text-muted" aria-hidden="true">
            ·
          </span>
          <span>{statusWordFor(d)}</span>
        </p>
        {listed ? (
          <p className="font-sans text-[15px]">
            <a href={`/seller/${d.slug}`} className="font-semibold text-link underline">
              View public page
            </a>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="info-heading" id="info" className="card scroll-mt-4 p-4 admin:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="info-heading" className="text-xl font-semibold">
            Information
          </h3>
          {isAdmin ? <EditSellerButton seller={editDefaults} typeOptions={typeOptions} platformOptions={platformOptions} ctx={ctx} /> : null}
        </div>
        {updatedLine ? (
          <p role="status" className="mt-2 rounded-field bg-leaf-50 p-3 font-sans text-[15px] text-ink">
            {updatedLine}
          </p>
        ) : null}
        <dl className="mt-1 divide-y divide-line">
          <InfoRow term="Website">
            {d.homepage ? (
              <a href={d.homepage} rel="noopener noreferrer" target="_blank" className="break-all text-link underline">
                {d.homepage}
              </a>
            ) : (
              <NotSet />
            )}
          </InfoRow>
          <InfoRow term="Location">{d.location ? d.location : <NotSet />}</InfoRow>
          <InfoRow term="Region">{d.region ? d.region : <NotSet />}</InfoRow>
          <InfoRow term="Country">{d.country}</InfoRow>
          <InfoRow term="Ships to">{shipsToWords(d.shipsTo)}</InfoRow>
          <InfoRow term="Contact email">{d.contactEmail ? d.contactEmail : <NotSet />}</InfoRow>
          <InfoRow term="Seller type">{typeLabel(d.type)}</InfoRow>
          <InfoRow term="Platform">{d.platform ? platformLabel(d.platform) : <NotSet />}</InfoRow>
          <InfoRow term="Description">{d.description ? <span className="whitespace-pre-line">{d.description}</span> : <NotSet />}</InfoRow>
          <InfoRow term="Ordering notes">{d.orderingNotes ? <span className="whitespace-pre-line">{d.orderingNotes}</span> : <NotSet />}</InfoRow>
        </dl>
      </section>

      <section aria-labelledby="classification-heading" id="classification" className="card scroll-mt-4 p-4 admin:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="classification-heading" className="text-xl font-semibold">
            Classification
          </h3>
          {isAdmin ? <ClassifyButton sellerName={d.name} isSmallFarm={d.isSmallFarm} isCandidate={d.eligibility === "candidate"} ctx={ctx} /> : null}
        </div>
        {classifiedLine ? (
          <p role="status" className="mt-2 rounded-field bg-leaf-50 p-3 font-sans text-[15px] text-ink">
            {classifiedLine}
          </p>
        ) : null}
        <p className="mt-2 font-sans text-base">
          {d.isSmallFarm ? <SmallFarmBadge size="large" /> : <span>Not a small farm — no badge is shown.</span>}
        </p>
      </section>

      <section aria-labelledby="notes-heading" id="notes" className="scroll-mt-4 rounded-card border border-line-strong bg-paper-deep p-4 admin:p-5">
        <p className="flex items-center gap-2 font-sans text-[12px] font-bold uppercase tracking-[0.09em] text-ink-soft">
          <LockIcon />
          <span id="notes-heading">Internal notes — never shown on the public site</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AddNoteButton ctx={ctx} />
        </div>
        {d.notes.length === 0 ? (
          <p className="mt-3 font-serif text-[17px] leading-[1.6]">No notes yet. Notes are only visible inside admin — add anything the team should know about this seller.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-4">
            {d.notes.map((n) => (
              <li key={n.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <p className="whitespace-pre-line font-serif text-[17px] leading-[1.6]">{n.body}</p>
                <p className="mt-1 font-sans text-sm tabular-nums text-muted">
                  {n.authorName} · {roleLabel(n.authorRole)} · {formatAdminDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="listings-heading" className="card p-4 admin:p-5">
        <h3 id="listings-heading" className="text-xl font-semibold">
          Listings
        </h3>
        <p className="mt-1 font-sans text-sm tabular-nums text-muted">{d.liveListingCount === 1 ? "1 listing" : `${d.liveListingCount} listings`}</p>
        {d.listings.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">No listings yet.</p>
        ) : (
          <ol className="mt-2 flex flex-col divide-y divide-line">
            {d.listings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 font-sans">
                <a href={`/go/${l.id}`} rel="nofollow noopener noreferrer" className="min-h-target content-center text-base font-semibold text-ink underline decoration-ink-soft decoration-[1px] underline-offset-[3px]">
                  {l.titleRaw || l.varietyName}
                </a>
                <span className="text-sm text-ink-soft">on {l.varietyName}</span>
                <span className="text-sm text-muted">· {listingStatusWord(l.status)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 font-sans text-[15px]">
          <a href={`/admin/listings?seller=${d.slug}`} className="font-semibold text-link underline">
            See all in Listings
          </a>
        </p>
      </section>

      {isAdmin ? (
        <section aria-labelledby="danger-heading" className="mt-4 border-t border-line pt-6">
          <h3 id="danger-heading" className="text-xl font-semibold">
            Danger zone
          </h3>
          <div className="mt-3 flex flex-col gap-2 admin:flex-row">
            <DeactivateButton sellerName={d.name} listingCount={d.liveListingCount} ctx={ctx} />
            <RemoveButton sellerName={d.name} listingCount={d.liveListingCount} ctx={ctx} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
