# Seller-as-Shop — Delta Specification: Locations (One Primary + Shop Info Area)

**Seat:** Nadia, UX Design (author). Delta to my own delivered shop SPEC (`shop-design/SPEC.md`, read back from `origin/main` before designing). Standing collaborators with slots in this delta: Mina (UI design — visual composition and the Item SI state-outline ruling for this new surface, §7), Wren (copy — every label string, §6.1), Ada (accessibility — semantics floor for the section, §6.3). Quinn's delta gate closes on this document (§10).
**Date:** 2026-11-22 · **Status:** Design spec only. No code, no build.
**Commission — the ruling (Dustin, voice call 2026-11-22 15:31 PT, verbatim):** "we need to combine all the locations to be the same location — just on the shop page we can have an information tab or area that has all of their location."
**Exception (Dustin, voice call 2026-11-22, verbatim):** "Unless they have separate web stores." Carried at §2.
**House standards binding this delta:** the base SPEC's standards, unchanged — US spelling; prices never shown; phone-first; no public source attributions except the exact label "Reviews from Google"; the §3.5.5 provenance bar (the seller's own published facts only).

---

## 1. The rule (normative)

1.1 **One primary location per seller record, everywhere except §4's area.** A seller record carries exactly one primary location. That location — and no other — is what the directory shows in: the shop header's Location definition-list entry (with its A4 state link, base SPEC §9A), the StatePlate and StateShape surfaces, the state link and state filing (`/state/{slug}`, the `region` column), the seller index, state pages, and the page's `PostalAddress` schema. No surface outside the shop page's info area may render, file, or imply a second location for the record.

1.2 **The shop page alone carries the full set.** The seller's shop page (§4) lists *all* of that record's qualifying locations — the primary included (§5.3) — each labelled by kind (§6.1). This is the only multi-location rendering in the directory.

1.3 **Worked example (on the record).** Plant Good Seed (seller 65): primary **Chimacum, WA** — what the header, index, state filing, and schema show everywhere. Its **Ojai, CA mailing address** (published on its own contact-information page: "226 West Ojai Ave Ste 101-539, Ojai, CA 93023", sweep 2026-11-22) appears **only** in the shop page's info area, labelled as a mailing address. Nothing about Ojai — no state link, no CA filing, no schema entry — exists anywhere else for this record.

## 2. The exception — separate web stores are separate shops (normative)

2.1 **The unit of this entire design is one store's seller record.** "Seller" in the base SPEC and in this delta means *one store's record*, not one business, one owner, or one brand.

2.2 **Genuinely separate web stores are separate shops.** Where one operator runs genuinely separate web stores — distinct storefronts, each presenting itself as its own shop — each store is (or becomes) its **own seller record** with its own shop page, its own primary location, its own contact block, and its own §4 info area. Locations are **never combined across separate stores**: Store A's locations never appear in Store B's info area, and no page merges, cross-lists, or "also at" two stores' locations.

