import {
  Bar,
  BreadcrumbSkeleton,
  FilterGroupsSkeleton,
  LoadingShell,
  PaginationSkeleton,
  VarietyGridSkeleton,
} from "@/components/ui/Skeleton";

/**
 * Varieties index loading fallback (soft-404 fix): the former segment loading.tsx, demoted to the
 * inner Suspense fallback inside VarietiesPage. Same tree, same geometry, same "Loading varieties…"
 * label — the bounds check now resolves before anything streams, so pages past the end answer a
 * true 404 instead of streaming this shell with a 200. This is the page's single loading
 * announcement; add no nested LoadingShells.
 */
export function VarietiesSkeleton() {
  return (
    <LoadingShell label="Loading varieties…">
      {/* BreadcrumbSkeleton, never the real Breadcrumbs — its links would be
          focusable inside the aria-hidden tree (§1.1 note). */}
      <BreadcrumbSkeleton />
      <h1 className="text-3xl font-semibold text-leaf">Flower seed varieties</h1>
      <Bar className="mt-2 h-5 w-80 max-w-full" />
      <FilterGroupsSkeleton
        groups={[
          { legendWidth: 52, chips: [48, 192, 198] },
          { legendWidth: 104, chips: [48, 96, 108] },
          { legendWidth: 76, chips: [48, 64, 76, 84] },
          { legendWidth: 30, chips: [48, 72, 70, 66, 74, 78, 74, 66, 86, 74, 66, 86, 74, 78] },
          // Sellers (ux-spec §3.4.4): "All" · "Small farms only".
          { legendWidth: 56, chips: [48, 150] },
        ]}
      />
      <div className="mt-6">
        <VarietyGridSkeleton wide count={10} />
      </div>
      <PaginationSkeleton />
    </LoadingShell>
  );
}
