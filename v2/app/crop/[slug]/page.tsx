import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { CropDetailBrowse, type CropDetailBrowseInitial } from "@/components/crop/CropDetailBrowse";
import { VarietyHeroImage } from "@/components/variety/VarietyHeroImage";
import { GrowerGuide } from "@/components/crop/GrowerGuide";
import { PodDivider } from "@/components/ui/PodDivider";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import type { BrowseCropResult } from "@/lib/services/catalog";
import { mediaOgImage, ogImage, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage } from "@/lib/paging";
import { formatFriendlyDate, plural, shortCommonName } from "@/lib/format";
import { proseCommonName } from "@/lib/services/template";
import { PAGE_SIZE } from "@/lib/config";
import { SEASON_LABELS, SOWING_METHOD_LABELS } from "@/lib/validators";
import { growerGuideTabs, lifeCycleFact } from "@/lib/grower-guide";
import { podArtForPlant } from "@/lib/data/pod-ornaments";
import { imageUrl } from "@/lib/images";
import { cropHuesForFamilies, hasActiveCropFilters, readCropDetailFilters, type CropDetailFilterState } from "@/lib/crop-detail";
import { CropSkeleton } from "./skeleton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const load = cache(
  async (
    slug: string,
    page: number,
    rawHue: string | string[] | undefined,
    rawSeries: string | string[] | undefined,
    rawHasSellers: string | string[] | undefined,
  ) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
    const { catalog } = await getServices();
    return catalog.browseCrop(slug, {
      page: pageWindow(page),
      state: readCropDetailFilters({ color_family: rawHue, series: rawSeries, has_sellers: rawHasSellers }),
    });
  },
);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const f = readCropDetailFilters(sp);
  const r = await load(slug, page, sp.color_family, sp.series, sp.has_sellers);
  if (!r) return { title: "Crop not found", robots: { index: false, follow: true } };
  const c = r.crop;
  const common = shortCommonName(c.commonName);
  const lastUpdatedFriendly = formatFriendlyDate(c.lastUpdated);
  return pageMetadata({
    title: `${common} Seeds${c.latinName ? ` (${c.latinName})` : ""} — ${plural(c.varietyCount, "Variety", "Varieties")}, ${c.varietiesWithSellers} With Sellers${pageTitleSuffix(page)}`,
    description: `${plural(c.varietyCount, "variety", "varieties")} of ${proseCommonName(c.commonName)}${c.latinName ? ` (${c.latinName})` : ""} cataloged; ${c.varietiesWithSellers} sold by sellers in the directory.${lastUpdatedFriendly ? ` Last updated ${lastUpdatedFriendly}.` : ""}`,
    // Filtered views are crawlable but not indexed; the canonical is the unfiltered crop page.
    path: hasActiveCropFilters(f) ? `/crop/${c.slug}` : pagePath(`/crop/${c.slug}`, page),
    noindex: hasActiveCropFilters(f),
    og: c.media[0] ? mediaOgImage(c.media[0].url, `${common} seeds`) : ogImage("crop", c.slug, `${common} seeds`),
  });
}

export default async function CropPage({ params, searchParams }: Props) {
  // Soft-404 fix: every notFound() below (unknown slug, page past the end) resolves BEFORE
  // anything streams (this segment has no loading.tsx), so unknown slugs answer a true 404.
  // The skeleton lives on as the inner Suspense fallback — the page's single loading
  // announcement. Filter values stay forgiving (unknowns ignored, never a 404) like every
  // other browse surface.
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const f = readCropDetailFilters(sp);
  const r = await load(slug, page, sp.color_family, sp.series, sp.has_sellers);
  if (!r) notFound();
  const { total } = r;
  if (total > 0) assertPageInRange(page, total);
  else if (page > 1) notFound();
  return (
    <Suspense fallback={<CropSkeleton />}>
      <CropContent r={r} page={page} f={f} />
    </Suspense>
  );
}

