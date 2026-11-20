import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { SellerCard } from "@/components/seller/SellerCard";
import { StateFilter } from "@/components/seller/StateFilter";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage, totalPages } from "@/lib/paging";
import { legacySlug } from "@/lib/legacy";
import { plural } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/config";
import type { SellerState } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const loadStates = cache(async () => (await getServices()).catalog.listSellerStates());

/** ?state= (a state code, e.g. OR): one of the states that has sellers; anything else is ignored (= all). */
function activeState(raw: string | string[] | undefined, states: SellerState[]): SellerState | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();
  return v ? (states.find((s) => s.code === v) ?? null) : null;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const state = activeState(sp.state, await loadStates());
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
  const state = activeState(sp.state, states);
  const { catalog } = await getServices();
  const { items, total } = await catalog.listSellers(pageWindow(page), state ? { region: [state.code] } : {});
  assertPageInRange(page, total);
  const pages = totalPages(total);
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          state ? `Flower seed sellers in ${state.name}` : "Flower seed sellers",
          items.map((s) => ({ name: s.name, href: `/seller/${s.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-semibold text-leaf">Flower seed sellers</h1>
      <ThemeArt name="farms-basket" priority className="art-frame mt-4 h-auto w-full max-w-3xl" />
      <p className="mt-2 max-w-2xl text-muted">
        {state ? (
          <>
            {plural(total, "seller")} in {state.name}. <Link href={`/state/${state.slug}`}>Seed sellers in {state.name}</Link>.
          </>
        ) : (
          <>{plural(total, "seller")} — US farms and seed companies of every size. Sellers do not pay for placement.</>
        )}
        {pages > 1 ? ` Page ${page} of ${pages}.` : ""}
      </p>
      {/* Badge legend (ux §5.3, copy-deck §5.5): once, at index level, above the state filter. */}
      <SmallFarmLegend className="mt-1 max-w-2xl" />
      <StateFilter basePath="/seller" states={states} active={state?.code ?? null} />
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li key={s.slug}>
            <SellerCard s={s} smallFarmBadge />
          </li>
        ))}
      </ul>
      <Pagination
        basePath="/seller"
        page={page}
        totalPages={pages}
        extra={state ? { state: state.code } : undefined}
        label="Sellers pages"
      />
    </>
  );
}
