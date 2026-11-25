import { pageHead } from "../../../src/seo/meta";

/** The /admin/varieties head tags: noindex + nofollow, never in a sitemap. */
export const adminVarietiesHead = pageHead({
  title: "Varieties",
  description: "Seed Directory admin variety records.",
  path: "/admin/varieties",
  noindex: true,
  follow: false,
});
