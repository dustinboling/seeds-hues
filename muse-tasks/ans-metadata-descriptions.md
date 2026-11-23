# ANS completion — variety metadata descriptions: the seller roster comes out (Dustin ruling, 2026-11-23)

## Provenance

Item ANS (the seller-list answer string) shipped its first half on 2026-11-22 (PR #44): the string was removed from the variety page's visible header; the paragraph now renders only for zero-seller varieties, whose sentence names no sellers. At ship time Hue flagged that the identical string still lived in each variety page's meta description, OG description, and Twitter description. **Dustin has now ruled (2026-11-23): "Remove it from the metadata too."** This brief is that completion build. It closes Item ANS.

The replacement form was specced by the two seats Hue commissioned: Bea Discovery (SEO/GEO — structure, slots, reserves, prohibitions; her spec is summarized in the rules below) and Wren (copywriting — the final templates and exact clause strings, two passes). Two points where the seats disagreed were ruled by the coordinator; both rulings and the losing positions are recorded in §4 so the gate judges the brief as written, with the disagreement visible.

## The change (one function)

Rewrite `varietyDescription(v)` in `v2/lib/seo/metadata.ts` to compose the description from the templates in §2, WITHOUT using `v.answer`. That one string feeds meta description + `openGraph.description` + `twitter.description` via `pageMetadata` — all three fields take the new form; they keep sharing one string.

Hard fences:

- The data-layer `answer` field STAYS, byte-for-byte in behavior: it is still produced by the catalog service and still rendered on-page for zero-seller varieties (variety-view.tsx, PR #44's form). Do not touch `answerSentence`, the catalog service, or variety-view.tsx.
- Titles are OUT of scope (Bea's flagged note, endorsed by the coordinator): `varietyTitle` keeps its seller count. Do not "helpfully" extend the removal.
- No other page type's metadata changes (seller/state/crop descriptions are untouched).
- No price, in any form, ever (standing rule; a leak is a gate defect).
- **Structured-data check (Bea §5):** grep the variety page's structured-data generation for any `description` field fed by `varietyDescription` or `.answer`. If one exists, it takes the same replacement form under this brief and you say so in the PR body; if none exists, state that finding in the PR body. Never relocate the roster into JSON-LD or any hidden field.

## §2 The templates (Wren's final forms, as ruled)

One string, hard cap 160 characters including spaces and punctuation. US spelling. Numerals for counts where a count appears.

**Shared mechanics:**
- HEAD = `{Variety}` + crop word + ` seeds`. The crop word (the crop's standard display name, as `shortCommonName` renders it) is added ONLY when the variety name does not already end with it (case-insensitive check on the final word). "Cinnamon Basil" + Basil → `Cinnamon Basil seeds`, never "Cinnamon Basil Basil seeds."
- LATIN slot = ` ({Latin})` immediately after the head, rendered only when a Latin name exists; when absent, omitted entirely — no empty parentheses, no double space.
- Separators: `. ` after the head/Latin block; a single space between later slots. Every slot is a complete sentence ending in `.`.
- DIRECTORY CLAUSE (exact string, 48 chars): `Sellers list packet sizes in the Seed Directory.` Never clipped — included whole or dropped.
- Seller count for template selection and the fallback = the number of distinct sellers listing the variety (the same unique-slug count `varietyTitle` computes).

**Template A — sellers ≥ 1, usable prose present:**
`{HEAD}{LATIN}. {PROSE} {DIRECTORY CLAUSE — only if it fits whole in the space remaining after the prose}`
- PROSE = the FIRST SENTENCE of the variety's own prose, whole. (Coordinator ruling on Flag 1, §4: sentence-or-nothing — if the first sentence does not fit whole in the space after head/Latin, the prose is unusable and the variety takes Template B. Never clip prose at a word or phrase boundary; no ellipsis ever appears in the output.)
- Prose is never shortened to make room for the clause; the clause is the only optional element.

**Template B — sellers ≥ 1, prose absent or unusable (fallback):**
`{HEAD}{LATIN}. Listed by {N} US seller{s} in the Seed Directory. {PACKET RANGE — conditional} {CLOSING}`
- Count clause: N = distinct seller count, numeral; singular agreement mandatory (`seller` when N = 1, `sellers` when N ≥ 2). This is the ONLY form in which a count appears.
- PACKET RANGE (conditional): rendered only when a range is computable from the variety's actual listings' packet sizes, in the units the page itself displays: `Packets from {min} to {max} seeds.` — or, when min = max, `Packets of {min} seeds.` When not computable, omit the slot entirely; no placeholder.
- CLOSING: when the packet range rendered → `Each listing links out to buy.` When it was omitted → the DIRECTORY CLAUSE.

**Template C — zero sellers:**
`{HEAD}{LATIN}. {HONESTITY + WAITLIST CLAUSE} {PROSE — only if its first sentence fits whole in the space remaining}`
- HONESTY + WAITLIST CLAUSE (exact string, 61 chars): `No US sellers currently list this variety. Join the waitlist.` (Coordinator ruling on Flag 2, §4: the clause renders immediately after the head, not last.) It never says "out of stock", "unavailable", or "discontinued", and contains no numeral. The string `0 sellers` never renders in any form.
- Prose after the clause, sentence-or-nothing as in Template A. A zero-seller variety with no usable prose renders head (+ Latin) + the clause, complete.

**Worked examples (from the seats' passes — your tests should reproduce these forms):**
- A: `Cinnamon Basil seeds (Ocimum basilicum). Warm cinnamon-scented leaves for teas, garnishes and bouquets. Sellers list packet sizes in the Seed Directory.` (152 chars; the prose sentence is a stand-in in the example — real prose comes from the variety's data.)
- B: `Cinnamon Basil seeds (Ocimum basilicum). Listed by 17 US sellers in the Seed Directory. Packets from 25 to 300 seeds. Each listing links out to buy.` (148 chars; packet range only when real.)
- C: `Genovese Basil seeds (Ocimum basilicum). No US sellers currently list this variety. Join the waitlist.` (+ prose after, when it fits whole.)

**Assembly guarantee:** the algorithm above produces ≤160 characters BY CONSTRUCTION (each optional element is admitted only if it fits whole). The existing `clip()` may remain as a safety net, but a correct build never triggers it: your tests assert every fixture output is ≤160 chars and contains no `…`.

## §3 Tests

In the house style, covering at minimum:
- Each template rendered from fixtures: A (prose fits + clause fits; prose fits + clause dropped), B (N ≥ 2 with packet range; N = 1 singular, no range → directory-clause closing), C (with prose; without prose).
- The head rule: a variety name ending in the crop word produces no duplication; one that doesn't, gains it.
- Missing Latin → no parentheses artifact, no double space. Missing prose → Template B/C forms, no placeholder text.
- A prose first sentence too long for the allocation → Template B (multi-seller) or head + clause only (zero-seller) — never a clipped fragment, never an ellipsis.
- **Name-absence census:** fixtures whose seller names are distinctive strings (e.g. "Zephyr Test Farm") across high-count, single-seller, and zero-seller cases — assert no seller name, and no fragment of the old roster syntax ("As of", "sellers list"), appears in any output.
- The §5 structured-data grep result is stated in the PR body (a test is not required for the grep itself).

## §4 The two coordinator rulings (recorded; Bea's positions preserved)

- **Flag 1 — prose clipping.** Bea's spec permitted clipping prose at a word boundary when the first sentence didn't fit (never mid-word, ≥40-char minimum). Wren argued sentence-or-nothing: a word-clipped fragment dangles ("…garnishes and…") and reads as a broken site in the snippet — the trust the description exists to earn. **Ruled for Wren:** sentence-or-nothing; Bea's minimum-fragment concern lapses because no fragments can occur. Bea's remaining mechanics (priority order, clause-optional, fallback) stand as specced.
- **Flag 2 — zero-seller clause position.** Bea's spec rendered the honesty + waitlist clause last, its space reserved first. Wren argued it belongs immediately after the head: engines display fewer characters than the full meta and frequently rewrite snippets (a behavior Bea's own measurement note records), so a zero-seller description that opens with prose can present as a buyable variety to anyone who sees only its first half. **Ruled for Wren:** clause immediately after the head; prose follows in the remaining space. The clause is whole in every rendering under both designs; this ruling governs position only.

## Finish discipline

Run `npx eslint .` after each file; `npm run verify` after each test file and in full before ending your turn — iterate until it exits 0. Type fixtures with the app's exported types. Leave the tree clean and **leave your work uncommitted** (the workflow's steps handle branching and commits). If the verify gate goes red, a `muse/wip-<run_id>` branch survives and a repair dispatch continues it — a safety net, not a license.

## PR body hygiene

Provenance (Dustin's ruling + this brief + the seats' specs as summarized in §2/§4), Build accounting (verify summary + diff census), the §5 structured-data grep result, and a Gate record section for Quinn's verdict.

## Gate (for the coordinator's record)

Quinn build gate: verify reproduction; real-render proof of the rendered meta + OG + Twitter tags on a multi-seller variety and a zero-seller variety served from the built branch; name-absence sampled across high-seller-count, Latin-absent, prose-absent, and zero-seller renders; the fence audit (answer field and on-page zero-seller paragraph untouched; titles untouched; no other page type changed); T-C (no prices).
