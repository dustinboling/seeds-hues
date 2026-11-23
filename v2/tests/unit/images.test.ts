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
    expect(originalKey("/artwork/amaranth-mira.webp")).toBe("artwork/amaranth-mira-v2.png");
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
      T("width=480,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira-v2.png"),
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
      `${T("width=480,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira-v2.png")} 480w, ` +
        `${T("width=768,quality=80,format=auto,fit=scale-down", "artwork/amaranth-mira-v2.png")} 768w`,
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
  it("matches the migration manifest's shape: 1023 entries, valid paths and keys", () => {
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
    // salvia, stock, strawflower, sweet-rocket, tickseed v2 (2026-11-19);
    // +6 for the crop-painting redraw Batch 6 (FINAL): trachelium, viola, virginia-stock,
    // wallflower, xeranthemum, zinnia v2 (2026-11-19);
    // +2 for the elevation spot paintings: farm-gate (Add Your Farm) and
    // account-organizer (account page) theme art (2026-11-19);
    // +9 for the new-variety plates batch 1: Snapdragon Potomac Dark Pink / Lavender /
    // White / Yellow / Red and Statice QIS Dark Blue / Lavender / White / Yellow
    // (2026-11-19, Quinn PASS WITH NOTES).
    // +5 for the composition repaint Batch 7 (the audit-defect crop-plate repaints):
    // bupleurum, dahlia, gomphrena v3 and honeywort, silene v4
    // (2026-11-19, Quinn PASS + fix-pass re-gate PASS).
    // +9 for the new-variety plates batch 2: Ageratum Tall Blue Planet / Timeless Mix,
    // Anise Hyssop Alabaster / Anise Hyssop / Golden Jubilee, and Balloon Flower
    // Astra Blue / Light Pink / Mix / Pink
    // (2026-11-21, Quinn re-gate PASS WITH NOTES — D1 closed on the v2 repaint).
    // Motif B was retired 2026-11-21, but its manifest entry stays until the separate
    // asset-retirement operation, so the count is unchanged.
    // +9 for Tranche 4 batch 1: Snapdragon Maryland Appleblossom / Bright Yellow /
    // Dark Orange / Flamingo / Ivory White / Lavender / Mix / Orange and Swamp
    // Milkweed White (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 batch 2: Swamp Milkweed, Snapdragon Orange Wonder,
    // Verbena Vanity, Echinacea PowWow Wild Berry / White Swan / PowWow White,
    // Eryngium Blue Glitter, Lavender Ellagance Purple, Snapdragon Rocket Mix
    // (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 batch 3: Sweet Pea Mammoth Mix, Chinese Lantern,
    // Echinacea purpurea, Showy Goldenrod, Gomphrena Audray Pink, Safflower
    // Zanzibar, Snapdragon Black Prince / Rembrandt, Sweet Pea King's Ransom
    // (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 batch 4: Cleome Queen Mix / White Queen, Coleus
    // Chocolate Covered Cherry / Wizard Rose / Wizard Velvet Red, Columbine
    // McKana Giants Mix, Craspedia Drumstick, Delphinium Bellamosum /
    // Guardian Lavender (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 batch 5: Delphinium Guardian White / Magic Fountains
    // Mix / Magic Fountains Sky Blue White Bee, Echinacea Cheyenne Spirit /
    // Paradiso Tall Mix, Eryngium White Glitter, Globe Thistle, Hollyhock
    // Chater's Double Mix, Mullein Southern Charm (2026-11-22, Quinn PASS
    // WITH NOTES after confirmation check).
    // +9 for Tranche 4 batch 6: Mullein Wedding Candles, Perennial Baby's
    // Breath, Sweet Pea Juliet / Shell Pink, Verbena bonariensis, Stock
    // Katz Mix, Cleome Mauve Queen / Cherry Queen, Shirley Poppy Angel's
    // Choir (2026-11-22, Quinn PASS WITH NOTES).
    // +1 for Item MOTIF: the C3 Vine & Pods homepage divider original
    // (theme/divider-home.webp, identity key) — the PR #48 build gate's R2
    // deploy condition (2026-11-22, Quinn build re-gate PASS on PR #48).
    // +9 for Tranche 4 Batch 8: Cleome Rose Queen / Violet Queen, Coleus
    // Kong Red / Kong Rose / Wizard Scarlet, Columbine Barlow Mix, Cosmos
    // Diablo, Craspedia Sun Ball, Delphinium Casablanca (2026-11-22,
    // Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 9: Delphinium Cliveden Beauty / Magic
    // Fountains Lilac Pink White Bee / Magic Fountains Pure White,
    // Echinacea Feeling Pink / Mellow Yellows / Paradiso Super Duper,
    // Eryngium Blaukappe / Blue Hobbit, Flowering Kale Crane Pink
    // (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 10: Flowering Kale Crane Red / Crane Rose /
    // Crane White, Goldenrod Canada Goldenrod, Hollyhock Chater's Double
    // Salmon / Chater's Double White, Honesty, Lisianthus Rosanne 2 Clear
    // Green / Voyage 2 Blue (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 11: Lisianthus Voyage 2 First Love /
    // Voyage 2 Lavender, Milkweed Pleurisy Root / Soulmate, Mullein
    // Violetta, Nigella Miss Jekyll Double Mix, Paper Daisy Pierrot
    // White, Perennial Baby's Breath Snowflake, Sunflower Better Off
    // Red (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 12: Sweet Pea Spring Sunshine Burgundy,
    // Trachelium Lake Michigan Blue / Purple / Violet / White,
    // Virginia Stock, Zinnia Gift Zinnia, Breadseed Poppy, Calendula
    // Pacific Beauty Formula Mix (2026-11-22, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 13: Balloon Flower Astra White, Coleus
    // Wizard Golden, Cornflower Frosty Mix, Dahlia Collarette,
    // Delphinium Belladonna Mix / Blue Donna / Candle Lavender Shades,
    // Echinacea Paradiso Yellow / Primadonna Deep Rose (2026-11-22,
    // Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 14: False Indigo Blue Wild Indigo, False
    // Sunflower Summer Sun, Flowering Kale Crane Early Red / Crane
    // Early White, Goldenrod Golden Baby, Hollyhock Chater's Double
    // Red / Chater's Double Yellow, Lavender Ellagance White /
    // Munstead-Type (2026-11-23, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 15: Lavender Munstead-Type Organic,
    // Lisianthus Arena III Red / Mariachi Pure White / Solo White /
    // Viviana Pink / Voyage 2 Green II / Voyage 2 Pink Improved /
    // Voyage 2 White Improved / Voyage 2 Yellow II (2026-11-23,
    // Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 16: Milkweed Milkmaid / Oscar, Ranunculus
    // Maché Mix / Magic Mix / Sprinkles Mix, Rudbeckia Tall Dark
    // Sahara, Snapdragon Chantilly Bronze White Throat / Cream Yellow
    // / Deep Orange (2026-11-23, Quinn gate FAIL on the three
    // Chantillys' closed-mouth form → Elena repaint → scoped re-gate
    // PASS WITH NOTES).
    // +9 for Tranche 4 Batch 17: Snapdragon Chantilly Pink / Purple /
    // Velvet / White / Yellow, Defiant Mix, Potomac Cherry Rose /
    // Crimson / Dark Orange (2026-11-23, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 18: Snapdragon Potomac Ivory White / Mix
    // / Pink / Royal, Toulon Mix, Spike Speedwell Sightseeing, Statice
    // QIS Mix / QIS Rose, Strawflower Firefly (2026-11-23, Quinn PASS
    // WITH NOTES).
    // +9 for Tranche 4 Batch 19: Sunflower Mixed Sunflowers / Van
    // Gogh's Fantasy, Sweet Pea Alison / Clementine Kiss / Emma /
    // Gerry Cullinan / Susan Burgess / Winter Elegance Mix, Verbena
    // Finesse (2026-11-23, Quinn PASS WITH NOTES).
    // +9 for Tranche 4 Batch 20: Zinnia Karen's Fave Color Mix,
    // Dahlia AA (Giant-Flowered), Balloon Flower Astra Semi-Double
    // Blue / Pink / White, Celosia Pink Lemonade, Columbine
    // Songbird Bluebird / Cardinal / Mixture (2026-11-23, Quinn
    // PASS WITH NOTES).
    // +9 for Tranche 4 Batch 21: Columbine Songbird Nightingale /
    // Robin, Dahlia Coseytown Honey Pot Mix / Miss Amara / Mixed
    // Parent / Dahlia Seed Mix / Premium Pollinator Mix, Echinacea
    // Primadonna White, False Sunflower Bleeding Hearts
    // (2026-11-23, Quinn PASS WITH NOTES).
    // +8 for Tranche 4 Batch 22 (plates 2–9 of 9): Globe Thistle
    // Veitch's Blue, Hollyhock Chater's Double Pink, Honesty Alba
    // Variegata / Albiflora / Chedglow, Iceland Poppy Champagne
    // Bubbles Formula Mix (F1), Larkspur Imperial Choice Mix,
    // Masterwort Great Masterwort (2026-11-23, Quinn PASS for
    // plates 2–9; plate 1 False Sunflower 'False Sunflower' held
    // at a scoped FAIL fix — F-1 stem seam — and ships separately
    // after Quinn's confirmation).
    // +1 for Tranche 4 Batch 22 part 2: False Sunflower 'False
    // Sunflower' plate 1 (2026-11-23, Quinn confirmation re-gate
    // CONFIRMED — F-1 closed; stem continuous through the 60–85%
    // band, one clean declared end at ≈96% down-frame).
    expect(entries).toHaveLength(1023);
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
