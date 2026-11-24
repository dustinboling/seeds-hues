import { HeaderMenu } from "./HeaderMenu";
import { HeaderNav } from "./HeaderNav";
import { HuesLogo } from "./HuesLogo";
import { PersonIcon } from "./icons";

/**
 * Header on the plate paper: paper ground, `line` hairline, Fraunces
 * wordmark, sans nav. Both logo and wordmark link to "/" (the Seed Directory
 * home); the path back to Hues Floral Park lives in the footer. About lives
 * in the footer, not the header nav.
 *
 * Layout contract (compact header): a single row at every width, nothing
 * wraps. Mobile: Hues logo at 24px + one-line "Seed Directory" wordmark, no
 * divider, no byline. md: logo 44px, the divider joins, the sans nav appears
 * (Crops · Varieties · Sellers · Search). lg: the nav gains Add Your Farm
 * and the hamburger retires; the "by Hues Floral Park" byline appears inline
 * (in the DOM below lg, hidden). Right side: nav (md+), account icon, menu.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-lockup">
          <a href="/" aria-label="Seed Directory — home" className="site-logo-link">
            <HuesLogo className="site-logo" />
          </a>
          <span aria-hidden="true" className="site-lockup-divider" />
          <a href="/" className="site-wordmark">
            <span className="site-wordmark-name">Seed Directory</span>
            <span className="site-wordmark-byline">by Hues Floral Park</span>
          </a>
        </div>
        <div className="site-header-right">
          <HeaderNav />
          <a href="/account" aria-label="Your account" className="header-icon-button" data-testid="header-account">
            <PersonIcon />
          </a>
          <HeaderMenu />
        </div>
      </div>
    </header>
  );
}
