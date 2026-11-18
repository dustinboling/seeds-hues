#!/usr/bin/env python3
"""Append the Floret "Favorite Seed Sources" sellers to seed-data/catalog.json.

Owner direction (Dustin, 2026-11-16): add ALL the farms listed on Floret's
Favorite Seed Sources page — the 9 candidates in FLORET-SEED-SOURCES.md section B
and the 8 borderline in section C — plus Johnny's Selected Seeds (section D) by
Dustin's explicit ruling of the same day (Johnny's ONLY; Territorial Seed and
Ball stay excluded). Section E (international / not seed sellers) stays out:
US sellers only at launch.

Seller records ONLY: name, location and website exactly as recorded in
FLORET-SEED-SOURCES.md; source attribution in approvalNote; termsReviewedAt
null; rating state is the schema default ("Not yet rated"). No listings,
prices, varieties or ratings are created — variety listings come later through
the evidence-based ingester.

Idempotent: sellers whose slug or domain is already in the catalog are skipped.
Usage: add-floret-source-sellers.py [--write]   (dry-run by default)
"""
import json
import sys
from pathlib import Path

CATALOG = Path(__file__).resolve().parent.parent / "seed-data" / "catalog.json"
APPROVED_AT = "2026-11-16"

SOURCE_ROW = {
    "id": "src-floret-favorite-seed-sources",
    "kind": "research",
    "label": "Floret — Favorite Specialty Seed Sources (seller list extracted 2026-11-16; FLORET-SEED-SOURCES.md)",
    "url": "https://www.floretflowers.com/favorite-seed-sources/",
    "checkedDate": "2026-11-16",
    "access": "public",
}

NOTE_BC = (
    "Added 2026-11-16 at the owner's direction to add every farm on Floret's Favorite Seed "
    "Sources list (the per-seller approval gate was lifted for this list). Source: Floret's "
    "'Favorite Specialty Seed Sources' (FLORET-SEED-SOURCES.md §B/§C), extracted 2026-11-16. "
    "Terms not yet reviewed (termsReviewedAt null); crawlPolicy manual_only until they are. "
    "No listings until the evidence-based ingester verifies them."
)
NOTE_JOHNNYS = (
    "Added 2026-11-16 by the owner's explicit ruling approving Johnny's Selected Seeds as a "
    "seller — an exception to the standing large-seed-house exclusion, for Johnny's only "
    "(Territorial Seed Co. and Ball remain excluded). Source: Floret's 'Favorite Specialty "
    "Seed Sources' (FLORET-SEED-SOURCES.md §D), extracted 2026-11-16. Terms not yet reviewed "
    "(termsReviewedAt null); crawlPolicy manual_only until they are. No listings until the "
    "evidence-based ingester verifies them."
)


def seller(slug, name, type_, domain, location, region, description, ordering_notes, note=NOTE_BC):
    return {
        "slug": slug,
        "name": name,
        "type": type_,
        "homepage": f"https://www.{domain}",
        "location": location,
        "provenance": "research-candidate",
        "description": description,
        "orderingNotes": ordering_notes,
        "platform": None,
        "listingPolicy": "full",
        "status": "active",
        "eligibility": "approved",
        "approvedAt": APPROVED_AT,
        "termsReviewedAt": None,
        "approvalNote": note,
        "domain": domain,
        "crawlPolicy": "manual_only",
        "claimStatus": "unclaimed",
        "country": "US",
        "region": region,
        "shipsTo": ["unknown"],
        "isSiteOwner": False,
    }


