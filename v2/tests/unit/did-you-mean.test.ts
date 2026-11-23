/**
 * Tranche 3.4 §5.3.4 — did-you-mean (lib/names.ts): Damerau-Levenshtein distance (a
 * transposition counts as 1) and the candidate pick (closest name sharing the query's first
 * letter, distance ≤ 2; ties to the name with sellers, then alphabetical; at most one).
 *
 * Non-vacuity: fails on pre-build code — neither function exists there.
 */
import { describe, expect, it } from "vitest";
import { damerauLevenshtein, pickDidYouMean, type DidYouMeanCandidate } from "@/lib/names";

describe("damerauLevenshtein (a transposition counts as 1)", () => {
  it("counts inserts, deletes and substitutions", () => {
    expect(damerauLevenshtein("", "")).toBe(0);
    expect(damerauLevenshtein("abc", "")).toBe(3);
    expect(damerauLevenshtein("", "ab")).toBe(2);
    expect(damerauLevenshtein("kitten", "sitting")).toBe(3);
    expect(damerauLevenshtein("zinnia", "zinnia")).toBe(0);
  });

  it("counts one adjacent transposition as a single edit", () => {
    expect(damerauLevenshtein("alsion", "alison")).toBe(1);
    expect(damerauLevenshtein("ab", "ba")).toBe(1);
    // Unrestricted (transpose "ca"→"ac", insert "b"): 2, where OSA counts 3.
    expect(damerauLevenshtein("ca", "abc")).toBe(2);
  });
});

describe("pickDidYouMean (the whole §5.3.4 rule)", () => {
  const c = (name: string, hasSellers = false): DidYouMeanCandidate => ({ name, hasSellers });

  it("alsion → Alison (one transposition); zzqqx → no suggestion", () => {
    const corpus = [c("Alison", true), c("Alison Valentini"), c("Sweet Pea", true), c("Zinnia", true)];
    expect(pickDidYouMean("alsion", corpus)).toBe("Alison");
    expect(pickDidYouMean("Alternanthera", corpus)).toBe(null);
    expect(pickDidYouMean("zzqqx", corpus)).toBe(null);
    expect(pickDidYouMean("", corpus)).toBe(null);
  });

  it("only names sharing the query's first letter qualify", () => {
    // "Alison" is one delete from "kalison" but starts with A — excluded.
    expect(pickDidYouMean("kalison", [c("Alison", true)])).toBe(null);
    expect(pickDidYouMean("kalisno", [c("Alison", true), c("Kalison")])).toBe("Kalison");
  });

  it("distance 3+ never suggests; an exact match is not a correction", () => {
    const corpus = [c("Alison", true)];
    expect(pickDidYouMean("alxxxxxx", corpus)).toBe(null);
    expect(pickDidYouMean("Alison", corpus)).toBe(null);
    expect(pickDidYouMean("alison", corpus)).toBe(null);
  });

  it("ties break to the name with sellers, then alphabetical", () => {
    // Both one substitution from "abx": sellers wins regardless of corpus order.
    expect(pickDidYouMean("abx", [c("aby"), c("abz", true)])).toBe("abz");
    expect(pickDidYouMean("abx", [c("abz", true), c("aby")])).toBe("abz");
    // Neither has sellers: alphabetical.
    expect(pickDidYouMean("abx", [c("abz"), c("aby")])).toBe("aby");
    // Closer always beats sellers: distance 1 without sellers tops distance 2 with.
    expect(pickDidYouMean("abx", [c("aby"), c("axc", true)])).toBe("aby");
  });

  it("comparison is case- and accent-insensitive", () => {
    expect(pickDidYouMean("ALSION", [c("Alison")])).toBe("Alison");
    expect(pickDidYouMean("cafe", [c("Café")])).toBe(null); // exact after folding: not a correction
    expect(pickDidYouMean("caffe", [c("Café")])).toBe("Café");
  });
});
