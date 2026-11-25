import { ThemeArt } from "../../src/components/ThemeArt";

/**
 * /offline — ported verbatim from v2/app/offline/page.tsx (copy, links,
 * artwork). PWA offline fallback (P7): static, precached by the service
 * worker, noindex, never in a sitemap.
 */
export default function Page() {
  return (
    <section className="offline-fallback" aria-labelledby="offline-title">
      <ThemeArt name="offline-path" priority className="art-frame offline-art" />
      <h1 id="offline-title">You’re offline</h1>
      <p className="offline-copy">
        This page hasn’t been saved on your device yet. Pages you have already opened still work offline — showing the
        last version we saved.
      </p>
      <p className="offline-reconnect">Reconnect to search and to see the latest stock states.</p>
      <ul className="offline-links">
        <li>
          <a href="/" className="btn btn-primary">
            Go to the home page
          </a>
        </li>
        <li>
          <a href="/variety" className="btn btn-secondary">
            Varieties
          </a>
        </li>
        <li>
          <a href="/seller" className="btn btn-secondary">
            Sellers
          </a>
        </li>
      </ul>
    </section>
  );
}
