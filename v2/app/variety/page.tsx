import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { PodDivider } from "@/components/ui/PodDivider";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { VarietyBrowse, type VarietyBrowseInitial } from "@/components/variety/VarietyBrowse";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage } from "@/lib/paging";
import { activeFilterLabels, readBrowseFilters } from "@/lib/browse";
import { legacySlug } from "@/lib/legacy";
import { PAGE_SIZE } from "@/lib/config";
import { VarietiesSkeleton } from "./skeleton";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const active = activeFilterLabels(readBrowseFilters(sp, "multi"));
  const filtered = active.length > 0;
  return pageMetadata({
    title: `${filtered ? `${active.join(" · ")} — flower seed varieties` : "All flower seed varieties"}${pageTitleSuffix(page)}`,
    description:
      "Every flower seed variety in the directory, alphabetical, with how many sellers list it and when each listing was last checked.",
    // Filtered views (season, sowing method, life cycle, hue, small farms) are crawlable but not indexed; the canonical
    // is the unfiltered list (same rule as crop-page filters).
    path: filtered ? "/variety" : pagePath("/variety", page),
    noindex: filtered,
  });
}

export default async function VarietiesPage({ searchParams }: Props) {
  // Soft-404 fix: every notFound() below (bad ?page=, page past the end) resolves BEFORE
  // anything streams (this segment has no loading.tsx), so out-of-range pages answer a
  // true 404. The skeleton lives on as the inner Suspense fallback — the page's single
  // loading announcement.
  const sp = await searchParams;
  // R10: v1 query URLs → 308 to the clean URL.
  const legacy = legacySlug(sp.v);
  if (legacy) permanentRedirect(`/variety/${legacy}`);

  const page = parsePage(sp.page);
  const filters = readBrowseFilters(sp, "multi");
  const { catalog } = await getServices();
  // The browse payload: the page of results plus the per-option counts describing them —
  // the identical contract GET /api/browse/varieties serves the in-place layer.
  const payload = await catalog.browseVarieties({ filters, page: pageWindow(page) });
  assertPageInRange(page, payload.total);
  const initial: VarietyBrowseInitial = {
    state: filters,
    counts: payload.counts,
    items: payload.items,
    total: payload.total,
    page,
  };
  return (
    <Suspense fallback={<VarietiesSkeleton />}>
      <VarietiesContent page={page} initial={initial} />
    </Suspense>
  );
}

function VarietiesContent({ page, initial }: { page: number; initial: VarietyBrowseInitial }) {
  const filters = initial.state;
  // Every filter group joins navKey, so ResultsScrollClamp fires on each list navigation (ux-spec §3.4.2).
  // In-place changes never re-render this server tree, so the clamp cannot fire for them.
  const navKey = [page, filters.season, filters.method, filters.lifeCycle, filters.hue.join(","), filters.smallFarm].join("|");
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Varieties", href: "/variety" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          "Flower seed varieties",
          initial.items.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Flower seed varieties</h1>
      <VarietyBrowse initial={initial} />
      <PodDivider bundle="/ornaments/bundle-zinnia.webp" className="mt-8" />
      <ResultsScrollClamp targetId="variety-results-count" regionId="variety-results" navKey={navKey} />
    </>
  );
}
