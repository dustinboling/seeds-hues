import type { ApiAvailability } from "../data/types";

export const AVAILABILITY_LABEL: Record<ApiAvailability, string> = {
  in_stock: "In stock",
  sold_out: "Sold out",
  preorder: "Preorder",
  shop_closed: "Shop closed",
  unknown: "Unknown",
};

const TONE: Record<ApiAvailability, string> = {
  in_stock: "badge-in-stock",
  sold_out: "badge-sold-out",
  preorder: "badge-preorder",
  shop_closed: "badge-shop-closed",
  unknown: "badge-unknown",
};

/** Stock state as last seen — always paired with its "Last checked" date by the caller. */
export function AvailabilityBadge({ value }: { value: ApiAvailability }) {
  return <span className={`badge ${TONE[value]} availability-badge`}>{AVAILABILITY_LABEL[value]}</span>;
}
