#!/usr/bin/env python3
"""Write crop grower guides (life cycle, hardiness, growing, harvest, seed saving) into
seed-data/catalog.json (crop-page grower guide task).

Inputs, from ~/workspace/seeds-hues/seed-saving/:
  growing.json      { <plant-slug>: { sowing, germination, transplanting, days_to_bloom, spacing,
                      growing, harvest_for_cutting?, good_to_know?, life_cycle, hardiness } }
  instructions.json { <plant-slug>: { when_to_harvest, how_to_collect, cleaning, drying, storage,
                      pollination_notes, difficulty } }
SOURCES.md in the same folder is the internal provenance record; it is represented here by ONE
source row (SOURCE_ID) and is never displayed on the site.

For every plant in the catalog:
  - content present → lifeCycle / hardiness / growerGuide { growing?, seedSaving? } (only the
    fields the files give; absent fields stay absent, never filled in) and
    growerGuideSource: SOURCE_ID;
  - no content      → all four keys removed (except life cycle/hardiness written by
    add-classification-data.py, i.e. growerGuideSource = CLASSIFICATION_SOURCE_ID: kept).
good_to_know may be a string or a list in growing.json; it is stored as a list.

Slugs in SKIP (echinacea: not a catalog crop, no crop page) are skipped. Any other slug the
catalog doesn't have, or an unknown field, fails loudly.

Idempotent: re-running with the same input produces the same file.
Usage: add-grower-guide-data.py [--write]   (dry-run by default)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"
INPUT_DIR = ROOT.parent / "seed-saving"
GROWING = INPUT_DIR / "growing.json"
INSTRUCTIONS = INPUT_DIR / "instructions.json"
SKIP = {"echinacea"}
SOURCE_ID = "src-seed-saving-grower-notes"
# Plants whose life cycle/hardiness came from add-classification-data.py (and no guide content
# here) are left untouched, so re-running this script after that import keeps them.
CLASSIFICATION_SOURCE_ID = "src-seed-saving-classifications"
SOURCE_ROW = {
    "id": SOURCE_ID,
    "kind": "research",
    "label": "Grower guide and seed-saving notes compiled 2026-11-17 (seed-saving/SOURCES.md; internal record)",
    "url": None,
    "checkedDate": "2026-11-17",
    "access": "public",
}
GROWING_FIELDS = ["sowing", "germination", "transplanting", "days_to_bloom", "spacing", "growing", "harvest_for_cutting", "good_to_know"]
CROP_FIELDS = ["life_cycle", "hardiness"]
SEED_FIELDS = ["when_to_harvest", "how_to_collect", "cleaning", "drying", "storage", "pollination_notes", "difficulty"]
PLANT_KEYS = ("lifeCycle", "hardiness", "growerGuide", "growerGuideSource")


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


def guide_for(slug: str, g: dict | None, s: dict | None) -> list:
    items = []
    if g:
        bad = sorted(set(g) - set(GROWING_FIELDS) - set(CROP_FIELDS))
        if bad:
            raise SystemExit(f"growing.json {slug}: unknown field(s) {bad}")
        if "life_cycle" in g:
            items.append(("lifeCycle", text(g["life_cycle"], f"{slug}.life_cycle")))
        if "hardiness" in g:
            items.append(("hardiness", text(g["hardiness"], f"{slug}.hardiness")))
    guide = {}
    growing = {}
    for f in GROWING_FIELDS:
        if not g or f not in g:
            continue
        if f == "good_to_know":
            raw = g[f] if isinstance(g[f], list) else [g[f]]
            growing[f] = [text(x, f"{slug}.good_to_know") for x in raw]
        else:
            growing[f] = text(g[f], f"{slug}.{f}")
    if growing:
        guide["growing"] = growing
    if s:
        bad = sorted(set(s) - set(SEED_FIELDS))
        if bad:
            raise SystemExit(f"instructions.json {slug}: unknown field(s) {bad}")
        seed = {f: text(s[f], f"{slug}.{f}") for f in SEED_FIELDS if f in s}
        if seed:
            guide["seedSaving"] = seed
    if guide:
        items.append(("growerGuide", guide))
    if items:
        items.append(("growerGuideSource", SOURCE_ID))
    return items


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    growing = json.loads(GROWING.read_text())
    instructions = json.loads(INSTRUCTIONS.read_text())

    plant_slugs = {p["slug"] for p in data["plants"]}
    named = set(growing) | set(instructions)
    skipped = sorted(named & SKIP)
    unknown = sorted(named - SKIP - plant_slugs)
    if unknown:
        raise SystemExit(f"grower content names plants the catalog doesn't have: {', '.join(unknown)}")

    sources = [s for s in data["sources"] if s["id"] != SOURCE_ID]
    data["sources"] = sources + [SOURCE_ROW]

    changed = 0
    covered = []
    plants = []
    for p in data["plants"]:
        before = json.dumps(p)
        items = guide_for(p["slug"], growing.get(p["slug"]), instructions.get(p["slug"]))
        if not items and p.get("growerGuideSource") == CLASSIFICATION_SOURCE_ID:
            # Life cycle/hardiness written by add-classification-data.py: not this script's to remove.
            plants.append(p)
            continue
        q = {k: v for k, v in p.items() if k not in PLANT_KEYS}
        if items:
            anchor = next(k for k in ("sowingMethodSource", "seasonSource", "sowingNotes") if k in q)
            q = insert_after(q, anchor, items)
            covered.append(p["slug"])
        if json.dumps(q) != before:
            changed += 1
        plants.append(q)
    data["plants"] = plants

    print(f"plants: {len(plants)}  with grower content: {len(covered)}  changed: {changed}")
    print(f"  covered: {', '.join(covered)}")
    print(f"  skipped (not catalog crops): {', '.join(skipped) or '(none)'}")
    no_harvest = [s for s in covered if "harvest_for_cutting" not in growing.get(s, {})]
    print(f"  no harvest_for_cutting: {', '.join(no_harvest) or '(none)'}")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode).
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
