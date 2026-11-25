import { SeoHead } from "../../../src/seo/SeoHead";
import { adminSellersHead } from "./head";

// https://vike.dev/Head — static tags (the `title` setting renders
// <title> + og:title; SeoHead carries the rest).
export function Head() {
  return <SeoHead tags={adminSellersHead} />;
}
