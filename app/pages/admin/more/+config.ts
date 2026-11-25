import type { Config } from "vike/types";
import { adminMoreHead } from "./head";

// The phone-only More destination (identity + overflow links):
// SSR shell only, never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminMoreHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
