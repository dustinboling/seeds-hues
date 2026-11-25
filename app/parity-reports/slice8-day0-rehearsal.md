# Slice 8 day-0 rehearsal record (repair)

Executed against the built app served in the fixed hermetic mode —
`SEEDS_API_BASE=stub:parity` on `dist-server/serve.mjs`, the exact mode
Lighthouse CI uses. Build: hermetic (`SEEDS_API_BASE=<parity-stub URL>`
for `npm run build` + `npm run build:server`, so prerender and machine
files bake stub data — zero live reads at build or serve time).
Dataset: `tests/parity/parity-catalog.ts` (shop/hub catalog + testbloom
grafts + 25-seller Ohio — the parity crawl's dataset).
Date: 2026-11-25. Method: item-by-item HTTP probes, no JavaScript.

This record mirrors the Slice 8 brief's Step-3 demonstration list: the
parity tally, budget table, and header matrix are stated with their
artifact/test pointers, and the day-0 rehearsal itself is executed
item by item below.

## Step-3 demonstrations

- **Parity tally:** 220 URLs crawled, 220 exact matches, 0 mismatches
  (168x200 / 23x301 / 3x302 / 24x404 / 2x410) — artifact
  `app/parity-reports/slice8-parity-report.md`, re-verified byte-identical
  on the repair tree by the final verify run.
- **Budget table:** per-template measured vs threshold, 15/15 PASS —
  artifact `app/parity-reports/slice8-budget-table.md` (this record's
  sibling; measured on this same hermetic serve).
- **Header matrix:** the hardening suite's 12-test header-matrix block is
  green, and this rehearsal re-proves the three highest-risk postures over
  HTTP against the hermetic serve: public SSR carries HSTS + nosniff +
  the document CSP (Turnstile, analytics, and image-CDN allowlists
  present) with the section-9 cache posture and no robots tag; admin HTML
  carries the stricter CSP (no external script/connect origins,
  `frame-src 'none'`) with no-store + noindex; unknown paths answer the
  app's own 404 page with a true 404 and no-store.

## Day-0 rehearsal, automatable subset (Bea section-10 pre-switch)

| # | Check (pre-switch item) | Result |
|---|---|---|
| R1 | Sitemap index lists the seven section-8.2 segments; each segment 200 + urlset | PASS — 7/7 listed, 7/7 200 with `<urlset` |
| R2 | No sitemap lists a paginated, filtered, or noindex URL | PASS — 7 segments clean (no `?`, no /search /report /account /unsubscribe /offline /go/ /og/ /api/ /admin) |
| R3 | Sitemap lastmod values are real dates, never build stamps | VERIFIED OMISSION — 0 `<lastmod>` emit on this dataset: no synthetic stub `updated_seq` matches the live-derived committed cache, so the seq-verified rule omits rather than emit an unverified date (the designed conservative behavior). The positive rule (verified seq emits its real date; stale/removed rows omit) is proven non-vacuously at unit level (`sitemap-rules`: verified emits 2026-11-20, stale/removed omit; `machine-files`: same over generated files). NOTE: the hardening suite's built-artifact lastmod test passes vacuously (0 dates) on stub builds — recorded, not misread as emission evidence. |
| R4 | Legacy + port-requirement redirect rows answer a single 301 to the final canonical | PASS — 18/18 rows 301 to the exact canonical, 18/18 landings 200 with no second hop |
| R5 | Unknown paths 404; wrong-case paths 404 (never a 200 duplicate) | PASS — /no-such-page-xyz 404, /Variety 404 |
| R6 | Merged varieties redirect one hop to the survivor, preserving ?small_farm=true | PASS — /variety/sweet-pea-old-ransom 301 to /variety/sweet-pea-kings-ransom; variant 301 with `?small_farm=true` preserved. Exercises the variety-status mount through the app. |
| R7 | Revalidate mount live (the freshness fan-out's trigger half) | PASS — authed POST /internal/revalidate `{tags:["seller:blue-ridge-seeds"]}` 200 with fan-out paths (`/`, `/crop`, `/seller`, the shop page, sitemap segments); unauth POST 401. The full fan-out (mutate-then-purge-then-fresh on both joined templates) is proven by the hardening suite's freshness test, which must mutate the stub in-process — not reachable over HTTP against the embedded stub. |
| R8 | Canonical URLs 200 across templates (the pre-switch crawl's 200 class) | PASS — 19/19 (5 Lighthouse URLs + variety with-sellers + zero-seller variety + shop + crop hub + series + state + about + api-docs + report + account + unsubscribe + admin sign-in + offline + llms.txt), all 200 with substantial bodies |
| R9 | Robots diff clean | PASS — served bytes equal the live recording modulo exactly the 3 sanctioned parameter disallows |
| R10 | Machine files + hooks: llms.txt, healthz, sw.js, OG images | PASS — /llms.txt 200, /healthz 200 `{"ok":true}`, /sw.js 200, /og/site/default 200 image/png |
| R11 | Gone/removed signals: removed seller 410, retired listing redirect 410 | PASS — /seller/shuttered-seed-co 410, /go/5 410 |
| R12 | Hermetic mount positives through the app (Slice 9's three mounts resolve via the embedded stub) | PASS — valid-token /unsubscribe renders the 200 confirm state naming Lonely Bloom (describe mount); GET /api/internal/admin/me relays the service verdict 200 `signed_in` (admin relay); merged 301 above covers variety-status |

Result: 12/12 verified (11 PASS + R3 verified omission, explained).

## Not rehearsed, and why

- **Post-switch Console resubmission + URL Inspection spot-checks** (one
  variety with sellers, one zero-seller variety, one seller, one crop
  hub): require the cutover (Google must fetch the new stack) — Slice 9.
- **Section-5.2 Search Console baseline capture** (performance, indexing,
  CWV, AI-answer panel): blocked on Console read access, still unarranged
  (Bea section-10 carried dependency) — capture the day access lands.
- **Days 1-7 watch + day-28 comparison + rollback trigger** (indexed drop
  > 10% or a section-8.2 canonical deindexed): require production time
  and the baseline above — Slice 9 runbook.
- **The DNS/edge switch itself:** inert slice — no deploy exists to
  switch; the serve paths rehearsed here (static, renderPage, relay,
  revalidate, machine files) are the Worker's 1:1 mirrors.
- **Real Turnstile / real mail+SMS sends:** the hermetic stub doubles
  these surfaces; no live credentials exist in rehearsal. Turnstile
  posture (exempt floor, verified JS path) is suite-pinned.
- **Freshness fan-out end-to-end over HTTP:** needs stub mutation, which
  is in-process only (see R7) — suite-proven, cited above.

## Slice 9 mount re-confirmation (summary; detail in the repair PR body)

Until Slice 9 mounts the three internal endpoints, the app degrades as
the gates recorded: variety-status faults throw fail-closed (merged
slugs 500, never wrong-404/301 — unit-pinned); unsubscribe describe
faults read as no scope (invalid-link state, 200 — HTTP-pinned on a dead
backend); the admin relay answers 502 JSON on an unreachable backend
(HTTP-pinned). Positive paths for all three resolve hermetically (R6,
R12). No Slice 9 mount changes rehearsed behavior except to replace
these degradations with live reads.
