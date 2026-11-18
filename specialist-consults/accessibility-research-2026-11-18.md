# Accessibility Research — Training Pass for the Accessibility Specialist Seat

**Date:** 2026-11-18 · **Seat:** Accessibility (eleventh specialist; Dustin split this
seat out of Color Theory on 2026-11-18 so Color Theory owns feeling and harmony,
and this seat owns the accessibility floor).
**Method:** Research-specialist standards — authoritative sources first (W3C
normative text, statute and rulemaking, national eye-health bodies), claims
triangulated across at least two independent sources where the claim is
load-bearing, and every claim graded:

- **STRONG** — normative text, statute, or replicated/consensus science.
- **MODERATE** — credible single source, vendor research, or widely cited but
  dated/approximate figures.
- **WEAK / CONTESTED** — draft material, marketing claims, or findings whose
  status changed after publication. Treated as orientation, never as rules.

---

## 1. WCAG 2.2 — the governing standard

WCAG 2.2 became a **W3C Recommendation on 5 October 2023** (and ISO/IEC
40500:2025 in October 2025). It contains **86 success criteria: 31 Level A,
24 Level AA, 31 Level AAA**; conformance at A+AA means meeting **55 criteria**.
It removed 4.1.1 Parsing as obsolete and is backward compatible — a site that
conforms to 2.2 AA also conforms to 2.1 AA. **[STRONG — W3C WCAG 2.2
Recommendation; corroborated by multiple independent checklists]**

The criteria that govern the *visual* layer, at AA unless noted:

| Criterion | Level | Requirement |
|---|---|---|
| 1.4.1 Use of Color | A | Color is not the only visual means of conveying information, indicating an action, prompting a response, or distinguishing an element. |
| 1.4.3 Contrast (Minimum) | AA | Text ≥ **4.5:1**; large text ≥ **3:1**. Large = ≥18 pt (24 px) regular or ≥14 pt (≈18.7 px) bold. Incidental text, logos exempt. |
| 1.4.4 Resize Text | AA | Text resizable to 200% without assistive tech and without loss of content or function. |
| 1.4.5 Images of Text | AA | Real text, not pictures of text, unless essential (e.g. logotype) or customizable. |
| 1.4.10 Reflow | AA | No two-dimensional scrolling at 320 CSS px width (vertical) — equivalent to 400% zoom on a 1280 px window. |
| 1.4.11 Non-text Contrast | AA | UI component boundaries/states, focus indicators, and graphics required to understand content ≥ **3:1** against adjacent colors. |
| 1.4.12 Text Spacing | AA | No loss when users override line height to 1.5×, paragraph spacing 2×, letter spacing 0.12 em, word spacing 0.16 em. |
| 1.4.13 Content on Hover or Focus | AA | Extra content is dismissible, hoverable, and persistent. |
| 2.4.7 Focus Visible | AA | A visible keyboard focus indicator on every interactive element. |
| 2.4.11 Focus Not Obscured (Minimum) | AA, **new in 2.2** | The focused element is not entirely hidden by sticky headers, banners, or overlays. |
| 2.4.13 Focus Appearance | **AAA**, new in 2.2 | Indicator area at least a 2 CSS px perimeter around the component **and** ≥3:1 contrast between focused and unfocused states. (Often misreported as AA in secondary sources — in the published Recommendation it is AAA. Design to it anyway; it is cheap.) |
| 2.5.8 Target Size (Minimum) | AA, **new in 2.2** | Pointer targets ≥ **24×24 CSS px**, with spacing, inline, essential, and user-agent exceptions. (2.5.5 Target Size Enhanced, AAA, asks 44×44.) |
| 2.3.1 Three Flashes or Below Threshold | A | No content flashes more than 3 times in any 1-second period unless below the general-flash and red-flash thresholds. |
| 2.2.2 Pause, Stop, Hide | A | Auto-starting movement lasting >5 s alongside other content must be pausable, stoppable, or hideable. |
| 3.2.6 Consistent Help | A, new in 2.2 | Help mechanisms appear in the same relative order on every page. |
| 1.4.6 Contrast (Enhanced) | AAA | Text ≥ 7:1; large text ≥ 4.5:1. The right design target for long reading surfaces and older audiences even though AA is the legal floor. |

