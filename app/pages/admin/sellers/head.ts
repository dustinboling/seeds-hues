import { pageHead } from "../../../src/seo/meta";

/** The /admin/sellers head tags: noindex + nofollow, never in a sitemap. */
export const adminSellersHead = pageHead({
  title: "Sellers",
  description: "Seed Directory admin seller records.",
  path: "/admin/sellers",
  noindex: true,
  follow: false,
});
