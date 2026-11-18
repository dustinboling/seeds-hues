import { describe, expect, it } from "vitest";
import { parseCatalog } from "@/lib/catalog/importer";
import { CatalogAssertionError } from "@/lib/catalog/assertions";
import type { CatalogInput } from "@/lib/catalog/input";
import { growerGuideTabs, lifeCycleFact } from "@/lib/grower-guide";
import { growerGuideOf } from "@/lib/services/catalog";
import { GrowerGuideSchema } from "@/lib/validators";
import { loadCatalogJson } from "../helpers/d1";

const COVERED = [
  "breadseed-poppy",
  "calendula",
  "celosia",
  "cornflower",
  "cosmos",
  "echinacea",
  "larkspur",
  "marigold",
  "nigella",
  "pincushion-flower",
  "strawflower",
  "sunflower",
  "sweet-pea",
  "zinnia",
];

const catalog = parseCatalog(loadCatalogJson());
const plant = (slug: string) => catalog.plants.find((p) => p.slug === slug)!;
/** The guide exactly as the crop page receives it (catalog.json → stored JSON → service). */
const guideOf = (slug: string) => {
  const g = plant(slug).growerGuide;
  return growerGuideOf(g ? JSON.stringify(g) : null);
};
const tabIds = (slug: string) => growerGuideTabs(guideOf(slug)).map((t) => t.id);

describe("header life-cycle fact", () => {
  it("both fields → one fact joined with a middle dot", () => {
    expect(lifeCycleFact("Perennial", "Zones 3–8")).toBe("Perennial · Zones 3–8");
  });
  it("life cycle only / hardiness only → just that one", () => {
    expect(lifeCycleFact("Hardy annual", null)).toBe("Hardy annual");
    expect(lifeCycleFact(null, "Zones 3–8")).toBe("Zones 3–8");
    expect(lifeCycleFact(undefined, "  Zones 3–8 ")).toBe("Zones 3–8");
  });
  it("neither (or blank) → null, so no line renders", () => {
    expect(lifeCycleFact(null, null)).toBeNull();
    expect(lifeCycleFact(undefined, undefined)).toBeNull();
    expect(lifeCycleFact(" ", "")).toBeNull();
  });
  it("hardiness text that already names the life cycle is not repeated", () => {
    expect(lifeCycleFact("Annual", "Hardy annual — the foliage shrugs off light frosts.")).toBe(
      "Hardy annual — the foliage shrugs off light frosts.",
    );
    expect(lifeCycleFact("Hardy annual", "Hardy annual — frost-hardy.")).toBe("Hardy annual — frost-hardy.");
    expect(lifeCycleFact("Perennial", "Perennial in Zones 3–8.")).toBe("Perennial in Zones 3–8.");
    // Life cycle named only later in the sentence (not the opening clause) → both shown.
    expect(lifeCycleFact("Perennial", "Zones 3–8, a long-lived perennial")).toBe("Perennial · Zones 3–8, a long-lived perennial");
  });
  it("the catalog's 14 covered crops each get a fact; a crop without a life cycle gets none", () => {
    for (const slug of COVERED) expect(lifeCycleFact(plant(slug).lifeCycle, plant(slug).hardiness), slug).toBeTruthy();
    expect(lifeCycleFact(plant("zinnia").lifeCycle, plant("zinnia").hardiness)).toBe("Annual — plant out after frost; the first frost ends it.");
    // soapwort is held out of the classifications import (tests/unit/life-cycle.test.ts).
    expect(lifeCycleFact(plant("soapwort").lifeCycle, plant("soapwort").hardiness)).toBeNull();
  });
});