2.3 **The boundary is a data determination, never a render-time computation.** Whether two storefronts are "genuinely separate web stores" versus *one store with several locations* (the §1 case — one record, one primary, the rest in the info area) is decided **on the record, before any page renders**: from the sweep's collected facts, by Hue's judgment, recorded on the seller data. The page receives one record and renders it; it does not inspect domains, compare addresses, split, or merge anything. If the determination changes, the *records* change (a record is split, or two records' location sets are re-filed) and every page then renders its own record exactly as this spec already describes — no page logic differs between the two cases. Signals the determination weighs (facts, not an algorithm): separate storefront domains/branding presented to customers as separate shops; separate catalogs and checkout; each storefront publishing its own location and service channels. One storefront publishing several addresses (a farm plus a warehouse plus a PO box) is the §1 case, however far apart those addresses are.

2.4 **Register — is there a current case? Plainly: no confirmed case is identifiable in the current catalog.** The sweep dataset (`seller-contacts-2026-11-22/seller-contacts.json`, 83 sellers) carries exactly one homepage per seller and no seller pair that is one operator's two storefronts. The nearest candidate was examined and **excluded**: **TRF-LA** (seller 52) — its about page lists a Scarsdale, NY address, but the sweep *cleared* it: that address belongs to the sister store "the rice factory NY", TRF-LA's own contact page is Los Angeles, and the directory field stands. Consequences, stated so nobody over-reads it: (a) the rice factory NY holds **no seller record** in the directory today, so there are not two shops to separate; (b) Scarsdale is **not a TRF-LA location at all** under the sweep's verdict, so it must **not** appear in TRF-LA's §4 info area — the exception does not smuggle it in. If the rice factory NY is ever listed, it enters as its own record under §2.2, by Hue's determination at that time. Plant Good Seed (§1.3) remains the worked example of the rule itself: one storefront (`plantgoodseed.com`), two locations, one record.

## 3. Tab or area — ruling: an information AREA, not a tab (normative)

3.1 **Ruling: a headed section (an area). No tab interface is built on this page.**

3.2 Reasoning, honestly weighed:

- **A tab's cost is real and buys nothing here.** A true tab interface carries the full WAI-ARIA tab contract — `tablist`/`tab`/`tabpanel` roles, `aria-selected`, roving tabindex, arrow-key navigation, activation semantics — and every part of it must be built, tested, and maintained for a list that is, at its largest realistic size, a handful of short address entries. The content is neither long nor rivalrous with a sibling panel; there is nothing for a second tab to *be*. A tab with one panel is a disclosure wearing a tab's obligations.
- **The page has no other tabs.** Introducing the site's only tab interface for this one element teaches the visitor a new interaction for one small fact set, and hides identity facts behind an interaction — a findability cost (Jakob's Law / hidden-content failure mode in my playbook). Locations are identity matter, like the contact block; identity on this page is *shown*, not tabbed away (base SPEC §3.5's whole stance).
- **The page's existing composition already has the pattern.** About is a headed section; the reviews panel is a headed section. A headed Locations section is the same pattern, learned once, scannable in the page's normal reading order, fully present for search, print, no-JS, and assistive technology with no state to manage.
- **What a tab would have bought** — compactness on a long page — is not scarce here: the area exists only when a seller has additional locations (§5.4), and its content is short. If a future seller's location list grows long enough to crowd the page, that is a new design question with real evidence behind it, not a reason to pay the tab contract now.

3.3 Because the ruling is *area*, there is **no behavior contract to spec beyond §4's**: no selected state, no keyboard model beyond normal reading order, no panel show/hide, no URL state. The section is static server-rendered content, identical in the no-JS floor, before hydration, and in the installed PWA — the same class as the contact rows (base SPEC §3.5.2).

## 4. Placement and composition (normative)

4.1 **Position: immediately after the header identity composition, before About.** The section sits directly below the header block that ends with the seller contact block (§3.5 of the base SPEC — its natural neighbour: contact channels and locations are the same "how do I reach / where are they" question), and above the About section. Order on the page, when the area exists: **header (identity + contact block) → Locations area → About → "Reviews from Google" panel (where present) → catalog section.** When the area does not exist (§5.4), the page is exactly the base SPEC's page: header → About → reviews → catalog, with no gap, placeholder, or reserved space where the area would have been.

4.2 **The identity block's settled order is not displaced or demoted.** Nothing inside the header moves, reorders, or shrinks: eyebrow, H1, badge row, definition list (Location / Varieties listed / Rating), homepage button, contact rows, disclosure line — base SPEC §3.2 stands verbatim. The area is a *sibling after* the header, not an insertion into it; in particular it is **not** a fourth definition-list entry and does not extend the header's `<dl>`.

4.3 **Identity matter — the preservation rule covers it, said explicitly.** The area is part of the page's identity zone, not the catalog section. Base SPEC §3.3's preservation rule therefore covers it by name: **no filter, search, sort, or pagination state ever moves, hides, re-renders, or repaints the Locations area**, and it carries no URL/history state of its own (§3.3 above). It renders once, from the record, identically under every shop state — the same guarantee the contact block already holds (§3.5, first paragraph).

4.4 **Structure.** A `<section>` with its own `<h2>` (heading string: Wren's slot, §6.1), `aria-labelledby` pointing at that heading — the page's established section pattern (base SPEC §3.1.1, §3.4). Inside: one list of location entries (§5), in §5.2's order. No intro paragraph is designed in; the heading plus labelled entries carry the meaning (an intro line is Wren's to add only if her heading ruling needs one — §6.1). Heading level and list semantics are specced as floors for Ada's confirmation (§6.3), not as her values.

4.5 **Amendment to base SPEC §3.4, stated plainly:** §3.4 ruled "About stays where it is — between the header and the catalog." That ruling's substance — About before the catalog, never buried below it — is unchanged. Its literal wording is amended by this delta: when the Locations area exists, About sits between the *area* and the catalog. About's position relative to the catalog, the reviews panel's position relative to About and the catalog, and every §3.4 reason survive untouched.

## 5. Contents (normative)

5.1 **Per location — the floor and the granularity ruling.** Every entry carries, in this order of slots:

| Slot | Content | Rule |
|---|---|---|
| Kind label | §6.1 slot — physical / warehouse / mailing address | Required. An entry without a determined kind does not render (§6.2). |
| Primary marker | §6.1 slot — present on the primary's entry only | §5.3. |
| Address lines | The location as the seller publishes it | Granularity ruling, §5.1.1. |

5.1.1 **Granularity — ruled: the full published business address, not city/state only.** Where the seller publishes a street address or PO Box for that location, the entry renders it — street/PO Box line, then city, state, and ZIP — **verbatim as published**. Where the seller publishes only city/state for that location, the entry renders city/state only. Reasons: (a) *the provenance bar permits exactly this and no more* — §3.5.5's bar is "the seller's own published facts," and a published street address is one; rendering it is not a new exposure, it is quoting the seller's own contact page; (b) *the visitor's jobs need it* — a physical location is somewhere a visitor may drive to, and a mailing address is only usable complete (a PO Box number *is* the address); a city/state-only mailing entry ("Ojai, CA — mailing address") tells the visitor a fact they cannot act on, which is the recall/half-answer failure this page exists to avoid; (c) *the area is the detail place* — everywhere else keeps the directory's city/state convention (§1.1) precisely because this one area carries the detail. **Hard limits, same bar:** never complete a partial address, never derive a street line from another location, a map service, or a directory; never render an address the seller publishes only for a *different* purpose (e.g. a returns-only or sister-store address — §2.4's TRF-LA exclusion is this limit applied); no map link, directions link, or geocoding is designed in this delta.

5.1.2 **No channels inside entries.** Phone and email stay in the contact block (§3.5) and are not repeated per location, even where a seller associates a number with one site: one channel block, one locations list, no duplication. If a seller's record ever carries a genuinely location-specific service channel, that is a new fact for Hue's determination — not a rendering this delta invents.

5.2 **Order of entries.** The primary first. Remaining entries by kind in the order physical, warehouse, mailing, then by state, then city (A–Z) within a kind — deterministic from the record, identical on every render, so the list never reshuffles between visits.

5.3 **The primary inside the area — listed, and marked.** The ruling says *all* locations, so the primary is an entry like the others — omitting it would make the area read as "other locations" and force the visitor to reconcile two lists (header vs. area) to get the full set. It is identified as the primary by the **primary-marker slot** (§6.1): a distinct textual marker on the primary's entry only, separate from its kind label (a location's *kind* and its *primary status* are orthogonal facts — the primary may be any kind, and the marker must not be folded into the kind string). The marker is text, never colour or position alone — position (first) reinforces it but does not carry it (§6.3 floor for Ada). The header's Location entry and the area's primary entry state the same location at different granularity (§5.1.1); that is deliberate, not a duplication defect — the header is the directory's summary, the area is the shop's full record.

