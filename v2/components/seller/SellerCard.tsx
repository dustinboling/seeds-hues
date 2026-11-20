import Link from "next/link";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { StateShape } from "@/components/seller/StateShape";
import { plural, sellerTypeLabel } from "@/lib/format";
import { stateByCode } from "@/lib/data/states";
import type { SellerListItem } from "@/lib/validators";

/**
 * `smallFarmBadge`: the seller index (/seller) passes true. Nadia's ux-spec §2.4 limits the badge
 * to exactly three surfaces (variety listing rows, seller page, seller index cards) and names
 * state pages as excluded, so /state/{slug}, which reuses this card, leaves it off.
 */
export function SellerCard({ s, smallFarmBadge = false }: { s: SellerListItem; smallFarmBadge?: boolean }) {
  // The whole card is one stretched link, so the state is plain icon + name text (no nested link).
  const state = s.country === "US" ? stateByCode(s.region) : null;
  return (
    <article className="card card-hover relative flex h-full flex-col gap-1 p-4 focus-within:ring-2 focus-within:ring-focus">
      <h2 className="text-lg font-semibold">
        <Link href={`/seller/${s.slug}`} className="text-ink no-underline after:absolute after:inset-0 hover:underline">
          {s.name}
        </Link>
      </h2>
      {/* Small farm badge (ux §2.3, RULING F1): its own row, the card's second child — outside the
          stretched link, so the link's name stays the seller's alone. Unbadged cards reserve no
          space. */}
      {smallFarmBadge && s.isSmallFarm ? (
        <p>
          <SmallFarmBadge />
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
        <span>
          {sellerTypeLabel(s.type)}
          {s.location ? ` · ${s.location}` : s.region && !state ? ` · ${s.region}` : ""}
        </span>
        {state ? (
          <span className="inline-flex items-center gap-1" data-seller-state={state.code}>
            <span aria-hidden="true">·</span>
            <StateShape region={state.code} size={18} />
            {state.name}
          </span>
        ) : null}
      </p>
      <p className="text-sm">{plural(s.varietyCount, "variety", "varieties")} listed</p>
      <RatingDisplay ratingCount={s.ratingCount} />
    </article>
  );
}
