/**
 * Price-guard sensitivity proof: every violation class the suite claims to
 * catch is fed through findPriceViolations and asserted to fire — including
 * the brief's case, a price string inside a listing note — while honest
 * copy (packet sizes, policy sentences) passes clean.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingRow } from "../../src/components/variety/ListingRow";
import { fakeCatalogState } from "./fake-catalog";
import { findPriceViolations } from "./price-guard";

const FOOTER = "<footer><p>No prices are shown.</p></footer>";

describe("price-guard sensitivity", () => {
  it("fires on a price string inside a listing note", () => {
    const listing = fakeCatalogState().details["sweet-pea-kings-ransom"]!.listings[0]!;
    const priced = renderToStaticMarkup(ListingRow({ listing: { ...listing, notes: "Fall sale: only $4.99!" } }));
    expect(findPriceViolations(`${FOOTER}${priced}`)).toContain("dollar amount");
  });

  it("fires on prohibited strings and price labels in visible text", () => {
    expect(findPriceViolations(`${FOOTER}<p>Special offers inside</p>`)).toContain('prohibited string "offers"');
    expect(findPriceViolations(`${FOOTER}<p>Reviewed by our staff</p>`)).toContain('prohibited string "Review"');
    expect(findPriceViolations(`${FOOTER}<p>Price: call for details</p>`)).toContain("price label");
    expect(findPriceViolations(`${FOOTER}<p>{"price": 5}</p>`)).toContain("price label");
  });

  it("fires inside JSON-LD blocks", () => {
    const dirty =
      `${FOOTER}<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","offers":[]}</script>`;
    expect(findPriceViolations(dirty)).toContain('JSON-LD contains "offers"');
  });

  it("passes honest copy: packet sizes and the policy sentences", () => {
    const listing = fakeCatalogState().details["sweet-pea-kings-ransom"]!.listings[0]!;
    const clean = renderToStaticMarkup(ListingRow({ listing }));
    expect(clean).toContain("25 seeds");
    expect(findPriceViolations(`${FOOTER}${clean}`)).toEqual([]);
    expect(
      findPriceViolations(
        `${FOOTER}<p>Stock is as last seen when we checked each shop — it may have changed since. Prices are shown at the shop, not here.</p>`,
      ),
    ).toEqual([]);
  });

  it("reports a missing footer policy sentence instead of silently passing", () => {
    expect(findPriceViolations("<main><p>Nothing here.</p></main>")).toContain("footer policy sentence missing");
  });
});
