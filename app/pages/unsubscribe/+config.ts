import type { Config } from "vike/types";
import { unsubscribeHead } from "./head";

// The unsubscribe utility (Bea §6.2): SSR per-token frame (the signed
// token's scope, verified server-side), robots-disallowed, never
// edge-cached, never in a sitemap. A GET never changes anything.
const config: Config = {
  prerender: false,
  title: unsubscribeHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
