/**
 * The Locations area (SellerLocations): the presence matrix (SH-22), §5.2 entry order,
 * kind labels + Primary marker as DOM text, verbatim address lines, and the negative
 * floors — no link, no state outline, no tab semantics anywhere in the section
 * (LOC-A1…LOC-A6 inputs).
 *
 * Non-vacuity (T-A): fails on pre-build code — the component does not exist there.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SellerLocations } from "@/components/seller/SellerLocations";
import type { SellerLocation } from "@/lib/validators";

const loc = (over: Partial<SellerLocation> & { city: string; state: string }): SellerLocation => ({
  kind: "physical",
  street: null,
  zip: null,
  isPrimary: false,
  ...over,
});

const html = (name: string, locations: SellerLocation[]) => renderToStaticMarkup(createElement(SellerLocations, { name, locations }));

describe("presence matrix (SH-22)", () => {
  it("primary only → no area: no section, no heading, no empty landmark, no reserved space", () => {
    expect(html("GeoSeed", [loc({ city: "Chimacum", state: "WA", isPrimary: true })])).toBe("");
  });

  it("primary + qualifying additional → area with both entries, primary first", () => {
    const h = html("Plant Good Seed", [
      loc({ city: "Chimacum", state: "WA", isPrimary: true }),
      loc({ kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023" }),
    ]);
    expect(h).toContain("Plant Good Seed’s locations");
    expect(h.indexOf("Chimacum")).toBeLessThan(h.indexOf("Ojai"));
  });

  it("fewer than two qualifying entries → no area and no absence copy", () => {
    expect(html("GeoSeed", [])).toBe("");
    // A null-kind primary cannot qualify (the payload ships qualifying entries only —
    // this guards the component's own minimum against a hand-built set).
    expect(html("GeoSeed", [loc({ city: "Chimacum", state: "WA" }), loc({ city: "Ojai", state: "CA" })])).toBe("");
    for (const h of [html("GeoSeed", []), html("GeoSeed", [loc({ city: "X", state: "WA", isPrimary: true })])]) {
      expect(h).not.toMatch(/location/i);
    }
  });
});

describe("entry order (§5.2)", () => {
  it("DOM order is the payload's §5.2 order — primary first, then kind, then state, then city", () => {
    // The payload arrives in §5.2 order (sellerLocationRows — pinned by
    // tests/integration/shop-payload.test.ts); the component renders that order.
    const h = html("Test Farm", [
      loc({ kind: "warehouse", city: "Reno", state: "NV", isPrimary: true }),
      loc({ kind: "physical", city: "Ashland", state: "OR" }),
      loc({ kind: "physical", city: "Bend", state: "OR" }),
      loc({ kind: "mailing", city: "Ojai", state: "CA" }),
    ]);
    const order = ["Reno", "Ashland", "Bend", "Ojai"].map((c) => h.indexOf(c));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("labels, marker, verbatim lines", () => {
  const TWO: SellerLocation[] = [
    loc({ city: "Chimacum", state: "WA", isPrimary: true }),
    loc({ kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023" }),
  ];

  it("kind labels + Primary marker are real DOM text (never generated content)", () => {
    const h = html("Plant Good Seed", TWO);
    expect(h).toContain(">Physical address</span>");
    expect(h).toContain(">Mailing address</span>");
    expect(h).toContain(">Primary</span>");
    expect(h.match(/>Primary</g) ?? []).toHaveLength(1); // primary's entry only
    expect(h).not.toContain("::before");
    expect(h).not.toContain("::after");
  });

  it("address lines verbatim as published — never completed, derived, or reformatted", () => {
    const h = html("Plant Good Seed", TWO);
    expect(h).toContain("226 West Ojai Ave Ste 101-539");
    expect(h).toContain("Ojai, CA 93023");
    // City/state only where that is all that is published — no invented street line.
    expect(h).toContain("Chimacum, WA");
    expect(h).not.toMatch(/uppercase|capitalize|lowercase/);
  });

  it("structure: section + h2 + ul of li, DOM order = §5.2 order", () => {
    const h = html("Plant Good Seed", TWO);
    expect(h).toMatch(/^<section aria-labelledby="seller-locations"[^>]*>/);
    expect(h).toContain('<h2 id="seller-locations"');
    expect(h.match(/<li\b/g) ?? []).toHaveLength(2);
    expect(h.indexOf("<ul")).toBeGreaterThan(h.indexOf("</h2>"));
  });
});

describe("negative floors (LOC-A1, L-A5, L-U6)", () => {
  const TWO: SellerLocation[] = [
    loc({ city: "Chimacum", state: "WA", isPrimary: true }),
    loc({ kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023" }),
  ];

  it("no link, no state outline, no tab semantics, no focusable element in the section", () => {
    const h = html("Plant Good Seed", TWO);
    expect(h).not.toContain("<a");
    expect(h).not.toContain("<button");
    expect(h).not.toContain("tablist");
    expect(h).not.toContain("tabpanel");
    expect(h).not.toContain('role="tab"');
    expect(h).not.toContain("aria-selected");
    expect(h).not.toContain("aria-expanded");
    expect(h).not.toContain("tabindex");
    expect(h).not.toContain("<svg");
    expect(h).not.toContain("<img");
    expect(h).not.toContain("/state/");
  });
});
