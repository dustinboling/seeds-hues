import type { Config } from "vike/types";
import { accountHead } from "./head";

// The visitor-account SPA surface (Bea §6.1): the SSR shell only (the
// signed-out frame — never per-user content), client-rendered inside,
// robots-disallowed, never edge-cached. The title is static.
const config: Config = {
  prerender: false,
  title: accountHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
