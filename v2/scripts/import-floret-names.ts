/**
 * Merge the Floret Library seed-name enumeration into seed-data/catalog.json.
 *
 *   npx tsx scripts/import-floret-names.ts            # dry run: print the plan, write nothing
 *   npx tsx scripts/import-floret-names.ts --write    # append to seed-data/catalog.json
 *
 * Source: ~/workspace/seeds-hues/floret-library-names.json — 565 {crop, name, source_url}
 * entries extracted from the Floret Library "Seeds A–Z" collection on 2026-11-16
 * (robots-permitted; see floret-library-names.md). Owner-directed 2026-11-16
 * (AMENDMENT-2026-11-16-FLORET-FIRST.md): the Library's names become catalog varieties;
 * seller discovery comes later, so every new variety starts with no listings and no notes.
 * (At import time these entered as `noindex, follow` under canonical decision 8; the owner's
 * 2026-11-16 ruling superseded that rule — every active variety is now indexable.)
 *
 * Rules (no invented data):
 * - Crops map to existing plants where the crop is the same plant (explicit folded-name
 *   aliases below for the four whose names differ); every other crop becomes a new plant
 *   with latinName NULL (unknown — never invented), description/sowingNotes NULL.
 * - The variety name is the Library title minus its leading crop words; a title that is
 *   only the crop name stays whole (the catalog's existing "Virginia Stock" pattern).
 * - Dedupe within a plant by the project's normalizeName(): a Floret name that matches an
 *   existing variety is a match, never a new row.
 * - Provenance: three sources (one per collection page, exact source_url, checked
 *   2026-11-16); each new variety's sourceId is the page its name was extracted from.
 * - Slugs: <plant>-<variety> (dahlia keeps the existing `dahlia-seed-` prefix); a variety
 *   named exactly after its plant takes the plant slug (existing precedent). Collisions
 *   get a deterministic -2, -3, … suffix and are reported.
 * - Idempotent: re-running after a merge reports every name as already present.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { foldText, normalizeName, slugify } from "@/lib/names";

interface NamesEntry {
  crop: string;
  name: string;
  source_url: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const FLORET_SOURCES = [
  {
    id: "src-floret-library",
    kind: "catalog",
    label: "Floret Library — Seeds A–Z collection, page 1 (variety names extracted 2026-11-16)",
    url: "https://library.floretflowers.com/collections/seeds",
    checkedDate: "2026-11-16",
    access: "public",
  },
  {
    id: "src-floret-library-p2",
    kind: "catalog",
    label: "Floret Library — Seeds A–Z collection, page 2 (variety names extracted 2026-11-16)",
    url: "https://library.floretflowers.com/collections/seeds?page=2",
    checkedDate: "2026-11-16",
    access: "public",
  },
  {
    id: "src-floret-library-p3",
    kind: "catalog",
    label: "Floret Library — Seeds A–Z collection, page 3 (variety names extracted 2026-11-16)",
    url: "https://library.floretflowers.com/collections/seeds?page=3",
    checkedDate: "2026-11-16",
    access: "public",
  },
] as const;

function sourceIdFor(url: string): string {
  if (url.endsWith("?page=2")) return "src-floret-library-p2";
  if (url.endsWith("?page=3")) return "src-floret-library-p3";
  return "src-floret-library";
}

/** Folded crop name → existing plant slug, where the Library's crop word differs from the catalog plant's name. */
const CROP_ALIASES: Record<string, string> = {
  "bachelors button": "cornflower", // catalog plant "Cornflower / Bachelor's Buttons"
  "black eyed susan": "rudbeckia", // Rudbeckia hirta is the black-eyed Susan; plant "Rudbeckia"
  "globe amaranth": "gomphrena", // Gomphrena globosa is globe amaranth; plant "Gomphrena"
  "love in a mist": "nigella", // catalog plant "Nigella / Love-in-a-Mist"
};

/** Slug prefix per plant where the catalog's existing varieties use one (dahlia seed strains). */
const SLUG_PREFIX: Record<string, string> = { dahlia: "dahlia-seed" };

/**
 * Hand-reviewed matches the project's normalizeName() cannot see: the existing catalog
 * records this F1 series with its "(F1)" qualifier ("Madame Butterfly Mix (F1)"), which
 * normalization keeps as a token, while the Library lists the same series without it.
 * Key: `${plant}|${normalizeName(derived variety name)}` → existing variety slug.
 */
