import type { Config } from "vike/types";

// The proof route is static content with no live data: prerendered at build
// time. (Bea's condition on `/` — live counts must be request-time facts —
// binds the real home template in Slice 2, not this inert proof page.)
const config: Config = {
  prerender: true,
};

export default config;
