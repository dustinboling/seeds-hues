# QA GATE — BUILD GATE: Seller-as-Shop (PR #66)

**Subject:** PR #66, github.com/dustinboling/seeds-hues — branch `muse/45322331462` @ `d9f7fd6`, base `main` @ `500f755`. 53 files, +4567/−551.
**Gate:** Quinn (QA specialist), single evaluator. Method: independent verify + full code review against the design of record + a real-browser usability drive on a locally served build with production-shaped fixtures (Playwright/Chromium, viewports 390/820/1280/320, forced-colors via CDP, JS-disabled contexts, fault injection).
**Date:** 2026-11-23.

## Verdict: PASS WITH NOTES

No Critical or Major findings. Four Minor findings (two are the flagged interpretations the gate was asked to judge; one is a shared-machinery edge; one is a shared-component accessibility deviation) and five Notes. None blocks merge; each Minor carries an owner and a disposition for Hue/Dustin.

## Independent verify

`npm ci` + `npm run verify` in a fresh scratch worktree (`~/workspace/seeds-hues-gate-pr66-wt`): **exit 0 — lint ✓, typecheck ✓, 105 test files / 1,576 tests, all passed.** Independently confirms the coordinator's green claim.

## Findings

### Minor 1 — Flagged interpretation (1): the shop's failure line diverges from every shipped sibling surface (SH-9.5 / CS-24)
Driven live by fault injection (history.pushState made to throw once; the in-place commit fails): the shop renders CS-24 verbatim — “That didn’t apply — you’re still seeing the previous results. Try again.” (curly apostrophes, no “filter”). All five shipped sibling surfaces (CropBrowse, CropDetailBrowse, HomeBrowse, SearchBrowse, SellerBrowse) render “That filter didn't apply — you're still seeing the previous results. Try again.” (straight apostrophes) from their own hard-coded constants. The build followed the design's CS-24 ruling for this surface; the inconsistency is design-vs-shipped, not a build error. **Disposition for Hue/Dustin:** either conform the shop to the shipped string or conform the siblings to CS-24 in a later tranche — one string everywhere.

### Minor 2 — Failure path: view, URL, and failure copy can disagree (SPEC §9.5 / InPlaceBrowse §2.5.6 contract)
Same injection: `settle()` swaps the committed snapshot (results + count line updated to the new state, “87 listings…”) *before* `history.pushState` runs; when pushState throws, the catch marks the commit failed and renders the failure line claiming the previous results stand — but the new results are on screen and the URL still shows the old state. The machinery's own stated contract (“the prior results, counts and URL stand untouched”) is violated on this path. Trigger in the wild is rare but real (e.g. Safari's pushState rate-limit under rapid filter tapping; quota errors). Shared machinery, predates this build; the shop is the first `computeLocal` surface, where this is the only failure path. Self-heals on the next successful tap. **Disposition:** repair in the shared layer (push before commit, or roll back the snapshot on nav failure) as its own tranche item; not a shop-build blocker.

### Minor 3 — SH-16a partial: search-field focus is not outline-carried in forced-colors
Forced-colors drive at 390px: chip focus outline solid 3px ✓; contact-row focus outline solid 3px ✓; **search field: outline-style none** — focus is carried by a border-color change (measured: `rgb(0,0,0)` at rest → `rgba(5,0,73,0.8)` focused). Visible and distinguishable, but SH-16a/Ada Ruling 10 specify an outline-carried ring on the search field. The field replicates the shipped search field's exact styling (the shipped /search input measures identically), so this is an inherited shared-pattern deviation, recorded against this surface because SH-16a names it. **Disposition for Ada/Hue:** one-line shared field fix (focus-visible outline that survives forced-colors) in a later tranche.

### Minor 4 — Process: PR body accounting missing
The brief (shop-build.md “PR body” + recovery brief step 5) required full accounting in the PR body. PR #66's body is the workflow stub (task file, run id, verify summary, “Files changed: 1 (+2/−2)” — the recovery run's own diff, misleading as PR accounting) plus an empty “Gate record” placeholder. No product impact; this record supplies the missing accounting.

