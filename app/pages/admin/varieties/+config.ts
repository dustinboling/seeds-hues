import type { Config } from "vike/types";
import { adminVarietiesHead } from "./head";

// The varieties section: SPA shell only (list + detail load
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminVarietiesHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
