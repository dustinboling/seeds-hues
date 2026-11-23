import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { SellerBrowse, type SellerBrowseInitial } from "@/components/seller/SellerBrowse";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage } from "@/lib/paging";
import { legacySlug } from "@/lib/legacy";
import { PAGE_SIZE } from "@/lib/config";
import { readSellerBrowseFilters } from "@/lib/seller-browse";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadStates = cache(async () => (await getServices()).catalog.listSellerStates());

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const states = await loadStates();
  const { state: code } = readSellerBrowseFilters(sp, states);
  const state = code ? (states.find((s) => s.code === code) ?? null) : null;
  return pageMetadata({
    title: `${state ? `Seed sellers in ${state.name}` : "Flower seed sellers"}${pageTitleSuffix(page)}`,
    description:
      "US farms and seed companies of every size that sell flower seed, with the varieties each one carries and when each listing was last checked.",
    // A state-filtered view is crawlable but not indexed; the canonical is the unfiltered list
    // (same rule as the browse filters). /state/{slug} is the indexable page per state.
    path: state ? "/seller" : pagePath("/seller", page),
    noindex: state !== null,
  });
}

export default async function SellersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const legacy = legacySlug(sp.s);
  if (legacy) permanentRedirect(`/seller/${legacy}`);

  const page = parsePage(sp.page);
  const states = await loadStates();
  const filters = readSellerBrowseFilters(sp, states);
  const { catalog } = await getServices();
  // The browse payload: the sellers window plus the per-option counts describing them —
  // the identical contract GET /api/browse/sellers serves the in-place layer.
  const payload = await catalog.browseSellers({ state: filters, page: pageWindow(page) });
  assertPageInRange(page, payload.total);
  const initial: SellerBrowseInitial = {
    state: filters,
    counts: payload.counts,
    items: payload.items,
    total: payload.total,
    page,
  };
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
  ];
  const active = filters.state ? (payload.states.find((s) => s.code === filters.state) ?? null) : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          active ? `Flower seed sellers in ${active.name}` : "Flower seed sellers",
          initial.items.map((s) => ({ name: s.name, href: `/seller/${s.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Flower seed sellers</h1>
      <ThemeArt name="farms-basket" priority className="art-frame mt-4 h-auto w-full max-w-3xl" />
      <SellerBrowse initial={initial} states={payload.states} />
    </>
  );
}
