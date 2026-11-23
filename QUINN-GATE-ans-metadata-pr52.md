# Quinn Gate — PR #52: ANS completion, variety metadata descriptions (roster out of meta/OG/Twitter)

**Verdict: PASS** (with notes N1–N3, none gating)

**Gate target:** PR #52, head `b361846`, diff vs brief commit `c4a4613` = 3 files:
`v2/lib/seo/metadata.ts` (+101/−1), `v2/tests/unit/variety-description.test.ts` (new, 340 lines),
`v2/tests/unit/tranche-1-4.test.ts` (6 lines). Brief: `muse-tasks/ans-metadata-descriptions.md`
(Bea SEO/GEO structure + Wren templates; coordinator rulings §4: sentence-or-nothing; zero-seller
clause immediately after the head). Ruling under test: Dustin, 2026-11-23 — "Remove it from the
metadata too" (extends PR #44).

**Four axes, kept separate:** Severity — no defects found; notes rated individually below.
Evidence — directly observed: my own verify run, my own local serve of the built branch, rendered
`<head>` strings quoted verbatim below, D1 queries against the serving data, and a non-vacuity run.
Nothing rests on the maker's claims. Coverage — ledger at the end. Verdict — this line.

**Evaluator structure:** single evaluator (Quinn). This gate turns on string identity, counts, and
absence checks established by rendered output and execution, not on rated impressions; no second
rater was commissioned and no severity rating here depends on one.

---

## 1. Verify reproduction — PASS (see errata, appended at the end of this record)

`npm run verify` (eslint + tsc + vitest) in the pre-materialized gate worktree at PR head:
the expected counts on this base are 70 test files / 1,191 tests (the branch forked from main
before PR #51 merged). Lint and typecheck passed; every test file in the change's reach —
including the new `variety-description.test.ts` (17/17) — passed in both of my runs. My first
full-suite run additionally showed 2 timeout failures in `tests/contract/api.test.ts` under
load; that file passes 48/48 in isolation. Full detail in the errata below — the original §1
text overstated the run as uniformly green and is corrected there.

## 2. Real-render proof — PASS

The built branch was served locally (`next dev`, local D1 seeded from the branch's own
`db:setup:local`) and the rendered `<head>` of real variety pages read from served HTML.
On every page below, meta description = og:description = twitter:description, byte-identical.

**(a) Multi-seller — Cinnamon Basil, 17 sellers.** The repo's seed catalog carries only 17 listings
in total (max 1 seller per variety), so the 17-seller fixture does not exist in local data. I
enriched my scratch local D1 only (repo data untouched): 17 distinct sellers listing
`basil-cinnamon`, packet seed counts 25 / 300 / 100 / null. Rendered description (129 chars):

> `Cinnamon Basil seeds. Listed by 17 US sellers in the Seed Directory. Packets from 25 to 300 seeds. Each listing links out to buy.`

Template B exactly (the seed catalog's Basil plant carries no Latin and the variety no prose, so
this is the Latin-absent/prose-absent form of B). Roster-free; the range 25–300 matches the
listings' own packet sizes, which the page body itself displays (25 seeds, 100 seeds, 300 seeds
all present in the rendered listings). Title keeps its count — `(17 Sellers)` — fence intact.

**(b) Zero-seller — Template C, clause immediately after the head, no numeral.**
`basil-cinnamon` before enrichment (83 chars):

> `Cinnamon Basil seeds. No US sellers currently list this variety. Join the waitlist.`

With prose that fits (sunflower-better-off-red, 154 chars) — clause second, prose after, per the
Flag-2 ruling:

> `Better Off Red Sunflower seeds (Helianthus annuus). No US sellers currently list this variety. Join the waitlist. Farm-bred sunflower from Adaptive Seeds.`

With prose whose first sentence cannot fit (sweet-pea-winter-elegance-mix, 330-char prose;
stock-katz-mix, 290-char prose) — head + Latin + clause only, **no fragment, no ellipsis**:

> `Winter Elegance Mix Sweet Pea seeds (Lathyrus odoratus). No US sellers currently list this variety. Join the waitlist.`

**(c) Single-seller — no "1 sellers", no "Compare 1 seller" class of string anywhere.**
sweet-pea-alison (prose absent, 140 chars), Template B singular + min=max range:

> `Alison Sweet Pea seeds (Lathyrus odoratus). Listed by 1 US seller in the Seed Directory. Packets of 10 seeds. Each listing links out to buy.`

sweet-pea-emma (prose absent, packet seed count null → range not computable → directory-clause
closing, 135 chars):

> `Emma Sweet Pea seeds (Lathyrus odoratus). Listed by 1 US seller in the Seed Directory. Sellers list packet sizes in the Seed Directory.`

