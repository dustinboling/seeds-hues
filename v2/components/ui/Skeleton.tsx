import type { CSSProperties, ReactNode } from "react";

/**
 * Route-loading skeleton kit (UX spec 2026-11-19 §1). Server Components; geometry only —
 * a loading.tsx receives no params/searchParams in this Next version, so no name, count
 * or query can ever appear here. The whole visual tree is aria-hidden (LoadingShell);
 * assistive technology gets exactly one polite status line instead.
 */

/** Wrapper every loading.tsx returns. `label` is the sr-only announcement, e.g. "Loading varieties…". */
export function LoadingShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <p className="sr-only" role="status">
        {label}
      </p>
      <div aria-hidden="true" className="skeleton-delayed">
        {children}
      </div>
    </>
  );
}

/** One placeholder block. Geometry comes entirely from className (+ optional fixed width via style). */
export function Bar({ className, style }: { className: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/** Breadcrumb stand-in: a bar in a box with the real Breadcrumbs block's height (44 px mobile, ~21 px sm+). */
export function BreadcrumbSkeleton() {
  return (
    <div className="mb-4 flex min-h-[44px] items-center sm:min-h-[1.3125rem]">
      <Bar className="h-4 w-44 max-w-[60vw]" />
    </div>
  );
}

/**
 * BrowseFilters stand-in: one legend bar + one single-line chip row per group, in the real
 * container's classes (mt-4 flex flex-col gap-3). Chip rows never wrap and clip instead of
 * scrolling — the tree is aria-hidden and inert, so scrollability would buy nothing.
 * `chips` are pixel widths in render order; counts must match the real groups (see §1.4).
 */
export function FilterGroupsSkeleton({ groups }: { groups: { legendWidth: number; chips: number[] }[] }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {groups.map((g, i) => (
        <div key={i} className="min-w-0">
          <Bar className="mb-1 h-4" style={{ width: g.legendWidth }} />
          <div className="-mx-1 flex flex-nowrap items-center gap-2 overflow-hidden px-1 py-1">
            {g.chips.map((w, j) => (
              <Bar key={j} className="h-11 shrink-0 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** VarietyCard stand-in: exact card anatomy — 1:2 art frame, mini-stem bar, fixed h-[6.25rem] name zone. Not a link. */
export function VarietyCardSkeleton() {
  return (
    <div className="card packet flex h-full flex-col items-center p-4 text-center">
      <Bar className="card-image mb-2 aspect-[1/2] w-full rounded-lg" />
      <Bar className="mt-1 h-3 w-10" />
      <div className="flex h-[6.25rem] flex-col items-center justify-center gap-2">
        <Bar className="h-5 w-4/5" />
        <Bar className="h-4 w-1/2" />
        <Bar className="h-4 w-2/5" />
      </div>
    </div>
  );
}

/** VarietyGrid stand-in: the grid's real classes, both variants. `count` per §1.4. */
export function VarietyGridSkeleton({ wide = false, count }: { wide?: boolean; count: number }) {
  return (
    <ul
      className={
        wide ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="h-full">
          <VarietyCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** /crop index card stand-in: CropCardImage's 1:2 frame + name / latin / count bars. Not a link. */
export function CropCardSkeleton() {
  return (
    <div className="card relative p-4">
      <Bar className="card-image mb-2 aspect-[1/2] w-full rounded-lg" />
      <Bar className="h-6 w-3/4" />
      <Bar className="mt-1 h-4 w-1/2" />
      <Bar className="mt-1 h-4 w-2/5" />
    </div>
  );
}

/**
 * ListingRow stand-in (Quiet Ledger cards, 2026-11-20): a stack of separate cards, 12 px apart.
 * The opt-in `artwork` variant promises the seller-context card instead: the artwork rail block
 * beside the text bars, footers full-width below, and the seller list's lg 2-column grid. The
 * seller loading shell opts in; the variety shell keeps the default (no artwork, no grid).
 */
export function ListingSheetSkeleton({ rows, className, artwork = false }: { rows: number; className?: string; artwork?: boolean }) {
  const bars = (
    <>
      <Bar className="h-6 w-44 max-w-[55%]" />
      <Bar className="mt-1 h-4 w-32" />
      <Bar className="mt-2 h-3 w-40" />
    </>
  );
  return (
    <ul className={`flex flex-col gap-3${artwork ? " lg:grid lg:grid-cols-2" : ""} ${className ?? ""}`}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className={artwork ? "h-full" : undefined}>
          <div
            className={`rounded-[18px] border border-[#e9dfc2] bg-surface px-4 pb-3 pt-[18px] shadow-[0_6px_20px_rgba(151,134,95,0.14)]${artwork ? " h-full" : ""}`}
          >
            {artwork ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
                <Bar className="aspect-[1/2] w-18 rounded-lg sm:w-24" />
                <div className="min-w-0">{bars}</div>
              </div>
            ) : (
              bars
            )}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgba(151,134,95,0.45)] pt-2">
              <Bar className="h-4 w-24" />
              <Bar className="h-11 w-32 shrink-0 rounded-full" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pagination stand-in: Previous block, three page blocks, Next block, in the real nav's classes. */
export function PaginationSkeleton() {
  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <Bar className="h-11 w-28 rounded-xl" />
      <Bar className="h-11 w-11 rounded-xl" />
      <Bar className="h-11 w-11 rounded-xl" />
      <Bar className="h-11 w-11 rounded-xl" />
      <Bar className="h-11 w-24 rounded-xl" />
    </div>
  );
}

/** VarietyHeroImage stand-in: the 1:2 hero frame at its real max width. */
export function HeroArtSkeleton() {
  return <Bar className="mt-6 aspect-[1/2] w-full max-w-[380px] rounded-[18px]" />;
}
