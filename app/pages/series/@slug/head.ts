import { pageHead, seriesDescription, seriesTitle, type HeadTags } from "../../../src/seo/meta";

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
 * generateMetadata): counts + Latin title and description, self-canonical,
 * always indexable. OG is v2's inherited default — the generated site card
 * (v2's series generateMetadata passes no `og`, so pageMetadata's
 * ogImage("site", "default") applies; measured live 2026-11-25). The
 * crop-card override this port shipped was a parity bug (Slice 8 find,
 * resolving Slice 5's N2 against the live tree): live series pages
 * already declare a generated 1200×630 card, so m-2 needs no change here.
 */
export function seriesHead(facts: SeriesHeadFacts): HeadTags {
  return pageHead({
    title: seriesTitle(facts),
    description: seriesDescription(facts),
    path: `/series/${facts.slug}`,
  });
}
