"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BloomIcon, FarmIcon, HomeIcon, SearchIcon, SeedIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/crop", label: "Crops", Icon: SeedIcon, match: (p: string) => p.startsWith("/crop") || p.startsWith("/series") },
  { href: "/variety", label: "Varieties", Icon: BloomIcon, match: (p: string) => p.startsWith("/variety") },
  { href: "/seller", label: "Farms", Icon: FarmIcon, match: (p: string) => p.startsWith("/seller") || p.startsWith("/state") },
  { href: "/search", label: "Search", Icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
];

/**
 * Mobile bottom tab bar (P8): ≥44 pt targets, safe-area aware, fixed height (no CLS).
 * Theme: paper-deep wash with blur, line-strong top rule, ink-soft icons; the active tab is
 * leaf-deep with a petal dot above its label. Labels are the sans tool layer.
 */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-paper-deep/92 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`tap flex flex-1 flex-col items-center justify-center gap-0.5 font-sans text-xs font-semibold no-underline transition-colors duration-150 ease-out ${
                  active ? "text-leaf" : "text-ink-soft"
                }`}
              >
                <Icon />
                {/* The active marker: a 3 px petal dot above the label (space reserved on every tab, no shift). */}
                <span aria-hidden="true" className={`block size-[3px] rounded-full ${active ? "bg-petal" : "bg-transparent"}`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
