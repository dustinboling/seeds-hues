import {
  Bar,
  BreadcrumbSkeleton,
  FilterGroupsSkeleton,
  LoadingShell,
  PaginationSkeleton,
  VarietyGridSkeleton,
} from "@/components/ui/Skeleton";

/**
 * The variety index's loading skeleton — formerly this segment's loading.tsx, moved
 * verbatim (same components, classes, "Loading varieties…" label). It lives here as the
 * inner Suspense fallback of app/variety/page.tsx because a segment loading.tsx streams
 * its shell with HTTP 200 before the page's assertPageInRange guard can resolve, answering
 * out-of-range pages with a 200 shell instead of a true 404 (the soft-404 defect PR #11
 * fixed on the seller/crop/state routes). The detail page below carries its own boundary
 * (app/variety/[slug]/loading.tsx), unaffected by this move.
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
