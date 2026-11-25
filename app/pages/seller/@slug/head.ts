import type { ApiSellerDetail } from "../../../src/data/types";
import { pagePath } from "../../../src/lib/paging";
import { shopBrowseTitle } from "../../../src/lib/shop-browse";
import { ogImage, pageHead, sellerDescription, sellerTitle, type HeadTags } from "../../../src/seo/meta";

/**
 * The shop page's head tags (ported from v2/app/seller/[slug]/page.tsx
 * generateMetadata): the seller title + page suffix, the sentence-composed
 * description (m-5), the generated seller card. Filtered, searched, AND
 * sorted views are noindexed with the canonical set to the unfiltered shop
 * URL (v2's S-11 — the /variety discipline, extended: a present ?sort= is
 * stated even at resting filters); the unfiltered shop keeps its indexing.
 * The title never changes with state.
 */
export function shopHead(seller: ApiSellerDetail, page: number, stated: boolean): HeadTags {
  return pageHead({
    title: shopBrowseTitle(sellerTitle(seller), page),
    description: sellerDescription(seller),
    path: stated ? `/seller/${seller.slug}` : pagePath(`/seller/${seller.slug}`, page),
    og: ogImage("seller", seller.slug, seller.name),
    noindex: stated,
  });
}
