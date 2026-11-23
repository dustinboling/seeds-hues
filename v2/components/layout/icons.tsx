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
/**
 * Removable-chip close mark (Tranche 2.3, SPEC §4.4, rendered change R-3): a drawn
 * × — two diagonal strokes on the family's 24px grid (stroke 1.8, currentColor, no
 * fill), never the Sheet's typographic character. The whole chip stays one hit
 * target; the glyph is decoration, always aria-hidden. The caller sizes it (the
 * listing-list removers render it at 14px via the removable glyph-size token).
 */
export const ChipRemoveIcon = ({ className = "" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </svg>
);
/**
 * Field error mark (Tranche 3.3, FIELD-STATES-DESIGN.md §5.5): a warning triangle holding an
 * exclamation — the same subject the admin error line carries, drawn in this family's hand
 * (24px grid, 20px live area, stroke 1.8, currentColor, no fill). A redundant channel beside
 * the message text, always aria-hidden. The caller sizes it (the set renders it at 16px via
 * size-4). Fallback (the ProtectionIcon precedent): if this glyph fails the family check at
 * the gate, the set ships without it — each usage is a single removable line.
 */
export const FieldErrorIcon = ({ className = "" }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 4.2 20.4 19.4H3.6L12 4.2Z" />
    <path d="M12 9.6v4.2" />
    <path d="M12 16.9v0.3" />
  </svg>
);
/**
 * Field success mark (Tranche 3.3, FIELD-STATES-DESIGN.md §6): a check inside a circle outline,
 * drawn to the family rules. Not the Protection seal (shield + check): that glyph belongs to a
 * legal claim and is never reused as a generic check. The caller sizes it (the set renders it
 * at 20px via size-5). Same fallback as FieldErrorIcon: each usage is one removable line.
 */
export const FieldSuccessIcon = ({ className = "" }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="m8.4 12.3 2.5 2.5 4.9-5.4" />
  </svg>
);
