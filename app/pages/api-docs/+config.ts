import type { Config } from "vike/types";
import { apiDocsHead } from "./head";

const config: Config = {
  prerender: true,
  title: apiDocsHead.title,
};

export default config;
