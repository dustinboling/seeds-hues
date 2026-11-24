/**
 * Slice 3 OG cards: copy-level assertions (the rasterized text is asserted
 * here, on the card model — the route level asserts status, content type,
 * and PNG dimensions) plus direct PNG renders. Copy expectations are
 * hardcoded from v2/lib/seo/og-card.ts.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OgCardImage } from "../../src/components/og/OgCardImage";
import { buildOgCard, type OgCard } from "../../src/og/card";
import { serveOgImage } from "../../src/og/serve";
import { createFakeCatalogApi, fakeCatalogState } from "../unit/fake-catalog";

const catalog = () => {
  const state = fakeCatalogState();
  return createFakeCatalogApi(state);
};

const FONTS = new URL("../../src/og/fonts", import.meta.url).pathname;

function pngDims(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("buildOgCard", () => {
  it("builds the site fallback card", async () => {
    expect(await buildOgCard("site", "default", catalog())).toEqual({
      eyebrow: "Flower seed directory",
      title: "Find where to buy any flower seed",
      subtitle: "Hard-to-find flower seed · stock as last seen · direct links",
      swatch: "#8E2A52",
      footer: "seeds.hues.flowers",
      mixWedges: null,
    });
  });

  it("builds the variety card from the fixture's real name and seller count", async () => {
    const card = await buildOgCard("variety", "sweet-pea-kings-ransom", catalog());
    expect(card).toEqual({
      eyebrow: "Sweet Pea · Lathyrus odoratus",
      title: "King's Ransom",
      subtitle: "2 sellers list it",
      swatch: "#E87A9E",
      footer: "seeds.hues.flowers",
      mixWedges: null,
    });
  });

  it("gives zero-seller varieties the zero-seller subtitle", async () => {
    const card = await buildOgCard("variety", "cosmos-lonely-bloom", catalog());
    expect(card?.title).toBe("Lonely Bloom");
    expect(card?.subtitle).toBe("No seller found selling Lonely Bloom yet.");
  });

  it("renders Mixed varieties as wedges (no conic gradient for Satori)", async () => {
    const api = catalog();
    const mixed = {
      ...api,
      getVarietyDetail: async (slug: string) => {
        const detail = await api.getVarietyDetail(slug);
        return detail ? { ...detail, colorFamily: "mix", colorSwatch: null } : null;
      },
    };
    const card = await buildOgCard("variety", "sweet-pea-kings-ransom", mixed);
    expect(card?.swatch).toContain("conic-gradient");
    expect(card?.mixWedges).toHaveLength(6);
  });

  it("builds the seller card from location, name, and variety count", async () => {
    expect(await buildOgCard("seller", "blue-ridge-seeds", catalog())).toEqual({
      eyebrow: "Portland, OR",
      title: "Blue Ridge Seeds",
      subtitle: "5 flower seed varieties listed",
      swatch: null,
      footer: "seeds.hues.flowers",
      mixWedges: null,
    });
  });

  it("builds the crop card from Latin, name, and counts", async () => {
    expect(await buildOgCard("crop", "sweet-pea", catalog())).toEqual({
      eyebrow: "Lathyrus odoratus",
      title: "Sweet Pea seeds",
      subtitle: "10 varieties · 8 with sellers",
      swatch: null,
      footer: "seeds.hues.flowers",
      mixWedges: null,
    });
  });

  it("returns no card for unknown kinds, malformed slugs, or missing records", async () => {
    const api = catalog();
    expect(await buildOgCard("nope", "x", api)).toBeNull();
    expect(await buildOgCard("variety", "BAD-SLUG", api)).toBeNull();
    expect(await buildOgCard("variety", "no-such-variety", api)).toBeNull();
    expect(await buildOgCard("seller", "no-such-seller", api)).toBeNull();
    expect(await buildOgCard("crop", "no-such-crop", api)).toBeNull();
  });
});

describe("OgCardImage", () => {
  it("draws the card text and the Mixed wedges as SVG paths", () => {
    const card: OgCard = {
      eyebrow: "Sweet Pea · Lathyrus odoratus",
      title: "King's Ransom",
      subtitle: "2 sellers list it",
      swatch: null,
      footer: "seeds.hues.flowers",
      mixWedges: ["#E87A9E", "#E8813A", "#EFC93F", "#7A9A4D", "#5B7FBF", "#8B6BAE"],
    };
    const html = renderToStaticMarkup(OgCardImage({ card }));
    expect(html).toContain("King&#x27;s Ransom");
    expect(html).toContain("seeds.hues.flowers");
    expect(html.match(/<path/g)).toHaveLength(6 + 5); // 6 wedges + 5 divider shapes
  });
});

describe("serveOgImage", () => {
  it("serves 1200×630 PNGs for every kind", async () => {
    for (const [kind, slug] of [
      ["variety", "sweet-pea-kings-ransom"],
      ["seller", "blue-ridge-seeds"],
      ["crop", "sweet-pea"],
      ["site", "default"],
    ] as const) {
      const res = await serveOgImage(kind, slug, { catalog: catalog(), fontDir: FONTS });
      expect(res.status, `${kind}/${slug}`).toBe(200);
      expect(res.headers["Content-Type"], `${kind}/${slug}`).toBe("image/png");
      expect(res.headers["Cache-Control"], `${kind}/${slug}`).toBe("public, max-age=86400, stale-while-revalidate=604800");
      expect(res.body, `${kind}/${slug}`).not.toBeNull();
      expect(pngDims(res.body!), `${kind}/${slug}`).toEqual({ width: 1200, height: 630 });
    }
  }, 60_000);

  it("404s malformed slugs and missing records (no card)", async () => {
    for (const [kind, slug] of [
      ["variety", "BAD-SLUG"],
      ["variety", "no-such-variety"],
      ["seller", "no-such-seller"],
      ["crop", "no-such-crop"],
      ["nope", "x"],
    ] as const) {
      const res = await serveOgImage(kind, slug, { catalog: catalog(), fontDir: FONTS });
      expect(res.status, `${kind}/${slug}`).toBe(404);
      expect(res.body, `${kind}/${slug}`).toBeNull();
    }
  });
});
