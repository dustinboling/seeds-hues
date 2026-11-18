# Hues Branding + Floret Farms — Build Report

**Date:** 2026-11-16 (evening, America/Los_Angeles) · **Site:** https://seeds.hues.flowers (Seed Finder)
**Scope:** Hues logo/branding in header + footer · Floret Favorite Seed Sources farms added as sellers (+ Johnny's ruling, + The Gardener's Workshop) · homepage card counts removed · homepage crop cards restyled as vintage seed packets · seed.hues.flowers (singular) redirect · one production deploy.
**Result:** ALL SHIPPED AND LIVE-VERIFIED. Sellers 6 → 25. Worker version `a60980f1-ac10-46e4-b8eb-27d17222790f`. Catalog v4 published (seq 1338 → 1357).

---

## 1. Hues logo + branding (header & footer)

- Canonical logo copied self-hosted (never hotlinked): `~/workspace/goals/hues-flowers-website-upkeep/files/hues-logo-master-solid.svg` → `v2/public/brand/hues-logo.svg` (Hues script wordmark, fill `#2E4438` deep green — on-palette for the Illustrated Seed Catalogue theme). Served at https://seeds.hues.flowers/brand/hues-logo.svg (verified 200); `public/_headers` gained a one-week cache rule for `/brand/*`.
- New shared component `v2/components/layout/HuesLogo.tsx` renders the single `<img>` (decorative `alt=""` — the surrounding link carries the accessible name, so screen readers hear the link label once, not twice).
- **Header** (`SiteHeader.tsx`): Hues logo (22px tall) linked to https://hues.flowers with `aria-label="Hues Floral Park"`, a hairline divider, then the Seed Finder lockup whose sub-line now reads **"by Hues Floral Park"** (replacing the bare domain line in the header only). Mobile header layout unchanged in structure; the lockup sits in the existing brand block, search position untouched.
- **Footer** (`SiteFooter.tsx`): Hues logo (24px) + divider + "Seed Finder", plus a new line: **"Seed Finder (seeds.hues.flowers) is owned and operated by Hues Floral Park."** with the park name linked to https://hues.flowers. Wording is consistent with the ownership disclosure already on /about/data.
- The guardrail test's image allow-list was extended for the brand asset by project precedent (tests iterate the allow-list explicitly).

## 2. Floret-list farms + Johnny's + The Gardener's Workshop as sellers (6 → 25)

Source of truth: `~/workspace/seeds-hues/FLORET-SEED-SOURCES.md`. Dustin's rulings applied: §B (9 candidates) + §C (8 borderline) added — the per-seller approval gate was lifted for this list; **Johnny's Selected Seeds (§D) added by Dustin's explicit exception ruling of 2026-11-16 — Johnny's ONLY; Territorial Seed and Ball stay excluded** (they remain in the code-level exclusion lists, and "johnny" was removed from those lists to encode the exception, with a comment recording the ruling); §E (45 international) stays out under the US-only launch rule.

All records were appended to `v2/seed-data/catalog.json` through idempotent merge scripts (`v2/scripts/add-floret-source-sellers.py`, `v2/scripts/add-gardeners-workshop.py`) so the data survives future imports; a new provenance source row `src-floret-favorite-seed-sources` (Floret's Favorite Seed Sources page, checked 2026-11-16) backs the additions. Every new seller: name/location/website exactly as recorded in the source doc, eligibility "approved" (2026-11-16), **termsReviewedAt = null** (terms review is a separate pass), crawlPolicy "manual_only", rating state "Not yet rated" (schema default — no rating invented), and **no listings, prices, or varieties created** — listings come later through the evidence-based ingester.

**The 19 added sellers** (slug — location as recorded):

| # | Seller | Location |
|---|--------|----------|
| 1 | 3 Porch Farm | Georgia (Comer) |
| 2 | Blomma Flower Farm | Washington (Skagit Valley) |
| 3 | Half Moon Farm | — (see note) |
| 4 | Jig-Bee Flower Farm | — |
| 5 | Millay & Meadowlark Flower Farm | — |
| 6 | Peace Seedlings | — |
| 7 | Summertime Seed Co. | — |
| 8 | Sunflower Selections | not stated in source doc (null — not invented) |
| 9 | Three Brothers Blooms | not stated in source doc (null) |
| 10 | American Meadows | Vermont |
| 11 | Botanical Interests | Colorado |
| 12 | Great Basin Seed | Utah |
| 13 | High Mowing Organic Seeds | Vermont |
| 14 | Prairie Moon Nursery | Minnesota |
| 15 | Renee's Garden | California |
| 16 | Seed Savers Exchange | Iowa |
| 17 | Select Seeds | Connecticut (Union) |
| 18 | **Johnny's Selected Seeds** (§D exception) | not stated in §D table (null) |
| 19 | **The Gardener's Workshop** (Dustin nomination, not on Floret's list) | Newport News, VA |

(Where the workup doc recorded no location, the field is null rather than filled from memory — the doc is the source of truth for this import.)

**The Gardener's Workshop verification:** fetched from its own site 2026-11-16 — family-run business (Lisa Mason Ziegler), Newport News, VA 23608, "offering seeds, tools, and expert-led courses", with a dedicated live Seeds shop at https://thegardenersworkshop.com/collections/seeds (Shopify "Cut Flower Seeds" collection). It fits the seller model. The seller schema has a single storefront field, so `homepage` = the Seeds shop URL; the live seller page confirms the location renders and the outbound link points at the seed shop.

Nothing in §B/§C/§D was un-addable; §A entries were already in the catalog (skipped as duplicates by slug/domain match).

