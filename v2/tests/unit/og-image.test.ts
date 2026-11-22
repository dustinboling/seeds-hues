/**
 * The OG card through Satori itself (Quinn gate F1 re-gate): a Mixed variety's card must
 * render to PNG bytes without throwing — Satori cannot parse the conic gradient, so the
 * card draws SVG wedges — and a flat non-Mixed card must render the same way it always has.
 * Model-string assertions alone shipped the 500; these tests consume the PNG response.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageResponse } from "next/og";
import type { CatalogService } from "@/lib/services/catalog";
import { OgCardImage } from "@/components/og/OgCardImage";
import { buildOgCard, type OgCard } from "@/lib/og-card";
import { MIX_WEDGE_HEXES } from "@/lib/color-chip";

type Variety = { plant: { commonName: string; latinName: string | null }; varietyName: string; listings: { seller: { slug: string } }[]; colorFamily: string; colorSwatch: string | null };

function catalogWith(varieties: Record<string, Variety>) {
  return {
    getVariety: async (slug: string) => varieties[slug] ?? null,
  } as unknown as Pick<CatalogService, "getVariety" | "getSeller" | "getCrop">;
}

const MIX: Variety = {
  plant: { commonName: "Stock", latinName: "Matthiola incana" },
  varietyName: "Katz Mix",
  listings: [{ seller: { slug: "floret" } }],
  colorFamily: "mix",
  colorSwatch: "#E8A0BF",
};

const PINK: Variety = {
  ...MIX,
  varietyName: "Test Pink",
  colorFamily: "pink",
  colorSwatch: "#FF69B4",
};

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

// The same two faces the route passes (Geist first, as Satori's default face).
const fonts = () => [
  {
    name: "geist",
    data: toArrayBuffer(readFileSync("node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "Fraunces",
    data: toArrayBuffer(readFileSync("app/fonts/fraunces-og.ttf")),
    weight: 700 as const,
    style: "normal" as const,
  },
];

const renderPng = async (card: OgCard): Promise<ArrayBuffer> => {
  const res = new ImageResponse(createElement(OgCardImage, { card }), { width: 1200, height: 630, fonts: fonts() });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("image/png");
  const bytes = await res.arrayBuffer();
  expect(bytes.byteLength).toBeGreaterThan(1000);
  return bytes;
};

describe("OG card through ImageResponse", () => {
  it("a Mixed variety's card renders to PNG bytes without throwing", async () => {
    const card = (await buildOgCard("variety", "stock-katz-mix", catalogWith({ "stock-katz-mix": MIX })))!;
    expect(card.mixWedges).toEqual([...MIX_WEDGE_HEXES]);
    const html = renderToStaticMarkup(createElement(OgCardImage, { card }));
    expect(html).not.toContain("conic-gradient");
    for (const hex of MIX_WEDGE_HEXES) expect(html).toContain(hex);
    await renderPng(card);
  });

  it("control: a flat non-Mixed card renders to PNG with its swatch, unchanged in kind", async () => {
    const card = (await buildOgCard("variety", "test-pink", catalogWith({ "test-pink": PINK })))!;
    expect(card.mixWedges).toBeNull();
    const html = renderToStaticMarkup(createElement(OgCardImage, { card }));
    expect(html).toContain("#FF69B4");
    expect(html).not.toContain("conic-gradient");
    await renderPng(card);
  });

  it("the Mixed and flat cards render distinct images", async () => {
    const mixed = (await buildOgCard("variety", "stock-katz-mix", catalogWith({ "stock-katz-mix": MIX })))!;
    const flat = (await buildOgCard("variety", "test-pink", catalogWith({ "test-pink": PINK })))!;
    const a = Buffer.from(await renderPng(mixed));
    const b = Buffer.from(await renderPng(flat));
    expect(a.equals(b)).toBe(false);
  });
});
