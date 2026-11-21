/** Sellers workspace links (server + client share these pure builders). */

export interface SellerLinkParams {
  seller?: string | null;
  q?: string | null;
  badge?: string | null;
  state?: string | null;
  sort?: string | null;
}

export function sellerHref(p: SellerLinkParams): string {
  const params = new URLSearchParams();
  if (p.seller) params.set("seller", p.seller);
  if (p.q) params.set("q", p.q);
  if (p.badge && p.badge !== "all") params.set("badge", p.badge);
  if (p.state && p.state !== "all") params.set("state", p.state);
  if (p.sort && p.sort !== "name") params.set("sort", p.sort);
  const query = params.toString();
  return `/admin/sellers${query ? `?${query}` : ""}`;
}
