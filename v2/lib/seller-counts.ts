/**
 * Distinct-seller counts over a variety's visible listings (Dustin's ruling, 2026-11-21): any
 * count the site labels as sellers or shops counts distinct sellers, never listings — one
 * seller can legitimately hold several listings for the same variety (packet sizes,
 * treated/untreated, a second product URL). Sellers are identified by slug, the same identity
 * the page links, titles and JSON-LD use.
 */
import type { PublicListing } from "@/lib/validators";

export interface SellerCounts {
  /** Distinct sellers holding at least one of the listings. */
  sellers: number;
  /** Distinct sellers holding at least one in-stock listing. */
  inStockSellers: number;
}

export function sellerCounts(listings: Pick<PublicListing, "seller" | "availability">[]): SellerCounts {
  const all = new Set<string>();
  const inStock = new Set<string>();
  for (const l of listings) {
    all.add(l.seller.slug);
    if (l.availability === "in_stock") inStock.add(l.seller.slug);
  }
  return { sellers: all.size, inStockSellers: inStock.size };
}
