import type { Config } from "vike/types";
import { farmHead } from "./head";

// On-demand SSR, never prerendered, never edge-cached: a form surface
// (Bea §5.1 — indexable, in the hubs sitemap file). The title is
// static, so it rides the `title` setting; SeoHead carries the rest.
const config: Config = {
  prerender: false,
  title: farmHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
