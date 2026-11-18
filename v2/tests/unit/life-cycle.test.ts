import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCatalog } from "@/lib/catalog/importer";
import { CatalogAssertionError } from "@/lib/catalog/assertions";
import type { CatalogInput } from "@/lib/catalog/input";
import { lifeCycleFact } from "@/lib/grower-guide";
import { lifeCycleBuckets, lifeCycleMatches } from "@/lib/life-cycle";
import { loadCatalogJson } from "../helpers/d1";

/**
 * Every distinct life_cycle string in classifications.json (after the import's overrides),
 * growing.json and the 2026-11-18 new-crops data, with its bucket(s). A catalog string missing
 * from this table fails below.
 */
const EXPECTED: Record<string, string[]> = {
  Annual: ["annual"],
  "Hardy annual": ["annual"],
  "Half-hardy annual": ["annual"],
  "Annual or biennial": ["annual", "biennial"],
  "Annual or short-lived perennial, usually grown as an annual": ["annual"],
  Biennial: ["biennial"],
  "Biennial or short-lived perennial": ["biennial", "perennial"],
  "Biennial or short-lived perennial, often grown as an annual": ["annual"],
  "Biennial or short-lived perennial, usually grown as an annual": ["annual"],
  "Biennial to short-lived perennial, usually grown as an annual": ["annual"],
  "Biennial, most often grown as an annual": ["annual"],
  Perennial: ["perennial"],
  "Perennial, often grown as a biennial or annual": ["annual", "biennial"],
  "Short-lived perennial": ["perennial"],
  "Short-lived perennial, often grown as a biennial or annual": ["annual", "biennial"],
  "Short-lived perennial, often grown as an annual": ["annual"],
  "Short-lived perennial, usually grown as an annual": ["annual"],
  "Tender Perennial": ["perennial"],
  "Tender perennial, grown as an annual": ["annual"],
  "Tender perennial, most often grown as an annual": ["annual"],
  "Tender perennial, often grown as an annual": ["annual"],
  "Tender perennial, usually grown as an annual": ["annual"],
  "Tender short-lived perennial, grown as an annual": ["annual"],
};

const GUIDE_CROPS = [
  "breadseed-poppy", "calendula", "celosia", "cornflower", "cosmos", "echinacea", "larkspur", "marigold",
  "nigella", "pincushion-flower", "strawflower", "sunflower", "sweet-pea", "zinnia",
];
const HELD = ["ornamental-grass", "soapwort"];
/** Crops with no life cycle at all: the two held + trachelium (a 2026-11-18 new crop without one). */
const NO_LIFE_CYCLE = [...HELD, "trachelium"].sort();
/** The import's corrections (scripts/add-classification-data.py OVERRIDES). */
const OVERRIDES: Record<string, { life_cycle: string; hardiness?: string }> = {
  "bee-balm": { life_cycle: "Annual", hardiness: "Annual — grown in a single season." },
  salvia: { life_cycle: "Perennial" },
  "clary-sage": { life_cycle: "Hardy annual", hardiness: "Annual — a cool-season flower; sow in fall or early spring." },
};

const catalog = parseCatalog(loadCatalogJson());
const plant = (slug: string) => catalog.plants.find((p) => p.slug === slug)!;
const CLASSIFICATIONS = join(process.cwd(), "..", "seed-saving", "classifications.json");

describe("lifeCycleBuckets (how the crop is grown)", () => {
  it.each(Object.entries(EXPECTED))("%s → %j", (text, buckets) => {
    expect(lifeCycleBuckets(text)).toEqual(buckets);
  });

  it("every distinct life cycle in the catalog is in the table (a new string fails here)", () => {
    const inCatalog = [...new Set(catalog.plants.flatMap((p) => (p.lifeCycle ? [p.lifeCycle] : [])))].sort();
    expect(inCatalog.filter((s) => !(s in EXPECTED))).toEqual([]);
    for (const s of inCatalog) expect(lifeCycleBuckets(s), s).toEqual(EXPECTED[s]);
  });

  it.skipIf(!existsSync(CLASSIFICATIONS))("every distinct life cycle in classifications.json (after overrides) is in the table", () => {
    const file = JSON.parse(readFileSync(CLASSIFICATIONS, "utf8")) as Record<string, { life_cycle?: string }>;
    const values = Object.entries(file)
      .filter(([slug]) => !HELD.includes(slug))
      .map(([slug, e]) => (OVERRIDES[slug] ?? e).life_cycle)
      .filter((s): s is string => !!s);
    for (const s of new Set(values)) expect(lifeCycleBuckets(s), s).toEqual(EXPECTED[s]);
  });

  it("absent or unrecognised text → no bucket", () => {
    expect(lifeCycleBuckets(null)).toEqual([]);
    expect(lifeCycleBuckets(undefined)).toEqual([]);
    expect(lifeCycleBuckets("  ")).toEqual([]);
    expect(lifeCycleBuckets("Woody shrub")).toEqual([]);
    expect(lifeCycleBuckets("Perennial bulb")).toEqual([]);
  });

  it("is case/whitespace tolerant and lifeCycleMatches is ANY-of", () => {
    expect(lifeCycleBuckets("  tender  perennial, usually grown as an annual ")).toEqual(["annual"]);
    expect(lifeCycleMatches("Annual or biennial", ["biennial"])).toBe(true);
    expect(lifeCycleMatches("Annual or biennial", ["perennial"])).toBe(false);
    expect(lifeCycleMatches(null, ["annual", "biennial", "perennial"])).toBe(false);
  });
});

