import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { OutboundLink } from "@/components/ui/OutboundLink";
import { ListingRow } from "@/components/variety/ListingRow";
import { StateShape } from "@/components/seller/StateShape";
import { StatePlate } from "@/components/seller/StatePlate";
import { ImportedRatingPanel } from "@/components/seller/ImportedRatingPanel";
import { SmallFarmBadge } from "@/components/seller/SmallFarmBadge";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { ogImage, pageMetadata, sellerDescription, sellerTitle } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, parsePage, totalPages } from "@/lib/paging";
import { hostOf, plural, sellerTypeLabel } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/config";
import { stateByCode } from "@/lib/data/states";
import { statePlateFor } from "@/lib/data/state-plates";
import { SMALL_FARM_LEGEND } from "@/lib/small-farm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  return catalog.getSeller(slug);
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const s = await load(slug);
  if (!s) return { title: "Seller not found", robots: { index: false, follow: true } };
  return pageMetadata({
    title: `${sellerTitle(s)}${pageTitleSuffix(page)}`,
    description: sellerDescription(s),
    path: pagePath(`/seller/${s.slug}`, page),
    og: ogImage("seller", s.slug, s.name),
  });
}

export default async function SellerPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePage(sp.page);
  const s = await load(slug);
  // A removed seller answers 410 from middleware.ts; this notFound() is the backstop.
  if (!s) notFound();
  const total = s.listings.length;
  if (total > 0) assertPageInRange(page, total);
  else if (page > 1) notFound();
  const pages = totalPages(total);
  const shown = s.listings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
          shown.map((l) => ({ name: l.variety.varietyName, href: `/variety/${l.variety.slug}` })),
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
            {s.homepage ? (
              <p className="mt-4">
                <OutboundLink href={s.homepage} seller={s.slug} className="btn btn-primary">
                  Visit {s.name} ({hostOf(s.homepage)})
                </OutboundLink>
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">No website on file for this seller.</p>
            )}
            {s.isSiteOwner ? (
              <p className="mt-3 text-sm text-muted">Disclosure: this seller is Hues Floral Park, which owns and operates this site.</p>
            ) : null}
          </div>
          {/* State-flower plate (state-plates spec §2): after the summary in DOM and visual order;
              eager (first viewport) with no fetchPriority — the <h1> stays the LCP (§A.5.3). */}
          {state && plate ? <StatePlate code={state.code} plate={plate} loading="eager" /> : null}
        </header>

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
          <h2 id="seller-varieties" className="text-2xl font-semibold">
            Listings at {s.name}
          </h2>
          <p className="mt-1 text-muted">
            {plural(total, "listing")}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
          {shown.length === 0 ? (
            <p className="mt-3 text-muted">
              No listings for this seller yet. <Link href="/variety">Browse all varieties</Link>.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {shown.map((l) => (
                <li key={l.id}>
                  <ListingRow listing={l} context="seller" />
                </li>
              ))}
            </ul>
          )}
          <Pagination basePath={`/seller/${s.slug}`} page={page} totalPages={pages} label={`${s.name} listing pages`} />
        </section>

        <p className="mt-8">
          Is this your farm or company? <Link href={`/report?seller=${s.slug}`}>Claim, correct or remove</Link> this listing.
        </p>
      </article>
    </>
  );
}
