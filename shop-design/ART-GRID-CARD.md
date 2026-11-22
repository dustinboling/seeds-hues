# Seller-as-Shop — Art Rulings on the Grid-Card Delta: Tier Order, Placeholder Ground, Tier 4, and the 1:2 Frame

**Seat:** Elena, Art Direction / Illustration. **Type:** The two rulings asked of this seat in `shop-design/SPEC-GRID-CARD.md` §7.2, plus the concurrence that slot also asks for (§3.2's frame). Rulings only — no artwork commissioned, painted, moved, or redesigned by this document.
**Date:** 2026-11-22 · **Status:** Binding on the grid-card build. Where this document and a shipped component disagree, this document is the decision and the component is the thing that changes.
**Governing references applied:** my playbook (profession first, house standards on top); `THEME-ART-DIRECTION.md` (the Illustrated Seed Catalogue — plates shown whole, flower detail first, motif rationing); my binding plate rule and my C6 designed-placeholder ruling with its full reasoning at §D.4 / §D.7 (`ui-audit-2026-11-20/ELENA-CONSULTATION.md`); PR #13's design pair (`seller-listings-photo-design/UX-STRUCTURE.md` §2, `UI-VISUAL-SPEC.md` §1.3 / §7.2); Nadia's delta (`shop-design/SPEC-GRID-CARD.md` §§2–4, read in full, measurements hers and relied on as measured).

**The rulings in one line each:**

1. **Tier order — CONFIRMED.** Crop plate is tier 2 on every grid, browse and shop alike; the pod-first order shipped in `VarietyCardImage` is reversed. The placeholder ground is **`paper-deep`**.
2. **Tier 4 — NOT confirmed. The in-frame divider stem is replaced** by the designed seed-pod device in its generic, directory-mark form, on the same `paper-deep` ground as tier 3 — one placeholder presentation everywhere.
3. **The 1:2 whole-plate frame at shop-grid size (§3.2) — CONCUR**, unqualified, reasoning at §3 below.

---

## 1. Ruling 1 — Tier-order harmonization: crop plate is tier 2, everywhere

### 1.1 The decision

The unified variety card resolves its art frame in this order, first hit wins, in **both** contexts and on **every** grid surface (`/variety`, crop, series, variety-page siblings, and the shop grid):

1. **The variety's own first plate** — alt "{varietyName} — illustration".
2. **The crop's first plate** — alt "{crop common name} — illustration".
3. **The designed seed-pod placeholder** — the crop's pod device where the crop has one (tier 4's generic form where it does not, §2), decorative, on `paper-deep` (§1.3).
4. ~~The in-frame divider-stem placeholder~~ — **removed as a tier** (§2). The order now has three tiers; what was tier 4 is tier 3's second form.

This is my binding plate rule — *a variety without its own plate uses its crop's plate* — applied to the one surface that never received it. Nadia's spec adopts the rule; I confirm the adoption and close the conflict PR #13 §2.4 recorded and correctly left to this seat.

### 1.2 Reasoning

- **A real painting of the crop is identification; a decorative device is not.** The card's art has one job — *identify* — and the crop plate does it: it shows the shopper the actual flower family, in the actual painting style, at a size where the bloom reads. The pod motif, however well drawn, says only "seed" in general. Where a truthful picture exists, showing a symbol instead is the catalogue choosing decoration over information, and the profession's rule is the house rule here: cut any element that does not serve the piece's job when a better element is on hand.
- **The same hierarchy already governs everywhere the question has been settled.** The variety hero takes crop plate over placeholder (my C3 ruling: variety plate → crop plate → placeholder, and the placeholder never in the mount while a crop plate exists); PR #13 took it for seller listings (§2.2, four tiers with crop plate second). The browse card's pod-first jump was the outlier — an accident of the card component's history, never a ruled preference. Harmonizing *toward* the outlier would have meant reversing two settled rulings to preserve one unruled one.
- **Placeholder-heavy grids read as unfinished.** The 2026-11-19 design audit's finding, which Nadia cites and I stand behind: at the observed ratios, rows of placeholder frames read as "rows of empty picture frames." 229 of 812 varieties (28.2%) have no plate of their own. Pod-first would put a device, not a painting, on more than a quarter of every browse grid — permanently, since the device would also remove the visible pressure of the plate backlog. Crop-plate tier 2 reduces placeholder presentations on current data to **zero** (every one of the 229 has a crop plate; all 124 crops are plated) and keeps the placeholder what my C6 ruling designed it to be: a correct fallback for a case that does not currently occur.
- **Repetition at product size is grouping, not decoration.** The honest counterweight — one crop plate repeating across that crop's plateless varieties — was weighed at two sizes. At PR #13's 72px rail, Nadia's diagnosis (§2.1.4) is right that repetition reads as ornament; at the unified card's full-width frame (~175px wide on a 2-column phone grid) the painting is recognizable, and repetition groups same-crop varieties the way a seed rack groups packets — a scanning aid, and a truthful one. The shop grid inherits the same size, so the same reading holds there.

