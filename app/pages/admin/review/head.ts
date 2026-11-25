import { pageHead } from "../../../src/seo/meta";

/** The /admin/review head tags: noindex + nofollow, never in a sitemap. */
export const adminReviewHead = pageHead({
  title: "Review",
  description: "Seed Directory admin review queues.",
  path: "/admin/review",
  noindex: true,
  follow: false,
});