zinnia-gift (Template A, abbreviation-safe first sentence, 156 chars):

> `Gift Zinnia seeds (Zinnia elegans). Offered by Hudson Valley Seed Co. in its artist-designed Art Pack line. Sellers list packet sizes in the Seed Directory.`

## 3. Name-absence census — PASS

Scripted census over all 13 rendered variety pages (strata: 17-seller, single-seller ×6,
zero-seller ×5, Latin-absent ×3, prose-absent ×5, prose-present ×6, long-prose ×3): on every page
the three fields are identical, ≤160 chars (range 83–156), no `…`, no `As of`, no roster verb
forms (`sellers list` / `seller lists` outside Wren's sanctioned clause), no `0 sellers`, no
`1 sellers`, no price token (`$\d` / "price"), no double space, no empty-parentheses artifact.
**13/13 clean.** The old roster syntax (from `answerSentence`: `As of {date}, {n} sellers list
{Name}: {A, B and C}.`) appears in no rendered description.

## 4. Template conformance — PASS

- **Head rule:** no duplication in any render — `Cinnamon Basil seeds` (name already ends in the
  crop word), `Dark Opal Basil seeds`, `Mother of Pearl Shirley Poppy seeds` (multi-word crop
  appended whole), `Gift Zinnia seeds`. Unit tests additionally pin case-insensitive and
  final-word-of-multi-word-crop cases.
- **Latin omitted cleanly when absent:** all three Basil renders show `… Basil seeds. …` with no
  parentheses and no double space.
- **Sentence-or-nothing on real data:** sweet-pea-kings-ransom (116-char prose; head+prose = 167
  > 160) renders Template B, not a clipped fragment. shirley-poppy-mother-of-pearl and
  snapdragon-rembrandt render Template A with the directory clause dropped whole (125/119 chars)
  rather than the prose shortened — clause is the only optional element, as specced.
- **Packet-range slot — implemented, and verified against the pages' own listings:** Alison
  "Packets of 10 seeds" = its listing's only seed count (10) in D1 and on the page; Cinnamon
  Basil "Packets from 25 to 300 seeds" = min/max of its listings' seed counts. When no seed count
  exists (Emma), the slot is omitted with no placeholder. One builder reading to record: the range
  and its `Each listing links out to buy.` closing are admitted as one unit — if the pair cannot
  fit whole, the range is dropped and the directory clause closes instead. That is consistent with
  the brief's assembly guarantee (optional elements admitted only whole); defensible, no change
  requested.

## 5. The touched pin (tranche-1-4.test.ts, 6 lines) — LEGITIMATE UPDATE, not a weakening

The old assertion pinned the pre-ruling behavior (zero-seller description contains the on-page
`zeroSellerSentence`) — the exact behavior Dustin's ruling removed. The change re-pins the same
test to the exact new shipped form (`toContain` of the verbatim 61-char Template C clause),
retitles the test to say so, and leaves the protective half untouched: the RETIRED-strings loop
below it still asserts every retired string is absent from both title and description. Equal
assertion strength, correct new target.

## 6. Fences — PASS

- **Data layer untouched:** the diff is 3 files; `lib/services/catalog.ts` and `variety-view.tsx`
  are not among them. `answer`/`answerSentence` behavior-identical — render-proved: zero-seller
  pages still render the on-page answer paragraph (`data-testid="answer"`): *"No seller found
  selling Cinnamon yet."* (also Dark Opal, Katz Mix, Winter Elegance Mix).
- **Titles untouched:** `varietyTitle` is outside the diff hunk; rendered titles keep their
  counts — `(17 Sellers)`, `(1 Seller)`, `(No Seller Found Yet)`.
- **No other page type changed:** within `metadata.ts` only `varietyDescription` and new private
  helpers/constants changed.
- **T-C (no prices):** census §3 — no price token or price language in any rendered description.

## 7. §5 structured-data check (performed by the gate; missing from the PR body — see N1)

`v2/lib/seo/jsonld.ts`: the variety page emits `breadcrumbJsonLd` (names/URLs only) and
`varietySellersJsonLd` (an ItemList of seller names + links — the seller list itself, with **no
`description` field**). No `description` field anywhere in variety structured data is fed by
`varietyDescription` or `.answer`; the only `description` fields in the file are the site
constant and `organizationJsonLd`'s seller description on seller pages (fed by the seller's own
description). Rendered JSON-LD on the sampled variety pages confirms: no `description` key, and
the roster is **not** relocated into any hidden field.

## 8. Non-vacuity — PASS

