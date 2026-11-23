import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CropBrowse, type CropBrowseInitial } from "@/components/crop/CropBrowse";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { readBrowseFiltersForGroups } from "@/lib/browse";
import { pageWindow } from "@/lib/paging";
import { CROP_BROWSE_LIMIT } from "@/lib/config";
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
  const filters = readBrowseFiltersForGroups(sp, ["season", "method"], "single");
  const { catalog } = await getServices();
  // The browse payload: the crop window plus the per-option counts describing them —
  // the identical contract GET /api/browse/crops serves the in-place layer.
  const payload = await catalog.browseCrops({ filters, page: pageWindow(1, CROP_BROWSE_LIMIT) });
  const initial: CropBrowseInitial = {
    state: filters,
    counts: payload.counts,
    items: payload.items,
    total: payload.total,
    page: 1,
  };
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Crops", href: "/crop" },
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd data={itemListJsonLd("Flower seed crops", initial.items.map((c) => ({ name: c.commonName, href: `/crop/${c.slug}` })))} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Crops</h1>
      <CropBrowse initial={initial} />
    </>
  );
}
