"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/layout/icons";

type ScrollState = { overflow: boolean; canLeft: boolean; canRight: boolean };

const INITIAL: ScrollState = { overflow: false, canLeft: false, canRight: false };

/**
 * One filter group's chips as a single-line, horizontally scrollable strip (never wraps).
 * Edge fades show which side has more chips (all pointer types; the touch affordance). Chevron
 * buttons scroll by ~70% of the visible width; .filter-strip-btn shows them only on
 * hover-capable fine pointers (mouse/trackpad). Fades and buttons appear after hydration
 * measures the row; the SSR markup is just the list.
 */
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

  const btn =
    "filter-strip-btn absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-paper text-ink shadow-strip-button disabled:cursor-default disabled:opacity-40";

  return (
    <div className="relative">
      <ul
        ref={ref}
        className="flex flex-nowrap items-center gap-2 overflow-x-auto px-1 py-1 -mx-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      {state.canLeft ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-paper to-transparent" />
      ) : null}
      {state.canRight ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper to-transparent" />
      ) : null}
      {state.overflow ? (
        <>
          <button
            type="button"
            className={`${btn} left-0`}
            aria-label={`Scroll ${legend} left`}
            disabled={!state.canLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={`${btn} right-0`}
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
