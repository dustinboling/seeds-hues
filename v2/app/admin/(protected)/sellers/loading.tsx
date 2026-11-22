/** Sellers workspace loading: skeletons under the site's delayed-reveal rule. */
export default function AdminSellersLoading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="skeleton skeleton-delayed h-9 w-40" />
      <div className="grid grid-cols-1 gap-4 admin:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="skeleton skeleton-delayed h-11 w-full" />
          <div className="skeleton skeleton-delayed h-11 w-full" />
          <div className="skeleton skeleton-delayed h-20 w-full" />
          <div className="skeleton skeleton-delayed h-20 w-full" />
          <div className="skeleton skeleton-delayed h-20 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="skeleton skeleton-delayed h-9 w-2/3" />
          <div className="skeleton skeleton-delayed h-40 w-full" />
          <div className="skeleton skeleton-delayed h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
