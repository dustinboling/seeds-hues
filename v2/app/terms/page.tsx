import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/layout/ContactLine";
import { TRADEMARK_DISCLAIMER } from "@/lib/config";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms of use",
  description: "Terms for using the seeds.hues.flowers directory and its read-only API.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <article className="prose-plain max-w-3xl" aria-labelledby="terms-title">
      <h1 id="terms-title" className="text-3xl font-semibold text-leaf">
        Terms of use
      </h1>
      <p className="mt-3">
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
        <li>The <Link href="/api-docs">public API</Link> is read-only and rate-limited (120 requests per minute per IP).</li>
        <li>You may use the data with attribution to seeds.hues.flowers. Keep each listing together with its source and check date when you display it.</li>
        <li>We may change or withdraw the API; breaking changes are published as a new version (/api/v2).</li>
      </ul>
      <h2>Corrections</h2>
      <p>
        If something is wrong, contact <ContactLine subject="Correction" />. Seller removal requests (via the
        report form) are honoured within 48 hours.
      </p>
      <p className="text-sm text-muted">Last updated 2026-11-16.</p>
    </article>
  );
}