### 1.3 The placeholder ground, settled in the same ruling: `paper-deep`

**The designed placeholder (tier 3, both forms) sits on `paper-deep`** — the token `--color-paper-deep` (`#F0E5CB`), class `bg-paper-deep`. My C6 ruling specified the pod device on `paper-deep`; the shipped placeholders (`VarietyCardImage`, and `ListingArtwork` following it) sit on `bg-paper`. Mina recorded that divergence at PR #13 (`UI-VISUAL-SPEC.md` §7.2) and deferred to Nadia's document for that build; Nadia's delta flags it for this slot. **It is resolved here in C6's favour. The shipped ground is the divergence; `paper-deep` is the ruling.**

Reasoning, stated once so it does not need a third ruling:

- **Plates are padded onto `paper`.** A placeholder on `paper` wears a plate's exact ground, so at grid distance an unplated card reads as a blank or failed plate — the one reading a designed placeholder exists to prevent. The ground is the signal: `paper` says *painting*, `paper-deep` says *no painting yet, by design*.
- **`paper-deep` is the system's recessed ground** (theme §1: recessed bands, footer ground) and already the skeleton's ground (`.skeleton`). Placeholder and skeleton become one family — a stepped-down paper for content that is not there yet — which is exactly the similarity grouping a shopper should learn once.
- **Scope, closed:** the ground change applies to placeholder frames only, in the unified card, both contexts. Tiers 1–2 keep `bg-paper` — that ground is the plate's own margin and must stay seamless with it. Sold-out dress is untouched (the placeholder is decorative, `alt=""` / `aria-hidden`, carries no text, so no contrast pairing is created or changed). If `ListingArtwork` survives anywhere in transitional code, its placeholder frames take the same ground; under the delta it retires (SPEC-GRID-CARD G-4) and the unified card is the only surface this binds.

### 1.4 Consequences weighed, and what this ruling does not do

- **Browse grids change for 229 varieties** — pod/stem placeholders become crop plates. Accepted and intended; it is the largest visible effect of this ruling and the reason it was reserved to this seat rather than taken as a side effect of PR #13.
- **PR #13 stands unrevised.** Confirming keeps the seller page's shipped tier order exactly as built (§2.2 of its UX ruling). The alternative — pod-first globally — would have revised PR #13's tier 2 on the seller page, demoted 333 listings (22.4%) from crop plates to a device, and done so to preserve the browse card's unruled behaviour. Weighed and rejected on every count.
- **A crop plate on a variety card can be momentarily read as the variety's own.** This risk is real and was accepted at C3 for the hero, on the same terms here: the alt text names the crop (tier discipline, §1.1), the card's own text names variety and crop, and no apologetic "this is the crop" label is added — the interface does not apologise for a sound decision. What the card never does is *claim* the painting is the variety's: alt text is where that claim would live, and it is ruled per tier.
- **Tier 2 is a stand-in, not a settlement.** A variety shown by its crop's plate is still a variety whose own plate is owed. The plate backlog's standing order is unchanged — when a variety's own plate is painted, it takes tier 1 and replaces the crop plate, with no card change. This ruling must not be read, by anyone scoping backlog work, as "229 varieties solved."
- **Payload:** the delta's one payload change (browse-side `cropMedia` on `VarietyListItem`, SPEC-GRID-CARD §6.4) is the necessary and sufficient data path for this ruling. Nothing else is asked of the data.

---

## 2. Ruling 2 — Tier 4's in-frame stem: replaced, not confirmed

### 2.1 The decision

**The divider stem does not survive as the last-resort placeholder — not between frame and text (already removed by the commission), and not inside the frame either.** Tier 4 is replaced:

