/**
 * C3 queued-listing decision view: the listing and the variety as two stacked fact blocks
 * with a visible "matched to" connector, the machine's reasoning in plain words (crop
 * agreement always stated), and the publish/reject decision bar (both roles).
 */
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { LISTING_REJECT_REASONS } from "@/lib/admin/review-queues";
import { SheetReasonButton } from "./decision-controls";
import type { DetailShell, ListingDetail } from "./detail-types";

export function ListingDetailView({ detail, queue, show, submittedOn }: DetailShell & { detail: ListingDetail }) {
  const d = detail;
  const url = d.listing.productUrl;
  const isNew = d.type === "new_variety";
  const varietyName = d.variety.kind === "existing" ? d.variety.name : d.variety.name;
  return (
    <article aria-labelledby="review-detail-title" className="flex flex-col gap-4">
      <header>
        <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {d.extractedName}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">
          {isNew ? "New variety" : "Listing match"} · {submittedOn}
        </p>
      </header>

      <section aria-label="The listing" className="card flex flex-col gap-2 p-4 admin:p-5">
        <h3 className="font-sans text-base font-semibold">The listing</h3>
        <p className="flex flex-wrap items-center gap-2 font-sans text-[15px]">
          <span className="font-semibold">{d.listing.sellerName}</span>
          {d.listing.isSmallFarm ? <SmallFarmBadge /> : null}
        </p>
        {d.listing.titleRaw ? <p className="font-sans text-[15px]">{d.listing.titleRaw}</p> : null}
        {url ? (
          <p className="font-sans text-[15px]">
            <a href={url} target="_blank" rel="noreferrer" className="text-link underline">
              Open the product page
            </a>
          </p>
        ) : null}
        {d.listing.packets.length > 0 ? <p className="font-sans text-sm text-ink-soft">Packet sizes: {d.listing.packets.join(" · ")}</p> : null}
      </section>

      <p aria-hidden="true" className="text-center font-sans text-sm font-semibold uppercase tracking-[0.09em] text-muted">
        matched to
      </p>

      <section aria-label="The variety" className="card flex flex-col gap-2 p-4 admin:p-5">
        <h3 className="font-sans text-base font-semibold">The variety</h3>
        {d.variety.kind === "existing" ? (
          <>
            <p className="font-sans text-[15px] font-semibold">{d.variety.name}</p>
            <p className="font-sans text-sm text-ink-soft">
              {d.variety.cropCommon}
              {d.variety.seriesName ? ` · ${d.variety.seriesName} series` : null} · {d.variety.sellerCount} {d.variety.sellerCount === 1 ? "seller" : "sellers"}
            </p>
            <p className="font-sans text-[15px]">
              <a href={`/variety/${d.variety.slug}`} target="_blank" rel="noreferrer" className="text-link underline">
                Open the public page
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="font-sans text-[15px]">
              Approving will create <span className="font-semibold">{d.variety.name}</span> ({d.variety.crop}).
            </p>
            <p className="font-sans text-sm text-ink-soft">It gets its own public page, with this listing on it.</p>
          </>
        )}
      </section>

      <p className="font-sans text-sm text-ink-soft">Why the machine matched it: {d.match}</p>

      <div className="mt-0 border-t border-line pt-4">
        <p className="font-sans text-[15px] text-ink-soft">Publishing puts this listing on {varietyName}&apos;s public page, linking to the seller&apos;s product page.</p>
        <div className="mt-3 flex flex-col gap-2 admin:flex-row">
          <form method="post" action="/admin/review/decide">
            <input type="hidden" name="action" value={isNew ? "add_variety" : "publish_listing"} />
            <input type="hidden" name="kind" value="review" />
            <input type="hidden" name="id" value={String(d.ref.id)} />
            <input type="hidden" name="queue" value={queue} />
            <input type="hidden" name="show" value={String(show)} />
            <input type="hidden" name="created_at" value={d.createdAt} />
            <input type="hidden" name="variety_name" value={varietyName} />
            <button type="submit" className="btn btn-primary w-full admin:w-auto">
              {isNew ? "Add the variety" : "Publish listing"}
            </button>
          </form>
          <SheetReasonButton
            buttonLabel="Reject"
            sheetTitle="Reject this listing"
            fields={{ action: "reject_listing", kind: "review", id: String(d.ref.id), queue, show: String(show), created_at: d.createdAt }}
            reasons={LISTING_REJECT_REASONS}
            submitLabel="Reject"
          />
        </div>
      </div>
    </article>
  );
}
