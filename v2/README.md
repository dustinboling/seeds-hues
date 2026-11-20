# seeds.hues.flowers v2

A mobile-first PWA directory of flower-seed varieties and the **small, independent farm seed
sellers** that carry them. It is read-only, has no checkout, and every seller link goes directly
to the seller.

Stack: Next.js 16.4.6 (App Router) · React 19.3.1 · TypeScript strict · Tailwind 4 ·
Cloudflare Workers via `@opennextjs/cloudflare` 1.20.17 · D1 + Drizzle · Zod 4. Versions are
pinned exactly in `package.json`.

Specs: `~/workspace/seeds-hues/SPEC-CANONICAL.md` (adopted 2026-11-16) and the delta in
`.kiro/specs/seeds-v2-delta/` (wins over the original `V2-BUILD-SPEC-FINAL.md` /
`.kiro/specs/seeds-v2/` where they conflict). `DELTA-REPORT.md` records what the delta changed;
`BUILD-REPORT.md` and `VERIFICATION-LOG.md` cover the original build.

## Hard rules (summary)

- Sellers are small farms only. Large seed companies never appear in data, copy or tests. The
  importer and a test enforce this (`lib/catalog/assertions.ts` holds the only exclusion list).
- No invented data. Prices are stored, never shown (no price in any page, JSON-LD block or public
  API payload). Every listing shows its stock state as last seen, "Last checked {date}" and its
  source. Unknown facts print "Unknown". Ratings render "Not yet rated".
- Public URLs are singular: `/variety`, `/seller`, `/crop`, `/series` (plural paths 308).
- No seller photos and no hotlinked images. The only raster images are own-work variety and crop
  illustrations from the `media` table, served from our own image CDN
  (`images.seeds.hues.flowers`, R2 originals + on-the-fly transformations); everything
  else is typography, CSS swatches and generated OG cards. A guardrail test enforces this.

## Run locally

Requires Node ≥ 22.12 (built with Node 24).

```bash
npm ci
cp .dev.vars.example .dev.vars          # sets REVALIDATE_TOKEN for local runs
npm run db:setup:local                  # migrate local D1 → import catalog.json → publish version 1
npm run dev                             # next dev on :3000, with D1/R2 bindings from .wrangler/state
```

Production-like local run, using the real Worker bundle in workerd:

```bash
npm run cf:build                        # stamps public/sw.js, next build, OpenNext bundle
npm run cf:preview                      # wrangler dev on :8787 with local D1/R2/rate limiter
npm run acceptance -- --base http://localhost:8787 --report tmp/acceptance.md
```

Under `wrangler dev`, the response `Access-Control-Allow-Origin` shows the local origin, because
Wrangler rewrites the route host. The acceptance script allows for this.

### Checks

| Command | What it runs |
|---|---|
| `npm run verify` | ESLint + `tsc --noEmit` + all Vitest suites (unit, D1 integration, API contract) |
| `npm run acceptance -- --base <url>` | Delta acceptance over real HTTP against a local preview (`--skip-rate-limit` to skip the 429 burst). Mints + revokes local ingest/admin keys and runs the write flows on a throwaway `*.example` seller |
| `npm run api-key:create -- --scope ingest\|admin --label <text>` | Mint an API key (only its SHA-256 is stored; the token prints once). `--revoke <id>` revokes |
| `npm run rollup -- [--date YYYY-MM-DD]` | Roll non-bot `click_events` for a day into `daily_stats` (same as `POST /api/v1/admin/rollup`) |

The integration and contract tests boot a throwaway Miniflare D1 per suite, apply the real
migrations with `wrangler d1 migrations apply`, import `seed-data/catalog.json`, then delete it.

## Project layout

```
app/                    pages, /api/v1 route handlers, /api/revalidate, /api/track, og cards, manifest, sitemap, robots, llms.txt
components/             layout (header, tab bar, footer, SW registration), ui, search, variety, seller, seo
lib/db                  schema.ts (Drizzle), client.ts (the ONLY reader of env.DB)
lib/repositories        the only layer that imports Drizzle; atomic.ts (only db.batch), fts.ts (only FTS SQL)
lib/services            shared business logic (Server Components and API call the same functions)
lib/validators          Zod schemas = repository output validation = OpenAPI 3.1 contract
lib/api                 envelope, cursor pagination, ETag, CORS allowlist, rate limit, OpenAPI builder
lib/seo                 metadata + JSON-LD builders (with a prohibited-schema guard)
lib/catalog             catalog.json schema, fail-fast assertions, importer
migrations/             0000_init.sql (drizzle-kit), 0001_varieties_fts.sql (FTS5 trigram + triggers)
scripts/                import-catalog, publish-catalog, acceptance, gen-icons, build-sw, sw.template.js
seed-data/              catalog.json (the single source of seed data) + build-catalog.py
```

