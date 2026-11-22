import type { Availability } from "@/lib/validators";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "In stock",
  sold_out: "Sold out",
  preorder: "Preorder",
  shop_closed: "Shop closed",
  unknown: "Unknown",
};

// Theme badges (THEME-ART-DIRECTION.md §5) in the badge family (Tranche 2.2,
// SPEC tranche-2 §3): one .badge base plus one tone class per state. Ground, text
// and border live in the tone rules in globals.css, at the exact values below —
// text color on its tint, 1 px border of the text color at Ada's prescribed
// per-tone alpha (2026-11-19). Each border clears the WCAG 1.4.11 3:1 floor
// against its own badge ground: leaf/60 on sage-tint (3.13:1), petal/65 on
// petal-tint (3.27:1), leaf-600/70 on surface (3.23:1), muted/70 on surface
// (3.18:1), warn/75 on ochre-tint (3.08:1). In stock = leaf-deep on sage-tint ·
// Sold out = petal on petal-tint · Unknown = ochre on ochre-tint. Preorder and
// shop closed keep distinct, quieter tones. Values tokenized in
// design-tokens/tokens.json (component.badge.*).
const TONE: Record<Availability, string> = {
  in_stock: "badge-in-stock",
  sold_out: "badge-sold-out",
  preorder: "badge-preorder",
  shop_closed: "badge-shop-closed",
  unknown: "badge-unknown",
};

/** Stock state as last seen — always paired with its "Last checked" date by the caller. */
export function AvailabilityBadge({ value }: { value: Availability }) {
  return <span className={`badge ${TONE[value]} px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]`}>{AVAILABILITY_LABEL[value]}</span>;
}
