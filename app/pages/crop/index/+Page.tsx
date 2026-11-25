import { useData } from "vike-react/useData";
import { Breadcrumbs } from "../../../src/components/Breadcrumbs";
import { CropCardImage } from "../../../src/components/CropCardImage";
import { JsonLd } from "../../../src/seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../../src/seo/jsonld";
import { plural, proseCommonName } from "../../../src/lib/format";
import type { Data } from "./+data";

/**
 * /crop — the crop index, prerendered with live counts. Structure, JSON-LD,
 * and copy ported from v2/app/crop/page.tsx + the CropBrowse resting render
 * (count line, cards, empty state). The in-place filter layer (chips, applied
 * row, pending cue) is Slice 4's; this slice ships the complete resting list.
 */
export default function Page() {
  const { crops, total } = useData<Data>();
  const items = [...crops].sort((a, b) => a.commonName.localeCompare(b.commonName));
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Crops", href: "/crop" },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd("Flower seed crops", items.map((c) => ({ name: c.commonName, href: `/crop/${c.slug}` })))} />
      <Breadcrumbs items={crumbs} />
      <h1>Crops</h1>
      <p className="crop-index-count" aria-live="polite" aria-atomic="true">
        {plural(total, "crop")} in the directory, alphabetical.
      </p>
      {total > 0 ? (
        <ul className="crop-grid">
          {items.map((c) => (
            <li key={c.slug} className="card card-hover crop-card">
              <CropCardImage media={c.media} commonName={c.commonName} />
              <h2>
                <a href={`/crop/${c.slug}`} className="crop-card-link">
                  {proseCommonName(c.commonName)}
                </a>
              </h2>
              {c.latinName ? (
                <p className="crop-card-latin">
                  <i>{c.latinName}</i>
                </p>
              ) : null}
              <p className="crop-card-count">{plural(c.varietyCount, "variety", "varieties")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="crop-index-count" data-testid="crop-empty">
          No crops match.
        </p>
      )}
    </>
  );
}