5.4 **Graceful absence — when the area does not exist (normative).** Following §3.5.3's precedent exactly — a thing renders if and only if its facts are present; nothing narrates the gaps:

- **Minimum to exist: two qualifying locations** — the designated primary **plus at least one additional** location that qualifies under §5.1/§6.2 (city/state at minimum, kind determined, seller-published).
- **One-location sellers: no area.** A seller with only the primary shows no area at all — an area listing just the primary would duplicate the header's Location line a screenful apart and teach visitors that the area is boilerplate, so they stop reading it on the sellers where it matters. Silence, not a one-item list.
- **Additional locations unpublished or unknown: no area.** A seller whose further locations are uncollected, unpublished, or undetermined is, to this page, a one-location seller — the page cannot distinguish "has none" from "not yet collected," and §3.5.3's reasoning governs: any copy about it ("no other locations listed") risks stating a falsehood and reads as a defect. **No absence copy of any kind is added** — no "only one location" line, no empty section, no reserved space (§4.1).
- **An additional location that fails §6.2 (kind undetermined) does not count toward the minimum** and does not render (§6.2); if it was the only additional, the area does not exist.

## 6. Slots for the collaborator deltas

### 6.1 Wren (copy) — label strings, hers to rule

This delta fixes slots and obligations; **no label string is finalized here.** Wren's delta pass rules, as one set:

