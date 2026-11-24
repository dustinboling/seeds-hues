# QUINN GATE — SPA Slice 3: Variety routes (Seed Directory SPA conversion)

- **Subject:** PR #76, github.com/dustinboling/seeds-hues — "Slice 3 — Variety routes", head `fb305fa3c`
- **Reviewer:** Quinn Assurance (independent; did not make this work). Single-evaluator gate (see Coverage ledger).
- **Worktree:** `~/workspace/seeds-hues-gate-slice3-wt` at the PR head. No fetch/checkout/worktree/clone run; all work on disk.
- **Contract, in order:** (1) build brief `muse-tasks/spa-slice-3-variety.md`; (2) Bea's prerender-content audit `spa-conversion-2026-11-23/PRERENDER-CONTENT-AUDIT.md` §1, §1.1, §1.2, §3.1, §3.2, §7.2, §8.4 (variety rows), §9 — all read in full.
- **Date:** 2026-11-24 (America/Los_Angeles)

## VERDICT: PASS WITH NOTES

No Blocker, Critical, or Major defect found. Every contract check I ran passed, including my own independent built-artifact drive (12/12) with a different invalidation mutation than the builder's, and all four mutation spot-proofs were noticed by the suite. The notes below are Minor/Trivial, plus three disclosed items ruled acceptable-with-carry. Severity, evidence, coverage, and verdict are kept on separate axes throughout.

---

## 1. Verify chains (executed by me, clean install)

| Chain | Result | Evidence |
|---|---|---|
| app `npm ci` | exit 0 (588 packages) | directly observed |
| app `npm run verify` (lint + typecheck + test) | **exit 0 — 24 test files, 262 tests, all passed** | directly observed; matches the builder's claimed final green exactly |
| Slice 3 HTTP suite within it | `tests/build/slice3-variety.test.ts` — 37 tests passed | directly observed |
| v2 `npm ci` + lint + typecheck + test | all green (full v2 suite run in background, chain exit 0) | directly observed |
| Final confirmation `npm run verify` after mutation restore | exit 0 — 24 files / 262 tests | directly observed |

