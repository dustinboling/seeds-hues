/** Inline SVG icons (no icon font, no requests). Decorative: aria-hidden. Ported from v2's layout icons. */
import type { SVGProps } from "react";

function Base({ children }: { children: React.ReactNode }) {
  const props: SVGProps<SVGSVGElement> = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };
  return <svg {...props}>{children}</svg>;
}

export function SearchIcon() {
  return (
    <Base>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Base>
  );
}

/** Account (person) icon — header link to /account. The link carries the accessible name. */
export function PersonIcon() {
  return (
    <Base>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
    </Base>
  );
}

/** Menu (hamburger) icon — header disclosure button. The button carries the accessible name. */
export function MenuIcon() {
  return (
    <Base>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Base>
  );
}
