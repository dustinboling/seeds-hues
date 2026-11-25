import { pageHead } from "../../src/seo/meta";

/** The /account head tags (ported from v2/app/account/page.tsx metadata): noindex + follow. */
export const accountHead = pageHead({
  title: "Your account",
  description: "Sign in or create a Seed Directory account to join waiting lists and get an alert when a variety is found.",
  path: "/account",
  noindex: true,
  follow: true,
});
