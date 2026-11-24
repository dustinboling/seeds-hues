import { useEffect, useRef } from "react";

/**
 * Keep-your-place clamp. Ported from v2/components/ui/ResultsScrollClamp.tsx:
 * after any change to `navKey`, if the whole results region sits above the
 * viewport, scroll the results heading into view — instantly, and without
 * ever moving focus. Renders null.
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
