import { useData } from "vike-react/useData";
import { AvailabilityBadge } from "../../src/components/AvailabilityBadge";
import { CropCardImage } from "../../src/components/CropCardImage";
import { HomeMotifDivider } from "../../src/components/HomeMotifDivider";
import { PodDivider } from "../../src/components/PodDivider";
import { SearchForm } from "../../src/components/SearchForm";
import { ThemeArt } from "../../src/components/ThemeArt";
import type { ApiCrop } from "../../src/data/types";
import { formatFriendlyDate, plural, shortCommonName } from "../../src/lib/format";
import { JsonLd } from "../../src/seo/JsonLd";
import { siteOrganizationJsonLd, websiteJsonLd } from "../../src/seo/jsonld";
import { HOME_CROP_CAP } from "../../src/site";
import type { Data } from "./+data";

// Exhaustive over the listing events (only first_seen/restocked reach this feed).
const EVENT_LABEL = { first_seen: "Newly listed", restocked: "Restocked", sold_out: "Sold out", gone: "Gone", restored: "Restored" } as const;

/**
 * The home grid's resting order (v2 HomeBrowse, Tranche 3.4 §5.1):
 * varieties-with-sellers descending, then name ascending, slug breaking the
 * last tie — deterministic, from the coverage numbers the items carry.
 */
function homeCropOrder(items: ApiCrop[]): ApiCrop[] {
  const lower = (c: ApiCrop): string => c.commonName.toLowerCase();
  return [...items].sort(
    (a, b) =>
      b.varietiesWithSellers - a.varietiesWithSellers ||
      (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0) ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
}

/**
 * Home — REPLACES the Slice-1 proof page. Structure, JSON-LD, and copy ported
 * from v2/app/page.tsx + the HomeBrowse resting render (resting cap, cap line,
 * packet cards). One brief-directed deviation: "We don't sell seed." renders
 * with a straight apostrophe — the brief quotes that exact string as settled
 * copy (v2 uses a curly ’). The in-place filter layer is Slice 4's.
 */
export default function Page() {
  const { counts, coverage, recent, crops, cropsTotal } = useData<Data>();
  const withSellers = coverage.reduce((n, c) => n + c.varieties_with_sellers, 0);
  const lastUpdated = coverage.map((c) => c.last_updated).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const lastUpdatedFriendly = formatFriendlyDate(lastUpdated);
  const shown = homeCropOrder(crops).slice(0, HOME_CROP_CAP);

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={siteOrganizationJsonLd()} />
      <section aria-labelledby="hero-title" className="home-hero">
        {/* Hero art: above the headline on mobile, right of the headline column on md+ (LCP image). */}
        <div className="home-hero-art">
          <ThemeArt name="hero" priority className="art-frame" />
        </div>
        <div>
          <p className="eyebrow">Hard-to-find flower seed · stock as last seen · direct links</p>
          <h1 id="hero-title">Find where to buy any flower seed</h1>
          <p className="home-lede">
            Some flower seed is hard to track down — a variety may turn up at only one seller, under a slightly
            different name, or not at all this year. Search by any name it goes by and see who has it, with its stock
            state as last seen, the date we checked, and a direct link to the seller’s shop.
          </p>
          <div className="home-search">
            <SearchForm label="Search flower seeds" />
          </div>
          <p className="home-coverage" data-testid="coverage-line">
            {plural(counts.varieties, "variety", "varieties")} cataloged across {plural(counts.plants, "crop")} ·{" "}
            {withSellers} with a seller · {plural(counts.sellers, "seller")} · {plural(counts.listings, "listing")}
            {lastUpdatedFriendly ? ` · updated ${lastUpdatedFriendly}` : ""}
          </p>
        </div>
      </section>
      {/* C3 — Vine & Pods, Revised (love-in-a-puff) motif for this major break (hero → recent). */}
      <HomeMotifDivider />

      <section aria-labelledby="recent-title" className="home-section">
        <h2 id="recent-title">Recently restocked and newly listed</h2>
        {recent.length === 0 ? (
          <p className="home-crop-count">Nothing new yet.</p>
        ) : (
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={`${r.listing.id}-${r.at}-${r.event}`}>
                <span>
                  <a href={`/variety/${r.listing.variety.slug}`} className="recent-variety-link">
                    {r.listing.variety.varietyName} {shortCommonName(r.listing.variety.plant.commonName).toLowerCase()}
                  </a>{" "}
                  <span className="recent-context">
                    at <a href={`/seller/${r.listing.seller.slug}`}>{r.listing.seller.name}</a> · {EVENT_LABEL[r.event]}{" "}
                    {formatFriendlyDate(r.at)}
                  </span>
                </span>
                <AvailabilityBadge value={r.listing.availability} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <PodDivider bundle="/ornaments/bundle-cosmos.webp" />

      <section aria-labelledby="crops-title" className="home-section">
        <div className="home-section-head">
          <h2 id="crops-title">Browse by crop</h2>
          <a href="/crop" className="home-section-link tap">
            All crops
          </a>
        </div>
        <p className="home-crop-count" data-testid="filter-result" aria-live="polite" aria-atomic="true">
          {plural(cropsTotal, "crop")}
        </p>
        {cropsTotal > 0 ? (
          <>
            <ul className="packet-grid">
              {shown.map((c) => (
                <li key={c.slug}>
                  {/* Vintage seed packet: the crop illustration as packet art on top, the crop
                      name centred at the BOTTOM in a fixed-height zone, and NO seed-house
                      imprint line. No counts. Every card is the same height. */}
                  <a href={`/crop/${c.slug}`} className="card card-hover packet-card tap">
                    <span className="packet-card-art">
                      <CropCardImage media={c.media} commonName={c.commonName} />
                    </span>
                    <span aria-hidden="true" className="divider-stem-mini" />
                    <span className="packet-card-name-zone">
                      <span className="packet-card-name">{shortCommonName(c.commonName)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="home-crop-cap" data-testid="home-crop-cap">
              Showing {shown.length} of {plural(cropsTotal, "crop")} — <a href="/crop">see all crops</a>
            </p>
          </>
        ) : (
          <p className="home-crop-count" data-testid="home-crop-empty">
            No crops match.
          </p>
        )}
      </section>
      <PodDivider bundle="/ornaments/bundle-sunflower.webp" />

      <section aria-labelledby="how-title" className="home-how">
        <h2 id="how-title">How this directory works</h2>
        <ul className="home-how-grid">
          <li className="card">
            <h3>Hard to find, in one place</h3>
            <p>
              If a US farm or seed company sells a variety, we list it. Every seller we find for a variety sits on that
              variety’s page, so one search shows you who has it.
            </p>
          </li>
          <li className="card">
            <h3>A checked date on every listing</h3>
            <p>Each listing shows its stock state as last seen, and when we last checked it.</p>
          </li>
          <li className="card">
            <h3>No checkout</h3>
            <p>
              {/* Unescaped on purpose: the brief mandates the exact bytes "We don't sell
                  seed." and React would entity-escape the apostrophe. A raw apostrophe
                  is valid HTML text. */}
              <span dangerouslySetInnerHTML={{ __html: "We don't sell seed." }} /> Every Shop button goes straight to
              the seller’s own shop. <a href="/about/data">About the data</a>
            </p>
          </li>
        </ul>
      </section>
    </>
  );
}
