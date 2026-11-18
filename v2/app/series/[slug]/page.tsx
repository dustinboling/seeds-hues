import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { plural, shortCommonName } from "@/lib/format";
import { proseCommonName } from "@/lib/services/template";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  return catalog.getSeries(slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).slug);
  if (!s) return { title: "Series not found", robots: { index: false, follow: true } };
  const crop = shortCommonName(s.crop.commonName);
  return pageMetadata({
    title: `${s.name} ${crop} Series — ${plural(s.varietyCount, "Variety", "Varieties")}, ${s.varietiesWithSellers} With Sellers`,
    description: `The ${s.name} series of ${proseCommonName(s.crop.commonName)}${s.crop.latinName ? ` (${s.crop.latinName})` : ""}: ${plural(s.varietyCount, "variety", "varieties")} cataloged, ${s.varietiesWithSellers} sold by small farms in the directory.`,
    path: `/series/${s.slug}`,
  });
}

export default async function SeriesPage({ params }: Props) {
  const s = await load((await params).slug);
  if (!s) notFound();
  const crop = shortCommonName(s.crop.commonName);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: crop, href: `/crop/${s.crop.slug}` },
    { name: `${s.name} series`, href: `/series/${s.slug}` },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd(`${s.name} series varieties`, s.varieties.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">
        {s.name} <span className="block text-xl font-normal text-ink">{crop} series</span>
      </h1>
      <dl className="card mt-4 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-2 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted">Crop</dt>
          <dd>
            <Link href={`/crop/${s.crop.slug}`}>{proseCommonName(s.crop.commonName)}</Link>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Varieties</dt>
          <dd>{s.varietyCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">With sellers</dt>
          <dd>{s.varietiesWithSellers}</dd>
        </div>
      </dl>
      <div className="mt-6">
        <VarietyGrid items={s.varieties} />
      </div>
      <p className="mt-8">
        <Link href={`/crop/${s.crop.slug}`}>All {proseCommonName(s.crop.commonName)} varieties</Link>
      </p>
    </>
  );
}
