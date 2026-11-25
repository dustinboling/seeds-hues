import { cropDetailTitle, type CropDetailTitleFacts } from "../../../src/lib/crop-detail";
import { pagePath } from "../../../src/lib/paging";
import { cropDescription, ogImage, pageHead, type HeadTags } from "../../../src/seo/meta";
import { shortCommonName } from "../../../src/lib/format";

export interface CropHeadFacts extends CropDetailTitleFacts {
  lastUpdated: string | null;
  slug: string;
}

/**
 * The crop hub's head tags (ported from v2/app/crop/[slug]/page.tsx
 * generateMetadata, with the m-2 port item): counts + Latin title, counts
 * + last-updated description, and the GENERATED 1200×630 crop card as
 * og:image — never the portrait media artwork. Filtered views are
 * crawlable but not indexed, canonicalized to the unfiltered crop page.
 */
export function cropHead(facts: CropHeadFacts, page: number, filtered: boolean): HeadTags {
  const common = shortCommonName(facts.commonName);
  return pageHead({
    title: cropDetailTitle(facts, page),
    description: cropDescription(facts),
    path: filtered ? `/crop/${facts.slug}` : pagePath(`/crop/${facts.slug}`, page),
    noindex: filtered,
    og: ogImage("crop", facts.slug, `${common} seeds`),
  });
}
