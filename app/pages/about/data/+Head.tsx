import { SeoHead } from "../../../src/seo/SeoHead";
import { aboutDataHead } from "./head";

// https://vike.dev/Head — this route's tags render after the global +Head.
export function Head() {
  return <SeoHead tags={aboutDataHead} />;
}
