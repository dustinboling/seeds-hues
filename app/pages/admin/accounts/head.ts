import { pageHead } from "../../../src/seo/meta";

/** The /admin/accounts head tags: noindex + nofollow, never in a sitemap. */
export const adminAccountsHead = pageHead({
  title: "Accounts",
  description: "Seed Directory admin account records.",
  path: "/admin/accounts",
  noindex: true,
  follow: false,
});
