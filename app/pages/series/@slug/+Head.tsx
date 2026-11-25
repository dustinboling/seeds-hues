import { useData } from "vike-react/useData";
import { SeoHead } from "../../../src/seo/SeoHead";
import type { Data } from "./+data";
import { seriesHead } from "./head";

// https://vike.dev/Head — data-driven head (useData works in +Head: Vike
// renders Head inside the page context). <title> and og:title render here
// because the title is per-series (no static `title` setting); SeoHead
// carries the rest. og:title is the unsuffixed title, v2-faithful.
export function Head() {
  const { detail } = useData<Data>();
  const tags = seriesHead({
    slug: detail.slug,
    name: detail.name,
    cropCommonName: detail.plant.commonName,
    cropSlug: detail.plant.slug,
    latinName: detail.plant.latinName,
    varietyCount: detail.varietyCount,
    varietiesWithSellers: detail.varietiesWithSellers,
  });
  return (
    <>
      <title>{tags.title}</title>
      <meta property="og:title" content={tags.og.title} />
      <SeoHead tags={tags} />
    </>
  );
}
