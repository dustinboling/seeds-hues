import Link from "next/link";
import { AvailabilityBadge } from "./Availability";
import { PacketList } from "./PacketList";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import type { PublicListing } from "@/lib/validators";

/**
 * One listing (R6, canonical stories 2–3): seller, region, stock state as last seen, "Last
 * checked {date}", and a Shop button through /go/{listing_id}. No price.
 * `context` decides which side of the listing is the heading (variety page → seller; seller
 * page → variety). Theme: rows sit on one surface sheet, separated by hairlines (the parent
 * list draws them), not boxed as cards.
 */
export function ListingRow({ listing: l, context }: { listing: PublicListing; context: "variety" | "seller" }) {
  const checked = l.lastCheckedAt?.slice(0, 10) ?? null;
  const region = [l.seller.region, l.seller.country].filter(Boolean).join(", ");
  const reportHref = `/report?type=correct&seller=${l.seller.slug}&variety=${l.variety.slug}`;
  return (
    <article className="flex flex-col gap-2 px-4 py-4" aria-labelledby={`listing-${l.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Small farm badge (ux §2.1, RULING F1): a SIBLING after the h3 — outside the heading
              and the link, so neither accessible name changes; flex-wrap drops it below a long
              name on mobile. Variety-page rows only: on a seller page every row is the same
              seller, and the header carries the badge once. */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`listing-${l.id}`} className="text-lg font-medium">
              {context === "variety" ? (
                <Link href={`/seller/${l.seller.slug}`}>{l.seller.name}</Link>
              ) : (
                <Link href={`/variety/${l.variety.slug}`}>{l.variety.varietyName}</Link>
              )}
            </h3>
            {context === "variety" && l.seller.isSmallFarm ? <SmallFarmBadge /> : null}
          </div>
          <p className="text-sm text-muted">
            {context === "variety" ? (l.seller.location ?? (region || "Location unknown")) : l.variety.plant.commonName}
          </p>
        </div>
        <AvailabilityBadge value={l.availability} />
      </header>
      <p className="font-sans text-xs text-muted">
        <span className="font-semibold text-ink-soft">{checked ? `Last checked ${checked}` : "Last checked: unknown"}</span>
      </p>
      <PacketList packets={l.packetSizes} />
      {l.notes ? <p className="text-sm text-muted">{l.notes}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <a href={`/go/${l.id}`} rel="nofollow noopener noreferrer" target="_blank" className="btn btn-primary">
          Shop at {l.seller.name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Link href={reportHref} className="font-sans text-sm">
          Report a problem with this listing
        </Link>
      </div>
    </article>
  );
}
