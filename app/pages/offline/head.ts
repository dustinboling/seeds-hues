import { pageHead } from "../../src/seo/meta";

/** /offline head (v2/app/offline/page.tsx metadata, verbatim). */
export const offlineHead = pageHead({
  title: "You’re offline",
  description: "This page isn’t saved on your device yet.",
  path: "/offline",
  noindex: true,
  follow: true,
});
