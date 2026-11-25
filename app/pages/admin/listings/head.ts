import { pageHead } from "../../../src/seo/meta";

/** The /admin/listings head tags: noindex + nofollow, never in a sitemap. */
export const adminListingsHead = pageHead({
  title: "Listings",
  description: "Seed Directory admin listing records.",
  path: "/admin/listings",
  noindex: true,
  follow: false,
});
