import type { ApiAvailability, ApiPublicListing } from "../../data/types";
import { AVAILABILITY_LABEL } from "../AvailabilityBadge";
import { SmallFarmBadge } from "../seller/SmallFarmBadge";
import { formatCheckedDate } from "../../lib/format";
import { PacketList } from "./PacketList";

/**
 * One listing — the Quiet Ledger card (Dustin's pick 2026-11-20). Ported
 * from v2/components/variety/ListingRow.tsx: seller name loudest, linking to
 * the seller page; the Small Farm badge inline after the name when the
 * seller's real `isSmallFarm` flag is true; location; the quiet status line
 * (coloured dot + sentence-case word + friendly checked date — never an ISO
 * string); packet sizes and notes; the footer ("Report a problem" left, the
 * working "Visit shop →" pill right through /go/{id} — never disabled, even
 * sold out). Sold out: the card ground steps down (see variety.css). No
 * price is ever shown (R1).
 */

/**
 * Dot + word tones for the status line: in stock = leaf, sold out = petal.
 * Shared with the unified variety card's shop context (Slice 5), which
 * transfers the ledger's stock line without invention.
 */
export const STATUS_TONE: Record<ApiAvailability, { dot: string; word: string }> = {
  in_stock: { dot: "status-dot-in-stock", word: "status-word-in-stock" },
  sold_out: { dot: "status-dot-sold-out", word: "status-word-sold-out" },
  preorder: { dot: "status-dot-preorder", word: "status-word-preorder" },
  shop_closed: { dot: "status-dot-shop-closed", word: "status-word-shop-closed" },
  unknown: { dot: "status-dot-unknown", word: "status-word-unknown" },
};

export function ListingRow({ listing: l }: { listing: ApiPublicListing }) {
  const soldOut = l.availability === "sold_out";
  const checked = formatCheckedDate(l.lastCheckedAt);
  const region = [l.seller.region, l.seller.country].filter(Boolean).join(", ");
  const reportHref = `/report?type=correct&seller=${l.seller.slug}&variety=${l.variety.slug}`;
  const tone = STATUS_TONE[l.availability];
  // The badge names the seller, so it sits on the name row where the seller is the heading.
  const showBadge = l.seller.isSmallFarm;
  return (
    <article
      className={`listing-card${soldOut ? " listing-card-soldout" : ""}`}
      aria-labelledby={`listing-${l.id}`}
      data-availability={l.availability}
    >
      <div className="listing-name-row">
        <h3 id={`listing-${l.id}`} className="listing-name">
          <a href={`/seller/${l.seller.slug}`} className="listing-seller-link">
            {l.seller.name}
          </a>
        </h3>
        {showBadge ? <SmallFarmBadge /> : null}
      </div>
      <p className="listing-location">{l.seller.location ?? (region || "Location unknown")}</p>
      <p className="listing-status">
        <span aria-hidden="true" className={`status-dot ${tone.dot}`} />
        <span className={`status-word ${tone.word}`}>{AVAILABILITY_LABEL[l.availability]}</span>
        {checked ? ` · Checked ${checked}` : " · Not yet checked"}
      </p>
      {l.packetSizes.length > 0 || l.notes ? (
        <div className="listing-details">
          <PacketList packets={l.packetSizes} />
          {l.notes ? <p className="listing-notes">{l.notes}</p> : null}
        </div>
      ) : null}
      <div aria-hidden="true" className="listing-stem-rule">
        <span />
      </div>
      <div className="listing-footer">
        <a href={reportHref} className="listing-report">
          Report a problem
        </a>
        <a
          href={`/go/${l.id}`}
          rel="nofollow noopener noreferrer"
          target="_blank"
          className={`visit-pill${soldOut ? " visit-pill-outline" : ""}`}
        >
          <span aria-hidden="true">Visit shop →</span>
          <span className="sr-only">Shop at {l.seller.name} (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
