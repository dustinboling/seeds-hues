# Seller-as-Shop — Copy Rulings

**Seat:** Wren, Copywriting / Storytelling. **Commission:** Dustin, 2026-11-22 — the copy pass for the seller page as the seller's shop, ruling every slot Nadia's SPEC (`shop-design/SPEC.md`) and Mina's UI design (`shop-design/UI-DESIGN.md`, §14 inventory CS-01…CS-28) left open, as one commission.
**Date:** 2026-11-22 · **Status:** Ruled. These are the final words for the build; Ada's accessibility pass follows, then Quinn's design gate.
**Governing rules applied:** US spelling throughout; no public source attributions anywhere (the one exception, the exact label "Reviews from Google", is untouched by this pass); no copy implies the directory sells anything or shows prices — the "We don't sell seed." posture is unchanged, and every "shop" on this page is the *seller's* shop; plain, warm, factual directory voice, matching the shipped page's register. Craft first per my playbook: front-load meaning for scanners, omit needless words, prefer the concrete word over the general one, one pattern per job.

**Notation:** `{name}` is the seller's display name, reproduced verbatim as stored. `{host}` is the seller's site host. `{phone}` is the phone number exactly as the seller publishes it; `{email}` the address in full (Nadia §3.5.5: rendered verbatim or not at all). The possessive mark this pass adds is always the typographic apostrophe (’, U+2019); apostrophes inside a stored name are the seller's own and are not rewritten.

---

## 1. The contact block labels — CS-01, CS-02, CS-03, ruled as one set

The set's job (Nadia §3.5.4): three channels, one block, each showing its destination before the click (§3.5.1), and the website channel worded as the *website* so it can never be confused with the listing cards' "Visit shop →" pills, which go via `/go/` to individual product pages (OQ-2).

| Slot | Ruled wording (verbatim) | Renders as (example) |
|---|---|---|
| CS-01 — website button | `Visit their website ({host})` | Visit their website (geoseed.com) |
| CS-02 — phone row | Label: `Customer service` · Value: `{phone}` — composed as one link: `Customer service {phone}` | Customer service 800-555-0147 |
| CS-03 — email row | Label: `Customer service` · Value: `{email}` — composed as one link: `Customer service {email}` | Customer service service@example.com |

**How the set works:**

- **CS-01 resolves OQ-2 by naming the destination, not the seller.** The old label, "Visit {name} ({host})", shared its verb and shape with the pills' "Visit shop →" while going somewhere else entirely. The ruled label's object is the *website* — a word the pills never use — so the two doors now differ in the word a scanner reads second: *website* (the seller's homepage, plain outbound convention) vs *shop →* (one variety's product page, via `/go/`). "Visit" stays, because it is the site's shipped verb for leaving to a seller and the collision was never the verb alone; it was "Visit + seller's name" reading as "go to their shop" on a page that now calls itself a shop.
- **The seller's name is not repeated in the button.** It stands in the H1 directly above the block; repeating it buys no information and costs the label its scannability — with the catalog's long names the old form runs to "Visit Millay and Meadowlark Flower Farm (…)", and with s-final names it stacks possessives ("Visit Johnny's Selected Seeds'…"). "Their" points at the seller the page is about, unambiguously, because the block has exactly one subject. The host in parentheses keeps Nadia's visible-destination obligation in full: a visitor sees *where* the button goes before tapping. Destination, component, and behavior are unchanged; CS-28's shipped screen-reader suffix "(opens the seller's site in a new tab)" still describes this button exactly and stands untouched.
- **CS-02 and CS-03 are one label, deliberately.** Both rows carry the same service label, "Customer service", because that is what both fields *are* — Nadia §3.5.5 admits a phone or email to this block only if the seller publishes it as a customer service contact, so the label is a fact about the data, not a guess. The channel is told apart by the value itself (a number vs an address), by Mina's glyphs, and by the `tel:`/`mailto:` behavior — not by inventing two label wordings for one concept. Composition is label, then value, with no colon and no comma: the header's own definition list ("Varieties listed" and its value) already pairs label and value this way, and the row inherits that relationship (Mina §4.2). The purpose-from-context obligation (§3.5.2) is met: the link's text names whose service line it is and shows the destination in the same breath.
- **Order is as specced:** website button, phone row, email row. A row renders only when its field exists (Nadia §3.5.3 matrix); the labels above are the whole of the block's new words at every coverage level.

