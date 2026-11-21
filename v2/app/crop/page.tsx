import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BrowseFilters, activeFilterLabels, type BrowseFilterState } from "@/components/ui/BrowseFilters";
import { CropCardImage } from "@/components/crop/CropCardImage";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { plural } from "@/lib/format";
import { parseMethodParam, parseSeasonParam } from "@/lib/paging";
import { METHOD_PARAMS, SEASON_PARAMS } from "@/lib/validators";
import { proseCommonName } from "@/lib/services/template";
import { CropsSkeleton } from "./skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Flower seed crops",
  description: "Every crop in the directory with how many varieties are cataloged.",
  path: "/crop",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function CropsPage({ searchParams }: Props) {
  // No segment loading.tsx in app/crop/: it would wrap the /crop/[slug] pages below
  // in its Suspense boundary too, streaming a 200 shell before their notFound() can
  // resolve (the soft-404 defect). The index skeleton lives on as the inner Suspense
  // fallback — this page's single loading announcement.
  return (
    <Suspense fallback={<CropsSkeleton />}>
      <CropsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CropsContent({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: BrowseFilterState = { season: parseSeasonParam(sp.season), method: parseMethodParam(sp.method), lifeCycle: null, hue: null, smallFarm: false };
  const active = activeFilterLabels(filters);
  const { catalog } = await getServices();
  const { items } = await catalog.listCrops(
    // The index renders every crop on one page; the catalog passed 100 crops in Nov 2026,
    // so the limit must cover the whole catalog (the 100 cap is an API-route concern only).
    { offset: 0, limit: 500 },
    {
      season: filters.season ? SEASON_PARAMS[filters.season] : undefined,
      methods: filters.method ? [METHOD_PARAMS[filters.method]] : undefined,
    },
  );
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Crops", href: "/crop" },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd("Flower seed crops", items.map((c) => ({ name: c.commonName, href: `/crop/${c.slug}` })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Crops</h1>
      <p className="mt-2 text-muted">
        {active.length
          ? `${[plural(items.length, "crop"), ...active].join(" · ")}, alphabetical.`
          : `${plural(items.length, "crop")} in the directory, alphabetical.`}
      </p>
      <BrowseFilters basePath="/crop" state={filters} groups={["season", "method"]} />
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => (
          <li key={c.slug} className="card card-hover relative p-4 focus-within:ring-2 focus-within:ring-focus">
            <CropCardImage media={c.media} commonName={c.commonName} />
            <h2 className="text-lg font-semibold">
              <Link href={`/crop/${c.slug}`} className="text-ink no-underline after:absolute after:inset-0 hover:underline">
                {proseCommonName(c.commonName)}
              </Link>
            </h2>
            {c.latinName ? (
              <p className="text-sm text-muted">
                <i>{c.latinName}</i>
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {plural(c.varietyCount, "variety", "varieties")}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
