import type { Config } from "vike/types";
import { aboutHead } from "./head";

const config: Config = {
  prerender: true,
  title: aboutHead.title,
};

export default config;
