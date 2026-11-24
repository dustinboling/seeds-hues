import { pageHead, type HeadTags } from "../../../src/seo/meta";
import { hasActiveFilters, varietyBrowseTitle, type BrowseFilterState } from "../../../src/lib/browse";
import { pagePath } from "../../../src/lib/paging";

/** The /variety description (v2's generateMetadata, verbatim). */
export const VARIETY_BROWSE_DESCRIPTION =
  "Every flower seed variety in the directory, alphabetical, with how many sellers list it and when each listing was last checked.";

/**
 * The /variety head tags (ported from v2/app/variety/page.tsx
 * generateMetadata): the filter-state title, the shared description,
 * canonical to the clean list on filtered views and self-canonical
 * (page-aware) otherwise. ?sort= is an ordering, not a filter group, so
 * sort-only views stay indexable with a sort-free canonical (robots.txt
 * carries the ?sort= disallow, shipped in Slice 2).
 */
export function varietyBrowseHead(state: BrowseFilterState, page: number): HeadTags {
  const filtered = hasActiveFilters(state);
  return pageHead({
    title: varietyBrowseTitle(state, page),
    description: VARIETY_BROWSE_DESCRIPTION,
    path: filtered ? "/variety" : pagePath("/variety", page),
    noindex: filtered,
  });
}
