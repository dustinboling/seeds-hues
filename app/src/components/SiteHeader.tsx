import { APP_SHORT_NAME, SITE_NAME } from "../site";

/**
 * Shell header: the directory's wordmark lockup (existing names only — no new
 * copy). The single link targets the one real route; nav for later slices'
 * routes is not stubbed here.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-wordmark" href="/" aria-label={`${APP_SHORT_NAME} — home`}>
          <span className="site-wordmark-name">{APP_SHORT_NAME}</span>
          <span className="site-wordmark-domain">{SITE_NAME}</span>
        </a>
      </div>
    </header>
  );
}
