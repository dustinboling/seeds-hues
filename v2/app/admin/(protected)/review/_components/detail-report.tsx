/**
 * C5 report decision view: the type as the pane title, the reporter's words in full, what
 * it concerns, and the Reported | Currently shown comparison when the proposal carries
 * structured fields. Dismiss (both roles); Apply the correction (both roles, identical —
 * RA-3); Apply removal + Retire the listing (admin only, absent for reviewers);
 * Confirm report (reviewer only rendered, on remedies they cannot apply).
 */
import { CORRECTION_FIELD_LABELS, RETIRE_REASONS, verifiedLine } from "@/lib/admin/review-queues";
import { SheetReasonButton } from "./decision-controls";
import type { DetailShell, ReportDetail } from "./detail-types";

function formatValue(v: string | string[] | null): string {
  if (v === null) return "—";
  return Array.isArray(v) ? v.join(", ") : v;
}

function currentFor(seller: ReportDetail["seller"], key: string): string {
  if (!seller) return "—";
  switch (key) {
    case "name":
      return seller.name;
    case "location":
      return seller.location ?? "—";
    case "region":
      return seller.region ?? "—";
    case "homepage":
      return seller.homepage ?? "—";
    case "description":
      return seller.description ?? "—";
    case "orderingNotes":
      return seller.orderingNotes ?? "—";
    case "shipsTo": {
      try {
        const v = JSON.parse(seller.shipsTo) as unknown;
        return Array.isArray(v) ? v.join(", ") : seller.shipsTo;
      } catch {
        return seller.shipsTo;
      }
    }
    default:
      return "—";
  }
}

