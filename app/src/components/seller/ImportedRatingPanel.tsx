import { formatFriendlyDate } from "../../lib/format";
import type { ApiImportedRating } from "../../data/types";

const STAR = "M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z";

/** Five stars, filled to the rating (fractional fill via a clip). Decorative: the parent labels it. */
function Stars({ value }: { value: number }) {
  const pct = `${Math.max(0, Math.min(5, value)) * 20}%`;
  const row = (cls: string) => (
    <span className={`imported-stars-row ${cls}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={STAR} fill="currentColor" />
        </svg>
      ))}
    </span>
  );
  return (
    <span className="imported-stars" aria-hidden="true">
      {row("imported-stars-base")}
      <span className="imported-stars-fill" style={{ width: pct }}>
        {row("imported-stars-value")}
      </span>
    </span>
  );
}

/**
 * "Reviews from Google": a third-party aggregate shown in its own bordered
 * panel, apart from our rating (which stays "Not yet rated"). Aggregate
 * and count only — the source gives no review text. This number never
 * feeds our rating state or structured data. Ported from v2's
 * ImportedRatingPanel.
 */
export function ImportedRatingPanel({ rating }: { rating: ApiImportedRating }) {
  const value = rating.rating.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const label = `Rated ${value} out of 5`;
  return (
    <section aria-labelledby="seller-imported-rating" data-imported-rating={rating.source} className="card imported-rating">
      <h2 id="seller-imported-rating" className="imported-rating-heading">
        Reviews from {rating.source}
      </h2>
      <p className="imported-rating-row">
        <span role="img" aria-label={label} className="imported-rating-score">
          <span aria-hidden="true" className="imported-rating-value">
            {value}
          </span>
          <Stars value={rating.rating} />
        </span>
        <span className="imported-rating-count">
          from {rating.reviewCount.toLocaleString("en-US")} {rating.reviewCount === 1 ? "review" : "reviews"} on {rating.source}
        </span>
      </p>
      <p className="imported-rating-meta">
        Ratings from {rating.source} · fetched {formatFriendlyDate(rating.fetchedDate)}
      </p>
    </section>
  );
}