1. **The section heading** — must name the content as the seller's locations (plural set, this shop's record only). Working shape for her to rule on, not a ruling: "{name}'s locations".
2. **The three kind labels** — Dustin's words are *physical*, *warehouse*, *mailing address*; the exact strings (including whether "physical" stands alone or takes a noun, and capitalisation) are Wren's. Obligation: the three strings must be mutually unmistakable at a glance, in the visitor's vocabulary, and must not imply visitability the kind does not carry — the mailing label in particular must never read as a place to go.
3. **The primary marker** — a short textual marker for §5.3 (working shape: "Primary"). Obligation: it must read as a status, not a kind, and must make sense beside any of the three kind labels.
4. **(Conditional)** One intro line *only if* her heading ruling cannot carry the set's meaning alone (§4.4). Default is none.

### 6.2 Kind classification — who decides, and the unclear case (normative)

- **Classification is a record-level fact.** A location's kind is determined when the location is recorded — from the seller's own published presentation of that address (their label for it, or the unambiguous context they publish it in: a farm/visit address, a warehouse/shipping address, a mailing/PO Box address), as collected by the sweep and its successors, and held on the record beside the address. The page renders the recorded kind; it never infers kind from the address's shape (a PO Box is *evidence the determination weighs*, not a render-time rule — a seller may publish a PO Box as their physical address, and the record, not the string, decides).
- **Unclear kind — ruled: the location does not list.** Where the kind is unpublished or cannot be determined from the seller's own facts, the location is **not rendered in the area** — there is no unlabelled rendering. Reasons: the kind is the area's whole information value — it is what stops a visitor driving to a mail drop; an unlabelled entry invites exactly the visitability assumption the labels exist to prevent; and under the §3.5.5 bar, kind is a fact like any other — an unprovenanced fact does not render, the same render-or-not-at-all discipline as §3.5.2's channels. The cost is named honestly: a real, seller-published city/state can be withheld for want of a kind. That cost is accepted over a mislabelled or guessable kind, and §8 PB-L2 records the pushback trail. Such locations stay on the record (kind: undetermined) for Hue's determination — exclusion from rendering is not deletion.

### 6.3 Ada (accessibility) — floors stated, values hers

- The area introduces **no interactive elements and no tab semantics** (§3) — Ada is asked to confirm that negative, since a future builder pattern-matching "tab or area" must not ship tab roles for a section.
- Floors this delta states for her delta ruling: the `<h2>` sits in correct heading order (after the header's `<h1>`, before About's heading); entries form a real list (`<ul>`/`<li>` or her ruled equivalent) so the set and its count are perceivable non-visually; the primary marker and kind labels are **text**, never carried by colour, position, or icon alone; address lines are plain text (no link semantics) unless Mina's §7 ruling introduces a state link, in which case link-purpose naming returns to Ada; the section must reflow at 320px and survive 200% text with no horizontal scroll, per the playbook floor. Target-size questions do not arise (nothing is tappable) unless §7 adds a link.

### 6.4 Elena / Iris / Thea

No artwork, no new colour state, and no new type style is proposed. The area consumes the existing section/heading/body system; if Mina's composition finds it needs a new visual token, Iris and Thea are consulted in her delta, not pre-empted here.

## 7. State outlines — flagged surface for Mina's Item SI delta (normative flag)

7.1 Every entry in the area names a state (§5.1), so **the info area is a new state-naming surface on the seller page** under Item SI's rule (a state outline everywhere a state is named on seller pages, subject to Mina's placement spec). Base SPEC §9A ruled this page's *existing* surface: exactly one outline, at A4 (the header Location entry's state link), and no other.

