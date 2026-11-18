#!/usr/bin/env python3
"""Append The Gardener's Workshop to seed-data/catalog.json.

Owner nomination (Dustin, 2026-11-16) — the business is NOT on Floret's
Favorite Seed Sources list. Verified 2026-11-16 from its own site
(https://thegardenersworkshop.com): family-run business in Newport News, VA;
what began as Lisa Mason Ziegler's small urban flower farm now offers seeds,
tools and courses; seed is sold through its "Cut Flower Seeds" shop at
/collections/seeds (Shopify). The seller model's only storefront field is
`homepage`, so it carries the Seeds shop URL.

Seller record ONLY: termsReviewedAt null; rating state is the schema default
("Not yet rated"). No listings, prices or varieties are created.

Idempotent: skipped if the slug or domain is already present.
Usage: add-gardeners-workshop.py [--write]   (dry-run by default)
"""
import json
import sys
from pathlib import Path

CATALOG = Path(__file__).resolve().parent.parent / "seed-data" / "catalog.json"

SELLER = {
    "slug": "the-gardeners-workshop",
    "name": "The Gardener's Workshop",
    "type": "specialty",
    "homepage": "https://thegardenersworkshop.com/collections/seeds",
    "location": "Newport News, VA",
    "provenance": "owner-named",
    "description": (
        "Lisa Mason Ziegler's family-run business in Newport News, Virginia: what began as a "
        "small urban flower farm grew into an online shop offering seeds, tools and expert-led "
        "courses for home and professional cut-flower growers."
    ),
    "orderingNotes": "Standing online shop; the seed storefront is its Cut Flower Seeds collection.",
    "platform": "shopify",
    "listingPolicy": "full",
    "status": "active",
    "eligibility": "approved",
    "approvedAt": "2026-11-16",
    "termsReviewedAt": None,
    "approvalNote": (
        "Nominated by the owner on 2026-11-16. Verified the same day from the business's own "
        "site: family-run, Newport News, VA, selling seed through its Cut Flower Seeds shop. "
        "Not on Floret's Favorite Seed Sources list. Terms not yet reviewed (termsReviewedAt "
        "null); crawlPolicy manual_only until they are. No listings until the evidence-based "
        "ingester verifies them."
    ),
    "domain": "thegardenersworkshop.com",
    "crawlPolicy": "manual_only",
    "claimStatus": "unclaimed",
    "country": "US",
    "region": "VA",
    "shipsTo": ["unknown"],
    "isSiteOwner": False,
}


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    if SELLER["slug"] in {s["slug"] for s in data["sellers"]} or SELLER["domain"] in {s["domain"] for s in data["sellers"]}:
        print("already present — skipped")
        return 0
    data["sellers"].append(SELLER)
    print(f"sellers {len(data['sellers']) - 1} -> {len(data['sellers'])} (added {SELLER['slug']})")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode) so the diff stays append-only.
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
