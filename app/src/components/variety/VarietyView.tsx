import type { ReactNode } from "react";
import type { ApiVarietyDetail, ApiVarietyFacts, ApiVarietyListItem } from "../../data/types";
import { Breadcrumbs } from "../Breadcrumbs";
import { JsonLd } from "../../seo/JsonLd";
import { RatingDisplay } from "../RatingDisplay";
import { ThemeArt } from "../ThemeArt";
import { breadcrumbJsonLd, varietySellersJsonLd } from "../../seo/jsonld";
import { formatHeight, proseCommonName, shortCommonName, titleCaseTag } from "../../lib/format";
import { SEASON_LABELS, SOWING_METHOD_LABELS } from "../../lib/browse-labels";
import { resolveColorChip } from "../../lib/color-chip";
import { sellerCounts } from "../../lib/seller-counts";
import { zeroSellerSentence } from "../../lib/zero-seller";
import { ProtectionBadge, showsProtection } from "./ProtectionBadge";
import { ResultsScrollClamp } from "./ResultsScrollClamp";
import { SellerFilterSection } from "./SellerFilterSection";
import { Swatch } from "./Swatch";
import { VarietyGrid } from "./VarietyCard";
import { VarietyHeroImage } from "./VarietyHeroImage";
import { ViewBeacon } from "./ViewBeacon";
import { WaitlistBlock } from "./WaitlistBlock";

/**
 * The variety detail page, shared by its two SSR forms:
 *
 *   /variety/{slug}                    all sellers
 *   /variety/{slug}?small_farm=true    Small farms only
 *
 * Ported from v2/app/variety/[slug]/variety-view.tsx (same copy, same
 * structure, same builders): breadcrumbs, H1 + answer, about prose, hero,
 * the "Where to buy" section (summary, honesty line, filter, every listing
 * card in full — or the zero-seller state with its waitlist block), the
 * complete facts list, sowing notes, and the sibling strip.
 *
 * Two deliberate deltas from the live v2 sources, both required by this
 * slice's findability contract (Bea §3.1) over v2's current render:
 *  1. The answer sentence renders under the H1 for every variety (v2 gates
 *     it to zero-seller pages); the audit's Quinn check requires the
 *     with-sellers form naming the real sellers. Same builder, same data.
 *  2. The Latin-name facts row always renders, "Unknown" when neither the
 *     variety nor its crop carries one (v2 omits the row); the contract
 *     says unknown facts render the word "Unknown", never omitted.
 */

const UNKNOWN = "Unknown";
const POLLINATION_LABEL: Record<ApiVarietyFacts["pollination"], string> = {
  open_pollinated: "Open-pollinated",
  f1_hybrid: "F1 hybrid",
  unknown: UNKNOWN,
};

function range(r: { min: number | null; max: number | null }, fmt: (n: number) => string): string {
  if (r.min === null && r.max === null) return UNKNOWN;
  if (r.min !== null && r.max !== null && r.min !== r.max) return `${fmt(r.min)}–${fmt(r.max)}`;
  return fmt((r.min ?? r.max)!);
}

