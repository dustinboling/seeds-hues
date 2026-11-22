import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Swatch } from "@/components/ui/Swatch";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { SellerFilterSection } from "@/components/variety/SellerFilterSection";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { ViewBeacon } from "@/components/variety/ViewBeacon";
import { ProtectionBadge, showsProtection } from "@/components/variety/ProtectionBadge";
import { VarietyHeroImage } from "@/components/variety/VarietyHeroImage";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { resolveColorChip } from "@/lib/color-chip";
import { mediaOgImage, ogImage, pageMetadata, varietyDescription, varietyTitle } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, varietySellersJsonLd } from "@/lib/seo/jsonld";
import { formatHeight, shortCommonName, titleCaseTag } from "@/lib/format";
import { sellerCounts } from "@/lib/seller-counts";
import { proseCommonName } from "@/lib/services/template";
import { zeroSellerSentence } from "@/lib/zero-seller";
import { SEASON_LABELS, SOWING_METHOD_LABELS, type VarietyFacts } from "@/lib/validators";
import { SMALL_FARM_PARAM } from "@/lib/small-farm";

/**
 * The variety detail page, shared by its two ISR routes (Open Directory, ux-spec §4):
 *
 *   app/variety/[slug]/page.tsx              /variety/{slug}                    all sellers
 *   app/variety/[slug]/small-farms/page.tsx  /variety/{slug}?small_farm=true    Small farms only
 *
 * The public filtered URL keeps the site's one filter vocabulary (`?small_farm=true`); middleware
 * rewrites it onto the internal `small-farms` path. That makes the narrowed view its own route
 * with its own ISR cache entry — keyed by path, since ISR pages never see the query string — so
 * neither variant can ever be served from, or stored into, the other's entry (ux-spec §4.2).
 * Revalidation of `/variety/{slug}` is expanded to the variant everywhere (lib/api/revalidate.ts
 * withVariantPaths).
 */

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  return catalog.getVariety(slug);
});

const UNKNOWN = "Unknown";
const POLLINATION_LABEL: Record<VarietyFacts["pollination"], string> = {
  open_pollinated: "Open-pollinated",
  f1_hybrid: "F1 hybrid",
  unknown: UNKNOWN,
};

function range(r: { min: number | null; max: number | null }, fmt: (n: number) => string): string {
  if (r.min === null && r.max === null) return UNKNOWN;
  if (r.min !== null && r.max !== null && r.min !== r.max) return `${fmt(r.min)}–${fmt(r.max)}`;
  return fmt((r.min ?? r.max)!);
}

export async function varietyMetadata(slug: string, smallFarmOnly: boolean): Promise<Metadata> {
  const v = await load(slug);
  if (!v) return { title: "Variety not found", robots: { index: false, follow: true } };
  const label = `${v.varietyName} ${shortCommonName(v.plant.commonName)}`;
  const hero = v.media[0];
  return pageMetadata({
    title: varietyTitle(v),
    description: varietyDescription(v),
    // The narrowed view canonicalises to the unfiltered page and is never indexed — the site's
    // standing rule for filtered views (ux-spec §4.2).
    path: `/variety/${v.slug}`,
    // Owner ruling 2026-11-16: every active variety page is indexable, sellers or not.
    noindex: smallFarmOnly || !v.indexable,
    follow: true,
    // An own-work illustration, when the variety has one, is the share image; else the generated card.
    og: hero ? mediaOgImage(hero.url, label) : ogImage("variety", v.slug, label),
  });
}

