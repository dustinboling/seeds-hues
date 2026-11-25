import type { Config } from "vike/types";
import { adminReviewHead } from "./head";

// The review workspace: SPA shell only (queue + detail load
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminReviewHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