const MANUAL_MATCHES: Record<string, string> = {
  "snapdragon|madame butterfly mix": "snapdragon-madame-butterfly-mix",
  // Same cultivar, spacing only: the Library writes "Castlewellan" (one word), the
  // catalog's sourced checks record "Castle Wellan".
  "sweet-pea|castlewellan": "sweet-pea-castle-wellan",
};

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);
const foldedTokens = (s: string) => tokens(foldText(s));

/**
 * Library title minus its leading crop words; a bare crop title stays whole.
 * The walk runs in folded-token space (where "Forget-Me-Not" is 3 tokens) but slices the
 * ORIGINAL title, so accents and spelling survive ("Phlox Crème Brûlée" → "Crème Brûlée").
 */
function deriveVarietyName(crop: string, name: string): { varietyName: string; anomaly: boolean } {
  const cropToks = foldedTokens(crop);
  const nameToks = tokens(name);
  let consumed = 0; // folded tokens consumed so far
  let used = 0; // original tokens consumed so far
  while (used < nameToks.length && consumed < cropToks.length) {
    const ft = foldedTokens(nameToks[used]!);
    if (ft.some((t, i) => cropToks[consumed + i] !== t)) return { varietyName: name, anomaly: true };
    consumed += ft.length;
    used += 1;
  }
  if (consumed !== cropToks.length) return { varietyName: name, anomaly: true };
  if (used >= nameToks.length) return { varietyName: name, anomaly: false };
  return { varietyName: nameToks.slice(used).join(" "), anomaly: false };
}

