import { AVAILABILITY_LABEL } from "../AvailabilityBadge";
import { formatCheckedDate, plural, shortCommonName } from "../../lib/format";
import { ZERO_SELLER_SHORT } from "../../lib/zero-seller";
import type { ApiPublicListing, ApiVarietyListItem } from "../../data/types";
import { STATUS_TONE } from "./ListingRow";
import { PacketList } from "./PacketList";
import { VarietyCardImage } from "./VarietyCardImage";

/**
 * The ONE variety card, two contexts (seller-as-shop).
 *
 * The art frame, Latin slot, name, and crop line are one anatomy in both;
 * what differs below the crop line is the fact block each surface owes.
 * Browse context (every grid outside shops): the whole card is one link
 * to /variety/{slug} with the shipped accessible name, the seller-count
 * line, no per-card heading. Shop context (the shop grid): NOT a
 * whole-card link — an <h3> variety name containing the /variety/{slug}
 * link (display block, 44px minimum on its border box), the ledger's
 * stock line, packet sizes and notes where present, and the pinned footer
 * ("Report a problem" left, the working "Visit shop →" pill right, no
 * stem rule above it). Focus order is DOM order: name link → Report → pill.
 * Ported from v2/components/variety/VarietyCard.tsx.
 *
 * The Latin line takes its slot — the payload's plant.latinName verbatim
 * and whole, or no node at all when null (absence is elemental: no
 * placeholder, no empty element, no reserved slot).
 */
export type VarietyCardProps = { v: ApiVarietyListItem; context?: "browse" } | { listing: ApiPublicListing; context: "shop" };

/** The Latin line: verbatim stored string, or no node at all when null. */
function LatinLine({ latinName }: { latinName: string | null }) {
  if (latinName === null) return null;
  return (
    <span className="variety-card-latin">
      <i>{latinName}</i>
    </span>
  );
}

export function VarietyCard(props: VarietyCardProps) {
  if (props.context === "shop") return <ShopVarietyCard listing={props.listing} />;
  const { v } = props;
  const crop = shortCommonName(v.plant.commonName);
  return (
    <a href={`/variety/${v.slug}`} aria-label={`${v.varietyName} — ${crop}`} className="card card-hover variety-card">
      <span className="variety-card-art">
        <VarietyCardImage
          media={v.media}
          cropMedia={v.cropMedia}
          varietyName={v.varietyName}
          cropName={v.plant.commonName}
          plantSlug={v.plant.slug}
        />
      </span>
      <span className="variety-card-text">
        <LatinLine latinName={v.plant.latinName} />
        <span className="variety-card-name">{v.varietyName}</span>
        <span className="variety-card-crop">{crop}</span>
        <span className="variety-card-sellers">{v.sellerCount === 0 ? ZERO_SELLER_SHORT : plural(v.sellerCount, "seller")}</span>
      </span>
    </a>
  );
}

function ShopVarietyCard({ listing: l }: { listing: ApiPublicListing }) {
  const soldOut = l.availability === "sold_out";
  const checked = formatCheckedDate(l.lastCheckedAt);
  const tone = STATUS_TONE[l.availability];
  const crop = shortCommonName(l.variety.plant.commonName);
  const reportHref = `/report?type=correct&seller=${l.seller.slug}&variety=${l.variety.slug}`;
  return (
    <div className={`card shop-card${soldOut ? " shop-card-sold-out" : ""}`}>
      <span className="variety-card-art">
        <VarietyCardImage
          media={l.variety.media}
          cropMedia={l.variety.cropMedia}
          varietyName={l.variety.varietyName}
          cropName={l.variety.plant.commonName}
          plantSlug={l.variety.plant.slug}
        />
      </span>
      <div className="shop-card-text">
        <LatinLine latinName={l.variety.plant.latinName} />
        <h3 className="shop-card-name">
          <a href={`/variety/${l.variety.slug}`} className="shop-card-link">
            <span className="shop-card-name-text">{l.variety.varietyName}</span>
          </a>
        </h3>
        <span className="variety-card-crop">{crop}</span>
      </div>
      <p className="shop-card-status">
        <span aria-hidden="true" className={`status-dot ${tone.dot}`} />
        <span className={`status-word ${tone.word}`}>{AVAILABILITY_LABEL[l.availability]}</span>
        {checked ? ` · Checked ${checked}` : " · Not yet checked"}
      </p>
      {l.packetSizes.length > 0 || l.notes ? (
        <div className="shop-card-packets">
          <PacketList packets={l.packetSizes} />
          {l.notes ? <p className="shop-card-notes">{l.notes}</p> : null}
        </div>
      ) : null}
      <div className="shop-card-footer">
        <a href={reportHref} className="shop-card-report">
          Report a problem
        </a>
        <a
          href={`/go/${l.id}`}
          rel="nofollow noopener noreferrer"
          target="_blank"
          className={`shop-card-visit${soldOut ? " shop-card-visit-sold-out" : ""}`}
        >
          <span aria-hidden="true">Visit shop →</span>
          <span className="sr-only">Shop at {l.seller.name} (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

/** `wide` adds one column at the sm and lg breakpoints only (mobile stays at 2); used only by the /variety browse page. */
export function VarietyGrid({ items, wide = false }: { items: ApiVarietyListItem[]; wide?: boolean }) {
  return (
    <ul className={`variety-grid${wide ? " variety-grid-wide" : ""}`}>
      {items.map((v) => (
        <li key={v.slug} className="variety-grid-item">
          <VarietyCard v={v} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The shop results grid: VarietyGrid's standard variant (2 cols / sm: 3 /
 * lg: 4) over the shop's listings — shop-context cards, uniform gap
 * across the grouped order's invisible boundary.
 */
export function ShopVarietyGrid({ listings, className = "" }: { listings: ApiPublicListing[]; className?: string }) {
  return (
    <ul className={`variety-grid${className ? ` ${className}` : ""}`}>
      {listings.map((l) => (
        <li key={l.id} className="variety-grid-item">
          <VarietyCard listing={l} context="shop" />
        </li>
      ))}
    </ul>
  );
}
