import type { Config } from "vike/types";
import { offlineHead } from "./head";

// Prerendered + precached by the service worker (Bea §6.3): the offline
// fallback. Never in a sitemap (noindex). The navigation-fallback wiring
// (failed navigations → this page) is Slice 9's browser-verified item.
const config: Config = {
  prerender: true,
  // Slice 8: prerendered documents cache like SSR ones — they regenerate
  // on data-change invalidation (Bea §0.4/§9), never frozen build snapshots.
  headersResponse: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
  title: offlineHead.title,
};

export default config;
