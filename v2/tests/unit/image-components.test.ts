/**
 * Image-CDN migration (2026-11-18): every rendered illustration is a scale-down transformation of
 * its R2 original on images.seeds.hues.flowers, computed from the stored path at render time.
 * Pins the exact markup of the media components and the OG image for the new contract.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CropCardImage } from "@/components/crop/CropCardImage";
import { ThemeArt } from "@/components/ui/ThemeArt";
import { VarietyCardImage } from "@/components/variety/VarietyCardImage";
import { VarietyHeroImage } from "@/components/variety/VarietyHeroImage";
import { mediaOgImage, pageMetadata } from "@/lib/seo/metadata";
import type { Media } from "@/lib/validators";

const T = (width: number, key: string) =>
  `https://images.seeds.hues.flowers/cdn-cgi/image/width=${width},quality=80,format=auto,fit=scale-down/${key}`;
const media = (url: string): Media => ({ url, licence: "Own work", credit: "Illustration by Hues Floral Park" });
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const img = (h: string) => /<img\b[^>]*>/.exec(h)?.[0] ?? "";

describe("variety card image", () => {
  it("variety artwork: 480 transformation src + 480w/768w srcset of the mapped .png original", () => {
    const tag = img(renderToStaticMarkup(createElement(VarietyCardImage, { media: [media("/artwork/amaranth-mira.webp")], varietyName: "Mira" })));
    expect(attr(tag, "src")).toBe(T(480, "artwork/amaranth-mira-v2.png"));
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBe(`${T(480, "artwork/amaranth-mira-v2.png")} 480w, ${T(768, "artwork/amaranth-mira-v2.png")} 768w`);
    expect(attr(tag, "width")).toBe("480");
    expect(attr(tag, "height")).toBe("960");
    expect(attr(tag, "alt")).toBe("Mira — illustration");
    expect(tag).not.toMatch(/\/artwork\/w(?:480|768)\//);
  });

  it("crop media on a card: the 480 transformation as src (no longer the full file), no srcset", () => {
    const tag = img(renderToStaticMarkup(createElement(VarietyCardImage, { media: [media("/artwork/crops/zinnia.webp")], varietyName: "Zinnia" })));
    expect(attr(tag, "src")).toBe(T(480, "artwork/crops/zinnia.webp"));
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBeNull();
  });
});

describe("hero image", () => {
  it("variety hero: 1120 src, 768w/1120w srcset, 1120×2240, eager + high priority, whole 1:2 frame", () => {
    const tag = img(renderToStaticMarkup(createElement(VarietyHeroImage, { media: media("/artwork/amaranth-mira.webp"), label: "Mira Amaranth" })));
    expect(attr(tag, "src")).toBe(T(1120, "artwork/amaranth-mira-v2.png"));
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBe(`${T(768, "artwork/amaranth-mira-v2.png")} 768w, ${T(1120, "artwork/amaranth-mira-v2.png")} 1120w`);
    expect(attr(tag, "width")).toBe("1120");
    expect(attr(tag, "height")).toBe("2240");
    expect(attr(tag, "loading")).toBe("eager");
    expect(attr(tag, "fetchPriority") ?? attr(tag, "fetchpriority")).toBe("high");
    expect(attr(tag, "class")).toMatch(/\baspect-\[1\/2\]/);
    expect(attr(tag, "class")).toMatch(/\bobject-contain\b/);
    expect(attr(tag, "class")).not.toMatch(/object-cover/);
  });

  it("crop hero gains the same responsive variant", () => {
    const h = renderToStaticMarkup(createElement(VarietyHeroImage, { media: media("/artwork/crops/zinnia.webp"), label: "Zinnia", testId: "crop-hero" }));
    expect(h).toContain('data-testid="crop-hero"');
    const tag = img(h);
    expect(attr(tag, "src")).toBe(T(1120, "artwork/crops/zinnia.webp"));
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBe(`${T(768, "artwork/crops/zinnia.webp")} 768w, ${T(1120, "artwork/crops/zinnia.webp")} 1120w`);
    expect(attr(tag, "sizes")).toBe("(max-width: 480px) 92vw, 380px");
  });
});

describe("crop card image", () => {
  it("480 transformation of the stored url; thumbUrl is ignored", () => {
    const m = { ...media("/artwork/crops/zinnia.webp"), thumbUrl: "/artwork/crops/thumbs/zinnia.webp" };
    const tag = img(renderToStaticMarkup(createElement(CropCardImage, { media: [m], commonName: "Zinnia" })));
    expect(attr(tag, "src")).toBe(T(480, "artwork/crops/zinnia.webp"));
    expect(tag).not.toContain("thumbs");
  });

  it("renders nothing without media", () => {
    expect(renderToStaticMarkup(createElement(CropCardImage, { media: [], commonName: "Yarrow" }))).toBe("");
  });
});

describe("theme art", () => {
  it("home hero: 960 src and 1600 wide source, both from the single 1600 original; no fixed type", () => {
    const h = renderToStaticMarkup(createElement(ThemeArt, { name: "hero", priority: true }));
    const source = /<source\b[^>]*>/.exec(h)?.[0] ?? "";
    expect(attr(source, "srcSet") ?? attr(source, "srcset")).toBe(T(1600, "theme/hero-cutting-garden-1600.webp"));
    expect(attr(source, "media")).toBe("(min-width: 641px)");
    expect(source).not.toMatch(/\btype=/);
    const tag = img(h);
    expect(attr(tag, "src")).toBe(T(960, "theme/hero-cutting-garden-1600.webp"));
    expect(attr(tag, "width")).toBe("960");
    expect(attr(tag, "alt")).toBe("");
  });

  it("other placements: one transformation at the table width", () => {
    const h = renderToStaticMarkup(createElement(ThemeArt, { name: "empty-search" }));
    expect(h).not.toContain("<source");
    expect(attr(img(h), "src")).toBe(T(880, "theme/empty-search.webp"));
  });
});

describe("OG image for media", () => {
  it("is the 1120 transformation on the image CDN, 1120×2240, with no fixed MIME type", () => {
    const og = mediaOgImage("/artwork/amaranth-mira.webp", "Mira Amaranth");
    expect(og).toEqual({ url: T(1120, "artwork/amaranth-mira-v2.png"), width: 1120, height: 2240, alt: "Mira Amaranth" });
    const md = pageMetadata({ title: "t", description: "d", path: "/variety/amaranth-mira", og });
    expect(md.openGraph?.images).toEqual([og]);
    expect(md.twitter?.images).toEqual([og.url]);
  });
});
