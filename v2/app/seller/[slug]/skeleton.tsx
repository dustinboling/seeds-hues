import { Bar, BreadcrumbSkeleton, ListingSheetSkeleton, LoadingShell, PaginationSkeleton } from "@/components/ui/Skeleton";

/**
 * Seller page loading fallback (soft-404 fix): the former segment loading.tsx, demoted to the
 * inner Suspense fallback inside SellerPage. Same tree, same geometry — the page's existence
 * check now resolves before anything streams, so unknown slugs 404 instead of streaming this
 * shell with a 200. This is the page's single loading announcement; add no nested LoadingShells.
 */
export function SellerSkeleton() {
  return (
    <LoadingShell label="Loading seller…">
      <BreadcrumbSkeleton />
      {/* Real <header>: stacked below sm, two-column at sm+. Summary first, plate second. */}
      <div className="sm:flex sm:items-start sm:gap-8">
        <div className="min-w-0 flex-1">
          <Bar className="h-4 w-24" />
          <Bar className="mt-1 h-9 w-72 max-w-full md:h-10" />
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            {/* Location — the tall cell: dt + dd + the state-link row (22 px shape + name, ≈30 px). */}
            <div>
              <Bar className="h-4 w-16" />
              <Bar className="mt-0.5 h-5 w-28 max-w-full" />
              <Bar className="mt-1 h-[30px] w-28" />
            </div>
            {/* Varieties listed */}
            <div>
              <Bar className="h-4 w-24" />
              <Bar className="mt-0.5 h-5 w-16 max-w-full" />
            </div>
            {/* Rating */}
            <div>
              <Bar className="h-4 w-12" />
              <Bar className="mt-0.5 h-5 w-28 max-w-full" />
            </div>
          </div>
          <Bar className="mt-4 h-11 w-56 max-w-full rounded-xl" />
        </div>
        {/* StatePlate stand-in: the figure's own classes; aspect-square and rounded-[18px]
            come from its 1600×1600 .art-frame img (--radius-card: 18px). */}
        <Bar className="mx-auto mt-6 aspect-square w-[280px] shrink-0 rounded-[18px] sm:mx-0 sm:mt-1 sm:w-[300px] lg:w-[320px]" />
      </div>
      {/* About section (mt-6 max-w-3xl): text-xl heading + description / ordering-notes lines. */}
      <div className="mt-6 max-w-3xl">
        <Bar className="h-7 w-44" />
        <Bar className="mt-2 h-4 w-full" />
        <Bar className="mt-2 h-4 w-3/4" />
      </div>
      {/* ImportedRatingPanel: conditional, omitted — see the block table above. */}
      <Bar className="mt-8 h-8 w-64 max-w-full" />
      <Bar className="mt-1 h-5 w-32" />
      <ListingSheetSkeleton rows={4} className="mt-3" />
      <PaginationSkeleton />
      {/* "Is this your farm? Claim, correct or remove…" — the article's last block. */}
      <Bar className="mt-8 h-4 w-80 max-w-full" />
    </LoadingShell>
  );
}
