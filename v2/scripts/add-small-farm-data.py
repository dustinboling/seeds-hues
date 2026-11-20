#!/usr/bin/env python3
"""Write the "Small farm" badge judgment into seed-data/catalog.json (Open Directory, 2026-11-19).

Source of truth: ~/workspace/seeds-hues/open-directory/seller-classification.md — 20 BADGE slugs,
7 NO BADGE slugs (27 production sellers). The judgment is copied here verbatim as two lists so
this script never parses prose; if Dustin flips a call, edit seller-classification.md FIRST, then
this list, then re-run this script and the production backfill (scripts/apply-small-farm-badges.ts)
for that slug only.

The curated catalog carries 25 of the 27 production sellers (seedtime and davids-garden-seeds
reached production through the ingest path, not catalog.json), so this writes 18 true + 7 false.
Every catalog seller MUST appear in exactly one list — a seller with no recorded judgment fails
loudly instead of silently defaulting, because a full re-import (lib/catalog/importer.ts wipes
and re-inserts sellers) would otherwise reset that seller's badge.

For every seller in the catalog: isSmallFarm: true|false, placed right after isSiteOwner.
Idempotent. Usage: add-small-farm-data.py [--write]   (dry-run by default)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"

# seller-classification.md, "BADGE — small farms and small seed sellers (20)".
BADGE = [
    "3-porch-farm",
    "blomma-flower-farm",
    "dawn-creek-farm",
    "floret",
    "half-moons-farm",
    "hudson-valley-seed-co",
    "jig-bee-flower-farm",
    "millay-and-meadowlark-flower-farm",
    "peace-seedlings",
    "renees-garden",
    "prairie-moon-nursery",
    "seedtime",
    "select-seeds",
    "songbird-seed-co",
    "summertime-seed-co",
    "sunflower-selections",
    "sunflower-steve-seed-co",
    "the-gardeners-workshop",
    "three-brothers-blooms",
    "davids-garden-seeds",
]
# seller-classification.md, "NO BADGE — national catalogs, wholesale, and national-scale institutions (7)".
NO_BADGE = [
    "american-meadows",
    "botanical-interests",
    "great-basin-seed",
    "high-mowing-organic-seeds",
    "johnnys-selected-seeds",
    "seed-savers-exchange",
    "wild-west-seed",
]


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
    if len(BADGE) != 20 or len(set(BADGE)) != 20:
        raise SystemExit(f"BADGE list must hold 20 distinct slugs (has {len(BADGE)}, {len(set(BADGE))} distinct)")
    if len(NO_BADGE) != 7 or len(set(NO_BADGE)) != 7:
        raise SystemExit(f"NO_BADGE list must hold 7 distinct slugs (has {len(NO_BADGE)})")
    overlap = sorted(set(BADGE) & set(NO_BADGE))
    if overlap:
        raise SystemExit(f"slugs in both lists: {', '.join(overlap)}")

    data = json.loads(CATALOG.read_text())
    slugs = [s["slug"] for s in data["sellers"]]
    unjudged = sorted(set(slugs) - set(BADGE) - set(NO_BADGE))
    if unjudged:
        raise SystemExit(f"catalog sellers with no recorded judgment: {', '.join(unjudged)}")

    changed = 0
    badged = 0
    sellers = []
    for s in data["sellers"]:
        value = s["slug"] in BADGE
        before = list(s.items())
        q = {k: v for k, v in s.items() if k != "isSmallFarm"}
        q = with_key_after(q, "isSiteOwner", "isSmallFarm", value)
        badged += value
        if list(q.items()) != before:
            changed += 1
        sellers.append(q)
    data["sellers"] = sellers

    not_in_catalog = sorted(set(BADGE) - set(slugs))
    print(f"sellers: {len(sellers)}  isSmallFarm true: {badged}  false: {len(sellers) - badged}  changed: {changed}")
    print(f"badged slugs not in the curated catalog (production-only, set by the backfill): {', '.join(not_in_catalog) or 'none'}")
    if write:
        # Match the file's existing format (indent=2, unescaped Unicode).
        CATALOG.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
