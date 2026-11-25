import type { Config } from "vike/types";
import { adminSellersHead } from "./head";

// The sellers section: SPA shell only (list + detail load
// client-side), never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminSellersHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