export function ReportDetailView({ detail, role, queue, show, submittedOn }: DetailShell & { detail: ReportDetail }) {
  const d = detail;
  const admin = role === "admin";
  const verified = verifiedLine(d.verifiedBy);
  const base: Record<string, string> = { kind: "review", id: String(d.ref.id), queue, show: String(show), created_at: d.createdAt };
  const isRemoval = d.type === "removal";
  const sellerRemoval = isRemoval && d.targetType === "seller";
  const varietyRemoval = isRemoval && d.targetType === "variety";
  const structuredSellerCorrection = !isRemoval && d.hasFields && d.targetType === "seller";
  const freeForm = !isRemoval && !d.hasFields;
  const canConfirm = !admin && (isRemoval || d.listing !== null || freeForm || (d.hasFields && !structuredSellerCorrection));
  const sellerName = d.seller?.name ?? d.targetRef;

  return (
    <article aria-labelledby="review-detail-title" className="flex flex-col gap-4">
      <header>
        <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {d.name}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">Reported {submittedOn}</p>
        {verified ? <p className="mt-1 font-sans text-sm font-medium text-leaf">{verified}</p> : null}
      </header>

      {d.message ? (
        <section aria-label="The reporter's words" className="card p-4 admin:p-5">
          <h3 className="font-sans text-base font-semibold">The reporter&apos;s words</h3>
          <p className="mt-1 font-serif text-[17px] leading-[1.6]">{d.message}</p>
        </section>
      ) : null}

      <section aria-label="What it concerns" className="card flex flex-col gap-2 p-4 admin:p-5">
        <h3 className="font-sans text-base font-semibold">What it concerns</h3>
        {d.seller ? (
          <div className="font-sans text-[15px]">
            <p className="font-semibold">{d.seller.name}</p>
            <p className="text-sm text-ink-soft">
              {[d.seller.location, d.seller.region].filter(Boolean).join(", ") || "No location on record"} · {d.seller.liveListingCount}{" "}
              {d.seller.liveListingCount === 1 ? "listing" : "listings"}
            </p>
            <p className="mt-1">
              <a href={`/seller/${d.seller.slug}`} target="_blank" rel="noreferrer" className="text-link underline">
                Open the seller&apos;s public page
              </a>
            </p>
          </div>
        ) : d.variety ? (
          <div className="font-sans text-[15px]">
            <p className="font-semibold">{d.variety.name}</p>
            <p className="text-sm text-ink-soft">{d.variety.commonName}</p>
            <p className="mt-1">
              <a href={`/variety/${d.variety.slug}`} target="_blank" rel="noreferrer" className="text-link underline">
                Open the public page
              </a>
            </p>
          </div>
        ) : (
          <p className="font-sans text-[15px] text-muted">{d.targetRef || "Unknown target"}</p>
        )}
        {d.listing ? (
          <div className="mt-1 border-t border-line pt-2 font-sans text-[15px]">
            <p className="font-semibold">{d.listing.titleRaw ?? `Listing #${d.listing.id}`}</p>
            <p className="text-sm text-ink-soft">
              On &apos;{d.listing.varietyName}&apos; · sold by {d.listing.sellerName}
            </p>
          </div>
        ) : null}
      </section>

      {d.hasFields ? (
        <section aria-label="Reported and currently shown values" className="card overflow-x-auto p-4 admin:p-5">
          <h3 className="font-sans text-base font-semibold">Reported | Currently shown</h3>
          <table className="mt-2 w-full font-sans text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Field</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Reported</th>
                <th scope="col" className="py-2 font-semibold">Currently shown</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.fields).map(([key, value]) => (
                <tr key={key} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    {CORRECTION_FIELD_LABELS[key] ?? key}
                  </th>
                  <td className="py-2 pr-3">{formatValue(value)}</td>
                  <td className="py-2 text-ink-soft">{d.targetType === "seller" ? currentFor(d.seller, key) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {freeForm && d.seller ? <p className="font-sans text-sm text-ink-soft">To apply this correction, edit the seller from their record in Sellers.</p> : null}
      {varietyRemoval ? <p className="font-sans text-sm text-ink-soft">Variety removals are handled from the variety&apos;s record.</p> : null}

      <div className="border-t border-line pt-4">
        {structuredSellerCorrection ? <p className="font-sans text-[15px] text-ink-soft">Applying updates the seller&apos;s record right away.</p> : null}
        <div className="mt-3 flex flex-col gap-2 admin:flex-row admin:flex-wrap">
          {structuredSellerCorrection ? (
            <form method="post" action="/admin/review/decide">
              {Object.entries({ ...base, action: "apply_correction", seller_name: sellerName }).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button type="submit" className="btn btn-primary w-full admin:w-auto">
                Apply the correction
              </button>
            </form>
          ) : null}
          {sellerRemoval && admin ? (
            <SheetReasonButton
              buttonLabel="Apply removal"
              sheetTitle={`Remove ${sellerName}?`}
              fields={{ ...base, action: "apply_removal", seller_name: sellerName }}
              submitLabel="Remove seller"
              consequence={`Removing ${sellerName} takes their page and ${d.seller?.liveListingCount ?? 0} ${(d.seller?.liveListingCount ?? 0) === 1 ? "listing" : "listings"} off the public site. This can be undone by Hue from the record, not from this screen.`}
              danger
              hideReason
            />
          ) : null}
          {d.listing && admin ? (
            <SheetReasonButton
              buttonLabel="Retire the listing"
              sheetTitle="Retire this listing?"
              fields={{ ...base, action: "retire_listing", listing_id: String(d.listing.id), variety_name: d.listing.varietyName }}
              reasons={RETIRE_REASONS}
              submitLabel="Retire listing"
              consequence={`This listing will come off '${d.listing.varietyName}'s page. The seller's other listings stay.`}
              danger
            />
          ) : null}
          {canConfirm ? (
            <form method="post" action="/admin/review/decide">
              {Object.entries({ ...base, action: "confirm_report" }).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button type="submit" className="btn btn-primary w-full admin:w-auto">
                Confirm report
              </button>
            </form>
          ) : null}
          <SheetReasonButton buttonLabel="Dismiss" sheetTitle="Dismiss this report" fields={{ ...base, action: "dismiss_report" }} submitLabel="Dismiss" />
        </div>
      </div>
    </article>
  );
}
