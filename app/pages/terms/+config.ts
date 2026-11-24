import type { Config } from "vike/types";
import { termsHead } from "./head";

const config: Config = {
  prerender: true,
  title: termsHead.title,
};

export default config;
