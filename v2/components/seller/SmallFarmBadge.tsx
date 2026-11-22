import { SMALL_FARM_BADGE_LABEL, SMALL_FARM_LEGEND } from "@/lib/small-farm";

/**
 * The "Small farm" badge (Open Directory). Appearance: Elena's badge-design.md §4 (gated by
 * Quinn, PASS WITH NOTES); placement: Nadia's ux-spec §2 per Hue's RULING-placement-2026-11-19.
 *
 * - Non-interactive <span>: no link, button, tooltip, title or aria-label — the live words carry
 *   the meaning, so a screen reader hears "{seller name}, Small farm" in reading order.
 * - Pill text NEVER wraps internally (RULING F3: whitespace-nowrap + shrink-0); the row around it
 *   wraps instead.
 * - Border is leaf at 60 % (not the stock badges' 40 %, which measures below the 3:1 non-text
 *   floor — badge-design §6).
 * - Callers render it ONLY when the seller's isSmallFarm is true: there is no negative or
 *   placeholder state anywhere.
 */
const BASE =
  "badge badge-small-farm shrink-0 whitespace-nowrap font-semibold tracking-[0.01em]";

const SIZE = {
  /** Listing rows, seller cards, legends: 20 px chip / 12 px text / 13 px mark. */
  standard: {
    chip: "gap-(--badge-small-farm-standard-gap) py-(--badge-small-farm-standard-padding-block) pl-(--badge-small-farm-standard-padding-inline-start) pr-2 text-xs leading-(--badge-small-farm-standard-line-height)",
    mark: "size-(--badge-small-farm-standard-mark-size)",
  },
  /** Seller page header: 28 px chip / 13 px text / 16 px mark. */
  large: {
    chip: "gap-1.5 py-1 pl-2 pr-2.5 text-(length:--badge-small-farm-large-font-size) leading-(--badge-small-farm-large-line-height)",
    mark: "size-4",
  },
} as const;

export type SmallFarmBadgeSize = keyof typeof SIZE;

/**
 * The mark (open-directory/small-farm-mark.svg), inlined: a poppy-style seed pod with a two-leaf
 * sprout. The file's root inline `style="color:…"` is deliberately STRIPPED here (RULING F2) — an
 * inline style on the root would override inheritance; the mark takes `currentColor` from the
 * chip's text colour. Decorative: aria-hidden + focusable="false". No ids, masks or gradients,
 * so it is safe to inline many times on one page; the seed dot is a true evenodd hole.
 */
function SmallFarmMark({ className }: { className: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <path d="M12 8.2 C10.8 4.6 7.6 2.4 3.6 2.6 C3.9 6.6 7.2 9.0 12 8.2 Z" />
      <path d="M12 8.2 C13.2 4.6 16.4 2.4 20.4 2.6 C20.1 6.6 16.8 9.0 12 8.2 Z" />
      <path d="M11.2 7.4 H12.8 V11.2 H11.2 Z" />
      <path d="M6.4 12.5 C6.4 11.4 7.2 10.7 8.2 10.7 H15.8 C16.8 10.7 17.6 11.4 17.6 12.5 C17.6 13.1 17.1 13.6 16.4 13.6 H7.6 C6.9 13.6 6.4 13.1 6.4 12.5 Z" />
      <path
        fillRule="evenodd"
        d="M7.8 13.6 H16.2 C17.6 15.2 18.4 16.9 18.4 18.3 C18.4 20.9 15.6 22.6 12 22.6 C8.4 22.6 5.6 20.9 5.6 18.3 C5.6 16.9 6.4 15.2 7.8 13.6 Z M10.5 18.2 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 Z"
      />
    </svg>
  );
}

export function SmallFarmBadge({ size = "standard" }: { size?: SmallFarmBadgeSize }) {
  const s = SIZE[size];
  return (
    <span className={`${BASE} ${s.chip}`} data-small-farm-badge={size}>
      <SmallFarmMark className={s.mark} />
      {SMALL_FARM_BADGE_LABEL}
    </span>
  );
}

/**
 * The one-line legend (ux-spec §5): the badge itself, inline, then the deck's legend sentence —
 * the shopper learns the mark by recognition at the moment of explanation. Plain text, never a
 * tooltip; not a live region. Exactly one per page, on the four ux §5 surfaces. (The seller page
 * builds its legend on its own badge row instead, with the large badge — see app/seller/[slug].)
 */
export function SmallFarmLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-1.5 text-sm text-muted ${className}`} data-small-farm-legend="">
      <SmallFarmBadge />
      <span>{SMALL_FARM_LEGEND}</span>
    </p>
  );
}
