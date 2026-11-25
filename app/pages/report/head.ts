import { pageHead } from "../../src/seo/meta";

/**
 * The /report head tags (ported from v2/app/report/page.tsx metadata):
 * noindex + follow, self-canonical, crawlable and never in a sitemap.
 * One-word US-spelling delta from v2's description ("honored").
 */
export const reportHead = pageHead({
  title: "Report a problem, claim or remove a seller",
  description: "Correct a listing, claim your seller page, or ask us to remove it. Removals are honored within 48 hours.",
  path: "/report",
  noindex: true,
  follow: true,
});
