/**
 * The OG card's color circle (Tranche 1.8, Parts 2 + 3): a Mixed variety draws the shared
 * conic gradient, a contradicting swatch falls back to its filed family, and an unfiled
 * variety draws the neutral ground — asserted on the card model the route renders.
 */
import { describe, expect, it } from "vitest";
import type { CatalogService } from "@/lib/services/catalog";
import { buildOgCard } from "@/lib/og-card";
import { MIX_GRADIENT } from "@/lib/color-chip";
import { COLOR_FAMILY_SWATCHES } from "@/lib/validators";

const WHITE = COLOR_FAMILY_SWATCHES.white!;

type Variety = { plant: { commonName: string; latinName: string | null }; varietyName: string; listings: { seller: { slug: string } }[]; colorFamily: string; colorSwatch: string | null };

function catalogWith(varieties: Record<string, Variety>) {
  return {
    getVariety: async (slug: string) => varieties[slug] ?? null,
    getSeller: async (slug: string) => (slug === "floret" ? { location: "Mount Vernon, WA", name: "Floret", varietyCount: 3 } : null),
    getCrop: async (slug: string) =>
      slug === "zinnia" ? { crop: { latinName: "Zinnia elegans", commonName: "Zinnia", varietyCount: 10, varietiesWithSellers: 4 } } : null,
  } as unknown as Pick<CatalogService, "getVariety" | "getSeller" | "getCrop">;
}

const MIX: Variety = {
  plant: { commonName: "Stock", latinName: "Matthiola incana" },
  varietyName: "Katz Mix",
  listings: [{ seller: { slug: "floret" } }],
  colorFamily: "mix",
  colorSwatch: "#E8A0BF",
};

describe("variety card swatch", () => {
  it("a Mixed variety draws the shared gradient, not its sourced hex flat", async () => {
    const card = (await buildOgCard("variety", "stock-katz-mix", catalogWith({ "stock-katz-mix": MIX })))!;
    expect(card.swatch).toBe(MIX_GRADIENT);
    expect(card.swatch).not.toContain("#E8A0BF");
  });

  it("a contradicting swatch falls back to the filed representative; an agreeing one renders as-is", async () => {
    const catalog = catalogWith({
      white: { ...MIX, varietyName: "Test White", colorFamily: "white", colorSwatch: "#FF69B4" },
      pink: { ...MIX, varietyName: "Test Pink", colorFamily: "pink", colorSwatch: "#FF69B4" },
    });
    expect((await buildOgCard("variety", "white", catalog))!.swatch).toBe(WHITE);
    expect((await buildOgCard("variety", "pink", catalog))!.swatch).toBe("#FF69B4");
  });

  it("an unfiled variety draws the neutral ground even with a sourced swatch", async () => {
    const catalog = catalogWith({ plain: { ...MIX, varietyName: "Test Poppy", colorFamily: "unknown", colorSwatch: "#9370DB" } });
    expect((await buildOgCard("variety", "plain", catalog))!.swatch).toBeNull();
  });

  it("a filed family without a swatch draws its representative", async () => {
    const catalog = catalogWith({ orange: { ...MIX, varietyName: "Test Orange", colorFamily: "orange", colorSwatch: null } });
    expect((await buildOgCard("variety", "orange", catalog))!.swatch).toBe(COLOR_FAMILY_SWATCHES.orange);
  });
});

describe("other cards are unchanged", () => {
  const catalog = catalogWith({ "stock-katz-mix": MIX });

  it("site, seller, and crop cards keep their swatches", async () => {
    expect((await buildOgCard("site", "site", catalog))!.swatch).toBe("#8E2A52");
    expect((await buildOgCard("seller", "floret", catalog))!.swatch).toBeNull();
    expect((await buildOgCard("crop", "zinnia", catalog))!.swatch).toBeNull();
  });

  it("unknown kinds, bad slugs, and missing records are still null", async () => {
    expect(await buildOgCard("nope", "zinnia", catalog)).toBeNull();
    expect(await buildOgCard("variety", "BAD_SLUG!!", catalog)).toBeNull();
    expect(await buildOgCard("variety", "no-such-variety", catalog)).toBeNull();
  });
});
