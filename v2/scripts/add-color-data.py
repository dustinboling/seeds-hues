#!/usr/bin/env python3
"""Write variety colour families into seed-data/catalog.json (seeds-v2 brief #2, "Hue").

Input: ~/workspace/seeds-hues/variety-colors.json, prepared by Hue:
{ <variety-slug>: { family, basis, source } } — the family is read from the variety's
Floret Library description (or the catalog description) colour words.

For every variety in the catalog:
  - family present → colorFamily: "<family>" (placed after colorSwatch);
  - absent         → key removed (the importer then stores 'unknown' — never guessed).

The vocabulary must match COLOR_FAMILIES in lib/validators/index.ts (the 12 families + "mix";
"unknown" is never written — absence means unknown). Idempotent; fails loudly on a variety slug
the catalog doesn't have or a family outside the vocabulary.
Usage: add-color-data.py [--write]   (dry-run by default)
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"
INPUT = ROOT.parent / "variety-colors.json"
COLOR_FAMILIES = {
    "white", "blush", "pink", "peach", "orange", "yellow", "red",
    "burgundy", "purple", "blue", "green", "chocolate", "mix",
}


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
    colors = json.loads(INPUT.read_text())

    variety_slugs = {v["slug"] for v in data["varieties"]}
    unknown = sorted(set(colors) - variety_slugs)
    if unknown:
        raise SystemExit(f"colour data names varieties the catalog doesn't have: {', '.join(unknown[:20])}")
    bad = sorted({c["family"] for c in colors.values()} - COLOR_FAMILIES)
    if bad:
        raise SystemExit(f"colour families outside the vocabulary: {bad}")

    changed = 0
    tally: Counter = Counter()
    varieties = []
    for v in data["varieties"]:
        family = colors.get(v["slug"], {}).get("family")
        before = list(v.items())
        q = {k: val for k, val in v.items() if k != "colorFamily"}
        if family:
            q = with_key_after(q, "colorSwatch", "colorFamily", family)
        tally[family or "(absent → unknown)"] += 1
        if list(q.items()) != before:
            changed += 1
        varieties.append(q)
    data["varieties"] = varieties

    print(f"varieties: {len(varieties)}  changed: {changed}")
    for k, n in tally.most_common():
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