### Notes
- **Flagged interpretation (2) — tier-4 substitution HONORS the design (SH-G3).** `v2/public/brand/poppy-pod-mark.png` (Elena's cited source) does not exist in the branch. The build's GENERIC_POD_MOTIF = `/ornaments/motif-poppy.webp` — the directory's own breadseed-poppy pod device, the same subject Elena designated as the universal generic mark, same 480×480 motif family/treatment as tier 3, self-hosted, served via lib/images, decorative on paper-deep. Provenance differs from ART-GRID-CARD §2.1's letter (not a derivation of the missing brand mark); the substance is satisfied — one generic pod device, never a stem, never another crop's identifying pod borrowed (poppy is the one pod Elena herself universalized). Tiers 3–4 are fixture-only (every production crop is plated); both rendered correctly in a component-level spot-render (motif-nigella tier 3; motif-poppy tier 4; alt="", aria-hidden, forced-color-adjust:none, bg-paper-deep).
- **SH-16b confinement passes; hue swatch dots are not exempt.** `forced-color-adjust:none` appears only on card artwork/placeholder images (true specimens) — never on chips, fields, rows, or state-bearing elements. The Hue swatch dots in filter chips (shipped `SwatchDot`, untouched by this PR) do *not* carry the exemption and render white under forced-colors; Ada's ruling permits the exemption for specimens but does not mandate it, and the family name beside each dot carries the meaning in text. No information loss; recorded for Ada's awareness.
- **320px page-level horizontal scroll is pre-existing platform behavior.** At 320px the page can be scrolled horizontally — measured identically on the shipped /crop and /variety surfaces (same chip-strip machinery) and on the homepage. The shop grid itself reflows correctly (2 cols, frames exact). Not introduced by this build; flagged as a platform observation for Hue.
- **No-JS streamed-content visibility could not be established locally.** With JavaScript fully disabled, the seller page's body sits inside React's hidden streamed segment in local dev (Suspense topology byte-identical to origin/main — one Suspense around the page body — so any residual risk is pre-existing and platform-level, not build-introduced). The floor's functional contract is fully proven: every control is a real link or GET form in SSR HTML and every URL state server-renders correctly (verified by curl + JS-disabled DOM drives). **Recommend a post-deploy no-JS spot check on production** to close this residual.
- **Register audit (SH-14/SH-G14): PASS.** Every changed file maps to S-1…S-14, L-1…L-9, G-1…G-9, the brief's machinery, or process files (muse-tasks briefs; the UI-DESIGN.md four→five-group conformance edit prescribed by the recovery brief). Nothing outside the register. Sub-checks: **variety-context ListingRow is byte-for-byte identical** to origin/main (proven by rendering the same fixture through both trees' components and diffing — zero token differences); wordmark `divider-stem-mini` still renders (homepage, 1 occurrence) while variety cards contain zero stem elements in every state driven; PlantRef.lifeCycle / VarietyRef.colorFamily / cropMedia payload additions are additive-only and brief-authorized (lifeCycle also appears additively on other surfaces' payloads — the brief's fewest-construction-sites placement).

## Checks executed (drive evidence)

Fixtures (local D1 only, production shapes): band sellers T=0 (real 0-listing seller), 8, 9 (SH-17 five-group), 24, 25; Songbird Seed Co. grown to **179 listings / 8 pages**; grouped-order shop; all-sold-out shop (5); single-crop (zinnia ×12) shop; 7 contact-matrix sellers; possessive sellers (real: Songbird Seed **Co.**, Three Brothers Blooms, The Gardener's Workshop, Johnny's Selected Seeds); Plant Good Seed-shaped locations seller (primary Chimacum, WA city/state-only physical + warehouse + mailing “226 West Ojai Ave Ste 101-539, Ojai, CA 93023”) + kind-undetermined + second-store sellers; media fixtures for tiers 1–2.

