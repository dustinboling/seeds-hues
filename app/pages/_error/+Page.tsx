import { usePageContext } from "vike-react/usePageContext";
import { SearchForm } from "../../src/components/SearchForm";
import { ThemeArt } from "../../src/components/ThemeArt";
import { APP_SHORT_NAME } from "../../src/site";

/**
 * Error page: the 404 form ports v2/app/not-found.tsx (eyebrow, H1, prose,
 * search box, hub links) — served with a real HTTP 404 for every unknown
 * path. Anything else (render failures) keeps the generic message.
 */
export default function Page() {
  const pageContext = usePageContext();
  const notFound = pageContext.is404 || pageContext.abortStatusCode === 404;
  if (!notFound) {
    return (
      <>
        <h1>{APP_SHORT_NAME}</h1>
        <p>This page could not be loaded.</p>
        <p>
          <a href="/">Back to the start</a>
        </p>
      </>
    );
  }
  return (
    <section className="not-found" aria-labelledby="nf-title">
      <ThemeArt name="offline-path" priority className="art-frame not-found-art" />
      <p className="eyebrow">404</p>
      <h1 id="nf-title">We couldn’t find that page</h1>
      <p className="not-found-copy">The link may be old, or the variety or seller may have been removed.</p>
      <div className="not-found-search">
        <SearchForm label="Search flower seeds" />
      </div>
      <ul className="not-found-links">
        <li>
          <a href="/variety" className="btn btn-secondary">
            All varieties
          </a>
        </li>
        <li>
          <a href="/seller" className="btn btn-secondary">
            All sellers
          </a>
        </li>
        <li>
          <a href="/" className="btn btn-secondary">
            Home
          </a>
        </li>
      </ul>
    </section>
  );
}
