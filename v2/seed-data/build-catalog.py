#!/usr/bin/env python3
"""Build v2/seed-data/catalog.json from verified project sources ONLY.

Sources:
- v1 app/data/varieties.json (variety enumeration + facts; seller mentions scrubbed)
- ~/workspace/seed-sourcing/sweet-pea-variety-checks.md (checked 2026-11-13 / 2026-11-15)
- SELLER-SEED-LIST.md (owner-named sellers, 2026-11-15)
- research report 2026-11-16 (small seed farms sweep; candidate sellers + named varieties)

No prices, packet sizes, or listings beyond what those files state.

CANONICAL SPEC (SPEC-CANONICAL.md, adopted 2026-11-16, decision 25): the 20 research
candidates are OUT of the launch dataset, and sellers at launch are the six owner-named
exemplars only. The candidate and sourcing-check seller definitions below are KEPT in
this file as research records but are filtered out at emit time (see LAUNCH FILTER);
their listings are filtered with them. Varieties stay: the catalog is a union and a
variety page may launch with zero sellers (spec §1/§2; zero-seller pages are noindex).

WARNING (2026-11-16): catalog.json no longer comes from this script alone. After this
script's output, scripts/import-floret-names.ts merged in the Floret Library name
enumeration (551 varieties / 74 crops). Re-running this script regenerates the
pre-Floret file — re-run the Floret merge afterwards (it is idempotent) and expect
619 varieties / 93 plants.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # ~/workspace/seeds-hues
v1 = json.loads((ROOT / "app/data/varieties.json").read_text())

EXCLUDED = ["ball seed", "geoseed", "johnny", "park seed", "baker creek", "everwilde",
            "reimer", "onings", "silver falls", "todd's", "todds seeds"]

def scrub(text):
    if not text:
        return text
    text = text.replace(" in the GeoSeed catalog", "")
    text = text.replace("GeoSeed catalog", "catalog")
    return text

# v1 descriptions that embedded large-company sourcing notes: rewritten to keep only
# the variety facts (seller names, their prices and their availability claims removed).
DESC_OVERRIDES = {
    "snapdragon-toulon-mix": (
        "Group IV tall snapdragon (32\u201340\") with solid spikes on sturdy stems. "
        "Named replacement for the discontinued Costa Summer series. Well suited to "
        "greenhouse, tunnel, or open ground production."),
    "sweet-pea-mammoth-mix": (
        "Sweet pea mix; approximately 300 seeds per ounce. A practical choice for "
        "large-scale plantings where a named Spencer variety is not required."),
    "iceland-poppy-champagne-bubbles-mix": (
        "F1 hybrid Iceland poppy, 15\", with uniform timing, sturdy stems, and large "
        "flowers. Primed seed for reliable germination. Available in single colours "
        "(Orange, Pink, Scarlet, White, Yellow) and mix."),
    "virginia-stock": (
        "Low-growing front-of-border filler with fragrant small flowers."),
    "breadseed-poppy": (
        "Classic ornamental and culinary poppy with large, showy flowers and "
        "ornamental seedpods useful in dried arrangements."),
}

# ---------------------------------------------------------------- plants
PLANTS = [
    # slug, common, latin
    ("stock", "Stock", "Matthiola incana"),
    ("snapdragon", "Snapdragon", "Antirrhinum majus"),
    ("larkspur", "Larkspur", "Consolida ajacis"),
    ("cornflower", "Cornflower / Bachelor's Buttons", "Centaurea cyanus"),
    ("nigella", "Nigella / Love-in-a-Mist", "Nigella damascena"),
    ("calendula", "Calendula", "Calendula officinalis"),
    ("sweet-pea", "Sweet Pea", "Lathyrus odoratus"),
    ("iceland-poppy", "Iceland Poppy", "Papaver nudicaule"),
    ("shirley-poppy", "Shirley Poppy", "Papaver rhoeas"),
    ("virginia-stock", "Virginia Stock", "Malcolmia maritima"),
    ("breadseed-poppy", "Breadseed Poppy", "Papaver somniferum"),
    ("zinnia", "Zinnia", "Zinnia elegans"),
    ("sunflower", "Sunflower", "Helianthus annuus"),
    ("dahlia", "Dahlia", "Dahlia \u00d7 hybrida"),
    ("celosia", "Celosia", "Celosia argentea"),
    ("cosmos", "Cosmos", "Cosmos bipinnatus"),
    ("gomphrena", "Gomphrena", "Gomphrena globosa"),
    ("rudbeckia", "Rudbeckia", "Rudbeckia hirta"),
    ("strawflower", "Strawflower", "Xerochrysum bracteatum"),
]
plants = [{"slug": s, "commonName": c, "latinName": l, "category": "flowers",
           "description": None, "sowingNotes": None} for s, c, l in PLANTS]
LATIN2PLANT = {l: s for s, c, l in PLANTS}

# ---------------------------------------------------------------- varieties
varieties = []
for v in v1:
    varieties.append({
        "slug": v["id"], "plant": LATIN2PLANT[v["latinName"]],
        "varietyName": v["varietyName"], "subcategory": v.get("subcategory"),
        "description": DESC_OVERRIDES.get(v["id"], scrub(v.get("description"))),
        "sowingNotes": scrub(v.get("sowingNotes")),
        "heightCm": v.get("heightCm"), "colorSwatch": v.get("colorSwatch"),
        "tags": v.get("tags", []), "protection": "unknown", "protectionNote": None,
        "sourceId": "src-v1-varieties", "series": None,
    })

def V(slug, plant, name, sub="annual", desc=None, tags=("cut-flower",), source="src-research-2026-11-16", series=None):
    varieties.append({
        "slug": slug, "plant": plant, "varietyName": name, "subcategory": sub,
        "description": desc, "sowingNotes": None, "heightCm": None, "colorSwatch": None,
        "tags": list(tags), "protection": "unknown", "protectionNote": None,
        "sourceId": source, "series": series,
    })

SP = "sweet-pea"; CLIMB = "annual-climber"
V("sweet-pea-kings-ransom", SP, "King's Ransom", CLIMB,
  "Spencer exhibition sweet pea, introduced in 2021 by breeder Andrew Beane; fragrance rated 3/5 in Hues' source check.",
  ("cut-flower", "fragrant"), "src-sweetpea-checks")
V("sweet-pea-clementine-kiss", SP, "Clementine Kiss", CLIMB,
  "Matthewman's sweet pea, described in sources as the first true orange sweet pea (2011).",
  ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-emma", SP, "Emma", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-wild-swan", SP, "Wild Swan", CLIMB,
  "Pure white Spencer sweet pea bred by Hammett.", ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-bix", SP, "Bix", CLIMB,
  "Large picotee blooms; Hammett-bred.", ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-susan-burgess", SP, "Susan Burgess", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-blue-shift", SP, "Blue Shift", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-gerry-cullinan", SP, "Gerry Cullinan", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-raspberry-flake", SP, "Raspberry Flake", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-alison", SP, "Alison", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-shell-pink", SP, "Shell Pink", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-juliet", SP, "Juliet", CLIMB, None, ("cut-flower",), "src-sweetpea-checks")
V("sweet-pea-castle-wellan", SP, "Castle Wellan", CLIMB, None)
V("sweet-pea-oban-bay", SP, "Oban Bay", CLIMB, None)
V("sweet-pea-spring-sunshine-burgundy", SP, "Spring Sunshine Burgundy", CLIMB, None)
V("sweet-pea-mollie-rilstone", SP, "Mollie Rilstone", CLIMB, None)
V("sweet-pea-cosmic-kitty-mix", SP, "Cosmic Kitty Mix", CLIMB, None)
V("sweet-pea-dark-matter-mix", SP, "Dark Matter Mix", CLIMB, None)
V("sweet-pea-luminosity-mix", SP, "Luminosity Mix", CLIMB, None)

DEAREST = ("Part of Basket of Flowers Farm's 'Dearest' series, bred on the farm from "
           "open-pollinated zinnias saved from its U-Pick field in 2021.")
for slug, name in [("zinnia-dearest-joanna-lavender-frost", "Dearest Joanna Lavender Frost"),
                   ("zinnia-dearest-bubblegum", "Dearest Bubblegum"),
                   ("zinnia-dearest-sunset", "Dearest Sunset"),
                   ("zinnia-dearest-kaleidoscope", "Dearest Kaleidoscope"),
                   ("zinnia-dearest-orange-creamsicle", "Dearest Orange Creamsicle"),
                   ("zinnia-dearest-ellie", "Dearest Ellie"),
                   ("zinnia-dearest-tabita", "Dearest Tabita")]:
    V(slug, "zinnia", name, "annual", DEAREST, series="Dearest")
DC = "A Dawn Creek Farm zinnia selection bred by Kori Hargreaves, sold through Floret."
for slug, name in [("zinnia-dawn-creek-pastels", "Dawn Creek Pastels"),
                   ("zinnia-dawn-creek-honey", "Dawn Creek Honey"),
                   ("zinnia-dawn-creek-blush", "Dawn Creek Blush"),
                   ("zinnia-dawn-creek-peach", "Dawn Creek Peach")]:
    V(slug, "zinnia", name, "annual", DC, ("cut-flower",), "src-seller-list")
V("zinnia-gift", "zinnia", "Gift Zinnia", "annual",
  "Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line.", ("cut-flower",), "src-seller-list")
V("zinnia-karens-fave-color-mix", "zinnia", "Karen's Fave Color Mix", "annual",
  "Farm-original zinnia mix from Wild Garden Seed's on-farm breeding program.")
V("sunflower-van-goghs-fantasy", "sunflower", "Van Gogh's Fantasy", "annual",
  "Bred by Steve Kaufer and sold by Sunflower Steve Seed Co.", ("cut-flower",), "src-seller-list")
V("sunflower-better-off-red", "sunflower", "Better Off Red", "annual",
  "Farm-bred sunflower from Adaptive Seeds.")
V("sunflower-mountainlily-mixed", "sunflower", "Mixed Sunflowers", "annual",
  "A hand-cleaned mix of the sunflower varieties grown at Mountainlily Farm \u2014 including Velvet Queen, "
  "Lemon Queen, Valentine, Tarahumara, Autumn Beauty and Earthwalker, per the farm's product page.")
V("snapdragon-rembrandt", "snapdragon", "Rembrandt", "annual",
  "Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line.", ("cut-flower",), "src-seller-list")
V("snapdragon-black-prince", "snapdragon", "Black Prince", "annual", None)
V("snapdragon-defiant-mix", "snapdragon", "Defiant Mix", "annual", None)
V("snapdragon-orange-wonder", "snapdragon", "Orange Wonder", "annual", None)
V("shirley-poppy-mother-of-pearl", "shirley-poppy", "Mother of Pearl", "annual",
  "Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line.", ("cut-flower",), "src-seller-list")
DAH = "Dahlia seed harvested from the seller's own dahlia fields."
V("dahlia-seed-premium-pollinator-mix", "dahlia", "Premium Pollinator Mix", "annual", DAH)
V("dahlia-seed-coseytown-honey-pot-mix", "dahlia", "Coseytown Honey Pot Mix", "annual", DAH)
V("dahlia-seed-paulas-field-mix", "dahlia", "Dahlia Seed Mix", "annual",
  "Seed saved from Paula Fisher's own dahlia field; packets of 30 seed from a mix of fully-double cultivars, hand-processed.")
SH = "Hand-harvested from open-pollinated Stone Hollow Farmstead dahlias; seed sold by parent line."
V("dahlia-seed-mixed-parent", "dahlia", "Mixed Parent", "annual", SH)
V("dahlia-seed-miss-amara", "dahlia", "Miss Amara", "annual", SH)
V("dahlia-seed-aa-giant-flowered", "dahlia", "AA (Giant-Flowered)", "annual", SH)
V("dahlia-seed-collarette", "dahlia", "Collarette", "annual", SH)
V("celosia-xantippe", "celosia", "Xantippe", "annual", None)
V("celosia-pink-lemonade", "celosia", "Pink Lemonade", "annual",
  "Celosia introduced by PepperHarrow Farm in 2025.")
V("cosmos-diablo", "cosmos", "Diablo", "annual", None)
V("cosmos-sea-shells", "cosmos", "Sea Shells", "annual", None)
V("gomphrena-audray-pink", "gomphrena", "Audray Pink", "annual", None)
V("rudbeckia-tall-dark-sahara", "rudbeckia", "Tall Dark Sahara", "perennial",
  "Farm-original rudbeckia from Wild Garden Seed's on-farm breeding program.")
V("strawflower-firefly", "strawflower", "Firefly", "annual",
  "Farm-selected strawflower from Adaptive Seeds.")

# ---------------------------------------------------------------- sellers
def S(slug, name, typ, home, loc, prov, desc, notes=None, platform=None):
    return {"slug": slug, "name": name, "type": typ, "homepage": home, "location": loc,
            "provenance": prov, "description": desc, "orderingNotes": notes,
            "platform": platform, "listingPolicy": "full", "status": "active"}

sellers = [
    S("songbird-seed-co", "Songbird Seed Co.", "specialty", "https://www.songbirdseeds.com",
      "Skagit Valley, WA", "owner-named",
      "Boutique seed venture of Colleen Raney (also Diadem Flower Co.), specialising in hard-to-find British sweet pea seeds grown on a small farm in Washington's Skagit Valley.",
      "Farm-grown seed packets; Hues buys from Songbird. Specialty sweet pea drops sell out quickly.", "squarespace"),
    S("sunflower-steve-seed-co", "Sunflower Steve Seed Co.", "specialty", "https://www.sunflowersteveseedco.com",
      "Wisconsin", "owner-named",
      "Steve Kaufer, Wisconsin cut-flower grower and sunflower breeder (breeding since ~2008); sells his own bred sunflower varieties.",
      "Sells direct from its own site.", None),
    S("floret", "Floret", "specialty", "https://www.floretflowers.com",
      "Skagit Valley, WA", "owner-named",
      "Erin Benzakein's family flower farm and seed company; breeds its own cut-flower varieties (Floret Originals).",
      "Sells seed only occasionally \u2014 periodic, limited seed sales rather than an always-open shop; availability is episodic.", "shopify"),
    S("dawn-creek-farm", "Dawn Creek Farm", "specialty", "https://dawncreekfarm.squarespace.com/donate",
      "Santa Cruz Mountains, CA", "owner-named",
      "Kori Hargreaves' farm breeding program \u2014 zinnias since 2016, plus cynoglossum and other cut flowers. Her varieties also reach market through Floret.",
      "Episodic: an annual fundraiser window (seeds as thank-you gifts, typically limit 1 packet/person, US shipping only, ships ~March). Breeder terms: no reselling or renaming her varieties; listings credit Dawn Creek as breeder.", "squarespace"),
    S("hudson-valley-seed-co", "Hudson Valley Seed Co.", "retail", "https://hudsonvalleyseed.com",
      "Accord, NY", "owner-named",
      "Small independent seed house in Accord, New York; grows on its own farm and works with regional small growers; known for artist-designed 'Art Pack' packets, much of the line certified organic.",
      "Standing shop (always open). Only its flower varieties are listed in this directory.", "shopify"),
    S("wild-west-seed", "Wild West Seed", "wholesale", "http://www.wildwestseed.com/",
      "Albany, OR", "owner-named",
      "Independent Oregon seed producer in the Willamette Valley: grows flower and vegetable seed with local partner growers; wildflower mixes and contract seed production.",
      "Wholesale/bulk-oriented rather than a retail packet shop.", None),
    # research candidates
    S("basket-of-flowers-farm", "Basket of Flowers Farm", "specialty", "https://www.basketofflowersfarm.com/specialty-zinnias",
      "Woodville, WI", "research-candidate",
      "Family farm that saved open-pollinated zinnias from its U-Pick field in 2021 and bred the 'Dearest' series in isolated grow-outs on the farm.",
      "Episodic: seed sales close for the season and reopen in December; newsletter passcode gives early access.", "squarespace"),
    S("flower-people", "Flower People", "specialty", "https://flowerpeople.com/collections/seeds",
      "Southwest WA / Portland, OR area", "research-candidate",
      "Family-run flower farm and seed company whose seed collection is built around its own cut-flower growing \u2014 35+ sweet peas plus celosia, strawflower, snapdragon, cosmos, zinnia and larkspur.",
      "Standing Shopify shop; many varieties sold out between drops.", "shopify"),
    S("lunaseed-farm", "Lunaseed Farm", "specialty", "https://lunaseedfarm.com/seed-shop",
      "Chimacum, WA", "research-candidate",
      "Woman-owned flower seed farm; all seed field-grown, open-pollinated, harvested and cleaned by hand. Spencer and Grandiflora sweet peas plus cottage flowers.",
      None, "squarespace"),
    S("enchanting-sweet-peas", "Enchanting Sweet Peas", "specialty", "https://enchantingsweetpeas.com/",
      "Sebastopol, CA", "research-candidate",
      "One-person operation (Glenys Johnson) selling Spencer sweet peas \u2014 40+ varieties \u2014 directly from the Sebastopol seed grower; 29 years growing and selling sweet peas.",
      "Seasonal: seed sales start in September.", None),
    S("uprising-seeds", "Uprising Seeds", "retail", "https://uprisingorganics.com/",
      "Bellingham, WA", "research-candidate",
      "Small family-run certified organic seed farm; produces over 70% of the seed it sells at its home farm, the remainder from Pacific Northwest family farms. Specialty cut flowers, all open-pollinated.",
      None, "shopify"),
    S("siskiyou-seeds", "Siskiyou Seeds", "retail", "http://www.siskiyouseeds.com/",
      "Williams, OR", "research-candidate",
      "Produces open-pollinated and heirloom seed on its home farm in southwest Oregon, plus a network of certified-organic small farms in the West. Broad flower list.",
      None, "shopify"),
    S("wild-garden-seed", "Wild Garden Seed", "specialty", "https://www.wildgardenseed.com/",
      "Philomath, OR", "research-candidate",
      "Organic seed farm established 1994 (Frank & Karen Morton); all seed organically grown by Shoulder to Shoulder Farm, many varieties from its on-farm breeding program.",
      None, None),
    S("adaptive-seeds", "Adaptive Seeds", "retail", "https://www.adaptiveseeds.com/seeds/flowers/page/3/",
      "Sweet Home, OR", "research-candidate",
      "Certified-organic farm-based seed company (est. 2009) growing over 75% of the seed it sells on its own farm; ~120 flower listings including farm-bred and farm-selected varieties.",
      None, "woocommerce"),
    S("grand-prismatic-seed", "Grand Prismatic Seed", "specialty", "https://www.grandprismaticseed.com/aboutus",
      "Salt Lake Valley, UT", "research-candidate",
      "Small seed farm in northern Utah (co-owners James Young & Guy Banner) growing with organic methods; curated cut flowers plus dye plants and Great Basin natives.",
      None, "squarespace"),
    S("coseytown-flowers", "Coseytown Flowers", "specialty", "https://coseytownflowers.com/products/dahlia-seed-pollinator-mix",
      "Greencastle, PA", "research-candidate",
      "Independent dahlia hybridizer (LeeAnn Huber); all dahlia seed is harvested from Coseytown's own dahlia fields.",
      "Episodic: tuber and seed sales mainly January\u2013April with restocks.", "shopify"),
    S("garden-bee-flower-farm", "Garden Bee Flower Farm", "specialty", "https://mygardenbee.com/collections/dahlia-seeds",
      "Walnut Cove, NC", "research-candidate",
      "Paula Fisher (DBA Paula's Dahlias) saves seed from her own dahlia field, evaluates seedlings, and hand-processes every packet.",
      None, "shopify"),
    S("turtle-tree-seed", "Turtle Tree Seed", "retail", "https://turtletreeseed.org/",
      "Copake, NY", "research-candidate",
      "Small non-profit seed company at Camphill Village; every seed grown with Demeter-certified biodynamic and organic practices. 350+ open-pollinated varieties including dahlia seed.",
      None, None),
    S("nature-and-nurture-seeds", "Nature and Nurture Seeds", "retail", "http://www.natureandnurtureseeds.com/",
      "Dexter, MI", "research-candidate",
      "Farm-based seed company near Ann Arbor; grows over 30% of its catalog on its 80-acre certified-organic farm, 60%+ in the Midwest.",
      None, "shopify"),
    S("north-circle-seeds", "North Circle Seeds", "retail", "http://www.northcircleseeds.com/",
      "Vergas, MN", "research-candidate",
      "Certified-organic Midwestern grower circle producing regionally adapted, open-pollinated seed.",
      None, "shopify"),
    S("high-desert-seed", "High Desert Seed + Gardens", "retail", "https://www.highdesertseed.com/",
      "Paonia, CO", "research-candidate",
      "High-altitude seed farm founded by Laura Parker; reported to grow ~90% of the seed it sells. Dedicated cut-flower section.",
      None, "woocommerce"),
    S("larner-seeds", "Larner Seeds", "specialty", "https://www.larnerseeds.com/",
      "Bolinas, CA", "research-candidate",
      "California native wildflower seed usable as cut flowers, from a one-acre demonstration garden in Bolinas growing 100+ coastal native plants for over 40 years.",
      None, "shopify"),
    S("mountainlily-farm", "Mountainlily Farm", "specialty", "https://mountainlilyfarm.com/",
      "Ozark Mountains, AR", "research-candidate",
      "Single horticulturist and licensed Ozark nursery; heirloom flower seed \u2014 celosia mixes, mixed sunflowers, peony poppies \u2014 hand-cleaned from varieties grown on the farm.",
      None, "shopify"),
    S("pepperharrow-farm", "PepperHarrow Farm", "specialty", "https://www.pepperharrowfarm.com/seeds",
      "Winterset, IA", "research-candidate",
      "60-acre lavender and cut-flower farm selling a broad cut-flower seed list, including a celosia it introduced in 2025. Note: the list also includes standard commercial types whose per-packet origin is not stated.",
      "Seasonal: farm seed generally offered early January to end of February.", "squarespace"),
    S("stone-hollow-farmstead", "Stone Hollow Farmstead", "specialty", "https://www.stonehollowfarmstead.com/products/dahlia-seeds",
      "Shelby County, AL", "research-candidate",
      "Dahlia seed hand-harvested from open-pollinated Stone Hollow Farmstead dahlias on its own farm, sold by parent line.",
      "Episodic: pre-purchase, shipping March\u2013April.", "shopify"),
    S("truelove-seeds", "Truelove Seeds", "retail", "https://trueloveseeds.com/",
      "Philadelphia, PA", "research-candidate",
      "Farm-rooted seed company whose seed is grown by more than 70 small-scale urban and rural farmers (30% of each packet sale goes back to the grower); also grows wholesale cut flowers on its own farm.",
      None, "shopify"),
    # sourcing-check shops (Hues' own sweet-pea checks, 2026-11-13/15)
    S("sweet-pea-gardens", "Sweet Pea Gardens", "specialty", "https://sweetpeagardens.com",
      "United States", "sourcing-check",
      "Specialist sweet pea grower-shop carrying exhibition Spencer varieties in ~10-seed packets (found in Hues' 2026-11-13 supplier checks).",
      "Specialty varieties are scarce and often out of stock; King's Ransom is limit 1 per household.", None),
    S("sugar-moon-gardens", "Sugar Moon Gardens", "specialty", None,
      "Bainbridge Island, WA", "sourcing-check",
      "Small garden shop carrying exhibition sweet pea varieties (found in Hues' 2026-11-13 supplier checks).",
      None, None),
    S("the-farmhouse-flower-farm", "The Farmhouse Flower Farm", "specialty", None,
      "United States", "sourcing-check",
      "Flower farm shop carrying exhibition sweet pea varieties in ~10-seed packets (found in Hues' 2026-11-13 supplier checks).",
      None, None),
    S("neat-flower-farm", "Neat Flower Farm", "specialty", None,
      "United States", "sourcing-check",
      "Flower farm shop found carrying Bix sweet pea in Hues' 2026-11-13 supplier checks.",
      None, None),
    S("the-dahlia-house", "The Dahlia House", "specialty", None,
      "United States", "sourcing-check",
      "Shop found carrying Susan Burgess sweet pea in Hues' 2026-11-13 supplier checks.",
      None, None),
    S("pnw-blooms", "PNW Blooms", "specialty", None,
      "Pacific Northwest", "sourcing-check",
      "Shop found carrying Gerry Cullinan sweet pea in Hues' 2026-11-13 supplier checks.",
      None, None),
]
# homepage may be None -> importer stores NULL; UI links only when present.
for s in sellers:
    if s["homepage"] is None:
        s["homepage"] = None

# ---------------------------------------------------------------- listings
def L(variety, seller, source, packets, url=None, notes=None):
    return {"variety": variety, "seller": seller, "sourceId": source, "sku": None,
            "productUrl": url, "notes": notes, "status": "active",
            "packetSizes": packets}

def P(cents=None, label="Packet", seeds=None, src=None, date=None, stock=None):
    return {"label": label, "seedCount": seeds, "priceCents": cents,
            "priceSource": src, "priceCheckDate": date, "inStock": stock}

CHK13 = "src-sweetpea-checks"; CHK15 = "src-sweetpea-checks"; RES = "src-research-2026-11-16"; SL = "src-seller-list"
listings = [
    # Songbird (checked 2026-11-15)
    L("sweet-pea-kings-ransom", "songbird-seed-co", CHK15,
      [P(600, "10 seeds", 10, "Songbird Seed Co. shop", "2026-11-15", True)],
      "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m",
      "Verified in stock at the 2026-11-15 restock check."),
    L("sweet-pea-bix", "songbird-seed-co", CHK15,
      [P(600, "Packet", None, "Songbird Seed Co. shop", "2026-11-15", True)]),
    L("sweet-pea-blue-shift", "songbird-seed-co", CHK15,
      [P(600, "Packet", None, "Songbird Seed Co. shop", "2026-11-15", True)]),
    L("sweet-pea-gerry-cullinan", "songbird-seed-co", CHK15,
      [P(600, "Packet", None, "Songbird Seed Co. shop", "2026-11-15", True)],
      None, "Back in stock at the 2026-11-15 restock check; limit 1 per order."),
    L("sweet-pea-emma", "songbird-seed-co", CHK15,
      [P(600, "Packet", None, "Songbird Seed Co. shop", "2026-11-15", None)],
      None, "Sold out at the 2026-11-15 check (restock had been scheduled for that day)."),
    L("sweet-pea-wild-swan", "songbird-seed-co", CHK15,
      [P(None, "Packet", None, None, "2026-11-15", None)],
      None, "Listed at Songbird but sold out at the 2026-11-15 check; price not recorded."),
    L("sweet-pea-alison", "songbird-seed-co", CHK15,
      [P(600, "10 seeds", 10, "Songbird Seed Co. shop", "2026-11-15", True)]),
    L("sweet-pea-shell-pink", "songbird-seed-co", CHK15,
      [P(600, "10 seeds", 10, "Songbird Seed Co. shop", "2026-11-15", True)]),
    L("sweet-pea-juliet", "songbird-seed-co", CHK15,
      [P(600, "10 seeds", 10, "Songbird Seed Co. shop", "2026-11-15", True)]),
    # Flower People
    L("sweet-pea-kings-ransom", "flower-people", CHK13,
      [P(900, "Packet", None, "Flower People shop", "2026-11-13", None)],
      "https://flowerpeople.com/collections/seeds", "Sold out at the 2026-11-13 check."),
    L("sweet-pea-susan-burgess", "flower-people", CHK13,
      [P(800, "Packet", None, "Flower People shop", "2026-11-13", None)],
      "https://flowerpeople.com/collections/seeds", "Sold out at the 2026-11-13 check."),
    L("sweet-pea-castle-wellan", "flower-people", RES, [P()], "https://flowerpeople.com/collections/seeds"),
    L("sweet-pea-oban-bay", "flower-people", RES, [P()], "https://flowerpeople.com/collections/seeds"),
    L("sweet-pea-spring-sunshine-burgundy", "flower-people", RES, [P()], "https://flowerpeople.com/collections/seeds"),
    L("sweet-pea-mollie-rilstone", "flower-people", RES, [P()], "https://flowerpeople.com/collections/seeds"),
    # Lunaseed
    L("sweet-pea-gerry-cullinan", "lunaseed-farm", CHK13,
      [P(595, "Packet", None, "Lunaseed Farm shop", "2026-11-13", None)],
      "https://lunaseedfarm.com/seed-shop", "Sold out at the 2026-11-13 check."),
    L("sweet-pea-cosmic-kitty-mix", "lunaseed-farm", RES, [P()], "https://lunaseedfarm.com/seed-shop"),
    L("sweet-pea-dark-matter-mix", "lunaseed-farm", RES, [P()], "https://lunaseedfarm.com/seed-shop"),
    L("sweet-pea-luminosity-mix", "lunaseed-farm", RES, [P()], "https://lunaseedfarm.com/seed-shop"),
    L("celosia-xantippe", "lunaseed-farm", RES, [P()], "https://lunaseedfarm.com/seed-shop"),
    # Sweet Pea Gardens
    L("sweet-pea-kings-ransom", "sweet-pea-gardens", CHK13,
      [P(1499, "10 seeds", 10, "Sweet Pea Gardens shop", "2026-11-13", None)],
      None, "Out of stock at the 2026-11-13 check; limit 1 per household. A shy seed producer \u2014 always scarce."),
    L("sweet-pea-clementine-kiss", "sweet-pea-gardens", CHK13,
      [P(595, "10 seeds", 10, "Sweet Pea Gardens shop", "2026-11-13", None)]),
    L("sweet-pea-wild-swan", "sweet-pea-gardens", CHK13, [P()]),
    # Sugar Moon Gardens
    L("sweet-pea-kings-ransom", "sugar-moon-gardens", CHK13,
      [P(1000, "Packet", None, "Sugar Moon Gardens shop", "2026-11-13", None)],
      None, "Listed as 'coming soon' at the 2026-11-13 check."),
    L("sweet-pea-emma", "sugar-moon-gardens", CHK13, [P()]),
    L("sweet-pea-gerry-cullinan", "sugar-moon-gardens", CHK13,
      [P(900, "Packet", None, "Sugar Moon Gardens shop", "2026-11-13", None)],
      None, "Sold out at the 2026-11-13 check."),
    # Farmhouse Flower Farm
    L("sweet-pea-bix", "the-farmhouse-flower-farm", CHK13,
      [P(595, "Packet", None, "The Farmhouse Flower Farm shop", "2026-11-13", True)]),
    L("sweet-pea-blue-shift", "the-farmhouse-flower-farm", CHK13,
      [P(595, "Packet", None, "The Farmhouse Flower Farm shop", "2026-11-13", True)]),
    L("sweet-pea-raspberry-flake", "the-farmhouse-flower-farm", CHK13,
      [P(595, "Packet", None, "The Farmhouse Flower Farm shop", "2026-11-13", None)]),
    L("sweet-pea-kings-ransom", "the-farmhouse-flower-farm", CHK13,
      [P(595, "Packet", None, "The Farmhouse Flower Farm shop", "2026-11-13", None)],
      None, "Sold out at the 2026-11-13 check."),
    # Neat / Dahlia House / PNW Blooms
    L("sweet-pea-bix", "neat-flower-farm", CHK13,
      [P(600, "Packet", None, "Neat Flower Farm shop", "2026-11-13", True)]),
    L("sweet-pea-susan-burgess", "the-dahlia-house", CHK13,
      [P(525, "Packet", None, "The Dahlia House shop", "2026-11-13", None)],
      None, "Sold out at the 2026-11-13 check."),
    L("sweet-pea-gerry-cullinan", "pnw-blooms", CHK13,
      [P(550, "Packet", None, "PNW Blooms shop", "2026-11-13", None)]),
    # Floret x Dawn Creek
    L("zinnia-dawn-creek-pastels", "floret", SL, [P()],
      "https://shop.floretflowers.com/products/zinnia-dawn-creek-pastels",
      "Floret sells seed only occasionally; availability is episodic."),
    L("zinnia-dawn-creek-honey", "floret", SL, [P()],
      "https://shop.floretflowers.com/products/zinnia-milk-honey",
      "Floret sells seed only occasionally; availability is episodic."),
    L("zinnia-dawn-creek-blush", "floret", SL, [P()], None,
      "Floret sells seed only occasionally; availability is episodic."),
    L("zinnia-dawn-creek-peach", "floret", SL, [P()], None,
      "Floret sells seed only occasionally; availability is episodic."),
    # Sunflower Steve
    L("sunflower-van-goghs-fantasy", "sunflower-steve-seed-co", SL, [P()],
      "https://www.sunflowersteveseedco.com"),
    # Hudson Valley
    L("zinnia-gift", "hudson-valley-seed-co", SL, [P()],
      "https://hudsonvalleyseed.com/collections/art-packs", "From the Art Packs collection."),
    L("snapdragon-rembrandt", "hudson-valley-seed-co", SL, [P()],
      "https://hudsonvalleyseed.com/collections/art-packs", "From the Art Packs collection."),
    L("shirley-poppy-mother-of-pearl", "hudson-valley-seed-co", SL, [P()],
      "https://hudsonvalleyseed.com/collections/art-packs", "From the Art Packs collection."),
    # Basket of Flowers
    *[L(s, "basket-of-flowers-farm", RES, [P()], "https://www.basketofflowersfarm.com/specialty-zinnias",
        "Episodic sales; prized varieties sell out quickly after the December reopening.")
      for s in ["zinnia-dearest-joanna-lavender-frost", "zinnia-dearest-bubblegum", "zinnia-dearest-sunset",
                "zinnia-dearest-kaleidoscope", "zinnia-dearest-orange-creamsicle", "zinnia-dearest-ellie",
                "zinnia-dearest-tabita"]],
    # Coseytown
    L("dahlia-seed-premium-pollinator-mix", "coseytown-flowers", RES, [P()],
      "https://coseytownflowers.com/products/dahlia-seed-pollinator-mix"),
    L("dahlia-seed-coseytown-honey-pot-mix", "coseytown-flowers", RES, [P()],
      "https://coseytownflowers.com/products/dahlia-seed-coseytown-honey-pot"),
    # Garden Bee
    L("dahlia-seed-paulas-field-mix", "garden-bee-flower-farm", RES,
      [P(None, "30 seeds", 30)], "https://mygardenbee.com/collections/dahlia-seeds"),
    # Stone Hollow
    *[L(s, "stone-hollow-farmstead", RES, [P(None, "10 seeds", 10)],
        "https://www.stonehollowfarmstead.com/products/dahlia-seeds",
        "Episodic pre-purchase; ships March\u2013April.")
      for s in ["dahlia-seed-mixed-parent", "dahlia-seed-miss-amara", "dahlia-seed-aa-giant-flowered",
                "dahlia-seed-collarette"]],
    # Adaptive
    *[L(s, "adaptive-seeds", RES, [P()]) for s in
      ["strawflower-firefly", "sunflower-better-off-red", "snapdragon-black-prince",
       "snapdragon-defiant-mix", "snapdragon-orange-wonder"]],
    # Wild Garden
    L("rudbeckia-tall-dark-sahara", "wild-garden-seed", RES, [P()]),
    L("zinnia-karens-fave-color-mix", "wild-garden-seed", RES, [P()]),
    # Nature & Nurture / North Circle / PepperHarrow / Mountainlily
    L("gomphrena-audray-pink", "nature-and-nurture-seeds", RES, [P()]),
    L("cosmos-diablo", "nature-and-nurture-seeds", RES, [P()]),
    L("cosmos-sea-shells", "north-circle-seeds", RES, [P()]),
    L("celosia-pink-lemonade", "pepperharrow-farm", RES, [P()],
      "https://www.pepperharrowfarm.com/seeds/p/celosia-pink-lemonade"),
    L("sunflower-mountainlily-mixed", "mountainlily-farm", RES, [P()],
      "https://mountainlilyfarm.com/products/sunflower-seeds-mixed-sunflowers-great-for-cut-flower-garden-and-bee-friendly-garden"),
]

# ---------------------------------------------------------------- LAUNCH FILTER
# Canonical spec decision 25 (adopted 2026-11-16): launch sellers are the six
# owner-named exemplars ONLY. Candidate + sourcing-check sellers and their listings
# are excluded from the emitted dataset; their definitions stay above as research.
from urllib.parse import urlparse

REGIONS = {"songbird-seed-co": "WA", "sunflower-steve-seed-co": "WI", "floret": "WA",
           "dawn-creek-farm": "CA", "hudson-valley-seed-co": "NY", "wild-west-seed": "OR"}
SHIPS_TO = {"dawn-creek-farm": ["US"]}  # source: annual fundraiser terms, US shipping only

launch_sellers = []
for s in sellers:
    if s["provenance"] != "owner-named":
        continue
    host = urlparse(s["homepage"]).hostname or ""
    s = dict(s)
    s.update({
        # Spec §2 seller approval fields. approvedAt is a documented fact: the owner
        # named these sellers as exemplars on 2026-11-15 (SELLER-SEED-LIST.md).
        # termsReviewedAt is NOT known for any seller, so it stays null (unknown) —
        # the spec's approved=>terms-reviewed CHECK is therefore intentionally not
        # enforced in the delta schema; terms review is a Week 1 launch-plan task.
        "eligibility": "approved",
        "approvedAt": "2026-11-15",
        "termsReviewedAt": None,
        "approvalNote": ("Named by the owner as an exemplar seller on 2026-11-15 "
                         "(SELLER-SEED-LIST.md); canonical spec adopted 2026-11-16. "
                         "Terms review not yet recorded — Week 1 launch-plan task."),
        "domain": host[4:] if host.startswith("www.") else host,
        "crawlPolicy": "manual_only",  # spec default until terms are read
        "claimStatus": "unclaimed",
        "country": "US",
        "region": REGIONS[s["slug"]],
        "shipsTo": SHIPS_TO.get(s["slug"], ["unknown"]),
        "isSiteOwner": False,
    })
    launch_sellers.append(s)
launch_slugs = {s["slug"] for s in launch_sellers}
launch_listings = [l for l in listings if l["seller"] in launch_slugs]
sellers, listings = launch_sellers, launch_listings

catalog = {
    "batch": {"label": "initial-catalog",
              "note": "Curated by Hue from verified project sources; see build-catalog.py header."},
    "sources": [
        {"id": "src-v1-varieties", "kind": "owner", "label": "Hues v1 catalog data (from Hues seed-sourcing files)",
         "url": None, "checkedDate": "2026-11-15", "access": "public"},
        {"id": "src-sweetpea-checks", "kind": "shop-check", "label": "Hues sweet pea supplier checks (sweet-pea-variety-checks.md)",
         "url": None, "checkedDate": "2026-11-15", "access": "public"},
        {"id": "src-seller-list", "kind": "owner", "label": "Owner-named seller list (SELLER-SEED-LIST.md)",
         "url": None, "checkedDate": "2026-11-15", "access": "public"},
        {"id": "src-research-2026-11-16", "kind": "research", "label": "Small seed farms research sweep, verified reads 2026-11-16",
         "url": None, "checkedDate": "2026-11-16", "access": "public"},
    ],
    "categories": [{"slug": "flowers", "name": "Flowers", "sortOrder": 1}],
    "subcategories": [
        {"slug": "annual", "name": "Annual", "category": "flowers"},
        {"slug": "annual-climber", "name": "Annual Climber", "category": "flowers"},
        {"slug": "perennial", "name": "Perennial", "category": "flowers"},
    ],
    "plants": plants, "varieties": varieties, "sellers": sellers, "listings": listings,
}

# ---------------------------------------------------------------- checks
assert len(plants) == 19, len(plants)
assert len(varieties) == 68, len(varieties)
assert len(sellers) == 6, len(sellers)          # six exemplars only (decision 25)
assert len(listings) == 17, len(listings)
vslugs = {v["slug"] for v in varieties}; sslugs = {s["slug"] for s in sellers}
assert len(vslugs) == 68 and len(sslugs) == 6
for s in sellers:
    assert s["provenance"] == "owner-named" and s["eligibility"] == "approved", s
    assert s["domain"], s
for l in listings:
    assert l["variety"] in vslugs, l
    assert l["seller"] in sslugs, l
    for p in l["packetSizes"]:
        assert p["priceCents"] is None or isinstance(p["priceCents"], int)
        if p["priceCents"] is not None:
            assert p["priceSource"] and p["priceCheckDate"], l
blob = json.dumps(catalog).lower()
for bad in EXCLUDED:
    assert bad not in blob, f"excluded name present: {bad}"
out = Path(__file__).with_name("catalog.json")
out.write_text(json.dumps(catalog, indent=1, ensure_ascii=False))
print(f"OK: {len(plants)} plants / {len(varieties)} varieties / {len(sellers)} sellers / {len(listings)} listings -> {out}")
