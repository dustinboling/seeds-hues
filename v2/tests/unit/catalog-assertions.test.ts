import { describe, expect, it } from "vitest";
import { parseCatalog } from "@/lib/catalog/importer";
import {
  CatalogAssertionError,
  contentLevel,
  EXCLUDED_COMPANY_NAMES,
  EXCLUDED_SELLER_TOKENS,
  isIndexable,
} from "@/lib/catalog/assertions";
import type { CatalogInput } from "@/lib/catalog/input";
import { loadCatalogJson } from "../helpers/d1";

const fresh = () => structuredClone(loadCatalogJson()) as CatalogInput;

function problemsOf(c: unknown): string[] {
  try {
    parseCatalog(c);
    return [];
  } catch (e) {
    if (e instanceof CatalogAssertionError) return e.problems;
    throw e;
  }
}

describe("catalog.json assertions (FINAL §6)", () => {
  it("the real seed file passes: 778 varieties / 25 sellers / 17 listings / 124 plants", () => {
    const c = parseCatalog(loadCatalogJson());
    expect([c.varieties.length, c.sellers.length, c.listings.length, c.plants.length]).toEqual([778, 25, 17, 124]);
  });

  it("fails on count mismatch", () => {
    const c = fresh();
    c.varieties.pop();
    expect(problemsOf(c).join("\n")).toMatch(/count varieties: expected 778, got 777/);
  });

  it("fails on an excluded large-company seller (slug or name)", () => {
    // Every token on the exclusion list is rejected; names come from the list itself.
    for (const token of EXCLUDED_SELLER_TOKENS) {
      const c = fresh();
      c.sellers[0]!.slug = `${token}-farm`.replace(/[^a-z0-9-]/g, "");
      expect(problemsOf(c).join("\n")).toMatch(/excluded large-company seller/);
      const d = fresh();
      d.sellers[1]!.name = `${token.toUpperCase()} Farm`;
      expect(problemsOf(d).join("\n")).toMatch(/excluded large-company seller/);
    }
  });

  it("fails when any string anywhere names an excluded company", () => {
    for (const name of EXCLUDED_COMPANY_NAMES) {
      const c = fresh();
      c.listings[0]!.notes = `Also sold by ${name}.`;
      expect(problemsOf(c).join("\n")).toMatch(/excluded company name at catalog\.listings\[0\]\.notes/);
    }
  });

  it("fails when a listing has no valid source", () => {
    const c = fresh();
    c.listings[3]!.sourceId = "src-does-not-exist";
    expect(problemsOf(c).join("\n")).toMatch(/has no valid source/);
  });

  it("fails when a priced packet lacks priceSource or priceCheckDate", () => {
    const c = fresh();
    const priced = c.listings.find((l) => l.packetSizes.some((p) => p.priceCents !== null))!;
    const pk = priced.packetSizes.find((p) => p.priceCents !== null)!;
    pk.priceSource = null;
    expect(problemsOf(c).join("\n")).toMatch(/missing priceSource/);
    const d = fresh();
    const pd = d.listings.find((l) => l.packetSizes.some((p) => p.priceCents !== null))!;
    pd.packetSizes.find((p) => p.priceCents !== null)!.priceCheckDate = null;
    expect(problemsOf(d).join("\n")).toMatch(/missing priceCheckDate/);
  });

  it("fails on a non-integer price (no float prices)", () => {
    const c = fresh();
    const priced = c.listings.find((l) => l.packetSizes.some((p) => p.priceCents !== null))!;
    priced.packetSizes.find((p) => p.priceCents !== null)!.priceCents = 6.5;
    expect(problemsOf(c).join("\n")).toMatch(/schema: listings\.\d+\.packetSizes\.\d+\.priceCents/);
  });

  it("fails on orphan foreign keys and duplicate slugs", () => {
    const c = fresh();
    c.listings[0]!.variety = "no-such-variety";
    c.varieties[1]!.slug = c.varieties[0]!.slug;
    const p = problemsOf(c).join("\n");
    expect(p).toMatch(/orphan listing/);
    expect(p).toMatch(/duplicate variety slug/);
  });

  it("rejects unknown keys (strict schema, no silent drops)", () => {
    const c = fresh() as unknown as { sellers: Record<string, unknown>[] };
    c.sellers[0]!.rating = 5;
    expect(problemsOf(c).join("\n")).toMatch(/schema: sellers\.0/);
  });
});

describe("season classes (catalog data)", () => {
  it("the seed data classifies 88 of 124 crops: 52 cool, 36 warm, 36 left unclassified (12 with no fields, 24 new crops with explicit nulls)", () => {
    const c = parseCatalog(loadCatalogJson());
    const by = (k: string | undefined | null) => c.plants.filter((p) => (p.seasonClass ?? undefined) === (k ?? undefined));
    expect(by("cool_season_hardy_annual")).toHaveLength(52);
    expect(by("warm_season_tender_annual")).toHaveLength(36);
    const unclassified = by(undefined);
    expect(unclassified).toHaveLength(36);
    const noFields = unclassified.filter((p) => !("seasonClass" in p) && !("seasonSource" in p));
    expect(noFields.map((p) => p.slug).sort()).toEqual([
      "figwort", "flax", "formosa-lily", "foxglove", "oregano", "ornamental-grass", "pea", "shiso", "silene", "silver-lace", "sweet-rocket", "virginia-stock",
    ]);
    // The 2026-11-18 new crops write both keys as explicit nulls instead of omitting them.
    const explicitNull = unclassified.filter((p) => !noFields.includes(p));
    expect(explicitNull).toHaveLength(24);
    expect(explicitNull.every((p) => p.seasonClass === null && p.seasonSource === null)).toBe(true);
  });

  it("an unknown season class, a dangling season source, or a class without its source fails loudly", () => {
    const badEnum = fresh();
    (badEnum.plants[0] as Record<string, unknown>).seasonClass = "perennial";
    expect(problemsOf(badEnum).some((p) => p.startsWith("schema: plants.0.seasonClass"))).toBe(true);

    const dangling = fresh();
    dangling.plants[0]!.seasonClass = "cool_season_hardy_annual";
    dangling.plants[0]!.seasonSource = "src-does-not-exist";
    expect(problemsOf(dangling)).toContain(`plant ${dangling.plants[0]!.slug} has no valid season source (src-does-not-exist)`);

    const noSource = fresh();
    noSource.plants[0]!.seasonClass = "warm_season_tender_annual";
    delete noSource.plants[0]!.seasonSource;
    expect(problemsOf(noSource)).toContain(`plant ${noSource.plants[0]!.slug}: seasonClass and seasonSource must be set together`);

    const noClass = fresh();
    noClass.plants[0]!.seasonClass = null;
    noClass.plants[0]!.seasonSource = "src-tgw-cool-season-seeds";
    expect(problemsOf(noClass)).toContain(`plant ${noClass.plants[0]!.slug}: seasonClass and seasonSource must be set together`);
  });
});

