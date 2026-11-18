import Link from "next/link";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { StateShape } from "@/components/seller/StateShape";
import { plural, sellerTypeLabel } from "@/lib/format";
import { stateByCode } from "@/lib/data/states";
import type { SellerListItem } from "@/lib/validators";

export function SellerCard({ s }: { s: SellerListItem }) {
  // The whole card is one stretched link, so the state is plain icon + name text (no nested link).
  const state = s.country === "US" ? stateByCode(s.region) : null;
  return (
    <article className="card card-hover relative flex h-full flex-col gap-1 p-4 focus-within:ring-2 focus-within:ring-focus">
      <h2 className="text-lg font-semibold">
        <Link href={`/seller/${s.slug}`} className="text-ink no-underline after:absolute after:inset-0 hover:underline">
          {s.name}
        </Link>
      </h2>
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
