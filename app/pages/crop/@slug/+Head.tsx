import { useData } from "vike-react/useData";
import { hasActiveCropFilters } from "../../../src/lib/crop-detail";
import { SeoHead } from "../../../src/seo/SeoHead";
import type { Data } from "./+data";
import { cropHead } from "./head";

// https://vike.dev/Head — data-driven head (useData works in +Head: Vike
// renders Head inside the page context). <title> and og:title render here
// because the title is per-crop (no static `title` setting); SeoHead
// carries the rest. og:title is the unsuffixed title, v2-faithful.
export function Head() {
  const { hub } = useData<Data>();
  const tags = cropHead(
    {
      commonName: hub.crop.commonName,
      latinName: hub.crop.latinName,
      varietyCount: hub.crop.varietyCount,
      varietiesWithSellers: hub.crop.varietiesWithSellers,
      lastUpdated: hub.crop.lastUpdated,
      slug: hub.crop.slug,
    },
    hub.page,
    hasActiveCropFilters(hub.state),
  );
  return (
    <>
      <title>{tags.title}</title>
      <meta property="og:title" content={tags.og.title} />
      <SeoHead tags={tags} />
    </>
  );
}
