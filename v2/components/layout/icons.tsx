/** Inline SVG icons (no icon font, no requests). Decorative: aria-hidden. */
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const SeedIcon = () => (
  <svg {...base}>
    <path d="M12 21c-4.5-2.5-6-6.5-6-10a6 6 0 0 1 12 0c0 3.5-1.5 7.5-6 10Z" />
    <path d="M12 21V9" />
  </svg>
);
/** A single bloom on a stem — the Varieties tab, distinct from the Crops seed/leaf mark. */
export const BloomIcon = () => (
  <svg {...base}>
    <path d="M12 2.8c1.5 1.5 4.3 1.9 4.3 4.4 0 2.4-1.9 4-4.3 4s-4.3-1.6-4.3-4c0-2.5 2.8-2.9 4.3-4.4Z" />
    <path d="M12 11.2V21" />
    <path d="M12 16.2c-2.6.2-4.3-.9-5-3.2 2.3-.3 4.2.7 5 3.2Z" />
    <path d="M12 18.4c2.6.2 4.3-.9 5-3.2-2.3-.3-4.2.7-5 3.2Z" />
  </svg>
);
export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const FarmIcon = () => (
  <svg {...base}>
    <path d="M3 21V11l5-4 5 4v10" />
    <path d="M13 21h8V13l-4-3" />
    <path d="M7 21v-5h2v5" />
  </svg>
);
/** Account (person) icon — header link to /account. The link carries the accessible name. */
export const PersonIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
  </svg>
);
/** Menu (hamburger) icon — header disclosure button. The button carries the accessible name. */
export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
);
/** Chevrons — filter-strip scroll buttons. The button carries the accessible name. */
export const ChevronLeftIcon = () => (
  <svg {...base}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);
export const ChevronRightIcon = () => (
  <svg {...base}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);
/**
 * Protection seal — the variety-page protection notice mark (Tranche 2.2, SPEC §3.5):
 * an outline shield holding a check, drawn to the interface icon family's rules
 * (24px grid, 20px live area, stroke 1.8, currentColor, no fill). The label text
 * carries the meaning alone; the icon is a redundant channel, always aria-hidden.
 * The caller sizes it (the notice renders it at 16px via size-4).
 */
export const ProtectionIcon = ({ className = "" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 3.2 18.6 5.6v5.2c0 4.3-2.9 7.5-6.6 9.2-3.7-1.7-6.6-4.9-6.6-9.2V5.6L12 3.2Z" />
    <path d="m9.2 11.6 2 2 3.8-4.4" />
  </svg>
);
