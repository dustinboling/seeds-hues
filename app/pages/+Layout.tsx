import type { ReactNode } from "react";
import "../src/design-system/tokens.css";
import "../src/design-system/fonts.css";
import "../src/shell.css";
import "../src/templates.css";
import { SiteFooter } from "../src/components/SiteFooter";
import { SiteHeader } from "../src/components/SiteHeader";
import { RouteAnnouncer } from "../src/components/RouteAnnouncer";
import { TabBarPlaceholder } from "../src/components/TabBarPlaceholder";

/**
 * App shell: skip link, header, main, footer, tab-bar placeholder, and the
 * route-announcement live region. WCAG 2.2 AA: exactly one main landmark, the
 * skip link targets it, and route changes move focus + announce (RouteAnnouncer).
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="shell-main">
        {children}
      </main>
      <SiteFooter />
      <TabBarPlaceholder />
      <RouteAnnouncer />
    </div>
  );
}
