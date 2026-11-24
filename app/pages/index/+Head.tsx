import { SeoHead } from "../../src/seo/SeoHead";
import { homeHead } from "./head";

// https://vike.dev/Head — this route's tags render after the global +Head.
export function Head() {
  return <SeoHead tags={homeHead} />;
}
