import type { Config } from "vike/types";
import { aboutDataHead } from "./head";

const config: Config = {
  prerender: true,
  title: aboutDataHead.title,
};

export default config;
