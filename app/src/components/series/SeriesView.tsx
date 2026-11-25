/**
 * The series hub page (ported from v2/app/series/[slug]/page.tsx): H1 +
 * sub-line, the facts card (crop link, counts), and the FULL variety grid
 * — all the series' varieties, never paginated.
 */
import { Breadcrumbs } from "../Breadcrumbs";
import { VarietyGrid } from "../variety/VarietyCard";
import { JsonLd } from "../../seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../seo/jsonld";
import { proseCommonName, shortCommonName } from "../../lib/format";
import type { SeriesRouteResult } from "../../server/shop-route";

export function SeriesView({ resolved }: { resolved: Extract<SeriesRouteResult, { kind: "ok" }> }) {
  const s = resolved.detail;
  const crop = shortCommonName(s.plant.commonName);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: crop, href: `/crop/${s.plant.slug}` },
    { name: `${s.name} series`, href: `/series/${s.slug}` },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd(`${s.name} series varieties`, s.varieties.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="series-name">
        {s.name} <span className="series-subline">{crop} series</span>
      </h1>
      <dl className="card series-facts">
        <div>
          <dt className="series-facts-label">Crop</dt>
          <dd>
            <a href={`/crop/${s.plant.slug}`}>{proseCommonName(s.plant.commonName)}</a>
          </dd>
        </div>
        <div>
          <dt className="series-facts-label">Varieties</dt>
          <dd>{s.varietyCount}</dd>
        </div>
        <div>
          <dt className="series-facts-label">With sellers</dt>
          <dd>{s.varietiesWithSellers}</dd>
        </div>
      </dl>
      <div className="series-grid">
        <VarietyGrid items={s.varieties} />
      </div>
      <p className="series-crop-link">
        <a href={`/crop/${s.plant.slug}`}>All {proseCommonName(s.plant.commonName)} varieties</a>
      </p>
    </>
  );
}
