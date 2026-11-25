import type { Config } from "vike/types";
import { adminAccountsHead } from "./head";

// The accounts section (admin only — reviewers land on the
// wrong-role state): SPA shell only, never prerendered, never cached.
const config: Config = {
  prerender: false,
  title: adminAccountsHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