**[All STRONG — W3C normative text, triangulated against W3C Understanding
documents and independent conformance checklists.]**

## 2. The science under the ratios

- **The formula.** Relative luminance is computed by linearizing each sRGB
  channel (undoing gamma), weighting **0.2126 R / 0.7152 G / 0.0722 B**, then
  ratio = (L₁ + 0.05) / (L₂ + 0.05). The 0.05 term models ambient flare so the
  scale stays finite; the range is 1:1 to 21:1. Hue plays no part — only
  lightness difference counts. **[STRONG — WCAG 2.2 definition]**
- **Why 4.5 and 7.** The AA threshold was set so text remains readable for a
  user with roughly **20/40 vision** after allowing for the ~1.5× contrast-
  sensitivity loss typical of that acuity; the AAA 7:1 corresponds to roughly
  **20/80**. The thresholds are population compromises, not magic numbers —
  which is why "aim above the floor for body text" is professional practice,
  not gold-plating. **[MODERATE-STRONG — WCAG Understanding documents trace
  the derivation to Arditi's contrast-sensitivity work; the acuity mapping is
  the W3C's own stated rationale]**
- **No rounding.** 4.47:1 fails a 4.5:1 requirement. Checkers that display one
  decimal hide real failures. **[STRONG — WCAG Understanding 1.4.3]**
- **Known limits of the 2.x formula.** It is **polarity-blind** (light-on-dark
  and dark-on-light with equal luminance gaps score identically, though the
  eye does not experience them identically — light text on dark grounds
  blooms/halates, especially for readers with astigmatism), it **ignores font
  weight and size** beyond the single large-text step (thin strokes at the
  same ratio are genuinely harder to read), and it can **over-rate saturated
  mid-tone pairs** (some blue combinations pass on paper and read poorly).
  **[STRONG as a critique — acknowledged in W3C WCAG 3 working materials and
  the color-science literature; the practical consequence is "pass the ratio,
  then eyeball the real rendering at real size"]**

## 3. WCAG 3 and APCA — graded honestly

- **APCA** (Accessible Perceptual Contrast Algorithm), developed by Andrew
  Somers (Myndex) from 2019 for the WCAG 3 effort, outputs a signed
  **Lc value (roughly −108 to +106)** that is polarity-aware, models perceived
  lightness rather than raw luminance, and is read against **font size and
  weight tables** (working guidance: Lc 75 ≈ floor for body text, Lc 60 for
  larger text, Lc 45 for large headlines). As perception science it is
  materially better than the 2.x ratio. **[MODERATE — real, peer-discussed
  research; thresholds still being calibrated between releases]**
- **Its standards status is the catch.** WCAG 3 remains a **Working Draft**
  (first public draft January 2021; no Recommendation expected before the late
  2020s). APCA was **removed from the WCAG 3 draft in mid-2023** after failing
  to gain Working Group consensus, and the draft's contrast method is
  currently **"yet to be determined."** No law, regulation, or published WCAG
  version references APCA. **[STRONG — W3C draft history; Adrian Roselli,
  "WCAG 3 Contrast as of April 2026," tracking the draft's state]**
- **Working rule that follows:** conformance is judged by WCAG 2.x ratios,
  always. APCA may be used as a *second opinion* — most usefully for
  light-on-dark pairs, where the 2.x formula is weakest — but an APCA pass
  never rescues a WCAG fail, and APCA numbers are never quoted to a client as
  compliance. **[Practice rule derived from the two grades above]**

## 4. Color-vision deficiency (CVD)

- **Prevalence.** Red-green deficiency affects about **1 in 12 men (≈8%) and
  1 in 200 women (≈0.5%)** of Northern European ancestry; rates are lower in
  most other populations. Globally ≈350 million people. **[STRONG — US
  National Eye Institute; MedlinePlus Genetics]**
- **Types.** *Deutan* (M-cone, green): deuteranomaly ≈5% of men — the single
  most common form — and deuteranopia ≈1%. *Protan* (L-cone, red):
  protanomaly ≈1%, protanopia ≈1%; protan reds also appear **darker**, so a
  red that "matches" a green in lightness can vanish entirely. *Tritan*
  (S-cone, blue-yellow): ≈1 in 10,000, **not sex-linked**, often acquired
  (disease, medication, aging) rather than inherited. *Achromatopsia* (no
  color vision): ≈1 in 30,000, usually with photophobia and reduced acuity.
  **[STRONG — NEI; Sharpe et al. prevalence data]**
- **Why men:** the L- and M-opsin genes sit adjacent on the X chromosome and
  recombine easily; the S-opsin gene sits on chromosome 7. **[STRONG]**
- **Simulation practice.** The credible simulators are built on **Brettel,
  Viénot & Mollon (1997)** for dichromacy and **Machado, Oliveira & Fernandes
  (2009)** for graded anomalous trichromacy. Simulation is an approximation —
  two people with the same diagnosis differ — so it is a design check, never a
  substitute for the redundant-encoding rule. **[STRONG on the models;
  MODERATE on fidelity — simulators are ~90–95% representative at best]**
- **The governing rule is 1.4.1, not simulation:** color never carries meaning
  alone. Every color-coded distinction also gets a second channel — text
  label, icon, pattern, position, underline, or a lightness step large enough
  to survive every deficiency. Availability states, form errors, required
  fields, chart series, and link-in-text identification are the classic
  failure sites. **[STRONG — normative]**
- **Palette hygiene:** separate categories by **lightness as well as hue**;
  treat red/green and red/black pairings as hostile by default; tested sets
  (Okabe–Ito; ColorBrewer's colorblind-safe schemes) exist precisely so a
  designer does not have to improvise one. **[STRONG — established practice]**

## 5. Text over photography and imagery

- WCAG names this failure directly: **F83** — background images that do not
  provide sufficient contrast with foreground text. The criterion is the
  ordinary 1.4.3 ratio, but the background is *the pixels behind each letter*.
  **[STRONG — WCAG Techniques F83, G18]**
- **Worst-case rule.** Measure against the part of the image *most similar to
  the text color* behind the text — the lightest patch behind light text, the
  darkest behind dark text. **Average-luminance checks are invalid**: a photo
  averaging dark can still put a sunlit wall behind the headline. Worked
  example from the guidance literature: white text over a pale sky area
  (#B0C4DE) measures **1.78:1** while the same text over a dark area of the
  same photo measures 11.37:1 — one photo, both a pass and a hard fail.
  **[STRONG — W3C test procedure in Understanding 1.4.3]**
- **Responsive crops move the problem.** The patch behind the text changes at
  every breakpoint; a hero verified on desktop can fail on the phone crop.
  Verify per breakpoint, on the rendered crop, with the lightest image the
  slot will ever hold. **[STRONG as practice — direct consequence of F83]**
- **The reliable fixes, in order of robustness:** (1) a **solid panel** behind
  the text (turns the problem back into ordinary text contrast); (2) a
  **scrim** — a semi-transparent overlay between photo and text, raised only
  until the weakest point passes (a 50% black scrim over a light #D9D9D9 area
  yields ≈#6C6C6C, white text ≈5.25:1; 60% yields ≈7.23:1); (3) a gradient
  scrim anchored where the text sits, re-verified per crop; (4) a **halo/
  outline** ≥1 px, which WCAG counts as the text's background when wide
  enough. A drop shadow alone is not a fix. **[STRONG — Technique G18 and
  worked examples in the guidance literature]**
- Text baked into an image is a separate failure (1.4.5): it cannot resize,
  cannot be translated, and screen readers cannot read it. Logotypes are the
  standing exception. **[STRONG — normative]**

## 6. Low vision beyond ratios — and aging vision

- **Scale of the audience.** Low vision (acuity roughly 20/70–20/200 or field
  loss, not correctable by ordinary glasses) affects **over 250 million
  people globally** — far more than total blindness — and most low-vision
  users work *visually*, with magnification and customization, not screen
  readers. Designing only for screen readers misses the largest group.
  **[MODERATE-STRONG — WHO-aligned estimates; W3C low-vision task force
  framing]**
- **What aging does to the eye** (directly relevant: garden-park and seed-
  buying audiences skew older):
  - **Contrast sensitivity declines**, especially at fine detail — the
    physiological reason pale-gray "elegant" text fails older readers first,
    and why pushing body text toward **7:1** is recommended practice for
    older audiences even though AA's floor is 4.5:1.
  - **The lens yellows** and absorbs short wavelengths: blues darken, and
    blue/green distinctions blur. Never rest a critical distinction on a
    subtle blue step for this audience.
  - **The pupil shrinks** (senile miosis): less light reaches the retina, so
    older eyes need more light and suffer more from glare and from dim,
    low-luminance interfaces — including fashionable dark themes.
  - **Presbyopia** from the mid-40s makes small text genuinely costly, not
    merely annoying.
  **[STRONG — vision-science consensus, summarized in W3C and aging-design
  literature]**
- **The criteria that operationalize it:** 1.4.4 Resize Text (200%), 1.4.10
  Reflow (400% at 320 CSS px, no two-dimensional scrolling), 1.4.12 Text
  Spacing (user overrides must not clip or overlap), plus defaults that
  respect the user: relative units (rem, never fixed px that ignore browser
  settings), body text ≥16 px, line height ≥1.5. Sticky headers that consume
  the viewport at 400% are a recurring real-world reflow failure. **[STRONG —
  normative criteria; MODERATE for the default-size guidance, which is
  professional consensus rather than a criterion]**
- **Weight is a contrast variable in practice.** Thin type at a passing ratio
  can still be unreadable at small sizes because strokes anti-alias toward
  the background. The WCAG formula does not model this; APCA's size/weight
  tables exist because of it. Rule of thumb: the thinner and smaller the
  type, the more headroom above 4.5:1 it needs. **[MODERATE — perceptual
  research consensus; not a normative number]**

## 7. Motion, flashing, and photosensitivity

- **Flashing is a safety floor, not a preference.** 2.3.1 (Level A) bans more
  than **3 flashes in any 1-second period** unless the flashing stays below
  the general-flash and red-flash thresholds (small combined area — on the
  order of 25% of a 10° visual field — and limited luminance change; saturated
  red flashes are treated most strictly). Photosensitive epilepsy is the
  harm; the Photosensitive Epilepsy Analysis Tool (PEAT) is the field's
  checker for video/animation. **[STRONG — normative; Harding test lineage]**
- **Vestibular disorders are common.** Roughly **35% of US adults over 40**
  have measurable vestibular dysfunction. Large-scale parallax, zooming,
  spinning, and full-screen translation can trigger vertigo, nausea, and
  migraine lasting hours. **[MODERATE-STRONG — NIH-cited epidemiology
  (Agrawal et al.)]**
- **The mechanism is `prefers-reduced-motion`.** Every major OS exposes a
  reduce-motion setting; the CSS media query honors it. Under `reduce`:
  remove translations, zooms, spins, and parallax; keep or shorten **fades
  and color transitions**, which do not provoke the balance system. The query
  says *reduce*, not *eliminate* — essential feedback (a spinner, a state
  change) stays, expressed safely. Normatively, honoring it maps to 2.3.3
  Animation from Interactions (**AAA**); professionally it is treated as
  required practice regardless of level. **[STRONG on the mechanism and OS
  support; the AAA mapping is normative]**
- **2.2.2 Pause, Stop, Hide (A):** anything that starts automatically, moves
  for more than 5 seconds beside other content, and is not essential needs a
  working pause/stop/hide control — carousels and ambient hero motion are
  the usual offenders. **[STRONG — normative]**

## 8. Cognitive accessibility at the visual layer

- WCAG's testable criteria only partly cover cognition. The W3C's COGA Task
  Force document, *Making Content Usable for People with Cognitive and
  Learning Disabilities* (a W3C Note — **guidance, not a conformance
  standard**), organizes the rest into **eight objectives**: understand what
  things are; find what you need; clear content; avoid and correct mistakes;
  help users focus; do not rely on memory; provide help; support adaptation.
  **[STRONG that the document and objectives exist; the content is guidance,
  graded as professional consensus, not law]**
- The visual-layer consequences this seat enforces:
  - **Consistency is an accessibility feature.** Same component, same look,
    same place, same name — 3.2.3 Consistent Navigation, 3.2.4 Consistent
    Identification, 3.2.6 Consistent Help. A state color that changes meaning
    between screens is a cognitive failure before it is an aesthetic one.
  - **States must be plain, not subtle.** Success, warning, error, selected,
    and disabled states distinguished only by a small hue shift fail users
    with CVD, low vision, *and* ordinary distraction. Pair every state with
    an icon, a label, or a shape/position change, in words a first-time
    visitor understands.
  - **One clear primary action per view**; whitespace is parsing help, not
    decoration; icons always travel with text labels (an unlabeled icon is a
    memory test).
  - **Do not make the user remember across screens** what a color meant;
    legends and labels live where the data is.
  **[MODERATE-STRONG — COGA guidance converging with normative consistency
  criteria]**

## 9. The legal and practice landscape

- **WCAG is not itself law; laws point at it.** Building to **WCAG 2.2 AA**
  satisfies every WCAG 2.1/2.0 AA obligation currently on the books, because
  2.2 only adds and clarifies. **[STRONG]**
- **United States.** The DOJ's **ADA Title II final rule (24 April 2024)**
  codifies **WCAG 2.1 AA** for state and local government web content, with
  compliance dates in 2026 (larger entities) and 2027 (smaller). **Title III**
  (private businesses open to the public) has no equivalent codified rule;
  courts and plaintiffs use WCAG 2.1 AA as the de facto standard, and web
  accessibility suits are filed in the thousands annually (4,605 federal
  Title III filings in 2024 per Seyfarth Shaw's count). Section 508 binds
  federal procurement to WCAG 2.0 AA via its refresh. **[STRONG on the rule
  and dates; MODERATE on litigation counts — law-firm tallies]**
  For a private business like Hues, the honest summary is: no statute names
  its duty in so many words, but WCAG AA is the standard a court, a
  plaintiff, or a platform will measure it by — and Dustin's standing
  position treats ADA compliance as a legal requirement, not a nicety.
- **Europe.** The **European Accessibility Act** (Directive 2019/882) has
  been enforceable since **28 June 2025** for covered consumer services
  (e-commerce among them), with conformance shown through **EN 301 549**,
  which incorporates **WCAG 2.1 AA**. **[STRONG]**
- **How bad the web actually is.** The **WebAIM Million (2025)** automated
  analysis of the top million home pages found **94.8% with detectable WCAG
  failures**, ≈51 errors per page, and **low-contrast text on 79.1% of home
  pages** — the most common failure every year the study has run. Six error
  types (low contrast, missing alt text, missing form labels, empty links,
  empty buttons, missing document language) account for 96% of detected
  errors. **[STRONG as an automated-scan finding — with the standing caveat
  that automated scans detect only part of the real barrier set]**
- **Automation's limit.** Automated checkers catch only a fraction of real
  barriers — vendor and practitioner estimates cluster around **30–57% of
  issues by volume**, and they cannot judge alt-text quality, focus order
  sense, or whether a state is understandable. **[MODERATE — Deque and
  practitioner estimates vary by method]**
- **The certification bar.** Because of that limit, conformance claims that
  matter are made by **specialist firms testing with assistive technology
  and disabled users**, documented through an audit against WCAG-EM and a
  conformance report (VPAT/ACR). **Code-level fixes, a clean axe scan, and
  this seat's own review are engineering evidence — they are not a legal
  certification, and must never be described as one.** This is Dustin's
  standing position and the field's. **[STRONG as practice]**

## 10. Assistive-technology reality — what a design must survive

- **Screen readers.** JAWS (≈40%), NVDA (≈38%), and VoiceOver (≈10% desktop;
  dominant on iOS) lead the WebAIM Screen Reader User Survey #10 (2024);
  **71.6% of screen reader users navigate by headings**, so heading structure
  *is* the table of contents. For this seat the visual consequences are:
  information must exist in text (not only in color, position, or an image),
  and focus must be visible and move in a visual order that matches the
  reading order. **[MODERATE-STRONG — WebAIM survey, self-reported sample]**
- **Magnification.** Most low-vision users zoom or magnify rather than use a
  screen reader; dedicated magnifiers pan at levels far beyond 400%. A page
  can pass Reflow and still fail a magnifier user if focus and caret are not
  exposed, hover content flees the pointer (1.4.13), or meaning sits in a
  sidebar the magnified viewport never visits. Keep related things adjacent;
  never place the explanation far from the thing explained. **[STRONG as
  practice — TPGi and W3C low-vision guidance]**
- **Forced colors / Windows High Contrast.** In forced-colors mode the OS
  replaces the author palette with the user's own: backgrounds and
  box-shadows are stripped, so **anything conveyed by background color or
  shadow alone disappears**. Borders, outlines, and text survive — which is
  why component boundaries must be real borders/outlines, icons should use
  `currentColor`, and focus must be an outline, not a shadow or a glow.
  Reported usage: ≈4% of Windows machines run high-contrast, and a majority
  of low-vision Windows users rely on it. **[STRONG on the rendering
  behavior — Microsoft Edge documentation; MODERATE on the usage figures —
  Microsoft, 2019]**
- **Dark mode.** A dark theme is a second palette, not an inversion: WCAG
  ratios overstate near-black contrast, saturated accents bloom, and pure
  white on pure black halates for many readers. Every pair is re-measured in
  the dark theme, accent chroma usually needs lowering, and text grounds sit
  off-black/off-white rather than at the extremes. Honor
  `prefers-color-scheme` and `prefers-contrast` where offered. **[MODERATE-
  STRONG — practitioner consensus grounded in the polarity research of §2–3]**
- **The survival test, in one line:** the design must still work in
  grayscale, at 400% zoom, under forced colors, in dark mode, with motion
  reduced, and with color removed as a channel — because each of those is a
  real user's everyday setup, not an edge case.

## 11. What the research contradicts in current practice (both live sites)

From the parked evidence draft (`color-review-2026-11-18.md`, measurements
verified 2026-11-18) read against this research:

1. **Hues' second text color fails the floor at production scale.**
   golddeep #927128 measures **4.03:1 on paper #F7F1DE and 4.47:1 on paper2
   #FFFDF4** — both under 4.5:1, and 4.47 is a fail, not a rounding pass
   (§2). It is not incidental text: **277 instances on /dahlias alone, 45 on
   the home page.** This is exactly the WebAIM Million's most common failure,
   on the site's most-visited catalog surface.
2. **Hues' metadata green fails for the audience least able to afford it.**
   sage #6F7F6E at **3.77:1 / 4.17:1** (160 instances on /dahlias) is used for
   captions and metadata — small text, the case aging contrast-sensitivity
   loss hits hardest (§6). The site's other two mid-greens pass (7.22, 5.60),
   so the palette already contains its own fix.
3. **Hues' focus indicator fails 1.4.11 in both shells.** #C39A45 measures
   **2.32:1 (paper) / 2.57:1 (paper2)** against the 3:1 requirement, and the
   out-of-shell default #FACC15 measures **1.36:1** — a keyboard user
   effectively has no reliable focus location on those surfaces. Focus is
   the criterion with no aesthetic defense: it is the keyboard user's cursor.
4. **Seed Directory contradicts the research in the *good* direction** — its
   recorded ratios were independently spot-checked and are honest, and every
   measured text/UI pair passes. Its one research-flagged risk is
   **cognitive, not numeric**: petal #8E2A52 simultaneously means *sold out*,
   *protection badge*, *required field*, and *active tab*, and ochre #8A5E08
   covers every form error as well as every warning (§8: state meaning must
   be consistent and plainly signaled). The pairs pass; the meaning map
   needs a second channel audit.
5. **Both sites:** text-over-imagery, forced-colors survival, reduced-motion
   behavior, and dark-mode pairs were **not measured** in the parked draft —
   the draft audited flat-color pairs only. Under §5, §7, and §10 those are
   open questions, not passes, and neither site should be described as
   "passing AA" until they are checked.

## Sources

- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation,
  5 October 2023 — normative criteria text, the relative-luminance formula,
  and the Understanding documents for 1.4.1, 1.4.3, 1.4.11, 2.4.13, 2.5.8.
- W3C, *WCAG 3.0 Working Draft* and draft history; Adrian Roselli, "WCAG 3
  Contrast as of April 2026" — APCA's removal from the draft (2023) and the
  undetermined status of the WCAG 3 contrast method.
- Andrew Somers / Myndex, APCA documentation and the apca-w3 reference
  implementation — Lc scale, polarity model, size/weight lookup guidance.
- US National Eye Institute and MedlinePlus Genetics — CVD types and
  prevalence (≈8% of men, ≈0.5% of women, Northern European ancestry;
  tritan ≈1 in 10,000; achromatopsia ≈1 in 30,000).
- Brettel, Viénot & Mollon (1997), *Computerized simulation of color
  appearance for dichromats*, JOSA A 14(10); Machado, Oliveira & Fernandes
  (2009), *A physiologically-based model for simulation of color vision
  deficiency*, IEEE TVCG — the two simulation models in professional use.
- W3C WCAG Techniques F83 and G18 — text over background images: the
  worst-part test and the scrim/panel/halo fixes.
- W3C Cognitive and Learning Disabilities Accessibility Task Force (COGA),
  *Making Content Usable for People with Cognitive and Learning Disabilities*,
  W3C Note — the eight objectives; guidance, not a conformance standard.
- Agrawal et al., vestibular dysfunction epidemiology (≈35% of US adults
  over 40), as cited by NIH; W3C Understanding 2.3.1 and the Harding
  photosensitivity lineage behind the flash thresholds and PEAT.
- US Department of Justice, ADA Title II final rule, 24 April 2024 (WCAG 2.1
  AA; 2026/2027 compliance dates); European Accessibility Act, Directive
  (EU) 2019/882, enforceable 28 June 2025, via EN 301 549 (WCAG 2.1 AA);
  Section 508 refresh (WCAG 2.0 AA).
- WebAIM, *The WebAIM Million 2025* — 94.8% of top home pages with detectable
  failures; low-contrast text on 79.1%. WebAIM, *Screen Reader User Survey
  #10* (2024) — JAWS/NVDA/VoiceOver shares; 71.6% navigate by headings.
- Microsoft Edge documentation and Melanie Richards (2019) on forced colors /
  Windows High Contrast rendering behavior and usage; TPGi guidance on
  screen magnification beyond browser zoom.
- Seyfarth Shaw, ADA Title III lawsuit filings tally (4,605 federal filings
  in calendar 2024) — litigation-volume context, law-firm count.
