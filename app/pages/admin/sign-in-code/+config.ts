import type { Config } from "vike/types";
import { adminCodeHead } from "./head";

// The admin sign-in code step: SSR shell only, never prerendered,
// never cached.
const config: Config = {
  prerender: false,
  title: adminCodeHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
