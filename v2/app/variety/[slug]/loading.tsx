import { Bar, BreadcrumbSkeleton, HeroArtSkeleton, ListingSheetSkeleton, LoadingShell } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingShell label="Loading variety…">
      <BreadcrumbSkeleton />
      <div className="flex items-start gap-4">
        <Bar className="h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Bar className="h-4 w-44 max-w-full" />
          <Bar className="mt-1 h-9 w-72 max-w-full" />
          <Bar className="mt-1 h-6 w-48 max-w-full" />
          <Bar className="mt-2 h-6 w-96 max-w-full" />
        </div>
      </div>
      <HeroArtSkeleton />
      <Bar className="mt-6 h-8 w-80 max-w-full" />
      <ListingSheetSkeleton rows={3} className="mt-3" />
      <Bar className="mt-3 h-4 w-72 max-w-full" />
      <Bar className="mt-8 h-6 w-36" />
      <div className="card mt-3 grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <Bar className="h-4 w-20" />
            <Bar className="mt-0.5 h-5 w-40 max-w-full" />
          </div>
        ))}
      </div>
      <Bar className="mt-6 h-6 w-52 max-w-full" />
      <Bar className="mt-2 h-4 w-full max-w-3xl" />
      <Bar className="mt-2 h-4 w-full max-w-3xl" />
      <Bar className="mt-2 h-4 w-2/3 max-w-3xl" />
    </LoadingShell>
  );
}