async function main() {
  const write = process.argv.includes("--write");
  const catalogPath = resolve("seed-data/catalog.json");
  const namesPath = resolve("../floret-library-names.json");
  const catalog: Json = JSON.parse(await readFile(catalogPath, "utf8"));
  const entries: NamesEntry[] = JSON.parse(await readFile(namesPath, "utf8"));

  const report = {
    sourceNames: entries.length,
    matchedExisting: [] as { crop: string; name: string; existingSlug: string }[],
    manualMatches: [] as { crop: string; name: string; existingSlug: string }[],
    alreadyImported: [] as { crop: string; name: string; slug: string }[],
    newVarieties: [] as { crop: string; name: string; varietyName: string; plant: string; slug: string }[],
    newPlants: [] as { crop: string; slug: string }[],
    reusedPlants: [] as { crop: string; slug: string }[],
    collisions: [] as { slug: string; resolved: string; varietyName: string; plant: string }[],
    anomalies: [] as { crop: string; name: string }[],
    duplicateNamesInSource: [] as { crop: string; name: string }[],
  };

  // ── Sources ────────────────────────────────────────────────────────────────
  const sourceIds = new Set<string>(catalog.sources.map((s: Json) => s.id));
  const newSources = FLORET_SOURCES.filter((s) => !sourceIds.has(s.id));

  // ── Plants ─────────────────────────────────────────────────────────────────
  const plantBySlug = new Map<string, Json>(catalog.plants.map((p: Json) => [p.slug, p]));
  const plantByFoldedName = new Map<string, string>();
  for (const p of catalog.plants) {
    plantByFoldedName.set(foldText(p.commonName), p.slug);
    for (const part of String(p.commonName).split("/")) plantByFoldedName.set(foldText(part), p.slug);
  }
  const crops = [...new Set(entries.map((e) => e.crop))];
  const cropToPlant = new Map<string, string>();
  const newPlantRows: Json[] = [];
  for (const crop of crops) {
    const folded = foldText(crop);
    const reuse = CROP_ALIASES[folded] ?? plantByFoldedName.get(folded);
    if (reuse) {
      cropToPlant.set(crop, reuse);
      report.reusedPlants.push({ crop, slug: reuse });
      continue;
    }
    const slug = slugify(crop);
    if (plantBySlug.has(slug)) throw new Error(`new plant slug collides with existing plant: ${slug} (${crop})`);
    if (newPlantRows.some((p) => p.slug === slug)) throw new Error(`two crops slugify to the same plant: ${slug}`);
    cropToPlant.set(crop, slug);
    report.newPlants.push({ crop, slug });
    newPlantRows.push({
      slug,
      commonName: crop,
      latinName: null,
      category: "flowers",
      description: null,
      sowingNotes: null,
    });
  }

  // ── Varieties ──────────────────────────────────────────────────────────────
  const plantCommonName = (slug: string): string =>
    plantBySlug.get(slug)?.commonName ?? newPlantRows.find((p) => p.slug === slug)?.commonName ?? slug;
  const existingKeys = new Map<string, string>(); // `${plant}|${normalized}` → slug
  for (const v of catalog.varieties) {
    existingKeys.set(`${v.plant}|${normalizeName(v.varietyName, plantCommonName(v.plant))}`, v.slug);
  }
  const usedSlugs = new Set<string>(catalog.varieties.map((v: Json) => v.slug));
  const newVarietyRows: Json[] = [];
  const seenSourceKeys = new Set<string>();

  for (const e of entries) {
    const plant = cropToPlant.get(e.crop);
    if (!plant) throw new Error(`crop not mapped: ${e.crop}`);
    const { varietyName, anomaly } = deriveVarietyName(e.crop, e.name);
    if (anomaly) report.anomalies.push({ crop: e.crop, name: e.name });
    const key = `${plant}|${normalizeName(varietyName, plantCommonName(plant))}`;
    if (seenSourceKeys.has(key)) {
      report.duplicateNamesInSource.push({ crop: e.crop, name: e.name });
      continue;
    }
    seenSourceKeys.add(key);
    const manual = MANUAL_MATCHES[key];
    if (manual && existingKeys.get(key) !== manual) {
      // Treat the hand-reviewed pair as the same variety (no new row, no slug collision).
      report.manualMatches.push({ crop: e.crop, name: e.name, existingSlug: manual });
      existingKeys.set(key, manual);
      continue;
    }
    const existing = existingKeys.get(key);
    if (existing) {
      const wasFloret = Boolean(catalog.varieties.find((v: Json) => v.slug === existing)?.sourceId?.startsWith("src-floret-library"));
      if (wasFloret) report.alreadyImported.push({ crop: e.crop, name: e.name, slug: existing });
      else report.matchedExisting.push({ crop: e.crop, name: e.name, existingSlug: existing });
      continue;
    }
    // Slug.
    const prefix = SLUG_PREFIX[plant] ?? plant;
    let slug: string;
    if (slugify(varietyName) === plant) slug = plant;
    else slug = `${prefix}-${slugify(varietyName, 80 - prefix.length - 1)}`;
    if (usedSlugs.has(slug)) {
      const base = slug;
      let n = 2;
      while (usedSlugs.has(`${base}-${n}`)) n += 1;
      slug = `${base}-${n}`;
      report.collisions.push({ slug: base, resolved: slug, varietyName, plant });
    }
    usedSlugs.add(slug);
    existingKeys.set(key, slug);
    report.newVarieties.push({ crop: e.crop, name: e.name, varietyName, plant, slug });
    newVarietyRows.push({
      slug,
      plant,
      varietyName,
      subcategory: null,
      description: null,
      sowingNotes: null,
      heightCm: null,
      colorSwatch: null,
      tags: [],
      protection: "unknown",
      protectionNote: null,
      sourceId: sourceIdFor(e.source_url),
      series: null,
    });
  }

  console.log(JSON.stringify(report, null, 1));
  console.log(
    `\nSUMMARY source=${report.sourceNames} matchedExisting=${report.matchedExisting.length} manualMatches=${report.manualMatches.length} ` +
      `alreadyImported=${report.alreadyImported.length} newVarieties=${report.newVarieties.length} ` +
      `newPlants=${report.newPlants.length} reusedPlants=${report.reusedPlants.length} ` +
      `collisions=${report.collisions.length} anomalies=${report.anomalies.length} ` +
      `dupesInSource=${report.duplicateNamesInSource.length} newSources=${newSources.length}`,
  );
  console.log(
    `TOTALS after merge: plants=${catalog.plants.length + newPlantRows.length} ` +
      `varieties=${catalog.varieties.length + newVarietyRows.length} sellers=${catalog.sellers.length} listings=${catalog.listings.length}`,
  );

  if (!write) {
    console.log("\n(dry run — nothing written)");
    return;
  }
  catalog.sources.push(...newSources);
  catalog.plants.push(...newPlantRows);
  catalog.varieties.push(...newVarietyRows);
  await writeFile(catalogPath, JSON.stringify(catalog, null, 1) + "\n", "utf8");
  console.log(`\n✓ wrote ${catalogPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
