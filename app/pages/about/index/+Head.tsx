import { SeoHead } from "../../../src/seo/SeoHead";
import { aboutHead } from "./head";

// https://vike.dev/Head — +Head is cumulative down the route tree, so this
// page lives in index/ to keep its tags off the nested /about/* routes.
// This route's tags render after the global +Head.
export function Head() {
  return <SeoHead tags={aboutHead} />;
}
