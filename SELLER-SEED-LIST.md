# Seller Seed List — small farms selling seed

The starting list for the crawl pipeline, per Dustin's seller scope ruling (2026-11-15): ONLY small farms / independent farm seed sellers. No large seed companies (no Ball, GeoSeed, Johnny's, etc.).

## Named by Dustin as exemplars (2026-11-15)

1. **Songbird Seed Co.** — Colleen Raney (also Diadem Flower Co.), small farm in Skagit Valley, Washington. Boutique seed venture specialising in hard-to-find British sweet pea seeds; grows hundreds of sweet pea varieties and sells farm-grown seed packets. Hues has bought from Songbird (22 packets consolidated 2026-11-15). Instagram: @songbirdseedco.
2. **Sunflower Steve Seed Co.** — Steve Kaufer, Wisconsin cut-flower grower and sunflower breeder (breeding since ~2008, seed co. launched 2022/23). Sells his own bred sunflower varieties (e.g. Van Gogh's Fantasy). Site: https://www.sunflowersteveseedco.com

## Also named by Dustin (2026-11-15)

3. **Floret** — Erin Benzakein's family flower farm and seed company, Skagit Valley, Washington. Breeds its own cut-flower varieties (Floret Originals: zinnias, dahlias, sweet peas, etc.). **Sells seed only occasionally** — seed sales are periodic/limited rather than an always-open shop, so the crawl must treat availability as episodic: detect sale windows, and a variety page should not present Floret as a standing source outside them. Site: https://www.floretflowers.com

4. **Dawn Creek Farm** — Kori Hargreaves, Santa Cruz Mountains, California. Zinnia breeder since 2016 (also cynoglossum and other cut flowers); selling her own bred seed since 2020. Sales model is **episodic like Floret's**: an annual fundraiser window on her Squarespace shop (seeds offered as thank-you gifts, typically limit 1 packet/person, US shipping only, ships ~March). Her varieties also reach market through Floret (Dawn Creek Pastels/Honey/Blush/Peach) — the same master variety can legitimately carry two in-scope sellers. Breeder terms matter: she prohibits reselling/renaming her varieties as one's own and runs a royalty group for seed sellers — listings must credit Dawn Creek as breeder. Shop: https://dawncreekfarm.squarespace.com/donate

5. **Hudson Valley Seed Co.** — independent seed company, Accord, New York (named by Dustin 2026-11-15 via their Art Packs collection). A small seed house rather than a single breeder-farm: grows on its own Accord farm and works with regional small growers; famous for artist-designed "Art Pack" packets, much of the line certified organic. **Standing shop** (always open, unlike the episodic sellers). Runs on Shopify, so the standard product feed works for the crawl. Note: they sell vegetables/herbs too — only their flower varieties are in scope for the directory. Art packs: https://hudsonvalleyseed.com/collections/art-packs

6. **Wild West Seed** — Albany, Oregon (named by Dustin 2026-11-15). Independent Oregon seed producer in the Willamette Valley: grows flower and vegetable seed with local partner growers, known for wildflower mixes (incl. regional blends and custom mixes) and contract seed production. **Different model from the retail shops: wholesale/bulk-oriented**, not a packet shop — listings would be their flower seed lines at bulk sizes, suiting production-scale buyers. Site: http://www.wildwestseed.com/

## The profile these define

- A working farm (or farm-based breeder) selling seed it grows/breeds itself
- Independent, small-scale, sells direct from its own shop/site
- Often specialised (one genus or a short list), deep within that specialty

More sellers get added here as the crawl finds them and they are verified as real, in-scope sellers. No invented sellers, prices, or listings — every entry traces to a real source.

## Candidates from research sweep (2026-11-15, pending Dustin's review)

Full sourced report: ~/workspace/research_notes/small-seed-farms-cut-flowers-20261116-0714/report.md

1. Basket of Flowers Farm — Woodville, WI — farm-bred "Dearest" zinnias — https://www.basketofflowersfarm.com/specialty-zinnias (EPISODIC)
2. Flower People — SW WA/Portland OR — 35+ sweet peas + cottage flowers — https://flowerpeople.com/collections/seeds
3. Lunaseed Farm — Chimacum, WA — Spencer/Grandiflora sweet peas — https://lunaseedfarm.com/seed-shop
4. Enchanting Sweet Peas — Sebastopol, CA — 40+ Spencer sweet peas — https://enchantingsweetpeas.com/
5. Uprising Seeds — Bellingham, WA — OP organic cut flowers — https://uprisingorganics.com/
6. Siskiyou Seeds — Williams, OR — broad OP flowers — http://www.siskiyouseeds.com/
7. Wild Garden Seed — Philomath, OR — farm-original rudbeckia/zinnia — https://www.wildgardenseed.com/
8. Adaptive Seeds — Sweet Home, OR — 120 flower listings — https://www.adaptiveseeds.com/seeds/flowers/page/3/
9. Grand Prismatic Seed — Salt Lake Valley, UT — cut flowers + dye/native — https://www.grandprismaticseed.com/aboutus
10. Coseytown Flowers — Greencastle, PA — dahlia seed — https://coseytownflowers.com/products/dahlia-seed-pollinator-mix (EPISODIC Jan–Apr)
11. Garden Bee Flower Farm — Walnut Cove, NC — dahlia seed — https://mygardenbee.com/collections/dahlia-seeds
12. Turtle Tree Seed — Copake, NY — OP biodynamic flowers incl. dahlia seed — https://turtletreeseed.org/
13. Nature and Nurture Seeds — Dexter, MI — gomphrena/cosmos/poppy — http://www.natureandnurtureseeds.com/
14. North Circle Seeds — Vergas, MN — regionally adapted OP flowers — http://www.northcircleseeds.com/
15. High Desert Seed + Gardens — Paonia, CO — cut flower section, calendula/nigella — https://www.highdesertseed.com/
16. Larner Seeds — Bolinas, CA — CA native cut flowers — https://www.larnerseeds.com/
17. Mountainlily Farm — Ozarks, AR — celosia/sunflower/poppy — https://mountainlilyfarm.com/
18. PepperHarrow Farm — Winterset, IA — huge cut-flower list (CAVEAT: includes commercial types, origin unstated — may demote) — https://www.pepperharrowfarm.com/seeds (SEASONAL Jan–Feb)
19. Stone Hollow Farmstead — Shelby County, AL — dahlia seed by parent line — https://www.stonehollowfarmstead.com/products/dahlia-seeds (EPISODIC)
20. Truelove Seeds — Philadelphia, PA — heirloom flowers via 70+ small growers (flag: network model — borderline if single-farm-only) — https://trueloveseeds.com/

### Borderline (needs Dustin's ruling)
Snake River Seed Cooperative (Boise ID, 34-farm co-op), Plant Good Seed (Ojai CA, ~20-farm collective), Sow True Seed (Asheville NC, employee-owned co-op), Select Seeds (Union CT, imports European seed), Southern Exposure Seed Exchange (Mineral VA, 90+ growers), Native American Seed (TX, restoration focus), Trailing Petunia (lisianthus reseller, doesn't grow), Swallowtail Garden Seeds.

### Gaps found
No farm-grown lisianthus seed seller exists in sources (resellers only); ranunculus/anemone come as corms, not seed; Buffalo Seed Company (Shawnee KS) unverified — needs a manual check.

## From Floret's Favorite Seed Sources — pending Dustin's review (2026-11-16)

Source: https://www.floretflowers.com/favorite-seed-sources/ — full extraction + classification of all 77 sources on the page: ~/workspace/seeds-hues/FLORET-SEED-SOURCES.md. New US candidates below (small/independent, sell seed direct per Floret's notes). None are approved; each needs Dustin's hand approval + a terms read before any crawl.

1. 3 Porch Farm — northern Georgia — farm-bred Chinese forget-me-not 'Ms. Marilyn', formosa lilies, money plant, sunflowers — https://3porchfarm.com
2. Blomma Flower Farm — Nevada — zinnia breeder Tiffany Jones, soft pastel breeding lines — https://blommaflowerfarm.com (EPISODIC: yearly fundraiser, limited quantities)
3. Half Moon's Farm — Ferndale, WA — sweet peas + wedding/design cut flowers, standing online shop — https://www.halfmoonsfarm.com
4. Jig-Bee Flower Farm — Corinth, VT — cold-climate cut flowers via online shop; budding breeder — https://www.jig-bee.com
5. Millay & Meadowlark Flower Farm — Missoula, MT — flower farm that also sells sweet pea seed — https://www.millayandmeadowlark.com
6. Peace Seedlings — Willamette Valley, OR — psychedelic zinnia mixes, farm-bred peas — https://peaceseedlingsseeds.blogspot.com (MAIL-ORDER ONLY: blog is the catalog, handwritten order + check — manual-only if approved)
7. Summertime Seed Co. — Willamette Valley, OR — certified organic farm, cut flowers + herbs/veg — https://summertimeseed.com
8. Sunflower Selections — location not stated on Floret's page — Dr. Tom Heaton, breeder of the ProCut and Starburst sunflower series, sells direct — https://www.sunflowerselections.com
9. Three Brothers Blooms — location not stated on Floret's page — Brenna Estrada, specialty pansy seed (Faraone Mennella hybrids, imported from Italy) — https://threebrothersblooms.com
