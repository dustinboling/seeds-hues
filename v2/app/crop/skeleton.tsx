import { Bar, BreadcrumbSkeleton, CropCardSkeleton, FilterGroupsSkeleton, LoadingShell } from "@/components/ui/Skeleton";

/**
 * The crop index's loading skeleton — formerly this segment's loading.tsx, moved
 * verbatim (same components, classes, "Loading crops…" label). It lives here as the
 * inner Suspense fallback of app/crop/page.tsx because a segment loading.tsx in
 * app/crop/ also wraps every /crop/[slug] page below it in its Suspense boundary:
 * the shell then streams with HTTP 200 before the detail page's notFound() can
 * resolve, which is the soft-404 defect fixed on the [slug] routes. The detail
 * pages carry their own inner fallbacks (app/crop/[slug]/skeleton.tsx).
 */
export function CropsSkeleton() {
  return (
    <LoadingShell label="Loading crops…">
      <BreadcrumbSkeleton />
      <h1 className="text-3xl font-semibold text-leaf">Crops</h1>
      <Bar className="mt-2 h-5 w-72 max-w-full" />
      <FilterGroupsSkeleton
        groups={[
          { legendWidth: 52, chips: [48, 192, 198] },
          { legendWidth: 104, chips: [48, 96, 108] },
        ]}
      />
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <CropCardSkeleton />
          </li>
        ))}
      </ul>
    </LoadingShell>
  );
}
