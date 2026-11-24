/**
 * Color chip rendering (Tranche 1.8, Parts 2 + 3): the Swatch component, the Hue filter's
 * Mixed chip, and the full variety page render the shared gradient and the swatch policy
 * through the one resolver — asserted on static markup, no database.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VarietyDetail } from "@/lib/validators";
import { fakeServices } from "../helpers/services-context";

const ctx = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("next/link", () => ({
  default: ({ href, children, scroll: _scroll, ...rest }: { href: string; children: React.ReactNode; scroll?: boolean }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children),
}));

import { BrowseFilters } from "@/components/ui/BrowseFilters";
import type { BrowseFilterState } from "@/lib/browse";
import { Swatch } from "@/components/ui/Swatch";
import { VarietyView } from "@/app/variety/[slug]/variety-view";
import { MIX_GRADIENT, resolveColorChip } from "@/lib/color-chip";
import { COLOR_FAMILY_SWATCHES } from "@/lib/validators";

const WHITE = COLOR_FAMILY_SWATCHES.white!;
const PINK = COLOR_FAMILY_SWATCHES.pink!;

describe("Swatch", () => {
  it("a Mixed variety renders the shared gradient at every size, never the sourced hex", () => {
    const chip = resolveColorChip({ colorFamily: "mix", colorSwatch: "#E8A0BF" });
    for (const size of ["sm", "md", "lg"] as const) {
      const html = renderToStaticMarkup(createElement(Swatch, { chip, size, label: "Katz Mix" }));
      expect(html).toContain(MIX_GRADIENT);
      expect(html).not.toContain("#E8A0BF");
      expect(html).toContain("mixed colors");
    }
  });

  it("a suppressed swatch renders the filed representative; an agreeing swatch renders as-is", () => {
    const suppressed = renderToStaticMarkup(
      createElement(Swatch, { chip: resolveColorChip({ colorFamily: "white", colorSwatch: "#FF69B4" }), label: "Angels Choir" }),
    );
    expect(suppressed).toContain(WHITE);
    expect(suppressed).not.toContain("#FF69B4");

    const agreed = renderToStaticMarkup(
      createElement(Swatch, { chip: resolveColorChip({ colorFamily: "pink", colorSwatch: "#FF69B4" }), label: "Pink Test" }),
    );
    expect(agreed).toContain("#FF69B4");
  });

  it("an unfiled variety renders the hatched placeholder, never the orphan swatch", () => {
    const html = renderToStaticMarkup(
      createElement(Swatch, { chip: resolveColorChip({ colorFamily: "unknown", colorSwatch: "#9370DB" }), label: "Breadseed Poppy" }),
    );
    expect(html).toContain("repeating-linear-gradient");
    expect(html).toContain("no color on file");
    expect(html).not.toContain("#9370DB");
  });
});

describe("Hue filter Mixed chip", () => {
  const state: BrowseFilterState = { season: null, method: null, lifeCycle: null, hue: ["mix"], smallFarm: false, sort: "name" };

  it("draws the same shared gradient definition the variety page uses", () => {
    const html = renderToStaticMarkup(createElement(BrowseFilters, { basePath: "/variety", state, groups: ["hue"] }));
    expect(html).toContain(MIX_GRADIENT);
  });

  it("single-family chips still render flat", () => {
    const html = renderToStaticMarkup(createElement(BrowseFilters, { basePath: "/variety", state, groups: ["hue"] }));
    expect(html).toContain(`background-color:${PINK}`);
  });
});

function detailFixture(over: { slug: string; varietyName: string; colorFamily: string; colorSwatch: string | null }): VarietyDetail {
  return {
    slug: over.slug,
    varietyName: over.varietyName,
    plant: {
      slug: "zinnia",
      commonName: "Zinnia",
      latinName: "Zinnia elegans",
      lifeCycle: null,
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
      description: null,
      sowingNotes: null,
    },
    category: { slug: "cut-flowers", name: "Cut Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: over.colorSwatch,
    colorFamily: over.colorFamily,
    listingCount: 0,
    sellerCount: 0,
    inStockCount: 0,
    lastCheckedAt: null,
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    description: null,
    templateDescription: `${over.varietyName} is a zinnia variety in this directory.`,
    answer: `No seller found selling ${over.varietyName} yet.`,
    sowingNotes: null,
    heightCm: null,
    facts: { color_family: over.colorFamily, pollination: "unknown", height_cm: { min: null, max: null }, days_to_bloom: { min: null, max: null } },
    tags: [],
    aliases: [],
    protection: "unknown",
    protectionNote: null,
    contentLevel: "thin",
    updatedAt: "2026-11-21T00:00:00.000Z",
    listings: [],
    media: [],
  };
}

const FIXTURES: Record<string, VarietyDetail> = {
  "zinnia-test-mix": detailFixture({ slug: "zinnia-test-mix", varietyName: "Test Mix", colorFamily: "mix", colorSwatch: "#E8A0BF" }),
  "zinnia-test-white": detailFixture({ slug: "zinnia-test-white", varietyName: "Test White", colorFamily: "white", colorSwatch: "#FF69B4" }),
  "zinnia-test-pink": detailFixture({ slug: "zinnia-test-pink", varietyName: "Test Pink", colorFamily: "pink", colorSwatch: "#FF69B4" }),
  "poppy-test-plain": detailFixture({ slug: "poppy-test-plain", varietyName: "Test Poppy", colorFamily: "unknown", colorSwatch: "#9370DB" }),
};

ctx.services = fakeServices({
  catalog: {
    getVariety: async (slug: string) => FIXTURES[slug] ?? null,
    listVarieties: async () => ({ items: [], total: 0 }),
    mergedVarietyTarget: async () => null,
  },
});

const pageHtml = async (slug: string) => renderToStaticMarkup(await VarietyView({ slug, smallFarmOnly: false }));

describe("variety page chip", () => {
  it("a Mixed variety with a sourced swatch renders the conic gradient; its hex appears nowhere", async () => {
    const html = await pageHtml("zinnia-test-mix");
    expect(html).toContain(MIX_GRADIENT);
    expect(html).not.toContain("#E8A0BF");
  });

  it("white family plus hot pink swatch renders the white representative, not the swatch", async () => {
    const html = await pageHtml("zinnia-test-white");
    expect(html).toContain(WHITE);
    expect(html).not.toContain("#FF69B4");
  });

  it("pink family plus hot pink swatch renders the swatch as-is", async () => {
    const html = await pageHtml("zinnia-test-pink");
    expect(html).toContain("#FF69B4");
  });

  it("unknown family plus a swatch renders no chip and no swatch row", async () => {
    const html = await pageHtml("poppy-test-plain");
    expect(html).toContain("no color on file");
    expect(html).not.toContain("#9370DB");
    expect(html).not.toContain(">Swatch<");
  });
});
