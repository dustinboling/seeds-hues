"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The visible header nav, in display order. Add Your Farm is last and lg-only
 * (`hidden lg:block` on its item): the 768-1023px band keeps the four-link nav beside
 * the still-present hamburger, and at lg the full set takes over as the hamburger
 * retires. Labels and hrefs are the header side of the header/footer no-orphan
 * contract: at desktop the header carries these five links plus the account icon
 * (My Account); About stays footer-carried (and in the hamburger menu below lg).
 */
export const HEADER_NAV = [
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Sellers" },
  { href: "/search", label: "Search" },
  { href: "/add-your-farm", label: "Add Your Farm" },
];

/** HeaderMenu's prefix-match rule, shared so both navs agree on the current section. */
const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {HEADER_NAV.map((n, i) => {
          const current = isCurrent(pathname, n.href);
          const takeoverOnly = i === HEADER_NAV.length - 1;
          return (
            <li key={n.href} className={takeoverOnly ? "hidden lg:block" : undefined}>
              <Link
                href={n.href}
                aria-current={current ? "page" : undefined}
                className={`tap inline-flex items-center rounded-inner px-3 font-sans no-underline transition-colors duration-150 ease-out hover:bg-leaf-50 hover:text-leaf lg:px-2 ${current ? "font-semibold text-leaf" : "font-medium text-ink"}`}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
