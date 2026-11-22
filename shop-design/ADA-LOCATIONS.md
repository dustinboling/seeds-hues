# Seller-as-Shop — Accessibility Rulings: Locations Area (Ada, Delta Pass 1)

**Seat:** Ada, Accessibility — owner of the WCAG 2.2 AA floor. **Date:** 2026-11-22.
**Subject:** The Locations delta — Nadia's `shop-design/SPEC-LOCATIONS.md` §6.3 floors, against Wren's ruled strings in `shop-design/COPY-LOCATIONS.md` (heading `{name}'s locations`; kind labels `Physical address` / `Warehouse address` / `Mailing address`; primary marker `Primary`; no intro line).
**Method:** floors taken from SPEC-LOCATIONS §6.3 in full, read with §§3–5 (area-not-tab ruling, placement, contents, graceful absence) and the base SPEC's page structure (header `<article aria-labelledby="seller-title">`, `<h1>` = seller name; About headed "About this seller"; the catalog section's `<h2>` `"{name}'s shop"`). No part of this delta has been built, so no ruling below claims a rendered, screen-reader, forced-colors, or zoom proof — those are Quinn's delta-gate checks (SPEC-LOCATIONS §10, SH-20, as mapped in §8 below), and the conformance sentence at the end says exactly that.
**Conformance language:** these rulings are engineering evidence that the design, as specified and as prescribed here, meets the WCAG 2.2 AA criteria named. Built to WCAG 2.2 AA, not formally certified.

**Disposition in one line: every floor in §6.3 is CONFIRMED. No floor fails as designed. No string, placement, or composition value in Nadia's or Wren's work changes; the prescriptions below are build obligations that make the confirmed floors true in code, stated exactly so Quinn can check them.**

---

## L-A1 — No interactive elements, and NO tab semantics: **CONFIRMED — the negative is binding**

The area is static, server-rendered content (SPEC-LOCATIONS §3.3): it introduces **no interactive element of any kind** — no link, button, disclosure, or control — and therefore no tab contract arises. This seat confirms the negative in the strongest form the build brief can carry, because §6.3 names the exact failure it exists to prevent:

> **Binding prohibition.** The Locations area must not carry `role="tablist"`, `role="tab"`, or `role="tabpanel"`; must not carry `aria-selected`, `aria-expanded`, or `aria-controls` in connection with the section or its heading; must not implement roving tabindex, arrow-key navigation, or any show/hide panel behaviour; and must not be built as a `<button>`-headed disclosure. Dustin's commission wording was "an information tab or area"; Nadia ruled **area** (SPEC-LOCATIONS §3). A future builder pattern-matching the word "tab" in that wording and shipping tab roles for this section fails this ruling outright — tab roles on non-tab content are an ARIA misuse (4.1.2) that promises keyboard behaviour and panel state that do not exist, and strands a screen-reader user in a tab interface with one tab and no other panel.

Consequences that follow and are part of the ruling: the section is present in reading order and in the accessibility tree at all times when it renders; there is no selected state, no hidden state, and no state to announce (4.1.3 is not engaged); keyboard operation is ordinary reading/tab order, and since nothing in the area is focusable, the tab sequence passes from the header's last control to About's content exactly as if the area were a paragraph — which, semantically, is what it is. If a future design ever wants this content collapsed or tabbed, that is a new design with a new ruling from this seat, not an implementation choice under this one.

## L-A2 — Heading order: **CONFIRMED**

The Locations heading is an `<h2>` with Wren's ruled text `{name}'s locations` (COPY-LOCATIONS §1), sitting in this order and no other:

`<h1>` (seller name, in the header) → **`<h2>` `{name}'s locations`** → `<h2>` "About this seller" → (reviews panel heading, where present) → `<h2>` `"{name}'s shop"`.