The new `variety-description.test.ts` (17 tests) was copied into a scratch worktree at the
pre-build tree (`c4a4613`) and run against the old `varietyDescription`: **17/17 FAIL**. Against
the PR head all 17 pass (inside the 1,191). The fixtures carry real rosters built by the
production `answerSentence`, so the census assertions bite on genuine roster strings.

---

## Notes (non-gating)

- **N1 (process, Minor):** the brief required the §5 structured-data grep result to be stated in
  the PR body; the body does not carry it. The gate performed the check itself (§7 above — it
  passes). Recommend the coordinator have the builder append the statement to the PR body for the
  record; no code consequence.
- **N2 (observation, no severity):** Template A's prose slot is the variety's own first sentence,
  verbatim — where that prose itself names a seller ("Offered by Hudson Valley Seed Co. in its
  artist-designed Art Pack line." — zinnia-gift, shirley-poppy-mother-of-pearl,
  snapdragon-rembrandt), a business name appears in the description *as prose*, not as roster:
  no dating, no count, no list syntax. This is the brief's design (the maker's own test pins this
  exact output) and is recorded here only so the coordinator sees it was noticed and judged
  against the brief, not overlooked.
- **N3 (coverage honesty):** the 17-seller render was produced on gate-enriched scratch D1
  because the repo seed catalog's largest variety has 1 seller. The rendering pipeline, code, and
  packet data path are the real ones; the fixture is synthetic. Production's real 17-seller
  Cinnamon Basil should be spot-checked after merge/deploy as the standing backstop.

## Coverage ledger

- **Population:** all variety-page descriptions the branch can produce (778 varieties in seed
  data; Templates A/B/C × Latin present/absent × prose present/absent/too-long × seller counts
  0/1/17 × packet range computable/min=max/absent).
- **Structured sample rendered (13 pages):** basil-cinnamon (0 sellers, Latin-absent,
  prose-absent; then the same page at 17 sellers), basil-dark-opal (0, Latin-absent),
  sunflower-better-off-red (0, prose fits), sweet-pea-winter-elegance-mix + stock-katz-mix (0,
  prose too long), zinnia-gift + shirley-poppy-mother-of-pearl + snapdragon-rembrandt +
  sweet-pea-bix (1, Template A, clause in/out), sweet-pea-alison (1, B, min=max range),
  sweet-pea-emma (1, B, range not computable), sweet-pea-kings-ransom (1, prose too long → B).
- **Adversarial additions:** the 17-seller enrichment (highest-count roster pressure), the
  abbreviation prose ("Seed Co.") on real data, the 167-char boundary case (King's Ransom).
- **Exclusions:** production data itself (pre-merge, production still runs the old code — see
  N3); other page types' metadata (proven unchanged by diff census rather than re-render);
  browser drive of the pages (this build changes only `<head>` strings on an unchanged page —
  the rendered-HTML read is the fidelity-appropriate evidence; no flow, form, or control is
  touched, so the human-interaction pass has nothing to exercise).
- **Residual risk:** a variety in production data whose prose first sentence interacts with the
  abbreviation/decimal rules in a way no seed-data prose exhibits could render Template B where
  A was possible (a safe fallback, never a fragment) — the failure mode is conservative by
  construction; the class this coverage could still miss is a *wrong-but-well-formed* sentence
  boundary in exotic production prose, visible in the post-merge spot-check.

---

## Errata (appended by Quinn after the record was first committed — §1 correction)

The first committed version of §1 reported my verify run as "70 test files passed, 1,191 tests
passed, exit 0." That was wrong: it rested on a green delivery that was not my run's terminal
output. My run's actual terminal result, delivered after the record was committed:

- Full `npm run verify` in the gate worktree: lint + typecheck green; vitest **69/70 files,
  1,189/1,191 tests** — 2 failures, both in `tests/contract/api.test.ts`, at least one a 60 s
  per-test timeout (`limit=5 cursor-walks all 778 varieties exactly once via page.next_cursor`).
  The run took 918 s with 70 vitest workers on this 1.5-shared-CPU VM.
- Re-run of `tests/contract/api.test.ts` alone immediately afterwards: **48/48 passed** (66.7 s —
  the file is intrinsically slow, its heaviest test living near the 60 s timeout even unloaded).

Judgment: the 2 failures are load-induced timeouts in an API-pagination contract file that the
PR diff cannot reach (the diff touches only `varietyDescription`, its new test file, and one
pinned assertion in tranche-1-4). Every test in the change's scope passed in both runs. The
verdict is unchanged — PASS — but the evidence is now stated as it actually ran: suite green in
scope, one unrelated contract file flaky under this VM's contention and green in isolation.
The PR's own CI on GitHub's runners remains the authoritative full-suite run for this base.