export async function VarietyView({ slug, smallFarmOnly }: { slug: string; smallFarmOnly: boolean }) {
  const v = await load(slug);
  if (!v) {
    const { catalog } = await getServices();
    const target = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? await catalog.mergedVarietyTarget(slug) : null;
    if (target) permanentRedirect(`/variety/${target}${smallFarmOnly ? `?${SMALL_FARM_PARAM}=true` : ""}`);
    notFound();
  }
  const { catalog } = await getServices();
  const siblings = (
    await catalog.listVarieties({ filters: { plant: [v.plant.slug] }, page: { offset: 0, limit: 7 } })
  ).items.filter((s) => s.slug !== v.slug).slice(0, 6);

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
    { label: "Crop", value: <Link href={`/crop/${v.plant.slug}`}>{proseCommonName(v.plant.commonName)}</Link> },
    { label: "Latin name", value: v.plant.latinName ? <i>{v.plant.latinName}</i> : UNKNOWN },
    { label: "Series", value: v.series ? <Link href={`/series/${v.series.slug}`}>{v.series.name}</Link> : "None" },
    { label: "Hue", value: v.facts.color_family === "unknown" ? UNKNOWN : titleCaseTag(v.facts.color_family) },
    {
      label: "Season",
      value: v.plant.season_class ? (
        <>
          {SEASON_LABELS[v.plant.season_class]}
        </>
      ) : (
        UNKNOWN
      ),
    },
    {
      label: "Sowing method",
      value: v.plant.sowing_methods.length ? (
        <>
          {v.plant.sowing_methods.map((m) => SOWING_METHOD_LABELS[m]).join(" · ")}
        </>
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
        <header className="flex items-start gap-4">
          <Swatch chip={chip} size="lg" label={v.varietyName} />
          <div className="min-w-0">
            <p className="eyebrow">
              {proseCommonName(v.plant.commonName)}
              {v.plant.latinName ? (
                <>
                  {" · "}
                  <i className="normal-case tracking-normal">{v.plant.latinName}</i>
                </>
              ) : null}
            </p>
            <h1 id="variety-title" className="mt-1 text-3xl font-semibold text-leaf md:text-4xl">
              {v.varietyName} <span className="block text-xl font-normal text-ink md:text-2xl">{common} seeds</span>
            </h1>
            <p className="mt-2 text-lg font-medium" data-testid="answer">
              {v.answer}
            </p>
          </div>
        </header>

        <section aria-labelledby="about-title" className="mt-6 max-w-3xl">
          <h2 id="about-title" className="text-xl font-semibold">
            About {label}
          </h2>
          <p className="mt-2">{v.description ?? v.templateDescription}</p>
          {v.description ? (
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold">Directory summary: </span>
              {v.templateDescription}
            </p>
          ) : null}
        </section>

        <div className={v.media[0] ? "md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8" : undefined}>
        {v.media[0] ? <VarietyHeroImage media={v.media[0]} label={label} /> : null}

        <section aria-labelledby="buy-title" className="mt-6">
          <h2 id="buy-title" className="text-2xl font-semibold">
            Where to buy {label} seeds
          </h2>
          {/* Quiet Ledger header block (2026-11-20): the "N shops · M in stock" summary over the
              variety's full listing set, then the honesty line — relocated here, directly under
              the header, from below the list (the old lower wording is gone; it appears once). */}
          {v.listings.length > 0 ? (
            <p className="mt-2.5 font-sans text-[13px] font-semibold text-ink-soft">
              {shops.sellers} {shops.sellers === 1 ? "shop" : "shops"} ·{" "}
              {shops.inStockSellers} in stock
            </p>
          ) : null}
          <p className="mt-[5px] max-w-[34ch] text-[15px] leading-[1.45] text-muted">
            Stock is as last seen when we checked each shop — it may have changed since. Prices are shown at the
            shop, not here.
          </p>
          {v.listings.length === 0 ? (
            <>
            <ThemeArt name="empty-no-sellers" className="art-frame mx-auto mt-4 h-[220px] w-auto" />
            <p className="mt-2 text-muted">
              <strong className="font-semibold text-ink">{zeroSellerSentence(v.varietyName)}</strong> Browse{" "}
              <Link href="/seller">all sellers</Link> or other{" "}
              <Link href={`/crop/${v.plant.slug}`}>{common.toLowerCase()} varieties</Link>. Know a seller who
              sells it? <Link href={`/report?type=correct&variety=${v.slug}`}>Tell us</Link>.
            </p>
            <WaitlistBlock varietySlug={v.slug} varietyName={v.varietyName} />
            </>
          ) : (
            <>
              {/* Chips + count + legend + list live in the sellers section: after hydration
                  the filter toggles in place (History API, no router navigation). First paint
                  stays server-rendered from initialSmallFarmOnly, identical to the old markup
                  on both variants. */}
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

        <section aria-labelledby="facts-title" className="mt-8">
          <h2 id="facts-title" className="text-xl font-semibold">
            Variety facts
          </h2>
          <dl className="card mt-3 grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-muted">{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-muted">Rating</dt>
              <dd>
                <RatingDisplay ratingCount={v.rating.review_count} />
              </dd>
            </div>
            {chip.kind !== "none" ? (
              <div>
                <dt className="text-sm text-muted">Swatch</dt>
                <dd className="flex items-center gap-2">
                  <Swatch chip={chip} size="sm" label={v.varietyName} />
                  {chip.kind === "hex" ? <span className="font-mono text-sm">{chip.hex}</span> : null}
                </dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Also sold as</dt>
              <dd>{v.aliases.length ? v.aliases.join(", ") : "No other names on file"}</dd>
            </div>
            {v.tags.length ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {v.tags.map((t) => (
                    <span key={t} className="chip">
                      {titleCaseTag(t)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
          {showsProtection(v.protection, v.protectionNote) ? (
            <div className="mt-3">
              <ProtectionBadge protection={v.protection} note={v.protectionNote} />
            </div>
          ) : null}
        </section>

        {v.sowingNotes || v.plant.sowingNotes || v.plant.description ? (
          <section aria-labelledby="sowing-title" className="mt-6 max-w-3xl">
            <h2 id="sowing-title" className="text-xl font-semibold">
              Sowing and growing
            </h2>
            {v.sowingNotes ? <p className="mt-2">{v.sowingNotes}</p> : null}
            {v.plant.sowingNotes || v.plant.description ? (
              <div className="mt-3 rounded-lg bg-leaf-50 p-3 text-sm">
                <p className="font-semibold">Crop-level guidance for {common}</p>
                {v.plant.description ? <p className="mt-1">{v.plant.description}</p> : null}
                {v.plant.sowingNotes ? <p className="mt-1">{v.plant.sowingNotes}</p> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <p className="mt-8">
          <Link href={`/report?variety=${v.slug}`}>Report a problem</Link> with this page.
        </p>

        {siblings.length ? (
          <section aria-labelledby="more-title" className="mt-10">
            <h2 id="more-title" className="text-2xl font-semibold">
              More {common.toLowerCase()} varieties
            </h2>
            <div className="mt-3">
              <VarietyGrid items={siblings} />
            </div>
            <p className="mt-3">
              <Link href={`/crop/${v.plant.slug}`}>All {proseCommonName(v.plant.commonName)} varieties</Link>
            </p>
          </section>
        ) : null}
      </article>
    </>
  );
}