## 3. Homepage: counts removed + vintage seed-packet cards

- The homepage crop cards are rendered inline in `v2/app/page.tsx` (only the card image component is shared with the /crop index, and it was not touched), so the change is homepage-scoped by construction: the `{n} varieties · {m} with sellers` line under each homepage card is **removed**. Counts elsewhere are untouched and still asserted by acceptance (crop pages keep their coverage counts; the homepage hero coverage line remains and now reads "25 farms").
- Packet restyle (homepage only, new `.packet` class in `app/globals.css`): masthead-first composition — centered crop name in Fraunces semibold, a divider-stem-mini ornament, the existing crop illustration as the packet art inside a deckle frame with an inset keyline (`::after`, suppressed under forced-colors), and a foot imprint "Seed Finder · Hues Floral Park" in tiny uppercase. The whole card remains one link to the crop page; alt text, focus states, and contrast are unchanged (WCAG 2.2 AA preserved).
- Screenshots (local preview of the identical production build — this VM's headless Chrome cannot reach production through Cloudflare): `~/workspace/seeds-hues/theme-preview-shots/home-packet-desktop-top.png`, `home-packet-mobile-top.png`, `home-packet-mobile-grid.png`. Visually verified: header lockup correct, packets read as packets at 390px, imprint + keyline present, mobile grid tidy.

## 4. seed.hues.flowers (singular) → seeds.hues.flowers redirect

Zone hues.flowers (`0e2fd06883e26d0de9308ed684443ebc`), Dustin's own account. No pre-existing `seed` records; the existing `seeds.hues.flowers` proxied record and Worker route were not touched.

- **DNS:** AAAA `seed.hues.flowers` → `100::`, proxied — record id `592b2c928829a7f3c5e31c482a29bab1` (created via the Cloudflare MCP connector).
- **Redirect:** a Single Redirect rule was attempted first, but the Rulesets API returns **403 Authentication error** on the OAuth credential (reads and writes) — it lacks Rulesets access. Shipped fallback: **Page Rule id `42dbe7538e673f612ade69fcf76f9784`**, priority 1, active: `seed.hues.flowers/*` → forwarding URL `https://seeds.hues.flowers/$1`, status **301** (path and query preserved by the `$1` wildcard + Page Rule query behaviour).
- **Live evidence (curl, 2026-11-17T02:31Z):** `https://seed.hues.flowers/variety/sweet-pea-kings-ransom?from=singular` → **301, Location: https://seeds.hues.flowers/variety/sweet-pea-kings-ransom?from=singular** — path AND query preserved; the root path also 301s. (If Rulesets access is ever granted, the Page Rule can be replaced by the equivalent Single Redirect; behaviour is identical for visitors.)

> **Addendum (2026-11-17):** the homepage crop cards described in this report (packet restyle v1) were revised in Phase 2 — imprint line removed entirely, crop name centered at the bottom in a fixed-height zone, all cards equal height, illustrations shown whole (contain, padded) — see `SEASON-FILTER-REPORT.md`.

## 5. Tests, deploy, live verification

- `npm run verify`: ESLint clean, TypeScript clean, **Vitest 143/143**. Local acceptance: **107/107** (the acceptance img-count assertion now excludes `/brand/` alongside `/theme/`, same pattern as the theme delta; two earlier acceptance failures were local-environment artifacts — media checks require an empty local media table, and the rate-limit burst check is a documented window-boundary flake).
- Test expectations updated for the new reality (seller counts 25 across catalog-assertion/data/API tests, approved_at dates scoped — exemplars 2026-11-15, additions 2026-11-16 — region counts, sync totals 755, removal-flow list length 25).
- **Deploy:** production D1 backed up first (`v2/tmp/prod-backup-pre-branding.sql`); append-only SQL (21 statements) applied — no existing rows rewritten; **catalog v4 published 2026-11-17T02:52:08Z**, snapshot `snapshots/catalog-v4.sqlite` (212,992 bytes, sha256 `c33668f0f6918ecd48f2c477f1b482c6af4b34cb831f49a1c736bad3937760c7`; the file served at `/api/v1/catalog/snapshot/4.sqlite` verified byte-identical); **Worker version `a60980f1-ac10-46e4-b8eb-27d17222790f`**; REVALIDATE_TOKEN rotated; 749 paths revalidated. **Rollback target (pre-batch live version): `16976279-6be5-450a-9fbf-8755e9b0d0f6`.**
- **Live verification (direct fetch of https://seeds.hues.flowers):** homepage HTML contains the Hues logo twice (header + footer), "by Hues Floral Park", the footer ownership line, 93 packet cards with the imprint, and **zero** card count lines; `/brand/hues-logo.svg` returns 200; seller pages `/seller/johnnys-selected-seeds`, `/seller/the-gardeners-workshop`, `/seller/sunflower-selections`, `/seller/select-seeds`, `/seller/3-porch-farm` all return 200 (Johnny's shows "Not yet rated"); `/api/v1/catalog/version` = 4 (seq 1357); `/api/v1/sync/snapshot` totals = 93 crops / 619 varieties / **25 sellers** / 17 listings.

## Follow-ups noted (not in this batch)

- Terms review for the 19 new sellers (all termsReviewedAt null) — same process as the Week 1 exemplar review.
- Variety listings for new sellers arrive via the evidence-based ingester (Week 2 plan), never by hand.
- Phase 2 season filter ("Cool Season Hardy Annuals" / "Warm Season Tender Annuals") shipped separately — see `SEASON-FILTER-REPORT.md`.
