import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

// Default config (can be overridden per route — the architecture brief's
// rendering model: each route carries its own prerender/SSR/SPA setting).
// https://vike.dev/config
//
// No global title/description: every route sets its own `title` (vike-react
// renders <title> + og:title from it and syncs <title> on client
// navigations); descriptions and the rest come from each route's +Head via
// SeoHead, exactly like v2's per-page metadata. A global description here
// would stamp every page with the site description.
const config: Config = {
  lang: "en-US",
  // Suppress vike-react's default viewport tag; +Head renders the full
  // viewport (viewport-fit=cover for the fixed bar's safe-area insets).
  viewport: null,
  extends: [vikeReact],
};

export default config;
