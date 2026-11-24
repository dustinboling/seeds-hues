import type { Config } from "vike/types";
import { privacyHead } from "./head";

const config: Config = {
  prerender: true,
  title: privacyHead.title,
};

export default config;
