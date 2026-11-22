/**
 * E2 listing detail (Slice C): one screen, both roles — the Reviewer sees the identical
 * layout with actions absent (§5 rule 2). Product title, the outbound product link,
 * seller and variety links, the status word, packet sizes (labels + seed counts, never
 * prices), and the History trail in plain words. Admin only: Retire (with the reason
 * select inside its confirm) and, on a retired listing, Restore.
 */
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { formatAdminDateTime } from "@/lib/admin-auth";
import { listingEventLine, statusWordForListing } from "@/lib/admin/listings";
import { RetireButton, type ListingCtx } from "./listing-sheets";

export interface ListingDetailPacket {
  label: string;
  seedCount: number | null;
}

export interface ListingDetailEvent {
  event: string;
  at: string;
  reason: string | null;
  actor: string | null;
}

export interface ListingDetailData {
  id: number;
  titleRaw: string | null;
  productUrl: string | null;
  status: string;
  availability: string | null;
  deletedAt: string | null;
  varietySlug: string;
  varietyName: string;
  sellerSlug: string;
  sellerName: string;
  sellerEligibility: string;
  sellerStatus: string;
  sellerListingPolicy: string;
  sellerDeletedAt: string | null;
  packets: ListingDetailPacket[];
  history: ListingDetailEvent[];
}

function CautionIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="size-5 shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.5 0-.9.4-.9.9v3.1c0 .5.4.9.9.9s.9-.4.9-.9V6.6c0-.5-.4-.9-.9-.9Zm0 6.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

export function ListingDetail({ detail: l, role, ctx, backHref, genericStatus }: { detail: ListingDetailData; role: string; ctx: ListingCtx; backHref: string; genericStatus: { text: string } | null }) {
  const isAdmin = role === "admin";
  const retired = l.status === "removed";
  // Spec E2 mandates the raw outbound product link (new tab) on this authenticated,
  // noindex admin screen; public shop buttons still go through /go/{id} (R1).
  const outboundUrl = l.productUrl;
  const title = l.titleRaw || l.varietyName;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="admin:hidden">
        <a href={backHref} className="font-sans text-[15px] font-semibold text-link underline">
          ← All listings
        </a>
      </p>
      {genericStatus ? <StatusBanner status={genericStatus} /> : null}

      {retired ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-line-strong bg-warn-50 p-4">
          <span className="flex min-w-0 flex-1 items-start gap-2 text-warn">
            <CautionIcon />
            <span className="font-sans text-base text-ink">This listing is retired — it is off &apos;{l.varietyName}&apos;s page.</span>
          </span>
          {isAdmin ? (
            <form method="post" action="/admin/listings/actions">
              <input type="hidden" name="action" value="restore" />
              <input type="hidden" name="listing" value={l.id} />
              {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
              {ctx.chip !== "all" ? <input type="hidden" name="chip" value={ctx.chip} /> : null}
              {ctx.seller ? <input type="hidden" name="seller" value={ctx.seller} /> : null}
              {ctx.variety ? <input type="hidden" name="variety" value={ctx.variety} /> : null}
              {ctx.show !== "50" ? <input type="hidden" name="show" value={ctx.show} /> : null}
              <button type="submit" className="btn btn-secondary">
                Restore listing
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      <header className="flex flex-col gap-2">
        <h2 id="detail-title" className="text-xl font-semibold">
          {title}
        </h2>
        <p className="font-sans text-[15px]">
          {outboundUrl ? (
            <a href={outboundUrl} rel="noopener noreferrer" target="_blank" className="break-all font-semibold text-link underline">
              Open the product page
            </a>
          ) : (
            <span className="text-muted">No product page recorded</span>
          )}
        </p>
        <p className="font-sans text-[15px]">
          <a href={`/admin/sellers?seller=${l.sellerSlug}`} className="font-semibold text-link underline">
            {l.sellerName}
          </a>
          <span className="text-muted" aria-hidden="true">
            {" · "}
          </span>
          <a href={`/admin/varieties?variety=${l.varietySlug}`} className="font-semibold text-link underline">
            {l.varietyName}
          </a>
        </p>
        <p className="font-sans text-[15px] tabular-nums">
          <span className="chip inline-flex min-h-target items-center">{statusWordForListing(l)}</span>
        </p>
      </header>

      <section aria-labelledby="packets-heading" className="card p-4 admin:p-5">
        <h3 id="packets-heading" className="text-xl font-semibold">
          Packet sizes
        </h3>
        {l.packets.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">No packet sizes captured.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line font-sans text-base">
            {l.packets.map((p, i) => (
              <li key={`${p.label}-${i}`} className="py-2 tabular-nums">
                {p.label}
                {p.seedCount !== null ? <span className="text-ink-soft"> · {p.seedCount === 1 ? "1 seed" : `${p.seedCount} seeds`}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading" className="card p-4 admin:p-5">
        <h3 id="history-heading" className="text-xl font-semibold">
          History
        </h3>
        {l.history.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">No events recorded yet.</p>
        ) : (
          <ol className="mt-2 flex flex-col divide-y divide-line">
            {l.history.map((e, i) => (
              <li key={`${e.event}-${e.at}-${i}`} className="py-2 font-sans text-[15px] tabular-nums">
                {listingEventLine(e, formatAdminDateTime(e.at))}
              </li>
            ))}
          </ol>
        )}
      </section>

      {isAdmin && !retired ? (
        <div>
          <RetireButton listingId={l.id} varietyName={l.varietyName} ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}
