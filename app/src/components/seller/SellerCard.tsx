/**
 * The seller card — ported from v2/components/seller/SellerCard.tsx (same
 * rows, same wording; plain anchors instead of next/link). The whole card
 * is one stretched link to /seller/{slug}.
 *
 * Recorded delta (brief-scoped): the state-outline icon set (StateShape)
 * is a separate frozen item, NOT this slice — the card renders the state
 * NAME text exactly as v2 does and omits only the decorative aria-hidden
 * outline. No information is lost (the icon never carries meaning alone).
 */
import { RatingDisplay } from "../RatingDisplay";
import { SmallFarmBadge } from "./SmallFarmBadge";
import type { ApiSellerItem } from "../../data/types";
import { plural, sellerTypeLabel } from "../../lib/format";
import { stateByCode } from "../../lib/states";

/**
 * `smallFarmBadge`: the seller index (/seller) passes true. The badge is
 * limited to exactly three surfaces (variety listing rows, seller page,
 * seller index cards); /state/{slug}, which reuses this card, leaves it
 * off.
 */
export function SellerCard({ s, smallFarmBadge = false }: { s: ApiSellerItem; smallFarmBadge?: boolean }) {
  // The whole card is one stretched link, so the state is plain icon + name text (no nested link).
  const state = s.country === "US" ? stateByCode(s.region) : null;
  return (
    <article className="card card-hover seller-card">
      <h2 className="seller-card-name">
        <a href={`/seller/${s.slug}`} className="seller-card-link">
          {s.name}
        </a>
      </h2>
      {/* Small farm badge: its own row, the card's second child — outside the
          stretched link, so the link's name stays the seller's alone. Unbadged
          cards reserve no space. */}
      {smallFarmBadge && s.isSmallFarm ? (
        <p className="seller-card-badge">
          <SmallFarmBadge />
        </p>
      ) : null}
      <p className="seller-card-location">
        <span>
          {sellerTypeLabel(s.type)}
          {s.location ? ` · ${s.location}` : s.region && !state ? ` · ${s.region}` : ""}
        </span>
        {state ? (
          <span className="seller-card-state" data-seller-state={state.code}>
            <span aria-hidden="true">·</span> {state.name}
          </span>
        ) : null}
      </p>
      <p className="seller-card-count">{plural(s.varietyCount, "variety", "varieties")} listed</p>
      <RatingDisplay ratingCount={s.ratingCount} />
    </article>
  );
}
