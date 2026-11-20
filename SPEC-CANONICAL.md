# SPEC-CANONICAL — Seed Directory (formerly Seed Finder) product, API and data spec (ADOPTED)

> **Adopted by Dustin (owner) on 2026-11-16.** This document is the canonical spec for
> seeds.hues.flowers from that date. Where it conflicts with earlier project documents
> (PROJECT-BRIEF.md, V2-BUILD-SPEC*.md, V2-SCOPE-FULL-CATALOG.md, V2-KIRO-*.md,
> V2-DESIGN-PWA-API.md, V2-DEPLOYMENT-PHASED.md, KIRO-MASTER-BRIEF.md), **this spec wins**.
> Verbatim copy of `~/workspace/user/files/Seed_Finder_product__API_and_data_spec.md`
> (Nov 16, 2026). Delta implementation plan: `DELTA-PLAN-DEC16.md`.

> **RENAME (2026-11-16):** the product was renamed from "Seed Finder" to **"Seed Directory"** by Dustin. All user-visible strings use the new name; the domain (seeds.hues.flowers), URL paths, and internal identifiers are unchanged. The spec text below is the verbatim adopted document and keeps the original name where it appears.

> **OPEN DIRECTORY AMENDMENT (2026-11-19):** Dustin ruled the directory **open**: it lists a variety wherever the seed is available, from **any US seller, whatever its size** — the small-farms-only rule is **superseded** (principle 3, the seller-qualification paragraph, open question 1's default, and the size scope of decisions 5 and 25; see decision 26). Small family farms carry a **"Small farm" badge** — Hue's judgment call, recorded per seller on `sellers.is_small_farm`, with no formal test — and a **"Small farms" filter** narrows browse and variety listings to badged sellers. **US sellers only still holds.** The "Add Your Farm" page and route keep their name. Passages below that stated the old rule have been amended in place.

---

# Seed Finder: product, API and data spec

Nov 16, 2026 · @Dustin Boling

Seed Finder launches Dec 16, 2026 as a read-only directory: about 30 cut-flower crops, US sellers of every size (open directory — see the 2026-11-19 amendment), and no prices, reviews or accounts until after launch.

## 1. Product spec

Phase 1 earns trust and traffic and sells nothing: every cut flower seed variety, every US seller that sells it, in one place.

### Users and jobs

| User | Job to be done | What Phase 1 gives them |
| --- | --- | --- |
| Flower farmer planning a season | Find who has a named variety in stock from a real farm, before it sells out | Search by any name, sellers with stock state and check date, one tap to the shop |
| Home cutting gardener | Buy a variety they saw online from a seller they choose — small farms are badged so they can pick one | Plain pages that rank in search and AI answers |
| Small seed farm | Be found without paying for ads, and control how they appear | An accurate listing, traffic they can see in their own analytics, claim / correct / remove |
| Hues, as operator | Learn what growers want and cannot find | Outbound clicks, zero-result searches, views of varieties with no seller |
| Search and AI answer engines | Quote a sourced fact | Server-rendered pages, structured data, a public read API |

### Principles

1. **Nothing invented.** Unknown is a valid value, and the page prints "Unknown".
2. **Every fact carries a source and a date,** and the page shows both.
3. **Open directory (amended 2026-11-19; supersedes "Small farms only").** Any US seller, whatever its size, may be listed. Small family farms carry a "Small farm" badge — a judgment call, recorded on `sellers.is_small_farm` — and a "Small farms" filter narrows to badged sellers. Agents propose sellers; a seller is listed after review, and badging is an independent judgment applied afterwards.
4. **The farm gets the sale.** Phase 1 sends the click and takes nothing.
5. **Sellers can correct or leave at any time.** Removals are done within 48 hours.
6. **One backend.** The site, the apps and the agents all go through /api/v1.
7. **Sized for one person.** Few moving parts; anything not launch-critical waits.

### Scope by phase

| Phase | In | Out |
| --- | --- | --- |
| 1. Directory, launch Dec 16, 2026 | About 30 crops; US sellers of every size; variety, seller, crop and series pages; search; stock state with check date; outbound click tracking; claim / correct / remove; "Not yet rated"; public read API; installable PWA; agent ingestion with a review queue | Prices; review submission; user accounts; photos taken from sellers; non-US sellers; native apps; checkout; email alerts |
| 2. Native apps, no earlier than Mar 16, 2027 | iOS and Android on the same API; full catalog on device; push alerts for restocks and new sellers; accounts and review submission | Checkout; seller-managed inventory |
| 3. Marketplace | Third-party sellers selling on the platform; Hues selling its own seed beside them; a commission on sales; later, Fulfilled by Hues | Non-US sellers, in every phase |

Proposed launch crops, yours to edit: zinnia, snapdragon, sweet pea, cosmos, celosia, sunflower, dahlia from seed, strawflower, scabiosa, lisianthus, stock, larkspur, delphinium, statice, gomphrena, amaranth, ammi, bells of Ireland, bachelor's button, calendula, nigella, poppy, rudbeckia, foxglove, yarrow, marigold, China aster, phlox, orlaya, dianthus.

Work the crops in the order listed sellers stock them. A page with a seller is a page that gets indexed, so seller catalogs come before reference catalogs.

### User stories and acceptance criteria

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 1 | As a grower, I search for a variety by any name it goes by. | Two typed characters return matches on primary names and synonyms. A synonym match shows "also sold as". Zero results shows "Not in the catalog yet" and a report link. Every query is logged with its result count. |
| 2 | As a grower, I see every seller selling a variety. | Each listing shows seller, state, stock state as last seen, the date last checked and a source link. In-stock listings sort first. No price appears. A variety with no seller says "No seller found selling this yet". |
| 3 | As a grower, I go to the farm's shop in one tap. | The button routes through /go/\<listing id>, logs the click, and redirects to the farm's own product page with UTM tags. A dead link can be reported from the same row. |
| 4 | As a grower, I browse a crop. | The crop page filters by color family, series and "has sellers". It states how many varieties are cataloged, how many have sellers, and the date last updated. |
| 5 | As a grower, I judge a seller. | The seller page shows location, a link to the seller's own site, all its listings, and "Not yet rated". |
| 6 | As a farm, I claim, correct or remove my listing. | One form, verified by a link sent to the farm's email. A removal takes the seller page and all listings down within 48 hours and blocks the domain from future crawls. |
| 7 | As anyone, I can check where a fact came from. | Every listing shows source and date. An "About the data" page explains collection, the seller rule, the bot's name and how to opt out. The API returns the same provenance. |
| 8 | As operator, I clear the review queue in 30 minutes a day. | Keyboard approve, reject and merge. One decision on a name applies to every listing with that name and is saved as a synonym rule. |
| 9 | As operator, I see demand. | A private dashboard ranks outbound clicks by variety, zero-result searches, views of zero-seller varieties and clicks on sold-out listings, with CSV export. |
| 10 | As a grower in a field, I use it like an app. | Installable from the browser, usable one-handed at 390pt, and the last pages viewed open without signal. |

### Key screens, mobile-first at 390pt

| Screen | URL | Top to bottom |
| --- | --- | --- |
| Home | / | Search box; crop grid; recently restocked; coverage line |
| Search | /search?q= | Results as you type; "also sold as" on synonym matches; zero-result state |
| Crop | /crop/\<slug> | Intro in our own words; filters; variety list; coverage counts |
| Series | /series/\<slug> | Series facts; member varieties |
| Variety | /variety/\<slug> | Name and breadcrumb; key facts with "Unknown" where unknown; sellers with stock state, check date and shop button; "Not yet rated"; also sold as; report a problem |
| Seller | /seller/\<slug> | Name and location; link to the seller's own site; "Not yet rated"; listings; claim / correct / remove |
| About the data | /about/data | How data is collected; who qualifies; opt-out; the disclosure that Hues owns the site |
| Report or claim | /report | One form, three intents: correct, claim, remove |
| Admin | /admin | Review queue; seller approval; demand dashboard |

The main flow is three taps: search, variety, farm shop. The seller flow is email, claim link, correction form, review queue.

### Success metrics

Traffic targets are left blank on purpose: a new subdomain has no baseline, so set them from the first 30 days of Search Console data.

| Metric | Launch gate, Dec 16 | 90 days, proposed |
| --- | --- | --- |
| Approved sellers | 15 or more | 40 or more |
| Published listings with source and date | 100% | 100% |
| Published listings checked in the last 14 days | 95% | 95% |
| Match accuracy in a weekly audit of 50 random listings | 97% | 98% |
| Open removal requests older than 48 hours | 0 | 0 |
| Sellers who have claimed their page | none required | 40% |
| Share of variety-page visits that click out to a farm | measured | 25% |
| Largest Contentful Paint on a mid-range phone | 2.5 s or less | 2.0 s or less |

### Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Thin pages on a new subdomain | Near-empty pages can hold back indexing of the whole site | Zero-seller pages stay noindex; seller catalogs first; real growing notes on top crops |
| A farm objects to being listed | These are the farms Phase 3 depends on | Email before launch with a preview, one-form removal, UTM tags so they see the traffic |
| A listing is matched to the wrong variety | One bad match costs more trust than ten missing ones | Evidence-quote check, review queue, weekly audit, report link on every row |
| Hues uses the data to compete with listed farms | It is the Amazon private-label problem at farm scale | Disclose it, use variety-level demand only, give each claimed seller their own stats |
| Launch lands in sold-out season for some shops | Buy links lead to closed or empty shops | "Sold out when last checked" is shown, not hidden, and logged as demand |
| The review backlog outruns one person | Unreviewed records never publish | Decisions become rules, keyboard queue, crops cut before quality |
| Copied text or photos | Descriptions and photos are copyrighted; facts are not | Agents extract facts only; photos are own, open-licensed or seller-supplied |

## 2. Data model

Every published record points at a fetched source, and the database refuses a listing without one. The schema starts clean: the account has a preview Worker for the site and no seed database yet.

### Conventions that keep the Postgres move cheap

- **IDs** are text, a type prefix plus a ULID (`var_`, `sel_`, `lst_`), generated in app code.
- **Timestamps** are ISO-8601 UTC text. **Enums** are text with CHECK constraints. **JSON** is text validated in app code.
- **Unknown is explicit.** Enum facts default to `'unknown'`. Unknown numbers are NULL, never 0. A yes/no fact has three states: yes, no, unknown.
- **Every catalog table** carries `created_at`, `updated_at`, `updated_seq` and `deleted_at`. `updated_seq` comes from one global counter and drives app sync; `deleted_at` is the tombstone.
- **Nothing SQLite-only** in the schema except the search index, which is rebuilt from base tables.

### Entities

| Entity | Purpose | Key fields |
| --- | --- | --- |
| crops | Grower-facing hub, usually one genus | slug, common\_name, genus, family |
| species | Botanical species under a crop | scientific\_name, life\_cycle |
| series | A breeder's named series | name, crop\_id, breeder\_id, slug |
| breeders | Who bred a variety; never a seller by this table | name, kind (commercial, farm, unknown), seller\_id if also an approved seller |
| varieties | The page unit | see DDL |
| variety\_names | Every name a variety goes by | name, name\_normalized, kind (primary, synonym, trade\_name, misspelling, seller\_alias) |
| sellers | A US farm or seed company of any size; `is_small_farm` records the "Small farm" badge judgment | see DDL |
| listings | One seller offering one variety | see DDL |
| listing\_events | Append-only log of state changes | listing\_id, event (first\_seen, restocked, sold\_out, gone), at |
| sources | One row per fetched document | url, fetched\_at, http\_status, content\_hash, snapshot\_key, robots\_allowed, kind (web, human, seller) |
| observations | Append-only record of what an agent extracted | source\_id, agent\_run\_id, subject, payload, evidence quotes, confidence |
| review\_items | The human queue | type, proposal, reason, confidence, status, resolved\_at |
| crawl\_jobs | The job queue, with leases | type, target, status, lease\_expires\_at, attempts, next\_run\_at |
| agent\_runs | One row per agent run | agent, model, prompt\_version, tokens, cost |
| blocked\_domains | Sellers that opted out (removal requests) | domain, reason |
| assets | Photos with a license on every row | storage key, license, license\_url, attribution, owner |
| seller\_claims | A farm proving it controls a listing | seller\_id, email, token\_hash, verified\_at |
| reports | Public corrections, claims and removals | type, target, message, contact, status |
| reviews, rating\_summaries | Ratings; empty at launch | see below |
| click\_events, search\_events | Demand signals | see section 5 |
| api\_keys | Hashed keys with scopes | key\_hash, scopes, last\_used\_at |
| slug\_redirects | Old slug to current record | old\_slug, target\_type, target\_id |

### Core tables

```sql
CREATE TABLE varieties (
  id                TEXT PRIMARY KEY,            -- var_<ulid>
  slug              TEXT NOT NULL UNIQUE,        -- immutable once published
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('cultivar','series_member','mix','strain')),
  crop_id           TEXT NOT NULL REFERENCES crops(id),
  species_id        TEXT REFERENCES species(id), -- NULL = unknown
  series_id         TEXT REFERENCES series(id),
  breeder_id        TEXT REFERENCES breeders(id),
  color_family      TEXT NOT NULL DEFAULT 'unknown',
  pollination       TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (pollination IN ('open_pollinated','f1_hybrid','unknown')),
  ip_status         TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (ip_status IN ('none_known','pvp','patent','trademark','unknown')),
  height_cm_min     INTEGER,
  height_cm_max     INTEGER,
  days_to_bloom_min INTEGER,
  days_to_bloom_max INTEGER,
  notes_md          TEXT,                        -- our own words only
  field_sources     TEXT NOT NULL DEFAULT '{}',  -- JSON: fact field -> observation id
  primary_source_id TEXT NOT NULL REFERENCES sources(id),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','merged','retired')),
  merged_into_id    TEXT REFERENCES varieties(id),
  indexable         INTEGER NOT NULL DEFAULT 0 CHECK (indexable IN (0,1)),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  updated_seq       INTEGER NOT NULL,
  deleted_at        TEXT,
  CHECK (status <> 'merged' OR merged_into_id IS NOT NULL)
);

CREATE TABLE sellers (
  id                TEXT PRIMARY KEY,            -- sel_<ulid>
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  website_url       TEXT NOT NULL,
  domain            TEXT NOT NULL UNIQUE,
  about_url         TEXT,                        -- the seller's own About page
  platform          TEXT NOT NULL DEFAULT 'unknown',
  country           TEXT NOT NULL DEFAULT 'US',
  region            TEXT,
  ships_to          TEXT NOT NULL DEFAULT '["unknown"]',
  eligibility       TEXT NOT NULL DEFAULT 'candidate'
                    CHECK (eligibility IN ('candidate','approved','rejected','removed_by_request')),
  approved_at       TEXT,
  approval_note     TEXT,                        -- why this seller counts as small
  terms_reviewed_at TEXT,
  crawl_policy      TEXT NOT NULL DEFAULT 'manual_only'
                    CHECK (crawl_policy IN ('feed','html','manual_only','opted_out')),
  claim_status      TEXT NOT NULL DEFAULT 'unclaimed'
                    CHECK (claim_status IN ('unclaimed','claimed')),
  is_site_owner     INTEGER NOT NULL DEFAULT 0,  -- 1 for Hues, shown as a disclosure
  is_small_farm     INTEGER NOT NULL DEFAULT 0,  -- "Small farm" badge (2026-11-19): a recorded judgment call, not a measured size; set only through the admin path
  contact_email     TEXT,                        -- private, never in the API
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  updated_seq       INTEGER NOT NULL,
  deleted_at        TEXT,
  CHECK (eligibility <> 'approved'
         OR (approved_at IS NOT NULL AND terms_reviewed_at IS NOT NULL))
);

CREATE TABLE listings (
  id                  TEXT PRIMARY KEY,          -- lst_<ulid>
  variety_id          TEXT NOT NULL REFERENCES varieties(id),
  seller_id           TEXT NOT NULL REFERENCES sellers(id),
  product_url         TEXT NOT NULL,             -- must sit on the seller's domain
  variant_key         TEXT NOT NULL DEFAULT '',
  external_product_id TEXT,
  title_raw           TEXT NOT NULL,             -- as the shop wrote it
  availability        TEXT NOT NULL DEFAULT 'unknown'
                      CHECK (availability IN ('in_stock','sold_out','preorder','shop_closed','unknown')),
  price_minor         INTEGER,                   -- stored, not exposed in v1
  price_currency      TEXT,
  channel             TEXT NOT NULL DEFAULT 'external'
                      CHECK (channel IN ('external','marketplace','fulfilled_by_hues')),
  match_method        TEXT NOT NULL CHECK (match_method IN ('exact','synonym','model','human')),
  confidence          REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source_id           TEXT NOT NULL REFERENCES sources(id),
  source_url          TEXT NOT NULL,
  retrieved_at        TEXT NOT NULL,
  first_seen_at       TEXT NOT NULL,
  last_checked_at     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','published','stale','gone','rejected','removed')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  updated_seq         INTEGER NOT NULL,
  deleted_at          TEXT,
  UNIQUE (seller_id, product_url, variant_key)
);

CREATE TABLE rating_summaries (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('variety','seller')),
  subject_id   TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  average      REAL,
  state        TEXT NOT NULL DEFAULT 'not_yet_rated'
               CHECK (state IN ('not_yet_rated','rated')),
  PRIMARY KEY (subject_type, subject_id),
  CHECK ((state = 'not_yet_rated' AND average IS NULL)
      OR (state = 'rated' AND review_count >= 3 AND average BETWEEN 1 AND 5))
);
```

Rules that span tables live in one place, the publish function. A listing publishes only if its seller is approved, its URL is on the seller's domain, and that domain is not blocked. A nightly invariant query re-checks all three and alerts on any row that breaks them.

A seller qualifies by being a US seller of flower seed, of any size (open directory, 2026-11-19 — this supersedes the original small-farm qualification). Seller size is never a listing test. Small family farms are instead marked with the "Small farm" badge: a judgment call recorded on the seller (`is_small_farm`), applied independently of listing, after the seller is listed. Who grew the seed is not recorded and does not affect a listing: bought-in seed is listed the same way as farm-grown.

### Provenance

- **A source is a fetch.** Each fetch stores URL, time, status, a content hash and a snapshot, so any fact can be re-checked against what the page said that day.
- **An observation is a claim.** Agents never write catalog tables. They submit observations, and the server decides what publishes.
- **Listings copy their provenance.** `source_id`, `source_url`, `retrieved_at` and `confidence` are NOT NULL on every listing row.
- **Variety facts are sourced per field.** `field_sources` maps each non-null fact to its observation. The write path rejects a fact with no entry.
- **People are sources too.** Your edits use a source of kind `human`; a farm's corrections use kind `seller`.

### Variety taxonomy

- **The page unit is the variety**: a named cultivar, one color of a series, a mix, or a farm-bred strain.
- **Crop is the species-level hub.** Where a crop spans several species, the crop page groups by species. A species gets its own page once it holds 10 or more varieties.
- **Series is a hub.** Each color of a series is its own variety with `series_id` set.
- **Synonyms live in `variety_names`.** `name_normalized` is lowercased, accent-free and punctuation-free, with the crop word and pack-size words removed. It is unique within a crop, so one name can never point at two varieties.
- **Duplicates are merged, never deleted.** The losing row gets status `merged`, its names and listings move to the winner, and its slug becomes a redirect.
- **Farm-bred strains enter through the crawl.** An agent proposes a new variety with evidence, and it publishes only after review.

### Slugs and URLs

| Page | Pattern | Rule |
| --- | --- | --- |
| Variety | /variety/\<crop>-\<series>-\<name> | Lowercase ASCII, hyphens, apostrophes dropped, 80 characters at most |
| Seller | /seller/\<name> | From the farm's trading name |
| Crop | /crop/\<common-name> | One per crop |
| Series | /series/\<crop>-\<series> | One per series |

A slug never changes after publishing. A rename or merge adds a `slug_redirects` row and a 301. A collision appends the breeder, then a number. A removed seller returns 410. IDs never appear in public URLs; the API accepts either a slug or an ID.

### Ratings

"Not yet rated" is a stored state, not a missing value. The `rating_summaries` constraint makes an average impossible below three published reviews.

A review rates a variety, and optionally names the seller the seed came from. It holds an overall score from 1 to 5, optional scores for germination, vigor and vase life, and the grower's zone and year. The `reviews` table ships empty in Phase 1 so the API shape never changes. Rating markup is left out of structured data until a subject is rated.

### Claims, corrections and removal

1. A farm opens the claim link from your email, or submits the form.
2. A one-time link goes to an address on the farm's domain, or to the contact address its site publishes.
3. A verified claim lets the farm edit its own profile fields directly: description, logo, ships-to, photos.
4. Corrections to listings become review items with source kind `seller`, at the top of the queue.
5. A removal sets the seller to `removed_by_request`, removes every listing, returns 410 on the seller page, and adds the domain to `blocked_domains`.

In Phase 3 a claim becomes a seller account. Seller and listing IDs do not change.

## 3. API spec (/api/v1)

One REST API serves the site, the apps and the agents. Reads are public and need no key; every write needs a scoped key.

### Conventions

- **Base** is `https://seeds.hues.flowers/api/v1`. JSON only, snake\_case.
- **Envelope** is `{ data, page, meta }`. `page` holds `next_cursor` and `has_more`. `meta` holds `catalog_seq` and `generated_at`.
- **Errors** use `application/problem+json` with `type`, `title`, `status`, `detail` and a stable `code`.
- **Path segments** accept a slug or an ID.
- **Unknown is never omitted.** An unknown enum is `"unknown"`; an unknown number is `null`.
- **Every listing carries `provenance`,** and every variety and seller carries `rating`.

### Public read endpoints

| Endpoint | Returns | Filters |
| --- | --- | --- |
| GET /crops | All crops with coverage counts | none |
| GET /crops/{crop} | One crop with its species and series | none |
| GET /varieties | Paged varieties | crop, series, color\_family, kind, pollination, has\_listings, in\_stock, q, sort |
| GET /varieties/{variety} | One variety: names, facts, rating, listings | none |
| GET /varieties/{variety}/listings | Published listings for a variety | availability, ships\_to |
| GET /series/{series} | A series with its member varieties | none |
| GET /sellers | Approved sellers | region, q |
| GET /sellers/{seller} | One seller with profile and rating | none |
| GET /sellers/{seller}/listings | That seller's listings | crop, availability |
| GET /search?q= | Mixed results: varieties, series, crops, sellers | type, limit |
| GET /coverage | Per crop: varieties, varieties with sellers, last updated | none |
| GET /recent | Recently restocked and newly listed | crop, since |
| GET /sync/snapshot | The full catalog for on-device storage | none |
| GET /sync/changes?since={seq} | Changes and tombstones after a sequence number | limit |
| POST /reports | A correction, claim or removal request | Turnstile token required |

Outbound clicks use `GET /go/{listing_id}` outside the API path. It logs the click and answers 302.

### Response shape

Values below are placeholders that show the shape, not real records.

```json
{
  "data": {
    "id": "var_01JEXAMPLE",
    "slug": "zinnia-example-variety",
    "name": "Example Variety",
    "kind": "cultivar",
    "crop": { "slug": "zinnia", "name": "Zinnia" },
    "series": null,
    "also_sold_as": ["Example Var."],
    "facts": {
      "color_family": "unknown",
      "pollination": "open_pollinated",
      "height_cm": { "min": null, "max": null },
      "days_to_bloom": { "min": 75, "max": 90 }
    },
    "rating": { "state": "not_yet_rated", "average": null, "review_count": 0 },
    "indexable": true,
    "listings": [
      {
        "id": "lst_01JEXAMPLE",
        "seller": { "slug": "example-farm", "name": "Example Farm", "region": "OR", "country": "US" },
        "availability": "sold_out",
        "last_checked_at": "2026-12-15T09:12:00Z",
        "go_url": "https://seeds.hues.flowers/go/lst_01JEXAMPLE",
        "provenance": {
          "source_url": "https://examplefarm.example/products/example-variety",
          "retrieved_at": "2026-12-15T09:12:00Z",
          "method": "exact",
          "confidence": 1.0
        }
      }
    ]
  },
  "meta": { "catalog_seq": 48213, "generated_at": "2026-12-15T10:00:00Z" }
}
```

### Pagination, filtering and search

- **Pagination** is by opaque cursor: `?limit=24&cursor=...`, with a maximum limit of 100.
- **Filters** are exact-match query parameters. Several values are comma-separated.
- **Sort** takes `name`, `recently_checked` or `listing_count`, with a leading `-` for descending.
- **Search** matches every name in `variety_names`. Rank is exact name, then prefix, then full text, with varieties that have listings first on ties.

### Versioning

- The major version lives in the path. Within v1, changes are additive only.
- Removing or renaming a field means v2. Installed apps cannot be force-updated, so v1 stays up after v2 ships.
- Deprecations are announced with `Deprecation` and `Sunset` headers at least six months ahead.
- Clients identify themselves with `X-Client`, for example `web/1.0.0` or `ios/1.2.0`.

### Caching

- Read responses send `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400` and a strong `ETag`.
- The ETag derives from `catalog_seq`, so one counter invalidates every cached read.
- `If-None-Match` returns 304. `/go`, ingest and admin routes are `no-store`.

### Auth

| Scope | Who | How | Can do |
| --- | --- | --- | --- |
| public | Anyone | No key | Every GET above; POST /reports with a Turnstile token |
| ingest | Crawl agents | `Authorization: Bearer` with an ingest key | Lease jobs, register sources, post observations, propose candidates. Cannot publish or approve. |
| admin | You | Login in front of /admin, plus an admin key for scripts | Review, approve sellers, merge varieties, read stats |
| app, in Phase 2 | Native apps | App key plus a user token | Reviews, watches, push registration |

Keys are stored as hashes, shown once, revocable, and stamped with `last_used_at`.

### Rate limits

Limits use the Workers rate limiting binding, which counts per Cloudflare location and is approximate by design. Its window is 10 or 60 seconds, so every limit is per minute.

| Caller | Limit | On breach |
| --- | --- | --- |
| Public reads, per IP | 120 per minute | 429 with `Retry-After` |
| Search, per IP | 60 per minute | 429 with `Retry-After` |
| POST /reports, per IP | 3 per minute, plus Turnstile | 429 |
| Ingest key | 600 per minute | 429 |

Anyone who wants the whole catalog is pointed at `/sync/snapshot`, which costs one request, not thousands.

### Ingest and admin endpoints

| Endpoint | Purpose |
| --- | --- |
| POST /ingest/jobs/lease | Lease up to N jobs for a fixed time |
| POST /ingest/jobs/{id}/complete, /fail | Close a job or return it for retry |
| POST /ingest/sources | Register a fetch: URL, status, hash, snapshot key, robots result |
| POST /ingest/observations | Up to 100 observations; each is accepted or rejected with a reason |
| POST /ingest/seller-candidates | Propose a seller with evidence |
| GET /ingest/match-context?crop= | Current names and IDs for a crop, to match against |
| GET /admin/review | The queue, filtered by type and grouped by normalized name |
| POST /admin/review/{id}/approve, /reject, /merge | Resolve one item or a whole group |
| POST /admin/sellers/{id}/approve, /reject, /remove | Change a seller's eligibility |
| GET /admin/stats/demand | Clicks, searches and zero-result queries |
| GET /admin/health | Job, queue and invariant status |

Every ingest POST accepts an `Idempotency-Key`. An observation's identity is its source hash, product URL and variant, so a retried job cannot create duplicates.

### Bulk sync for native apps

- **`/sync/snapshot`** returns one compressed JSON file: `catalog_seq`, `schema_version`, then arrays of crops, species, series, varieties, names, sellers and listings.
- **`/sync/changes?since=48213`** returns `upserts` by type, `deletes` as type and ID pairs, `next_seq` and `has_more`.
- **Merged, removed and gone records arrive as deletes.** A merge also names the surviving ID.
- **Old clients resync.** If `since` is older than 90 days of retained changes, the server answers 410 with code `resync_required` and the app downloads the snapshot again.
- **The PWA uses the same snapshot** for offline search, so the endpoint is exercised from launch day.

Measure the snapshot in week 2. If it passes 5 MB compressed, move listings into their own file.

## 4. Data ingestion spec

Agents propose and the server decides. An agent can fetch, extract and suggest, but only an exact name match on an approved seller publishes without your review.

&#91;embedded content: ingestion pipeline · 6 steps, 1 decision\]

A record leaves the review queue only by your decision. Everything published goes back into the job queue to be re-checked.

### Where it runs

- The pipeline is a TypeScript command-line tool in the same repo, run on a schedule from GitHub Actions or your Mac.
- It reaches production only through `/api/v1/ingest` with an ingest key. Agents have no database access.
- The job queue is the `crawl_jobs` table. A worker leases jobs, and an expired lease puts the job back.
- There is no headless browser at launch. A shop that needs one is set to `manual_only`.

A table-backed queue is one less system to run, and it moves to Postgres unchanged.

### Sources, in priority order

| # | Source | Used for | Limits |
| --- | --- | --- | --- |
| 1 | Approved sellers' own shops | Listings, stock state, farm-bred varieties | robots.txt and terms per shop; structured data first |
| 2 | [Floret Library](https://library.floretflowers.com/), seed collections only | Which cultivars matter first: names and crop | Its page says the words and images are copyrighted. Take names and plain facts, link back, and ask Floret before crawling. |
| 3 | Breeder and wholesale catalogs | Series structure, pollination type, height, days to bloom | Facts only; these companies are never sellers |
| 4 | A botanical name authority | Accepted species names and synonyms | Check its license before bulk use |
| 5 | Web search for US farms and seed companies of any size | Seller candidates only | Every candidate goes to you |

The Floret Library profiles more than 1,500 varieties across seeds, bulbs and tubers, all grown and trialed on their farm. It is the best single list of what cut-flower growers care about, and it is not a popularity ranking. No source is mirrored: the catalog is a union, and each variety keeps its own source row.

### Fetch rules

- Identify as `HuesSeedFinderBot/1.0 (+https://seeds.hues.flowers/about/bot)`.
- Read robots.txt before every run and cache it for 24 hours. A disallow, or a robots.txt that answers with a server error, means no fetch.
- One request at a time per host, at least 5 seconds apart, honoring any crawl delay. Back off on 429 and 503.
- Use conditional requests. Store a compressed snapshot and hash of every page that feeds a record, and keep a new snapshot only when the hash changes.
- Prefer feeds. On Shopify stores, try `/products.json` when robots.txt allows it, then the sitemap and each product page's JSON-LD, then HTML.
- You read each seller's terms once at approval. Terms that forbid automated access set the seller to `manual_only`, and the outreach email asks for permission.

### Extraction schema

```json
{
  "schema": "listing_observation/1",
  "seller_id": "sel_01JEXAMPLE",
  "source": {
    "url": "https://examplefarm.example/products/example-variety",
    "fetched_at": "2026-12-15T09:12:00Z",
    "content_hash": "sha256:...",
    "robots_allowed": true
  },
  "product": {
    "url": "https://examplefarm.example/products/example-variety",
    "external_product_id": "unknown",
    "variant_key": "",
    "title_raw": "Example Variety Zinnia Seeds",
    "is_seed":      { "value": "yes",      "evidence": "50 seeds per packet" },
    "crop":         { "value": "zinnia",   "evidence": "Zinnia Seeds" },
    "variety_name": { "value": "Example Variety", "evidence": "Example Variety Zinnia Seeds" },
    "availability": { "value": "sold_out", "evidence": "Sold out" },
    "organic":      { "value": "unknown",  "evidence": null }
  },
  "match": {
    "variety_id": null,
    "method": "none",
    "confidence": 0.0,
    "candidates": []
  },
  "agent": { "run_id": "run_01JEXAMPLE", "model": "...", "prompt_version": "..." }
}
```

- **Every `value` is a real value or the string `"unknown"`.** Guessing is a schema violation.
- **Every value other than unknown needs `evidence`:** a short quote that appears word for word in the stored snapshot.
- **URLs are never constructed.** A URL must be one the fetcher retrieved with a 200.
- **Agents write no prose.** Descriptions on the site are yours or the seller's.

### Validation, on the server, in order

1. The schema version is known and every enum value is legal.
2. The seller exists, is approved, and its crawl policy allows the fetch.
3. The product URL's host is the seller's domain and is not in `blocked_domains`.
4. The source row exists and was fetched in the last 7 days.
5. Each evidence quote is found in the snapshot. One miss rejects the observation.
6. The key of seller, URL and variant decides between a new listing and an update.

Step 5 is the mechanical guard against invented data. A model can still misread a page, but it cannot cite text that is not there.

### Matching and dedupe

1. Normalize the extracted name the same way `variety_names` are normalized.
2. An exact hit within the crop is a match with method `exact` or `synonym`.
3. With no exact hit, fetch up to 10 candidates by text similarity. A model picks one or answers "none", with a confidence.
4. "None" becomes a new-variety proposal.
5. A product that bundles several varieties is logged and skipped at launch.

Every approved match saves the seller's wording as a `seller_alias`. The next crawl matches it exactly, so the queue shrinks as the catalog learns.

### Publishing rules

| Case | Result |
| --- | --- |
| Exact or synonym match, approved seller, is a seed product, evidence verified | Publishes automatically |
| Model match, at any confidence | Review queue, grouped by name |
| No match, or a new variety | Review queue; never automatic |
| Seller candidate | Review queue; never automatic |
| Blocked domain, off-domain URL or failed evidence check | Rejected and logged |

A model's confidence score is not calibrated, so it earns automation. Turn on automatic publishing for model matches at 0.90 and above only after two weeks in which you approved at least 98% of them.

### Review queue

- Items are grouped by normalized name, so one decision resolves every listing with that name.
- Keyboard actions: approve, reject, pick another variety, create variety, merge.
- Each item shows the snapshot excerpt, the evidence quotes, the candidates and the source link.
- Order: removals and seller corrections, then listing matches, then new varieties, then seller candidates.
- At 12 seconds a decision, 30 minutes a day clears 150 groups. The launch backlog is worked down inside build weeks 2 to 4.

### Re-crawl and staleness

| Record | Re-check | Marked stale | Unpublished |
| --- | --- | --- | --- |
| Listing at a feed seller | Daily | 14 days unchecked | 30 days unchecked, or missing on two checks in a row |
| Listing at an HTML seller | Weekly | 14 days unchecked | 30 days unchecked, or missing on two checks in a row |
| robots.txt | Every run | not applicable | A new disallow stops crawling at once and opens a review item |
| Seller terms page | Monthly hash check | A changed hash opens a review item | On opt-out, at once |
| Variety facts from reference sources | Yearly, in catalog season | not applicable | Never automatic |
| Seller discovery | Monthly | not applicable | not applicable |

Sold-out listings stay visible and labeled. A shop closed for the season is recorded as `shop_closed`, not as gone.

### Monitoring

- **Daily digest email:** jobs run and failed, listings added, changed and gone, queue size and oldest item, invariant results, spend to date.
- **Alerts:** a seller failing for 3 days; queue above 300 groups or oldest item above 7 days; any invariant failure; spend at 80% of the $150 cap.
- **Hard stop:** each agent run reads month-to-date cost from `agent_runs` and exits at the cap.
- **Weekly audit:** 50 random published listings checked by hand against the live pages, with the result recorded.

### Cost estimate

The data pipeline costs about $18 once and about $7 a month, against a $150 monthly cap. Volumes are placeholders until the week 1 crawl gives real counts. Prices are as of Nov 16, 2026.

| Line | Assumption | Cost |
| --- | --- | --- |
| Listing extraction and matching, launch load | 4,000 products, 2,500 input and 400 output tokens each, Claude Haiku 5.5 | $1.80 once |
| Variety enumeration | 600 reference pages, 6,000 input and 1,500 output tokens each, Claude Haiku 5.5 | $0.81 once |
| Hard matches and merge suggestions | 3,000 cases, 1,500 input and 200 output tokens each, Claude Sonnet 5.5 | $15.00 once |
| Monthly upkeep | 800 changed products on Haiku 5.5, 300 hard cases on Sonnet 5.5 | $1.86 a month |
| Cloudflare Workers Paid plan | Needed for server rendering | $5.00 a month |
| Page snapshots in R2 | Inside the 10 GB free allowance | $0 |

Haiku 5.5 is priced at $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100,000 tokens. Sonnet 5.5 is $2 and $10. The Batch API halves both.

At ten times these volumes the monthly total is still under $25. Money is not the constraint; your review time is. Coding agents used to build the site are a separate subscription and are not counted here.

## 5. Architecture notes

The whole product is one Cloudflare Worker, two D1 databases and one R2 bucket, plus a command-line ingester. Budget $5 a month, not zero.

### Components

| Component | Runs on | Notes |
| --- | --- | --- |
| Site and API | One Worker running the Next.js app | Pages and /api/v1 route handlers share one service layer |
| Catalog | D1, one production and one staging database | Schema changes only through migrations in the repo |
| Search index | A second, small D1 database with FTS5 tables only | Rebuilt from the catalog; keeps the catalog exportable |
| Files | R2 | Page snapshots, photos, the sync snapshot, weekly database exports |
| Ingester | Node command-line tool | Talks only to the API |
| Admin | Routes under /admin in the same Worker | Behind a login |
| Demand data | Event tables in D1 | Page views can come from Cloudflare's own analytics |

Server components call the service layer directly. Browser features and the apps call the HTTP API. Contract tests assert both return the same JSON, which keeps "one backend" true without the site calling itself over HTTP.

### Platform facts that shape the plan

All as of Nov 16, 2026.

| Fact | Consequence |
| --- | --- |
| Workers Free allows 10 ms of CPU per request, and Cloudflare says server-rendered apps usually need the Paid plan | Start on Workers Paid, $5 a month minimum |
| D1 on the Free plan stops answering once the day's row limits are used: 5 million read, 100,000 written | Another reason for Paid; also index every filter column |
| A D1 database tops out at 10 GB on Paid, and that ceiling cannot be raised | The catalog fits easily; event tables are what grow, so roll them up and prune |
| D1 processes one query at a time per database | Fine for a read-mostly directory, wrong for checkout |
| D1 Time Travel keeps 30 days of point-in-time recovery on Paid | Add a weekly SQL export to R2 on top |
| A D1 database with FTS5 tables exports only in a format that cannot be imported back into D1 | Keep FTS5 in its own database |
| Cloudflare zones carry AI crawler policies for Search, Agents and Training | Check the hues.flowers zone before launch; a block here defeats GEO |

Cloudflare's pages disagree on what those AI crawler policies default to for new domains, so look at the zone setting instead of assuming.

### Next.js on Workers: which adapter

Cloudflare's Next.js guide now recommends vinext as the default and keeps OpenNext for apps already built on it. vinext reimplements the Next.js API on Vite; it is not Next.js itself.

- Run `npx vinext check` on v2 this week. If it passes, use vinext.
- If the preview already runs on OpenNext and works, stay there through launch. Switching adapters mid-sprint adds risk and no visible benefit.
- Either way, use plain App Router features only: server components, route handlers, the metadata API. No Partial Prerendering.
- Pin versions and upgrade only between milestones.

### Migration path to Postgres

Move before Phase 3 work starts, not when D1 fills. Orders and inventory need concurrent writes and row locks.

1. Keep all SQL in the service layer, behind functions whose signatures do not mention D1.
2. Stand up Postgres and connect the Worker through Hyperdrive, which pools connections and is included in every Workers plan.
3. Port the schema: text timestamps to `timestamptz`, JSON text to `jsonb`, 0/1 integers to `boolean`, FTS5 to `tsvector` with trigram indexes.
4. Export D1, import, and compare row counts and the invariant queries.
5. Run the API contract tests against both databases until they match.
6. Pause the ingester, do a final copy, switch the binding, and keep D1 read-only for 30 days.

### SEO

- **Server-render every public page** with its full content in the HTML.
- **Index rule:** a variety page is indexable when it has at least one published listing, or 150 or more words of your own growing notes. Otherwise it sends `noindex, follow` and stays out of the sitemap.
- **Canonical URL on every page.** Lowercase, no trailing slash, 301 on redirects, 410 on removed sellers.
- **Sitemaps:** an index plus one file per type, indexable URLs only, `lastmod` from `updated_at`.
- **Titles written from facts,** aimed at "where to buy" intent: variety, crop, and the number of farms listing it.
- **Internal links** run crop to series to variety to seller and back. "Also sold as" names appear as visible text.
- **Freshness in text:** every listing row prints "Last checked" with its date.

### Structured data

| Page | JSON-LD | Why |
| --- | --- | --- |
| All | BreadcrumbList | Safe everywhere |
| Home | WebSite, Organization | Site identity |
| Crop, series | ItemList of varieties | Describes the hub |
| Seller | Organization, ItemList of listings | Describes the farm |
| Variety | BreadcrumbList, ItemList of sellers | No Product markup yet |

Google's product snippet needs a name plus one of review, aggregateRating or offers, and an offer needs a price. Phase 1 shows neither prices nor ratings, so Product markup would be invalid or invented. Add Product with offers when prices ship, and aggregateRating only once a subject is rated.

### GEO

- **An answer sentence at the top of each variety page,** built only from data: the date, the number of farms listing it, and their names.
- **/llms.txt** with the site name, a one-paragraph summary, and links to crop pages, the API description and the data policy. It is a convention, not a ratified standard, and costs about an hour.
- **Markdown alternates** of public pages, linked with `rel="alternate" type="text/markdown"`.
- **An OpenAPI description** of the public API at a stable URL.
- **robots.txt** allows search and AI crawlers and disallows /go/, /admin and the ingest and admin API paths.

### PWA

- Manifest, service worker and an offline fallback page.
- App shell precached; pages network-first with a cache fallback, so the last pages viewed open without signal.
- Catalog snapshot in IndexedDB for offline search. This is the first PWA feature on the cut list.
- One column, 44pt tap targets, sticky search, nothing that depends on hover.
- Budget: Largest Contentful Paint of 2.5 s on a mid-range phone, and 150 KB of JavaScript on a variety page.

### Outbound link tracking

`/go/{listing_id}` looks up the listing, records the click, and redirects with `utm_source=seedfinder&utm_medium=referral`. It keeps any query string the farm's URL already had.

| Table | Columns |
| --- | --- |
| click\_events | at, listing\_id, variety\_id, seller\_id, availability\_at\_click, page\_type, referrer\_host, client, visitor\_day\_hash, is\_bot |
| search\_events | at, query\_normalized, result\_count, clicked\_variety\_id, client |
| variety\_view\_counts | date, variety\_id, views |
| daily\_stats | date, variety\_id, seller\_id, clicks, sold\_out\_clicks |

- **No cookies and no stored IP addresses.** `visitor_day_hash` is a salted hash that rotates daily, used only to count unique visitors.
- **Bots are flagged and left out of stats.** `/go/` links carry `rel="nofollow noopener"`.
- **Raw events are rolled up nightly** and pruned after 13 months.
- **The demand dashboard is four lists:** most clicked varieties, most clicked while sold out, top zero-result searches, most viewed varieties with no seller.
- **Each claimed seller gets its own click counts by variety,** monthly. That is the trade for Hues reading the aggregate.

### Environments and backups

- The existing preview Worker becomes staging, with its own D1 database. Production deploys from the main branch.
- Migrations run in CI before each deploy, against staging first.
- Secrets live in Worker secrets. The ingest key is rotated quarterly.

## 6. 30-day launch plan

Thirty days at 50 hours a week is about 215 hours. Plan on 60% build and 40% data work, because seller approvals and the review queue are yours alone.

### Week by week

| Week | Dates | Build | Data | Exit test |
| --- | --- | --- | --- | --- |
| 1. Foundations | Nov 16 to 22 | Schema and migrations on staging and production; service layer; read API for crops, varieties and sellers; ingest endpoints; fetcher with robots.txt, rate limit and snapshots; first feed extractor | Approve the six exemplars; run seller discovery and approve from its candidates, with terms read; email Floret about the library; run the adapter check | One approved seller's catalog flows end to end into staging with provenance, and a planted bad record is rejected by the evidence check |
| 2. Ingestion at volume | Nov 23 to 29 | Matching and synonyms; publish function and invariants; review queue with keyboard actions; staleness jobs; plain seller and variety pages on staging | Crawl every approved seller; enumerate varieties for the crops they stock; start the queue | Every approved seller crawled; real counts replace the cost placeholders; a seller page good enough to show a farm |
| 3. Public site | Nov 30 to Dec 6 | Crop and series pages; search; /go tracking and event tables; index rule, sitemaps, structured data, llms.txt; report and claim form; data and bot pages; manifest and service worker | Send outreach emails with preview links by Dec 2; work the queue daily; write growing notes for the top five crops | The full click path works on staging at 390pt; emails are out; queue under 300 groups |
| 4. Hardening | Dec 7 to 13 | Caching and rate limits; digest email and alerts; weekly export; performance and accessibility pass; legal pages; demand dashboard | Handle replies, corrections and removals; remaining crops in seller order; queue under 50; first 50-listing audit | Launch gates from section 1 met on staging; audit at 97% or better |
| Launch | Dec 14 to 16 | Feature freeze Dec 14; full re-crawl Dec 15; launch Dec 16 | Final queue pass | Checklist below is all ticked |

Thanksgiving falls in week 2, on Nov 26. If the week 2 exit test is not met by Sunday Nov 29, start cutting from the top of the cut list that day.

Outreach on Dec 2 gives every farm two weeks to correct or opt out before launch.

### Launch-day checklist

- [ ] Full re-crawl finished in the last 24 hours, with no seller failing
- [ ] Invariant queries return zero rows
- [ ] No open removal request, and every opted-out domain is in `blocked_domains`
- [ ] Review queue under 50 groups
- [ ] Ten zero-seller pages spot-checked: each sends noindex and is absent from the sitemap
- [ ] robots.txt, the sitemap index and llms.txt resolve on production
- [ ] AI crawler policies on the hues.flowers zone are set as intended
- [ ] /go/ links for five sellers log a click and land on the farm's page with UTM tags
- [ ] "Not yet rated" shows on variety and seller pages, with no rating markup in the page source
- [ ] Google's Rich Results Test passes on one page of each type
- [ ] Home, crop, variety and seller pages meet the performance budget on a phone
- [ ] Install to home screen works on an iPhone and an Android phone
- [ ] Data, bot, terms and privacy pages are live and linked in the footer
- [ ] Workers Paid is active, spend alerts are set, and a database export has landed in R2
- [ ] Sitemap submitted to Google Search Console and Bing Webmaster Tools
- [ ] This morning's digest email arrived
- [ ] Rollback tested: the previous Worker version redeploys cleanly

### Cut list, first to go at the top

1. **Price capture.** Nothing visible changes.
2. **Series hub pages.** Series becomes a filter on the crop page.
3. **Markdown alternates and the OpenAPI file.** Keep llms.txt.
4. **Offline catalog search.** Keep the manifest, install and cached shell.
5. **Reference enumeration for crops no approved seller stocks.** Those pages would be noindex anyway.
6. **Photos.** Launch text-only and add your own after.
7. **Demand dashboard screens.** Events are still logged; query them by hand.
8. **Self-serve claim form.** A mail link, handled by hand.
9. **Full-text search.** Prefix match on names.
10. **Crop count.** From 30 to 15, then to 10.

Never cut: source and date on every listing, the seller allowlist, robots.txt compliance, the removal flow, the noindex rule, click logging, the evidence check, and "Not yet rated".

## 7. Phased roadmap

Apps wait for 90 days of live data. The marketplace waits for Postgres, sellers who ask to sell, and a legal review.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Bands are equal width, not to scale. Each diamond is a gate, with its criteria beneath it.

### After launch

| Phase | When | What ships | Gate to enter |
| --- | --- | --- | --- |
| 1.5 Prove it | Dec 17, 2026 to mid-March 2027 | Coverage past 30 crops; automatic publishing of model matches once earned; email alerts for restocks; monthly stats emails to claimed sellers; /sync/changes; the decision on showing prices | Launch gates met |
| 2. Native apps | No earlier than Mar 16, 2027 | iOS and Android on v1; catalog on device; push for restocks, new sellers and new varieties in a watched crop; accounts and reviews | 90 days live; sync stable for 30 days; email alerts in real use |
| 3a. Hues sells seed | When Hues has seed to sell | Hues listed under the same seller rules, flagged as site owner | The seller rule applied to Hues; disclosure live |
| 3b. Marketplace | After the gate | Seller accounts grown from claims; listings with price and inventory; checkout; commission; payouts | Postgres live; claimed sellers asking to sell on the platform; legal review done |
| 3c. Fulfilled by Hues | After 3b works | Hues stores and ships other farms' seed | Lot tracking and seed-test dates recorded per lot |

Email alerts in Phase 1.5 are the cheap test of the push-notification case. If growers do not sign up for restock emails, push will not carry an app.

### Design now so later phases need no rewrite

| Decision made in Phase 1 | What it protects |
| --- | --- |
| Prefixed IDs and slugs that never change | Apps cache them; orders will reference them |
| `updated_seq` and tombstones on every catalog table | On-device sync |
| Additive-only v1 and an `X-Client` header | Old app versions keep working |
| `listings.channel` and price columns present but unused | Marketplace offers attach to the same listing ID |
| Money as integer minor units plus currency | No rounding errors at checkout |
| `listing_events` log of restocks and sell-outs | Email and push alerts are readers of this log |
| Sellers kept separate from the people who manage them | Claims become accounts without touching seller IDs |
| API keys with scopes | App and partner access are new scopes, not a new system |
| All SQL behind the service layer | The Postgres move |
| `pollination`, `ip_status` and breeder on varieties | Filters for what Hues can fairly and legally produce |
| `is_site_owner` on sellers | Hues sells beside others with the conflict recorded in data |
| Click events carry listing, variety, seller and stock state | Commission attribution and production decisions |
| Reviews tied to a variety and an optional seller | Marketplace seller ratings come from the same table |

### Where I would push back on Phase 3

- **Demand data is fair at the variety level and risky at the farm level.** Using clicks to see that growers want a variety is fine. Reproducing a strain bred by a farm you list is the fastest way to lose the farms. Set the rule now: Hues does not produce another listed farm's own strain without that farm's agreement.
- **Not every in-demand variety can be produced.** F1 hybrids do not come true from saved seed, and protected varieties cannot be propagated for sale without a license. The dashboard should filter to open-pollinated varieties with no known protection before it suggests anything.
- **Selling seed is regulated.** Labeling, testing and seller licensing rules vary by state. Get advice before 3a, not before 3b.
- **Native apps are defensible for push, and little else.** Hold the gate.

## 8. Open questions and decisions log

Two questions block week 1; the rest have defaults that hold until you say otherwise.

### Open questions

| # | Question | Why it matters | Default until answered | Needed by |
| --- | --- | --- | --- | --- |
| 1 | Do large seed houses stay out, and what makes a seller small enough to list? | Growing its own seed was the test that kept them out. With that test gone, the allowlist needs a rule you can apply by hand. | **Resolved 2026-11-19 (decision 26):** large seed houses do not stay out — any US seller may be listed. "Small" is no longer a listing test; it is the "Small farm" badge, a judgment call recorded per seller. | Nov 18, 2026 |
| 2 | What v2 holds today, and which adapter the preview uses | Decides vinext or OpenNext, and what week 1 can reuse | Treat it as a fresh start; the account shows a preview Worker and no seed database | Nov 17, 2026 |
| 3 | Will Floret agree to its library being a name reference? | It is one of your exemplars, and its page asks that the work be respected | Ask this week. Until then use it by hand to set crop order, not by crawl. | Nov 23, 2026 |
| 4 | The color vocabulary for `color_family` | It is a filter on every crop page | A fixed list of about 12 families, set in week 1 | Week 1 |
| 5 | Are prices shown after launch? | Unlocks Product markup and comparison; raises staleness risk | Decide at day 30 from seller feedback | Jan 2027 |
| 6 | Does Hues list its own seed at launch? | Needs the site-owner disclosure live on day one | No, not until Hues has seed for sale | Before launch |
| 7 | Training crawlers on the hues.flowers zone: allow or block? | Affects how AI models learn the site | Allow all three policies | Before launch |
| 8 | Who answers removals when you are away? | The 48-hour promise has one person behind it | An auto-reply and a one-tap remove action in /admin on your phone | Before launch |
| 9 | How will reviewers sign in? | Sets the account model for Phase 2 | Email link, no passwords | Feb 2027 |
| 10 | Legal review for seed sales | Labeling, testing and licensing vary by state; this spec is not legal advice | Brief counsel during Phase 1.5 | Before Phase 3a |
| 11 | Traffic targets | No baseline exists for a new subdomain | Set from the first 30 days of data | Jan 2027 |

### Decisions log

All decided Nov 16, 2026, except decision 26 (2026-11-19).

| # | Decision | Basis |
| --- | --- | --- |
| 1 | Launch covers about 30 crops, with coverage shown per crop | Your answer |
| 2 | One page per cultivar, series color, mix or strain; crop and series pages are hubs | Your answer; the crop page doubles as the species hub |
| 3 | No prices shown at launch; stock state with a check date | Your answer |
| 4 | Photos are your own, openly licensed or seller-supplied | Your answer |
| 5 | Every seller is approved by hand; agents only propose *(seller size is no longer a criterion — see decision 26)* | Your answer |
| 6 | Farms are listed without asking, emailed before launch, and removed within 48 hours on request | Your answer |
| 7 | US sellers only at launch | Your answer |
| 8 | Zero-seller pages are noindex and out of the sitemap | Your answer |
| 9 | Ratings ship as schema and "Not yet rated"; no accounts or submissions in Phase 1 | Your answer |
| 10 | Day 1 is Nov 16, launch is Dec 16, at 50 hours a week | Your answer |
| 11 | Agent spend capped at $150 a month; 30 minutes a day of review | Your answer |
| 12 | Public read-only API with rate limits; keyed writes | Your answer |
| 13 | Hosting on Cloudflare Workers | Your answer |
| 14 | Native apps for experience and push, no earlier than 90 days after launch | Your answer |
| 15 | Plain tracked links now; click data guides what Hues grows; later a marketplace with commission and Fulfilled by Hues | Your answer |
| 16 | Floret Library is a reference for variety names, facts only | Your message, with the copyright limit added |
| 17 | Only exact name matches publish automatically at launch | My recommendation |
| 18 | Every extracted fact needs an evidence quote found in the snapshot | My recommendation |
| 19 | The ingester runs outside the Worker and writes only through the API | My recommendation |
| 20 | Workers Paid from day one | Platform limit on CPU time |
| 21 | Search index in its own D1 database | Platform limit on exports |
| 22 | No Product markup until prices or ratings exist | Google's product snippet rules |
| 23 | Prices are captured but not exposed | My recommendation; first on the cut list |
| 24 | A seller does not have to grow the seed it sells; bought-in seed is listed the same way | Your message |
| 25 | The 20 research candidates are dropped; sellers come from the six exemplars plus agent discovery, each approved by hand *(the hand-approval framing is superseded for seller size by decision 26)* | Your message |
| 26 | **Open directory (2026-11-19):** the directory lists any US seller regardless of size — the small-farms-only rule is superseded. Small family farms carry a "Small farm" badge (Hue's judgment call, no formal test; `sellers.is_small_farm`, set only through the admin path) and a "Small farms" filter narrows browse and variety listings to badged sellers. US-only (decision 7) holds. "Add Your Farm" keeps its name. | Dustin's ruling, 2026-11-19 |

Decisions 17 to 23 are mine. Strike any you disagree with and I will rework the sections they touch.

## Sources

Platform and policy facts were read on Nov 16, 2026. Seller counts, product counts and token volumes in this spec are planning assumptions, not data.

**Cloudflare**

- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): row limits, database size, Time Travel
- [D1 free tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/): queries fail past the daily limit
- [D1 FAQ](https://developers.cloudflare.com/d1/reference/faq/): the 10 GB ceiling and one query at a time
- [D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/) and [export with virtual tables](https://developers.cloudflare.com/changelog/post/2026-11-12-d1-export-virtual-tables/): FTS5 support and its export limit
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): CPU time, requests, the $5 plan
- [Vercel to Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/): server-rendered apps and the Paid plan
- [Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and the [OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/): the adapter recommendation
- [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/): windows and accuracy
- [Hyperdrive](https://developers.cloudflare.com/hyperdrive/get-started/): Postgres from Workers
- [AI crawler policies](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/) and the [Bots changelog](https://developers.cloudflare.com/bots/changelog/): the two pages that disagree on defaults
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): the free allowance

**Search and AI**

- [Google product snippet structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet): required properties
- [The /llms.txt proposal](https://llmstxt.org/): format and status
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing): Haiku 5.5, Sonnet 5.5 and batch prices

**Seed sources**

- [Floret Library](https://library.floretflowers.com/) and its [robots.txt](https://library.floretflowers.com/robots.txt): scope, copyright notice, crawl rules

---

## Amendment 2026-11-17 (Dustin, voice call) — packet sizes displayed

Packet sizes ARE shown publicly on listing rows (e.g. "Sizes: 50 seeds · 1/4 oz"), so buyers can see which farm offers a larger quantity of a variety. This applies to sizes only: **prices remain captured and NEVER displayed**, unchanged. Sizes are captured verbatim as each farm lists them (all variants offered for the item) and shown only when captured — never invented or inferred from product names.

Related rulings the same evening: every listing's outbound URL must be the individual item's product page (never a shop homepage, category, or search page); The Gardener's Workshop's complete cut-flower + filler assortment is to be enumerated in the first crawl, with any missing varieties added to the directory.
