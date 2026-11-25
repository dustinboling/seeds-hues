import { pageHead } from "../../../src/seo/meta";

/** The /admin/statistics head tags: noindex + nofollow, never in a sitemap. */
export const adminStatisticsHead = pageHead({
  title: "Statistics",
  description: "Seed Directory admin site statistics.",
  path: "/admin/statistics",
  noindex: true,
  follow: false,
});