describe("sowing methods + colour families (catalog data)", () => {
  it("the seed data gives 120 of 124 crops methods with their source (91 Floret Library + 29 new crops), and 714 varieties a colour family", () => {
    const c = parseCatalog(loadCatalogJson());
    const withMethods = c.plants.filter((p) => p.sowingMethods);
    expect(withMethods).toHaveLength(120);
    expect(withMethods.filter((p) => p.sowingMethodSource === "src-floret-library-sowing-notes")).toHaveLength(91);
    expect(withMethods.filter((p) => p.sowingMethodSource === "src-new-crops-2026-11-18")).toHaveLength(29);
    const none = c.plants.filter((p) => !p.sowingMethods).map((p) => p.slug).sort();
    expect(none).toEqual(["eucalyptus", "mullein", "virginia-stock", "wallflower"]);
    expect(c.plants.find((p) => p.slug === "larkspur")!.sowingMethods).toEqual(["direct_sow", "transplant"]);
    expect(c.varieties.filter((v) => v.colorFamily)).toHaveLength(714);
  });

  it("an unknown method, methods without a source (or vice versa), or an unknown colour family fails loudly", () => {
    const badMethod = fresh();
    (badMethod.plants[0] as Record<string, unknown>).sowingMethods = ["broadcast"];
    expect(problemsOf(badMethod).some((p) => p.startsWith("schema: plants.0.sowingMethods"))).toBe(true);

    const noSource = fresh();
    delete noSource.plants[0]!.sowingMethodSource;
    expect(problemsOf(noSource)).toContain(`plant ${noSource.plants[0]!.slug}: sowingMethods and sowingMethodSource must be set together`);

    const noMethods = fresh();
    delete noMethods.plants[0]!.sowingMethods;
    expect(problemsOf(noMethods)).toContain(`plant ${noMethods.plants[0]!.slug}: sowingMethods and sowingMethodSource must be set together`);

    const dangling = fresh();
    dangling.plants[0]!.sowingMethodSource = "src-does-not-exist";
    expect(problemsOf(dangling)).toContain(`plant ${dangling.plants[0]!.slug} has no valid sowing method source (src-does-not-exist)`);

    const badColour = fresh();
    (badColour.varieties[0] as Record<string, unknown>).colorFamily = "unknown";
    expect(problemsOf(badColour).some((p) => p.startsWith("schema: varieties.0.colorFamily"))).toBe(true);
  });
});

describe("content_level (FINAL §1.3) and the R5 index rule", () => {
  const plant = { slug: "p", commonName: "P", latinName: "P p", category: "flowers", description: null, sowingNotes: null };
  const base = {
    slug: "v",
    plant: "p",
    varietyName: "V",
    subcategory: null,
    series: null,
    description: null,
    sowingNotes: null,
    heightCm: null,
    colorSwatch: null,
    tags: [] as string[],
    protection: "unknown" as const,
    protectionNote: null,
    sourceId: "s",
  };

  it("needs ≥ 3 sourced facts to be factual", () => {
    expect(contentLevel({ ...base, description: "d", sowingNotes: "s" }, plant)).toBe("thin");
    expect(contentLevel({ ...base, description: "d", sowingNotes: "s", heightCm: 30 }, plant)).toBe("factual");
    expect(contentLevel({ ...base, description: "d", tags: ["a", "b"], heightCm: 30 }, plant)).toBe("factual");
    expect(contentLevel({ ...base, description: "d", tags: ["a"], heightCm: 30 }, plant)).toBe("thin");
    expect(contentLevel({ ...base, description: "d", heightCm: 30 }, { ...plant, sowingNotes: "plant-level" })).toBe("factual");
  });

  it("indexable = every active, non-deleted variety (owner ruling 2026-11-16 supersedes decision 8)", () => {
    expect(isIndexable("active")).toBe(true);
    expect(isIndexable("active", null)).toBe(true);
    expect(isIndexable("active", "2026-11-16T00:00:00.000Z")).toBe(false); // soft-deleted
    expect(isIndexable("draft")).toBe(false);
    expect(isIndexable("discontinued")).toBe(false);
    expect(isIndexable("merged")).toBe(false);
  });

  it("the seed data yields 778 indexable varieties (every one imports active) and 0 noindex", () => {
    const c = parseCatalog(loadCatalogJson());
    const idx = c.varieties.filter(() => isIndexable("active"));
    expect(idx).toHaveLength(778);
    expect(c.varieties.length - idx.length).toBe(0);
  });
});
