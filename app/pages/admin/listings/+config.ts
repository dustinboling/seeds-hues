import type { Config } from "vike/types";
import { adminListingsHead } from "./head";

// The listings section: SPA shell only (list + detail load
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminListingsHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
