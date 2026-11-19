import { Bar, BreadcrumbSkeleton, CropCardSkeleton, FilterGroupsSkeleton, LoadingShell } from "@/components/ui/Skeleton";

export default function Loading() {
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
