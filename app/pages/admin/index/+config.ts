import type { Config } from "vike/types";
import { adminHubHead } from "./head";

// The admin hub: SPA shell only (the dashboard data loads
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminHubHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
