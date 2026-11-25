import { pageHead } from "../../../src/seo/meta";

/** The /admin hub head tags: noindex + nofollow, never in a sitemap. */
export const adminHubHead = pageHead({
  title: "Admin home",
  description: "Seed Directory admin dashboard.",
  path: "/admin",
  noindex: true,
  follow: false,
});
