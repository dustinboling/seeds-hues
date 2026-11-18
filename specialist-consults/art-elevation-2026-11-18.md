# Art Elevation Consultation — Seed Directory (seeds.hues.flowers)
### Art direction & illustration specialist · 2026-11-18 · CONSULTATION ONLY — nothing produced, nothing changed

Dustin's ask: small elements that elevate the site's feel. Method: read
THEME-ART-DIRECTION.md, audited the live surface (production HTML via curl,
theme-preview-shots/, the v2 codebase, and the artwork folders). Every proposal
below leads with the job of the piece; paintings would be produced later as
separate approved passes, one at a time, in the pilot discipline (painterly
Print Edition watercolor, cream paper ground, no text in any image, real
subjects verified against photographic reference, self-hosted).

---

## 1. Consistency audit — the ornament system holds, and thins out at the "instrument" door

**What holds together:**
- One divider motif (divider-stem), reused with discipline — home hero, section
  breaks, footer (with the sensible FooterStem rule that a closing pod bundle
  replaces it, never stacks under it). This restraint is exactly right; vintage
  plate books run on one or two ornaments, not a library.
- Deckle frames are consistent: every painting shown whole, padded on paper,
  never cropped — crop plates, variety plates, card placeholders (pod motifs)
  all obey the same law.
- Pod bundles are correctly rationed: a crop page carries its own plant's
  bundle; home/browse rotate a few. They have not leaked onto pages where they
  would be noise.
- Paper grain sits on the body ground only; cards stay flat surface colour, per
  the direction. Palette discipline is intact — floral brights live inside the
  paintings and swatches, never in the chrome.
- The existing spot illustrations (hero, empty-search, empty-no-sellers,
  farms-basket, about-data, offline-path) are stylistically of a piece with the
  plates and are doing real work: the two highest-friction moments (no sellers,
  no search results) already feel kind instead of broken.

**Where it thins out or clashes:**
1. **The catalogue world stops at the form door.** /account, /add-your-farm,
   /report and /unsubscribe carry *no artwork at all* — not a spot, not a
   motif. These are the highest-intent pages on the site (a gardener making an
   account, a farmer offering their farm) and they are the barest. The theme's
   own serif/sans split says forms are the "instrument layer," but an
   instrument can still sit on the paper.
2. **Seller detail pages are bare.** /seller/{slug} serves no image besides the
   logo — a page *about a farm* with no visual warmth, while the farms index
   gets the basket spot. (See proposal 2 for the fix that adds no generic art.)
3. **Sixteen finished paintings are orphaned.** The state-flower plates
   (artwork-states/, one per seller state, each verified against an
   authoritative state source) are not used on the live state pages — the scene
   heroes replaced them and the plates never found a second home.
4. **No seasonal rhythm.** A seed catalogue is the most seasonal object in
   publishing — real catalogues change their covers with the sowing year — yet
   the site's art is identical in November and April. Nothing needs to change
   structurally; one rotating plate would do it (proposal 4).
5. **Minor tension to flag, Dustin's call:** the farms-section spot depicts a
   market *basket* of cut flowers (asset `farms-basket.webp`). Hues vocabulary
   is "bucket, never basket." The painting predates my knowing whether the rule
   was meant to reach depicted objects or only words — flagging, not judging;
   a repaint is a separate pass if he cares.

---

## 2. Proposals, ranked (top 3 first)

### 1. A spot painting for the Add Your Farm page
**Job: invite** — make a farmer who has just arrived feel this directory is a
place made by people who love seed, worth the ten minutes the form takes.
- **What:** one portrait spot at the head of /add-your-farm: a farm-gate still
  life — a bucket of cut flowers and a small stack of the farm's own seed
  packets on a gate-side table, morning light. No signage lettering (the
  offline-path signpost precedent: a gate with no writing on it).
