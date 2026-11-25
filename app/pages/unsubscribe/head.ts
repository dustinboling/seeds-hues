import { pageHead } from "../../src/seo/meta";

/** The /unsubscribe head tags (ported from v2/app/unsubscribe/page.tsx metadata): noindex + nofollow. */
export const unsubscribeHead = pageHead({
  title: "Unsubscribe",
  description: "Stop Seed Directory waiting-list alerts for one variety or for everything.",
  path: "/unsubscribe",
  noindex: true,
  follow: false,
});