export function VarietyView({
  detail: v,
  siblings,
  smallFarmOnly,
}: {
  detail: ApiVarietyDetail;
  siblings: ApiVarietyListItem[];
  smallFarmOnly: boolean;
}) {
  const common = shortCommonName(v.plant.commonName);
  const label = `${v.varietyName} ${common}`;
  // One resolved chip for the whole page: the header and the facts row can never disagree.
  const chip = resolveColorChip({ colorFamily: v.colorFamily, colorSwatch: v.colorSwatch });
  // Seller-framed summary (Dustin's ruling, 2026-11-21): distinct sellers, never listings.
  const shops = sellerCounts(v.listings);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: common, href: `/crop/${v.plant.slug}` },
    ...(v.series ? [{ name: `${v.series.name} series`, href: `/series/${v.series.slug}` }] : []),
    { name: v.varietyName, href: `/variety/${v.slug}` },
  ];
  const facts: { label: string; value: ReactNode }[] = [
    { label: "Crop", value: <a href={`/crop/${v.plant.slug}`}>{proseCommonName(v.plant.commonName)}</a> },
    // Delta 2 (see header): the row always renders; unknown is explicit.
    { label: "Latin name", value: v.plant.latinName ? <i>{v.plant.latinName}</i> : UNKNOWN },
    { label: "Series", value: v.series ? <a href={`/series/${v.series.slug}`}>{v.series.name}</a> : "None" },
    { label: "Hue", value: v.facts.color_family === "unknown" ? UNKNOWN : titleCaseTag(v.facts.color_family) },
    {
      label: "Season",
      value: v.plant.season_class ? <>{SEASON_LABELS[v.plant.season_class]}</> : UNKNOWN,
    },
    {
      label: "Sowing method",
      value: v.plant.sowing_methods.length ? (
        <>{v.plant.sowing_methods.map((m) => SOWING_METHOD_LABELS[m]).join(" · ")}</>
      ) : (
        UNKNOWN
      ),
    },
    { label: "Pollination", value: POLLINATION_LABEL[v.facts.pollination] },
    { label: "Height", value: v.heightCm !== null ? formatHeight(v.heightCm) : range(v.facts.height_cm, (n) => `${n} cm`) },
    { label: "Days to bloom", value: range(v.facts.days_to_bloom, (n) => `${n} days`) },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={varietySellersJsonLd(v)} />
      <ViewBeacon varietySlug={v.slug} />
      <Breadcrumbs items={crumbs} />
      <article aria-labelledby="variety-title">
        <header className="variety-header">
          <Swatch chip={chip} size="lg" label={v.varietyName} />
          <div className="variety-heading">
            <p className="eyebrow">
              {proseCommonName(v.plant.commonName)}
              {v.plant.latinName ? (
                <>
                  {" · "}
                  <i className="eyebrow-latin">{v.plant.latinName}</i>
                </>
              ) : null}
            </p>
            <h1 id="variety-title" className="variety-title">
              {v.varietyName} <span className="variety-title-crop">{common} seeds</span>
            </h1>
            {/* Delta 1 (see header): the answer sentence renders for every
                variety — the page's GEO substance, plainly stated, at the top. */}
            <p className="variety-answer" data-testid="answer">
              {v.answer}
            </p>
          </div>
        </header>

        <section aria-labelledby="about-title" className="variety-about">
          <h2 id="about-title" className="section-title">
            About {label}
          </h2>
          <p className="variety-description">{v.description ?? v.templateDescription}</p>
          {v.description ? (
            <p className="variety-template-description">
              <span className="variety-template-label">Directory summary: </span>
              {v.templateDescription}
            </p>
          ) : null}
        </section>

        <div className={v.media[0] ? "variety-media-layout" : undefined}>
        {v.media[0] ? <VarietyHeroImage media={v.media[0]} label={label} /> : null}

        <section aria-labelledby="buy-title" className="variety-buy">
          <h2 id="buy-title" className="section-title-lg">
            Where to buy {label} seeds
          </h2>
          {/* The "N shops · M in stock" summary over the variety's full
              listing set, then the honesty line — directly under the header. */}
          {v.listings.length > 0 ? (
            <p className="listing-summary">
              {shops.sellers} {shops.sellers === 1 ? "shop" : "shops"} ·{" "}
              {shops.inStockSellers} in stock
            </p>
          ) : null}
          <p className="honesty-line">
            Stock is as last seen when we checked each shop — it may have changed since. Prices are shown at the
            shop, not here.
          </p>
          {v.listings.length === 0 ? (
            <>
            <ThemeArt name="empty-no-sellers" className="art-frame empty-no-sellers" />
            <p className="zero-seller-copy">
              <strong className="zero-seller-sentence">{zeroSellerSentence(v.varietyName)}</strong> Browse{" "}
              <a href="/seller">all sellers</a> or other{" "}
              <a href={`/crop/${v.plant.slug}`}>{common.toLowerCase()} varieties</a>. Know a seller who
              sells it? <a href={`/report?type=correct&variety=${v.slug}`}>Tell us</a>.
            </p>
            <WaitlistBlock varietySlug={v.slug} varietyName={v.varietyName} />
            </>
          ) : (
            <>
              {/* Chips + count + legend + list live in the sellers section: after hydration
                  the filter toggles in place (History API, no router navigation). First paint
                  stays server-rendered from initialSmallFarmOnly. */}
              <SellerFilterSection
                slug={v.slug}
                varietyName={v.varietyName}
                listings={v.listings}
                initialSmallFarmOnly={smallFarmOnly}
              />
              {/* The clamp's navKey is frozen at its server value — this server component never
                  re-renders for a client-side toggle — so the in-place filter cannot fire it. */}
              <ResultsScrollClamp targetId="variety-listing-count" regionId="variety-listings" navKey={smallFarmOnly ? "small_farm" : "all"} />
            </>
          )}
        </section>
        </div>

        <section aria-labelledby="facts-title" className="variety-facts">
          <h2 id="facts-title" className="section-title">
            Variety facts
          </h2>
          <dl className="card facts-grid">
            {facts.map((f) => (
              <div key={f.label} className="facts-row">
                <dt className="facts-label">{f.label}</dt>
                <dd className="facts-value">{f.value}</dd>
              </div>
            ))}
            <div className="facts-row">
              <dt className="facts-label">Rating</dt>
              <dd className="facts-value">
                <RatingDisplay ratingCount={v.rating.review_count} />
              </dd>
            </div>
            {chip.kind !== "none" ? (
              <div className="facts-row">
                <dt className="facts-label">Swatch</dt>
                <dd className="facts-value facts-swatch">
                  <Swatch chip={chip} size="sm" label={v.varietyName} />
                  {chip.kind === "hex" ? <span className="swatch-hex">{chip.hex}</span> : null}
                </dd>
              </div>
            ) : null}
            <div className="facts-row facts-row-wide">
              <dt className="facts-label">Also sold as</dt>
              <dd className="facts-value">{v.aliases.length ? v.aliases.join(", ") : "No other names on file"}</dd>
            </div>
            {v.tags.length ? (
              <div className="facts-row facts-row-wide">
                <dt className="facts-label">Tags</dt>
                <dd className="facts-value facts-tags">
                  {v.tags.map((t) => (
                    <span key={t} className="chip-tag">
                      {titleCaseTag(t)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          {showsProtection(v.protection, v.protectionNote) ? (
            <div className="variety-protection">
              <ProtectionBadge protection={v.protection} note={v.protectionNote} />
            </div>
          ) : null}
        </section>

        {v.sowingNotes || v.plant.sowingNotes || v.plant.description ? (
          <section aria-labelledby="sowing-title" className="variety-sowing">
            <h2 id="sowing-title" className="section-title">
              Sowing and growing
            </h2>
            {v.sowingNotes ? <p className="variety-sowing-notes">{v.sowingNotes}</p> : null}
            {v.plant.sowingNotes || v.plant.description ? (
              <div className="crop-guidance">
                <p className="crop-guidance-title">Crop-level guidance for {common}</p>
                {v.plant.description ? <p className="crop-guidance-text">{v.plant.description}</p> : null}
                {v.plant.sowingNotes ? <p className="crop-guidance-text">{v.plant.sowingNotes}</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="variety-report">
          <a href={`/report?variety=${v.slug}`}>Report a problem</a> with this page.
        </p>

        {siblings.length ? (
          <section aria-labelledby="more-title" className="variety-siblings">
            <h2 id="more-title" className="section-title-lg">
              More {common.toLowerCase()} varieties
            </h2>
            <div className="variety-siblings-grid">
              <VarietyGrid items={siblings} />
            </div>
            <p className="variety-siblings-all">
              <a href={`/crop/${v.plant.slug}`}>All {proseCommonName(v.plant.commonName)} varieties</a>
            </p>
          </section>
        ) : null}
      </article>
    </>
  );
}
