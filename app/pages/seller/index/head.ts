import { pageHead, type HeadTags } from "../../../src/seo/meta";
import { sellerBrowseTitle, type SellerBrowseState, type SellerStateOption } from "../../../src/lib/seller-browse";
import { pagePath } from "../../../src/lib/paging";

/** The /seller description (v2's generateMetadata, verbatim). */
export const SELLER_BROWSE_DESCRIPTION =
  "US farms and seed companies of every size that sell flower seed, with the varieties each one carries and when each listing was last checked.";

/**
 * The /seller head tags (ported from v2/app/seller/page.tsx
 * generateMetadata): the state-filter title, the shared description, a
 * state-filtered view canonicalizes to the unfiltered list (the per-state
 * indexable page is /state/{slug}) while unfiltered pages self-canonicalize
 * page-aware. Unknown ?state= codes parse as All states, so they read as
 * the unfiltered index here too.
 */
export function sellerBrowseHead(state: SellerBrowseState, states: SellerStateOption[], page: number): HeadTags {
  const filtered = state.state !== null;
  return pageHead({
    title: sellerBrowseTitle(state, states, page),
    description: SELLER_BROWSE_DESCRIPTION,
    path: filtered ? "/seller" : pagePath("/seller", page),
    noindex: filtered,
  });
}
