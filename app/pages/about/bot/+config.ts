import type { Config } from "vike/types";
import { aboutBotHead } from "./head";

const config: Config = {
  prerender: true,
  title: aboutBotHead.title,
};

export default config;