7.2 **This delta invents no parallel icon rule.** Whether each entry carries an outline, whether the state name in an entry is a link to `/state/{slug}`, both, or neither is **Mina's to rule in her delta**, consistently with her placement spec's own logic (her A4/N5 pattern: the outline belongs at a surface's naming moment; most surfaces ruled no-icon; duplicates within a screenful are noise). Two facts her ruling should weigh, recorded here: (a) the area can name *several* states, including states the seller is not filed under — an outline-plus-link per entry could read as multi-state filing, which §1.1 forbids the directory from implying; my recommendation to her is **text-only state names in the area, no links** — the entries are information about this shop, not doors to other states' pages, and A4 remains the page's one state door (the primary's). (b) Whatever she rules, the primary's A4 placement is untouched (§4.2).

7.3 **Interim build position:** until Mina's delta lands, the area is designed text-only. A build brief must not lift this delta with outlines or state links added on assumption.

## 8. Pushback

- **PB-L1 — Against the "tab" half of the ruling's wording.** §3 rules area over tab. If Dustin specifically wants a tab's compactness, the honest price is the full ARIA tab contract plus hidden identity content on the site's only tabbed page; I recommend he not pay it for a short address list. Recorded here so the deviation from his "tab or area" phrasing is a visible choice between his two offered options, not a silent substitution — he offered both; I am ruling for one.
- **PB-L2 — The kind-or-nothing rule (§6.2) will withhold some real locations.** I accept that cost for the safety reason given, but the withheld set should be *visible to the team*: the build/data pass should report which recorded locations sit unrendered for want of a kind, so Hue can clear the backlog by determination rather than the area silently under-reporting sellers. A design that hides its own exclusions from its operators repeats the gap-narration problem one level up.
- **PB-L3 — Do not let launch coverage be misread.** The sweep captured one published address opportunistically for 44 of 83 sellers and was not a structured multi-location collection (§9, flag F-L5). Most shops will therefore launch with **no area**, correctly (§5.4). That is the absence design working, not a failed feature — but anyone judging the build by "how many shops show locations" will misread it, so the expectation belongs on the record now.

## 9. Data and build inputs — FLAGGED for Dustin (not design assumptions)

The base SPEC's §11 pattern applies: these are decisions the build needs Dustin to make or note; this design assumes none of them.

