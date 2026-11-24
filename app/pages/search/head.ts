import { pageHead, type HeadTags } from "../../src/seo/meta";

/** The /search description (v2's generateMetadata, verbatim). */
export const SEARCH_DESCRIPTION = "Search flower seed varieties, crops, series and sellers by any name a variety goes by.";

/**
 * The /search head tags (ported from v2/app/search/page.tsx
 * generateMetadata): the query title (or the bare-form title), the shared
 * description, canonical exactly /search regardless of ?q=, noindex on
 * every search URL.
 */
export function searchHead(q: string): HeadTags {
  return pageHead({
    title: q ? `Search: ${q}` : "Search flower seeds",
    description: SEARCH_DESCRIPTION,
    path: "/search",
    noindex: true,
    follow: true,
  });
}
