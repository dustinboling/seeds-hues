#!/usr/bin/env python3
"""Write crop sowing methods into seed-data/catalog.json (seeds-v2 brief #2).

Input: ~/workspace/seeds-hues/method-classification.json, prepared by Hue from the Floret
Library "Sowing & Growing Notes" text: { crops: { <plant-slug>: { name, methods, basis } } }.
Methods are crop-level: "direct_sow" (the notes offer direct seeding) and/or "transplant"
(start in plug trays / indoors, then transplant).

For every plant in the catalog:
  - methods present → sowingMethods: [...] in canonical order (direct_sow, transplant) and
    sowingMethodSource: "src-floret-library-sowing-notes";
  - no methods      → both keys removed (absent = not classified; never defaulted).

Idempotent: re-running with the same input produces the same file. Fails loudly on a plant
slug the catalog doesn't have, an unknown method, or a missing source row.
Usage: add-method-data.py [--write]   (dry-run by default)
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"
INPUT = ROOT.parent / "method-classification.json"
SOURCE_ID = "src-floret-library-sowing-notes"
METHOD_ORDER = ["direct_sow", "transplant"]


def with_key_after(d: dict, after: str, key: str, value) -> dict:
    """Copy of d with key=value placed right after `after` (or kept in place / appended)."""
    if key in d or after not in d:
        out = dict(d)
        out[key] = value
        return out
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == after:
            out[key] = value
    return out


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    crops = json.loads(INPUT.read_text())["crops"]

    if SOURCE_ID not in {s["id"] for s in data["sources"]}:
        raise SystemExit(f"catalog has no source row {SOURCE_ID}")
    plant_slugs = {p["slug"] for p in data["plants"]}
    unknown = sorted(set(crops) - plant_slugs)
    if unknown:
        raise SystemExit(f"method data names plants the catalog doesn't have: {', '.join(unknown)}")

    changed = 0
    tally: Counter = Counter()
    plants = []
    for p in data["plants"]:
        raw = crops.get(p["slug"], {}).get("methods", [])
        bad = sorted(set(raw) - set(METHOD_ORDER))
        if bad:
            raise SystemExit(f"plant {p['slug']}: unknown sowing method(s) {bad}")
        methods = [m for m in METHOD_ORDER if m in raw]
        before = json.dumps(p, sort_keys=True)
        q = {k: v for k, v in p.items() if k not in ("sowingMethods", "sowingMethodSource")}
        if methods:
            anchor = "seasonSource" if "seasonSource" in q else "sowingNotes"
            q = with_key_after(q, anchor, "sowingMethods", methods)
            q = with_key_after(q, "sowingMethods", "sowingMethodSource", SOURCE_ID)
            tally["+".join(methods)] += 1
        else:
            tally["(none)"] += 1
        if json.dumps(q, sort_keys=True) != before or list(q) != list(p):
            changed += 1
        plants.append(q)
    data["plants"] = plants

    print(f"plants: {len(plants)}  changed: {changed}")
    for k, n in sorted(tally.items()):
        print(f"  {k}: {n}")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode).
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
