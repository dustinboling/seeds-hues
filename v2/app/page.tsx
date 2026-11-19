import Link from "next/link";
import type { Metadata } from "next";
import { SearchBox } from "@/components/search/SearchBox";
import { CropCardImage } from "@/components/crop/CropCardImage";
import { AvailabilityBadge } from "@/components/variety/Availability";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { PodDivider } from "@/components/ui/PodDivider";
import { MotifDivider } from "@/components/ui/MotifDivider";
import { BrowseFilters, activeFilterLabels, type BrowseFilterState } from "@/components/ui/BrowseFilters";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { siteOrganizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/config";
import { plural, shortCommonName } from "@/lib/format";
import { parseMethodParam, parseSeasonParam } from "@/lib/paging";
import { METHOD_PARAMS, SEASON_PARAMS } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});

const EVENT_LABEL = { first_seen: "Newly listed", restocked: "Restocked", sold_out: "Sold out", gone: "Gone" } as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: BrowseFilterState = { season: parseSeasonParam(sp.season), method: parseMethodParam(sp.method), lifeCycle: null, hue: null };
  const active = activeFilterLabels(filters);
  const { catalog } = await getServices();
  const [counts, crops, coverage, recent] = await Promise.all([
    catalog.counts(),
    catalog.listCrops(
      // Browse-by-crop shows the whole catalog; the limit must cover it (124 crops, Nov 2026).
      { offset: 0, limit: 500 },
      {
        season: filters.season ? SEASON_PARAMS[filters.season] : undefined,
        methods: filters.method ? [METHOD_PARAMS[filters.method]] : undefined,
      },
    ),
    catalog.coverage(),
    catalog.recent({ limit: 6 }),
  ]);
  const withSellers = coverage.reduce((n, c) => n + c.varieties_with_sellers, 0);
  const lastUpdated = coverage.map((c) => c.last_updated).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={siteOrganizationJsonLd()} />
      <section aria-labelledby="hero-title" className="flex flex-col gap-5 pb-4 pt-2 md:grid md:grid-cols-2 md:items-center md:gap-8 md:pt-8">
        {/* Hero art: above the headline on mobile, right of the headline column on md+ (LCP image). */}
        <div className="order-first md:order-last">
          <ThemeArt name="hero" priority className="art-frame h-auto w-full" />
        </div>
        <div>
          <p className="eyebrow">Small farms · stock as last seen · direct links</p>
          <h1 id="hero-title" className="mt-2 text-3xl font-semibold text-leaf md:text-5xl">
            Find where to buy any flower seed
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">
            Search a variety by any name it goes by and see every small farm that sells it — with its stock state as last
            seen, the date we checked, and a direct link to the farm’s shop.
          </p>
          <div className="mt-5 max-w-2xl">
            <SearchBox label="Search flower seeds" />
          </div>
          <p className="mt-4 font-display text-sm text-muted" data-testid="coverage-line">
            {plural(counts.varieties, "variety", "varieties")} cataloged across {plural(counts.plants, "crop")} ·{" "}
            {withSellers} with a small-farm seller · {plural(counts.sellers, "farm")} · {plural(counts.listings, "listing")}
            {lastUpdated ? ` · updated ${lastUpdated}` : ""}
          </p>
        </div>
      </section>
      {/* Divider motif B: the centred ornament for this major break (hero → browse). ~104px tall at
          480px wide, so clear space ≥52px each side: mt-10 (40px) + the hero's pb-4 (16px) = 56px
          above; mb-8 (32px) + the crops section's py-6 top (24px) = 56px below. */}
      <MotifDivider variant="home" className="mb-8 mt-10" />

      <section aria-labelledby="crops-title" className="py-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="crops-title" className="text-2xl font-semibold">
            Browse by crop
          </h2>
          <Link href="/crop" className="tap inline-flex items-center text-sm font-medium">
            All crops
          </Link>
        </div>
        <BrowseFilters basePath="/" state={filters} groups={["season", "method"]} />
        {active.length ? (
          <p className="mt-3 text-muted" data-testid="filter-result">
            {[plural(crops.total, "crop"), ...active].join(" · ")}
          </p>
        ) : null}
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {crops.items.map((c) => (
            <li key={c.slug} className="h-full">
              {/* Vintage seed packet, revised 2026-11-16 at the owner's direction: the crop
                  illustration as packet art on top, the crop name centred at the BOTTOM in a
                  fixed-height zone, and NO seed-house imprint line. No counts — the owner
                  asked for the variety/seller count lines off the homepage cards. Every card
                  is the same height: full-height link, fixed-aspect art, fixed name zone. */}
              <Link
                href={`/crop/${c.slug}`}
                className="card card-hover packet tap flex h-full flex-col items-center p-4 text-center no-underline"
              >
                <span className="block w-full">
                  <CropCardImage media={c.media} commonName={c.commonName} />
                </span>
                <span aria-hidden="true" className="divider-stem-mini mt-1" />
                <span className="flex h-[3.5rem] items-center justify-center">
                  <span className="line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">{shortCommonName(c.commonName)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <PodDivider bundle="/ornaments/bundle-cosmos.webp" className="my-2" />

      <section aria-labelledby="recent-title" className="py-6">
        <h2 id="recent-title" className="text-2xl font-semibold">
          Recently restocked and newly listed
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-muted">Nothing new yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {recent.map((r) => (
              <li key={`${r.listing.id}-${r.at}-${r.event}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <Link href={`/variety/${r.listing.variety.slug}`} className="font-medium">
                    {r.listing.variety.varietyName} {shortCommonName(r.listing.variety.plant.commonName).toLowerCase()}
                  </Link>{" "}
                  <span className="text-muted">
                    at <Link href={`/seller/${r.listing.seller.slug}`}>{r.listing.seller.name}</Link> · {EVENT_LABEL[r.event]}{" "}
                    {r.at.slice(0, 10)}
                  </span>
                </span>
                <AvailabilityBadge value={r.listing.availability} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <PodDivider bundle="/ornaments/bundle-sunflower.webp" className="my-2" />

      <section aria-labelledby="how-title" className="my-6 rounded-[18px] bg-leaf-50 px-4 py-6 md:px-6">
        <h2 id="how-title" className="text-2xl font-semibold">
          How this directory works
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          <li className="card p-4">
            <h3 className="font-semibold">Small farms, approved by hand</h3>
            <p className="mt-1 text-sm text-muted">
              Every seller is a small farm or seed shop we approved one by one. Large seed companies are not listed.
            </p>
          </li>
          <li className="card p-4">
            <h3 className="font-semibold">A checked date on every listing</h3>
            <p className="mt-1 text-sm text-muted">
              Each listing shows its stock state as last seen, and when we last checked it.
            </p>
          </li>
          <li className="card p-4">
            <h3 className="font-semibold">No checkout</h3>
            <p className="mt-1 text-sm text-muted">
              We never sell seed. Every Shop button goes straight to the farm’s own shop.{" "}
              <Link href="/about/data">About the data</Link>
            </p>
          </li>
        </ul>
      </section>
    </>
  );
}
