import type { Config } from "vike/types";
import { reportHead } from "./head";

// On-demand SSR, never prerendered, never edge-cached: a form surface
// (Bea §5.2). The title is static, so it rides the `title` setting
// (vike-react renders <title> + og:title from it); SeoHead carries the
// rest. Cache-Control rides on every 200 via headersResponse.
const config: Config = {
  prerender: false,
  title: reportHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
