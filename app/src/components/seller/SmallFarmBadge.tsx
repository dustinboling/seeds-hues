import { SMALL_FARM_BADGE_LABEL, SMALL_FARM_LEGEND } from "../../lib/small-farm";

/**
 * The "Small farm" badge. Ported from v2/components/seller/SmallFarmBadge.tsx:
 * a non-interactive <span> (the live words carry the meaning, so a screen
 * reader hears "{seller name}, Small farm" in reading order); pill text never
 * wraps internally; callers render it ONLY when the seller's isSmallFarm is
 * true — there is no negative or placeholder state anywhere.
 */
export function SmallFarmBadge({ size = "standard" }: { size?: "standard" | "large" }) {
  return (
    <span className={`badge badge-small-farm badge-small-farm-${size}`} data-small-farm-badge={size}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className="small-farm-mark">
        <path d="M12 8.2 C10.8 4.6 7.6 2.4 3.6 2.6 C3.9 6.6 7.2 9.0 12 8.2 Z" />
        <path d="M12 8.2 C13.2 4.6 16.4 2.4 20.4 2.6 C20.1 6.6 16.8 9.0 12 8.2 Z" />
        <path d="M11.2 7.4 H12.8 V11.2 H11.2 Z" />
        <path d="M6.4 12.5 C6.4 11.4 7.2 10.7 8.2 10.7 H15.8 C16.8 10.7 17.6 11.4 17.6 12.5 C17.6 13.1 17.1 13.6 16.4 13.6 H7.6 C6.9 13.6 6.4 13.1 6.4 12.5 Z" />
        <path
          fillRule="evenodd"
          d="M7.8 13.6 H16.2 C17.6 15.2 18.4 16.9 18.4 18.3 C18.4 20.9 15.6 22.6 12 22.6 C8.4 22.6 5.6 20.9 5.6 18.3 C5.6 16.9 6.4 15.2 7.8 13.6 Z M10.5 18.2 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 Z"
        />
      </svg>
      {SMALL_FARM_BADGE_LABEL}
    </span>
  );
}

/**
 * The one-line legend: the badge itself, inline, then the deck's legend
 * sentence — the shopper learns the mark by recognition at the moment of
 * explanation. Plain text, never a tooltip; not a live region. Exactly one
 * per page.
 */
export function SmallFarmLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`small-farm-legend ${className}`} data-small-farm-legend="">
      <SmallFarmBadge />
      <span>{SMALL_FARM_LEGEND}</span>
    </p>
  );
}
