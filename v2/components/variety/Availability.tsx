import type { Availability } from "@/lib/validators";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: "In stock",
  sold_out: "Sold out",
  preorder: "Preorder",
  shop_closed: "Shop closed",
  unknown: "Unknown",
};

// Theme badges (THEME-ART-DIRECTION.md §5): text color on its tint, 1 px border of the text
// color at Ada's prescribed per-tone alpha (2026-11-19) — each border clears the WCAG 1.4.11
// 3:1 floor against its own badge ground: leaf/60 on sage-tint (3.13:1), petal/65 on
// petal-tint (3.27:1), leaf-600/70 on surface (3.23:1), muted/70 on surface (3.18:1),
// warn/75 on ochre-tint (3.08:1). In stock = leaf-deep on sage-tint · Sold out = petal on
// petal-tint · Unknown = ochre on ochre-tint. Preorder and shop closed keep distinct,
// quieter tones.
const TONE: Record<Availability, string> = {
  in_stock: "border-leaf/60 bg-leaf-50 text-leaf",
  sold_out: "border-petal/65 bg-petal-50 text-petal",
  preorder: "border-leaf-600/70 bg-surface text-leaf-600",
  shop_closed: "border-muted/70 bg-surface text-muted",
  unknown: "border-warn/75 bg-warn-50 text-warn",
};

/** Stock state as last seen — always paired with its "Last checked" date by the caller. */
export function AvailabilityBadge({ value }: { value: Availability }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.06em] ${TONE[value]}`}>{AVAILABILITY_LABEL[value]}</span>;
}