- **No level is skipped and none is invented** (1.3.1, 2.4.6). Locations, About, and the shop are sibling sections of one page about one seller; they share `<h2>` correctly. The heading must be a real `<h2>` element, not styled text — screen-reader users navigate this page by its headings, and a visual-only heading is no heading.
- **Placement is part of the ruling, not just the level.** SPEC-LOCATIONS §4.1 places the section immediately after the header identity composition and before About; the heading order above is only true in that placement. A build that rendered the area after About while keeping an `<h2>` would still pass a level check and fail this ruling — the reading order (1.3.2) would announce a seller's locations after their description and, on shops with the area, would put two identity sections in an order no other shop page teaches.
- **The section pattern is the page's established one** (SPEC-LOCATIONS §4.4): a `<section>` with `aria-labelledby` pointing at this `<h2>`'s `id`. That gives the area a landmark-adjacent named region consistent with the About and shop sections, at no cost. The `id` must be unique on the page and the reference must resolve — Quinn checks the computed accessible name of the section equals the heading text.
- **When the area does not exist** (SPEC-LOCATIONS §5.4 — fewer than two qualifying locations), **nothing renders**: no heading, no empty `<section>`, no landmark, no reserved space. An empty named region in the landmarks list would announce a section with no content; absence must be absence in the accessibility tree exactly as it is on screen. This is the graceful-absence rule's AT half, and it is binding.

## L-A3 — List semantics for the entries: **CONFIRMED, with the structure prescribed exactly**

Entries form a real list (SPEC-LOCATIONS §6.3 floor). Prescribed structure, which is the floor made concrete:

```html
<section aria-labelledby="seller-locations-heading">
  <h2 id="seller-locations-heading">{name}'s locations</h2>
  <ul>
    <li>
      <!-- kind label (text) · primary marker (text, primary only) -->
      <!-- address lines (plain text) -->
    </li>
    <!-- one <li> per qualifying location, in SPEC-LOCATIONS §5.2 order -->
  </ul>
</section>
```

- **`<ul>` / `<li>`, not a `<div>` stack and not a definition list** (1.3.1). The list element is what makes the set and its count perceivable non-visually ("list, 3 items" is information a screen reader gives for free and a `<div>` stack never gives). A `<dl>` is wrong here: the entries are not term/definition pairs — kind and primary status are labels *of* the entry, and the address is the entry, not a definition of the kind.
- **Order in the DOM is §5.2's order** — primary first, then physical, warehouse, mailing, then state, then city — and DOM order, visual order, and reading order are the same order (1.3.2). No CSS reordering (`order`, reversed flow) may make the seen sequence differ from the heard sequence.
- **Each `<li>` is one location, whole.** Kind label, primary marker (where present), and all of that location's address lines live inside the same `<li>`, so the label is programmatically associated with the address it classifies by containment — a screen-reader user who lands on an address has already passed its kind inside the same item, and cannot meet a bare address whose kind lives in a neighbouring element.
- **No list styling may remove the semantics.** If the visual design suppresses bullets, it does so with CSS that preserves the list role; in particular the build must not rely on `list-style: none` alone in a way that drops list semantics in VoiceOver — the shipped site's list patterns govern, and Quinn's screen-reader pass (SH-20) verifies the list is announced as a list with the correct count.

## L-A4 — Primary marker and kind labels as text: **CONFIRMED**

Wren's strings are the ruling's content and they satisfy 1.4.1 (Use of Color) and 1.3.3 (Sensory Characteristics) by construction:

