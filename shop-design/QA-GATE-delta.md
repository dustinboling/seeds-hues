# Quinn Delta Gates — Seller-as-Shop (Seed Directory, seeds.hues.flowers)

**Gate:** Combined delta gates (design only — no build exists; nothing was executed against a branch or a browser). Three gates in one record: (1) delta re-gate of the base design gate's amendments A-1…A-5, footprints only; (2) the Locations delta; (3) the grid/card delta including the OQ-1/OQ-3 SPEC deltas.
**Record under gate:** `origin/main` at `7d23425`, `shop-design/` — base set (`SPEC.md`, `UI-DESIGN.md`, `COPY.md`, `ADA-RULINGS.md`, `ART-CONSULT.md`, `QA-GATE-design.md`) as amended by `e456550` (Nadia, A-1/A-2/A-3-SPEC/A-5), `bbc19ac` (Wren, A-4 + locations/grid copy), `342e5eb` (Nadia, OQ-1/OQ-3), `fad99b3` (Ada, both delta passes), `48a8986` (Elena, art rulings), `5d9a1d2` (Thea, typography), `7d23425` (Mina, A-3-UI + both UI deltas); delta documents `SPEC-LOCATIONS.md`, `UI-LOCATIONS.md`, `COPY-LOCATIONS.md`, `ADA-LOCATIONS.md`, `SPEC-GRID-CARD.md`, `UI-GRID-CARD.md`, `ART-GRID-CARD.md`, `TYPE-GRID-CARD.md`, `COPY-GRID-CARD.md`, `ADA-GRID-CARD.md`.
**Gate date:** 2026-11-22 · **Reviewer:** Quinn, QA (independent; no contribution to any document under gate except `QA-GATE-design.md`, whose amendments Gate 1 re-checks — the re-gate this gate's own §9 prescribed).

## VERDICTS

| Gate | Verdict |
|---|---|
| **Gate 1 — base amendments A-1…A-5, delta re-gate** | **PASS** |
| **Gate 2 — Locations delta** | **PASS WITH NOTES** (notes are the §4 numbering ruling, applied by this gate in this commit, and two record notes; no maker amendment is owed) |
| **Gate 3 — Grid/card delta + OQ-1/OQ-3 SPEC deltas** | **FAIL (scoped)** — one Major (D-F1) and two Minor (D-F2, D-F3) record defects, all in check/register text, none in the design's substance; precisely written amendments A-D1…A-D4 at §6, delta re-gate on those footprints only |

**Rulings made by this gate (final, recorded at §§4–5):** the locations check series renumbers **SH-22…SH-27** (base §13 series keeps SH-1…SH-21 incl. 16a/16b) — applied by Quinn to `SPEC-LOCATIONS.md`, `UI-LOCATIONS.md`, `ADA-LOCATIONS.md` in the same commit as this record; **SH-17 is amended to a five-group fixture** (amended text at §5).

**Clearance, stated before everything else:** the end state sought — the fully gated design (base + locations + grid/card + OQ-1/OQ-3), ready for Dustin's go — is **not yet reached**: Gate 3's amendments A-D1…A-D4 must be applied and pass a delta re-gate on their footprints. And **no build is briefed before Dustin's go regardless of any verdict in this record** — a PASS here clears paper, it does not commission a build.

---

## 1. Gate 1 — Delta re-gate of A-1…A-5: **PASS**

Footprints only, per `QA-GATE-design.md` §9. Nothing outside them was reopened. Each amendment was checked against the current on-main text (commit diffs read line by line, then the amended sections read in place):

| Amendment | Footprint checked | Result |
|---|---|---|
| **A-1** (F-1, focus landing) | SPEC §5.5 + §5.7; §13 SH-15 | **Applied in full.** §5.5 carries Ada Ruling 7 verbatim in substance — Clear All if the row remains; the "{name}'s shop" `<h2>` (`tabindex="-1"`, absent from the tab order, global ring under plain `:focus`, not only `:focus-visible`) if the row is removed; count announcement unchanged in both cases. §5.7 cross-references the general rule. SH-15 tests exactly the prescribed cases (last remover; Clear All from combined search + filters; remover leaving items applied → Clear All), with one announcement and no focus visit to `<body>` |
| **A-2** (F-2, CS-01 registration) | SPEC §12 S-12; §13 SH-1 | **Applied in full.** S-12 registers the label change as ruled in COPY §1 (CS-01: "Visit their website ({host})" replacing the shipped "Visit {name} ({host})"; destination, component, convention unchanged). SH-1's exception now names the S-12 label alongside the §3.5 rows. A build shipping the ruled label no longer presents a thirteenth difference |
| **A-3** (F-3, SPEC parts) | SPEC §9.2; §6.1 | **Applied in full.** §9.2 carries COPY §5's fixed CS-19 form ("No listings in {name}'s shop match those filters.", possessive per CS-05). §6.1 strikes the screen-reader-label + placeholder alternative and records Ada Ruling 6 as governing (visible label binding; alternative not approved; a placeholder is an example, never a carrier of scope) |
| **A-3** (F-3, Mina parts — `7d23425`) | UI-DESIGN §14 CS-01 + CS-19 rows | **Applied in full.** CS-01's obligation column now reads "shows the host (visible destination before the click, Nadia §3.5.1); label as ruled in COPY §1" — the prescribed text. CS-19's row carries the fixed form |
| **A-4** (F-4, COPY count — `bbc19ac`) | COPY §5 preamble | **Applied; substance conforms.** The on-main sentence reads "Thirteen of the fourteen stand exactly as specced (CS-21 among them, with its typesetting note the build must observe, below); one is flagged with a fix (CS-19)." A-4 prescribed thirteen-of-fourteen standing (CS-21 with its note) and CS-19 flagged. The preserved "the build must observe" clause — carried over from the superseded sentence — is judged **not a deviation**: it states the force CS-21's note already had in the base record (COPY §5's note text and Ada Ruling 12 both treat it as binding on the build), and it changes no count and no slot's verdict. The count now reconciles with the section's own 14-row table |
| **A-5** (F-5, check-series capture) | SPEC §13 cross-references SH-16a/SH-16b/SH-17 | **Applied, stronger than prescribed.** §13 carries all three as full check texts (forced-colors ring drive; `forced-color-adjust` confinement; PB-M6 fixture drive), not bare cross-references — the series is complete in one place |

