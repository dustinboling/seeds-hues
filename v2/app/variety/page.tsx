import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { VarietyGrid } from "@/components/variety/VarietyCard";
import { Pagination } from "@/components/ui/Pagination";
import { ResultsScrollClamp } from "@/components/ui/ResultsScrollClamp";
import { PodDivider } from "@/components/ui/PodDivider";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BrowseFilters, activeFilterLabels, filterParams, type BrowseFilterState } from "@/components/ui/BrowseFilters";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import {
  assertPageInRange,
  pagePath,
  pageTitleSuffix,
  pageWindow,
  parseHueParam,
  parseLifeCycleParam,
  parseMethodParam,
  parsePage,
  parseSeasonParam,
  totalPages,
} from "@/lib/paging";
import { legacySlug } from "@/lib/legacy";
import { plural } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/config";
import { METHOD_PARAMS, SEASON_PARAMS } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function readFilters(sp: Record<string, string | string[] | undefined>): BrowseFilterState {
  return {
    season: parseSeasonParam(sp.season),
    method: parseMethodParam(sp.method),
    lifeCycle: parseLifeCycleParam(sp.life_cycle),
    hue: parseHueParam(sp.color_family),
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const active = activeFilterLabels(readFilters(sp));
  const filtered = active.length > 0;
  return pageMetadata({
    title: `${filtered ? `${active.join(" · ")} — flower seed varieties` : "All flower seed varieties"}${pageTitleSuffix(page)}`,
    description:
      "Every flower seed variety in the directory, alphabetical, with how many small farms list it and when each listing was last checked.",
    // Filtered views (season, sowing method, life cycle, hue) are crawlable but not indexed; the canonical
    // is the unfiltered list (same rule as crop-page filters).
    path: filtered ? "/variety" : pagePath("/variety", page),
    noindex: filtered,
  });
}

export default async function VarietiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  // R10: v1 query URLs → 308 to the clean URL.
  const legacy = legacySlug(sp.v);
  if (legacy) permanentRedirect(`/variety/${legacy}`);

  const page = parsePage(sp.page);
  const filters = readFilters(sp);
  const active = activeFilterLabels(filters);
  const navKey = [page, filters.season, filters.method, filters.lifeCycle, filters.hue].join("|");
  const { catalog } = await getServices();
  const { items, total } = await catalog.listVarieties({
    filters: {
      season: filters.season ? [SEASON_PARAMS[filters.season]] : undefined,
      methods: filters.method ? [METHOD_PARAMS[filters.method]] : undefined,
      lifeCycle: filters.lifeCycle ? [filters.lifeCycle] : undefined,
      colorFamily: filters.hue ? [filters.hue] : undefined,
    },
    page: pageWindow(page),
  });
  assertPageInRange(page, total);
  const pages = totalPages(total);
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
          items.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Flower seed varieties</h1>
      <p id="variety-results-count" className="mt-2 text-muted" aria-live="polite" aria-atomic="true">
        {[plural(total, "variety", "varieties"), ...active].join(" · ")}, alphabetical.
        {pages > 1 ? ` Page ${page} of ${pages}.` : ""}
      </p>
      <BrowseFilters basePath="/variety" state={filters} groups={["season", "method", "lifeCycle", "hue"]} />
      <div id="variety-results" className="mt-6">
        <VarietyGrid items={items} wide />
      </div>
      <Pagination basePath="/variety" page={page} totalPages={pages} extra={filterParams(filters)} label="Varieties pages" />
      <PodDivider bundle="/ornaments/bundle-zinnia.webp" className="mt-8" />
      <ResultsScrollClamp targetId="variety-results-count" regionId="variety-results" navKey={navKey} />
    </>
  );
}
