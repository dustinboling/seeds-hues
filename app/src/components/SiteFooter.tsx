import { CONFLICT_OF_INTEREST, OWNER_SITE_URL, TRADEMARK_DISCLAIMER } from "../site";
import { FooterStem } from "./FooterStem";
import { HuesLogo } from "./HuesLogo";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/about/data", label: "About the data" },
  { href: "/about/bot", label: "Our crawler" },
  { href: "/report", label: "Report, claim or remove" },
  { href: "/crop", label: "Crops" },
  { href: "/api-docs", label: "API" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <>
      {/* The thin stem rule centred above the footer, on the page's paper
          ground and outside this paper-deep <footer> element. Decorative.
          Where a bundle divider (PodDivider) is the page's final content,
          that bundle closes the page instead and FooterStem renders nothing. */}
      <FooterStem />
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <a
              href={OWNER_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hues Floral Park (opens in a new tab)"
              className="site-footer-logo-link"
            >
              <HuesLogo className="site-footer-logo" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span aria-hidden="true" className="site-footer-divider" />
            <p className="site-footer-wordmark">Seed Directory</p>
          </div>
          <p>
            Seed Directory (seeds.hues.flowers) is owned and operated by{" "}
            <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer" className="site-footer-owner-link">
              Hues Floral Park
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
          <nav aria-label="Footer">
            <ul className="site-footer-links">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
              <li>
                <a href="/llms.txt">llms.txt</a>
              </li>
            </ul>
          </nav>
          <p>{TRADEMARK_DISCLAIMER}</p>
          <p>{CONFLICT_OF_INTEREST}</p>
          <p>No prices are shown. Every listing shows its stock state as last seen and the date it was last checked. No checkout — every Shop button goes straight to the seller.</p>
        </div>
      </footer>
    </>
  );
}
