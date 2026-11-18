# Seed Directory — seeds.hues.flowers

Public directory: every cut-flower seed variety gets a permanent page
listing every small farm that sells it, with outbound buy links. Phase 1
is directory + traffic only — no ordering/checkout. **LIVE in production**
(launched 2026-11-16; formal launch Dec 16, 2026). User-visible name is
"Seed Directory" everywhere (the old name "Seed Finder" survives only in
internal identifiers and the bot UA).

## Canonical documents

- **Spec:** `~/workspace/seeds-hues/SPEC-CANONICAL.md` — adopted
  2026-11-16; where older project docs conflict, the spec wins.
- **Running record:** `~/workspace/seeds-hues/SEASON-FILTER-REPORT.md`
  (read it before changing anything; append outcomes there via Hue).
- Also in `~/workspace/seeds-hues/`: `PRODUCT-DESIGN.md`,
  `USER-ACCOUNTS-DESIGN.md`, `CRAWL-PASS-1-REPORT.md`; in this dir:
  `README.md` (data/deploy mechanics), `VERIFICATION-LOG.md`.

## Stack

- Next.js 16 + React 19, OpenNext on Cloudflare Workers (Worker name
  `seeds-hues`, custom entry `worker.ts`), mobile-first PWA.
- D1 + Drizzle: production DB `seeds-hues` (binding `DB`) plus a
  tag-cache D1; R2 buckets `seeds-hues-cache` (ISR) and
  `seeds-hues-snapshots` (published catalog snapshots).
- `/api/v1` runs the site; FTS5 search; Vitest + acceptance suite.

## Commands

- `npm run verify` — lint + typecheck + tests; must pass before handoff.
- `npm run cf:build` — build the service worker + OpenNext bundle.
- `npm run acceptance -- --base https://seeds.hues.flowers` — fetches
  every variety/seller/plant page; doubles as the post-deploy warm crawl.
- Local data: `npm run db:setup:local` (migrate + import + publish).

## Deploy route (sandbox-specific — follow it exactly)

- Deploying from inside `v2/` dies in R2 cache population. Run wrangler
  from a **neutral directory**, with `-c` pointing at this project's
  `wrangler.jsonc`, via the token wrapper `tmp/cf-run.py` (it injects the
  Cloudflare token from the connector store; never print or hardcode it).
- R2 snapshot uploads need `--remote` (a local-only upload once shipped a
  snapshot endpoint that 404'd live).
- D1 export backups are blocked by the FTS5 tables — additive-only
  migrations + the prior published snapshot are the safety net.
- Data changes (catalog publish) do NOT need a redeploy; code/artwork
  changes do (`cf:build` + deploy).

## Invariants

- **Prices are captured but NEVER displayed** — pages, API, nowhere.
  Packet sizes ARE displayed on listing rows. Ratings ship as "Not yet
  rated"; Google ratings appear only in the separate panel labelled
  "Reviews from Google", never blended into our rating fields or JSON-LD.
- **Sellers are hand-approved by Dustin**; agents only propose (ingest
  writes go through `/api/v1/ingest` with evidence-quote validation;
  exact name matches auto-publish, everything else queues for review).
  Small farms only — no large seed companies, with ONE exception:
  Johnny's Selected Seeds is allowed. US sellers only at launch.
- **Nothing invented:** unknown is a valid value and prints as such.
  Classifications (season, sowing method, hue, life cycle) are
  sourced-only, never guessed.
- **Floret Library = names and plain facts only.** Floret's descriptions
  and photos are private reference (`~/workspace/seeds-hues/` reference
  store) and are NEVER published. Public artwork is our own original
  illustrations.
- No source attributions displayed publicly anywhere ("(per …)" lines are
  banned; provenance stays in internal data) — sole exception: the
  "Reviews from Google" label.
- Every listing links to the variety's **individual product page** on the
  seller's site — never a homepage or collection page. Every variety
  page is public and indexable, including zero-seller pages ("No sellers
  yet — currently unavailable").
- No seller counts on crop cards. Illustrations are 1120×2240 (1:2),
  padded onto paper — never cropped or stretched. **No typography baked
  into any artwork.** Artwork files are immutable once served: a
  replacement ships under a new filename.
- URLs are singular: `/variety/`, `/seller/`, `/crop/`, `/series/`;
  outbound clicks go through `/go/{listing_id}` with UTM.
- Accounts: name + email + phone + ZIP, no password; sign-in is the
  email+mobile pair; email verification by 6-digit code; `is_farm_owner`
  is admin-set only. **Delete any test user and all its data after
  testing** — production account tables must stay clean.
- Phase 3 external blockers are Dustin's-hand items (Cloudflare Email
  Sending onboarding, Twilio sender, ADMIN_NOTIFY_EMAIL) — check
  `SEASON-FILTER-REPORT.md` / MEMORY before assuming email/SMS can send.
