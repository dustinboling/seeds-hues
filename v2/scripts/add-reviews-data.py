#!/usr/bin/env python3
"""Write imported seller ratings into seed-data/catalog.json (seeds-v2 brief #4).

Input: ~/workspace/seeds-hues/seller-reviews.json, prepared by Hue from the Google Places route:
{ <seller-slug>: { source, placeName, placeId, rating, reviewCount, fetchedDate } }.
The route exposes the aggregate rating and review count ONLY — there is no review text, and
none is ever written here.

For every seller in the catalog:
  - entry present → importedRating: { source, placeName, placeId, rating, reviewCount, fetchedDate }
    (placed after isSiteOwner);
  - absent        → importedRating: null.

This is a third-party aggregate, kept apart from our own rating (which stays "Not yet rated").
Idempotent; fails loudly on a seller slug the catalog doesn't have, a source other than
"Google", a rating outside 0–5, a negative / non-integer count, a bad date or an unknown key.
Usage: add-reviews-data.py [--write]   (dry-run by default)
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "seed-data" / "catalog.json"
INPUT = ROOT.parent / "seller-reviews.json"
SOURCES = {"Google"}
KEYS = ["source", "placeName", "placeId", "rating", "reviewCount", "fetchedDate"]


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


def checked(slug: str, r: dict) -> dict:
    if sorted(r) != sorted(KEYS):
        raise SystemExit(f"{slug}: keys {sorted(r)} ≠ {sorted(KEYS)}")
    if r["source"] not in SOURCES:
        raise SystemExit(f"{slug}: source {r['source']!r} not in {sorted(SOURCES)}")
    if not isinstance(r["rating"], (int, float)) or isinstance(r["rating"], bool) or not 0 <= r["rating"] <= 5:
        raise SystemExit(f"{slug}: rating {r['rating']!r} outside 0–5")
    if not isinstance(r["reviewCount"], int) or isinstance(r["reviewCount"], bool) or r["reviewCount"] < 0:
        raise SystemExit(f"{slug}: reviewCount {r['reviewCount']!r} is not a non-negative integer")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(r["fetchedDate"])):
        raise SystemExit(f"{slug}: fetchedDate {r['fetchedDate']!r} is not YYYY-MM-DD")
    for k in ("placeName", "placeId"):
        if not isinstance(r[k], str) or not r[k].strip():
            raise SystemExit(f"{slug}: {k} is empty")
    return {k: r[k] for k in KEYS}


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    reviews = json.loads(INPUT.read_text())

    seller_slugs = {s["slug"] for s in data["sellers"]}
    unknown = sorted(set(reviews) - seller_slugs)
    if unknown:
        raise SystemExit(f"review data names sellers the catalog doesn't have: {', '.join(unknown)}")

    changed = 0
    with_rating = 0
    sellers = []
    for s in data["sellers"]:
        raw = reviews.get(s["slug"])
        value = checked(s["slug"], raw) if raw is not None else None
        before = list(s.items())
        q = {k: v for k, v in s.items() if k != "importedRating"}
        q = with_key_after(q, "isSiteOwner", "importedRating", value)
        if value:
            with_rating += 1
            print(f"  {s['slug']}: {value['rating']} from {value['reviewCount']} ({value['source']}, {value['fetchedDate']})")
        if list(q.items()) != before:
            changed += 1
        sellers.append(q)
    data["sellers"] = sellers

    print(f"sellers: {len(sellers)}  with importedRating: {with_rating}  null: {len(sellers) - with_rating}  changed: {changed}")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode).
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
