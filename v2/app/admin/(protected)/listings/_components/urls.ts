/** Listings workspace links (server + client share these pure builders). */

export interface ListingLinkParams {
  listing?: number | string | null;
  q?: string | null;
  chip?: string | null;
  seller?: string | null;
  variety?: string | null;
  show?: number | null;
}

export function listingHref(p: ListingLinkParams): string {
  const params = new URLSearchParams();
  if (p.listing) params.set("listing", String(p.listing));
  if (p.q) params.set("q", p.q);
  if (p.chip && p.chip !== "all") params.set("chip", p.chip);
  if (p.seller) params.set("seller", p.seller);
  if (p.variety) params.set("variety", p.variety);
  if (p.show && p.show !== 50) params.set("show", String(p.show));
  const query = params.toString();
  return `/admin/listings${query ? `?${query}` : ""}`;
}
