import { pageHead } from "../../../src/seo/meta";

/** The /admin/more head tags: noindex + nofollow, never in a sitemap. */
export const adminMoreHead = pageHead({
  title: "More",
  description: "Seed Directory admin overflow links.",
  path: "/admin/more",
  noindex: true,
  follow: false,
});
