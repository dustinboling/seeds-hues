import { useData } from "vike-react/useData";
import { SeoHead } from "../../../src/seo/SeoHead";
import type { Data } from "./+data";
import { varietyHead } from "./head";

// https://vike.dev/Head — data-driven head (useData works in +Head: Vike
// renders Head inside the page context). <title> and og:title render here
// because the title is per-variety (no static `title` setting); SeoHead
// carries the rest. og:title is the unsuffixed title, v2-faithful.
export function Head() {
  const { detail, smallFarmOnly, floorTransient } = useData<Data>();
  const tags = varietyHead(detail, smallFarmOnly, floorTransient);
  return (
    <>
      <title>{tags.title}</title>
      <meta property="og:title" content={tags.og.title} />
      <SeoHead tags={tags} />
    </>
  );
}
