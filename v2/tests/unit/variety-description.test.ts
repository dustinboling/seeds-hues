import { describe, expect, it } from "vitest";
import { varietyDescription } from "@/lib/seo/metadata";
import { answerSentence } from "@/lib/services/catalog";
import type { PublicListing, VarietyDetail } from "@/lib/validators";

/**
 * Item ANS completion (Dustin's ruling, 2026-11-23): the seller roster is out of variety
 * metadata. varietyDescription composes Wren's Templates A/B/C and never reads v.answer.
 * Every fixture below still CARRIES a real roster in `answer` (built by answerSentence, the
 * production builder) — the census asserts none of it leaks into the output.
 */

let nextId = 1;

function listing(sellerSlug: string, sellerName: string, seedCounts: (number | null)[] = [10]): PublicListing {
  const id = nextId++;
  const checked = "2026-11-15";
  return {
    id,
    variety: {
      slug: "test-variety",
      varietyName: "Test",
      plant: {
        slug: "p",
        commonName: "Basil",
        latinName: "Ocimum basilicum",
        lifeCycle: null,
        season_class: null,
        season_source_label: null,
        sowing_methods: [],
        sowing_method_source_label: null,
      },
      colorSwatch: null,
      colorFamily: "unknown",
      media: [],
      cropMedia: [],
    },
    seller: { slug: sellerSlug, name: sellerName, location: null, region: "WA", country: "US", isSmallFarm: false },
    availability: "in_stock",
    lastCheckedAt: checked,
    firstSeenAt: checked,
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: seedCounts.map((seedCount, i) => ({ label: `Packet ${i + 1}`, seedCount })),
    provenance: { source_url: null, retrieved_at: checked, method: "human", confidence: 1 },
    sourceLabel: "Shop check",
  };
}

function variety(opts: {
  varietyName?: string;
  commonName?: string;
  latinName?: string | null;
  description?: string | null;
  listings?: PublicListing[];
}): VarietyDetail {
  const varietyName = opts.varietyName ?? "Cinnamon Basil";
  const listings = opts.listings ?? [];
  return {
    slug: "test-variety",
    varietyName,
    plant: {
      slug: "p",
      commonName: opts.commonName ?? "Basil",
      latinName: opts.latinName === undefined ? "Ocimum basilicum" : opts.latinName,
      lifeCycle: null,
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
      description: null,
      sowingNotes: null,
    },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "unknown",
    listingCount: listings.length,
    sellerCount: new Set(listings.map((l) => l.seller.slug)).size,
    inStockCount: listings.length,
    lastCheckedAt: listings[0]?.lastCheckedAt ?? null,
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    description: opts.description === undefined ? null : opts.description,
    templateDescription: "Template marker sentence that must never leak into metadata.",
    answer: answerSentence(varietyName, listings),
    sowingNotes: null,
    heightCm: null,
    facts: { color_family: "unknown", pollination: "unknown", height_cm: { min: null, max: null }, days_to_bloom: { min: null, max: null } },
    tags: [],
    aliases: [],
    protection: "unknown",
    protectionNote: null,
    contentLevel: "thin",
    updatedAt: "2026-11-16",
    listings,
    media: [],
  };
}

/** Distinctive seller names for the name-absence census. */
const FARM_A = "Zephyr Test Farm";
const FARM_B = "Quillwort Acres Seed Co.";

describe("Template A — sellers ≥ 1, usable prose", () => {
  it("renders head + first prose sentence + directory clause (worked example A)", () => {
    const v = variety({
      description:
        "Warm cinnamon-scented leaves  for teas,\ngarnishes and bouquets. A second sentence that must never appear in the snippet.",
      listings: [listing("zephyr", FARM_A), listing("quillwort", FARM_B)],
    });
    // The input carries the real roster; the output must not.
    expect(v.answer).toContain(FARM_A);
    expect(varietyDescription(v)).toBe(
      "Cinnamon Basil seeds (Ocimum basilicum). Warm cinnamon-scented leaves for teas, garnishes and bouquets. Sellers list packet sizes in the Seed Directory.",
    );
  });

  it("drops only the clause when prose fits but the clause does not", () => {
    const prose =
      "Tall, strongly fragrant cut flower stock with very early programmable timing for fall and spring field plantings.";
    expect(prose.length).toBeGreaterThan(110); // clause cannot fit after it…
    expect(41 + 1 + prose.length).toBeLessThanOrEqual(160); // …but the prose itself fits
    const v = variety({ description: prose, listings: [listing("zephyr", FARM_A)] });
    expect(varietyDescription(v)).toBe(`Cinnamon Basil seeds (Ocimum basilicum). ${prose}`);
  });

  it("keeps an abbreviated sentence whole — never a dangling fragment", () => {
    const v = variety({
      varietyName: "Gift Zinnia",
      commonName: "Zinnia",
      latinName: "Zinnia elegans",
      description: "Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line.",
      listings: [listing("hudson", "Hudson Valley Seed Co.")],
    });
    expect(varietyDescription(v)).toBe(
      "Gift Zinnia seeds (Zinnia elegans). Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line. Sellers list packet sizes in the Seed Directory.",
    );
  });
});

