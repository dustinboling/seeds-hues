import { pagePath, pageTitleSuffix } from "../../../src/lib/paging";
import { ogImage, pageHead, stateDescription, stateTitle, type HeadTags } from "../../../src/seo/meta";
import { SITE_NAME } from "../../../src/site";

export interface StateHeadFacts {
  code: string;
  name: string;
  slug: string;
  sellerCount: number;
}

/**
 * The state hub's head tags (ported from v2/app/state/[slug]/page.tsx
 * generateMetadata, with the m-2 port item): the ABSOLUTE title (no
 * site-name suffix), the count description, self-canonical per page. OG is
 * the GENERATED site card (this port's explicit m-2 ruling: state pages
 * declare the generated 1200×630 site card, like variety/seller, rather
 * than re-shipping portrait artwork or inventing a new card kind).
 */
export function stateHead(state: StateHeadFacts, page: number): HeadTags {
  return pageHead({
    title: `${stateTitle(state)}${pageTitleSuffix(page)}`,
    absoluteTitle: true,
    description: stateDescription(state),
    path: pagePath(`/state/${state.slug}`, page),
    og: ogImage("site", "default", SITE_NAME),
  });
}
