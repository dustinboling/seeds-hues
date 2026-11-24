import { APP_SHORT_NAME, CONFLICT_OF_INTEREST, SITE_NAME, TRADEMARK_DISCLAIMER } from "../site";

/**
 * Shell footer: the directory's name plus the two standing disclosure lines,
 * ported verbatim from v2/lib/config.ts. No new copy.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-wordmark">
          {APP_SHORT_NAME} <span className="site-footer-domain">{SITE_NAME}</span>
        </p>
        <p>{TRADEMARK_DISCLAIMER}</p>
        <p>{CONFLICT_OF_INTEREST}</p>
      </div>
    </footer>
  );
}
