import type { Config } from "vike/types";
import { adminSignInHead } from "./head";

// The admin sign-in flow (email step): SSR shell only, never
// prerendered, never cached. Title rides the `title` setting;
// SeoHead carries the rest. Cache-Control rides via headersResponse.
const config: Config = {
  prerender: false,
  title: adminSignInHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
