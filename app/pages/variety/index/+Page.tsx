import { useData } from "vike-react/useData";
import "../../../src/variety.css";
import { Breadcrumbs } from "../../../src/components/Breadcrumbs";
import { VarietyBrowse } from "../../../src/components/variety/VarietyBrowse";
import { JsonLd } from "../../../src/seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd } from "../../../src/seo/jsonld";
import { PAGE_SIZE } from "../../../src/site";
import type { Data } from "./+data";

/**
 * /variety — the variety browse index, SSR paged (ported from
 * v2/app/variety/page.tsx: same breadcrumbs + BreadcrumbList, same H1, same
 * page-windowed ItemList with continuous positions, same browse block with
 * its filter/sort/applied/count/grid/pagination rendering).
 */
export default function Page() {
  const { browse } = useData<Data>();
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
          browse.items.map((v) => ({ name: v.varietyName, href: `/variety/${v.slug}` })),
          (browse.page - 1) * PAGE_SIZE + 1,
        )}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="page-title">Flower seed varieties</h1>
      <VarietyBrowse initial={browse} />
    </>
  );
}
