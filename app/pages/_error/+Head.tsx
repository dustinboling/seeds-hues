import { usePageContext } from "vike-react/usePageContext";
import { SITE_NAME } from "../../src/site";

// Error pages carry a title and noindex (the HTTP status is the real
// signal; nothing here is crawled content). No canonical: error URLs must
// not present themselves as canonical anything. The robots value is the
// bare "noindex" — live-exact (the live 404 meta and v2's Gone page both
// read exactly "noindex"; follow is the default either way).
export function Head() {
  const pageContext = usePageContext();
  const gone = pageContext.abortStatusCode === 410;
  const notFound = pageContext.is404 || pageContext.abortStatusCode === 404;
  const title = gone ? "Seller removed" : notFound ? "Page not found" : "Something went wrong";
  return (
    <>
      <title>{`${title} | ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />
    </>
  );
}