- **SH-1** PASS — header invariance by diff (only S-12/L-1 insertions) + rendered spot check (Floret header: badge, location, state link `/state/washington` intact).
- **SH-2** PASS — T=0/8 no tools; T=24 filters+sort, no search; T=25 all three; width-independent (T=8 tool-less at 1280px too).
- **SH-3** PASS — removers carry CS-12 accessible names verbatim (“Remove the Crop filter, Milkweed / Butterfly Weed” — comma form per CS-12).
- **SH-4** PASS — in-place discipline measured: exactly +1 history entry per deliberate change; typing replaces (0 net entries) with focus retained in the input and no document load (window marker survived); submit adds exactly 1; Back/Forward restore in place.
- **SH-5 / SH-19** PASS — chip counts reconcile with fresh server loads (4 crop chips sampled; cross-group: season held, hue chip count = combined load; zero-count crop chips under a held filter render “(0)” as live, operable links — 12 found under season=cool).
- **SH-6** PASS — clearing the query alone keeps filters and restores the sort strip; prior sort restored; “Clear search and filters” label with query active.
- **SH-7** PASS with the streaming caveat in Notes — no-JS floor: chips are working links, search is a plain GET form that narrows (verified in a JS-disabled context), every state renders from its URL.
- **SH-8** PASS — zero-combination line is the fixed CS-19 sentence (possessive-correct) with remover standing; no-matches CS-20 line; did-you-mean renders (“Did you mean Angel's Choir?” with a working link — names render as catalogued); all-sold-out notice (CS-21 form) over a fully listed grid.
- **SH-9** PASS — grouped default (orderable A–Z on top, unorderable A–Z below, no section chrome); count-line forms incl. “most recently checked first.”
- **SH-10** PASS — card anatomy: h3 variety link, stock line, Report link, /go pill (44px, target=_blank, rel includes nofollow).
- **SH-11** PASS — bounds against the narrowed total (season=cool: page 4 = 200, page 5 = 404; unfiltered page 8 = 200, page 9 = 404); in-place document title matches the SSR title for the same state.
- **SH-12** PASS — possessives: “Songbird Seed Co.’s shop”, “Three Brothers Blooms’ shop”, “The Gardener's Workshop’s shop” (name verbatim + ’s), “Johnny's Selected Seeds’ shop”.
- **SH-13** PASS — private `sellers.contact_email` appears nowhere in the rendered page including the RSC payload (fixture seller with a distinct private address).
- **SH-14** PASS — all seven matrix rows driven: labels “Visit their website (c1.example.com)”, “Customer service {phone|email}” (accessible names exact), tel: in dialable form (`tel:+18005550147`), rows ≥44px, DOM order website→phone→email, no absence copy beyond the shipped no-website line (row 7).
- **SH-15** PASS — both Ada Ruling 7 branches driven: remover with the applied row remaining → focus on Clear All; last remover and Clear All itself → focus on the “{name}'s shop” h2.
- **SH-16a** PARTIAL → Minor 3 (chip ✓, contact row ✓, search field border-carried). **SH-16b** PASS (see Notes).
- **SH-17** PASS as amended — five discriminating groups in order Crop·Season·Sowing method·Life cycle·Hue (+Sort) at 390px; **scroll distance H2→first card = 624px** (the honest PB-M6 cost with five strips; above Mina's ≈480px estimate); find task: one tap on the Milkweed crop chip isolates “Pleurisy Root” (count line “1 listing, in stock first.”), +1 history entry.
- **SH-18** PASS — multi-crop shops render Crop first; the single-crop zinnia shop renders no Crop strip while Sowing method and Hue strips render.
- **SH-20** PASS — forgiving parsing (unknown crop value ignored, 200 with the unfiltered state; valid-but-unstocked crop → zero-combination, not an error).
- **SH-21** PASS — grouped order driven on interleaved fixtures (orderable “Zanzibar” above sold-out “AA (Giant-Flowered)”; sold-out “Bergamo” above unknown “Cinnamon” within the bottom section — strict A–Z, no sub-tiering); `sort=name` is pure A–Z; `sort=recent` is ungrouped (freshest sold-out listing first); /variety default remains pure Name A–Z.
- **SH-22** PASS — locations area iff primary + ≥1 kind-determined location; primary-only and kind-undetermined sellers render no area; entries primary-first then kind (physical→warehouse→mailing) with kind labels and “Primary” as DOM text; section sits after the header, before About; area present on catalog pages 1 and 2 alike (not paginated with the grid).
- **SH-23** PASS — “Ojai” appears in visible text only in the two mailing-address lines inside the locations area; header shows Chimacum, WA only; seller index contains no Ojai; JSON-LD contains Chimacum, not Ojai.
- **SH-24** PASS — no street address in the header (fixture warehouse/mailing streets absent; city/state location stands).
- **SH-25** PARTIAL — mechanism verified (a seller's payload/area ships only its own locations; no sister-store strings exist in code or local data). The production-data half (The Refined Farm's real record) cannot be audited from a local gate.
- **SH-26** PASS — second locations seller shows only its own rows; no cross-render either direction.
- **SH-27** PASS (mechanism) — heading “{name}'s locations” with the possessive rule (fixture: “Fixture Plantgood Seed’s locations”); the real Plant Good Seed record is production data, out of local scope.
- **LOC-A1…A6** PASS as assertions — no tablist/tab/tabpanel semantics anywhere in the locations area; no links inside it; kind + Primary are DOM text; heading is a plain h2 in document order.
- **SH-G1** PASS — grid columns 2 @390 / 3 @820 / 4 @1280 (DOM-measured grid-template-columns).
- **SH-G2** PASS — art frame DOM-measured at 390px, CSS pixels, DPR 1: **141×282 (ratio 2.00)**, object-fit contain.
- **SH-G3** PASS — tier 1 own plate (alt “{variety} — illustration”), tier 2 crop plate (alt “Zinnia — illustration”) driven live; tiers 3–4 component-rendered (see Notes).
- **SH-G4** PASS — zero stem elements inside variety cards on /variety, /crop, shop, and filtered shop; skeletons carry the Latin bar and no stem (code + suite); `divider-stem-mini` still renders in the wordmark.
- **SH-G5** PASS — Latin verbatim: “Zinnia elegans”, the full “Asclepias tuberosa / A. incarnata / A. physocarpa”, “Dahlia × hybrida”.
- **SH-G6** PASS — Latin-less cards (marigold) contain no Latin node and no “Latin:” string.
- **SH-G7** PASS — long-Latin zone not clipped (scrollHeight ≤ clientHeight), zone is min-height-grown.
- **SH-G8** PASS — no dialog/sheet exists in the shop design as built (strips only); nothing to lock.
- **SH-G9** PASS — packet line renders (“Packets: 10 seeds · Packet (25 seeds)”); **no price string in any rendered surface or payload** (visible-text scan + payload key scan).
- **SH-G10** PASS — browse surfaces keep their shipped groups/order (/variety: Season·Sowing method·Life cycle·Hue·Sellers·Sort — the shop's Crop-first order does not leak).
- **SH-G11** PASS — all-sold-out shop: notice + cards in the transferred sold-out dress, pill still a working outline link.
- **SH-G12** PASS with the platform Note — 200% text: all 9 cards render, no card-level clipping; 320px grid reflows (page-level horizontal scroll is pre-existing, see Notes).
- **SH-G13** PASS — keyboard walk of a shop card visits heading link (44px) → Report → pill (44px) in order; browse card link name is “{varietyName} — {crop}” short form (“Alpenglow — Zinnia”); stock never carried by the dot alone (words present everywhere).
- **SH-G13a** PASS — WCAG 1.4.12 text-spacing overrides on the Asclepias worst-case card at 390px and 320px: no clipped line, no internal scrollbar, zone overflow visible (grows).
- **SH-G14** PASS — register audit (see Notes).
- **Migration 0018** PASS — additive-only (two nullable columns + new table; no drops/renames); Drizzle schema matches.
- **Admin endpoints** PASS — unauthenticated POST to both endpoints answers 401 problem+json; authenticated behavior (scope, validation, exactly-one-primary, idempotent re-apply, clear-by-empty-set, contact never touching `contact_email`) covered by the build's 17 integration tests, green in my verify and failing on main (T-A).
- **T-A spot-check** PASS — the build's seven new test files (unit/shop-browse, dom/shop-browse, unit/variety-card, unit/shop-contact, unit/shop-locations, integration/shop-payload, integration/admin-seller-shop-write) copied onto origin/main's code: **all 7 files fail** (40 tests failed, 6 passed — pre-existing behavior only); the same files pass on the branch.

## Coverage ledger

- **Population:** PR #66 (53 files) against registers S-1…S-14, L-1…L-9, G-1…G-9 and checks SH-1…SH-27, SH-G1…SH-G14 + SH-G13a, LOC-A1…LOC-A6.
- **Exercised end-to-end in a real browser:** every SH/SH-G/LOC-A check above except where marked PARTIAL (SH-25 production-data half, SH-27's real-record half) or carried by named equivalent evidence (SH-1 header invariance by diff + spot render; tiers 3–4 by component render — fixture-only tiers with no live case; skeleton states by code + suite).
- **Not run:** production-environment behaviors (no-JS visibility of streamed content on Cloudflare; production data audits for SH-25/SH-27); a screen-reader pass with a real AT (accessible names verified via role/name computation and DOM text, not NVDA/VoiceOver); the failure-path recovery tap after Minor 2's injection (suite-covered).
- **Evaluator structure:** single evaluator (Quinn). No second rater was commissioned for this gate; Athene cold-rating was not arranged by the parent. Residual risk concentrates in the two PARTIAL items and the inherited-machinery Minor 2, all named above.
- **Fixtures/data hygiene:** all fixtures lived in the scratch worktree's local D1 only; no production writes, deploys, or merges. Scratch worktrees removed after the gate; the fixture database went with them.