> **Where a variety has no plate of its own, its crop has no plate, and its crop has no pod device, the frame holds the designed seed-pod device in its generic form: the directory's own pod mark** — the ripe breadseed-poppy pod that has served as the site's icon source since 2026-11-17 (`v2/public/brand/poppy-pod-mark.png`, owner-approved painting, transparent ground) — centred in the frame, on **`paper-deep`**, at the same set size and muted treatment as tier 3's crop pod device, decorative (`alt=""`, `aria-hidden`). Tiers 3 and 4 thereby become **one tier with two forms of one device**: the crop's own pod where the crop has one, the directory's pod where it does not. A builder derives the web motif file from the mark's source through the same self-hosted image path as the other pod motifs (never hotlinked, never the raw brand PNG inlined at source weight); my standing sizing/placement check (audit item F3) applies to the result before it ships. If that check ever fails, the fallback is the **empty `paper-deep` frame** — never the stem, and never another crop's pod motif borrowed across crops (a zinnia pod standing in for a pea would misidentify, which is the one thing a placeholder must never do).

### 2.2 Reasoning — why the distinction Nadia offers does not save the stem

Nadia's flag is precise and I take it seriously: the in-frame stem is a *different element* from the removed mini-stem — different class (`.divider-stem`, not `.divider-stem-mini`), different job (holding a frame, not punctuating a card), visible today on zero cards. The distinction is real. It does not change the ruling, for four reasons:

1. **My motif ration already ruled on this exact use.** The ration table (consultation §D.4) is explicit in two rows: *inside data components — no*, and *placeholder frames — no: the placeholder gets its own device, not the stem; two different "empty" signals would blur both.* That ruling was made knowing the stem sat inside placeholder frames — it is the shipped behaviour it described. Confirming the stem now would reverse a standing ruling of this seat on no new evidence; the in-frame/between-frame distinction was present when the ration was written and was not treated as an exception then.
2. **One "empty" signal, learned once.** Under §1, placeholders become rare and precious as signals: a shopper who ever meets one must read it instantly as *painting to come*. If the pod means that on one card and the stem means it on another, neither means it reliably — similarity is what makes a device a language. The pod is the placeholder's device (C6/§D.7: "one device, one size per context, everywhere a plate is missing"); tier 4 is where that sentence is either kept or broken.
3. **The stem's meaning is punctuation, and a placeholder is not a pause.** The stem works where it is rationed — footer close, prose breaks, page closes — because it always means *a section ends; breathe*. Inside a product frame it would be read against that grammar: a divider wandering through a portrait frame. The generic pod carries no competing grammar; since 2026-11-17 it has meant *this directory* on every page's icon, which is precisely the neutral, universal ownership a cross-crop placeholder needs. It cannot be mistaken for any one crop's identity because its established job is already everyone's.
4. **Geometry.** The stem device is a wide, thin horizontal (220×24). Centred in a tall 1:2 portrait frame it strands a hairline across the middle of a large empty field — the weakest possible frame-holder, reading as a misplaced divider at exactly the moment the frame most needs to look intentional. The pod mark is a tall, centred, single subject (585×1031 in its source): it was composed for a centred field, it holds a portrait frame the way it holds the square icon canvas, and its silhouette reads at placeholder size, which the stem's never did.

### 2.3 Consequences weighed

- **Current effect: zero cards.** Tiers 3–4 occur on no current card in either context (SPEC-GRID-CARD §2.3: every crop is plated), and after §1 they remain at zero until a crop exists without a plate. This ruling is therefore cheap now and expensive to retrofit later — which is the argument for taking it now, while it is a fixture-level decision, rather than after the first plateless crop ships with a stem in its frame and the stem acquires "shipped precedent" weight.
- **The commission's visible intent is honoured whole.** Dustin ordered the motif off the variety card. A ruling that left the same SVG standing inside the card's frame — however different its element and job — would keep the motif *on the card* in the only place a future plateless card could show it, and would read, correctly, as the motif surviving by moving indoors. The card should contain no stem instance in any state; Quinn's SH-G4 should be read, and if necessary amended, to count in-frame placeholder stems inside variety cards as the motif's presence, not as an exception to it. (Stems elsewhere — wordmark lockup, homepage packet cards, footer, prose, the variety-context ledger's wheat-stem rule — are outside this ruling entirely, per SPEC-GRID-CARD §§4.4–4.5.)
- **Cost accepted:** one derived web asset and one fixture case. Against that, the alternative's cost — a second placeholder language, a ration exception inside data components, and a motif-compliance argument on every future plateless crop — is recurring. The cheap side of this trade is the replacement.
- **What does not change:** tier 3's crop pod device, its size family, or its decorative status; the frame itself, which stays in all tiers (C6: removing the frame would ragged every grid — the frame is the rhythm, the device is the message); and the hero rule — the placeholder, in either form, still never enters the variety portrait mount while a crop plate exists (§1's hierarchy governs the mount unchanged).

