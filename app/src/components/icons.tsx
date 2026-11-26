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

/** Tab-bar icons — ported from v2's layout icons (SVG paths copied exactly). */
export function HomeIcon() {
  return (
    <Base>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Base>
  );
}

export function SeedIcon() {
  return (
    <Base>
      <path d="M12 21c-4.5-2.5-6-6.5-6-10a6 6 0 0 1 12 0c0 3.5-1.5 7.5-6 10Z" />
      <path d="M12 21V9" />
    </Base>
  );
}

/** A single bloom on a stem — the Varieties tab, distinct from the Crops seed/leaf mark. */
export function BloomIcon() {
  return (
    <Base>
      <path d="M12 2.8c1.5 1.5 4.3 1.9 4.3 4.4 0 2.4-1.9 4-4.3 4s-4.3-1.6-4.3-4c0-2.5 2.8-2.9 4.3-4.4Z" />
      <path d="M12 11.2V21" />
      <path d="M12 16.2c-2.6.2-4.3-.9-5-3.2 2.3-.3 4.2.7 5 3.2Z" />
      <path d="M12 18.4c2.6.2 4.3-.9 5-3.2-2.3-.3-4.2.7-5 3.2Z" />
    </Base>
  );
}

export function FarmIcon() {
  return (
    <Base>
      <path d="M3 21V11l5-4 5 4v10" />
      <path d="M13 21h8V13l-4-3" />
      <path d="M7 21v-5h2v5" />
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

/** Protection seal icon — the variety page's protection badge. The label carries the meaning. */
export function ProtectionIcon() {
  return (
    <Base>
      <path d="M12 3.2 18.6 5.6v5.2c0 4.3-2.9 7.5-6.6 9.2-3.7-1.7-6.6-4.9-6.6-9.2V5.6L12 3.2Z" />
      <path d="m9.2 11.6 2 2 3.8-4.4" />
    </Base>
  );
}

/** Chevron icons — the filter strip's scroll buttons. The buttons carry the accessible names. */
export function ChevronLeftIcon() {
  return (
    <Base>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Base>
  );
}

export function ChevronRightIcon() {
  return (
    <Base>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Base>
  );
}

/** Phone handset — the seller contact block's phone row. The row's label + number carry the meaning. */
export function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.5 15.9v2.2c0 1-.8 1.9-1.9 1.9C10.7 20 4 13.3 4 5.4c0-1 .8-1.9 1.9-1.9h2.2c.8 0 1.5.5 1.8 1.3l1 2.6c.3.7.1 1.6-.5 2.1l-1.6 1.6c1.1 2.6 3 4.5 5.6 5.6l1.6-1.6c.5-.6 1.4-.8 2.1-.5l2.6 1c.8.3 1.3 1 1.3 1.8Z" />
    </svg>
  );
}

/** Mail mark — the seller contact block's email row. The row's label + address carry the meaning. */
export function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 6.5h17v11h-17Z" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

/**
 * Field error mark (Tranche 3.3, FIELD-STATES-DESIGN.md §5.5): a warning
 * triangle holding an exclamation — ported from v2's layout icons (24px
 * grid, 20px live area, stroke 1.8, currentColor, no fill). A redundant
 * channel beside the message text, always aria-hidden. The caller sizes
 * it via className.
 */
export function FieldErrorIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.2 20.4 19.4H3.6L12 4.2Z" />
      <path d="M12 9.6v4.2" />
      <path d="M12 16.9v0.3" />
    </svg>
  );
}

/**
 * Field success mark (Tranche 3.3, FIELD-STATES-DESIGN.md §6): a check
 * inside a circle outline, ported from v2's layout icons. Not the
 * Protection seal (shield + check): that glyph belongs to a legal claim
 * and is never reused as a generic check. The caller sizes it via
 * className.
 */
export function FieldSuccessIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.4" />
      <path d="m8.4 12.3 2.5 2.5 4.9-5.4" />
    </svg>
  );
}

/** Remover cross — the applied row's remover chips. The chip's aria-label carries the meaning. */
export function ChipRemoveIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`chip-remove-glyph${className ? ` ${className}` : ""}`}
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
