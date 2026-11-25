import type { Config } from "vike/types";
import { apiDocsHead } from "./head";

const config: Config = {
  prerender: true,
  // Slice 8: prerendered documents cache like SSR ones — they regenerate
  // on data-change invalidation (Bea §0.4/§9), never frozen build snapshots.
  headersResponse: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
  title: apiDocsHead.title,
};

export default config;
