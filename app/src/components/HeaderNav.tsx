import { usePageContext } from "vike-react/usePageContext";

/**
 * The visible header nav, in display order. Add Your Farm is last and lg-only:
 * the 768–1023px band keeps the four-link nav beside the still-present
 * hamburger, and at lg the full set takes over as the hamburger retires.
 * Labels and hrefs are the header side of the header/footer no-orphan
 * contract; About stays footer-carried (and in the hamburger menu below lg).
 */
export const HEADER_NAV = [
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Sellers" },
  { href: "/search", label: "Search" },
  { href: "/add-your-farm", label: "Add Your Farm" },
];

/** HeaderMenu's prefix-match rule, shared so both navs agree on the current section. */
export const isCurrentSection = (pathname: string, href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

export function HeaderNav() {
  const pathname = usePageContext().urlPathname ?? "/";
  return (
    <nav aria-label="Main" className="header-nav">
      <ul>
        {HEADER_NAV.map((n, i) => {
          const current = isCurrentSection(pathname, n.href);
          const takeoverOnly = i === HEADER_NAV.length - 1;
          return (
            <li key={n.href} className={takeoverOnly ? "header-nav-takeover" : undefined}>
              <a href={n.href} aria-current={current ? "page" : undefined} className={`header-nav-link${current ? " header-nav-current" : ""}`}>
                {n.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
