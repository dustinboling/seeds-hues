import { Bar, BreadcrumbSkeleton, ListingSheetSkeleton, LoadingShell, PaginationSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingShell label="Loading seller…">
      <BreadcrumbSkeleton />
      <div className="sm:flex sm:items-start sm:gap-8">
        <div className="min-w-0 flex-1">
          <Bar className="h-4 w-24" />
          <Bar className="mt-1 h-10 w-64 max-w-full" />
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i}>
                <Bar className="h-4 w-16" />
                <Bar className="mt-0.5 h-5 w-28 max-w-full" />
              </div>
            ))}
          </div>
          <Bar className="mt-4 h-11 w-56 max-w-full rounded-xl" />
        </div>
        <Bar className="mx-auto mt-6 aspect-square w-[280px] shrink-0 rounded-[18px] sm:mx-0 sm:mt-1 sm:w-[300px] lg:w-[320px]" />
      </div>
      <Bar className="mt-6 h-6 w-40" />
      <Bar className="mt-2 h-4 w-full max-w-3xl" />
      <Bar className="mt-2 h-4 w-3/4 max-w-3xl" />
      <Bar className="mt-8 h-8 w-64 max-w-full" />
      <Bar className="mt-1 h-5 w-32" />
      <ListingSheetSkeleton rows={4} className="mt-3" />
      <PaginationSkeleton />
    </LoadingShell>
  );
}
