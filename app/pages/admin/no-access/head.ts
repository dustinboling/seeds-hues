import { pageHead } from "../../../src/seo/meta";

/** The /admin/no-access head tags (ported from v2 metadata): noindex + nofollow. */
export const adminNoAccessHead = pageHead({
  title: "Admin access",
  description: "This Seed Directory account does not have admin access.",
  path: "/admin/no-access",
  noindex: true,
  follow: false,
});
