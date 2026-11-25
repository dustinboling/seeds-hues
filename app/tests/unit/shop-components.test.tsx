/**
 * Slice 5 component ports, server-rendered (renderToStaticMarkup needs no
 * DOM): the branches the HTTP suite cannot reach — no fixture state holds
 * > 24 sellers, so the paged state hub renders here from a resolver-shaped
 * page window. Copy expectations are v2-verbatim, hardcoded.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StateView } from "../../src/components/state/StateView";
import { shopCatalogState } from "./shop-catalog";

const decode = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

describe("StateView paged branch", () => {
  it("renders the Page N of M intro, continuous ItemList positions, and pagination anchors", () => {
    const sellers = shopCatalogState().sellers;
    const items = [sellers.find((s) => s.slug === "blue-ridge-seeds")!, sellers.find((s) => s.slug === "faraway-seeds")!];
    const html = renderToStaticMarkup(
      StateView({
        resolved: {
          kind: "ok",
          data: {
            state: { code: "OR", name: "Oregon", slug: "oregon", sellerCount: 26 },
            items,
            total: 26,
            page: 2,
            pages: 2,
          },
        },
      }),
    );
    const text = decode(html);
    expect(text).toContain("26 seed sellers in Oregon list seed with the Seed Directory. Page 2 of 2.");
    // ItemList positions stay continuous across pages (25–26 on page 2).
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
      JSON.parse(m[1]!),
    ) as { "@type": string; itemListElement?: { position: number }[] }[];
    const lists = blocks.filter((b) => b["@type"] === "ItemList");
    expect(lists).toHaveLength(1);
    expect(lists[0]!.itemListElement!.map((e) => e.position)).toEqual([25, 26]);
    // Pagination anchors: page 1 is the bare path, prev carries rel=prev.
    expect(html).toContain('href="/state/oregon"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('aria-label="Oregon seller pages"');
  });
});
