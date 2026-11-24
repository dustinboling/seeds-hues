import { BOT_NAME, BOT_USER_AGENT } from "../../../src/site";

/**
 * /about/bot — ported verbatim from v2/app/about/bot/page.tsx. Standing-rule
 * spelling normalizations (US spelling, same as the gated /about):
 * "honouring" → "honoring", "honoured" → "honored".
 */
export default function Page() {
  return (
    <article className="prose-plain" aria-labelledby="bot-title">
      <h1 id="bot-title">Our crawler</h1>
      <p className="prose-lede">
        {BOT_NAME} reads the public shop pages of sellers listed in this directory to keep stock states and check dates
        current. At launch, listings are checked by hand; when automated checks start they follow every rule below.
      </p>

      <h2>User agent</h2>
      <p>
        <code>{BOT_USER_AGENT}</code>
      </p>

      <h2>robots.txt</h2>
      <ul>
        <li>We read robots.txt before every run and cache it for 24 hours.</li>
        <li>
          A <code>Disallow</code> that applies to <code>{BOT_NAME}</code> (or to all agents) means we do not fetch that
          page. A robots.txt that answers with a server error also means no fetch.
        </li>
        <li>We only read public pages: no logins, no forms, no orders, no bypassing bot protection.</li>
      </ul>

      <h2>Rate limits</h2>
      <ul>
        <li>One request at a time per site, at least 5 seconds apart, honoring any Crawl-delay.</li>
        <li>We back off on HTTP 429 and 503, and use conditional requests so unchanged pages cost little.</li>
        <li>Where a shop offers a product feed we use it instead of crawling pages.</li>
      </ul>

      <h2>Opting out</h2>
      <p>
        Add a <code>Disallow</code> rule for <code>{BOT_NAME}</code> to your robots.txt, or use the{" "}
        <a href="/report?type=remove">removal form</a>. Removal requests are honored within 48 hours and your
        domain goes on a permanent block list. See <a href="/about/data">About the data</a>.
      </p>

      <h2>Our own robots policy</h2>
      <p>
        This site allows search and AI crawlers. It disallows <code>/go/</code> (outbound click redirects) and the
        ingest and admin API paths. API responses carry <code>X-Robots-Tag: noindex</code>.
      </p>
    </article>
  );
}
