/**
 * The crop hub page (ported from v2/app/crop/[slug]/page.tsx): H1 + Latin
 * line, coverage counts, season/sowing/life-cycle facts, pod artwork and
 * hero where present, the about section, the filterable variety grid, the
 * grower guide, and the series links.
 */
import { Breadcrumbs } from "../Breadcrumbs";
import { PodDivider } from "../PodDivider";
import { VarietyHeroImage } from "../variety/VarietyHeroImage";
import { ResultsScrollClamp } from "../variety/ResultsScrollClamp";
import { JsonLd } from "../../seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../seo/jsonld";
import { SEASON_LABELS, SOWING_METHOD_LABELS } from "../../lib/browse";
import { formatFriendlyDate, plural, shortCommonName, proseCommonName } from "../../lib/format";
import { growerGuideTabs, lifeCycleFact } from "../../lib/grower-guide";
import { imageUrl } from "../../lib/images";
import { podArtForPlant } from "../../lib/pod-ornaments";
import { PAGE_SIZE } from "../../site";
import type { CropRouteResult } from "../../server/shop-route";
import { CropDetailBrowse } from "./CropDetailBrowse";
import { GrowerGuide } from "./GrowerGuide";

export function CropView({ resolved }: { resolved: Extract<CropRouteResult, { kind: "ok" }> }) {
  const { data } = resolved;
  const c = data.crop;
  const page = data.page;
  const f = data.state;
  const common = shortCommonName(c.commonName);
  const lastUpdatedFriendly = formatFriendlyDate(c.lastUpdated);
  const lifeCycle = lifeCycleFact(c.life_cycle, c.hardiness);
  const pod = podArtForPlant(c.slug);
  const navKey = [page, f.hue.join(","), f.series, f.hasSellers, f.sort].join("|");
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Crops", href: "/crop" },
    { name: common, href: `/crop/${c.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          `${common} varieties`,
          data.items.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <div className="crop-header">
        <div className="crop-heading">
          <h1 className="crop-name">{proseCommonName(c.commonName)} seeds</h1>
          {c.latinName ? (
            <p className="crop-latin">
              <i>{c.latinName}</i>
            </p>
          ) : null}
          <p className="crop-coverage" data-testid="coverage">
            {plural(c.varietyCount, "variety", "varieties")} cataloged · {c.varietiesWithSellers} with sellers
            {lastUpdatedFriendly ? ` · last updated ${lastUpdatedFriendly}` : ""}
          </p>
          {c.season_class ? (
            <p className="crop-fact" data-testid="crop-season">
              Season: {SEASON_LABELS[c.season_class]}
            </p>
          ) : null}
          {c.sowing_methods.length ? (
            <p className="crop-fact" data-testid="crop-sowing-method">
              Sowing method: {c.sowing_methods.map((m) => SOWING_METHOD_LABELS[m]).join(" · ")}
            </p>
          ) : null}
          {lifeCycle ? (
            <p className="crop-fact" data-testid="crop-life-cycle">
              {lifeCycle}
            </p>
          ) : null}
        </div>
        {pod ? (
          <>
            {/* Decorative seed-pod motif, 480-wide transformation via lib/images. */}
            <img
              src={imageUrl(pod.motif, { width: 480 })}
              alt=""
              aria-hidden="true"
              width={480}
              height={480}
              decoding="async"
              className="crop-pod-motif"
            />
          </>
        ) : null}
      </div>
      {c.media[0] ? <VarietyHeroImage media={{ url: c.media[0].url, licence: "", credit: "" }} label={c.commonName} testId="crop-hero" /> : null}
      {c.description || c.sowingNotes ? (
        <section className="card crop-about" aria-labelledby="crop-intro">
          <h2 id="crop-intro" className="crop-about-heading">
            About {common.toLowerCase()}
          </h2>
          {c.description ? <p className="crop-about-text">{c.description}</p> : null}
          {c.sowingNotes ? <p className="crop-about-text">{c.sowingNotes}</p> : null}
        </section>
      ) : null}

      <CropDetailBrowse
        slug={c.slug}
        initial={{ state: f, counts: data.counts, items: data.items, total: data.total, page }}
        hues={data.hues}
        series={c.series}
        commonName={c.commonName}
        latinName={c.latinName}
        varietyCount={c.varietyCount}
        varietiesWithSellers={c.varietiesWithSellers}
      />

      {pod ? <PodDivider bundle={pod.bundle} /> : null}
      <GrowerGuide tabs={growerGuideTabs(c.grower_guide)} cropName={common.toLowerCase()} />
      {c.series.length ? (
        <p className="crop-series-links">
          Series:{" "}
          {c.series.map((s, i) => (
            <span key={s.slug}>
              {i > 0 ? " · " : ""}
              <a href={`/series/${s.slug}`}>{s.name}</a>
            </span>
          ))}
        </p>
      ) : null}
      <p className="crop-all-link">
        <a href="/crop">All crops</a>
      </p>
      <ResultsScrollClamp targetId="crop-results-count" regionId="crop-variety-results" navKey={navKey} />
    </>
  );
}
