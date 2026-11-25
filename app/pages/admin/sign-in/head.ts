import { pageHead } from "../../../src/seo/meta";

/** The /admin/sign-in head tags (ported from v2 metadata): noindex + nofollow. */
export const adminSignInHead = pageHead({
  title: "Admin sign-in",
  description: "Sign in with the email on your Seed Directory account.",
  path: "/admin/sign-in",
  noindex: true,
  follow: false,
});
