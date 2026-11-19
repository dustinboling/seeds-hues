"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { MotifDivider } from "@/components/ui/MotifDivider";

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
 * The footer-adjacent centrepiece: divider motif B (MotifDivider, footer variant — a centred
 * ornament, not a footer rule) on the page's paper ground, just above the paper-deep <footer>
 * element and never inside it. Decorative. Where a bundle divider is the page's final content, the
 * bundle closes the page instead and this renders nothing, so two painted dividers never stack.
 * Re-checked on every route change; the layout effect runs before paint, so the ornament does not
 * flash before hiding on client navigations. Server HTML always includes the slot (suppression is
 * client-side). The slot keeps data-testid="footer-stem" for existing checks.
 *
 * Whitespace: the motif is ~95px tall at 440px wide, so clear space ≥48px each side: mt-16 (64px)
 * above; mb-10 (40px) + the footer's mt-4 (16px) = 56px below. (The body is a flex column, so
 * these margins add rather than collapse.)
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
  return (
    <div aria-hidden="true" className="mb-10 mt-16" data-testid="footer-stem">
      <MotifDivider variant="footer" />
    </div>
  );
}
