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
