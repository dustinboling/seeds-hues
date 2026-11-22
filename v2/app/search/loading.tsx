import { Bar, FilterGroupsSkeleton, LoadingShell } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingShell label="Loading search results…">
      <h1 className="text-3xl font-semibold text-leaf">Search</h1>
      <Bar className="mt-4 h-14 w-full max-w-2xl rounded-search" />
      <Bar className="mt-8 h-7 w-64 max-w-full" />
      <FilterGroupsSkeleton
        groups={[
          { legendWidth: 52, chips: [48, 192, 198] },
          { legendWidth: 104, chips: [48, 96, 108] },
          { legendWidth: 30, chips: [48, 72, 70, 66, 74, 78, 74, 66, 86, 74, 66, 86, 74, 78] },
        ]}
      />
      {[3, 3].map((rows, g) => (
        <div key={g} className="mt-6">
          <Bar className="h-4 w-20" />
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className="px-4 py-3">
                <Bar className="h-5 w-56 max-w-[70%]" />
                <Bar className="mt-1 h-4 w-40 max-w-[55%]" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </LoadingShell>
  );
}
