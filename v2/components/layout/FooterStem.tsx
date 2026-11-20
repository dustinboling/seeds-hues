"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";

/** How far down main's lastElementChild chain a closing bundle divider may sit. */
const MAX_DEPTH = 5;

/**
 * True when the last bundle divider (PodDivider, data-testid="pod-divider") inside <main> is the
 * page's final content element: walking from main.lastElementChild down the lastElementChild
 * chain (up to MAX_DEPTH levels) reaches that divider.
 */
function pageEndsWithBundle(): boolean {
  const main = document.querySelector("main");
  if (!main) return false;
  const dividers = main.querySelectorAll('[data-testid="pod-divider"]');
  const last = dividers[dividers.length - 1];
  if (!last) return false;
  let el = main.lastElementChild;
  for (let depth = 0; el && depth < MAX_DEPTH; depth++) {
    if (el === last) return true;
    el = el.lastElementChild;
  }
  return false;
}

/**
 * The sprout-rule divider above the footer (theme §3). Decorative. Where a bundle divider is the
 * page's final content, the bundle replaces the sprout rule and this renders nothing, so the two
 * dividers never stack. Re-checked on every route change; the layout effect runs before paint,
 * so the stem does not flash before hiding on client navigations.
 */
export function FooterStem() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    // Reads the committed DOM of <main> (outside this component) and updates before paint: the
    // measure-then-render case layout effects exist for, so the extra render is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(pageEndsWithBundle());
  }, [pathname]);
  if (hidden) return null;
  return <div aria-hidden="true" className="divider-stem mt-16" data-testid="footer-stem" />;
}
