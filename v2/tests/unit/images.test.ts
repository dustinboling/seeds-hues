/**
 * lib/images (R2 + Image Transformations migration, 2026-11-18): stored path → R2 original key,
 * transformation URL shape (fit=scale-down only), SVG bypass, srcset, and input validation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_QUALITY, IMAGE_ORIGIN, imageSrcSet, imageUrl, originalKey } from "@/lib/images";
import { IMAGE_KEYS } from "@/lib/images-data";

const CDN = "https://images.seeds.hues.flowers";
const T = (opts: string, key: string) => `${CDN}/cdn-cgi/image/${opts}/${key}`;

describe("lib/images originalKey", () => {
  it("maps through the manifest when the extension differs (variety .webp → .png master)", () => {
    expect(originalKey("/artwork/amaranth-mira.webp")).toBe("artwork/amaranth-mira.png");
    expect(originalKey("/artwork/states/oregon.webp")).toBe("artwork/states/oregon.png");
    expect(originalKey("/theme/state-scenes/oregon.webp")).toBe("theme/state-scenes/oregon.png");
    expect(originalKey("/ornaments/motif-zinnia.webp")).toBe("ornaments/motif-zinnia.png");
  });

  it("maps a derived path onto its single original (hero 960 and 1600 share one file)", () => {
    expect(originalKey("/theme/hero-cutting-garden-960.webp")).toBe("theme/hero-cutting-garden-1600.webp");
    expect(originalKey("/theme/hero-cutting-garden-1600.webp")).toBe("theme/hero-cutting-garden-1600.webp");
  });

  it("maps same-extension originals (crops, shipped variety WebPs) to themselves", () => {
    expect(originalKey("/artwork/crops/zinnia.webp")).toBe("artwork/crops/zinnia.webp");
    expect(originalKey("/artwork/zinnia-queen-lime-blush.webp")).toBe("artwork/zinnia-queen-lime-blush.webp");
  });

  it("falls back to the path without its leading slash for unmapped paths", () => {
    expect(Object.hasOwn(IMAGE_KEYS, "/artwork/not-in-the-manifest.webp")).toBe(false);
    expect(originalKey("/artwork/not-in-the-manifest.webp")).toBe("artwork/not-in-the-manifest.webp");
  });

  it("never resolves inherited object keys as mappings", () => {
    expect(originalKey("/toString")).toBe("toString");
    expect(originalKey("/__proto__")).toBe("__proto__");
  });

  it("rejects anything that is not a root-relative stored path (no remote fetch through our zone)", () => {
    for (const bad of [
      "https://example.com/a.webp",
      "//example.com/a.webp",
      "artwork/a.webp",
      "/artwork/../secret.webp",
      "/artwork/./a.webp",
      "/artwork//a.webp",
      "/artwork/a.webp?x=1",
      "/artwork/a.webp#x",
      "/artwork/a b.webp",
      "/",
      "",
    ]) {
      expect(() => originalKey(bad), bad).toThrow(TypeError);
    }
  });
});

describe("lib/images imageUrl", () => {
  it("builds the exact transformation URL (width, default quality 80, format=auto, fit=scale-down)", () => {
    expect(IMAGE_ORIGIN).toBe(CDN);
    expect(DEFAULT_IMAGE_QUALITY).toBe(80);
    expect(imageUrl("/artwork/amaranth-mira.webp", { width: 480 })).toBe(
      T("width=480,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira.png"),
    );
    expect(imageUrl("/theme/hero-cutting-garden-960.webp", { width: 960 })).toBe(
      T("width=960,quality=80,format=auto,fit=scale-down", "theme/hero-cutting-garden-1600.webp"),
    );
  });

  it("honours an explicit quality", () => {
    expect(imageUrl("/artwork/crops/zinnia.webp", { width: 1120, quality: 65 })).toBe(
      T("width=1120,quality=65,format=auto,fit=scale-down", "artwork/crops/zinnia.webp"),
    );
  });

  it("only ever uses fit=scale-down (never cover / crop / pad)", () => {
    const urls = Object.keys(IMAGE_KEYS)
      .filter((p) => !p.endsWith(".svg"))
      .flatMap((p) => [480, 768, 1120, 1600].map((width) => imageUrl(p, { width })));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).toMatch(/^https:\/\/images\.seeds\.hues\.flowers\/cdn-cgi\/image\/width=\d+,quality=\d+,format=auto,fit=scale-down\/[a-z0-9/._-]+$/);
      expect(u).not.toMatch(/fit=(?:cover|crop|pad|contain)|gravity=|trim=/);
    }
  });

  it("serves SVGs as stored, without a transformation", () => {
    expect(imageUrl("/theme/divider-stem.svg", { width: 480 })).toBe(`${CDN}/theme/divider-stem.svg`);
    expect(imageUrl("/theme/unmapped.svg", { width: 480 })).toBe(`${CDN}/theme/unmapped.svg`);
  });

  it("rejects out-of-range widths and qualities", () => {
    for (const width of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 4097]) {
      expect(() => imageUrl("/artwork/amaranth-mira.webp", { width }), String(width)).toThrow(RangeError);
    }
    for (const quality of [0, 101, 50.5]) {
      expect(() => imageUrl("/artwork/amaranth-mira.webp", { width: 480, quality }), String(quality)).toThrow(RangeError);
    }
  });
});

describe("lib/images imageSrcSet", () => {
  it("lists one transformation of the same original per width", () => {
    expect(imageSrcSet("/artwork/amaranth-mira.webp", [480, 768])).toBe(
      `${T("width=480,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira.png")} 480w, ` +
        `${T("width=768,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira.png")} 768w`,
    );
  });

  it("parses as a valid srcset: each candidate is one whitespace-free URL plus a width descriptor", () => {
    const candidates = imageSrcSet("/artwork/crops/zinnia.webp", [768, 1120]).split(/,\s+/);
    expect(candidates).toHaveLength(2);
    for (const c of candidates) expect(c).toMatch(/^\S+ \d+w$/);
  });

  it("an SVG yields its single plain URL; an empty width list is an error", () => {
    expect(imageSrcSet("/theme/divider-stem.svg", [480, 768])).toBe(`${CDN}/theme/divider-stem.svg`);
    expect(() => imageSrcSet("/artwork/amaranth-mira.webp", [])).toThrow(RangeError);
  });
});

describe("lib/images-data (generated)", () => {
  it("matches the migration manifest's shape: 802 entries, valid paths and keys", () => {
    const entries = Object.entries(IMAGE_KEYS);
    // 759 at the 2026-11-18 migration; +1 for divider motif B (2026-11-19);
    // +10 for the crop-painting redraw Batch 1 + Snapdragon/Silene v2 (2026-11-19);
    // +8 for the crop-painting redraw Batch 2: figwort, flax, formosa-lily, foxglove,
    // gomphrena, hollyhock, honeywort, iceland-poppy v2 (2026-11-19);
    // +8 for the crop-painting redraw Batch 3: kiss-me-over-the-garden-gate, larkspur,
    // love-in-a-puff, lupine, malope, milkweed, mullein, nigella v2 (2026-11-19);
    // +8 for the crop-painting redraw Batch 4: orach, ornamental-grass, ornamental-squash,
    // painted-tongue, pansy, paper-daisy, pea, perennial-babys-breath v2 (2026-11-19);
    // +8 for the crop-painting redraw Batch 5: phlox, poor-mans-orchid, queen-annes-lace,
    // salvia, stock, strawflower, sweet-rocket, tickseed v2 (2026-11-19).
    expect(entries).toHaveLength(802);
    expect(IMAGE_KEYS["/ornaments/motif-divider-b.webp"]).toBe("ornaments/motif-divider-b.webp");
    for (const [path, key] of entries) {
      expect(path).toMatch(/^\/(?:artwork|theme|ornaments)\/[a-z0-9/._-]+\.(?:webp|svg)$/);
      expect(key).toMatch(/^(?:artwork|theme|ornaments)\/[a-z0-9/._-]+\.(?:webp|png|svg)$/);
    }
    // Derived variants were never uploaded; they are transformations now.
    expect(entries.filter(([p]) => /\/(?:w480|w768|thumbs)\//.test(p))).toEqual([]);
  });

  it("is the generator's output (header present, read only through lib/images)", () => {
    const src = readFileSync(join(process.cwd(), "lib/images-data.ts"), "utf8");
    expect(src).toMatch(/GENERATED by scripts\/gen-images-data\.ts/);
  });
});
