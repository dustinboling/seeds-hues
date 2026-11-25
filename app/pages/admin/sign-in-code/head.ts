import { pageHead } from "../../../src/seo/meta";

/** The /admin/sign-in/code head tags (ported from v2 metadata): noindex + nofollow. */
export const adminCodeHead = pageHead({
  title: "Enter your code",
  description: "Enter the 6-digit code sent to your email.",
  path: "/admin/sign-in/code",
  noindex: true,
  follow: false,
});
