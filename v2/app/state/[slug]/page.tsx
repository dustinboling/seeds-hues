import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SellerCard } from "@/components/seller/SellerCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServices } from "@/lib/services/context";
import { pageMetadata, stateDescription, stateTitle } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage, totalPages } from "@/lib/paging";
import { PAGE_SIZE } from "@/lib/config";
import { STATE_SCENES } from "@/lib/data/state-scenes";
import { imageUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Only states with ≥ 1 visible seller resolve; any other slug — including a real state with no
 * sellers (/state/texas) — is a 404.
 */
const loadState = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const { catalog } = await getServices();
  return (await catalog.listSellerStates()).find((s) => s.slug === slug) ?? null;
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const st = await loadState(slug);
  if (!st) return { title: "State not found", robots: { index: false, follow: true } };
  const page = parsePage(sp.page);
  return pageMetadata({
    title: `${stateTitle(st)}${pageTitleSuffix(page)}`,
    absoluteTitle: true,
    description: stateDescription(st),
    path: pagePath(`/state/${st.slug}`, page),
  });
}

export default async function StatePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const st = await loadState(slug);
  if (!st) notFound();
  const page = parsePage(sp.page);
  const { catalog } = await getServices();
  const { items, total } = await catalog.listSellers(pageWindow(page), { region: [st.code] });
  assertPageInRange(page, total);
  const pages = totalPages(total);
  const scene = STATE_SCENES[st.slug];
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
    { name: st.name, href: `/state/${st.slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          `Seed farms in ${st.name}`,
          items.map((s) => ({ name: s.name, href: `/seller/${s.slug}` })),
          (page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <header>
        {scene ? (
          <figure data-testid="state-hero">
            {/* A plain <img>: a 1200-wide scale-down transformation from our own image CDN (lib/images). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(`/theme/state-scenes/${st.slug}.webp`, { width: 1200 })}
              alt={scene.alt}
              width={scene.width}
              height={scene.height}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              data-state-hero-art={st.code}
              className="card mx-auto block h-auto max-h-[30rem] w-auto max-w-full sm:max-h-[40rem]"
            />
          </figure>
        ) : null}
        <div className="mt-6 min-w-0">
          <h1 className="text-3xl font-semibold text-leaf md:text-4xl">{`Seed farms in ${st.name}`}</h1>
          <p className="mt-2 max-w-2xl text-muted" data-state-intro>
            {total === 1
              ? `1 seed farm or company in ${st.name} lists seed with the Seed Directory.`
              : `${total} seed farms and companies in ${st.name} list seed with the Seed Directory.`}
            {pages > 1 ? ` Page ${page} of ${pages}.` : ""}
          </p>
          <p className="mt-4">
            <Link href={`/add-your-farm?state=${st.code}`} className="btn btn-primary btn-pill" data-testid="state-add-farm">
              Add Your Farm
            </Link>
            <span className="ml-3 text-sm text-muted">Sell seed from a farm in {st.name}? Listing is free.</span>
          </p>
        </div>
      </header>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-state-sellers={st.code}>
        {items.map((s) => (
          <li key={s.slug}>
            <SellerCard s={s} />
          </li>
        ))}
      </ul>
      <Pagination basePath={`/state/${st.slug}`} page={page} totalPages={pages} label={`${st.name} seller pages`} />
      <p className="mt-8">
        Is your {st.name} farm missing? <Link href={`/add-your-farm?state=${st.code}`}>Add Your Farm</Link> — we review every farm by hand.
      </p>
      <p className="mt-3">
        <Link href="/seller">All sellers</Link>
      </p>
    </>
  );
}
