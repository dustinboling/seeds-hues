import type { Config } from "vike/types";
import { homeHead } from "./head";

// Prerendered WITH live data: the +data hook loads current counts at build,
// and the revalidate hook regenerates the page on every catalog write —
// Bea's condition on `/` (a build-time snapshot of live counts is a stale
// fact, so "/" regenerates on data-change invalidation).
const config: Config = {
  prerender: true,
  // Slice 8: prerendered documents cache like SSR ones — they regenerate
  // on data-change invalidation (Bea §0.4/§9), never frozen build snapshots.
  headersResponse: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
  title: homeHead.title,
};

export default config;
