import { ContactLine } from "../../src/components/ContactLine";
import { formatFriendlyDate } from "../../src/lib/format";
import { TRADEMARK_DISCLAIMER } from "../../src/site";

/**
 * /terms — ported verbatim from v2/app/terms/page.tsx. One standing-rule
 * spelling normalization (US spelling, same as the gated /about):
 * "honoured" → "honored".
 */
export default function Page() {
  return (
    <article className="prose-plain" aria-labelledby="terms-title">
      <h1 id="terms-title">Terms of use</h1>
      <p className="prose-lede">
        seeds.hues.flowers is a free, read-only directory run by Hues Floral Park. By using the site or its API you
        agree to the points below.
      </p>
      <h2>Information only</h2>
      <ul>
        <li>Listings and stock states are provided for information. Each listing shows the date it was last checked; availability may have changed since. No prices are shown.</li>
        <li>We do not sell seed, take orders or handle payments. Purchases happen on the seller’s own website, under the seller’s terms.</li>
        <li>We are not responsible for sellers’ products, delivery, or customer service.</li>
      </ul>
      <h2>Names and trademarks</h2>
      <p>{TRADEMARK_DISCLAIMER}</p>
      <h2>The API</h2>
      <ul>
        <li>The <a href="/api-docs">public API</a> is read-only and rate-limited (120 requests per minute per IP).</li>
        <li>You may use the data with attribution to seeds.hues.flowers. Keep each listing together with its source and check date when you display it.</li>
        <li>We may change or withdraw the API; breaking changes are published as a new version (/api/v2).</li>
      </ul>
      <h2>Corrections</h2>
      <p>
        If something is wrong, contact <ContactLine subject="Correction" />. Seller removal requests (via the
        report form) are honored within 48 hours.
      </p>
      <p className="prose-meta">Last updated {formatFriendlyDate("2026-11-16")}.</p>
    </article>
  );
}
