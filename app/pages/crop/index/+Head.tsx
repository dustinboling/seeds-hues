import { SeoHead } from "../../../src/seo/SeoHead";
import { cropHead } from "./head";

// https://vike.dev/Head — this route's tags render after the global +Head.
export function Head() {
  return <SeoHead tags={cropHead} />;
}