## Data operations

All data lives in D1 (binding `DB`). Pages read it through the service layer; nothing is read at
build time, so **data changes never need a redeploy**.

### Initial import

```bash
npm run db:import:local                                   # local
tsx scripts/import-catalog.ts --remote --config wrangler.remote.jsonc   # production (see below)
```

The importer loads `seed-data/catalog.json` as batch `initial-catalog`:

1. Zod-validates the file (strict: unknown keys fail).
2. Asserts 68 varieties / 32 sellers / 67 listings / 19 plants, no orphan FKs, no excluded
   company names, ≥ 1 source per variety and listing, and a source + date on every priced packet.
3. Inserts everything in one `atomic()` batch.
4. Rebuilds FTS, re-checks counts in the DB, then marks the batch published.

Re-running against a published batch is a no-op. Re-running against a staged batch replaces the
stage. Any failure exits 1 and writes nothing partial.

`content_level` (`thin`/`factual`) and `indexable` are computed at import. Index rule (owner
ruling 2026-11-16, superseding canonical decision 8): every active variety is indexable —
`index, follow` and in the sitemap — regardless of listings or notes.

### Publish a catalog version (snapshot flow, X12)

The catalog version bumps on **publish**, not on write:

```bash
npm run db:publish:local                    # or: tsx scripts/publish-catalog.ts --remote --config wrangler.remote.jsonc
tsx scripts/publish-catalog.ts --dry-run --out tmp/catalog.sqlite   # build + inspect, change nothing
```

The script:

1. Reads the current version from `catalog_publish`.
2. Builds a SQLite file holding only the allowlisted public tables
   (`lib/repositories/snapshot-allowlist.ts`). Sources, provenance, listing policy, clicks and stubs
   are excluded, and seller `listing_policy` is applied.
3. Uploads it to R2 `SNAPSHOTS` as `snapshots/catalog-v{N}.sqlite`.
4. Inserts `catalog_publish` version N.

`GET /api/v1/catalog/version` (never cached) then reports N, and
`/api/v1/catalog/snapshot/{N}.sqlite` serves the file. The script runs only in Node
(`node:sqlite`) and is never bundled into the Worker.

### Add or edit a variety, seller, listing or price

1. Write the change with `wrangler d1 execute DB --remote --command "…"` (or `--file`). Keep the
   rules: integer cents, and a `price_source` + `price_check_date` with every price (a CHECK
   constraint enforces this). Leave `rating_average` NULL while `rating_count = 0` (also a CHECK).
   Record the source.
2. Revalidate the affected pages:
   ```bash
   curl -X POST https://seeds.hues.flowers/api/revalidate \
     -H "Authorization: Bearer $REVALIDATE_TOKEN" -H "Content-Type: application/json" \
     -d '{"tags":["variety:sweet-pea-kings-ransom","seller:songbird-seed-co"]}'
   ```
   Tags: `variety:{slug}`, `seller:{slug}`, `plant:{slug}`, `category:{slug}`,
   `list:home|varieties|sellers|plants|categories`. Any `paths: ["/…"]` may also be passed.
   Variety pages otherwise refresh within 24 h (ISR).
3. Run `publish-catalog.ts` so the snapshot and catalog version match.

FTS stays in sync through triggers on `varieties`, `plants`, `variety_tags` and `variety_aliases`.

### Variety artwork

Own-work illustrations are served from R2 (bucket `seeds-hues-images`) through our own image CDN
at `images.seeds.hues.flowers` (migration completed 2026-11-18). The full-quality original
(1120×2240) lives in R2 only; rendering converts the stored public path to a sized copy on the fly
via `lib/images.ts` (`/cdn-cgi/image/width=<w>,quality=80,format=auto,fit=scale-down/<key>` —
scale-down only: shown whole, never cropped, never upscaled). There are no local `w480`/`w768`
variants any more, and nothing under `public/artwork/` ships with the Worker. The path → R2 key
map is generated by `npm run images:data` into `lib/images-data.ts`. Never overwrite an original
in place: originals are served `immutable`, so a replacement gets a new filename (and a new
stored path). To show one on a variety page, add a `media` row by SQL against production D1,
then revalidate the variety tag:

```sql
INSERT INTO media (variety_id, r2_key, licence, credit, created_at)
SELECT id, '/artwork/zinnia-queen-lime-blush.webp', '<licence>', '<credit line>', strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM varieties WHERE slug = 'zinnia-queen-lime-blush';
```

