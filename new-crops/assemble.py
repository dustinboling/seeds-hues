"""POST-FIX NOTE (2026-11-18): after assembly, seed-data/catalog.json was hand-corrected to satisfy the importer assertions — (1) growerGuideSource removed from guide-less new plants, (2) empty sowingMethods keys omitted (wallflower, mullein), (3) null lifeCycle/hardiness/colorFamily keys omitted rather than null, (4) the new source label reworded to avoid excluded company names. catalog.json is canonical; do not re-run this script without reapplying those fixes."""
#!/usr/bin/env python3
"""Assemble the 31 new cut-flower crops (Task 3) into seed-data/catalog.json.

Inputs: new-crops/batch-a.json, batch-b.json, batch-c.json (researched variety
names + plain facts + sourced classifications; see the batch files' sourcesUsed).
Echinacea's grower guide comes from seed-saving/growing.json + instructions.json
(the same files Task D used), built with the same field rules as
scripts/add-grower-guide-data.py.

Rules: names + plain facts only; classifications only where the batches sourced
them (nulls stay null); no listings/sellers. Dry-run by default; --write applies
(after backing up catalog.json to catalog.pre-new-crops.json).
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V2 = HERE.parent / "v2"
CATALOG = V2 / "seed-data" / "catalog.json"
SEED_SAVING = HERE.parent / "seed-saving"

SRC = "src-new-crops-2026-11-18"
SOURCE_ROW = {
    "id": SRC,
    "kind": "research",
    "label": "New cut-flower crops enumeration, Nov 2026 — variety names and growing facts from Johnny's Selected Seeds, GeoSeed, The Gardener's Workshop and seed-house catalogues (reference only)",
    "url": None,
    "checkedDate": "2026-11-18",
    "access": "public",
}
GUIDE_SOURCE = "src-seed-saving-grower-notes"

EXPECTED = [
    "echinacea", "lisianthus", "delphinium", "eryngium", "ageratum", "craspedia",
    "trachelium", "flowering-kale", "safflower", "lavender", "verbena",
    "ranunculus", "columbine", "milkweed", "balloon-flower", "cleome",
    "goldenrod", "honesty", "chinese-lantern", "coleus", "wallflower",
    "false-sunflower", "paper-daisy", "perennial-babys-breath", "anise-hyssop",
    "mullein", "globe-thistle", "false-indigo", "spike-speedwell",
    "masterwort", "hollyhock",
]

# Fact-preserving phrasing normalisations (content unchanged, house style aligned).
HARDINESS_FIX = {
    "lavender": ("Perennial in Zones 5-8", "Perennial in Zones 5-8."),
    "hollyhock": ("Biennial, hardy in USDA zones 2-8", "Hardy in Zones 2-8."),
    "chinese-lantern": ("Perennial in USDA zones 3-9", "Perennial in USDA zones 3-9."),
    "coleus": ("Perennial in USDA zones 10-11", "Perennial in USDA zones 10-11."),
}

GROWING_FIELDS = ["sowing", "germination", "transplanting", "days_to_bloom", "spacing", "growing", "harvest_for_cutting", "good_to_know"]
SEED_FIELDS = ["when_to_harvest", "how_to_collect", "cleaning", "drying", "storage", "pollination_notes", "difficulty"]


def slugify(name: str) -> str:
    s = name.lower().replace("&", " and ").replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def echinacea_guide() -> dict:
    g = json.loads((SEED_SAVING / "growing.json").read_text())["echinacea"]
    i = json.loads((SEED_SAVING / "instructions.json").read_text())["echinacea"]
    growing = {}
    for f in GROWING_FIELDS:
        if f in g:
            v = g[f]
            growing[f] = [v] if f == "good_to_know" and isinstance(v, str) else v
    seed = {f: i[f] for f in SEED_FIELDS if f in i}
    guide = {}
    if growing:
        guide["growing"] = growing
    if seed:
        guide["seedSaving"] = seed
    return guide


def main() -> None:
    write = "--write" in sys.argv
    catalog = json.loads(CATALOG.read_text())
    existing_plants = {p["slug"] for p in catalog["plants"]}
    existing_varieties = {v["slug"] for v in catalog["varieties"]}

    batches = {}
    for b in "abc":
        batches.update(json.loads((HERE / f"batch-{b}.json").read_text()))
    missing = [s for s in EXPECTED if s not in batches]
    extra = [s for s in batches if s not in EXPECTED]
    if missing or extra:
        raise SystemExit(f"batch coverage mismatch: missing={missing} extra={extra}")
    clash = [s for s in EXPECTED if s in existing_plants]
    if clash:
        raise SystemExit(f"slugs already in catalog: {clash}")

    new_plants, new_varieties = [], []
    seen = set(existing_varieties)
    for slug in EXPECTED:
        entry = batches[slug]
        c = entry["classification"]
        hardiness = c.get("hardiness")
        if slug in HARDINESS_FIX and hardiness == HARDINESS_FIX[slug][0]:
            hardiness = HARDINESS_FIX[slug][1]
        plant = {
            "slug": slug,
            "commonName": entry["commonName"],
            "latinName": entry["latinName"],
            "category": "flowers",
            "description": None,
            "sowingNotes": None,
            "seasonClass": c.get("seasonClass"),
            "seasonSource": SRC if c.get("seasonClass") else None,
            "sowingMethods": c.get("sowingMethods") or [],
            "sowingMethodSource": SRC if c.get("sowingMethods") else None,
            "lifeCycle": c.get("lifeCycle"),
            "hardiness": hardiness,
        }
        if slug == "echinacea":
            g = json.loads((SEED_SAVING / "growing.json").read_text())["echinacea"]
            plant["lifeCycle"] = g["life_cycle"]
            plant["hardiness"] = g["hardiness"]
            plant["growerGuide"] = echinacea_guide()
            plant["growerGuideSource"] = GUIDE_SOURCE
        else:
            plant["growerGuideSource"] = SRC
        new_plants.append(plant)

        for v in entry["varieties"]:
            vslug = f"{slug}-{slugify(v['name'])}"
            if vslug in seen:
                raise SystemExit(f"variety slug collision: {vslug}")
            seen.add(vslug)
            new_varieties.append({
                "slug": vslug,
                "plant": slug,
                "varietyName": v["name"],
                "subcategory": None,
                "description": None,
                "sowingNotes": None,
                "heightCm": None,
                "colorSwatch": None,
                "colorFamily": v.get("colorFamily"),
                "tags": [],
                "protection": "unknown",
                "protectionNote": None,
                "sourceId": SRC,
                "series": v.get("series"),
            })

    print(f"new plants: {len(new_plants)}, new varieties: {len(new_varieties)}")
    for p in new_plants:
        n = sum(1 for v in new_varieties if v["plant"] == p["slug"])
        print(f"  {p['slug']}: {n} varieties, season={p['seasonClass']}, methods={p['sowingMethods']}, lc={p['lifeCycle']!r}, hard={p['hardiness']!r}, guide={'growerGuide' in p}")
    if not write:
        print("dry run — pass --write to apply")
        return
    backup = CATALOG.with_name("catalog.pre-new-crops.json")
    backup.write_text(CATALOG.read_text())
    if not any(s["id"] == SRC for s in catalog["sources"]):
        catalog["sources"].append(SOURCE_ROW)
    catalog["plants"].extend(new_plants)
    catalog["varieties"].extend(new_varieties)
    CATALOG.write_text(json.dumps(catalog, indent=1) + "\n")
    print(f"wrote {CATALOG} (backup: {backup.name}); totals: {len(catalog['plants'])} plants, {len(catalog['varieties'])} varieties")


if __name__ == "__main__":
    main()