**Flagged tension, for the record:** Mina's §14 obligation column for CS-01 says the label "names the seller and shows the host". This ruling shows the host and does not repeat the name, following Nadia's §16 OQ-2 recommendation ("Visit their website — {host}") and §3.5.1, which fixes the *host* — not the name — as the obligation. Nadia holds behavior and contract; the name is named by the H1 the button sits under. If Dustin wants the name in the button regardless, the fallback form is `Visit {name}'s website ({host})` with the CS-05 possessive rule applied — workable, but longer and possessive-stacked on exactly the names that are hardest to read. I recommend against it.

**CS-04 — closed, and I concur.** No phone or email absence copy exists in this pass: no absence line, no summary line, no "contact unavailable" wording, for any slot, at any coverage level. Nadia's §3.5.3 reasoning is the copy reasoning too — absence during the sweep is ambiguous, and a printed sentence about it risks stating a falsehood about a seller; a negative line reads as a defect and punishes sellers who run service through their own site's contact page. Silence is the honest rendering. This is a concurrence, not a pushback: the ruling stands exactly as specced.

---

## 2. CS-05 — The shop heading's possessive form

**Pattern (Nadia §3.1, fixed):** `{name}'s shop` — the heading carries the seller's name and the word "shop". What is ruled here is how the possessive is formed, mechanically, for every name in the catalog:

1. **Default:** if the name's final character is not "s", append **’s** — `GeoSeed's shop`, `3 Porch Farm's shop`, `Floret's shop`.
2. **Name ends in "s"** (either case): append **’** only — `Three Brothers Blooms' shop`, `Johnny's Selected Seeds' shop`, `Peace Seedlings' shop`, `Botanical Interests' shop`.

That is the whole rule: one test on the name's final character, no exceptions list, so the heading is predictable for sellers not yet in the catalog and the build needs no per-seller overrides.

**The hard cases, worked:**

- **Names already containing a possessive** — `The Gardener's Workshop`, `Renee's Garden`, `Half Moon's Farm`: the test looks only at the final character, so these take rule 1: `The Gardener's Workshop's shop`, `Renee's Garden's shop`, `Half Moon's Farm's shop`. These read awkwardly — a possessive inside a possessive — and they are still the ruling: they are grammatically correct, they keep the seller's name intact and first (a scanner's eye lands on the name, which is the heading's job), and every alternative costs more than the awkwardness — dropping to "the shop of…" breaks the §3.1 pattern, and shortening or rewording a seller's name misnames them on their own page.
- **Plural-form farm names** — `Three Brothers Blooms`: rule 2 gives `Three Brothers Blooms' shop`, which is both correct and clean; never `Blooms's`.
- **Long names** — `Millay and Meadowlark Flower Farm's shop`, `High Mowing Organic Seeds' shop`: the name is never truncated, initialized, or replaced with "their" in this heading. The heading is the page's statement of whose shop this is; a shortened name is a wrong name. Length is a layout matter (Mina's balanced wrap), not a copy problem to solve by cutting the seller's name.
- **Names ending in an abbreviation** — `Hudson Valley Seed Co.'s shop`, `Songbird Seed Co.'s shop`: the name's final character is the period of "Co.", not an "s", so rule 1 applies and the possessive attaches after the full stop (`Co.'s`). Stated explicitly because builders guess here: the apostrophe follows the period, never replaces it.

## 3. CS-06 — The search field's visible label

**Ruled:** `Search {name}'s shop` — with the possessive formed by the CS-05 rule, so: `Search GeoSeed's shop`, `Search Three Brothers Blooms' shop`.

The label carries the scope in the seller's name before any typing (Nadia §6.1, Mina §6): a visitor can tell, before touching the field, that this searches this shop only and not the directory. It uses the heading's own possessive form so the page names the shop the same way twice — one pattern, learned once. Sentence case, set in Mina's eyebrow dress; the words are the scope and nothing else.

