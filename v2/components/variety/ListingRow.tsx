import Link from "next/link";
import { AVAILABILITY_LABEL } from "./Availability";
import { PacketList } from "./PacketList";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { formatCheckedDate } from "@/lib/format";
import type { Availability, PublicListing } from "@/lib/validators";

/**
 * One listing — Quiet Ledger card (Direction A, Dustin's pick 2026-11-20; spec in
 * card-redesign-2026-11-19/DIRECTIONS.md + a-quiet-ledger.html). Variety context only:
 * the seller page's seller-context cards were replaced by the unified variety card's
 * shop context (seller-as-shop, SPEC-GRID-CARD G-1/G-2/G-4), and the seller branch plus
 * the artwork rail (ListingArtwork, retired with no remaining caller) were removed.
 * What renders here is byte-for-byte the variety-context card it always was.
 *
 * A separate surface card, not a row on a shared sheet: seller name loudest (Fraunces 600,
 * 20 px, underlined, linking to the seller page), location under it, then a quiet status
 * line (coloured dot + sentence-case word + friendly checked date — never an ISO string,
 * never a top-right stock pill). A wheat-stem hairline (see .listing-stem-rule in
 * globals.css) divides the card from its footer: "Report a problem" left (44 px tap
 * height), the compact "Visit shop →" pill right (44 px, sage-tint fill with the
 * load-bearing 1.5 px leaf border). Sold out: the card ground steps down from surface to
 * paper, the shadow softens, and the pill keeps working through /go/{id} with its fill
 * removed (outline only) — never disabled, never removed. No price is ever shown (R1).
 *
 * SMALL-FARM BADGE: the shared SmallFarmBadge component (components/seller), rendered
 * inline after the seller name on the name row — the placement Quinn gated for this
 * card — and only when the seller's real `isSmallFarm` flag is true (PublicListing's
 * seller now always carries it; the badge/filter build shipped it). There is no
 * negative or placeholder state.
 */

/**
 * Dot + word tones for the status line: in stock = leaf (R-2), sold out = petal.
 * Shared with the unified variety card's shop context, which transfers the ledger's
 * stock line without invention — the map itself is never altered per context.
 */
export const STATUS_TONE: Record<Availability, { dot: string; word: string }> = {
  in_stock: { dot: "bg-leaf", word: "text-leaf" },
  sold_out: { dot: "bg-petal", word: "text-petal" },
  preorder: { dot: "bg-leaf-600", word: "text-leaf-600" },
  shop_closed: { dot: "bg-muted", word: "text-muted" },
  unknown: { dot: "bg-warn", word: "text-warn" },
};

export function ListingRow({ listing: l }: { listing: PublicListing }) {
  const soldOut = l.availability === "sold_out";
  const checked = formatCheckedDate(l.lastCheckedAt);
  const region = [l.seller.region, l.seller.country].filter(Boolean).join(", ");
  const reportHref = `/report?type=correct&seller=${l.seller.slug}&variety=${l.variety.slug}`;
  const tone = STATUS_TONE[l.availability];
  // The badge names the seller, so it sits on the name row where the seller is the heading.
  const showBadge = l.seller.isSmallFarm;
  // The text column: heading row → subline → status → packets/notes — flat, exactly as it always has.
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h3
          id={`listing-${l.id}`}
          className="font-display text-[20px] font-semibold leading-[1.2] tracking-[-0.01em]"
        >
          <Link
            href={`/seller/${l.seller.slug}`}
            className="text-ink underline decoration-ink-soft decoration-[1px] underline-offset-[3px]"
          >
            {l.seller.name}
          </Link>
        </h3>
        {showBadge ? <SmallFarmBadge /> : null}
      </div>
      <p className="mt-listing-subline text-base text-muted">
        {l.seller.location ?? (region || "Location unknown")}
      </p>
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
    </>
  );
  return (
    <article
      className={`rounded-card border px-4 pb-3 pt-listing-top ${
        soldOut
          ? "listing-card-soldout border-line bg-paper shadow-listing-flat"
          : "border-listing bg-surface shadow-listing-raised"
      }`}
      aria-labelledby={`listing-${l.id}`}
      data-availability={l.availability}
    >
      {body}
      <div aria-hidden="true" className="listing-stem-rule">
        <span />
      </div>
      <div className="flex items-center justify-between gap-3">
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
            soldOut
              ? "bg-transparent shadow-none"
              : "bg-visit shadow-visit-pill"
          }`}
        >
          <span aria-hidden="true">Visit shop →</span>
          <span className="sr-only">Shop at {l.seller.name} (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