`r2_key` holds the **public path** for this class of media (the column name is historical). The
first row by `media.id` becomes the page hero and the OG image; `GET /api/v1/varieties/{slug}`
returns all rows as `media: [{url, licence, credit}]`. Media is not in the published snapshot.
A full catalog re-import wipes `media` (the importer asserts seed data ships none), so re-insert
the rows after any re-import.

### Crop artwork

Crops (plants) use the same mechanism through `media.plant_id` (migration 0004). The stored path
is `/artwork/crops/<plant-slug>.webp`; the original (1120×2240 for most crops) lives in R2 and
both the hero and the card thumbnail are transformations of it produced by `lib/images.ts` — the
app never generates image files and `thumbUrl` is no longer derived or returned. One row per crop:

```sql
INSERT INTO media (plant_id, r2_key, licence, credit, created_at)
SELECT id, '/artwork/crops/zinnia.webp', '<licence>', '<credit line>', strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM plants WHERE slug = 'zinnia';
```

Then revalidate `{"tags":["crop:zinnia","list:home","list:crop"]}`. The first row by `media.id`
is the crop page hero and OG image and the card thumbnail on the home grid and `/crop`;
`GET /api/v1/crops` and `GET /api/v1/crops/{slug}` return all rows as
`media: [{url, licence, credit, thumbUrl}]`. Crops without rows render exactly as before. The
re-import wipe above applies to crop media too.

### Seller removal requests (honour within 48 h)

Requests arrive through `/report` → `POST /api/v1/reports` as `review_items` of type `removal`.
Approve the item, or remove a seller directly, with an admin key:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_KEY" $BASE/api/v1/admin/review/<item id>/approve
curl -X POST -H "Authorization: Bearer $ADMIN_KEY" $BASE/api/v1/admin/sellers/<slug or id>/remove
```

Removal sets `eligibility = 'removed_by_request'`, every listing to `removed`, adds the domain to
`blocked_domains`, revalidates the affected pages, and makes `/seller/{slug}`, the seller API and
`/go/{id}` answer 410. Prices are never shown, so the old `no_prices` policy has no visible effect.

### Removing a single listing

A wrong or dead listing can be taken down on its own (the seller stays approved):

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"reason":"product page is gone"}' $BASE/api/v1/admin/listings/<listing id>/remove
```

`reason` is optional (max 500 chars) and is stored on the listing's `gone` event. The body may be
omitted. Idempotent: repeating it returns 200 with `already_removed: true` and writes nothing. An
unknown id is a 404 (`listing_not_found`). The variety and seller pages are revalidated.

### Outbound clicks

Shop buttons go through `GET /go/{listing_id}`, which writes `click_events` (no cookies, no IP:
a daily salted `visitor_day_hash`; set the `CLICK_HASH_SALT` secret before deploy) and 302s with
`utm_source=seedfinder&utm_medium=referral`. Variety pages beacon views to `POST /api/track`.
Read the demand lists with `GET /api/v1/admin/stats/demand` (admin key). The legacy
`outbound_clicks` beacon still works for the seller-homepage link.

## Backups / export (D1 Time Travel, X7)

- **D1 Time Travel is the backup story.** D1 keeps point-in-time history (30 days on paid plans).
  To restore: `wrangler d1 time-travel info seeds-hues` to find a bookmark or timestamp, then
  `wrangler d1 time-travel restore seeds-hues --timestamp <ISO>`. After restoring, revalidate and
  re-publish.
- **`wrangler d1 export` cannot export FTS5 virtual tables.** Around an export:
  1. `DROP TABLE varieties_fts;` plus its triggers (`varieties_fts_ai/au/ad`,
     `variety_tags_fts_ai/ad`, `variety_aliases_fts_ai/ad`, `plants_fts_au`).
  2. `wrangler d1 export seeds-hues --remote --output backup.sql`.
  3. Re-run the SQL in `migrations/0001_varieties_fts.sql`, then repopulate the index with the
     `DELETE`/`INSERT … SELECT` statements in `rebuildFts()` (`lib/repositories/fts.ts`).
- Published snapshots in R2 are immutable per version and double as read-only catalog backups.

## Deploy (handled separately — not done by this build)

One-time provisioning (account `51080ac04974bef5a30d7ceb5b79e9e2`):

```bash
wrangler d1 create seeds-hues               # put database_id into wrangler.jsonc (DB)
wrangler d1 create seeds-hues-tag-cache     # put database_id into wrangler.jsonc (NEXT_TAG_CACHE_D1)
wrangler r2 bucket create seeds-hues-cache
wrangler r2 bucket create seeds-hues-snapshots
wrangler secret put REVALIDATE_TOKEN
```

