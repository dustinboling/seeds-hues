/** Statistics loading: skeletons matching the header band + card grid, under the site's delayed-reveal rule. */
export default function AdminStatisticsLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="skeleton skeleton-delayed h-9 w-40" />
      <div className="flex flex-wrap gap-2">
        <div className="skeleton skeleton-delayed h-11 w-24" />
        <div className="skeleton skeleton-delayed h-11 w-24" />
        <div className="skeleton skeleton-delayed h-11 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[744px]:grid-cols-2">
        <div className="skeleton skeleton-delayed h-64 w-full" />
        <div className="skeleton skeleton-delayed h-64 w-full" />
        <div className="skeleton skeleton-delayed h-64 w-full" />
        <div className="skeleton skeleton-delayed h-64 w-full" />
      </div>
      <div className="skeleton skeleton-delayed h-9 w-48" />
      <div className="skeleton skeleton-delayed h-80 w-full" />
    </div>
  );
}
