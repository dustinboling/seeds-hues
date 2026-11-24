import Link from "next/link";
import { AVAILABILITY_LABEL } from "@/components/variety/Availability";
import { STATUS_TONE } from "@/components/variety/ListingRow";
import { PacketList } from "@/components/variety/PacketList";
import { VarietyCardImage } from "@/components/variety/VarietyCardImage";
import { formatCheckedDate, plural, shortCommonName } from "@/lib/format";
import { ZERO_SELLER_SHORT } from "@/lib/zero-seller";
import type { PublicListing, VarietyListItem } from "@/lib/validators";

/**
 * The ONE variety card, two contexts (seller-as-shop, SPEC-GRID-CARD §4.1).
 *
 * The art frame, Latin slot, name, and crop line are one anatomy in both; what differs
 * below the crop line is the fact block each surface owes. Browse context (every grid
 * outside shops): the whole card is one link to /variety/{slug} with the shipped
 * accessible name, the seller-count line, no per-card heading. Shop context (the shop
 * grid): NOT a whole-card link — an <h3> variety name containing the /variety/{slug}
 * link (display block, 44px minimum on its border box), the ledger's stock line, packet
 * sizes and notes where present, and the pinned footer ("Report a problem" left, the
 * working "Visit shop →" pill right, no stem rule above it). Focus order is DOM order:
 * name link → Report → pill.
 *
 * The mini stem is gone from the card in both contexts and every state; the Latin line
 * takes its slot — the payload's plant.latinName verbatim and whole, or no node at all
 * when null (absence is elemental: no placeholder, no empty element, no reserved slot).
 * The browse text zone is min-height 9.75rem (a floor, never a ceiling — no literal
 * height, no overflow clipping anywhere on the card, so spacing overrides and 200% text
 * grow the zone/card/row instead of clipping); the shop stack flows with the footer
 * pinned by margin-top auto. Sold-out dress transfers whole from the ledger (stepped
 * ground, softened shadow, outline-only working pill, full-fidelity plate).
 */
export type VarietyCardProps = { v: VarietyListItem; context?: "browse" } | { listing: PublicListing; context: "shop" };

/** The Latin line (Thea T-1…T-7): verbatim stored string, or no node at all when null. */
function LatinLine({ latinName }: { latinName: string | null }) {
  if (latinName === null) return null;
  return (
    <span className="text-sm text-muted">
      <i className="normal-case tracking-normal">{latinName}</i>
    </span>
  );
}

export function VarietyCard(props: VarietyCardProps) {
  if (props.context === "shop") return <ShopVarietyCard listing={props.listing} />;
  const { v } = props;
  const crop = shortCommonName(v.plant.commonName);
  return (
    <Link
      href={`/variety/${v.slug}`}
      aria-label={`${v.varietyName} — ${crop}`}
      className="card card-hover packet tap flex h-full flex-col items-center p-4 text-center no-underline"
    >
      <span className="block w-full">
        <VarietyCardImage
          media={v.media}
          cropMedia={v.cropMedia}
          varietyName={v.varietyName}
          cropName={v.plant.commonName}
          plantSlug={v.plant.slug}
        />
      </span>
      <span className="flex min-h-[9.75rem] flex-col items-center justify-center gap-0.5">
        <LatinLine latinName={v.plant.latinName} />
        <span className="line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">{v.varietyName}</span>
        <span className="text-sm text-muted">{crop}</span>
        <span className="text-sm text-muted">{v.sellerCount === 0 ? ZERO_SELLER_SHORT : plural(v.sellerCount, "seller")}</span>
      </span>
    </Link>
  );
}

function ShopVarietyCard({ listing: l }: { listing: PublicListing }) {
  const soldOut = l.availability === "sold_out";
  const checked = formatCheckedDate(l.lastCheckedAt);
  const tone = STATUS_TONE[l.availability];
  const crop = shortCommonName(l.variety.plant.commonName);
  const reportHref = `/report?type=correct&seller=${l.seller.slug}&variety=${l.variety.slug}`;
  return (
    <div className={`card packet flex h-full flex-col items-center p-4 text-center${soldOut ? " bg-paper shadow-listing-flat" : ""}`}>
      <span className="block w-full">
        <VarietyCardImage
          media={l.variety.media}
          cropMedia={l.variety.cropMedia}
          varietyName={l.variety.varietyName}
          cropName={l.variety.plant.commonName}
          plantSlug={l.variety.plant.slug}
        />
      </span>
      <div className="flex w-full flex-col items-center gap-0.5">
        <LatinLine latinName={l.variety.plant.latinName} />
        <h3 className="w-full font-display text-lg font-semibold leading-snug text-ink">
          <Link href={`/variety/${l.variety.slug}`} className="block min-h-target text-ink no-underline">
            <span className="line-clamp-2">{l.variety.varietyName}</span>
          </Link>
        </h3>
        <span className="text-sm text-muted">{crop}</span>
      </div>
      <p className="mt-listing-status font-sans text-[13px] text-muted">
        <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full align-[1px] ${tone.dot}`} />
        <span className={`font-semibold ${tone.word}`}>{AVAILABILITY_LABEL[l.availability]}</span>
        {checked ? ` · Checked ${checked}` : " · Not yet checked"}
      </p>
      {l.packetSizes.length > 0 || l.notes ? (
        <div className="mt-2 flex flex-col gap-1">
          <PacketList packets={l.packetSizes} />
          {l.notes ? <p className="text-sm text-muted">{l.notes}</p> : null}
        </div>
      ) : null}
      <div className="mt-auto flex w-full items-center justify-between gap-3 pt-4">
        <Link
          href={reportHref}
          className="inline-flex min-h-target items-center font-sans text-[13px] text-muted underline underline-offset-[3px]"
        >
          Report a problem
        </Link>
        <a
          href={`/go/${l.id}`}
          rel="nofollow noopener noreferrer"
          target="_blank"
          className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full border-(length:--border-visit) border-leaf px-visit-inline font-sans text-[15px] font-semibold text-leaf no-underline ${
            soldOut ? "bg-transparent shadow-none" : "bg-visit shadow-visit-pill"
          }`}
        >
          <span aria-hidden="true">Visit shop →</span>
          <span className="sr-only">Shop at {l.seller.name} (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

/** `wide` adds one column at the sm and lg breakpoints only (mobile stays at 2); used only by the /variety browse page. */
export function VarietyGrid({ items, wide = false }: { items: VarietyListItem[]; wide?: boolean }) {
  return (
    <ul
      className={
        wide ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {items.map((v) => (
        <li key={v.slug} className="h-full">
          <VarietyCard v={v} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The shop results grid: VarietyGrid's standard variant (2 cols / sm: 3 / lg: 4, gap-2
 * both axes) over the shop's listings — shop-context cards, uniform 8px gap across the
 * grouped order's invisible boundary.
 */
export function ShopVarietyGrid({ listings, className = "" }: { listings: PublicListing[]; className?: string }) {
  return (
    <ul className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4${className ? ` ${className}` : ""}`}>
      {listings.map((l) => (
        <li key={l.id} className="h-full">
          <VarietyCard listing={l} context="shop" />
        </li>
      ))}
    </ul>
  );
}
