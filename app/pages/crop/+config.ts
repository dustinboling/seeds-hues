import type { Config } from "vike/types";
import { cropHead } from "./head";

const config: Config = {
  prerender: true,
  title: cropHead.title,
};

export default config;
