import type { ReactNode } from "react";
import "../src/design-system/tokens.css";
import "../src/design-system/fonts.css";
import "../src/shell.css";
import "../src/templates.css";
import { SiteFooter } from "../src/components/SiteFooter";
import { SiteHeader } from "../src/components/SiteHeader";
import { ErrorReporter } from "../src/components/ErrorReporter";
import { RouteAnnouncer } from "../src/components/RouteAnnouncer";
import { TabBar } from "../src/components/TabBar";

/**
 * App shell: skip link, header, main, footer, tab bar, and the
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
      <TabBar />
      <RouteAnnouncer />
      <ErrorReporter />
    </div>
  );
}