- **Kind is carried by the words `Physical address` / `Warehouse address` / `Mailing address`** (COPY-LOCATIONS §2) — full, unabbreviated text on every entry, at every width. No entry's kind may be carried or supplemented-as-sole-channel by colour, an icon, a glyph, position in the list, or the address's own shape (a PO Box string is not a kind label; SPEC-LOCATIONS §6.2 already forbids inferring kind from shape, and this ruling forbids presenting it that way). An entry without a determined kind does not render (§6.2) — so there is no unlabelled state for this floor to cover, which is the correct way to satisfy it.
- **Primary status is carried by the word `Primary`** (COPY-LOCATIONS §3), rendered as its own text on the primary's entry only, separate from that entry's kind label — never merged into the kind string, never carried by first position alone (§5.2's first position reinforces the word; the word carries the fact), never by colour, weight, a badge ground, or an icon alone. Weight or dress may accompany the word; if every visual distinction were stripped (forced-colors mode, text-only rendering), the words `Primary` and the kind label would still state both facts in full. That is the test this ruling applies, and the design passes it on paper.
- **Both strings must be real DOM text.** Neither the kind label nor `Primary` may be rendered as CSS generated content (`::before` / `::after` `content:`), as an image, or as a background — generated content is not reliably exposed to assistive technology, and a marker that exists only visually fails 1.3.1 even though it "looks" labelled. Equally, neither string may be `aria-hidden`: they are the information, not decoration. No `aria-label` may replace or override them (2.5.3's discipline, applied to text: what is seen is what is heard).
- **No icon is designed in, and none is needed.** If Mina's composition adds a decorative glyph beside either string, it is `aria-hidden` and the ruling is unchanged; if any future glyph were proposed as a *carrier*, it would need a text equivalent beside it — the strings already are that equivalent, which is why the design needs nothing more.

## L-A5 — Address lines as plain text: **CONFIRMED**

Address lines are plain text (SPEC-LOCATIONS §5.1.1: the seller's published address, verbatim — street/PO Box line, then city, state, ZIP; or city/state only where that is all the seller publishes). Rulings:

- **No link semantics.** No address line, and no part of one, is an `<a>`: there is no map link, directions link, or geocoding in this delta (§5.1.1), and — per the interim position at SPEC-LOCATIONS §7.3, which this ruling adopts as the floor position until Mina's Item SI delta rules otherwise — **the state name inside an entry is text, not a link to `/state/{slug}`**. The header's A4 state link remains the page's one state door. If Mina's delta ever introduces a state link inside entries, link-purpose naming (2.4.4) returns to this seat before build, exactly as §6.3 provides; until then, a build that links a state name inside the area exceeds the design and this ruling.
- **No other interactive semantics hide in the text.** The address is not a `tel:`/`mailto:` surface (channels live only in the contact block, §5.1.2), carries no `tabindex`, and is not placed inside any neighbouring link or button — the header's controls end before the section begins (§4.2: the area is a sibling after the header, not an insertion into it, and not a fourth `<dl>` entry).
- **Verbatim means perceivable verbatim.** The rendered text must equal the published address as recorded, including the ZIP and any PO Box number — no abbreviation, no reformatting that drops a line, and no CSS `text-transform` that changes characters (an uppercased ZIP or street line is a changed fact at the level a screen reader spells it). Line breaks between address lines may be block elements or `<br>`; either is acceptable provided each line is read as part of the same `<li>` (L-A3) with no intervening heading, list, or landmark boundary.

## L-A6 — Reflow at 320px and survival at 200% text: **CONFIRMED as the floor, with the build obligations that make it pass**

The section must reflow at 320 CSS px wide with no horizontal scroll (1.4.10) and must survive 200% text resize (1.4.4) and the 1.4.12 text-spacing overrides (line height 1.5×, paragraph spacing 2×, letter spacing 0.12em, word spacing 0.16em) with no loss, clipping, or overlap. The design introduces nothing that fights any of this — no fixed widths, no multi-column layout, no fixed-height container is proposed — and the following obligations state what the build must preserve for the floor to hold:

- **Entries stack in one column at every width**; nothing in the area is a row, table, or grid that could demand a second dimension. Address lines wrap at spaces inside the `<li>`'s full width; no `white-space: nowrap` on any line, label, or marker. The longest unbreakable tokens the content can contain (a ZIP+4, a PO Box number, a long city or street word) are all short against a 320px measure minus page padding, so natural wrap suffices — no `overflow-wrap` breaking inside a word is needed or permitted (breaking a word in an address changes the address).
- **No fixed height anywhere in the section.** The section, the list, and each entry size to their content and grow under 200% text and under the spacing overrides; kind label, marker, and address lines may take more lines and more height, and that growth must push subsequent content (About) down, never overlap it and never clip. A clipped third address line at 200% is a 1.4.4 failure against this ruling regardless of how the default rendering looks.
- **Target size does not arise** — correctly, per §6.3: nothing in the area is tappable (L-A1, L-A5), so 2.5.8 has no object here. This is stated so the gate does not go looking for a target to measure, and so a future addition of any tappable element to the area is recognised as a new floor question (44px house standard, focus visibility, and 2.4.4 naming) requiring a return to this seat.
- **Contrast is inherited, not new.** The area consumes the existing section/heading/body system (SPEC-LOCATIONS §6.4) and introduces no new colour, ground, or state; the heading and body pairs are the base design's pairs, already recomputed and approved in `ADA-RULINGS.md` Ruling 1 (ink on paper 12.6803:1; muted on paper 5.5636:1 — both past 4.5:1 unrounded). No nearest-passing value is prescribed because no pair in this area needs one. If Mina's composition introduces any new token for this section, that pair comes back to this seat before build — §6.4's own terms.

## §7 — What this pass does not engage

No motion, no flashing content, no timed content, no form, no error state, and no live region exists in this area; 2.2.x, 2.3.1, 3.3.x, and 4.1.3 are not engaged and are recorded as not engaged, not overlooked. Dark-mode pairs: none new (L-A6). Text over imagery: none — the area is text on the page ground. The Item SI state-outline question (§7 of the delta) is Mina's; this ruling's only stake in it is L-A5's link position, recorded there.

## §8 — Gate inputs for Quinn (delta gate; consume verbatim)

These restate SPEC-LOCATIONS SH-20's accessibility inputs in checkable form; they extend, and do not replace, SH-15…SH-19:

- **LOC-A1 (no tab semantics):** rendered DOM of a two-location shop contains no `tablist`/`tab`/`tabpanel` role, no `aria-selected`/`aria-expanded` attached to the section, no button or link inside the section, and no element with a non-negative `tabindex` inside it. Any hit is a FAIL.
- **LOC-A2 (heading order):** heading outline of a shop with the area reads H1 → H2 `{name}'s locations` → H2 "About this seller" → H2 `{name}'s shop`, in DOM order; the `<section>`'s computed accessible name equals the Locations heading text. A shop without the area has no Locations heading and no empty section element.
- **LOC-A3 (list):** the entries are a single `<ul>` whose `<li>` count equals the qualifying-location count; a screen-reader pass announces a list with that count, and each item is heard with its kind label (and `Primary` on the primary's item) before/with its address.
- **LOC-A4 (text-carried facts):** with CSS colours and backgrounds removed (forced-colors or text-only rendering), every entry still states its kind in words and the primary still states `Primary` in words; neither string is CSS generated content (inspect the DOM text nodes).
- **LOC-A5 (plain-text addresses):** no `<a>` element exists inside the section; every rendered address line matches its recorded source verbatim, ZIP and PO Box included.
- **LOC-A6 (reflow/resize/spacing):** at 320px, at 200% text, and under the 1.4.12 overrides, the area shows no horizontal scrollbar, no clipped or overlapping line, and every address line fully visible; About follows the grown section without overlap.

## Summary of dispositions — Pass 1

| Floor (SPEC-LOCATIONS §6.3) | Disposition |
|---|---|
| No interactive elements; NO tab semantics | **CONFIRMED** — binding prohibition prescribed (L-A1); a tab-roled build FAILs |
| Heading order — `<h2>` after the `<h1>`, before About's heading | **CONFIRMED** (L-A2), incl. total absence when the area does not exist |
| List semantics for the entries | **CONFIRMED** — `<ul>`/`<li>` structure prescribed exactly (L-A3) |
| Primary marker and kind labels as text, never colour/position/icon alone | **CONFIRMED** (L-A4) — Wren's strings satisfy 1.4.1/1.3.3; real DOM text required |
| Address lines as plain text | **CONFIRMED** (L-A5) — no links, incl. no state link, per the §7.3 interim position |
| 320px reflow; 200% text survival; no horizontal scroll | **CONFIRMED** (L-A6) — obligations stated; proofs are Quinn's LOC-A6 |
| Floors that FAIL as designed | **None** |

*— Ada, Accessibility. Evidence: SPEC-LOCATIONS §§3–7 and §10 read in full from `origin/main`; COPY-LOCATIONS §§1–4 (the ruled heading, the three kind labels, `Primary`, and the no-intro-line ruling); base SPEC §§2–3 (header `<h1>` and article structure, About's heading and position, the shop section's `<h2>` pattern) and `ADA-RULINGS.md` Ruling 1 (the inherited contrast pairs, recomputed there from the shipped hexes). Unmeasured and still open, stated plainly: this area has not been built, driven with a real screen reader, viewed in forced-colors mode, or tested at 320px / 200% / spacing overrides by this seat — §8's checks are where those proofs happen, and nothing in these rulings claims them early. Built to WCAG 2.2 AA, not formally certified.*