---

## 3. Concurrence — the 1:2 whole-plate frame at shop-grid size (SPEC-GRID-CARD §3.2)

**I concur, unqualified.** The plates' treatment at grid size answers to this seat's doctrine, and the spec's treatment is the doctrine:

- **The plates are 1:2** (1120×2240, standardized, padded onto paper). A frame of the plate's own proportion is the only frame in which the whole plate *fills* its mount — no letterbox, no wasted paper, the painting at the largest size the card width allows. Whole, `object-contain`, on `bg-paper`, self-hosted: unchanged, and non-negotiable in both directions — never cropped to a shorter frame, never stretched to a wider one.
- **My §D.2 permission is not exercised here, deliberately.** I have ruled that the 1:2 frame does not force every grid's shape forever — a squarer frame may hold a whole plate on a matching ground where a surface wants squarer cards. The shop grid is not that surface: its commission is product presence, and a squarer frame would contain-fit the same plate into a *smaller* picture inside *more* paper — less product, bought with a forked card. Nadia's PB-G4 makes the same point from the UX side; from the artwork side it is decisive. The permission stands for surfaces that need it; this one needs the opposite.
- **Size is the difference between a plate and a sliver.** At 2-column phone width the frame renders ~175px wide × ~350px tall — the first seller-page presentation at which a painting can actually be recognized (against PR #13's 72px rail, whose failure Nadia measured and I endorse). The plates were composed flower-first precisely so the bloom reads at card size; the grid frame finally lets that composition standard do its work. The tall-card scroll cost is real, is the browse grid's already-accepted cost, and is the commission's trade to make — recorded here as seen and accepted, not discovered later.
- **One verification note, not a condition:** Quinn's SH-G2 DOM measurement (frame width = card content width, aspect 1:2, `object-contain`, no crop transform) is the right proof, and any individual plate that fails legibility at that rendered size is a plate-backlog item against the composition standard — never a reason to change the frame.

---

## 4. Summary for the build brief

| Item | Ruling |
|---|---|
| Tier order, all grids, both contexts | Variety plate → crop plate → designed pod placeholder. **Crop plate confirmed as tier 2; PR #13 unrevised.** |
| Placeholder ground | **`paper-deep`** (`--color-paper-deep` / `bg-paper-deep`), placeholder frames only; tiers 1–2 stay `bg-paper`. C6 upheld over shipped `bg-paper`. |
| Tier 4 | **Stem removed.** Generic form of the pod device (the directory's poppy-pod mark, derived web file, my F3 sizing check) on `paper-deep`; tiers 3–4 are one tier, two forms. Empty `paper-deep` frame is the only fallback behind it. |
| Stem on the variety card | **None, in any state, in any position** — SH-G4 to be read accordingly. |
| Shop-grid frame | **1:2, whole plate — concurred.** |
| Alt discipline | Per tier, unchanged from PR #13 §2.3: variety name / crop common name / decorative silence. |

*— Elena, Art Direction / Illustration. Evidence: SPEC-GRID-CARD §§2–4 and §7.2 read in full from `origin/main`; my consultation of 2026-11-20 (§§C6, D.2–D.4, D.7, F3) as the prior rulings under review; PR #13's design pair (§2 of the UX ruling, §1.3 and §7.2 of the UI spec) for the conflict's record and the ground divergence; shipped components from `origin/main` (`VarietyCardImage.tsx` — pod-first order, `bg-paper` placeholders, in-frame stem; `ListingArtwork.tsx` — four tiers, `bg-paper` placeholder frames); `pod-ornaments.ts` (pod devices for 14 crops) and `gen-icons.py` (the poppy-pod mark's source, dimensions, and standing role as the directory's icon) for the tier-4 replacement's asset basis; theme tokens from `globals.css` / THEME-ART-DIRECTION §1 (`paper` #F8F1E1, `paper-deep` #F0E5CB). Counts (812 varieties, 229 plateless, 124/124 crops plated, 1,489 listings at 1,156 / 333 / 0) are Nadia's 2026-11-22 measured figures from SPEC-GRID-CARD §2, relied on as measured. No code was written or changed, and no artwork was produced, by these rulings.*