NEW_SELLERS = [
    # ── Section B: new candidates (9) ──────────────────────────────────────
    seller(
        "3-porch-farm", "3 Porch Farm", "specialty", "3porchfarm.com", "Northern Georgia", "GA",
        "Mandy and Steve O'Shea's Northern Georgia flower farm, with a beautiful cut flower seed "
        "selection alongside heirloom chrysanthemum plants and fresh cuts, and deep sustainability practices.",
        "Standing shop; also sells heirloom chrysanthemum plants in spring and fresh cut flowers.",
    ),
    seller(
        "blomma-flower-farm", "Blomma Flower Farm", "specialty", "blommaflowerfarm.com", "Nevada", "NV",
        "Tiffany Jones's Nevada flower farm, breeding zinnias in soft pastels and unique forms.",
        "Episodic — seed is offered in limited quantities through a yearly fundraiser; newsletter signup needed for availability.",
    ),
    seller(
        "half-moons-farm", "Half Moon's Farm", "specialty", "halfmoonsfarm.com", "Ferndale, WA", "WA",
        "Brianne Handforth's small seed company in Ferndale, Washington: an online shop of "
        "tried-and-true varieties suited to floral design and wedding work, with sweet peas a specialty.",
        "Standing online shop; the farm also grows cut flowers for subscriptions and wholesale.",
    ),
    seller(
        "jig-bee-flower-farm", "Jig-Bee Flower Farm", "specialty", "jig-bee.com", "Corinth, VT", "VT",
        "Cassie Plummer's flower farm in Corinth, Vermont, selling seed through its online shop "
        "with a focus on cold-climate varieties; a budding plant breeder with new varieties in the works.",
        "Standing online shop; the farm also grows fresh cut flowers.",
    ),
    seller(
        "millay-and-meadowlark-flower-farm", "Millay & Meadowlark Flower Farm", "specialty",
        "millayandmeadowlark.com", "Outside Missoula, MT", "MT",
        "Jennifer Barnard's flower farm outside Missoula, Montana (weddings, events, CSA and "
        "wholesale), which also sells sweet pea seed — tried-and-true plus harder-to-find varieties.",
        "Seed is a side line of a working flower farm; standing availability.",
    ),
    seller(
        "peace-seedlings", "Peace Seedlings", "specialty", "peaceseedlingsseeds.blogspot.com",
        "Willamette Valley, OR", "OR",
        "Willamette Valley seed breeders breeding for diversity rather than uniformity — unusual "
        "treasures including psychedelic zinnia mixes. The blog is the catalog.",
        "Mail-order only — orders are a handwritten list mailed in with a check or cash; there is no online shop.",
    ),
    seller(
        "summertime-seed-co", "Summertime Seed Co.", "specialty", "summertimeseed.com",
        "Willamette Valley, OR", "OR",
        "Sebastian and Kelly's certified organic Willamette Valley farm, growing diverse herb, "
        "vegetable and flower seed including a nice cut flower selection, with a handful of new introductions each year.",
        "Standing shop.",
    ),
    seller(
        "sunflower-selections", "Sunflower Selections", "specialty", "sunflowerselections.com",
        None, None,
        "Dr. Tom Heaton, world-renowned sunflower breeder and geneticist — creator of the ProCut "
        "and Starburst series and the vast majority of ornamental sunflowers on the market — selling breeder-direct.",
        "Standing retail shop, small and large quantities, sortable by color, type and height.",
    ),
    seller(
        "three-brothers-blooms", "Three Brothers Blooms", "specialty", "threebrothersblooms.com",
        None, None,
        "Brenna Estrada's specialty pansy and viola seed shop; the seed is sourced directly from "
        "the Faraone Mennella family, who hybridize the pansies in Italy.",
        "Standing online shop; newsletter announces availability.",
    ),
    # ── Section C: borderline, added by the same direction (8) ─────────────
    seller(
        "american-meadows", "American Meadows", "retail", "americanmeadows.com",
        "Champlain Valley, VT", "VT",
        "Independent Vermont company with a massive selection of wildflower seed and deep "
        "climate and variety guidance; Floret used their seed for its own meadow planting.",
        "Standing national mail-order shop.",
    ),
    seller(
        "botanical-interests", "Botanical Interests", "retail", "botanicalinterests.com",
        "Colorado", "CO",
        "Long-standing independent Colorado seed company known for its packet art and a strong "
        "heirloom flower range, with national retail distribution.",
        "Standing shop; packets are also sold in garden centers nationally.",
    ),
    seller(
        "great-basin-seed", "Great Basin Seed", "wholesale", "greatbasinseeds.com", "Utah", "UT",
        "Family-owned and -operated Utah seed company, one of the first in land-reclamation "
        "seed; grasses, grains, natives and cover crops at bulk and restoration scale.",
        "Sells direct and by print catalog; bulk and wholesale orientation.",
    ),
    seller(
        "high-mowing-organic-seeds", "High Mowing Organic Seeds", "retail", "highmowingseeds.com",
        "Vermont", "VT",
        "Vermont organic seed company with farm-based trials and an heirloom and open-pollinated "
        "focus, selling a wide commercial catalog nationally.",
        "Standing national shop.",
    ),
    seller(
        "prairie-moon-nursery", "Prairie Moon Nursery", "retail", "prairiemoon.com",
        "Minnesota", "MN",
        "Independent Minnesota specialist in wildflower and meadow seed tailored by soil and "
        "pollinator, sold direct alongside plants; the largest native plant collection in the U.S. available to retail.",
        "Standing shop; sells seed and plants.",
    ),
    seller(
        "renees-garden", "Renee's Garden", "retail", "reneesgarden.com", "California", "CA",
        "Independent, founder-led California seed company beloved for its flower and vegetable mixes.",
        "Standing shop; packets are also sold in garden centers nationally.",
    ),
    seller(
        "seed-savers-exchange", "Seed Savers Exchange", "retail", "seedsavers.org", "Iowa", "IA",
        "Nonprofit heirloom seed stewardship organization in Iowa; much of its Exchange is "
        "small home growers offering varieties for a low fee.",
        "Standing shop and member Exchange.",
    ),
    seller(
        "select-seeds", "Select Seeds", "retail", "selectseeds.com", "Connecticut (Union)", "CT",
        "Connecticut mail-order seed house specialising in heirloom and fragrant old-fashioned "
        "flowers you can't find anywhere else, including imported European seed lines.",
        "Standing mail-order shop.",
    ),
    # ── Section D: Johnny's only, by Dustin's explicit ruling (1) ──────────
    seller(
        "johnnys-selected-seeds", "Johnny's Selected Seeds", "retail", "johnnyseeds.com",
        None, None,
        "A large national seed house — Floret's most effusive endorsement on its Favorite Seed "
        "Sources page — listed in this directory by the site owner's explicit decision.",
        None,
        note=NOTE_JOHNNYS,
    ),
]


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(CATALOG.read_text())
    existing_slugs = {s["slug"] for s in data["sellers"]}
    existing_domains = {s["domain"] for s in data["sellers"]}
    added, skipped = [], []
    for s in NEW_SELLERS:
        if s["slug"] in existing_slugs or s["domain"] in existing_domains:
            skipped.append(s["slug"])
            continue
        data["sellers"].append(s)
        added.append(s["slug"])
    source_added = False
    if SOURCE_ROW["id"] not in {src["id"] for src in data["sources"]}:
        data["sources"].append(SOURCE_ROW)
        source_added = True
    print(f"sellers before: {len(existing_slugs)}  added: {len(added)}  skipped(dupes): {len(skipped)}")
    print("added:", ", ".join(added) if added else "(none)")
    if skipped:
        print("skipped:", ", ".join(skipped))
    print("source row added:", source_added)
    print(f"sellers after: {len(data['sellers'])}")
    if write:
        # Match the file's existing format (indent=1, unescaped Unicode) so the diff stays append-only.
        CATALOG.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")
        print("WROTE", CATALOG)
    else:
        print("dry-run — pass --write to save")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
