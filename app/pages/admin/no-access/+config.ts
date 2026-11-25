import type { Config } from "vike/types";
import { adminNoAccessHead } from "./head";

// The wrong-role landing: SSR shell only, never prerendered, never
// cached. No admin data of any kind renders here.
const config: Config = {
  prerender: false,
  title: adminNoAccessHead.title,
  headersResponse: {
    "Cache-Control": "no-store",
  },
};

export default config;
