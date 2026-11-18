import type { Availability } from "@/lib/validators";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "In stock",
  sold_out: "Sold out",
  preorder: "Preorder",
  shop_closed: "Shop closed",
  unknown: "Unknown",
};

// Theme badges (THEME-ART-DIRECTION.md §5): text colour on its tint, 1 px border of the text
// colour at 40 %. In stock = leaf-deep on sage-tint · Sold out = petal on petal-tint ·
// Unknown = ochre on ochre-tint. Preorder and shop closed keep distinct, quieter tones.
const TONE: Record<Availability, string> = {
  in_stock: "border-leaf/40 bg-leaf-50 text-leaf",
  sold_out: "border-petal/40 bg-petal-50 text-petal",
  preorder: "border-leaf-600/40 bg-surface text-leaf-600",
  shop_closed: "border-muted/40 bg-surface text-muted",
  unknown: "border-warn/40 bg-warn-50 text-warn",
};

/** Stock state as last seen — always paired with its "Last checked" date by the caller. */
export function AvailabilityBadge({ value }: { value: Availability }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.06em] ${TONE[value]}`}>{AVAILABILITY_LABEL[value]}</span>;
}
