/**
 * The stub's read-time derivation, guarded: rederiving an unmutated fixture
 * reproduces its carried answer, template description, and counts exactly,
 * and the answers equal the hardcoded live-builder outputs (so the HTTP
 * suite's hardcoded expectations pin the stub AND the app independently).
 */
import { describe, expect, it } from "vitest";
import { fakeCatalogState } from "../unit/fake-catalog";
import { rederive, stubAnswer } from "./derived";

const ANSWERS: Record<string, string> = {
  "sweet-pea-kings-ransom": "As of Nov 20, 2026, 2 sellers list King's Ransom: Blue Ridge Seeds and Prairie Seed House.",
  "cosmos-lonely-bloom": "No seller found selling Lonely Bloom yet.",
  "cosmos-candy-stripe": "As of Nov 15, 2026, 1 seller lists Candy Stripe: Prairie Seed House.",
  "cosmos-mystery-bloom": "As of Nov 19, 2026, 1 seller lists Mystery Bloom: Prairie Seed House.",
};

describe("stub read-time derivation", () => {
  it("reproduces every fixture's carried derived fields", () => {
    for (const detail of Object.values(fakeCatalogState().details)) {
      const derived = rederive(detail);
      expect(derived.answer, detail.slug).toBe(detail.answer);
      expect(derived.templateDescription, detail.slug).toBe(detail.templateDescription);
      expect(derived.listingCount, detail.slug).toBe(detail.listingCount);
      expect(derived.sellerCount, detail.slug).toBe(detail.sellerCount);
      expect(derived.inStockCount, detail.slug).toBe(detail.inStockCount);
      expect(derived.lastCheckedAt, detail.slug).toBe(detail.lastCheckedAt);
    }
  });

  it("computes the hardcoded live answers", () => {
    for (const detail of Object.values(fakeCatalogState().details)) {
      expect(stubAnswer(detail.varietyName, detail.listings), detail.slug).toBe(ANSWERS[detail.slug]);
    }
  });

  it("recomputes after a catalog write (the invalidation proof's fresh read)", () => {
    const state = fakeCatalogState();
    const detail = state.details["sweet-pea-kings-ransom"]!;
    detail.listings[0]!.availability = "sold_out";
    detail.listings[0]!.lastCheckedAt = "2026-11-21T09:00:00.000Z";
    const derived = rederive(detail);
    expect(derived.answer).toBe(
      "As of Nov 21, 2026, 2 sellers list King's Ransom: Blue Ridge Seeds and Prairie Seed House.",
    );
    expect(derived.inStockCount).toBe(0);
    expect(derived.sellerCount).toBe(2);
    expect(derived.templateDescription).toBe(detail.templateDescription);
  });
});
