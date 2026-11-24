import type { ApiVarietyDetail } from "../../../src/data/types";
import { mediaOgImage, ogImage, pageHead, varietyDescription, varietyTitle, type HeadTags } from "../../../src/seo/meta";
import { shortCommonName } from "../../../src/lib/format";

/**
 * The variety page's head tags (ported from variety-view.tsx
 * varietyMetadata): title/description from the ported builders, canonical
 * to the clean variety URL, OG + Twitter summary_large_image. The
 * small-farms variant shares the title, description, and canonical — the
 * narrowing is a view, not a different fact base — and adds noindex.
 * Non-indexable varieties are likewise noindexed (v2 parity).
 */
export function varietyHead(detail: ApiVarietyDetail, smallFarmOnly: boolean): HeadTags {
  const label = `${detail.varietyName} ${shortCommonName(detail.plant.commonName)}`;
  const hero = detail.media[0];
  return pageHead({
    title: varietyTitle(detail),
    description: varietyDescription(detail),
    path: `/variety/${detail.slug}`,
    noindex: smallFarmOnly || !detail.indexable,
    follow: true,
    og: hero ? mediaOgImage(hero.url, label) : ogImage("variety", detail.slug, label),
  });
}
