import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { VarietyHeroImage } from "@/components/variety/VarietyHeroImage";
import { GrowerGuide } from "@/components/crop/GrowerGuide";
import { PodDivider } from "@/components/ui/PodDivider";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { mediaOgImage, ogImage, pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pageTitleSuffix, pageWindow, parsePage, totalPages } from "@/lib/paging";
import { legacySlug } from "@/lib/legacy";
import { plural, shortCommonName, titleCaseTag } from "@/lib/format";
import { proseCommonName } from "@/lib/services/template";
import { PAGE_SIZE } from "@/lib/config";
import { SEASON_LABELS, SOWING_METHOD_LABELS } from "@/lib/validators";
import { growerGuideTabs, lifeCycleFact } from "@/lib/grower-guide";
import { podArtForPlant } from "@/lib/data/pod-ornaments";
import { imageUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Crop filters (canonical story 4): color_family, series, has_sellers — via query params. */
interface CropFilters {
  color: string | null;
  series: string | null;
  hasSellers: boolean | null;
}

function readFilters(sp: Record<string, string | string[] | undefined>): CropFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  const color = one("color_family");
  const hs = one("has_sellers");
  if (color !== undefined && !/^[a-z_-]{1,40}$/.test(color)) notFound();
  if (hs !== undefined && hs !== "true" && hs !== "false") notFound();
  return { color: color ?? null, series: legacySlug(sp.series), hasSellers: hs === undefined ? null : hs === "true" };
}

function href(slug: string, f: CropFilters, page = 1): string {
  const p = new URLSearchParams();
  if (f.color) p.set("color_family", f.color);
  if (f.series) p.set("series", f.series);
  if (f.hasSellers !== null) p.set("has_sellers", String(f.hasSellers));
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/crop/${slug}${qs ? `?${qs}` : ""}`;
}

const filtered = (f: CropFilters) => Boolean(f.color || f.series || f.hasSellers !== null);

const load = cache(async (slug: string, page: number, color: string | null, seriesSlug: string | null, hasSellers: boolean | null) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  return catalog.getCrop(slug, {
    page: pageWindow(page),
    filters: {
      colorFamily: color ? [color] : undefined,
      series: seriesSlug ? [seriesSlug] : undefined,
      hasListings: hasSellers ?? undefined,
    },
  });
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const f = readFilters(sp);
  const r = await load(slug, page, f.color, f.series, f.hasSellers);
  if (!r) return { title: "Crop not found", robots: { index: false, follow: true } };
  const c = r.crop;
  const common = shortCommonName(c.commonName);
  return pageMetadata({
    title: `${common} Seeds${c.latinName ? ` (${c.latinName})` : ""} — ${plural(c.varietyCount, "Variety", "Varieties")}, ${c.varietiesWithSellers} With Sellers${pageTitleSuffix(page)}`,
    description: `${plural(c.varietyCount, "variety", "varieties")} of ${proseCommonName(c.commonName)}${c.latinName ? ` (${c.latinName})` : ""} cataloged; ${c.varietiesWithSellers} sold by small farms in the directory.${c.lastUpdated ? ` Last updated ${c.lastUpdated}.` : ""}`,
    // Filtered views are crawlable but not indexed; the canonical is the unfiltered crop page.
    path: filtered(f) ? `/crop/${c.slug}` : href(c.slug, f, page),
    noindex: filtered(f),
    og: c.media[0] ? mediaOgImage(c.media[0].url, `${common} seeds`) : ogImage("crop", c.slug, `${common} seeds`),
  });
}

export default async function CropPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const f = readFilters(sp);
  const r = await load(slug, page, f.color, f.series, f.hasSellers);
  if (!r) notFound();
  const { crop: c, total, colorFamilies } = r;
  if (total > 0) assertPageInRange(page, total);
  else if (page > 1) notFound();
  const pages = totalPages(total);
  const common = shortCommonName(c.commonName);
  const lifeCycle = lifeCycleFact(c.life_cycle, c.hardiness);
  const pod = podArtForPlant(c.slug);
  const navKey = [page, f.color, f.series, f.hasSellers].join("|");
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Crops", href: "/crop" },
    { name: common, href: `/crop/${c.slug}` },
  ];
  const chip = (label: string, next: CropFilters, active: boolean) => (
    <Link href={href(c.slug, next)} scroll={false} className={`chip tap ${active ? "border-leaf bg-leaf-50 font-semibold" : ""}`} aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );

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
            {c.lastUpdated ? ` · last updated ${c.lastUpdated}` : ""}
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
        <section className="mt-4 max-w-3xl rounded-lg bg-leaf-50 p-4" aria-labelledby="crop-intro">
          <h2 id="crop-intro" className="font-semibold">
            About {common.toLowerCase()}
          </h2>
          {c.description ? <p className="mt-1">{c.description}</p> : null}
          {c.sowingNotes ? <p className="mt-1">{c.sowingNotes}</p> : null}
        </section>
      ) : null}

      <nav aria-label={`Filter ${common} varieties`} className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Sellers:</span>
          {chip("All", { ...f, hasSellers: null }, f.hasSellers === null)}
          {chip("Has sellers", { ...f, hasSellers: true }, f.hasSellers === true)}
          {chip("No seller yet", { ...f, hasSellers: false }, f.hasSellers === false)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Hue:</span>
          {chip("All", { ...f, color: null }, f.color === null)}
          {colorFamilies.map((cf) => (
            <span key={cf}>{chip(cf === "unknown" ? "Unknown" : titleCaseTag(cf), { ...f, color: cf }, f.color === cf)}</span>
          ))}
        </div>
        {c.series.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Series:</span>
            {chip("All", { ...f, series: null }, f.series === null)}
            {c.series.map((s) => (
              <span key={s.slug}>{chip(s.name, { ...f, series: s.slug }, f.series === s.slug)}</span>
            ))}
          </div>
        ) : null}
      </nav>

      <p id="crop-results-count" className="mt-4 text-muted" aria-live="polite" aria-atomic="true">
        {filtered(f) ? `${plural(total, "variety", "varieties")} match. ` : ""}
        {pages > 1 ? `Page ${page} of ${pages}.` : ""}
      </p>
      <div id="crop-variety-results" className="mt-3">
        {c.varieties.length ? (
          <VarietyGrid items={c.varieties} />
        ) : f.hasSellers === true && c.varietiesWithSellers === 0 ? (
          <p className="text-muted">
            No sellers yet for this crop — join a waiting list on any variety page and we will let you know when a farm lists one.{" "}
            <Link href={`/crop/${c.slug}`}>Clear filters</Link>.
          </p>
        ) : (
          <p className="text-muted">
            No varieties match. <Link href={`/crop/${c.slug}`}>Clear filters</Link>.
          </p>
        )}
      </div>
      <Pagination
        basePath={`/crop/${c.slug}`}
        page={page}
        totalPages={pages}
        extra={Object.fromEntries(new URLSearchParams(href(c.slug, f).split("?")[1] ?? ""))}
        label={`${common} variety pages`}
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
