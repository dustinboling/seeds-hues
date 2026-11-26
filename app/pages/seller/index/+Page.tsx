import { useData } from "vike-react/useData";
import { Breadcrumbs } from "../../../src/components/Breadcrumbs";
import { ThemeArt } from "../../../src/components/ThemeArt";
import { SellerBrowse } from "../../../src/components/seller/SellerBrowse";
import { JsonLd } from "../../../src/seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../../src/seo/jsonld";
import { PAGE_SIZE } from "../../../src/site";
import type { Data } from "./+data";

/**
 * /seller — the seller index, SSR paged (ported from
 * v2/app/seller/page.tsx: same breadcrumbs + BreadcrumbList, same H1, same
 * farms artwork, same page-windowed ItemList with continuous positions —
 * state-scoped under ?state= — and the same browse block with its count
 * line, state cloud, applied row, grid, and pagination).
 */
export default function Page() {
  const { browse } = useData<Data>();
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Sellers", href: "/seller" },
  ];
  const active = browse.state.state ? (browse.states.find((s) => s.code === browse.state.state) ?? null) : null;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <JsonLd
        data={itemListJsonLd(
          active ? `Flower seed sellers in ${active.name}` : "Flower seed sellers",
          browse.items.map((s) => ({ name: s.name, href: `/seller/${s.slug}` })),
          (browse.page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="page-title">Flower seed sellers</h1>
      <ThemeArt name="farms-basket" priority className="art-frame seller-index-art" />
      <SellerBrowse initial={browse} />
    </>
  );
}