- **F-L1 — Multi-location storage does not exist yet.** The sellers record holds a *single* `location` string plus a derived `region` (the just-briefed `sellers/:id/location` endpoint writes exactly one location and derives region from it). Multiple locations per record need a storage decision: a child locations collection (or equivalent) carrying, per location — address lines as published, city, state, ZIP, **kind** (§6.2), **primary flag** (exactly one per record), and provenance (source URL + checked date, per the sweep dataset's standard). The build must decide the shape; the *contents* above are this design's contract.
- **F-L2 — The primary must stay the single-location field's value.** However F-L1 is stored, the existing `location`/`region` pair remains the primary and the only value the header, index, state filing, and schema read. Additional locations must never feed `region` derivation, state filing, or the `PostalAddress` schema — whether schema should ever carry more than the primary is a Bea/Dustin question, flagged, not assumed; this design's position is primary-only (§1.1).
- **F-L3 — An admin/write path for the location set.** Mirroring the base SPEC's phone-migration flag and the sweep report's email-route flag: there is no sanctioned route that writes a location *set*, a kind, or a primary flag, and the admin UI edits one location. The build/Dustin must decide the write path (endpoint in the established pattern, admin UI extension, or coordinator-applied dataset import) before the area can be populated beyond hand edits.
- **F-L4 — Record-splitting tooling for §2.** If a separate-stores determination (§2.3) ever requires splitting one record into two shops, that is a data/admin operation (listings, ratings separation, and slugs all move with it) — flagged as unbuilt and unscoped; the *design* needs nothing, which is precisely §2.3's point.
- **F-L5 — A structured multi-location collection pass may be needed.** The completed sweep verified the single location field on page and in schema for all 83 sellers and captured one published address for 44 — it did not set out to enumerate every seller's full location set with kinds. Populating the area beyond the already-documented cases (Plant Good Seed foremost) likely needs a targeted collection pass in the sweep's own provenance discipline. Flagged for Dustin to commission or defer; the design is complete either way because §5.4 makes absence a correct rendering.

## 10. Acceptance checks — additions for Quinn's delta gate (executable)

Base SPEC §13 stands; these close the scope gap Quinn was told to expect. Test shops: Plant Good Seed (primary + mailing) plus fixtures for the matrix rows.

- **SH-22 (area presence matrix):** fixtures with (a) primary only → no area, page identical to base; (b) primary + one qualifying additional → area present with both entries; (c) primary + one kind-undetermined additional → no area; (d) primary + two additionals of different kinds → area, §5.2 order. No absence copy in any row.
- **SH-23 (one-primary invariance):** on the Plant Good Seed fixture, the header Location entry, state link target, seller-index card, and rendered schema name Chimacum, WA only; "Ojai" appears nowhere on the page except inside the Locations area, and nowhere else in the directory.
- **SH-24 (preservation):** with the area present, drive filter/search/sort/pagination per SH-4/SH-7: the area's rendered content is byte-identical before and after every state change, and it never gains URL state.
- **SH-25 (granularity & provenance):** every rendered address line matches its sweep-dataset source verbatim; a city/state-only fixture renders no invented street line; the TRF-LA fixture renders **no** Scarsdale entry.
- **SH-26 (separate stores):** on a two-record fixture for one operator, each shop page renders only its own record's locations; no cross-listing appears in either area.
- **SH-27 (semantics floor inputs for Ada/Mina):** heading order and list structure per §6.3; primary marker perceivable with colour removed; at 320px / 200% text the area reflows without horizontal scroll; state-outline/link rendering matches Mina's §7 delta ruling exactly — no more, no fewer.

## 11. Difference register — against the base SPEC

| ID | Difference | Base SPEC locus |
|---|---|---|
| L-1 | **New:** Locations information area on the shop page (§§3–5 of this delta) — the base SPEC's one named scope gap, now designed | New section; no base text contradicted |
| L-2 | One-primary rule made explicit and directory-wide; the base SPEC assumed a single location without ruling the multi-location case | Extends §3.2 / §9A |
| L-3 | Separate-web-stores exception: the design's unit defined as one store's record; boundary is a data determination (§2) | New; defines the base SPEC's implicit "seller" |
| L-4 | About's position wording amended: header → (area, when present) → About → reviews → catalog (§4.5) | Amends §3.4's literal wording only |
| L-5 | §3.3 preservation rule extended by name to the Locations area (§4.3) | Extends §3.3 |
| L-6 | New surface flagged for Mina's Item SI delta; interim text-only position (§7) | Adds to §9A's surface list |
| L-7 | New payload/data contents (location set with kind + primary flag + provenance) and five build flags for Dustin (§9) | Extends §11 |
| L-8 | New acceptance checks SH-22…SH-27 (§10; renumbered from SH-15…SH-20 by Quinn's delta gate, QA-GATE-delta.md §4) | Extends §13 |
| L-9 | Contact block unchanged: no per-location channels, no relocation (§§4.1, 5.1.2) | §3.5 confirmed, not amended |

**No other difference.** Header composition (§3.2), catalog composition (§3.3), filters/search/sort (§§5–7), thresholds (§8), states (§9), URL/history/no-JS (§10), and the S-1…S-12 register all stand exactly as delivered; Quinn's base gate findings are unaffected except where L-4/L-5 touch the text she is checking, and this register is the list she checks them against.

---

*— Nadia, UX Design. Evidence: base SPEC read back from `origin/main` (`git show origin/main:shop-design/SPEC.md`, §§3.2–3.5, 9A, 11–13 in full); the location/contact sweep report and dataset (`~/workspace/seeds-hues/seller-contacts-2026-11-22/REPORT.md`, `seller-contacts.json` — Plant Good Seed seller 65 and TRF-LA seller 52 read in full; all 83 records checked for a second storefront/homepage); the `sellers/:id/location` endpoint brief at `origin/main` (single-location write + region derivation, the facts behind flag F-L1). No code was written or changed by this delta.*