## 4. CS-07 — The search placeholder

**Ruled:** `Variety or flower name…`

The placeholder exemplifies the two things the in-shop matcher actually matches (Nadia §6.3): the variety name, and the crop's common name — in shopper language, the flower name ("zinnia" finds the shop's zinnias). It promises nothing else: no Latin names, no aliases or "also known as", because this build's matcher does not search them, and a placeholder that promises a match the field cannot make is a small lie told at the exact moment the visitor decides what to type. The trailing ellipsis is the site's field convention (Nadia §6.1's example carries it) and marks the text as an example, not a label — the label (CS-06) does the explaining, which is why the placeholder can stay this short.

---

## 5. Pattern-fixed slots CS-11…CS-24 — checked, not rewritten

Nadia fixed these patterns; my pass checked each against the governing copy rules (US spelling, factual accuracy about what the list is doing, one pattern per job, no implied sales or prices, no source attributions). **Thirteen of the fourteen stand exactly as specced (CS-21 among them, with its typesetting note the build must observe, below); one is flagged with a fix (CS-19).**

| Slot | Pattern (as specced) | Verdict |
|---|---|---|
| CS-11 | Sort options: `Name A–Z` · `In stock first` · `Recently checked` | **Stands.** Each names its order in the shopper's terms; "In stock first" matches its count-line form (CS-15). |
| CS-12 | Removers: `{Group}: {Value}`; search remover `Search: “{q}”`; accessible names `Remove the {Group} filter, {Value}` / `Clear the search for {q}` | **Stands.** Curly quotes per the site's convention; the accessible names say exactly what the tap does. |
| CS-13 | `Clear all filters` / `Clear search and filters` (when a query is active) | **Stands.** The label claims exactly what the action clears — groups and query, never sort, which is not in the applied row. The two variants differ by the one word that changed, which is the honest way to mark the wider action. |
| CS-14 | Count line at rest: `{N} listings` (+ `· page {p} of {pages}`) | **Stands** (inherited, shipped text). |
| CS-15 | Sorted forms: `{N} listings, A–Z.` / `{N} listings, in stock first.` / `{N} listings, most recently checked first.` | **Stands.** Each states the order the list is actually in (Nadia §7.3's honesty rule); sentence case inside the line is correct against the chips' label case. |
| CS-16 | Searched form: `{N} matches for “{q}”, best match first.` | **Stands.** "Matches" agrees with CS-20's "No matches for…", so the zero and non-zero states speak one language. |
| CS-17 | Filtered forms: narrowed total replaces N in CS-14/CS-15; no separate "filtered" wording | **Stands.** The applied row carries the filtered fact; a second statement of it in the line would be a needless word twice over. |
| CS-18 | Chip count unit (screen reader): `listings` — "{count} listings" | **Stands** (fixed by Nadia §5.3). |
| CS-19 | Filtered-empty line: `No listings at {name} match those filters.` | **FLAGGED — fix below.** |
| CS-20 | Searched-empty line: `No matches for “{q}” in {name}'s shop.` | **Stands.** Names the query and the shop; its possessive is the CS-05 form. |
| CS-21 | Combined-scope line: `…with the current filters applied.` | **Stands, with a typesetting note below.** |
| CS-22 | Did-you-mean: `Did you mean {candidate}?` (candidate = the one in-shop variety or crop name) | **Stands.** A question, one candidate, offered as a link — a suggestion, not a correction of the visitor. |
| CS-23 | All-sold-out notice: `{name} has nothing in stock right now — listings are shown with their last checked dates.` | **Stands.** States the fact, names the seller, and points at the checked dates the cards show — the second clause is what makes "right now" honest, since the directory reports stock as last checked, not live. No apology, no promise of restock, no price or sales implication. |
| CS-24 | Failure line: `That didn't apply — you're still seeing the previous results. Try again.` | **Stands.** Plain, warm, and truthful about the state the visitor is in; "Try again." is an instruction, not a blame. (The apostrophes are typographic: `didn’t`, `you’re`.) |

**CS-19 — flagged, with the exact fix.** As specced, the two sibling empty states in the same results region name the shop two different ways: CS-19 says "at {name}" while CS-20 says "in {name}'s shop". A visitor who filters to empty and then searches to empty meets both lines minutes apart, and the page should name its own shop one way — the one-pattern rule this whole design runs on (Nadia §0.1), and the heading 32px above both lines already says "{name}'s shop". Nadia §9.2 kept "at {name}" deliberately, in the directory browse empty state's voice; inside the shop, the shop's own framing is the nearer pattern and wins. **Fix — CS-19 reads:**

> `No listings in {name}'s shop match those filters.`

(possessive per CS-05). Nothing else in the slot changes: the applied row stays, Clear All recovers, the line still names the situation and the shop. This is the only pattern-fixed wording I am changing, and it is a change of preposition and framing, not of meaning.

**CS-21 — typesetting note, not a rewording.** The spec writes this line with a leading ellipsis ("…with the current filters applied.") because it continues CS-20's sentence in the spec's prose. Mina §10.3 renders it as its own secondary line, so as built copy it is a standalone line and reads: `With the current filters applied.` — capital W, no ellipsis, final period. The words are Nadia's; only the sentence dress changes to fit the line's actual position. If the build instead appends it to the primary line, it stays lowercase after a comma: `No matches for “{q}” in {name}'s shop, with the current filters applied.` Either rendering is ruled; a line that literally begins "…with" is not.

**Inherited slots — untouched, confirmed present and consistent with the rulings above:** CS-08 "Search" (the site's search verb; the submit button needs no scope because CS-06's label carries it), CS-09 the four filter legends verbatim, CS-10 "Sort", CS-14 (above), CS-25 the zero-shop line and "Browse all varieties" link, CS-26 "No website on file for this seller." (the block's only absence line, shipped, and the exception that proves CS-04: it is a factual statement about one field that predates this build), CS-27 the strip chevron names, CS-28 the new-tab suffix.

---

## 6. OQ-4 — "sellers" vs "shops" on the seller index: position

**Position: keep "sellers" on the index for this build; do not align it as a side effect. If alignment ever happens, it should be its own deliberate copy pass, and my expectation is it would land on keeping "sellers" there too.** Brief reasoning, since this commission's words are the shop page's: the index is a directory of *sellers* — businesses a shopper can buy from — and "Sellers" is the accurate word for what the list lists. "Shop" on the seller page works because it is possessive and particular: it is *that seller's* shop, their storefront, which the directory presents but does not run. An index headed "Shops" drops the possessive and blurs exactly the line the "We don't sell seed." posture depends on — whose shop it is. Nadia's recommendation (leave the index alone for this build; align deliberately later, if the framing proves out) has it right, and the shop page's own breadcrumb stays "Sellers" per SPEC §12 in the meantime, which is consistent: the crumb names the list you came from, and the list is sellers.

---

## 7. Pushback and conflicts

- **No pushback against the commission or the SPEC's copy-adjacent rulings.** CS-04's closure is concurred with, on the record, in §1 — not silently accepted and not quietly overridden anywhere in this pass; no slot in this document contains absence language for phone or email.
- **One flagged pattern (CS-19)** with its fix, §5 — a disagreement with Nadia's browse-voice choice on a single line, argued from the design's own one-pattern rule; Nadia's obligations (name the situation, name the shop) are fully met by the fixed line.
- **One flagged tension (CS-01 vs Mina §14's "names the seller")**, §1 — resolved in favor of Nadia's contract and recommendation, with the fallback form recorded if Dustin rules the other way. No other conflict between professional practice and house standards arose: the craft (front-load the destination word, omit the needless repetition, one pattern per job) and the house rules (visible destinations, no implied sales, the seller's name intact) point the same way throughout this pass.

*— Wren, Copywriting / Storytelling. Evidence: Nadia's SPEC and Mina's UI design read in full from `origin/main` (SPEC §3.5 and §16 OQ-2/OQ-4 in particular; UI-DESIGN §14's inventory and PB-M2), Elena's ART-CONSULT (concurrence, no art — nothing in it touches words), the shipped seller page's register and label forms as recorded in both documents, and the catalog's real seller names worked through the CS-05 rule above. No code was written or changed by this pass, and no other specialist was dispatched.*
