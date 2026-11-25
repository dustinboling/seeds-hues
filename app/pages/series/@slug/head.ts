import { ogImage, pageHead, seriesDescription, seriesTitle, type HeadTags } from "../../../src/seo/meta";
import { shortCommonName } from "../../../src/lib/format";

export interface SeriesHeadFacts {
  slug: string;
  name: string;
  cropCommonName: string;
  cropSlug: string;
  latinName: string | null;
  varietyCount: number;
  varietiesWithSellers: number;
}

/**
 * The series hub's head tags (ported from v2/app/series/[slug]/page.tsx
 * generateMetadata, with the m-2 port item): counts + Latin title and
 * description, self-canonical, always indexable. OG is the GENERATED card
 * — the series' crop card (this port's explicit m-2 ruling: series pages
 * share their crop's generated 1200×630 card, like variety/seller, rather
 * than re-shipping portrait artwork or inventing a new card kind).
 */
export function seriesHead(facts: SeriesHeadFacts): HeadTags {
  return pageHead({
    title: seriesTitle(facts),
    description: seriesDescription(facts),
    path: `/series/${facts.slug}`,
    og: ogImage("crop", facts.cropSlug, `${shortCommonName(facts.cropCommonName)} seeds`),
  });
}
