# Color Theory Review — hues.flowers & seeds.hues.flowers

**Status: FINAL — Iris Color Theory, 2026-11-18.**
Written through the expanded color playbook ("Feeling first: what color
actually does to people, and how to use it"), from the graded evidence in
`color-feeling-research-2026-11-18.md`. Sections 1–3 are the evidence pass
(palettes as found, measured pairs, meaning maps). Sections 4–8 are the
final verdicts and recommendations, from the feeling seat only: emotional
response, mood, harmony, and how the colors relate.

**Scope split (Dustin, 2026-11-18):** accessibility now belongs to Ada
Accessibility. The measured contrast findings from the evidence pass are
transferred to her as her opening case file — they appear once, in
Appendix A, clearly marked. They are not this review's verdicts, they do
not lead it, and no recommendation below is an accessibility fix in
disguise. Where an elevation would create a new text pair, it is flagged
for Ada's check before implementation — that is the consult working as
designed.

Every feeling claim below is phrased as a *read* — what the palette is built
to read as — with an evidence grade, per the playbook's honesty rule.
Associations are strong evidence; induced feelings are weak; nothing here
promises a visitor will feel anything.

Method: palettes extracted from the source trees
(`huesflowers-live/src/styles/tailwind.css` + `src/app/m/p.css`;
`seeds-hues/v2/app/globals.css` + components) and cross-checked against the
served HTML (curl, 2026-11-18) and the production-built CSS. All contrast
ratios computed from relative luminance per WCAG 2.2; no rounding up.

---

## 1. Hues Floral Park (hues.flowers) — palette as found

The desktop site wears the "Print Edition" shell (`.d-app`, since 2026-11-01):
the Tailwind lime/yellow scales are re-mapped inside the shell only. The
mobile `/m` app defines the identical token set in `p.css`. Standalone apps
(/play, the arcade games) keep their own louder worlds by design.

| Token | Value | Job |
|---|---|---|
| paper | #F7F1DE | page ground |
| paper2 | #FFFDF4 | card stock (seed-packet cards) |
| ink | #2E4438 | body text; remapped lime-600 |
| deep | #23362B | headings, primary buttons, footer ground ("card back") |
| gold | #B08D37 | rules, diamonds, underline decoration, stitch lines |
| golddeep | #927128 | gold in text roles: links, labels, hovers |
| pale gold | #D9BC76 | text/hover on deep grounds (footer) |
| sage | #6F7F6E | remapped lime-400; captions/metadata text |
| mid (untokenized) | #43534A | secondary text (30–55 uses/page) |
| mid (untokenized) | #55644F | metadata text on Dahlias (225 uses) |
| line | #E0D5B8 | card borders, hairlines |
| footer muted | #CFC9A8, #A9B39B, #E9E2C8 | small text on deep |
| focus ring | #C39A45 (remapped yellow-400, inside shell) | `:focus-visible`, 2px |
| focus ring outside shell | #FACC15 (Tailwind default yellow-400) | pages/apps not in `.d-app` |

Real pairs from served pages (home, about, dahlias, visit):

- Nav links: ink text, hover golddeep #927128. Wordmark: deep.
- Primary CTA: paper text #F7F1DE on deep #23362B; hover ground ink #2E4438.
- Secondary CTA: ink text, golddeep ring at 70%.
- Inline links: ink text with gold #B08D37 underline; a second link style is
  golddeep text #927128 with a 50% gold underline (text-sm, medium).
- Footer on deep: paper text, pale-gold hovers, #CFC9A8 small print.
- Arcade callout on the home page imports the games' register: eyebrow text
  #F5C542 (bright yellow) on deep. The games' own palette (deep purple
  #2A1650, pink #DB2777 shadows, amber #F59E0B, vermilion #D85434) stays
  inside the game surfaces.
- Prose config (`typography.ts`) names teal-500 for links, but #14B8A6
  appears 0 times in the shipped CSS — the configured teal never reaches the
  audited pages; real links are ink + gold underline.

### Measured pairs — Hues

| Pair | Ratio | AA reading |
|---|---|---|
| ink #2E4438 / paper | 9.30 | pass |
| ink / paper2 | 10.30 | pass |
| deep #23362B / paper | 11.38 | pass |
| deep / paper2 | 12.61 | pass |
| mid #43534A / paper | 7.22 | pass |
| mid #43534A / paper2 | 8.00 | pass |
| #55644F / paper | 5.60 | pass |
| #55644F / paper2 | 6.20 | pass |
| **golddeep #927128 / paper** | **4.03** | **FAILS 4.5 (normal text)** |
| **golddeep #927128 / paper2** | **4.47** | **FAILS 4.5 — by 0.03; a fail, not a pass** |
| **sage #6F7F6E / paper** | **3.77** | **FAILS 4.5 (normal text)** |
| **sage #6F7F6E / paper2** | **4.17** | **FAILS 4.5 (normal text)** |
| gold #B08D37 / paper | 2.77 | decoration only — never text (verified: no text-[#B08D37] in served pages) |
| paper / deep (footer, CTA) | 11.38 | pass |
| paper / ink (CTA hover) | 9.30 | pass |
| pale gold #D9BC76 / deep | 6.98 | pass |
| #CFC9A8 / deep (footer small print) | 7.69 | pass |
| #A9B39B / deep | 5.88 | pass |
| #F5C542 / deep (arcade eyebrow) | 7.92 | pass |
| **focus #C39A45 / paper (UI boundary, needs 3:1)** | **2.32** | **FAILS 1.4.11** |
| **focus #C39A45 / paper2** | **2.57** | **FAILS 1.4.11** |
| **focus #FACC15 / paper (outside shell)** | **1.36** | **FAILS 1.4.11, badly** |
| line #E0D5B8 / paper | 1.29 | decorative edge only |

Usage counts that make the failures matter: golddeep is text on the Dahlias
page 277 times and the home page 45 times; sage is text 160 times on Dahlias.
These are not edge cases — golddeep is effectively the site's second text
color, and it sits under the AA line on both grounds.

### Meaning map — Hues

- Deep green = authority: headings, primary action, footer. Consistent.
- Gold = ceremony: rules, underlines, hovers, the diamond motif. As
  *decoration* it never has to pass text contrast; as golddeep *text* it
  carries links and labels — the same hue family doing both jobs, at two
  different values, which is exactly where the failure creeps in.
- Sage/mid greens = quiet metadata. Three different mid-greens are in text
  service (#43534A, #55644F, #6F7F6E) with no token discipline separating
  them; two pass, one fails.

---

## 2. Seed Directory (seeds.hues.flowers) — palette as found

One token set in `app/globals.css`; the production CSS contains exactly these
values and no others. The theme's own recorded ratios were spot-checked
against fresh computation — they match (ink/paper 12.68 vs recorded 12.7;
muted/paper-deep 5.00 vs 5.0; warn/warn-50 4.89 vs 4.9). The bookkeeping is
honest.

| Token | Value | Job |
|---|---|---|
| paper | #F8F1E1 | page ground (over a 50% paper-grain tile) |
| paper-deep | #F0E5CB | recessed bands, footer, skeletons |
| surface | #FFFDF6 | cards, sheets, inputs |
| ink | #2E2A23 | body text (warm brown-black, not green) |
| ink-soft | #4A4438 | secondary text |
| muted | #6A5F4C | captions, eyebrows, "shop closed" |
| line | #E0D5B8 | hairlines, card borders (decorative) |
| line-strong | #97865F | component boundaries, chip/field borders |
| leaf | #1E4634 | primary buttons, active states, links on hover |
| leaf-600 | #2E6B4F | button hover, preorder |
| leaf-50 | #E3EAD8 | sage-tint fills: in-stock badge, current chip |
| link | #1F5C3D | link text |
| petal | #8E2A52 | the single high-chroma accent (raspberry) |
| petal-50 | #F7E8EC | sold-out badge tint |
| warn | #8A5E08 | ochre: alerts, unknown, held, stars |
| warn-50 | #F7EDD3 | ochre tint |
| sage | #7D9B76 | decorative foliage ONLY — never text (verified in components) |
| focus | #7A3E10 | warm umber focus ring, 3px |

Hue filter swatches (representative chips, each paired with a text label):
white #F7F3E8, blush #F2C4CE, pink #E87A9E, peach #F5A97F, orange #E8813A,
yellow #EFC93F, red #C03434, burgundy #7A2440, purple #8B6BAE, blue #5B7FBF,
green #7A9A4D, chocolate #6B4A35, mix = conic gradient.

### Measured pairs — Seed Directory

Every text pair on the site passes WCAG 2.2 AA. Full table:

| Pair | Ratio | AA reading |
|---|---|---|
| ink / paper | 12.68 | pass |
| ink / surface | 14.02 | pass |
| ink-soft / paper | 8.58 | pass |
| ink-soft / paper-deep | 7.71 | pass |
| muted / paper | 5.56 | pass |
| muted / surface | 6.15 | pass |
| muted / paper-deep | 5.00 | pass |
| link / paper | 7.02 | pass |
| link / surface | 7.77 | pass |
| link / paper-deep | 6.31 | pass |
| leaf (hover) / paper | 9.42 | pass |
| white / leaf (primary button) | 10.60 | pass |
| white / leaf-600 (button hover) | 6.30 | pass |
| petal / paper | 7.17 | pass |
| petal / petal-50 (sold-out badge) | 6.80 | pass |
| warn / paper (all form alerts) | 5.06 | pass |
| warn / warn-50 (unknown badge) | 4.89 | pass |
| leaf / leaf-50 (in-stock badge) | 8.60 | pass |
| leaf-600 / surface (preorder badge) | 6.19 | pass |
| ink / leaf-50 (chip hover) | 11.57 | pass |
| focus umber / paper (UI, needs 3:1) | 7.39 | pass, more than double |
| focus umber / surface | 8.17 | pass |
| line-strong / paper (UI boundary) | 3.17 | pass |
| line-strong / surface | 3.50 | pass |
| line / paper | 1.30 | decorative edge only, by design |
| sage / paper | 2.74 | decorative only, by design — never text |
| white swatch in chip | 1.01 vs paper | graphic; the chip's text label carries the meaning (1.4.1 satisfied by the label) |

### Meaning map — Seed Directory

- Leaf green = go: primary action, in-stock, verified, current filter.
  Consistent and calm.
- Petal (the palette's only saturated hue) does four jobs: **sold out**,
  the **protection badge**, the **required-field asterisk**, and the
  **active tab-bar dot**. One joyful raspberry carrying the site's most
  negative state (sold out) plus two neutral markers is a meaning collision
  to weigh in the final pass.
- Ochre warn does all the caution work *and* all the error work: every form
  alert (`role="alert"` in 8+ forms) renders in warn, as do "Held",
  "not verified yet", the unknown-availability badge, and the Google rating
  stars. There is no distinct error hue anywhere in the system.
- Availability is redundantly encoded (label text + color) — deficiency-safe.

---

## 3. Cross-site — the family resemblance, measured

- The two papers are indistinguishable side by side: #F8F1E1 vs #F7F1DE,
  contrast 1.00:1 — same cream, a breath apart in hue (Seeds a touch more
  yellow, Hues a touch more green-gold).
- The hairline color is literally the same hex on both sites: #E0D5B8.
- The deep greens are one family step apart: Seeds leaf #1E4634 vs Hues ink
  #2E4438 (1.01:1 against each other) — same forest, different tree.
- The inks differ in temperature: Hues ink is a green; Seeds ink #2E2A23 is
  a warm brown-black neutral. Seeds reads as printed paper, Hues as a
  garden at dusk — same book, different chapters (observation, not verdict).
- The golds diverge in role: on Hues, gold is ceremony (rules, diamonds,
  underlines) and its darkened form golddeep #927128 does text duty and
  fails there. On Seeds, the cognate ochre #8A5E08 is darker, browner, and
  passes — but is spent on warnings and errors rather than ceremony.
- Focus rings tell the discipline story in one line: Seeds umber #7A3E10
  at 7.39:1 vs Hues gold #C39A45 at 2.32:1 (and #FACC15 at 1.36:1 outside
  the desktop shell).
- Shared motifs: Fraunces display type, seed-packet cards with stitched/
  keyline frames, paper grain (Seeds) vs radial paper washes (Hues).

---

## 4. Headline verdicts — how each site feels

### Hues Floral Park — a storybook at dusk, and it knows it

Yes: this palette is built to read as storybook, dreamy, elevated, and
quietly joyful — a little world apart (evidence grade: strong, as an
association read). The mechanism is not any single hue; it is the value key
and the temperature balance. A high-value warm cream ground (#F7F1DE) does
the brightness work — brightness is the strongest single predictor of
pleasantness in the Valdez & Mehrabian weights (≈.69) — while the deep
forest green (#23362B) sits at the dark pole and gives the page its
ceremony and its dusk. Warm paper advancing against cool green receding is
a real depth structure, not a mood label: the gold rules and diamonds sit
forward, the green grounds fall back, and the eye reads a place, not a
document. The joy here is deliberately quiet — see §7 on the low-chroma
trade — and the one place the register breaks is the arcade callout's
bright yellow eyebrow (#F5C542), which imports the games' shout onto a
page that has been whispering beautifully.

### Seed Directory — a catalogue you browse like a garden visit

Yes: this palette is built to read as warm, unhurried, and pleasurable to
browse (evidence grade: strong as a read). Same high-value paper family,
an even more disciplined chroma budget, and one decision I want to name as
the best feeling decision on either site: the only place full chroma is
allowed to live at scale is the Hue filter swatches — the flowers
themselves. Saturation is the palette's volume control, and here the
volume is reserved for the bloom, which is exactly where a seed catalogue
should spend it. The reservation has one leak, and it is the review's
first recommendation: the palette's single loud note, petal #8E2A52, is
partly spent on the saddest state the site has — *sold out*.

---

## 5. Harmony & feeling — Hues Floral Park

**Value key.** Light ground, dark green anchor, almost nothing in the
middle except the golds. That is a confident key: hierarchy survives
grayscale, and the deep-green footer lands like the back cover of the same
book. Sound.

**Chroma budget.** Very low everywhere except gold. Per the research this
trades away peak arousal and peak pleasantness — knowingly, and correctly
for this brand (the playbook's standing tension, stated here as required):
Hues is selling unhurried wonder, not excitement. The budget's problem is
not its size but its *drift at the quiet end*: three mid-greens are in
text service (#43534A, #55644F, #6F7F6E) with no discipline separating
them, and the greyest of them, sage #6F7F6E, carries metadata 160 times on
the Dahlias page alone. Greyish colors pair cross-culturally with
negative, low-energy emotions (Jonauskaite & Mohr 2025 — moderate-to-
strong evidence), so the cultivar lists — the pages a dahlia lover should
feel *most* garden in — are the pages most tinted with ledger-grey. The
feeling cost is real even though it is quiet: lists read as records, not
as rows in a bed.

**Temperature.** The warm/cool structure is the palette's spine (above).
One honest limit, from the playbook: a warm palette makes a place *read*
warm; the felt-temperature claim has no experimental support, and this
review does not make it.

**The gold question.** Gold #B08D37 is doing ceremony — rules, diamonds,
underlines — and ceremony is the right job for it. But the house should
stop expecting gold to also deliver *joy*. The joyful yellow of the
evidence lives at mid-to-light values — sunshine, butter, bloom — while
golddeep #927128 sits dark enough to read as antique brass: heritage,
formality, a medal in a drawer. That is a fine feeling; it is just not
happiness. And the association being left on the table is unusually
strong *here*: the yellow–joy link strengthens in rainy, northern-
latitude climates (87.68% in Finland vs 5.66% in Egypt across 55
countries; Jonauskaite et al. 2019 — strong evidence), and the Willamette
Valley is exactly that climate. Hues owns the best joy lever in the
literature and currently spends it at its darkest, most ceremonial value.

**Green, honestly.** The deep green ground borrows the *association* of
foliage; the restorative evidence belongs to living vegetation and real
scenes (Ulrich 1984; Twohig-Bennett & Jones 2018). On this site the
photography and the park itself do that real work — the swatch is a frame
for it, and the frame is well chosen. No stronger claim is made, and per
house rules the copy must never promise restoration either.

---

## 6. Harmony & feeling — Seed Directory

**Value key.** Light, even, calm — paper #F8F1E1, paper-deep #F0E5CB,
surface #FFFDF6 are three close steps, so the page feels like one sheet of
good stock rather than stacked panels. That evenness *is* the unhurried
feeling: nothing on the page is in a hurry, including the backgrounds.

**Chroma budget.** The tightest discipline of the two sites, and mostly
exemplary: leaf green at moderate chroma for action, ochre held dark,
petal held in reserve. The swatch chips (§5 of the evidence) are the
budget's intended release valve.

**Temperature.** Warm ink (#2E2A23, a brown-black, not a green-black) is
the quiet masterstroke: it makes the whole site read as *printed matter*
rather than *garden*, which is the correct register for a catalogue, and
it warms every page without a single warm hue having to be spent.

**The petal collision — judged as feeling and meaning, not contrast.**
Petal #8E2A52 is a raspberry: by ecological valence it reads as berries,
bloom, ripeness — appetite and delight (moderate-to-strong association
evidence). The draft's meaning map shows it carrying four jobs: *sold
out*, the protection badge, the required-field asterisk, and the active
tab dot. Judged by feeling, these are not four equal jobs:

- The **asterisk** in petal is charming — it softens a demand into a
  garden marker. Keep.
- The **tab dot** is a neutral positional marker; petal there reads as
  "you are here" in the brand's voice. Keep.
- The **protection badge** is a positive trust mark in the brand's
  signature hue. Defensible — this is petal as *Hues' promise*. Keep.
- **Sold out** is the collision. It is the most negative state in the
  catalogue wearing the palette's only joyful color. Two costs: the
  disappointment arrives dressed for a celebration, which reads as a
  small tonal wrongness visitors feel before they can name it; and every
  sold-out badge spends down petal's delight, so the hue means a little
  less each time it appears on something good. A hue that means both
  "the thing you wanted is gone" and "this is protected by Hues" is
  carrying opposite valences, and opposite valences in one signal color
  is a clarity failure as much as a feeling one — the playbook's rule is
  one hue, one meaning, and petal's meaning should be *desire and the
  brand's promise*, never denial.

**The ochre collision.** Warn #8A5E08 does every caution, every form
error, every "held / not verified" state — *and* the Google rating stars.
Stars are praise. Rendering praise in the error hue teaches the eye that
ochre means "pay attention, something's off," and then asks the same
ochre to mean "five people loved this farm." Of the two collisions on
this site, petal's costs more feeling, but ochre's is the more confused
signal.

---

## 7. Cross-site — do they feel like family?

Yes — measurably, not just impressionistically (evidence §3). The papers
are the same cream (1.00:1 apart), the hairline is the *identical hex*
#E0D5B8 on both sites, and the deep greens are one family step apart
(#1E4634 vs #2E4438). A visitor moving from hues.flowers to the Seed
Directory stays in the same house: same paper on the desk, same forest
through the window, same Fraunces voice. The temperature difference
between the inks is a feature, not drift — Hues' green ink reads
garden-at-dusk, Seeds' brown-black ink reads printed catalogue, and those
are the two correct registers for a park and its catalogue.

The one place the family teaches *opposite lessons* is the gold family.
On Hues, gold means ceremony and honor. On Seeds, its cognate ochre means
caution and error. A visitor who learns "gold is the good-occasion color"
at the park arrives at the catalogue where gold-brown is the color of
problems. Families can have different rooms; they should not have
opposite meanings for the same heirloom. Recommendation 2 below is the
repair.

And the standing tension, stated plainly as the playbook requires: both
palettes are gentle, low-chroma palettes, and the laboratory says
saturated-and-bright is where peak pleasantness lives. Both sites have
traded peak delight for unhurried calm. For Hues that trade is the brand.
For the Seed Directory it is *mostly* right — with the single exception
that its one reserved loud note is currently spent on sold out, which is
the trade made backwards: quiet where it could delight (the stars, in
error-ochre), loud where it should commiserate (sold out, in petal).

---

## 8. Ranked recommendations — elevations from the feeling seat

**1. Free petal on the Seed Directory: take *sold out* off #8E2A52.**
Give sold out a quiet, desaturated treatment — ink-soft #4A4438 text on
paper-deep #F0E5CB, or a new low-chroma plum-grey (in the family of
#7A6672, value mid-light, chroma near-neutral) on surface #FFFDF6.
*Feeling bought:* disappointment stops wearing the bloom color; petal
returns to a single valence — desire, delight, and Hues' promise
(protection badge, asterisk, tab dot all stay). Evidence grade: moderate
(strong association literature; the one-hue-one-meaning rule is craft
doctrine). *Flagged for Ada:* the replacement pair must pass her check
before it ships.

**2. Reunite the gold family across both sites as the ceremony-and-reward
hue — and retire it from error duty on Seeds.**
Move the Google rating stars on seeds.hues.flowers from warn #8A5E08 to a
true gold in the Hues family (gold #B08D37, or a half-step lighter for
small marks, in the family of #C2A14A — display marks, not text), and
reserve warn strictly for alerts, held, and unverified states. *Feeling
bought:* praise reads as praise on both sites; gold means "the good
occasion" in the park and in its catalogue; and per the climate finding,
the family's rainy northern audience is the population *most* primed to
read yellow-gold as joy. Evidence grade: moderate-to-strong (yellow–joy
climate data is strong; the specific star change is an association-fit
judgment). *Flagged for Ada:* star marks against paper are a non-text
pair — her call, not mine.

**3. Consolidate Hues' metadata greens to one warm token, and retire sage
#6F7F6E from text duty.**
One mid-green for captions and metadata everywhere — the warmest of the
three in service, #55644F — with #43534A kept for secondary body text and
sage returning to decorative foliage duty only (exactly the discipline
the Seed Directory already applies to its sage #7D9B76, which never
carries text). *Feeling bought:* the Dahlias lists stop reading as
ledger-grey records and read as garden notes; the greyish–low-energy
association is removed from the site's most-visited variety pages.
Evidence grade: moderate. (Any contrast consequence of retiring sage is
Ada's file — Appendix A — and I note only that her interests and mine
point the same direction here.)

**4. Bring the arcade callout on the Hues home page back into the dusk
register.**
Its eyebrow currently renders in bright yellow #F5C542 on deep green —
the games' daylight shout on the Print Edition's evening page. Recolor
the *callout's frame* (not the games, whose own loud palette is correct
inside their surfaces) to pale gold #D9BC76, the value the footer already
uses on deep. *Feeling bought:* the invitation to play reads as a lantern
lit at dusk rather than a carnival sign; the storybook spell survives the
scroll to the games. Evidence grade: weak-to-moderate — this is
register coherence, a craft judgment, honestly graded.

**5. Give petal one unambiguously joyful job on Seeds to balance its
ledger.**
The waitlist / "you're on the list" confirmation moment — the site's one
pure good-news beat — currently has no signature color moment. Let petal
own it (the confirmation mark and heading accent). *Feeling bought:* the
accent hue's strongest association becomes anticipation rewarded, which
is the emotional product a seed directory actually sells in November for
a March garden. Evidence grade: moderate (association-fit reasoning).

### Where the research contradicts a current assumption — said plainly

- **"Ochre is our warm, friendly yellow."** On Seeds, warn #8A5E08 is
  dark, brown, and spent entirely on problems; on Hues, golddeep is
  antique brass. Neither site currently owns a *joyful* yellow, in the
  climate where yellow–joy is strongest on Earth. The assumption that the
  gold family is already delivering warmth-and-happiness is the single
  largest gap between what these palettes intend and what the evidence
  says they do.
- **"Gentle is simply better."** The house's low-chroma preference is a
  trade, not a virtue: it buys unhurried calm at the price of the peak
  pleasantness that brightness-plus-saturation produces. It is the right
  trade for this brand — but it should be made knowingly (it now is,
  in the playbook), and it makes the *placement* of the little chroma
  that remains far more important, which is why Recommendations 1 and 2
  outrank everything else here.
- **"Deep green is calming."** As a swatch claim: unsupported. Green's
  restorative evidence belongs to living scenes. The sites are fine —
  Hues *is* a garden and shows it — but no future palette note should
  cite calm as a property of #23362B itself.

---

## Appendix A — TRANSFERRED TO ADA ACCESSIBILITY (her opening case file)

*The following are measured accessibility findings from the evidence
pass. They belong to the Accessibility seat as of Dustin's 2026-11-18
scope split. They are recorded here once, for the handoff; they are not
this review's verdicts or recommendations.*

- Seed Directory: zero WCAG 2.2 AA failures across all measured text and
  UI pairs — transferred as Ada's confirmed-clean baseline.
- Hues — golddeep #927128 as normal text: 4.03:1 on paper #F7F1DE,
  4.47:1 on paper2 #FFFDF4 (AA requires 4.5:1); heavy use — 277 instances
  on /dahlias, 45 on home.
- Hues — sage #6F7F6E as normal text: 3.77:1 on paper, 4.17:1 on paper2;
  160 instances on /dahlias.
- Hues — focus indicator #C39A45: 2.32:1 on paper, 2.57:1 on paper2
  (1.4.11 requires 3:1); outside the Print Edition shell the default
  #FACC15 measures 1.36:1 on paper.
- Consults owed to Ada before implementation, arising from §8: the
  sold-out replacement pair (Rec. 1), the star-gold non-text pair
  (Rec. 2).
