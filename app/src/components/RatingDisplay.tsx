/**
 * R7: ratings are display-only and no real ratings exist in Phase 1, so this
 * always renders "Not yet rated". No scores, no numbers, no AggregateRating
 * markup. Ported from v2/components/ui/RatingDisplay.tsx: quiet text with
 * one small decorative outline star (never a score).
 */
export function RatingDisplay({ ratingCount }: { ratingCount: number }) {
  void ratingCount;
  return (
    <span className="rating-quiet">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
      </svg>
      Not yet rated
    </span>
  );
}
