/**
 * The state hub page (ported from v2/app/state/[slug]/page.tsx): the
 * state scene artwork and/or plate as they exist (real <img>, no
 * substitutes), H1, the intro with the real count, the "Add Your Farm"
 * link, the paginated seller cards, and pagination anchors.
 */
import { Breadcrumbs } from "../Breadcrumbs";
import { Pagination } from "../browse/Pagination";
import { SellerCard } from "../seller/SellerCard";
import { StatePlate } from "../seller/StatePlate";
import { JsonLd } from "../../seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../seo/jsonld";
import { imageUrl } from "../../lib/images";
import { STATE_SCENES } from "../../lib/state-scenes";
import { statePlateFor } from "../../lib/state-plates";
import { PAGE_SIZE } from "../../site";
import type { StateRouteResult } from "../../server/shop-route";

export function StateView({ resolved }: { resolved: Extract<StateRouteResult, { kind: "ok" }> }) {
  const { state: st, items, total, page, pages } = resolved.data;
  const scene = STATE_SCENES[st.slug];
  // Scenes and plates are independent tables: a state may have either, both or neither.
  const plate = statePlateFor(st.slug);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
    { name: st.name, href: `/state/${st.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          `Seed sellers in ${st.name}`,
          items.map((s) => ({ name: s.name, href: `/seller/${s.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <header>
        {scene ? (
          <figure data-testid="state-hero" className="state-hero-frame">
            {/* A plain <img>: a 1200-wide scale-down transformation from our own image CDN (lib/images). */}
            <img
              src={imageUrl(`/theme/state-scenes/${st.slug}.webp`, { width: 1200 })}
              alt={scene.alt}
              width={scene.width}
              height={scene.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              data-state-hero-art={st.code}
              className="card state-hero"
            />
          </figure>
        ) : null}
        <div className="state-heading">
          <h1 className="state-name">{`Seed sellers in ${st.name}`}</h1>
          <p className="state-intro" data-state-intro>
            {total === 1
              ? `1 seed seller in ${st.name} lists seed with the Seed Directory.`
              : `${total} seed sellers in ${st.name} list seed with the Seed Directory.`}
            {pages > 1 ? ` Page ${page} of ${pages}.` : ""}
          </p>
          <p className="state-add-farm">
            <a href={`/add-your-farm?state=${st.code}`} className="btn btn-primary btn-pill" data-testid="state-add-farm">
              Add Your Farm
            </a>
            <span className="state-add-farm-note">Sell seed from a farm or company in {st.name}? Listing is free.</span>
          </p>
        </div>
      </header>
      {/* State-flower plate: directly above the farm list, in the DOM as
          well as visually, so the page reads geography → flower → farms
          and the reading order matches the visual order. Lazy with no
          fetchPriority so it never competes with the eager hero above. */}
      {plate ? <StatePlate code={st.code} plate={plate} loading="lazy" className="state-plate state-plate-state" /> : null}
      <ul className="state-sellers" data-state-sellers={st.code}>
        {items.map((s) => (
          <li key={s.slug}>
            <SellerCard s={s} />
          </li>
        ))}
      </ul>
      <Pagination basePath={`/state/${st.slug}`} page={page} totalPages={pages} label={`${st.name} seller pages`} />
      <p className="state-missing">
        Is your {st.name} farm or company missing? <a href={`/add-your-farm?state=${st.code}`}>Add Your Farm</a> — we review every submission by hand.
      </p>
      <p className="state-all-link">
        <a href="/seller">All sellers</a>
      </p>
    </>
  );
}
