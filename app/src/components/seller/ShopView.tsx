/**
 * The seller shop page (ported from v2/app/seller/[slug]/page.tsx): the
 * seller's shop in presentation — H1, type-label eyebrow, location line,
 * state plate where one exists, type badge, description prose, direct
 * homepage link, visible-only rating display, the shop grid (cards to
 * /variety/{slug} with Latin name, stock word, checked date, packet
 * sizes), the contact block, and the locations area.
 *
 * Recorded delta (brief-scoped, Slice 4's precedent): the state-outline
 * icon set (StateShape) is a separate frozen item — the state link
 * renders the state NAME text exactly as v2 does and omits only the
 * decorative aria-hidden outline. No information is lost.
 */
import { Breadcrumbs } from "../Breadcrumbs";
import { RatingDisplay } from "../RatingDisplay";
import { JsonLd } from "../../seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd, organizationJsonLd } from "../../seo/jsonld";
import type { ApiSellerDetail } from "../../data/types";
import { sellerTypeLabel } from "../../lib/format";
import { stateByCode } from "../../lib/states";
import { statePlateFor } from "../../lib/state-plates";
import { SMALL_FARM_LEGEND } from "../../lib/small-farm";
import { PAGE_SIZE } from "../../site";
import type { ShopRouteResult } from "../../server/shop-route";
import { ImportedRatingPanel } from "./ImportedRatingPanel";
import { SellerContactBlock } from "./SellerContactBlock";
import { SellerLocations } from "./SellerLocations";
import { ShopBrowse } from "./ShopBrowse";
import { SmallFarmBadge } from "./SmallFarmBadge";
import { StatePlate } from "./StatePlate";
import { sellerTitle } from "../../seo/meta";

export function ShopView({ resolved }: { resolved: Extract<ShopRouteResult, { kind: "ok" }> }) {
  const { seller: s, state, counts, items, total, page } = resolved;
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
    { name: s.name, href: `/seller/${s.slug}` },
  ];
  const where = s.location ?? [s.region, s.country].filter(Boolean).join(", ");
  // The seller's own state always has ≥ 1 visible seller (this one), so /state/{slug} resolves.
  const usState = s.country === "US" ? stateByCode(s.region) : null;
  // No state on file, non-US, or a state without a painted plate → no plate at all (no substitute).
  const plate = usState ? statePlateFor(usState.slug) : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={organizationJsonLd(s)} />
      <JsonLd
        data={itemListJsonLd(
          `Varieties listed by ${s.name}`,
          items.map((l) => ({ name: l.variety.varietyName, href: `/variety/${l.variety.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <article aria-labelledby="seller-title">
        <header className="seller-header">
          <div className="seller-summary">
            <p className="eyebrow">{sellerTypeLabel(s.type)}</p>
            <h1 id="seller-title" className="seller-name">
              {s.name}
            </h1>
            {/* Small farm badge: its own row under the h1 — outside it, so
                the page heading stays the seller's name — at the larger
                size, with the legend on the same row. Badged sellers only:
                no badge, no row, no legend. */}
            {s.isSmallFarm ? (
              <div className="seller-badge-row" data-small-farm-legend="">
                <SmallFarmBadge size="large" />
                <p className="seller-badge-legend">{SMALL_FARM_LEGEND}</p>
              </div>
            ) : null}
            <dl className="seller-facts">
              <div>
                <dt className="seller-facts-label">Location</dt>
                <dd>
                  {where || "Unknown"}
                  {usState ? (
                    <a href={`/state/${usState.slug}`} className="seller-state-link" data-seller-state={usState.code}>
                      {usState.name}
                    </a>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="seller-facts-label">Varieties listed</dt>
                <dd>{s.varietyCount}</dd>
              </div>
              <div>
                <dt className="seller-facts-label">Rating</dt>
                <dd>
                  <RatingDisplay ratingCount={s.rating.review_count} />
                </dd>
              </div>
            </dl>
            <SellerContactBlock slug={s.slug} homepage={s.homepage} phone={s.customerServicePhone} email={s.customerServiceEmail} />
            {s.isSiteOwner ? (
              <p className="seller-owner-disclosure">Disclosure: this seller is Hues Floral Park, which owns and operates this site.</p>
            ) : null}
          </div>
          {/* State-flower plate: after the summary in DOM and visual order;
              eager (first viewport) with no fetchPriority — the <h1> stays the LCP. */}
          {usState && plate ? <StatePlate code={usState.code} plate={plate} loading="eager" /> : null}
        </header>

        <SellerLocations name={s.name} locations={s.locations} />

        {s.description || s.orderingNotes ? (
          <section aria-labelledby="seller-about" className="seller-about">
            <h2 id="seller-about" className="seller-about-heading">
              About this seller
            </h2>
            {s.description ? <p className="seller-description">{s.description}</p> : null}
            {s.orderingNotes ? (
              <p className="seller-ordering-notes">
                <span className="seller-ordering-notes-label">Ordering notes: </span>
                {s.orderingNotes}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Third-party aggregate, kept apart from our own rating above (still "Not yet rated"). */}
        {s.importedRating ? <ImportedRatingPanel rating={s.importedRating} /> : null}

        <section aria-labelledby="seller-varieties" className="seller-shop">
          <ShopBrowse
            basePath={`/seller/${s.slug}`}
            sellerName={s.name}
            baseTitle={sellerTitle(s)}
            initial={{ state, counts, items, total, page }}
            full={s.listings}
            crops={resolved.crops}
          />
        </section>

        <p className="seller-claim">
          Is this your farm or company? <a href={`/report?seller=${s.slug}`}>Claim, correct or remove</a> this listing.
        </p>
      </article>
    </>
  );
}
