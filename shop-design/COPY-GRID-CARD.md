# Seller-as-Shop — Variety Card Copy Rulings (Grid / Card Delta)

**Seat:** Wren, Copywriting / Storytelling. **Commission:** Nadia's SPEC-GRID-CARD §7.4 — review the variety card's surviving strings as one set, in both contexts (browse and shop), and confirm each as-is or correct it. No new copy is introduced by the delta; the Latin line is data, not copy (§6 of this document).
**Date:** 2026-11-22 · **Status:** Ruled. Headline result, stated plainly: **every surviving string stands as-is.** One harmonization is ruled at §1 — the unified card's crop line takes the browse card's short form in both contexts — because the two shipped surfaces the delta unifies currently differ there. No string in this set requires any change to COPY.md.
**Method:** every string below was verified against the shipped components, not the spec's paraphrase — `VarietyCard.tsx` (crop line, seller-count line), `ListingRow.tsx` (stock line composition, pill), `Availability.tsx` (the five availability words), `PacketList.tsx` (packet labels), `lib/format.ts` (`plural`, `shortCommonName`, `formatCheckedDate`).
**Governing rules applied:** US spelling throughout; prices never shown; the directory reports stock as last checked, never as live; one pattern per job; no invented facts — a card without a fact shows less.

---

## 1. The crop line — CONFIRMED (short form, both contexts)

**String:** the crop's short common name — `shortCommonName(plant.commonName)`, i.e. the text before any " / ": `Cornflower / Bachelor's Buttons` renders on the card as `Cornflower`.

**Reasoning.** The line's job on a card is orientation — which flower this variety belongs to — and one name does it at scanning speed. The alternate names after the slash are detail-page facts (they live on the variety and crop pages); on a fixed-height card they would spend the zone's air on synonyms and wrap against the variety name above them. **Harmonization, ruled explicitly so the build carries one line, not two:** the browse card ships this short form today, while the seller-context ledger subline ships the full common name. The unified card (§4.1 of the delta) uses the **short form in both contexts** — the card's established form wins, because the card is the scanning surface on both. Nothing is lost from the directory: the full string still renders where it renders today outside the card.

## 2. The seller-count line (browse context) — CONFIRMED as-is

**Strings:** `No sellers yet` (count 0) · `1 seller` · `{N} sellers` (N ≥ 2, via `plural()`).

**Reasoning, per form.** The nonzero forms are a bare count with correct singular/plural grammar — a fact, no verb needed, and the card's one availability statement in browse context (the shop context carries the stock line instead; the delta's closed context list stands). The zero form is the honest one: the variety is in the catalog and no seller carries it yet, and "yet" is accurate for a directory whose listings grow — it states a current absence, not a permanent one, and it promises nothing. All three forms stand exactly as shipped.

## 3. The stock line (shop context) — CONFIRMED byte-for-byte

**Composed strings:** `{Availability word} · Checked {date}` when a checked date exists; `{Availability word} · Not yet checked` when it is null. Availability words (verbatim): `In stock` · `Sold out` · `Preorder` · `Shop closed` · `Unknown`. Date forms (verbatim, from `formatCheckedDate`): `today`, `yesterday`, or short month + day (`Nov 19`). Never an ISO string.

**Reasoning.** Inherited from the ledger, and it reads *better* on a product card, not worse: a product card is exactly where a shopper asks "can I get it, and how fresh is that claim?" — and this line answers both halves in one breath. The words are the shopper's own shelf vocabulary and match the shop's sort/count language ("in stock first", COPY CS-15; the all-sold-out notice, CS-23), so the page speaks one stock language throughout. The five words stay distinct because the states are distinct — `Shop closed` (the seller is closed) must never collapse into `Sold out` (this variety is gone), and `Unknown` is the honest fallback where no state is known; paired with `Not yet checked` it is redundant-looking but truthful, each half answering a different question. The checked-date phrasing is what keeps every one of these words honest: the directory reports stock *as last checked*, and "Checked Nov 19" says so on the card's face, where a bare "In stock" on a product card would imply a live inventory the directory does not have. `Not yet checked` is plain and unapologetic. All forms stand.

## 4. Packet-size labels — CONFIRMED as-is (component unchanged)

**Strings:** the field label `Packets: ` followed by the listing's packet labels joined by ` · `, with `({seedCount} seeds)` appended to a label when the count is not already in the label text — e.g. `Packets: Packet (25 seeds) · Large packet (100 seeds)`.

**Reasoning.** §7.4 rules this component unchanged, and its words earn that: "Packets:" is a field label in the card's established label-then-value dress (the same relationship COPY §1 ruled for the contact rows), not a count claim, so it stands in the same form whether a listing carries one packet size or four. The parenthetical seed count is the shopper's quantity fact, given without a price — packet sizes shown, prices never shown, per the settled model. No wording change.

## 5. The "Visit shop →" pill — CONFIRMED as-is (already ruled; unchanged)

**Strings:** visible text `Visit shop →`; screen-reader text `Shop at {name} (opens in a new tab)`.

**Reasoning.** This label is mine from the ledger and it survives the move to a product card without a syllable changed, because the card does not change what the pill does: it leaves via `/go/{id}` to this seller's product page for this variety. On a product card it reads exactly right — the object is the *shop*, the arrow marks the leaving. It also keeps the distinction COPY §1 established against the contact block's website button: `Visit shop →` (one variety's product page, via `/go/`) vs `Visit their website ({host})` (the seller's homepage). Two doors, two different second words; the grid card introduces no third. Stands.

## 6. The Latin line — NO WORDING SLOT (affirmed)

The Latin line is **data, not copy**: the crop's stored `latinName` string, verbatim and whole, or nothing when it is null (SPEC-GRID-CARD §§6.2–6.3). **No "Latin:" prefix label is created by this pass, and none may be added in the build.** The italic botanical line directly under the plate needs no label — its form is its identification, the way a seed rack's botanical line is — and a prefix would be a needless word on every Latin-carrying card and one more labeled absence on the roughly one card in three that carries no Latin name. There is no string here to confirm or correct, and this section exists so the absence of one is a ruling, not an oversight.

---

**Summary for the build:** build the card's words exactly as shipped in the components named above; apply §1's short crop form in shop context as well as browse; create no Latin label. Quinn's SH-G checks can take every string in this document as the expected text.

*— Wren, Copywriting / Storytelling. Evidence: SPEC-GRID-CARD §§2.2, 3.3, 4.1–4.2, 6.1–6.3, 7.4 read in full; shipped component source as listed in Method; COPY.md §§1 and 5 (the CS-01 door distinction and the CS-15/CS-23 stock language this set agrees with). No code was written or changed by this pass.*