describe("Template B — sellers ≥ 1, prose absent or unusable", () => {
  it("renders count + packet range + closing for N ≥ 2 (worked example B)", () => {
    const listings = Array.from({ length: 17 }, (_, i) =>
      listing(`farm-${i + 1}`, `Zephyr Test Farm ${i + 1}`, i === 0 ? [25] : i === 1 ? [300, 25] : [null]),
    );
    const v = variety({ description: null, listings });
    expect(v.answer).toContain("Zephyr Test Farm 1");
    expect(varietyDescription(v)).toBe(
      "Cinnamon Basil seeds (Ocimum basilicum). Listed by 17 US sellers in the Seed Directory. Packets from 25 to 300 seeds. Each listing links out to buy.",
    );
  });

  it("uses singular agreement and the directory-clause closing for N = 1 with no range", () => {
    const v = variety({
      varietyName: "Juliet",
      commonName: "Iceland Poppy",
      latinName: "Papaver nudicaule",
      description: null,
      listings: [listing("zephyr", FARM_A, [null])],
    });
    expect(varietyDescription(v)).toBe(
      "Juliet Iceland Poppy seeds (Papaver nudicaule). Listed by 1 US seller in the Seed Directory. Sellers list packet sizes in the Seed Directory.",
    );
  });

  it("counts distinct sellers, not listings", () => {
    const v = variety({
      varietyName: "Test",
      commonName: "Sweet Pea",
      latinName: "Lathyrus odoratus",
      description: null,
      listings: [listing("zephyr", FARM_A, [10]), listing("zephyr", FARM_A, [20])],
    });
    expect(varietyDescription(v)).toBe(
      "Test Sweet Pea seeds (Lathyrus odoratus). Listed by 1 US seller in the Seed Directory. Packets from 10 to 20 seeds. Each listing links out to buy.",
    );
  });

  it("renders 'Packets of N seeds.' when min equals max", () => {
    const v = variety({
      description: null,
      listings: [listing("zephyr", FARM_A, [50]), listing("quillwort", FARM_B, [50, 50])],
    });
    expect(varietyDescription(v)).toBe(
      "Cinnamon Basil seeds (Ocimum basilicum). Listed by 2 US sellers in the Seed Directory. Packets of 50 seeds. Each listing links out to buy.",
    );
  });

  it("falls back to Template B — never a clipped fragment — when the first sentence is too long", () => {
    const prose =
      "Tall, strongly fragrant cut flower stock with very early programmable timing for fall and spring greenhouse plantings, uniform stem length across the mix, approximately half double flowering which is normal, and best suited for cool greenhouse, tunnel, or open field production ground.";
    expect(41 + 1 + prose.length).toBeGreaterThan(160); // unusable: cannot fit whole
    const v = variety({
      description: prose,
      listings: [listing("zephyr", FARM_A, [50]), listing("quillwort", FARM_B, [50]), listing("x", "Xylophone Gardens", [50])],
    });
    const out = varietyDescription(v);
    expect(out).toBe(
      "Cinnamon Basil seeds (Ocimum basilicum). Listed by 3 US sellers in the Seed Directory. Packets of 50 seeds. Each listing links out to buy.",
    );
    expect(out).not.toContain("fragrant");
  });

  it("treats empty-string prose as absent, with no placeholder text", () => {
    const v = variety({ description: "", listings: [listing("zephyr", FARM_A, [null])] });
    expect(varietyDescription(v)).toBe(
      "Cinnamon Basil seeds (Ocimum basilicum). Listed by 1 US seller in the Seed Directory. Sellers list packet sizes in the Seed Directory.",
    );
  });
});

describe("Template C — zero sellers", () => {
  it("renders head + clause only when prose is absent (worked example C)", () => {
    const v = variety({ varietyName: "Genovese", description: null, listings: [] });
    expect(varietyDescription(v)).toBe(
      "Genovese Basil seeds (Ocimum basilicum). No US sellers currently list this variety. Join the waitlist.",
    );
  });

  it("renders the clause immediately after the head, prose after when it fits whole", () => {
    const v = variety({
      varietyName: "Genovese",
      description: "Sweet, large-leaved basil for pesto and caprese salads.",
      listings: [],
    });
    expect(varietyDescription(v)).toBe(
      "Genovese Basil seeds (Ocimum basilicum). No US sellers currently list this variety. Join the waitlist. Sweet, large-leaved basil for pesto and caprese salads.",
    );
  });

  it("renders head + clause only when the first sentence cannot fit — never a fragment", () => {
    const v = variety({
      varietyName: "Genovese",
      description:
        "Sweet, large-leaved basil for pesto and caprese salads, slow to bolt in summer heat, uniform germination across the flat, and fragrant enough for teas and garnishes too.",
      listings: [],
    });
    const out = varietyDescription(v);
    expect(out).toBe(
      "Genovese Basil seeds (Ocimum basilicum). No US sellers currently list this variety. Join the waitlist.",
    );
    expect(out).not.toContain("pesto");
  });
});