- **Feeling:** welcomed, expected — "farms like mine belong here."
- **Size/format:** portrait spot matching the existing theme spots
  (~480–720 px display width, WebP, painted at 2× on the #F8F1E1 ground).
- **Reference:** photographic references of real farm-stand tables and buckets
  of cut flowers (objects only — no real farm is depicted, so nothing can
  misrepresent a listed seller).

### 2. Put the state-flower plates to work — state pages and seller pages
**Job: identify** — tie each state and each farm to its state's official
flower, in paint.
- **What:** NO new painting. The 16 finished, source-verified state-flower
  plates (artwork-states/) appear as a small square plate beside the farm list
  on /state/{slug}, and beside the summary on /seller/{slug} for that farm's
  state. Data-driven (the seller's state is already on the page), so a farm
  page gains real, true artwork — never a generic decoration pretending to be
  the farm.
- **Feeling:** rootedness — "this farm, in this state, growing under this
  flower."
- **Size/format:** existing masters (1600×1600) → web WebP at ~640 px, shown
  ~280–360 px in the established deckle frame.
- **Reference:** already painted from authoritative state sources (statute /
  state register per flower, incl. Maine's pine cone and tassel); no new
  reference needed. This is the cheapest elevation on the list — the art
  exists, is approved-quality, and is currently invisible.

### 3. A spot painting for the account page
**Job: invite** — soften the most transactional page on the site (two forms
and a Turnstile) into the catalogue's world, so creating an account feels like
joining the catalogue's readership, not registering for a service.
- **What:** one portrait spot above or beside the create/sign-in split: an open
  seed-packet organiser / garden journal with blank labels and a pencil resting
  across it — the waiting-list idea (your name down for seed not yet found)
  told in objects. All labels blank; no lettering.
- **Feeling:** anticipation — "put my name down; good things are coming."
- **Size/format:** as proposal 1 (theme spot spec).
- **Reference:** photographic references of seed storage boxes, packet
  organisers and garden journals.

### 4. One rotating seasonal plate on the home page
**Job: delight** — signal that the catalogue lives on garden time, the way a
printed catalogue's cover changes with the sowing year.
- **What:** a set of four small landscape plates, one shown at a time in the
  "How this directory works" band (or beside the hero headline), swapped by
  date: **spring** — a seed tray with seedlings and blank labels; **summer** —
  a bucket of zinnias and cosmos at a cutting row's end; **autumn** — seed
  saving: ripe pods and filled paper packets on a table; **winter** — seed
  packets and an open ledger by a window, resting season. One plate live at a
  time; the other three simply wait their turn.
- **Feeling:** the quiet pleasure of a place that keeps the seasons.
- **Size/format:** landscape ~3:2, WebP, ~960 px wide at 2×; each under the
  site's image budget.
- **Reference:** photographic references per season (seed trays, cutting rows,
  seed-saving tables, ledgers) — objects verified, no invented detail. Four
  separate painting passes, each approved on its own; the rotation can start
  with a single plate (the current season) and grow.

### 5. A three-spot strip for "How this directory works"
**Job: explain** — give the home page's one purely textual section a visual
sentence: packet → catalogue → farm.
- **What:** three small square spots in a row above the section's text: (a) a
  seed packet leaning on a plant label, (b) an open catalogue/ledger with
  pressed specimens (a sibling of the about-data spot, not a copy of it),
  (c) a bucket of cut flowers at a farm gate. Read left to right, they say what
  the section says, in paint.
- **Feeling:** comprehension at a glance, plus the handmade warmth the section
  currently lacks.
- **Size/format:** three square spots, ~400 px each at 2×, WebP, same ground.
- **Reference:** photographic references for packets, ledgers, farm gates.

### 6. A painted header band for transactional emails
**Job: identify** — make the verification-code and waitlist-alert emails
recognisably *from the catalogue* in an inbox list, where the site itself
can't speak.
- **What:** one narrow landscape band across the top of the email templates: a
  quiet sprig-and-stem line composition in the divider-stem hand, painted (not
  the SVG — email clients and the painted world agree better in a raster),
  possibly with one small poppy sprig at the right end. No words in the image;
  the email's own text does the talking.
- **Feeling:** "this is from the seed people" before a word is read.
- **Size/format:** wide short band (~1200×240 painted, served ≤ ~40 KB, hosted
  at hues.flowers), decorative alt text.
- **Reference:** painted from the existing divider-stem motif and the approved
  poppy's forms — an extension of locked art, not a new invention.

### 7. A spot painting for the report / claim / remove page
**Job: invite** — the report page asks a stranger to do the directory a
favour; a small painting makes the ask feel like correspondence, not a
complaint form.
- **What:** one small portrait spot: a hand tying a fresh blank plant label to
  a stem in a labelled bed — correction as a gardener's act. (No hand/face
  issues at this scale; if a hand proves fussy, the fallback is the label and
  twine alone on the stem.)
- **Feeling:** care — "we keep the labels true; help us."
- **Size/format:** theme spot spec, smaller display (~360–480 px).
- **Reference:** photographic references of plant labels tied in beds.

### 8. A line-work corner flourish for the variety facts sheet
**Job: delight** — make the facts panel read as a specimen card from the plate
book, not a database table.
- **What:** NOT a painting — a vector corner sprig drawn in the exact hand of
  divider-stem.svg (ink-soft stroke), set at the facts panel's top corner.
  Vector line work is the right medium here: the panel sits on surface
  (#FFFDF6), not paper, and a painting's cream ground would show as a patch;
  a stroke motif has no ground to mismatch. One motif, same family as the
  existing divider — the system grows by one member, not a library.
- **Feeling:** a archivist's care — the data is kept like specimens.
- **Size/format:** SVG, stroke-only, ~48–64 px, aria-hidden.
- **Reference:** drawn from divider-stem.svg's geometry and leaf shapes.

### 9. Reuse the crop's pod motif as the waitlist confirmation mark
**Job: delight** — when a gardener joins a waiting list, let the confirmation
wear the crop's own seed pod, the site's existing symbol for "seed not yet in
hand."
- **What:** NO new art. The waitlist panel's joined/success state shows the
  variety's crop pod motif (already produced for the 14 signature crops; the
  poppy motif as the fallback for other crops) beside the confirmation line.
- **Feeling:** a small ceremony — "you're on the list; here's your pod."
- **Size/format:** existing /ornaments/ WebPs at ~64–96 px.
- **Reference:** none needed; existing approved assets.

### 10. A closing spot for the unsubscribe confirmation
**Job: delight** — give the one goodbye page a graceful last image instead of
bare text, so leaving feels like closing a book, not cancelling a service.
- **What:** one small spot: a pressed flower kept between the pages of a closed
  book, a seed packet tucked in as the bookmark. Quiet, final, fond.
- **Feeling:** no hard feelings — "come back in spring."
- **Size/format:** small theme spot (~360–480 px display), WebP.
- **Reference:** photographic references of pressed flowers in books.

---

## 3. Recommended AGAINST

- **Any new footer artwork.** Professional practice loves a footer flourish —
  but Dustin has already ruled on this exact question: the poppy motif was
  removed from the footer at his direction, and the FooterStem rule now governs
  that space. Re-proposing footer art would relitigate a settled verdict.
  (House rule wins over practice — flagged as the one place practice and the
  house point different ways; I side with the house.)
- **Seasonal favicon / icon swaps.** A common delight tactic, and wrong here:
  the poppy icon was chosen and approved days ago; an icon's whole job is
  instant recognition, and rotating it spends that recognition. Seasonal life
  belongs on the page (proposal 4), not in the tab.
- **Captions or "Plate No." labels under paintings.** Real plate books caption
  their plates, and it would suit the theme — but captions under illustrations
  were removed sitewide at Dustin's direction. Live-text plate numbers would
  reintroduce by the back door what he took out the front.
- **Painted tab-bar / header icons.** The theme's deliberate split — serif
  painted world vs. sans instrument layer — is a strength; painted chrome
  icons would blur it and fail the small-size legibility test (16–24 px is a
  silhouette problem, and watercolor detail is noise at that size).
- **Bespoke paintings of individual farms for seller pages.** Tempting, and a
  trap: an invented painting of a real farm misrepresents it, and 25 farms
  cannot be kept consistent. Proposal 2 (the farm's own state flower) gives
  seller pages true art instead.
- **Animated or looping ornaments** (swaying stems, drifting petals). The
  motion rules are settled — restrained, nothing loops — and a printed
  catalogue does not move. Stillness is the brand.
- **Paper grain or texture on cards and form panels.** The direction reserves
  grain for the body ground and keeps cards flat for legibility; texture under
  form fields would fight the inputs. Elevation comes from spots and motifs,
  not from roughening working surfaces.
- **Any dahlia painting on a dark green ground**, anywhere, ever — standing
  house rule, restated here so no future seasonal plate (proposal 4) drifts
  into a dark backdrop for drama. The winter plate stays on cream paper like
  everything else.

---

*Prepared by the art direction & illustration specialist. Companion consult:
UX/UI specialist (separate). All proposals are paper only — no artwork was
generated and no site files were touched.*