Builder accounting checks:
- **Final green 262 / 24 — CONFIRMED by my own runs (twice).**
- **Slice 3 adds 128 tests — CONFIRMED by summation** of the new test files in the commit (slice3-variety 37, variety-builders 35, variety-components 17, variety-route 11, og-card 10, variety-fixtures 6, price-guard 5, stub/derived 3, variety-filter 2, og-fonts 2 = 128). The builder said "9 files"; I count 10 test files including the stub-fidelity tests. Immaterial counting difference, not a finding.
- **Step-1 starting-red (HTTP suite 35 failed / 2 passed) — maker-claimed, unverified.** Arithmetically consistent (35+2 = the file's 37 tests) but I did not re-run the starting tree (outside my permitted commands). Evidence grade: maker-claimed.

## 2. My independent raw-HTML drive of the built artifact

I wrote my own contract suite (12 tests, my own counting/grep/invalidation code — not the builder's assertions), built the app against the test stub (`SEEDS_API_BASE`), served it through the shipped harness (`app/scripts/build-server.mjs` + `app/server/serve.ts`), fetched with plain HTTP (no JavaScript), then deleted the suite. **Result: 12/12 passed.** (One initial failure was a defect in my own decoder — React `<!-- -->` text separators — fixed and re-run green; the product was correct.)

Samples: (i) `sweet-pea-kings-ransom` with-sellers, (ii) `cosmos-lonely-bloom` zero-seller, (iii) `cosmos-candy-stripe` no badged seller, (iv) `sweet-pea-old-ransom` merged → (i), (v) `cosmos-mystery-bloom` unknown facts. Fixtures match the brief's (i)–(v) specification exactly (verified in `app/tests/unit/fake-catalog.ts`: 3 listings / 2 sellers / mixed stock / packets / notes / series / complete facts on (i); unknowns on (v)).

### With-sellers (§3.1 Quinn list) — all pass
200; `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (§9 values, not the old 22.7 h values); exact title "King's Ransom Sweet Pea Seeds — Where to Buy (2 Sellers) | seeds.hues.flowers" (real seller count); canonical == fetched URL; H1; `data-testid="answer"` with both real seller names and the Nov 20 date; all facts labels (Crop, Latin name, Series, Hue, Season, Sowing method, Pollination, Height, Days to bloom); exactly 3 `/seller/` anchors (one per listing); stock words In stock / Sold out / Preorder with Checked Nov 20 / Nov 18 / Not yet checked matching the data source; summary "2 shops · 1 in stock"; honesty line; hero `<img>` 1120×2240 from the site's own image CDN, alt v2-exact; sibling strip; OG + Twitter `summary_large_image`, og:image ≠ canonical (media image 1120×2240); no `noindex`; no loading/skeleton text.

### Zero-seller — all pass
200 with the same cache headers; no-seller title ("No Seller Found Yet" per the ported builder) and answer wording; **robots `index, follow` and no `noindex` anywhere (decision 27 upheld)**; waitlist floor form server-rendered (`POST /api/v1/account/waitlist/join-form`, hidden `variety`, named `email` / `channel` / `phone`, SMS consent text, submit "Join the waiting list"); facts with Series "None"; generated OG card as share image.

### Head exclusivity (my own counts, all three renders)
With-sellers, zero-seller, and variant each: **canonical 1, meta description 1, og:url 1, og:image 1, title 1.** The Slice 2 F6 duplicate-head failure does not recur.

### Variant (§3.2) — all pass
`?small_farm=true`: 200, `noindex, follow`, canonical to the clean URL (no query — asserted negatively as well as positively), only badged seller (Blue Ridge) in the listing region, legend present, `aria-current="true"` on "Small farms only", answer/facts remain full-set. Unbadged sample: empty-state copy, 0 seller anchors. Garbage values (`yes`, `1`, repeated `true&true`): ordinary indexable page, 200, 3 anchors — forgiving parse preserved. Internal path `/variety/{slug}/small-farms`: single **301** to the public URL, never 200.

### Status / redirect matrix (manual redirect handling, one hop each) — all pass
| Request | Result |
|---|---|
| unknown slug / malformed (`Bad_Slug`, `a--b`) | **404**, body is the 404 page ("We couldn't find that page"), no answer element, not the shell |
| merged `sweet-pea-old-ransom` | **301** → `/variety/sweet-pea-kings-ransom`; followed → 200 |
| merged + `?small_farm=true` | **301** → survivor with `?small_farm=true` preserved; followed → 200 noindex variant |
| `/varieties/{slug}` | **301** → `/variety/{slug}`; followed → 200 |
| `/varieties` (bare) | **301** → `/variety` (see ruling (b): target 404s until Slice 4) |
| `/variety?v={slug}` | **301** → `/variety/{slug}`; followed → 200 |
| internal `/variety/{slug}/small-farms` | **301** → `?small_farm=true` URL |

All permanent redirects are **301, uniformly** — the builder's stated pick, matching Bea §8.4's recommendation.

### Price guard — BOTH halves (§1.2)
1. **Code guard:** `assertNoProhibitedJsonLd` is ported with v2's full list (not narrowed), runs at render in `JsonLd`, and is exercised in `verify` (`jsonld-guard.test.ts`, 18 tests, green).
2. **My own rendered-HTML grep** (independent implementation): prohibited strings checked as JSON-LD types/keys in every LD block, `$`-amount pattern and `"price":` pattern over the page — **zero violations** on with-sellers, zero-seller, and variant. Packet sizes ("25 seeds", "50 seeds", "1 g") present and correctly not flagged. The only "price"-family hits are the two policy sentences (footer "No prices are shown."; honesty line "Prices are shown at the shop, not here.") — read individually per §5's rule; both are the never-shown policy posture, not prices.

### Cache-invalidation proof (executed by me, different mutation than the builder's)
Warmed page + variant; mutated stub listing id 2 (Prairie Seed House) `sold_out → in_stock`, checked date → 2026-11-22; confirmed **stale** state served first (Checked Nov 18, no Nov 22); POSTed `variety:sweet-pea-kings-ransom` to `/internal/revalidate` (paths returned include page **and** variant); re-fetched both **without cache-busting**: page serves Checked Nov 22, answer date Nov 22, "2 shops · 2 in stock"; variant serves the new answer date and counts while its listing region still correctly excludes the unbadged Prairie. **The §9 path works — the change does not wait for the s-maxage window.** The builder's own demonstration (listing 1 sells out) also passes in the shipped suite. Freshness spot-check: mystery-bloom renders "In stock · Checked Nov 19", equal to the stub source at fetch time.

### OG (§7.2) — all pass
All four kinds fetched over HTTP: `/og/variety/{slug}`, `/og/seller/blue-ridge-seeds`, `/og/crop/sweet-pea`, `/og/site/default` — each **200, `image/png`, 1200×630 read from the PNG header**. Malformed/missing/unknown-kind → 404, no card. Variety card copy verified at the builder level (`buildOgCard` title = "King's Ransom", the sample's real name); PNG text itself is not OCR-verifiable — see Coverage. Font bytes verified by SHA-256 against `PROVENANCE.json`: Fraunces byte-identical to `v2/app/fonts/fraunces-og.ttf`, Geist byte-identical to the exact file next/og ships in v2 — no fallback-font substitution.

### Structured-data inventory diff (§1.1, variety template)
Emitted on all three renders: exactly `BreadcrumbList` (Home → crop → series → variety, positions 1–4) + `ItemList` ("Where to buy King's Ransom seed", deduplicated by seller slug, `numberOfItems` 2 with-sellers / 0 with empty `itemListElement` zero-seller; variant keeps the full-set ItemList, narrowing is a view). **Diff against §1.1's variety row: exact match — nothing added, nothing missing, no prohibited type or key.** Note N3 below on the standalone inventory artifact.

## 3. Mutation spot-proofs (suite sensitivity — each applied, run, restored byte-identical)

| # | Mutation | Outcome |
|---|---|---|
| M1 | Drop one listing card (`SellerFilterSection`: render `sortedListings.slice(1)`) | **NOTICED** — 8 tests failed (5 HTTP incl. buy-section/freshness, 3 component) |
| M2 | Add `noindex` to zero-seller head (`listings.length === 0` in `varietyHead`) | **NOTICED** — 2 tests failed (HTTP decision-27 check + builder head check) |
| M3 | Variant canonical gains `?small_farm=true` | **NOTICED** — 2 tests failed (HTTP variant check + builder head check) |
| M4 | Price string in a listing note (fixture note → "Only $4.99!") | **NOTICED** — 3 tests failed (HTTP price check on page + variant, price-guard sensitivity) |

All four mutations were caught. Tree restored after each (byte-diffed against backups; final full verify green, §1).

## 4. Code review (diff read line-by-line in context)

71 files, +7,150/−23. Read: data layer (`api.ts` parsers, `load.ts`, `cache.ts`, `revalidate.ts`), route machinery (`variety-route.ts`, `redirects.ts`, `+data`, `head.ts`, `+onBeforeRoute`), view components (`VarietyView`, `ListingRow`, `SellerFilterSection`, `WaitlistBlock`), SEO (`meta.ts`, `jsonld.ts`, guard), OG (`card/render/serve`, font provenance), server harness (`serve.ts`, `build-server.mjs`), and the new tests as code.

- Design: sound — one backend (SSR consumes the same `/api/v1` JSON shape v2 serves), existing Slice 2 cache/revalidate machinery wired, not rewritten. `pathsForTag` fan-out includes page + variant + hubs + sitemap segments per §9.
- No strictness weakening: tsconfig change only adds `server/**` to `include`; eslint change only ignores the `dist-server/` build output. No `any`, `ts-ignore`, or non-null shortcuts in new production code (scan clean).
- Security: revalidate bearer compared with a constant-time equality; merged target validated against the slug pattern before it can enter a `Location` (no open redirect); JSON-LD escapes `<`; listing notes/prose render as React text (escaped); slug loader rejects anything outside `^[a-z0-9]+(?:-[a-z0-9]+)*$` before any data read. No secrets in code or logs.
- Complexity: no N+1 — one detail read, one plant-filtered list walk (cursor-paginated, limit 100) per variety render, both cached; counts derived in memory over bounded listing sets.
- Tests judged as code: assertions are exact strings/counts from fixtures (titles, dates, anchor counts, exclusivity counts), not presence-only and not change detectors — proven behaviorally by §3's mutations.

## 5. Usability drive (shopper goals, JS-disabled raw HTML — the gate mode for this slice — plus the shipped jsdom hydration tests for the filter)

Evaluator structure: single evaluator (Quinn); severity on Nielsen's 0–4 scale for usability items.

**Flow 1 — "Find where to buy King's Ransom and tell whether it's in stock."** Answer sentence directly under the H1 names both sellers; "Where to buy" section gives "2 shops · 1 in stock", the honesty line, and per-card seller name (loudest, linking to the seller page), location, stock word + dot, checked date, packet sizes, and a "Visit shop →" pill that is never disabled (screen-reader label announces the new tab). I could answer both questions from the first screen of HTML with no ambiguity. **No finding.**

**Flow 2 — "Join the waitlist for a variety nobody sells."** Zero-seller page states the position plainly, then a headed block "Join the waiting list — we'll let you know when a seller lists Lonely Bloom." with a native POST form: email, Email-only / Email-and-text choice with full SMS consent, phone with a plain-language hint, submit. The BusyForm failure pattern is absent by construction — no JS submit handler, no `disabled` control or fieldset anywhere in the form; the browser constructs the entry list natively from named fields (`email`, `channel`, `phone`, hidden `variety`), so the entered→constructed link of the evidence chain is native form semantics, verified in the markup. **Boundary:** the constructed→received link (actually submitting to `/api/v1/account/waitlist/join-form` and the account-aware join states) is Slice 6 scope, is not mounted in this inert harness, and remains **unchecked — owed at Slice 6's gate**, exactly as the brief scopes it.
- **U1 (Nielsen 1, cosmetic; Minor):** the email field's requiredness is only in markup (`required` attribute) — nothing visible distinguishes required email from optional phone before submit, beyond the phone label's "(only needed for text alerts)". Browser-native validation still surfaces the error at submit, and the rendering is v2-faithful. Note only; fix if Wren's copy pass touches the block.

**Flow 3 — "Show me only small farms."** Chips are real links pre-hydration with `aria-current` on the active one; the count line ("2 of 3 listings · Small farms only.") prevents the narrowed list reading as the whole market; the legend explains the badge; the empty state names the situation and offers "Show all sellers". Hydrated behavior (in-place toggle, one history entry per selection, Back/Forward re-sync, focus handoff) is pinned by the shipped jsdom tests, which I read and which pass. **No finding.**

**404 experience:** unknown URLs return the real 404 page — plain-language copy, search box, and hub links. No dead end. **No finding.**

## 6. Rulings on the disclosed items

**(a) Merged lookup reads a not-yet-existing internal endpoint — ACCEPTABLE WITH CARRY (with a correction).** The design is right: it mirrors v2's shipped seller-status precedent (`v2/app/api/internal/seller-status/[slug]` exists; the variety-status shape matches it), the D1 source function already exists in v2 (`mergedVarietyTarget` in `catalog-read.ts`), and the lookup fails *closed* — a non-200 throws rather than silently 404ing a merged slug. **Correction to the disclosure's wording (finding N1):** against the real API today the failure mode is not "merged slugs 404" — because every detail-miss consults the lookup, *merged and unknown slugs alike would surface a 500* until the mount exists. That is the safer failure (loud, not silent), and this tree is inert and undeployed, so nothing user-facing is affected. **Carry, binding:** the Slice 9 mount of `/api/internal/variety-status/[slug]` from D1 is a hard pre-cutover blocker for the merged redirects *and* for true-404 behavior on unknown slugs; the cutover checklist must name it in those words. In this slice the redirect is stub-proven only, and the gate accepts it on exactly that basis.

**(b) `/varieties` and `/variety?v={slug}` 301 to `/variety`, which 404s until Slice 4 — ACCEPTABLE WITH CARRY (note).** Verified by my own fetches: both 301s fire with the correct target; `/variety/{slug}` targets land 200 in one hop; only the bare browse index is unbuilt. The redirect rows are §8.4-correct today and become fully live when Slice 4 lands the index; nothing is deployed, so no live user can meet the 404. **Carry:** Slice 4's gate must re-test these two rows end-to-end (301 → 200).

**(c) Two deliberate deltas from live v2, following Bea §3.1 — ACCEPTED, no defect.** I confirmed both deltas in the v2 source (answer sentence gated to zero-seller pages at `variety-view.tsx`; Latin row omitted when absent). Bea §3.1 — the governing findability contract for this slice — explicitly requires the answer sentence with real seller names on with-sellers pages (its Quinn check cannot pass otherwise) and facts "rendered as the word Unknown, never omitted". The builder followed the contract over current v2 behavior, disclosed it, and documented both deltas in the `VarietyView` header. That is the correct hierarchy call. The deltas are improvements in the contract's terms (GEO substance at the top of every variety page; a complete, comparable facts list).

## 7. Findings (all notes; nothing returns to the maker)

- **N1 — Minor (disclosure accuracy).** Disclosed item (a) understates its blast radius: without the Slice 9 variety-status mount, unknown slugs 500 (fail-closed throw in `mergedVarietyTarget`, uncaught in `resolveVarietyRoute`) rather than merged slugs alone 404ing. Evidence: code read (`app/src/data/api.ts`, `app/src/server/variety-route.ts`) — directly observed; behavior against the stub is correct. Disposition: acceptable-with-carry per ruling (a); the carry wording in §6(a) governs.
- **N2 — Minor (accounting).** Builder's "128 tests in 9 files" — the 128 count is exact; I count 10 new test files including `tests/stub/derived.test.ts`. No action.
- **N3 — Trivial (program artifact).** No standalone `structured-data-inventory.md` exists in the tree (§1.2 names it as a plan artifact). The §1.2 diff itself was performed at this gate from emitted HTML and is recorded in §2 above, which serves as the diffable record for this template. The program should either produce the artifact in a later slice or formally accept gate records as its home. Not a Slice 3 brief deliverable; not gating.
- **U1 — Minor usability (Nielsen 1).** Waitlist email requiredness not visible before submit (§5, Flow 2). V2-faithful; note only.

## 8. Coverage ledger

- **Population:** the Slice 3 surface — `/variety/[slug]` (with-sellers, zero-seller, unknowns), the `?small_farm=true` variant (badged, unbadged, garbage), merged/plural/`?v=`/internal-path redirects, unknown/malformed 404s, `/og/[kind]/[slug]` × 4 kinds, the revalidate/invalidation path, the price guard, head exclusivity, structured data.
- **Structured sample:** all of the above, executed by the builder's suite (262 tests), my independent suite (12 tests, different invalidation mutation), and 4 reviewer mutations — every stratum in the population was exercised at least twice by independent code.
- **Adversarial additions:** garbage/repeated `small_farm` values; malformed slugs (uppercase, double-hyphen, spaces); stale-before-purge reads in the invalidation proof; price string injected into a listing note; dropped listing card.
- **Exclusions, with reasons:** end-to-end waitlist submission and account-aware join states (Slice 6 scope, not mounted — named unchecked in §5); `/go/{id}` click-through (route handler outside this slice's deliverables; link markup verified); PNG card *text* verified at the card-builder level, not by OCR of the raster; live production data (tree is inert; all data is the fixture catalog via the stub — fidelity is stub-level for data, real for code path, rendering, headers, redirects, and cache machinery); browser-with-JS drive of the filter (covered by shipped jsdom tests, read and green — no live-browser session was available to this gate); the Step-1 starting-red result (maker-claimed, §1).
- **Evaluator structure:** single evaluator (Quinn), no second rater commissioned for this gate; usability severities are single-evaluator judgments and are all ≤ Nielsen 1 in any case.
- **Residual risk:** defects that only appear against production-shaped data (818 real varieties — e.g. very long names in titles/OG cards, media variants beyond the one plated fixture), or in the production Worker's edge cache rather than the harness's edge mock, could still escape this coverage. The day-0 preview-deploy crawl in Bea §10 remains the control for that class, and ruling (a)'s carry is part of it.

## 9. Return conditions

Nothing returns to the maker. The slice may proceed to merge on this verdict, with carries (a) and (b) entered into the program record verbatim, and N1–N3/U1 tracked as notes.

— Quinn Assurance, 2026-11-24