describe("grower guide tab set", () => {
  it("exactly the 14 coverage crops carry a guide (echinacea, a 2026-11-18 new crop, carries the 14th)", () => {
    const withGuide = catalog.plants.filter((p) => p.growerGuide).map((p) => p.slug).sort();
    expect(withGuide).toEqual(COVERED);
    expect(catalog.plants.some((p) => p.slug === "echinacea")).toBe(true);
    expect(catalog.plants.filter((p) => p.growerGuide).every((p) => p.growerGuideSource === "src-seed-saving-grower-notes")).toBe(true);
  });

  it("zinnia: all three tabs, in life-arc order", () => {
    const tabs = growerGuideTabs(guideOf("zinnia"));
    expect(tabs.map((t) => t.label)).toEqual(["Germination & Growing", "Harvest", "Seed Saving"]);
    const growing = tabs[0]!;
    expect(growing.id === "growing" && growing.items.map((i) => i.label)).toEqual([
      "Sowing",
      "Germination",
      "Transplanting",
      "Days to bloom",
      "Spacing",
      "Growing",
    ]);
    const seed = tabs[2]!;
    expect(seed.id === "seed-saving" && seed.difficulty).toBe("easy");
    expect(seed.id === "seed-saving" && seed.items.map((i) => i.label)).toEqual([
      "When to harvest",
      "How to collect",
      "Cleaning",
      "Drying",
      "Storage",
      "Pollination",
    ]);
  });

  it("breadseed-poppy has no harvest_for_cutting, so no Harvest tab", () => {
    expect(tabIds("breadseed-poppy")).toEqual(["growing", "seed-saving"]);
    expect(guideOf("breadseed-poppy")!.growing!.harvest_for_cutting).toBeNull();
  });

  it("echinacea has no harvest_for_cutting either, so no Harvest tab", () => {
    expect(tabIds("echinacea")).toEqual(["growing", "seed-saving"]);
    expect(guideOf("echinacea")!.growing!.harvest_for_cutting).toBeNull();
  });

  it("every other covered crop has all three tabs", () => {
    for (const slug of COVERED.filter((s) => s !== "breadseed-poppy" && s !== "echinacea")) expect(tabIds(slug), slug).toEqual(["growing", "harvest", "seed-saving"]);
  });

  it("good_to_know renders inside the Germination & Growing tab only when present (no fourth tab)", () => {
    const poppy = growerGuideTabs(guideOf("breadseed-poppy"))[0]!;
    expect(poppy.id === "growing" && poppy.goodToKnow).toHaveLength(1);
    const zinnia = growerGuideTabs(guideOf("zinnia"))[0]!;
    expect(zinnia.id === "growing" && zinnia.goodToKnow).toEqual([]);
    for (const slug of COVERED) expect(growerGuideTabs(guideOf(slug)).length).toBeLessThanOrEqual(3);
  });

  it("a crop with no grower content renders no tab section", () => {
    expect(guideOf("yarrow")).toBeNull();
    expect(growerGuideTabs(guideOf("yarrow"))).toEqual([]);
    expect(growerGuideTabs(null)).toEqual([]);
    expect(growerGuideTabs(undefined)).toEqual([]);
  });

  it("absent fields are skipped and empty sections drop their tab", () => {
    const only = growerGuideOf(JSON.stringify({ growing: { spacing: "Space plants 9 inches apart." } }))!;
    expect(GrowerGuideSchema.safeParse(only).success).toBe(true);
    const tabs = growerGuideTabs(only);
    expect(tabs).toEqual([{ id: "growing", label: "Germination & Growing", items: [{ label: "Spacing", text: "Space plants 9 inches apart." }], goodToKnow: [] }]);
    const seedOnly = growerGuideTabs(growerGuideOf(JSON.stringify({ seedSaving: { difficulty: "moderate" } })));
    expect(seedOnly).toEqual([{ id: "seed-saving", label: "Seed Saving", difficulty: "moderate", items: [] }]);
  });

  it("nothing provenance-like is in the guide the page receives", () => {
    for (const slug of COVERED) {
      const s = JSON.stringify(guideOf(slug));
      for (const a of ["source", "Source", "SOURCES", "http", "Seed Savers", "Extension", "Floret", "rareseeds", "threshseed"]) expect(s, `${slug}: ${a}`).not.toContain(a);
    }
  });
});

describe("grower guide catalog assertions", () => {
  const fresh = () => structuredClone(loadCatalogJson()) as CatalogInput;
  const problemsOf = (c: unknown): string[] => {
    try {
      parseCatalog(c);
      return [];
    } catch (e) {
      if (e instanceof CatalogAssertionError) return e.problems;
      throw e;
    }
  };
  const idx = () => fresh().plants.findIndex((p) => p.slug === "zinnia");

  it("content without its source (or a dangling source) fails loudly", () => {
    const noSource = fresh();
    delete noSource.plants[idx()]!.growerGuideSource;
    expect(problemsOf(noSource)).toContain("plant zinnia: lifeCycle/hardiness/growerGuide and growerGuideSource must be set together");
    const dangling = fresh();
    dangling.plants[idx()]!.growerGuideSource = "src-does-not-exist";
    expect(problemsOf(dangling)).toContain("plant zinnia has no valid grower guide source (src-does-not-exist)");
  });

  it("unknown guide fields and empty sections fail loudly", () => {
    const unknown = fresh();
    (unknown.plants[idx()]!.growerGuide!.growing as Record<string, unknown>).soil = "Loam";
    expect(problemsOf(unknown).some((p) => p.startsWith(`schema: plants.${idx()}.growerGuide.growing`))).toBe(true);
    const empty = fresh();
    empty.plants[idx()]!.growerGuide!.seedSaving = {};
    expect(problemsOf(empty)).toContain("plant zinnia: growerGuide.seedSaving is empty (omit it instead)");
  });
});
