import Link from "next/link";
import type { Metadata } from "next";
import { SearchBox } from "@/components/search/SearchBox";
import { HomeBrowse, type HomeBrowseInitial } from "@/components/home/HomeBrowse";
import { AvailabilityBadge } from "@/components/variety/Availability";
import { HomeMotifDivider } from "@/components/ui/HomeMotifDivider";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { PodDivider } from "@/components/ui/PodDivider";
import { readBrowseFiltersForGroups } from "@/lib/browse";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { siteOrganizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { CROP_BROWSE_LIMIT, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/config";
import { formatFriendlyDate, plural, shortCommonName } from "@/lib/format";
import { pageWindow } from "@/lib/paging";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});

// Exhaustive over LISTING_EVENT (only first_seen/restocked reach this feed —
// recentEventRows filters to those two; the rest never render here).
const EVENT_LABEL = { first_seen: "Newly listed", restocked: "Restocked", sold_out: "Sold out", gone: "Gone", restored: "Restored" } as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters = readBrowseFiltersForGroups(sp, ["season", "method"], "single");
  const { catalog } = await getServices();
  const [counts, payload, coverage, recent] = await Promise.all([
    catalog.counts(),
    // The browse payload: the crop window plus the per-option counts describing them —
    // the identical contract GET /api/browse/crops serves the in-place layer.
    catalog.browseCrops({ filters, page: pageWindow(1, CROP_BROWSE_LIMIT) }),
    catalog.coverage(),
    catalog.recent({ limit: 6 }),
  ]);
  const initial: HomeBrowseInitial = {
    state: filters,
    counts: payload.counts,
    items: payload.items,
    total: payload.total,
    page: 1,
  };
  const withSellers = coverage.reduce((n, c) => n + c.varieties_with_sellers, 0);
  const lastUpdated = coverage.map((c) => c.last_updated).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const lastUpdatedFriendly = formatFriendlyDate(lastUpdated);

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
          <p className="eyebrow">Hard-to-find flower seed · stock as last seen · direct links</p>
          <h1 id="hero-title" className="mt-2 text-3xl font-semibold text-leaf md:text-5xl">
            Find where to buy any flower seed
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">
            Some flower seed is hard to track down — a variety may turn up at only one seller, under a slightly
            different name, or not at all this year. Search by any name it goes by and see who has it, with its stock
            state as last seen, the date we checked, and a direct link to the seller’s shop.
          </p>
          <div className="mt-5 max-w-2xl">
            <SearchBox label="Search flower seeds" />
          </div>
          <p className="mt-4 font-display text-sm text-muted" data-testid="coverage-line">
            {plural(counts.varieties, "variety", "varieties")} cataloged across {plural(counts.plants, "crop")} ·{" "}
            {withSellers} with a seller · {plural(counts.sellers, "seller")} · {plural(counts.listings, "listing")}
            {lastUpdatedFriendly ? ` · updated ${lastUpdatedFriendly}` : ""}
          </p>
        </div>
      </section>
      {/* C3 — Vine & Pods, Revised (love-in-a-puff) motif for this major break (hero → recent). */}
      <HomeMotifDivider />

      <section aria-labelledby="recent-title" className="py-6">
        <h2 id="recent-title" className="text-2xl font-semibold">
          Recently restocked and newly listed
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-muted">Nothing new yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
            {recent.map((r) => (
              <li key={`${r.listing.id}-${r.at}-${r.event}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <Link href={`/variety/${r.listing.variety.slug}`} className="font-medium">
                    {r.listing.variety.varietyName} {shortCommonName(r.listing.variety.plant.commonName).toLowerCase()}
                  </Link>{" "}
                  <span className="text-muted">
                    at <Link href={`/seller/${r.listing.seller.slug}`}>{r.listing.seller.name}</Link> · {EVENT_LABEL[r.event]}{" "}
                    {formatFriendlyDate(r.at)}
                  </span>
                </span>
                <AvailabilityBadge value={r.listing.availability} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <PodDivider bundle="/ornaments/bundle-cosmos.webp" className="my-2" />

      <section aria-labelledby="crops-title" className="py-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="crops-title" className="text-2xl font-semibold">
            Browse by crop
          </h2>
          <Link href="/crop" className="tap inline-flex items-center text-sm font-medium">
            All crops
          </Link>
        </div>
        <HomeBrowse initial={initial} />
      </section>
      <PodDivider bundle="/ornaments/bundle-sunflower.webp" className="my-2" />

      <section aria-labelledby="how-title" className="my-6 rounded-card bg-leaf-50 px-4 py-6 md:px-6">
        <h2 id="how-title" className="text-2xl font-semibold">
          How this directory works
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          <li className="card p-4">
            <h3 className="font-semibold">Hard to find, in one place</h3>
            <p className="mt-1 text-sm text-muted">
              If a US farm or seed company sells a variety, we list it. Every seller we find for a variety sits on that
              variety’s page, so one search shows you who has it.
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
              We don’t sell seed. Every Shop button goes straight to the seller’s own shop.{" "}
              <Link href="/about/data">About the data</Link>
            </p>
          </li>
        </ul>
      </section>
    </>
  );
}