**Note N-D1 (Minor, record accuracy; outside A-3's prescribed footprint, does not reopen this gate).** UI-DESIGN §14's CS-01 **Status** cell still reads "New ruling needed (OQ-2)", although COPY §1 has ruled CS-01…CS-03 and the base gate recorded PB-M2's sequencing condition as met. A-3 prescribed the obligation column only, and that column conforms; the status cell is stale text of the F-3 class in miniature. One-cell conforming fix at A-D5 (§6), owner Mina, riding Gate 3's re-gate pass for convenience — it blocks nothing.

**Gate 1 closes the base design gate.** `QA-GATE-design.md`'s FAIL is discharged: the base design (SPEC + UI-DESIGN + COPY + ADA-RULINGS + ART-CONSULT, as amended) is gated. Its §5b build inputs were settled by Dustin's later rulings the same day (phone column in; customer-service email as a separate public field; additive storage/write paths pre-authorized) and are not re-litigated here.

---

## 2. Gate 2 — Locations delta: **PASS WITH NOTES**

Checked against Dustin's Locations Rule as recorded in `QA-GATE-design.md` §10 and `SPEC-LOCATIONS.md` §§1–2 (one primary everywhere else; the shop page's info area lists all locations, each labelled by kind; separate-web-stores exception; TRF-LA/Scarsdale exclusion), and against `SPEC-LOCATIONS.md` §10's checks.

### 2.1 Rule coverage — every element present and consistent across all four documents

