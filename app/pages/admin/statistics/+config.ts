import type { Config } from "vike/types";
import { adminStatisticsHead } from "./head";

// The statistics section: SPA shell only (overview + popularity load
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminStatisticsHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
