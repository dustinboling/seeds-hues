import { Bar, BreadcrumbSkeleton, HeroArtSkeleton, LoadingShell, PaginationSkeleton, VarietyGridSkeleton } from "@/components/ui/Skeleton";

/**
 * Crop page loading fallback (soft-404 fix): the former segment loading.tsx, demoted to the
 * inner Suspense fallback inside CropPage. Same tree, same geometry — the page's existence
 * check now resolves before anything streams, so unknown slugs 404 instead of streaming this
 * shell with a 200. This is the page's single loading announcement; add no nested LoadingShells.
 */
export function CropSkeleton() {
  return (
    <LoadingShell label="Loading crop…">
      <BreadcrumbSkeleton />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Bar className="h-9 w-64 max-w-full" />
          <Bar className="mt-1 h-6 w-40 max-w-full" />
          <Bar className="mt-2 h-5 w-80 max-w-full" />
          <Bar className="mt-1 h-4 w-56 max-w-full" />
          <Bar className="mt-1 h-4 w-56 max-w-full" />
          <Bar className="mt-1 h-4 w-48 max-w-full" />
        </div>
        <Bar className="h-24 w-24 shrink-0 rounded-lg sm:h-36 sm:w-36" />
      </div>
      <HeroArtSkeleton />
      <Bar className="mt-4 h-28 w-full max-w-3xl rounded-lg" />
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Bar className="h-4 w-14" />
          <Bar className="h-11 w-12 shrink-0 rounded-full" />
          <Bar className="h-11 w-28 shrink-0 rounded-full" />
          <Bar className="h-11 w-32 shrink-0 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bar className="h-4 w-10" />
          <Bar className="h-11 w-12 shrink-0 rounded-full" />
          <Bar className="h-11 w-16 shrink-0 rounded-full" />
          <Bar className="h-11 w-20 shrink-0 rounded-full" />
          <Bar className="h-11 w-24 shrink-0 rounded-full" />
          <Bar className="h-11 w-16 shrink-0 rounded-full" />
        </div>
      </div>
      <Bar className="mt-4 h-5 w-56 max-w-full" />
      <div className="mt-3">
        <VarietyGridSkeleton count={8} />
      </div>
      <PaginationSkeleton />
      <div className="card mt-8 max-w-3xl p-4 sm:p-6">
        <Bar className="h-6 w-48 max-w-full" />
        <div className="mt-3 flex gap-2">
          <Bar className="h-10 w-28 rounded-lg" />
          <Bar className="h-10 w-28 rounded-lg" />
          <Bar className="h-10 w-28 rounded-lg" />
        </div>
        <Bar className="mt-3 h-4 w-full" />
        <Bar className="mt-2 h-4 w-full" />
        <Bar className="mt-2 h-4 w-3/4" />
      </div>
    </LoadingShell>
  );
}
