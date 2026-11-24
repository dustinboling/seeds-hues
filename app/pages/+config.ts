import type { Config } from "vike/types";
import vikeReact from "vike-react/config";
import { APP_SHORT_NAME, SITE_DESCRIPTION } from "../src/site";

// Default config (can be overridden per route — the architecture brief's
// rendering model: each route carries its own prerender/SSR/SPA setting).
// https://vike.dev/config
const config: Config = {
  title: APP_SHORT_NAME,
  description: SITE_DESCRIPTION,
  lang: "en-US",
  // Suppress vike-react's default viewport tag; +Head renders the full
  // viewport (viewport-fit=cover for the fixed bar's safe-area insets).
  viewport: null,
  extends: [vikeReact],
};

export default config;
