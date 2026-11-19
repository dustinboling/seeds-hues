"use client";

import { useEffect, useRef } from "react";

/**
 * Keep-your-place clamp (UX spec 2026-11-19 §2.4). Rendered once per browse surface,
 * alongside the results. Filter/pagination links use scroll={false}, so the browser
 * keeps the visitor's scroll offset across the navigation; if the filtered page is
 * shorter, that offset can land below the last result. After any change to `navKey`,
 * if the whole results region sits above the viewport, scroll the results heading
 * into view — instantly, and without ever moving focus.
 */
export function ResultsScrollClamp({
  targetId,
  regionId,
  navKey,
}: {
  /** Element scrolled into view when the clamp fires (the results count line / heading). */
  targetId: string;
  /** Element tested for "entirely above the viewport" (the results region). */
  regionId: string;
  /** Serialised filter + page (+ query) state; a change means "a list navigation happened". */
  navKey: string;
}) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === navKey) return;
    lastKey.current = navKey;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const region = document.getElementById(regionId);
        const target = document.getElementById(targetId);
        if (!region || !target) return;
        if (region.getBoundingClientRect().bottom < 0) {
          target.scrollIntoView({ block: "start", behavior: "auto" });
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [navKey, regionId, targetId]);

  return null;
}
