#!/usr/bin/env python3
"""Write crop life cycle + hardiness from classifications.json into seed-data/catalog.json
(life-cycle filter task). Same storage as the grower guide task: plants[].lifeCycle /
hardiness with growerGuideSource naming where they came from (internal, never displayed).

Input, from ~/workspace/seeds-hues/seed-saving/:
  classifications.json  { <plant-slug>: { life_cycle, hardiness } }  (all 93 catalog crops)
The 2026-11-18 cross-check against the catalog's own varieties (CROSS-CHECK-2026-11-18.md in
the same folder) is applied here, in OVERRIDES and HOLD below; the input file is never edited.

For every plant in the catalog:
  - a guide crop (GUIDE_CROPS: life cycle/hardiness already come from growing.json via
    add-grower-guide-data.py, which is canonical for them) → left exactly as it is;
  - HOLD → no life cycle/hardiness at all (any earlier classification removed);
  - otherwise → lifeCycle / hardiness from classifications.json, with OVERRIDES applied (an
    override replaces the whole entry; a field it omits is absent, never filled in), and
    growerGuideSource: SOURCE_ID.

Run order: add-grower-guide-data.py first, then this script (the guide script leaves the
crops this script classified alone). Any slug the catalog doesn't have, a catalog crop the file
is missing, or an unknown field fails loudly.

Idempotent: re-running with the same input produces the same file.
Usage: add-classification-data.py [--write]   (dry-run by default)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"
INPUT = ROOT.parent / "seed-saving" / "classifications.json"
SOURCE_ID = "src-seed-saving-classifications"
SOURCE_ROW = {
    "id": SOURCE_ID,
    "kind": "research",
    "label": "Crop life-cycle classifications compiled 2026-11-18, cross-checked against the catalog's varieties (seed-saving/classifications.json + CROSS-CHECK-2026-11-18.md; internal record)",
    "url": None,
    "checkedDate": "2026-11-18",
    "access": "public",
}
GUIDE_SOURCE_ID = "src-seed-saving-grower-notes"
GUIDE_CROPS = {
    "breadseed-poppy", "calendula", "celosia", "cornflower", "cosmos", "larkspur", "marigold",
    "nigella", "pincushion-flower", "strawflower", "sunflower", "sweet-pea", "zinnia",
}

# Corrections from the cross-check: the file's entry describes a different species than the
# catalog's varieties. Each replaces the file's entry for that crop entirely.
OVERRIDES = {
    # File: Perennial, Zones 4-9 (Monarda didyma). Catalog's 'Bergamo' + 'Lambada' are annual
    # lemon bee balm (M. citriodora types).
    "bee-balm": {"life_cycle": "Annual", "hardiness": "Annual — grown in a single season."},
    # File: Annual (S. viridis). Catalog's only variety 'Rose Queen' is a perennial S. nemorosa
    # type. No sourced zone range, so no hardiness (the header fact shows "Perennial" alone).
    "salvia": {"life_cycle": "Perennial"},
    # File: Biennial or short-lived perennial (S. sclarea). Catalog's only variety
    # 'Tricolor Mix' is a hardy annual (S. viridis type).
    "clary-sage": {"life_cycle": "Hardy annual", "hardiness": "Annual — a cool-season flower; sow in fall or early spring."},
}

# Held: the crop's varieties differ in life cycle, so no single crop-level value is true. No
# header fact; never matches the life-cycle filter.
HOLD = {
    # 'Beauty Pink' is the annual S. vaccaria type; 'Graciella White' is perennial S. officinalis.
    "soapwort",
    # Feathertop is a tender perennial grown as an annual; Quaking Grass is a true perennial.
    "ornamental-grass",
}

FIELDS = ("life_cycle", "hardiness")
PLANT_KEYS = ("lifeCycle", "hardiness", "growerGuideSource")


def text(v, where: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise SystemExit(f"{where}: expected non-empty text, got {v!r}")
    return v.strip()


def insert_after(d: dict, after: str, items: list) -> dict:
    """Copy of d with items (key, value) placed right after `after` (appended if absent)."""
    if after not in d:
        return {**d, **dict(items)}
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == after:
            out.update(items)
    return out


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    classes = json.loads(INPUT.read_text())

    plant_slugs = {p["slug"] for p in data["plants"]}
    unknown = sorted(set(classes) - plant_slugs)
    missing = sorted(plant_slugs - set(classes))
    if unknown:
        raise SystemExit(f"classifications.json names plants the catalog doesn't have: {', '.join(unknown)}")
    if missing:
        raise SystemExit(f"classifications.json is missing catalog crops: {', '.join(missing)}")
    for name, slugs in (("OVERRIDES", set(OVERRIDES)), ("HOLD", HOLD), ("GUIDE_CROPS", GUIDE_CROPS)):
        if slugs - plant_slugs:
            raise SystemExit(f"{name} names plants the catalog doesn't have: {', '.join(sorted(slugs - plant_slugs))}")
    for slug, entry in classes.items():
        bad = sorted(set(entry) - set(FIELDS))
        if bad:
            raise SystemExit(f"classifications.json {slug}: unknown field(s) {bad}")

    sources = [s for s in data["sources"] if s["id"] != SOURCE_ID]
    data["sources"] = sources + [SOURCE_ROW]

    changed = 0
    classified, overridden, held = [], [], []
    plants = []
    for p in data["plants"]:
        slug = p["slug"]
        before = json.dumps(p)
        if slug in GUIDE_CROPS:
            if p.get("growerGuideSource") != GUIDE_SOURCE_ID or "lifeCycle" not in p:
                raise SystemExit(f"{slug}: expected grower-guide life cycle (run add-grower-guide-data.py first)")
            plants.append(p)
            continue
        if p.get("growerGuideSource") not in (None, SOURCE_ID):
            raise SystemExit(f"{slug}: carries other grower content ({p['growerGuideSource']}); not overwriting")
        q = {k: v for k, v in p.items() if k not in PLANT_KEYS}
        if slug in HOLD:
            held.append(slug)
        else:
            entry = OVERRIDES.get(slug, classes[slug])
            if slug in OVERRIDES:
                overridden.append(slug)
            items = []
            if "life_cycle" in entry:
                items.append(("lifeCycle", text(entry["life_cycle"], f"{slug}.life_cycle")))
            if "hardiness" in entry:
                items.append(("hardiness", text(entry["hardiness"], f"{slug}.hardiness")))
            if items:
                items.append(("growerGuideSource", SOURCE_ID))
                anchor = next(k for k in ("sowingMethodSource", "seasonSource", "sowingNotes") if k in q)
                q = insert_after(q, anchor, items)
                classified.append(slug)
        if json.dumps(q) != before:
            changed += 1
        plants.append(q)
    data["plants"] = plants

    print(f"plants: {len(plants)}  guide crops kept: {len(GUIDE_CROPS)}  newly classified: {len(classified)}  changed: {changed}")
    print(f"  overridden: {', '.join(overridden)}")
    print(f"  held: {', '.join(held)}")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode).
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
