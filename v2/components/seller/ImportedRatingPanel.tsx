import { formatFriendlyDate } from "@/lib/format";
import type { ImportedRating } from "@/lib/validators";

const STAR = "M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z";

/** Five stars, filled to the rating (fractional fill via a clip). Decorative: the parent labels it. */
function Stars({ value }: { value: number }) {
  const pct = `${Math.max(0, Math.min(5, value)) * 20}%`;
  const row = (cls: string) => (
    <span className={`flex gap-0.5 ${cls}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={STAR} fill="currentColor" />
        </svg>
      ))}
    </span>
  );
  return (
    <span className="relative inline-block" aria-hidden="true">
      {row("text-line-strong")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: pct }}>
        {row("text-warn")}
      </span>
    </span>
  );
}

/**
 * "Reviews from Google" (brief #4): a third-party aggregate shown in its own bordered panel, apart
 * from our rating (which stays "Not yet rated"). Aggregate and count only — the source gives no
 * review text. This number never feeds our rating state or structured data.
 */
export function ImportedRatingPanel({ rating }: { rating: ImportedRating }) {
  const value = rating.rating.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const label = `Rated ${value} out of 5`;
  return (
    <section
      aria-labelledby="seller-imported-rating"
      data-imported-rating={rating.source}
      className="mt-6 max-w-3xl rounded-card border border-line-strong bg-surface p-4"
    >
      <h2 id="seller-imported-rating" className="text-xl font-semibold">
        Reviews from {rating.source}
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span role="img" aria-label={label} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="text-2xl font-semibold leading-none text-ink">
            {value}
          </span>
          <Stars value={rating.rating} />
        </span>
        <span className="text-ink-soft">
          from {rating.reviewCount.toLocaleString("en-US")} {rating.reviewCount === 1 ? "review" : "reviews"} on {rating.source}
        </span>
      </p>
      <p className="mt-2 text-xs text-muted">
        Ratings from {rating.source} · fetched {formatFriendlyDate(rating.fetchedDate)}
      </p>
    </section>
  );
}