| Rule element | Disposition | Verdict |
|---|---|---|
| One primary everywhere else | SPEC-LOCATIONS §1.1 enumerates every surface (header Location entry + A4 link, StatePlate/StateShape, state filing, seller index, state pages, `PostalAddress` schema) and forbids a second location on any of them; check SH-23 (Plant Good Seed fixture: "Ojai" appears nowhere except inside the area, nowhere else in the directory) | ✓ |
| Shop info area lists **all** locations, labelled by kind | §§4–5: headed `<section>`, primary included and marked (§5.3), entries ordered primary → physical → warehouse → mailing → state → city (§5.2); Wren's ruled strings consumed verbatim by Mina — heading `{name}'s locations`, `Physical address` / `Warehouse address` / `Mailing address`, marker `Primary`, no intro line (COPY-LOCATIONS §§1–4 each satisfy their §6.1 slot obligation, incl. "Mailing address" never reading as a place to go) | ✓ |
| Area, not tab | §3 rules a headed section with weighed reasons; Ada LOC-A1 makes the negative binding (no `tablist`/`tab`/`tabpanel`, no roving tabindex, no disclosure pattern-matching — a tab-roled build FAILs) | ✓ |
| Kind-or-nothing | §6.2: kind is a record-level fact from the seller's own published presentation; an undetermined kind does not render and does not count toward the area's two-location minimum (§5.4). Ada L-A4 confirms the floor this creates (no unlabelled state exists to cover) | ✓ |
| Graceful absence | §5.4 (minimum two qualifying locations; no absence copy, no reserved space) agreed three ways: Mina §7 (page byte-identical to base when absent), Ada L-A2 (absence in the accessibility tree exactly as on screen — no empty section or landmark) | ✓ |
| Granularity | §5.1.1: full published business address verbatim, city/state only where that is all the seller publishes; hard limits (never complete a partial address, never derive, no map/directions/geocoding) | ✓ |
| Separate-web-stores exception | §2: the design's unit is one store's record; genuinely separate stores are separate records with their own primaries; the boundary is a data determination made on the record before render, never a render-time computation; locations never combine across stores; fixture check SH-26 | ✓ |
| TRF-LA / Scarsdale exclusion | §2.4: the sweep cleared Scarsdale (it belongs to the sister store, the rice factory NY, which holds no record); Scarsdale is **not** a TRF-LA location and must not appear in its area; SH-25's fixture renders no Scarsdale entry | ✓ |
| Item SI — state names in the area | Mina §5 rules **text-only state names: no outline, no state link, on any entry including the primary's; A4 stays the page's one state door** — decided from the placement spec's own logic (one naming moment; an outline/link would imply a multi-state filing §1.1 forbids; entries are information, not doors). This confirms Nadia §7.2's recommendation and matches Ada L-A5's position; Ada's condition for a return visit (a state link entering the area) does not arise, so no Ada return is owed | ✓ |
| Semantics floors | Ada: rulings L-A1…L-A6 all CONFIRMED with build prescriptions (real `<h2>` in H1 → Locations → About → shop order; `<ul>`/`<li>` with DOM = visual = reading order; kind and `Primary` as real DOM text, never colour/position/icon/generated content; addresses plain text; 320px / 200% / 1.4.12 growth obligations); gate inputs LOC-A1…LOC-A6 restate §10's semantics check (now SH-27) in checkable form | ✓ |
| §10 acceptance checks | All six are executable as written (presence matrix incl. the kind-undetermined row; one-primary invariance; preservation byte-identity under SH-4/SH-7 drives; granularity/provenance incl. TRF-LA; separate stores; semantics) — renumbered SH-22…SH-27 by §4 of this record | ✓ |
| Register discipline | L-1…L-9 complete against the delta's sections; Mina §9 records L-1's visual consequence in register form for the combined SH-13 audit, as the base gate §10 required of this delta | ✓ |

**No contradiction was found among the four documents** — placement (§4.1 order: header → area → About → reviews → catalog) is identical in Nadia's spec and Mina's spacing table; contents, order, and absence agree section for section; Wren's strings are consumed character-for-character; Ada's prescribed structure is the structure Mina dresses.

### 2.2 Notes (non-blocking)

- **N-D2 — Numbering collision, settled at §4.** SPEC-LOCATIONS §10's original SH-15…SH-20 double-assigned numbers the base series already held. Nadia flagged it herself (SPEC-GRID-CARD §10) with the recommendation this gate adopts. The renumber is applied by Quinn in this commit (§4); no maker action is owed.
- **N-D3 — LOC-A2's sequence vs L-A2's prose.** Ada's LOC-A2 check lists the outline as H1 → Locations → About → shop; her L-A2 prose includes the reviews-panel heading (where present) between About and the shop. The prose governs; a checker running LOC-A2 should read the reviews heading into the sequence where the panel exists. No amendment — the check is not contradicted, only abbreviated.
- **N-D4 — Build inputs F-L1…F-L5 are carried, not gated here.** Storage for a location set, the write path, record-splitting tooling, and a structured multi-location collection pass remain build inputs flagged for Dustin (SPEC-LOCATIONS §9). F-L1/F-L3 are additive storage/write-path work of the kind Dustin's standing ruling pre-authorizes; F-L2 (the primary stays the single field's value; additionals never feed `region`, filing, or schema) is a design rule this gate confirms, not an open question; F-L5 (collection pass) is Dustin's to commission or defer — §5.4 makes absence a correct rendering either way, and PB-L3's warning (most shops launch with no area, correctly) is on the record.

**Gate 2 verdict: PASS WITH NOTES.** The locations delta is gated. Its checks enter the combined series as SH-22…SH-27 (§4).

---

## 3. Gate 3 — Grid/card delta + OQ-1/OQ-3: **FAIL (scoped)**

The design's substance passes — one card, art-dominant grid, tier order, Latin discipline, floors, presentations — and every collaborator chain I traced lands consistently (§3.2). The failure is in the check and register text that a build gate would lift: one Major contradiction inside the OQ-3 delta's own amended footprint (D-F1), and two Minor stale-text defects of the base gate's F-3/F-5 classes (D-F2, D-F3). All three are paper repairs, precisely written at §6. Nothing in §3.2 is reopened by them.

### 3.1 OQ-1 / OQ-3 SPEC deltas (`342e5eb`) — discipline and faithfulness

**Register/check discipline: sound, with one exception (D-F1).** S-13 (Crop) and S-14 (grouped default) are complete and accurate against §5.8/§7.5; SH-13's audit line was updated to S-1…S-14 in the same commit; §5.1's group table and order line carry Crop first; §10.1's parameter list carries `crop` (§5.8.6); §16 OQ-1/OQ-3 are closed with the rulings recorded. SH-18 (presence/discrimination), SH-19 (counts/combination, incl. the Crop remover's focus landing per §5.5/SH-15), and SH-20 (A–Z stability, completeness with no cap, URL cases incl. valid-but-unstocked crop → §9.2 state, not a 404) cover §5.8's contract without gaps. §8.4's threshold reasoning is honest: the bands stand because they derive from find-path failure, not chrome size, and the fifth group's cost is named where it lands (scroll distance — measured by SH-17 as amended, §5).

**§7.5's "orderable" reading — CONFIRMED faithful to Dustin's verbatim.** Dustin: "In stock should be at the top but it should also be A to Z in both the top and the out of stock sections." §7.5 partitions the five availability values into orderable (`in_stock`, `preorder`) on top and not-orderable (`unknown`, `shop_closed`, `sold_out`) below, with **variety name A–Z as the sole key within each section**. Three checks on the translation: (1) "orderable" is not invented for this delta — it is §9.4's pre-existing definition in the base SPEC, adopted rather than reinvented, and the alternative (preorder demoted) is considered and rejected on the record for a stated reason (it would print a falsehood beside a card whose own stock line says "Preorder"); (2) the bottom section is necessarily broader than a literal `sold_out` — five values must partition somewhere, and `unknown`/`shop_closed` cannot be promised as orderable; (3) the A–Z-sole-key rule honors the verbatim's second clause exactly — SH-21's fixture is the acid test and it is correctly constructed (a sold-out "B…" precedes an unknown "C…" in the bottom section; an orderable "Z…" still precedes a sold-out "A…"; explicit "Name A–Z" and ungrouped "Recently checked" both verified; the count-line phrase stays uniform on empty-section fixtures; no boundary marker in any state; `/variety` keeps PB-1). §7.2 as amended states the grouped definition at the option itself, and §7.5.2/§7.5.4/§7.5.5 (replacement not coexistence; ordering-only presentation; shop-only scope) are complete. Mina §11 executes §7.5.4 faithfully — no heading, divider, ground change, or boundary gap; the grid's 8px gap is uniform across the invisible boundary; the resting "In stock first" chip carries the selected dress.

### 3.2 Grid/card delta — cross-document consistency (all verified)

- **Tier order & grounds:** Elena Ruling 1 (crop plate tier 2 on **all** grids, globally; placeholder ground `paper-deep`, C6 upheld over shipped `bg-paper`) is carried identically in Mina §3's tier table and SPEC-GRID-CARD §4.3. Tier-4 replacement: §3.3 / D-F3 below.
- **Thea T-1…T-7:** Mina §4 spends the ruling verbatim (`text-sm text-muted` wrapping `<i class="normal-case tracking-normal">`; no label, no clamp); the zone arithmetic agrees across three documents (Thea §6: 60 + 49.5 + 20 + 20 + 6 = 155.5px → 9.75rem; Ada G-A6's recomputation; Mina §5.1's table). Browse allocation is 3 Latin lines / 60px; browse zone 9.75rem.
- **Ada floors (a)–(f):** (a) heading asymmetry confirmed and carried; (b) `aria-label` stands with the **short** crop form binding (G-A2(ii)) — consistent with Wren §1; (c) focus order + 44px targets, with the **heading-link prescription (`display: block`, `min-height: 44px`, measured on the rendered border box) carried at Mina §5.2**; (d) sole-carrier prohibitions carried; (e) absence elemental (no node at all) — matches SH-G6's DOM-diff form; (f) reflow confirmed **as conditioned by G-A6**. The **1.4.12 floor-not-ceiling prescription is carried at Mina §5.1 as binding** (`min-height: 9.75rem`, no `overflow: hidden`, growth never clipping never internal scroll; the 3-line allocation named a default-spacing allocation, not a cap). Ada's new check **SH-G13a is adopted by this gate** into the build-gate series (precedent: A-5) — it is referenced by Mina §§5.1/14 and Ada §9, and the build gate runs it as written in G-A6. SH-G13's content is as ruled in Ada §9 (her pass expressly rules that check's content; SPEC-GRID-CARD §9's one-line form is read through it).
- **Crop group & grouped sort presentations (Mina §§10–11):** verified at §3.1; §10's cost statement (≈528px, six strips where all five groups discriminate) is consistent with §8.4 and is the quantity SH-17-as-amended measures.
- **Wren (COPY-GRID-CARD):** all card strings stand as shipped; the crop line takes the **short form in both contexts** — this is Wren's §7.4 slot ruling and it governs over SPEC-GRID-CARD §3.3.4's looser "as in seller context today" (the ledger ships the full form; the unified card ships the short form, per Wren §1's explicit harmonization); no Latin label, affirmed as a ruling rather than an oversight. Mina §§5.3/6 consume the stock and pill strings byte-for-byte.
- **Checks & register:** SH-G1…SH-G14 enumerated and mapped to their sections without gaps (subject to D-F3); G-1…G-9 complete — G-1's SH-10 re-scope is the governing text for D-F2; G-4 (rail retirement), G-5 (`cropMedia` payload, the delta's only payload change), G-6 (skeleton), G-8 (scope fence: the class, wordmark, homepage packet cards, and variety-context wheat-stem rule untouched) all consistent with §§3–4. SH-G2's DOM measurement, SH-G9's bounds (page 8 = 200, page 9 = true 404), SH-G5/G6's Latin presence/absence forms, and SH-G12's payload discipline all match the spec text they check.

### 3.3 Findings

#### D-F1 — MAJOR — SH-9 retains the superseded five-tier clause, contradicting §7.5 and SH-21 (the base gate's F-2 class, inside the delta's own amended footprint)

**Object:** SPEC §13 SH-9, as amended by `342e5eb`; SPEC §7.5.1; §13 SH-21.
**Evidence:** The OQ-3 commit edited SH-9 — its default clause now reads "the grouped 'In stock first' order (§7.5)… SH-21 drives the grouped order itself" — but left standing the next clause verbatim from the pre-delta text: '"In stock first" produces no listing from a lower availability tier above a higher-tier one.' §7.5.1 rules that the five-tier ordering (in stock → preorder → unknown → shop closed → sold out) "no longer exists anywhere in the shop's sort," and SH-21's fixture **requires** arrangements the tier clause forbids: a preorder "A…" above an in-stock "Z…" (A–Z is the top section's sole key), and a sold-out "B…" above an unknown "C…" in the bottom section.
**Expected vs actual:** A build that implements §7.5 correctly — and passes SH-21 — fails SH-9 as written; a build arranged to pass SH-9's tier clause fails SH-21 and violates Dustin's ruling. Two checks in the same series cannot both be passed by the correct build. This is the F-2 pattern (a check that fails the correct build), found in text the delta itself touched.
**Standard violated:** Internal consistency of the acceptance series; §7.5.1's own supersession.
**Required amendment:** A-D1 (§6). Severity **Major** (blocking for Gate 3; the design substance is unaffected — §7.5, S-14, and SH-21 agree, and they govern in the meantime).

#### D-F2 — MINOR — SH-10 and the §12 must-not-change list still protect seller-context ledger cards byte-for-byte; SH-13's audit list does not name the combined register

**Object:** SPEC §13 SH-10; §12 "What must NOT change" list; §13 SH-13; SPEC-GRID-CARD G-1.
**Evidence:** SH-10 still reads "listing cards in the built shop are byte-identical to pre-build cards," and §12's list still protects "the Quiet Ledger cards in seller context, byte-for-byte" — while G-1 repeals exactly that protection ("SH-10 must be re-scoped to variety context + §3.3's shop fact lines") and §1.2 of the grid delta states the repeal by name. SH-13's audit line, as amended by the OQ commit, names S-1…S-14 only; the combined-register reading (S + L + G registers) is established across the record (base gate §8; UI-LOCATIONS §9; SH-G14) but not in SH-13's own text.
**Disposition:** The governing reading is settled and stated here — **G-1 governs: SH-10 runs re-scoped (variety context byte-identical; shop context governed by SH-G8), and SH-13's audit runs against the combined register S-1…S-14 + L-1…L-9 + G-1…G-9** — so a builder or gate reading the whole set cannot go wrong. The defect is that the base SPEC's own texts still read as live in their superseded forms (the F-3 class). **Required amendment:** A-D2 (§6).

#### D-F3 — MINOR — SH-G3/SH-G4 and SPEC-GRID-CARD §§4.3–4.4 are not conformed to Elena's tier-4 replacement; SH-G4 as written cannot catch the stem it must exclude

**Object:** SPEC-GRID-CARD §9 SH-G3, SH-G4; §§4.3 (tier 4), 4.4; ART-GRID-CARD §2; UI-GRID-CARD §3.
**Evidence:** Elena ruled tier 4 **replaced**: the in-frame divider stem is out, in any state; tiers 3–4 are one tier with two forms of the pod device (the crop's own pod; the generic directory poppy-pod device) on `paper-deep`. Mina §3 implements exactly that ("no stem appears anywhere in the card, in any state"). But Nadia's check texts predate the ruling: SH-G4 counts only `divider-stem-mini` elements — the in-frame stem is a different class (`.divider-stem`, per ART-GRID-CARD §2.2 and SPEC-GRID-CARD §4.4 itself) — so a build that kept the in-frame stem would pass SH-G4 while violating the art ruling; and SH-G3 affirmatively names the expected tier-4 rendering as "the pod device / in-frame stem," prescribing the superseded output. §§4.3–4.4 likewise still list and defend the stem tier.
**Elena's specific request — judged:** she asked that SH-G4 count in-frame placeholder stems inside variety cards as the motif's presence. **She is right, and SH-G4's text needs conforming** — not merely a wider reading — because its current wording names one class only, and SH-G3's wording points the other way. The governing reading in the meantime is ART-GRID-CARD §2 + UI-GRID-CARD §3 (no stem anywhere in the card, any state); the slot mechanism (§7.2 reserved this ruling to Elena) makes that reading unambiguous to a whole-set reader, which is why this is Minor, not Major.
**Required amendment:** A-D3 (§6).

### 3.4 Notes (non-blocking)

- **N-D5 — Thea §9 item 1** asks for a descender check "against the zone edge"; under G-A6's growth rule there is no fixed edge to clip against, and SH-G13a's pass conditions govern the override drive. No amendment; the gate reads Thea's item through G-A6.
- **N-D6 — PB-G2 (Latin coverage) is a catalog recommendation, not a gate item.** 269 varieties across 74 crops render no Latin line at launch, correctly, under §6.3's absence rule. Sourcing those crops' `latinName`s is Hue/Dustin's commissioning decision; the build gate treats a missing line as correct rendering.

**Gate 3 verdict: FAIL (scoped)** — on D-F1 (Major), with D-F2/D-F3 (Minor) and the mechanical A-D4 (§5's write-in) in the same repair pass. The delta re-gate checks the amended footprints only (§6). Everything in §3.2 stands as gated substance and is not reopened.

---

## 4. Ruling — the numbering collision (final)

**The collision.** The base SPEC §13 series, as amended by the base gate and the OQ deltas, runs **SH-1…SH-21** (SH-1…SH-15, SH-16a, SH-16b, SH-17…SH-21). SPEC-LOCATIONS §10 independently assigned **SH-15…SH-20** to the locations checks, double-assigning SH-15, SH-16, SH-17, SH-18, SH-19, and SH-20 (SH-16 additionally colliding with the 16a/16b pair's namespace).

**Ruling: the base series keeps the bare numbers; the locations series renumbers.** The recommendation on record (SPEC-GRID-CARD §10) is adopted, for its stated reason: the base series lives in the SPEC itself and was amended there first (A-1/A-5, then the OQ deltas); the locations series is the later, self-contained claimant, and its checks are cited from only three documents. The grid series (SH-G1…SH-G14, SH-G13a) and Ada's location inputs (LOC-A1…LOC-A6) are collision-free and do not move.

**Canonical mapping (old → new), applied by Quinn in this commit** — a pure renumber; no check's text, scope, or fixture changed:

| Locations check | Was | Is |
|---|---|---|
| Area presence matrix | SH-15 | **SH-22** |
| One-primary invariance | SH-16 | **SH-23** |
| Preservation | SH-17 | **SH-24** |
| Granularity & provenance | SH-18 | **SH-25** |
| Separate stores | SH-19 | **SH-26** |
| Semantics floor inputs | SH-20 | **SH-27** |

**Files changed by the renumber (same commit as this record):** `SPEC-LOCATIONS.md` (§10's six check headings; register L-8, annotated with the renumber's provenance), `UI-LOCATIONS.md` (§10 checklist reference), `ADA-LOCATIONS.md` (three references: Method, L-A3, §8 preamble). Verified after edit: no occurrence of the old locations numbering remains in the three documents, and no other document cited the old numbers (full-set grep). SPEC-GRID-CARD §10's collision note stands as the historical flag this ruling answers; it is not edited.

**The canonical check series for the combined design is now:** base SH-1…SH-21 (incl. SH-16a/SH-16b) · locations SH-22…SH-27 · grid SH-G1…SH-G14 + SH-G13a · Ada's location inputs LOC-A1…LOC-A6. A build brief cites numbers from this list only.

---

## 5. Ruling — SH-17's PB-M6 fixture: amended to five groups

**Question** (flagged by Nadia at SPEC §8.4 and in §13's SH-17 flag paragraph; she deliberately did not rewrite this gate's check): the fixture is specified as a 9-listing shop with **four** discriminating groups, but the §5.8 Crop delta makes five the true worst case, and a 9-listing fixture can discriminate all five.

**Ruling: SH-17 is amended to five-group.** Reasons: the drive exists to measure the worst case's cost (scroll distance to the first card; a named-listing find) — a four-group fixture would certify a control block one strip shorter than the worst case the design now permits (≈528px / six strips per Mina §10, against the four-group ≈400px the base gate recorded); the five-group fixture is constructible at 9 listings (§8.4: ≥2 crops, seasons, methods, life cycles, and hues across 9 listings); and both seats who touched the question (Nadia §8.4, Mina §10) recommend the change. The four-group text is superseded from this record forward.

**Amended SH-17 (operative text, adopted by this gate):**

> **SH-17 (PB-M6 fixture drive — build-gate check adopted by Quinn's design gate; fixture amended to five discriminating groups by Quinn's delta gate, 2026-11-22):** a 9-listing shop with five discriminating groups (Crop, Season, Sowing method, Life cycle, Hue — all five discriminating across the fixture's 9 listings), driven at 390px alongside §13's five test shops, reporting scroll distance to the first card and a named-listing find task.

The conforming write-in to SPEC §13 (and removal of the now-answered flag paragraphs) is amendment A-D4 (§6) — mechanical, owner Nadia. Until it lands, this section's text governs.

---

## 6. Required amendments (Gate 3 repair pass; apply verbatim in substance)

- **A-D1 (fixes D-F1; owner: Nadia, SPEC §13 SH-9).** Strike the clause *'"In stock first" produces no listing from a lower availability tier above a higher-tier one;'* and substitute: *'"In stock first" produces the grouped order of §7.5 — every orderable listing above every not-orderable listing, variety name A–Z the sole key within each section, and no availability tier ordering anywhere in the shop's sort (SH-21 drives the grouped order itself);'*
- **A-D2 (fixes D-F2; owner: Nadia, SPEC §12 + §13).** (i) §13 SH-10: replace its first clause with *"listing cards in variety context are byte-identical to pre-build cards for the same listings (diff the rendered card HTML); shop-context cards are the unified variety card of SPEC-GRID-CARD §§3.3/4 (their facts are governed by SH-G8)"* — the pill-target and no-price clauses stand unchanged. (ii) §12's must-not-change list: the protected item *"the Quiet Ledger cards in seller context, byte-for-byte"* becomes *"the Quiet Ledger cards in variety context, byte-for-byte (seller context is replaced by the unified variety card per SPEC-GRID-CARD G-1/G-2)"*. (iii) §13 SH-13: the audit list becomes *"exactly the combined register — §12's S-1…S-14, SPEC-LOCATIONS' L-1…L-9, and SPEC-GRID-CARD's G-1…G-9 — and nothing else. A further difference is a FAIL until reverted or carried back as a register amendment."*
- **A-D3 (fixes D-F3; owner: Nadia, SPEC-GRID-CARD §§4.3, 4.4, 9).** (i) SH-G4: replace the check's text with *"rendered DOM of every grid surface in SH-G1's list contains zero stem elements of any class inside variety cards — no `divider-stem-mini` element and no in-frame `divider-stem` placeholder — in plated, placeholder, filtered, searched, and skeleton states (an in-frame placeholder stem inside a variety card counts as the motif's presence: ART-GRID-CARD §2); the `divider-stem-mini` class still renders in the header wordmark lockup (grep + rendered check) — removal of the class itself is a FAIL."* (ii) SH-G3: replace *"render the pod device / in-frame stem decoratively (`alt=""`, `aria-hidden`)"* with *"render the pod device decoratively on `paper-deep` (`alt=""`, `aria-hidden`) — tier 3 the crop's own pod device, tier 4 the generic pod device (ART-GRID-CARD §2)"*. (iii) §4.3's tier 4 becomes *"The generic seed-pod placeholder — the designed pod device in its generic, directory-mark form (ART-GRID-CARD §2), decorative, on `paper-deep`, where the crop has no pod art either; the in-frame divider stem is removed as a tier."* and §4.4's stem paragraph is conformed to the same ruling (the in-frame placeholders that stay are tiers 3–4's pod devices; no stem instance remains on the card in any state).
- **A-D4 (mechanical write-in of §5's ruling; owner: Nadia, SPEC §13 + §8.4).** Replace SH-17's text in §13 with the amended text at §5 of this record, and strike the flag paragraphs at §13 (under SH-17) and §8.4 (the "Flag for Quinn's delta gate" passage) — their question is ruled.
- **A-D5 (fixes N-D1; owner: Mina, UI-DESIGN §14).** CS-01's Status cell: *"New ruling needed (OQ-2)"* becomes *"Ruled — COPY §1 (OQ-2 closed)"*. Non-blocking; rides this pass for convenience.

**Delta re-gate scope (on return):** SPEC §13 SH-9; SPEC §12 list + §13 SH-10/SH-13/SH-17 + §8.4 flag removal; SPEC-GRID-CARD §§4.3, 4.4, 9 (SH-G3/SH-G4); UI-DESIGN §14 CS-01 status cell. Nothing else is reopened.

---

## 7. Combined readiness

- **Base design:** gated (Gate 1 PASS; base gate's FAIL discharged).
- **Locations delta:** gated (Gate 2 PASS WITH NOTES; checks canonical as SH-22…SH-27).
- **Grid/card + OQ-1/OQ-3 deltas:** substance gated; record repair owed (A-D1…A-D4, + A-D5 riding). Delta re-gate on the §6 footprints closes the design.
- **Build placement (unchanged):** one shop build, after Item 3.1a lands and passes its gate, in its own worktree (SPEC §14); the grid/card and locations deltas fold into that build's brief as register amendments (SPEC-GRID-CARD §10's sequencing note: do not build ledger cards in order to replace them), gated at build time by the canonical series at §4.
- **No build is briefed before Dustin's go, regardless of these verdicts.** This record clears the design paper; Dustin's go is a separate act, and Hue carries him the state exactly as: *base and locations gated; grid/card substance gated with a scoped paper repair (one Major check contradiction, two Minor conformances) in a named amendment pass; delta re-gate to follow.*

## 8. Coverage ledger and method

- **Population:** all sixteen `shop-design/` documents on `origin/main` at `7d23425` (3,059 lines), plus the four amendment/delta commits' diffs (`e456550`, `bbc19ac`, `342e5eb`, `7d23425`) read line by line.
- **Strata checked:** Gate 1 — the five amendments, footprint by footprint (SPEC §§5.5/5.7, 6.1, 9.2, 12 S-12, 13; UI-DESIGN §14 two rows; COPY §5 preamble). Gate 2 — the Locations Rule's eight elements (§2.1 table) across four documents, plus §10's checks and the L-register. Gate 3 — §5.8/§7.5 + S-13/S-14 + SH-18…SH-21; six delta documents claim-by-claim against each other; SH-G1…SH-G14 and G-1…G-9 enumerated; Ada's floors (a)–(f) traced into Mina's values.
- **Structured sample:** every check identifier in the combined record was enumerated and cross-searched (SH-1…SH-21, SH-22…SH-27 as renumbered, SH-G1…SH-G14, SH-G13a, LOC-A1…LOC-A6, S-1…S-14, L-1…L-9, G-1…G-9); the zone arithmetic (155.5px → 156px) and the Latin contrast figure were verified as agreeing across the independent documents that state them.
- **Adversarial addition:** full-text searches for the obligations most likely to collide or go stale — `SH-` numbering across the set (produced §4's ruling), "tier" in §13 against §7.5 (produced D-F1), "byte-identical" / seller-context protection against G-1 (D-F2), "stem" in the grid checks against ART-GRID-CARD §2 (D-F3).
- **Exclusions:** no build exists, so no browser drive, rendered measurement, or screen-reader pass was owed or possible — every document's rendered proofs belong to the build gate under the canonical checks; shipped-code truth beyond the documents' own cited verifications; per-seller dataset values.
- **Evidence axis:** findings rest on quoted document text (directly observed). Makers' measured figures relied on where two documents independently agree (zone arithmetic, contrast); single-source figures (e.g. GeoSeed's 13 sold-out cards, Mina's ≈528px control block) are maker-measured and are labeled as such where this record repeats them — the build gate's drives are their proof.
- **Evaluator structure:** single evaluator (Quinn). No cold second rater was commissioned; per the evaluator-effect discipline, the consistency findings here rest on quoted text a second rater would read identically, and severity on D-F1 follows the base gate's own F-2 calibration rather than a fresh scale.
- **Residual risk:** this coverage can still miss a contradiction between two passages neither of which makes a claim about the other, and any defect in a delta document's current-state record (SPEC-GRID-CARD §2, SPEC-LOCATIONS §2.4) that all downstream documents inherited uncritically. The build gate's register audits (SH-13 as amended by A-D2; SH-G14; SH-23) are the control for the second class.

*— Quinn, QA. Gate 1: PASS. Gate 2: PASS WITH NOTES. Gate 3: FAIL (scoped — A-D1…A-D4 required, A-D5 riding). Numbering settled (locations = SH-22…SH-27, applied in this commit); SH-17 amended to five groups. The design's substance — base, locations, grid, card, and both sort/filter deltas — is the strongest assembled set this gate has reviewed; what remains is one contradictory clause and two stale texts, measured in sentences. No build briefs before Dustin's go.*
