import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Swatch } from "@/components/ui/Swatch";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import { ListingRow } from "@/components/variety/ListingRow";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { ViewBeacon } from "@/components/variety/ViewBeacon";
import { ProtectionBadge, showsProtection } from "@/components/variety/ProtectionBadge";
import { VarietyHeroImage } from "@/components/variety/VarietyHeroImage";
import { WaitlistBlock } from "@/components/variety/WaitlistBlock";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { mediaOgImage, ogImage, pageMetadata, varietyDescription, varietyTitle } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, varietySellersJsonLd } from "@/lib/seo/jsonld";
import { formatHeight, shortCommonName, titleCaseTag } from "@/lib/format";
import { proseCommonName } from "@/lib/services/template";
import { SEASON_LABELS, SOWING_METHOD_LABELS, type VarietyFacts } from "@/lib/validators";

// X4: nothing is pre-rendered at build (no build-time D1); every variety renders on first hit
// and is cached (ISR, OpenNext R2 incremental cache) with on-demand revalidation + 24 h fallback.
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await load(slug);
  if (!v) return { title: "Variety not found", robots: { index: false, follow: true } };
  const label = `${v.varietyName} ${shortCommonName(v.plant.commonName)}`;
  const hero = v.media[0];
  return pageMetadata({
    title: varietyTitle(v),
    description: varietyDescription(v),
    path: `/variety/${v.slug}`,
    // Owner ruling 2026-11-16: every active variety page is indexable, sellers or not.
    noindex: !v.indexable,
    follow: true,
    // An own-work illustration, when the variety has one, is the share image; else the generated card.
    og: hero ? mediaOgImage(hero.url, label) : ogImage("variety", v.slug, label),
  });
}

export default async function VarietyPage({ params }: Props) {
  const { slug } = await params;
  const v = await load(slug);
  if (!v) {
    const { catalog } = await getServices();
    const target = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? await catalog.mergedVarietyTarget(slug) : null;
    if (target) permanentRedirect(`/variety/${target}`);
    notFound();
  }
  const { catalog } = await getServices();
  const siblings = (
    await catalog.listVarieties({ filters: { plant: [v.plant.slug] }, page: { offset: 0, limit: 7 } })
  ).items.filter((s) => s.slug !== v.slug).slice(0, 6);

  const common = shortCommonName(v.plant.commonName);
  const label = `${v.varietyName} ${common}`;
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
          <Swatch hex={v.colorSwatch} size="lg" label={v.varietyName} />
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

        {v.media[0] ? <VarietyHeroImage media={v.media[0]} label={label} /> : null}

        <section aria-labelledby="buy-title" className="mt-6">
          <h2 id="buy-title" className="text-2xl font-semibold">
            Where to buy {label} seeds
          </h2>
          {v.listings.length === 0 ? (
            <>
            <ThemeArt name="empty-no-sellers" className="art-frame mx-auto mt-4 h-[220px] w-auto" />
            <p className="mt-2 text-muted">
              <strong className="font-semibold text-ink">No sellers yet — currently unavailable.</strong> No small
              farm in this directory is selling this variety right now. Browse{" "}
              <Link href="/seller">all small-farm sellers</Link> or other{" "}
              <Link href={`/crop/${v.plant.slug}`}>{common.toLowerCase()} varieties</Link>. Know a farm that sells
              it? <Link href={`/report?type=correct&variety=${v.slug}`}>Tell us</Link>.
            </p>
            <WaitlistBlock varietySlug={v.slug} varietyName={v.varietyName} />
            </>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
              {v.listings.map((l) => (
                <li key={l.id}>
                  <ListingRow listing={l} context="variety" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted">
            Stock is shown as last seen on the date checked. Prices are not shown — always confirm on the farm’s own
            site before ordering.
          </p>
        </section>

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
            {v.colorSwatch ? (
              <div>
                <dt className="text-sm text-muted">Swatch</dt>
                <dd className="flex items-center gap-2">
                  <Swatch hex={v.colorSwatch} size="sm" label={v.varietyName} />
                  <span className="font-mono text-sm">{v.colorSwatch}</span>
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
