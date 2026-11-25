# Slice 8 parity crawl report

Written by `tests/build/slice8-parity.test.ts` (deterministic — no clocks).
Dataset: `tests/parity/parity-catalog.ts` (shop/hub catalog + testbloom grafts + 25-seller Ohio).
Snapshot: `tests/parity/snapshot.ts` (live-recorded 2026-11-25 + v2-rule restatements).

## Tally

- URLs crawled: 220
- Exact matches: 220
- Mismatches: 0

By expected status:

- 200: 168
- 301: 23
- 302: 3
- 404: 24
- 410: 2

By proof:

- delta: 27
- live: 27
- rule: 166

## Row deltas (app value asserted, live value + ruling recorded)

- /varieties → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /varieties/sweet-pea-kings-ransom → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /sellers → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /sellers/blue-ridge-seeds → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /plants → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /plants/sunflower → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /categories → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /categories/sunflower → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety?v=sweet-pea-kings-ransom → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /seller?s=blue-ridge-seeds → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety/sweet-pea-kings-ransom/small-farms → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety/sweet-pea-kings-ransom/waitlist → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety/sweet-pea-old-ransom → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety/sweet-pea-old-ransom?small_farm=true → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety?page=1 → §4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)
- /seller?page=1 → §4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)
- /seller/blue-ridge-seeds?page=1 → §4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)
- /crop/sunflower?page=1 → §4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)
- /state/ohio?page=1 → §4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)
- /crop/ → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /about/ → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /variety/sweet-pea-kings-ransom/ → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /seller/blue-ridge-seeds/ → 301-uniform (live 308; Bea §8.4 recommendation, ruled delta)
- /report → US-spelling normalization (program rule; live 'honoured')
- /go/1 → m-3 utm_source rename (backend still composes seedfinder; the app ships seed-directory)
- /go/3 → m-3 utm_source rename (target query preserved)
- /healthz → Slice 8 uptime hook (new surface, no live equivalent)

## Out-of-compare-set deltas

- sitemap shape: live single /sitemap.xml urlset (1,144 URLs incl. ?page=N, recorded 2026-11-25) / app segmented index + 7 Bea §8.2 files, pagination excluded — Bea §8.2 + audit m-1 (port requirement)
- hub sitemap membership: live /add-your-farm absent from the single-file sitemap / app /add-your-farm present in sitemap-hubs.xml — Bea §8.2 hubs table (the deliberate +1, recorded in sitemap.ts)
- crop og:image: live portrait 1120×2240 artwork URL on crops with media (e.g. /crop/ageratum) / app generated 1200×630 /og/crop/{slug} card on every crop hub — Bea §11 item 3 (audit m-2 port item)
- home Organization keys: live no logo/sameAs keys / app logo + sameAs ([hues.flowers]) — Bea §11 item 2 (verified URLs only — nothing invented)
- 404 document title: live the home title (Next default-metadata fallthrough — v2/app/not-found.tsx sets no title) / app Page not found | seeds.hues.flowers — App chrome kept (prior slices + gates; needs Bea ruling at Slice 9 if exactness is required)
- admin gate status: live 307 (Next redirect()) / app 303 throughout — Observed only — auth chrome, robots-disallowed, Slice 7 gate-blessed; out of SEO parity scope
- US-spelling normalization: live honoured/honouring (report description, /about, /about/bot, /terms, llms.txt) / app honored/honoring throughout — Standing US-spelling constraint (this dispatch + Slice 2 decision, gate-blessed, pinned in slice2-surface)

## Mismatches

None — every crawled URL matches its snapshot row on status, Location, canonical, title, description, robots, and JSON-LD types.

## Residual-risk closure

- Slice 5 residual (state page 2): /state/ohio?page=2 crawled (25-seller Ohio).
- Shop page 2: /seller/blue-ridge-seeds?page=2 crawled.
- Crop page 2: /crop/sunflower?page=2 (+ every >24-member crop hub) crawled.