describe("classifications import (catalog.json)", () => {
  const bucketsOf = (slug: string) => lifeCycleBuckets(plant(slug).lifeCycle);

  it("121 crops carry a life cycle: the 14 guide crops + 78 classified + 29 new crops; the 2 held and trachelium carry none", () => {
    const withLife = catalog.plants.filter((p) => p.lifeCycle);
    expect(withLife).toHaveLength(121);
    const guide = withLife.filter((p) => p.growerGuideSource === "src-seed-saving-grower-notes").map((p) => p.slug).sort();
    expect(guide).toEqual(GUIDE_CROPS);
    expect(withLife.filter((p) => p.growerGuideSource === "src-seed-saving-classifications")).toHaveLength(78);
    expect(withLife.filter((p) => p.growerGuideSource === "src-new-crops-2026-11-18")).toHaveLength(29);
    for (const slug of NO_LIFE_CYCLE) {
      expect([plant(slug).lifeCycle, plant(slug).hardiness, plant(slug).growerGuideSource], slug).toEqual([undefined, undefined, undefined]);
      expect(bucketsOf(slug), slug).toEqual([]);
    }
    // Guide crops keep growing.json's wording, not classifications.json's.
    expect(plant("breadseed-poppy").hardiness).not.toBe("Frost-hardy — the foliage is unaffected by light frosts.");
  });

  it("override crops carry the corrected values and buckets", () => {
    expect([plant("bee-balm").lifeCycle, plant("bee-balm").hardiness]).toEqual(["Annual", "Annual — grown in a single season."]);
    expect([plant("salvia").lifeCycle, plant("salvia").hardiness]).toEqual(["Perennial", undefined]);
    expect([plant("clary-sage").lifeCycle, plant("clary-sage").hardiness]).toEqual([
      "Hardy annual",
      "Annual — a cool-season flower; sow in fall or early spring.",
    ]);
    expect(bucketsOf("bee-balm")).toEqual(["annual"]);
    expect(bucketsOf("salvia")).toEqual(["perennial"]);
    expect(bucketsOf("clary-sage")).toEqual(["annual"]);
  });

  it("bucket membership: yarrow perennial, cosmos annual; or-cases in two buckets", () => {
    expect(bucketsOf("yarrow")).toEqual(["perennial"]);
    expect(bucketsOf("cosmos")).toEqual(["annual"]);
    expect(bucketsOf("silene")).toEqual(["annual", "biennial"]);
    const counts = (b: "annual" | "biennial" | "perennial") => catalog.plants.filter((p) => lifeCycleMatches(p.lifeCycle, [b])).length;
    expect([counts("annual"), counts("biennial"), counts("perennial")]).toEqual([90, 8, 27]);
  });

  it("header fact: every crop except the two held and trachelium shows one (yarrow from the file, salvia alone)", () => {
    const without = catalog.plants.filter((p) => !lifeCycleFact(p.lifeCycle, p.hardiness)).map((p) => p.slug).sort();
    expect(without).toEqual(NO_LIFE_CYCLE);
    expect(lifeCycleFact(plant("yarrow").lifeCycle, plant("yarrow").hardiness)).toBe("Perennial in Zones 3-9.");
    expect(lifeCycleFact(plant("salvia").lifeCycle, plant("salvia").hardiness)).toBe("Perennial");
  });

  it("the import rejects a life cycle that maps to no bucket", () => {
    const bad = structuredClone(loadCatalogJson()) as CatalogInput;
    bad.plants.find((p) => p.slug === "yarrow")!.lifeCycle = "Woody shrub";
    try {
      parseCatalog(bad);
      expect.unreachable("parseCatalog should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CatalogAssertionError);
      expect((e as CatalogAssertionError).problems).toContain('plant yarrow: lifeCycle "Woody shrub" maps to no life-cycle bucket (extend lib/life-cycle.ts)');
    }
  });
});
