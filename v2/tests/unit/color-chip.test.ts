/**
 * The shared color chip (Tranche 1.8, Parts 2 + 3): the Mixed gradient definition, the
 * CIEDE2000 distance against the published Sharma reference pairs, nearest-family
 * agreement, and the resolver's policy order — pure unit tests, no database.
 */
import { describe, expect, it } from "vitest";
import { COLOR_FAMILY_SWATCHES, type ColorFamily } from "@/lib/validators";
import { chipBackground, deltaE2000, hexToLab, MIX_GRADIENT, nearestColorFamily, resolveColorChip, type Lab } from "@/lib/color-chip";

const lab = (l: number, a: number, b: number): Lab => ({ l, a, b });

describe("MIX_GRADIENT", () => {
  it("is the conic gradient through pink, orange, yellow, green, blue, purple, closed to pink", () => {
    expect(MIX_GRADIENT).toBe("conic-gradient(#E87A9E, #E8813A, #EFC93F, #7A9A4D, #5B7FBF, #8B6BAE, #E87A9E)");
  });

  it("is built from the family representatives, so a representative edit moves it", () => {
    const stops = ["pink", "orange", "yellow", "green", "blue", "purple", "pink"].map((f) => COLOR_FAMILY_SWATCHES[f as ColorFamily]);
    expect(MIX_GRADIENT).toBe(`conic-gradient(${stops.join(", ")})`);
  });
});

describe("deltaE2000", () => {
  it("matches the published Sharma reference pairs to four decimals", () => {
    const pairs: [Lab, Lab, number][] = [
      [lab(50.0, 2.6772, -79.7751), lab(50.0, 0.0, -82.7485), 2.0425],
      [lab(50.0, 3.1571, -77.2803), lab(50.0, 0.0, -82.7485), 2.8615],
      [lab(50.0, 2.8361, -74.02), lab(50.0, 0.0, -82.7485), 3.4412],
      [lab(50.0, -1.3802, -84.2814), lab(50.0, 0.0, -82.7485), 1.0],
      [lab(50.0, 0.0, 0.0), lab(50.0, -1.0, 2.0), 2.3669],
      [lab(50.0, -1.0, 2.0), lab(50.0, 0.0, 0.0), 2.3669],
      [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0009), 7.1792],
      [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.001), 7.1792],
      [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0011), 7.2195],
    ];
    for (const [c1, c2, expected] of pairs) {
      expect(deltaE2000(c1, c2)).toBeCloseTo(expected, 4);
    }
  });

  it("is zero for identical colors and symmetric on real swatches", () => {
    const hotPink = hexToLab("#FF69B4");
    const white = hexToLab("#F7F3E8");
    expect(deltaE2000(hotPink, hotPink)).toBe(0);
    expect(deltaE2000(hotPink, white)).toBeCloseTo(deltaE2000(white, hotPink), 10);
    expect(deltaE2000(hotPink, white)).toBeGreaterThan(0);
  });
});

describe("nearestColorFamily", () => {
  it("every representative measures nearest to its own family", () => {
    for (const [family, hex] of Object.entries(COLOR_FAMILY_SWATCHES)) {
      if (hex === null) continue;
      expect(nearestColorFamily(hex), family).toBe(family);
    }
  });

  it("hot pink measures nearest to pink, medium purple to purple", () => {
    expect(nearestColorFamily("#FF69B4")).toBe("pink");
    expect(nearestColorFamily("#9370DB")).toBe("purple");
  });

  it("a near-representative hex stays with its family (no distance cap)", () => {
    expect(nearestColorFamily("#8B6BAF")).toBe("purple");
    expect(nearestColorFamily("#C03435")).toBe("red");
  });
});

describe("resolveColorChip policy order", () => {
  it("mix renders the gradient whatever the sourced hex (mix wins over the nearest-family test)", () => {
    expect(resolveColorChip({ colorFamily: "mix", colorSwatch: "#E8A0BF" })).toEqual({ kind: "gradient" });
    // #FFD700 measures nearest to yellow — still the gradient on a mix.
    expect(nearestColorFamily("#FFD700")).toBe("yellow");
    expect(resolveColorChip({ colorFamily: "mix", colorSwatch: "#FFD700" })).toEqual({ kind: "gradient" });
    expect(resolveColorChip({ colorFamily: "mix", colorSwatch: null })).toEqual({ kind: "gradient" });
  });

  it("unknown renders no chip even with a sourced swatch", () => {
    expect(resolveColorChip({ colorFamily: "unknown", colorSwatch: "#9370DB" })).toEqual({ kind: "none" });
    expect(resolveColorChip({ colorFamily: "unknown", colorSwatch: null })).toEqual({ kind: "none" });
    expect(resolveColorChip({ colorFamily: null, colorSwatch: "#9370DB" })).toEqual({ kind: "none" });
  });

  it("a swatch contradicting its family is suppressed to the filed representative", () => {
    // Angels Choir as filed at audit time: white family, hot pink swatch.
    expect(resolveColorChip({ colorFamily: "white", colorSwatch: "#FF69B4" })).toEqual({ kind: "hex", hex: "#F7F3E8" });
  });

  it("a swatch agreeing with its family renders as-is", () => {
    expect(resolveColorChip({ colorFamily: "pink", colorSwatch: "#FF69B4" })).toEqual({ kind: "hex", hex: "#FF69B4" });
    expect(resolveColorChip({ colorFamily: "purple", colorSwatch: "#8B6BAF" })).toEqual({ kind: "hex", hex: "#8B6BAF" });
  });

  it("a filed family without a swatch renders its representative", () => {
    expect(resolveColorChip({ colorFamily: "orange", colorSwatch: null })).toEqual({ kind: "hex", hex: "#E8813A" });
  });

  it("a family outside the vocabulary cannot be judged: swatch as-is, absence as nothing", () => {
    expect(resolveColorChip({ colorFamily: "taupe", colorSwatch: "#FF69B4" })).toEqual({ kind: "hex", hex: "#FF69B4" });
    expect(resolveColorChip({ colorFamily: "taupe", colorSwatch: null })).toEqual({ kind: "none" });
  });

  it("suppression never alters the stored values (rendering rule only)", () => {
    const input = { colorFamily: "white", colorSwatch: "#FF69B4" };
    resolveColorChip(input);
    expect(input).toEqual({ colorFamily: "white", colorSwatch: "#FF69B4" });
  });
});

describe("chipBackground", () => {
  it("maps gradient to the shared gradient, hex through, none to null", () => {
    expect(chipBackground({ kind: "gradient" })).toBe(MIX_GRADIENT);
    expect(chipBackground({ kind: "hex", hex: "#FF69B4" })).toBe("#FF69B4");
    expect(chipBackground({ kind: "none" })).toBeNull();
  });
});