function CropContent({ r, page, f }: { r: BrowseCropResult; page: number; f: CropDetailFilterState }) {
  const { crop: c, total } = r;
  const common = shortCommonName(c.commonName);
  const lastUpdatedFriendly = formatFriendlyDate(c.lastUpdated);
  const lifeCycle = lifeCycleFact(c.life_cycle, c.hardiness);
  const pod = podArtForPlant(c.slug);
  // The browse payload: the varieties window plus the per-option counts describing them —
  // the identical contract GET /api/browse/crops/[slug] serves the in-place layer.
  const initial: CropDetailBrowseInitial = {
    state: f,
    counts: r.counts,
    items: c.varieties,
    total,
    page,
  };
  const navKey = [page, f.hue.join(","), f.series, f.hasSellers].join("|");
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
          c.varieties.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-leaf">{proseCommonName(c.commonName)} seeds</h1>
          {c.latinName ? (
            <p className="mt-1 text-lg">
              <i>{c.latinName}</i>
            </p>
          ) : null}
          <p className="mt-2 font-medium" data-testid="coverage">
            {plural(c.varietyCount, "variety", "varieties")} cataloged · {c.varietiesWithSellers} with sellers
            {lastUpdatedFriendly ? ` · last updated ${lastUpdatedFriendly}` : ""}
          </p>
          {c.season_class ? (
            <p className="mt-1 text-sm text-muted" data-testid="crop-season">
              Season: {SEASON_LABELS[c.season_class]}
            </p>
          ) : null}
          {c.sowing_methods.length ? (
            <p className="mt-1 text-sm text-muted" data-testid="crop-sowing-method">
              Sowing method: {c.sowing_methods.map((m) => SOWING_METHOD_LABELS[m]).join(" · ")}
            </p>
          ) : null}
          {lifeCycle ? (
            <p className="mt-1 text-sm text-muted" data-testid="crop-life-cycle">
              {lifeCycle}
            </p>
          ) : null}
        </div>
        {pod ? (
          <>
            {/* Decorative seed-pod motif (lib/data/pod-ornaments.ts), 480-wide transformation via lib/images. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(pod.motif, { width: 480 })}
              alt=""
              aria-hidden="true"
              width={480}
              height={480}
              decoding="async"
              className="h-24 w-24 shrink-0 object-contain sm:h-36 sm:w-36"
            />
          </>
        ) : null}
      </div>
      {c.media[0] ? <VarietyHeroImage media={c.media[0]} label={c.commonName} testId="crop-hero" /> : null}
      {c.description || c.sowingNotes ? (
        <section className="mt-4 max-w-3xl rounded-inner bg-leaf-50 p-4" aria-labelledby="crop-intro">
          <h2 id="crop-intro" className="font-semibold">
            About {common.toLowerCase()}
          </h2>
          {c.description ? <p className="mt-1">{c.description}</p> : null}
          {c.sowingNotes ? <p className="mt-1">{c.sowingNotes}</p> : null}
        </section>
      ) : null}

      <CropDetailBrowse
        slug={c.slug}
        initial={initial}
        hues={cropHuesForFamilies(r.colorFamilies)}
        series={c.series}
        commonName={c.commonName}
        varietiesWithSellers={c.varietiesWithSellers}
      />

      {pod ? <PodDivider bundle={pod.bundle} /> : null}
      <GrowerGuide tabs={growerGuideTabs(c.grower_guide)} cropName={common.toLowerCase()} />
      {c.series.length ? (
        <p className="mt-6">
          Series:{" "}
          {c.series.map((s, i) => (
            <span key={s.slug}>
              {i > 0 ? " · " : ""}
              <Link href={`/series/${s.slug}`}>{s.name}</Link>
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-8">
        <Link href="/crop">All crops</Link>
      </p>
      <ResultsScrollClamp targetId="crop-results-count" regionId="crop-variety-results" navKey={navKey} />
    </>
  );
}
