# AMENDMENT 2026-11-16 — Enumeration becomes VARIETY-FIRST (Floret Library first)

**Ruled by Dustin (owner) on 2026-11-16, voice call.** This amendment sits alongside
`SPEC-CANONICAL.md`, which is the verbatim adopted Nov 16, 2026 spec and is NOT edited.
Where this amendment and the canonical spec conflict on enumeration ORDER, this
amendment governs. Everything else in the canonical spec stands unchanged.

## The new flow

1. **Enumerate from the Floret Library first.** Crawl the Floret Library
   (library.floretflowers.com) and extract **only variety names** — seed collections
   only. The Library also covers bulbs and tubers; those are out of scope. Names and
   plain facts only: never copy Floret's descriptive text or images (facts are not
   copyrighted; their words and photos are). The Library's variety names become the
   enumeration foundation — the master list of varieties the directory works from,
   because it holds the cut flower varieties growers actually care about.
2. **Search per variety for sellers.** For each enumerated variety, search the web
   for small farms selling that seed. Every search hit is a **seller candidate** and
   goes to the owner for hand approval — nothing auto-approves, and a farm found this
   way is not crawled until the owner approves it (terms read at approval, per spec).
3. **Approved sellers attach listings through the existing flow.** Once a seller is
   approved, the evidence-checked shop-crawl flow (canonical spec §4) runs as before:
   fetch with robots/rate-limit discipline, extract with evidence quotes, exact
   matches on approved sellers auto-publish, everything else to the review queue.

## Inclusion ruling (2026-11-16)

**Ruled by Dustin (owner) on 2026-11-16.** The Floret Library seed collection is in
scope **as-is, in full** — nothing is trimmed. That includes the herb, vegetable and
filler items in the seed collection (Tomato, garden Pea, Ornamental Squash, Basil,
Dill, Oregano, Shiso, Quinoa, Orach): cut flower farms sell filler material, and the
Library is curated for florists, floral designers and farmer-florists, so Floret's
curation is the inclusion test. In the names list these entries stay marked as
herb/vegetable/filler for information only — the marking is not a trim queue.
Bulbs, tubers and corms remain out of scope, because the directory is seed-only.

## What this supersedes

- **Spec §1 ordering note** ("Work the crops in the order approved sellers stock
  them… seller catalogs come before reference catalogs") — REVERSED for enumeration:
  the Floret Library (a reference source) now comes first, because it defines which
  varieties matter; seller discovery follows the varieties.
- **Spec §4 source-priority order** — the Floret Library moves from priority 2 to
  priority 1 *for variety-name enumeration only*. Approved sellers' own shops remain
  the only source of listings and buy links; breeder/wholesale catalogs remain
  facts-only references and are never sellers.
- **Spec §6 week-plan ordering** (as adjusted in DELTA-PLAN-DEC16.md §(c)) — Week 1
  gains the Library names extraction; Week 2's enumeration work becomes per-variety
  seller search feeding the approval queue, alongside crawling approved sellers.

## What does NOT change

- Seller approval still gates all crawling of a farm's shop; agents only propose.
- The evidence-quote rule still gates all publishing; a fact without a quote found
  in the stored snapshot is rejected.
- Exact/synonym matches on approved sellers auto-publish; model matches, new
  varieties, and seller candidates go to the owner's review queue.
- Large seed houses stay blocked by domain and are **never** sellers — including
  when they appear in the search results for a variety. A search hit at a large
  house is recorded as demand evidence at most, never as a listing.
- Launch date (Dec 16, 2026), launch gates, and the cut list are unchanged.

## Courtesy item — Floret (spec §8 Q3) — CANCELLED by owner 2026-11-16

The canonical spec's Q3 default was "ask Floret before crawling; hand use only until
agreed." The names-only Library extraction is now owner-directed. The courtesy email
that Q3 contemplated is **cancelled by owner 2026-11-16**:

- The **courtesy email to Floret will not be sent.** No outreach to Floret about the
  Library names extraction is planned.
- **robots.txt compliance applies to the Library crawl like any other source.** If
  the Library's robots.txt disallows the crawl, the crawl does not proceed — the
  variety names are gathered by hand instead, and that is recorded as the source.
- Floret remains an approved exemplar seller in its own right (episodic seed sales);
  that status is separate from the Library's role as a name reference.

## Amazon-model amendment (2026-11-16)

**Ruled by Dustin (owner) on 2026-11-16, voice call.** Variety pages follow the
Amazon model:

- **Every variety gets a PUBLIC, permanent page** — one canonical page per variety.
- **A small farm can REQUEST to attach its listing to a variety page** —
  Amazon third-party-seller style: one canonical variety page, multiple sellers
  attach to it. The request goes through the owner's existing hand-approval;
  nothing auto-publishes.
- **A variety page with no sellers stays up permanently**, showing a
  "currently unavailable / no sellers yet" state — it does not disappear and
  does not 404.

This amends the posture of canonical spec decision 8 (indexable = ≥1 published
listing OR ≥150 words of own notes; otherwise `noindex`).

**Indexability dial — SETTLED by owner 2026-11-16: zero-seller variety pages ARE
Google-indexable.** The rationale, in substance: these pages are not empty. They
are modeled on Floret Library entries, which rank at the top of search results
with no sellers attached — each variety page carries the variety name, a
description written in **our own words** (worked from the privately-held Floret
reference descriptions, never published), sourced attributes/facts, and artwork
(see the Artwork plan below). A full page earns its place in search whether or
not a farm currently sells the variety. This **supersedes canonical decision 8's
index rule for variety pages**: variety pages are indexable as published pages,
not gated on listings or note length.

## Artwork plan (2026-11-16)

**Ruled by Dustin (owner) on 2026-11-16.** Floret's photos are copyrighted and
must **never** be used — not copied, not hotlinked, not republished. Variety
pages still need an image, so:

- **For each variety, find a good reference photo** of that variety (reference
  only — it informs the artwork; it is never published).
- **Create an original painterly "Print Edition"-style illustration** inspired
  by the reference photo. The illustration is our own artwork, in the Print
  Edition manner used across Hues.
- **The illustration serves as the variety's image** on its page until a real
  photo exists — our own photo, or a licensed one. When a real photo arrives,
  it replaces the illustration.
- **Pilot batch first:** a small set of illustrations goes to the owner for
  style approval before any scaling. Once the style is approved, production
  scales crop by crop.
