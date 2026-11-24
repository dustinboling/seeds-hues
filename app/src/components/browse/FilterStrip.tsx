/**
 * One filter group's chips as a single-line, horizontally scrollable strip
 * (never wraps) — ported from v2/components/ui/FilterStrip.tsx (same
 * measure/scroll/fade/chevron behavior; plain CSS classes instead of
 * Tailwind). Edge fades show which side has more chips (all pointer
 * types); chevron buttons scroll by ~70% of the visible width and show
 * only on hover-capable fine pointers. Fades and buttons appear after
 * hydration measures the row; the SSR markup is just the list.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

type ScrollState = { overflow: boolean; canLeft: boolean; canRight: boolean };

const INITIAL: ScrollState = { overflow: false, canLeft: false, canRight: false };

export function FilterStrip({ legend, children }: { legend: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [state, setState] = useState<ScrollState>(INITIAL);

  const measure = useCallback(() => {
    const ul = ref.current;
    if (!ul) return;
    const { scrollLeft, scrollWidth, clientWidth } = ul;
    const next: ScrollState = {
      overflow: scrollWidth > clientWidth,
      canLeft: scrollLeft > 1,
      canRight: scrollLeft < scrollWidth - clientWidth - 1,
    };
    setState((prev) =>
      prev.overflow === next.overflow && prev.canLeft === next.canLeft && prev.canRight === next.canRight ? prev : next,
    );
  }, []);

  useEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    measure();
    ul.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(ul);
    return () => {
      ul.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure]);

  const scroll = (dir: -1 | 1) => {
    const ul = ref.current;
    if (!ul) return;
    ul.scrollBy({ left: dir * Math.round(ul.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className="filter-strip">
      <ul ref={ref} className="filter-strip-list">
        {children}
      </ul>
      {state.canLeft ? <div aria-hidden="true" className="filter-strip-fade filter-strip-fade-left" /> : null}
      {state.canRight ? <div aria-hidden="true" className="filter-strip-fade filter-strip-fade-right" /> : null}
      {state.overflow ? (
        <>
          <button
            type="button"
            className="filter-strip-btn filter-strip-btn-left"
            aria-label={`Scroll ${legend} left`}
            disabled={!state.canLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="filter-strip-btn filter-strip-btn-right"
            aria-label={`Scroll ${legend} right`}
            disabled={!state.canRight}
            onClick={() => scroll(1)}
          >
            <ChevronRightIcon />
          </button>
        </>
      ) : null}
    </div>
  );
}
