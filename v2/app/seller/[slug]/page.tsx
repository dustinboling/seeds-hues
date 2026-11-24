import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { StateShape } from "@/components/seller/StateShape";
import { StatePlate } from "@/components/seller/StatePlate";
import { ImportedRatingPanel } from "@/components/seller/ImportedRatingPanel";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { SellerContactBlock } from "@/components/seller/SellerContactBlock";
import { SellerLocations } from "@/components/seller/SellerLocations";
import { ShopBrowse, type ShopBrowseInitial } from "@/components/seller/ShopBrowse";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { ogImage, pageMetadata, sellerDescription, sellerTitle } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, parsePage } from "@/lib/paging";
import { sellerTypeLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/config";
import { stateByCode } from "@/lib/data/states";
import { statePlateFor } from "@/lib/data/state-plates";
import { SMALL_FARM_LEGEND } from "@/lib/small-farm";
import {
  hasActiveShopState,
  readShopBrowseFilters,
  shopBrowseTitle,
  shopCountsFor,
  shopCropsFor,
  shopViewListings,
  type ShopCrop,
} from "@/lib/shop-browse";
import type { SellerDetail } from "@/lib/validators";
import { SellerSkeleton } from "./skeleton";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  const s = await catalog.getSeller(slug);
  if (!s) return null;
  const crops = await catalog.cropCatalog();
  return { s, crops };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const loaded = await load(slug);
  if (!loaded) return { title: "Seller not found", robots: { index: false, follow: true } };
  const { s, crops } = loaded;
  // Filtered, searched, and sorted shop views are noindexed with the canonical set to
  // the unfiltered shop URL (S-11 — the /variety discipline, extended); the unfiltered
  // shop keeps its current indexing. The title never changes with state.
  const state = readShopBrowseFilters(sp, crops);
  const stated = hasActiveShopState(state) || sp.sort !== undefined;
  return pageMetadata({
    title: shopBrowseTitle(sellerTitle(s), page),
    description: sellerDescription(s),
    path: stated ? `/seller/${s.slug}` : pagePath(`/seller/${s.slug}`, page),
    og: ogImage("seller", s.slug, s.name),
    noindex: stated,
  });
}

export default async function SellerPage({ params, searchParams }: Props) {
  // Soft-404 fix: every notFound() below resolves BEFORE anything streams (this segment has
  // no loading.tsx), so unknown slugs answer a true 404. The skeleton lives on as the inner
  // Suspense fallback — the page's single loading announcement.
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const loaded = await load(slug);
  // A removed seller answers 410 from middleware.ts; this notFound() is the backstop.
  if (!loaded) notFound();
  const { s, crops } = loaded;
  // The shop view for the URL's state, from the seller's complete listing set — every
  // shop state server-renders correctly from its URL alone (the no-JS floor). Bounds
  // hold against the NARROWED total: an out-of-range page under a filter or query
  // answers a true 404, as the unfiltered shop already does.
  const state = readShopBrowseFilters(sp, crops);
  const view = shopViewListings(s.listings, state);
  const total = view.length;
  if (total > 0) assertPageInRange(page, total);
  else if (page > 1) notFound();
  const initial: ShopBrowseInitial = {
    state,
    counts: shopCountsFor(s.listings, state, shopCropsFor(s.listings)),
    items: view.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total,
    page,
  };
  return (
    <Suspense fallback={<SellerSkeleton />}>
      <SellerContent s={s} page={page} initial={initial} crops={crops} />
    </Suspense>
  );
}

function SellerContent({ s, page, initial, crops }: { s: SellerDetail; page: number; initial: ShopBrowseInitial; crops: ShopCrop[] }) {
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
    { name: s.name, href: `/seller/${s.slug}` },
  ];
  const where = s.location ?? [s.region, s.country].filter(Boolean).join(", ");
  // The seller's own state always has ≥ 1 visible seller (this one), so /state/{slug} resolves.
  const state = s.country === "US" ? stateByCode(s.region) : null;
  // No state on file, non-US, or a state without a painted plate → no plate at all (no substitute).
  const plate = state ? statePlateFor(state.slug) : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={organizationJsonLd(s)} />
      <JsonLd
        data={itemListJsonLd(
          `Varieties listed by ${s.name}`,
          initial.items.map((l) => ({ name: l.variety.varietyName, href: `/variety/${l.variety.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <article aria-labelledby="seller-title">
        <header className="sm:flex sm:items-start sm:gap-8">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{sellerTypeLabel(s.type)}</p>
            <h1 id="seller-title" className="mt-1 text-3xl font-semibold text-leaf md:text-4xl">
              {s.name}
            </h1>
            {/* Small farm badge (ux §2.2 + §5.4, RULING F1): its own row under the h1 — outside it,
                so the page heading stays the seller's name — at the larger size, with the legend
                on the same row. Badged sellers only: no badge, no row, no legend. */}
            {s.isSmallFarm ? (
              <div className="mt-2 flex flex-wrap items-center gap-2" data-small-farm-legend="">
                <SmallFarmBadge size="large" />
                <p className="text-sm text-muted">{SMALL_FARM_LEGEND}</p>
              </div>
            ) : null}
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">Location</dt>
                <dd>
                  {where || "Unknown"}
                  {state ? (
                    <Link
                      href={`/state/${state.slug}`}
                      className="mt-1 flex w-fit items-center gap-1.5 py-1"
                      data-seller-state={state.code}
                    >
                      <StateShape region={state.code} size={22} />
                      {state.name}
                    </Link>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Varieties listed</dt>
                <dd>{s.varietyCount}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Rating</dt>
                <dd>
                  <RatingDisplay ratingCount={s.rating.review_count} />
                </dd>
              </div>
            </dl>
            <SellerContactBlock slug={s.slug} homepage={s.homepage} phone={s.customerServicePhone} email={s.customerServiceEmail} />
            {s.isSiteOwner ? (
              <p className="mt-3 text-sm text-muted">Disclosure: this seller is Hues Floral Park, which owns and operates this site.</p>
            ) : null}
          </div>
          {/* State-flower plate (state-plates spec §2): after the summary in DOM and visual order;
              eager (first viewport) with no fetchPriority — the <h1> stays the LCP (§A.5.3). */}
          {state && plate ? <StatePlate code={state.code} plate={plate} loading="eager" /> : null}
        </header>

        <SellerLocations name={s.name} locations={s.locations} />

        {s.description || s.orderingNotes ? (
          <section aria-labelledby="seller-about" className="mt-6 max-w-3xl">
            <h2 id="seller-about" className="text-xl font-semibold">
              About this seller
            </h2>
            {s.description ? <p className="mt-2">{s.description}</p> : null}
            {s.orderingNotes ? (
              <p className="mt-2 text-muted">
                <span className="font-semibold text-ink">Ordering notes: </span>
                {s.orderingNotes}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Third-party aggregate, kept apart from our own rating above (still "Not yet rated"). */}
        {s.importedRating ? <ImportedRatingPanel rating={s.importedRating} /> : null}

        <section aria-labelledby="seller-varieties" className="mt-8">
          <ShopBrowse basePath={`/seller/${s.slug}`} sellerName={s.name} baseTitle={sellerTitle(s)} initial={initial} full={s.listings} crops={crops} />
        </section>

        <p className="mt-8">
          Is this your farm or company? <Link href={`/report?seller=${s.slug}`}>Claim, correct or remove</Link> this listing.
        </p>
      </article>
    </>
  );
}
