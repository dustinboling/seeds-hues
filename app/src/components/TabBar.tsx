import { usePageContext } from "vike-react/usePageContext";
import { BloomIcon, FarmIcon, HomeIcon, SearchIcon, SeedIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, match: (p: string) => p === "/" },
  {
    href: "/crop",
    label: "Crops",
    Icon: SeedIcon,
    match: (p: string) => p.startsWith("/crop") || p.startsWith("/series"),
  },
  { href: "/variety", label: "Varieties", Icon: BloomIcon, match: (p: string) => p.startsWith("/variety") },
  {
    href: "/seller",
    label: "Sellers",
    Icon: FarmIcon,
    match: (p: string) => p.startsWith("/seller") || p.startsWith("/state"),
  },
  { href: "/search", label: "Search", Icon: SearchIcon, match: (p: string) => p.startsWith("/search") },
];

/**
 * Mobile bottom tab bar, ported from v2/components/layout/TabBar.tsx (the
 * current live bar — not the frozen D1 redesign). ≥44px targets, safe-area
 * aware, fixed height (no CLS). Theme: paper-deep wash with blur,
 * line-strong top rule, ink-soft icons; the active tab is leaf-deep with a
 * petal dot above its label. Labels are the sans tool layer. Hidden at
 * ≥768px (v2 is md:hidden) — desktop has no bottom bar.
 *
 * The route comes from Vike's page context (the app equivalent of v2's
 * usePathname), so the prerendered HTML carries the right active tab per
 * route, not only after hydration.
 */
export function TabBar() {
  const pathname = usePageContext().urlPathname ?? "/";
  return (
    <nav aria-label="Primary" className="tabbar">
      <ul className="tabbar-list">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="tabbar-item">
              <a
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "tabbar-link tabbar-link-current" : "tabbar-link"}
              >
                <Icon />
                {/* The active marker: a 3px petal dot above the label (space reserved on every tab, no shift). */}
                <span aria-hidden="true" className="tabbar-dot" />
                <span>{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
