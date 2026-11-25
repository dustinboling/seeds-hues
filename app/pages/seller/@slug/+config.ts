import type { Config } from "vike/types";

// On-demand SSR + edge cache (Bea §9): rendered by the Worker at request
// time, never prerendered. No static `title` — the head is data-driven
// (see +Head). Cache-Control rides on every 200 via headersResponse.
const config: Config = {
  prerender: false,
  headersResponse: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
};

export default config;