Then:

```bash
wrangler d1 migrations apply DB --remote
npm run cf:build
npx opennextjs-cloudflare deploy            # also creates the tag-cache `revalidations` table
```

- Once the workers.dev origin is known, add it to `CORS_ALLOWED_ORIGINS` in `wrangler.jsonc`
  (comma-separated, exact origins, never `*`).
- The `routes` entry binds the custom domain `seeds.hues.flowers`.
- For remote data scripts, copy `wrangler.jsonc` to `wrangler.remote.jsonc`, set the real
  `database_id`s and `"remote": true` on `DB` and `SNAPSHOTS`, then run
  `tsx scripts/import-catalog.ts --remote --config wrangler.remote.jsonc` followed by
  `publish-catalog.ts` with the same flags.
- After each deploy, request every sitemap URL once to warm the ISR cache. The spec's warm-crawl
  script is not built yet; `npm run acceptance -- --base https://seeds.hues.flowers` fetches every
  variety, seller and plant page and doubles as a warm crawl.
- Optional: set `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` (Cloudflare Web Analytics) and
  `NEXT_PUBLIC_CONTACT_EMAIL` (removal/opt-out contact) at build time.

## Phase 3 — accounts, waiting lists, Add Your Farm

Design: `USER-ACCOUNTS-DESIGN.md` + `PRODUCT-DESIGN.md` §3. Migration `0008_accounts_waitlists.sql`.

- **Accounts** (`/account`, `/api/v1/account/*`): name + email + phone + ZIP (→ USDA zone via
  `lookupZone()`, `lib/data/zones.ts`, table `lib/data/zip-zones.json` rebuilt by
  `npm run zip-zones`). Sign-in is the email + phone pair — no password, no sign-in codes.
  Session cookie `sf_session` (HttpOnly, Secure, SameSite=Lax, 30 days; only its SHA-256 is stored).
  One-time 6-digit codes verify the email (and, for texts, the alert number); they gate alerts,
  never the account.
- **Waiting lists**: the zero-seller variety pages carry the join panel (client-side, so the page
  stays ISR-cached). After any publish (ingest accept, admin approve/merge, catalog import) the
  matcher queues one alert per waiter per channel (`lib/services/waitlist-matcher.ts`).
- **Drain**: `POST /api/v1/internal/notifications/drain` (admin key) and the Worker cron
  (`worker.ts` → `lib/jobs/scheduled.ts`, every 15 min) send the queue: one email per user, one text
  per variety. Pause everything with `catalog_meta.notifications_paused = 1`.
- **Add Your Farm** (`/add-your-farm`, `POST /api/v1/farm-submissions`): pending review only.
  Draft summaries: `npm run farm-summaries` (add `--remote --config wrangler.remote.jsonc` for
  production) processes the queued `farm_summary` jobs from your machine or an external cron.
- **Admin**: `/admin/waitlist` (paste an admin API key; kept in an HttpOnly cookie on `/admin` for
  8 h) and the JSON routes `/api/v1/admin/waitlist`, `/farm-submissions/{id}/approve|reject`,
  `/farm-owners/grant|revoke`.

Production configuration needed before these forms and alerts work (none of it is in this repo):

```bash
wrangler secret put TURNSTILE_SECRET_KEY      # the real Turnstile widget's secret
wrangler secret put UNSUBSCRIBE_SIGNING_KEY   # random 32+ bytes; signs unsubscribe links
wrangler secret put TWILIO_ACCOUNT_SID        # when the SMS sender is registered
wrangler secret put TWILIO_AUTH_TOKEN
```

and in `wrangler.jsonc` vars: `TURNSTILE_SITE_KEY` (the real widget's site key), `SMS_PROVIDER`
(`twilio`), `SMS_SENDER_ID` (registered number, E.164), `ADMIN_NOTIFY_EMAIL`; plus the
`send_email` binding (`"send_email": [{ "name": "EMAIL" }]`) once seeds.hues.flowers is onboarded
for Cloudflare Email Sending. Point Twilio's inbound-message webhook at
`https://seeds.hues.flowers/api/v1/webhooks/twilio/sms`. Locally, `.dev.vars.example` lists
Cloudflare's public Turnstile TEST keys and `SMS_PROVIDER=mock`.

## Public API

`/api/v1` is read-only JSON with the envelope `{ data, meta, error }`, cursor pagination, ETag/304,
`X-API-Version: 1`, a CORS allowlist, 120 req/min/IP, and `X-Robots-Tag: noindex`. The contract is
`/api/v1/openapi.json` (OpenAPI 3.1, generated from Zod); human docs are at `/api-docs`. Breaking
changes go to `/api/v2`.