describe("head, Latin, and prose mechanics", () => {
  it("adds the crop word only when the variety name does not already end with it", () => {
    const headIs = (out: string, head: string) => expect(out.startsWith(head)).toBe(true);
    headIs(
      varietyDescription(variety({ varietyName: "Cinnamon Basil", commonName: "Basil", listings: [] })),
      "Cinnamon Basil seeds",
    );
    headIs(
      varietyDescription(variety({ varietyName: "Genovese", commonName: "Basil", listings: [] })),
      "Genovese Basil seeds",
    );
    // Multi-word crop: the check is on the final word, case-insensitive.
    headIs(
      varietyDescription(variety({ varietyName: "Spencer", commonName: "Sweet Pea", latinName: null, listings: [] })),
      "Spencer Sweet Pea seeds",
    );
    headIs(
      varietyDescription(variety({ varietyName: "Spencer Pea", commonName: "Sweet Pea", latinName: null, listings: [] })),
      "Spencer Pea seeds",
    );
    headIs(
      varietyDescription(variety({ varietyName: "CINNAMON BASIL", commonName: "Basil", latinName: null, listings: [] })),
      "CINNAMON BASIL seeds",
    );
    // Slashed common names use the short form, as shortCommonName renders it.
    headIs(
      varietyDescription(
        variety({ varietyName: "Frosty Mix", commonName: "Cornflower / Bachelor's Buttons", latinName: null, listings: [] }),
      ),
      "Frosty Mix Cornflower seeds",
    );
  });

  it("omits the Latin slot entirely when no Latin name exists", () => {
    const out = varietyDescription(variety({ latinName: null, description: null, listings: [] }));
    expect(out.startsWith("Cinnamon Basil seeds.")).toBe(true);
    expect(out).not.toContain("(");
    expect(out).not.toContain("  ");
  });

  it("terminates prose that carries no sentence terminator", () => {
    const v = variety({ description: "Warm cinnamon-scented leaves", listings: [listing("zephyr", FARM_A, [null])] });
    const out = varietyDescription(v);
    expect(out).toContain("Warm cinnamon-scented leaves.");
    expect(out.length).toBeLessThanOrEqual(160);
  });
});

describe("name-absence census + assembly guarantee", () => {
  const censusOutputs = (): { label: string; out: string; sellerNames: string[] }[] => {
    const high = variety({
      description: null,
      listings: Array.from({ length: 17 }, (_, i) => listing(`census-${i + 1}`, `Zephyr Test Farm ${i + 1}`, [25])),
    });
    const single = variety({
      varietyName: "Juliet",
      commonName: "Iceland Poppy",
      latinName: "Papaver nudicaule",
      description: null,
      listings: [listing("census-quillwort", FARM_B, [null])],
    });
    const zero = variety({ varietyName: "Genovese", description: null, listings: [] });
    const prose = variety({
      description: "Warm cinnamon-scented leaves for teas, garnishes and bouquets.",
      listings: [listing("census-xylo", "Xylophone Gardens", [10])],
    });
    return [
      { label: "high-count", out: varietyDescription(high), sellerNames: high.listings.map((l) => l.seller.name) },
      { label: "single-seller", out: varietyDescription(single), sellerNames: [FARM_B] },
      { label: "zero-seller", out: varietyDescription(zero), sellerNames: [] },
      { label: "with-prose", out: varietyDescription(prose), sellerNames: ["Xylophone Gardens"] },
    ];
  };

  it("names no seller and carries no fragment of the old roster syntax", () => {
    for (const { label, out, sellerNames } of censusOutputs()) {
      for (const name of sellerNames) expect(out, label).not.toContain(name);
      expect(out, label).not.toContain("As of");
      // Case-sensitive: the old roster's verb form "2 sellers list X" (the directory clause's
      // capital-S "Sellers list packet sizes ..." is Wren's exact string, not the roster).
      expect(out, label).not.toContain("sellers list");
      expect(out, label).not.toContain("0 sellers");
      expect(out, label).not.toContain("Template marker");
    }
  });

  it("holds ≤160 chars, no ellipsis, and no price in every census rendering", () => {
    for (const { label, out } of censusOutputs()) {
      expect(out.length, label).toBeLessThanOrEqual(160);
      expect(out, label).not.toContain("…");
      expect(out, label).not.toMatch(/\$\d/);
    }
  });
});
