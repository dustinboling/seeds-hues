# Tab Bar Redesign — UX Structure Pass

**Seat:** Nadia, UX Design (structure pass — the first step of the design-first chain:
Nadia → Mina visual form → Iris / Thea / Ada consults → Quinn design gate → Dustin picks → build queue)
**Commission:** Dustin, 2026-11-22, verbatim: *"Make nice touch icons and favicon, then have them redesign the tab bar. It's boring."*
**Surface:** the Seed Directory's navigation chrome on seeds.hues.flowers — the mobile bottom tab bar
(`v2/components/layout/TabBar.tsx`) and its relationship to the desktop header system
(`SiteHeader` / `HeaderNav` / `HeaderMenu`, the 5.3 header as shipped in PR #38/#40).
**Status:** STRUCTURE ONLY. This document decides what the bar *is* — destination set, order,
active-state model, relationship to the page, desktop relationship, identity affordance.
It does not draw the bar. Visual form is Mina's pass, on top of the direction Dustin picks here.
**Evidence base:** the components as they stand on `main` (read 2026-11-22; `TabBar.tsx` is
byte-identical between `main` and the working tree), `THEME-ART-DIRECTION.md` §5,
`backlog-2026-11-21/tranche-3/DECISIONS.md`, and the Quinn gates for PR #38/#40 (5.3 header)
and PR #43 (icon). Where this document cites usage data, it names the source. There is almost
none — see §4.6, stated plainly rather than filled in.

---

## 1. Audit of the current bar

### 1.1 What ships today

**Mobile tab bar** (`TabBar.tsx`, rendered last in the root layout, `md:hidden` — phones and
small tablets only):

| Slot | Destination | Match rule (active when…) | Icon |
|---|---|---|---|
| 1 | Home — `/` | path is exactly `/` | `HomeIcon` (house outline) |
| 2 | Crops — `/crop` | path starts `/crop` or `/series` | `SeedIcon` (seed/leaf outline) |
| 3 | Varieties — `/variety` | path starts `/variety` | `BloomIcon` (bloom on a stem) |
| 4 | Sellers — `/seller` | path starts `/seller` or `/state` | `FarmIcon` (barn outline) |
| 5 | Search — `/search` | path starts `/search` | `SearchIcon` (magnifier) |

- Fixed to the bottom of the viewport, always visible; 64 px tall (`h-16`) plus
  `env(safe-area-inset-bottom)` padding; content capped at `max-w-lg` in five equal columns.
- Ground: `paper-deep` at 92 % with backdrop blur; one `line-strong` hairline on top.
- Each cell is a real link (flex column: 24 px icon, a 3 px dot slot, a 12 px semibold sans label).
  At 390 px wide each target measures ≈ 78 × 64 px — comfortably past the 44 px house floor.
- **Active state:** label and icon turn `leaf` green, and the 3 px dot above the label fills
  `petal`; the dot's space is reserved on every tab, so nothing shifts. `aria-current="page"`
  is set. That is the whole state model: there is no pressed/`:active` treatment (colour
  transition only, 150 ms), no badge, no count, nothing that varies with the visitor.
- **Inactive state:** `ink-soft`. Nothing else distinguishes the five from each other.
- **No-active state (accidental, not designed):** on `/account`, `/about`, `/report`,
  `/add-your-farm`, `/admin/*` and `/go/*`, *no* tab matches, so the bar shows five inactive
  tabs while the visitor is standing in a primary area of the product. The bar renders on
  admin pages too (the root layout wraps everything; admin has no layout of its own).
- **Re-tapping the active tab** does nothing special — it is a link to the page you are on.
  The platform convention both Apple and Material teach (re-tap scrolls to top / returns the
  section to its root) is not implemented.
- **Keyboard/focus:** the bar is last in DOM order (after header, main, and footer), so a
  keyboard user tabs through the entire page and footer before reaching primary navigation.
  The fast keyboard path on mobile is the header menu, which is early in the DOM and carries
  the same destinations plus Account and About. Focus itself is well handled: a global
  3 px `:focus-visible` ring, and `scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom))`
  in `globals.css` exists specifically so a focused element is never hidden behind the fixed
  bar (WCAG 2.2 SC 2.4.11). The footer carries `pb-24` on mobile for the same reason — the
  bar's height is load-bearing in two other files.
- **No-JS:** the bar is a client component only for `usePathname`; the destinations are plain
  links and work fully without JavaScript. Nothing about the bar gates content behind a script.
- **Scroll behaviour:** none. The bar does not recede, condense, or respond to scroll in any way.

**Desktop counterpart** (the 5.3 header, Quinn PASS WITH NOTES on PR #40, settled law):
`HeaderNav` shows text-only links — Crops · Varieties · Sellers · Search from `md`, plus
Add Your Farm at `lg` where the hamburger retires. Its active model is *different* from the
tab bar's: semibold + `leaf` colour + `aria-current`, no marker shape. The header menu
(below `lg`) uses a third rendering of the same idea (semibold + `leaf` + `aria-current` in a
dropdown list). The account destination is an icon-only person glyph in the header at every
width. Home on desktop is the logo/wordmark only — there is no Home text link.

So the product has **three navigation surfaces with two different destination sets and three
renderings of "you are here"**: the mobile set is {Home, Crops, Varieties, Sellers, Search};
the desktop set is {Crops, Varieties, Sellers, Search, +Add Your Farm at lg}; Account is a
tab in neither, a text link in neither — an icon on desktop, a menu item and a header icon on
mobile.

### 1.2 What the current bar does well (keep, in every direction)

1. **Real links, real labels.** Every destination is a link with a visible text label — never
   icon-only, never a button pretending to navigate. This is the pattern the field prescribes
   and it survives no-JS intact.
2. **Targets are generous.** ≈ 78 × 64 px per tab at phone widths, in the natural thumb arc
   at the bottom of the screen, clear of the gesture inset via the safe-area padding.
3. **The active state is not colour-alone.** Colour change *plus* a shape change (the dot)
   *plus* `aria-current` — three channels. The reserved dot slot means zero layout shift.
4. **Focus is never obscured** — the scroll-padding contract in `globals.css` was written for
   this bar and works.
5. **State survives the switch.** Because filter state lives in the URL (the house rule from
   the in-place filtering standard), leaving `/variety` and returning via the tab restores the
   shopper's filtered view. The bar's plainness here is a virtue: it never traps or resets.
6. **One primary navigation component per screen.** The bar never competes with a second
   bottom pattern; the header menu is a disclosure, not a rival bar.

### 1.3 Why it reads as boring — the structural diagnosis

Dustin's word is "boring," and the causes are structural, not cosmetic. In order of weight:

**B-1. The bar is the starter template, recoloured.** Five equal columns, a 24 px stroke icon
over a 12 px label, a hairline top rule, a translucent wash. That is the default shape every
app framework ships. The only things tying it to *this* product are token colours
(`paper-deep`, `leaf`, `petal`). Swap the palette and the bar could belong to a bank, a
weather app, or a recipe box. A structure with no point of view cannot be fixed by a nicer
coat of the same paint — which is why this pass is structural.

**B-2. The chrome speaks a different visual language than the content it navigates.** The
site's identity everywhere else is painted: gouache botanical plates, warm paper, letterpress
buttons, a stem divider over the footer. The bar's icons are drawn to what `icons.tsx` itself
calls "the interface icon family's rules" — a 24 px grid, 1.8 px stroke, `currentColor`, no
fill: the generic line-icon dialect of every icon library. Two of the five (the house, the
magnifier) are the universal template glyphs, identical in spirit to a thousand other apps.
The bar is the one surface a visitor touches on *every* screen, and it is the one surface
that contains nothing of the world the rest of the site builds.

**B-3. No hierarchy — five destinations, zero emphasis.** Every slot is the same width, the
same weight, the same treatment. But the jobs are not equal: Varieties is the catalogue
itself, the surface the whole directory exists to serve (it is where the filters, the
listings, and the PB-2 multi-select Hue work live). A bar that treats the catalogue and the
utility search page as visual equals has no centre of gravity — nothing for the eye to land
on, nothing that says what this place is *for*. (Von Restorff: the item that differs is the
item remembered. Here, nothing differs.)

**B-4. The one expressive gesture was budgeted at 3 pixels.** `THEME-ART-DIRECTION.md` §5
specifies the active treatment as "a 3 px petal dot above the label (**the one jewel in the
chrome**)." That sentence is the boring, written down as a spec: the design brief for the
primary navigation of the whole product allowed itself exactly one jewel, and sized it at
3 px. Restraint is a real virtue in this design system, but a 3 px dot is not restraint —
it is absence. The active state, the single most-seen state change in the app, is nearly
invisible by design.

**B-5. The destination set was inherited, not derived — and it shows.** Two structural faults:
- **Home duplicates the affordance directly above it.** The header's logo *and* wordmark both
  link to `/`, on the same screen, a thumb's length away. Home's real value is as a persistent
  reset when scrolled deep (the header is not sticky, so it scrolls away) — that value is
  real, but the bar spends 20 % of itself on the one destination that already has two other
  doors, while…
- **…the return-visit job has no door at all.** Account — where waiting lists and stock
  alerts live (`/account`'s own description: "join waiting lists and get an alert when a
  variety is found") — is not in the bar. On mobile it is a 44 px person icon in the
  top-right corner of the header: the hardest thumb position on the screen, and gone entirely
  once the visitor scrolls. The shopper who joined a waitlist — the directory's clearest
  reason to come back — has no persistent way back to it from the bar that is always on screen.
- **Crops vs Varieties is an insider distinction.** A crop is a plant-type hub; a variety is a
  cultivar. The team knows this cold; a first-time shopper holding a phone does not, and the
  two labels side by side ("Crops" / "Varieties", seed icon / bloom icon) do not predict
  their difference. Weak information scent on the two most prominent slots in the product.

**B-6. The bar is inert.** It never reflects anything about the visitor or the moment: signed
in or out, waitlist alerts waiting or none, it renders identically forever. Furniture, not an
instrument. Combined with B-3, the bar communicates nothing except "these five pages exist."

**B-7. The no-active state is an accident.** §1.1: whole areas of the product (Account above
all) light no tab. A designed bar decides what it shows when you are somewhere it doesn't
carry; this one just goes blank by omission, which reads — correctly — as the bar not knowing
the account area exists.

None of B-1…B-7 is a colour, a radius, or an icon redraw. Each is a decision about what the
bar *is*. That is the work below.

---

## 2. Structural directions

Three directions, genuinely different in structure — not three skins. Each specifies: the
destination set and order, the active-state model, the bar's relationship to the page, scroll
behaviour, the desktop relationship, and the identity the structure makes possible (or
forecloses) for Mina's visual pass.

A note on what is *not* up for redesign in any direction: the keep-list from §1.2 (real links,
visible labels, ≥ 44 px targets, safe-area handling, focus-never-obscured, URL-carried state)
is invariant. And the desktop header's *destination set* is settled law under the 5.3 ruling
(header/footer no-orphan contract, PR #38/#40); directions below say explicitly where they
touch it.

### Direction 1 — "The Center Plate"

**The idea:** give the bar a centre of gravity. The middle destination becomes a raised
circular plate that breaks the bar's top line — a medallion set into the bar, the way the
Seasons disc sits in the hues.flowers tab bar. Structure creates the hierarchy; the plate is
where the site's painted world is allowed into the chrome.

- **Set and order (unchanged set, new geometry):** Home · Crops · **Varieties (centre plate)**
  · Sellers · Search. Varieties is crowned because it is the catalogue — the core job
  (browse varieties → find who sells them) runs through it, and the tranche programme keeps
  investing there (filters, pagination, plates). Search keeps the last slot (serial position:
  first and last are remembered best; Search is the power path and earns an end). Home keeps
  slot 1 as the persistent reset.
- **Active-state model:** two-tier. The centre plate is *always* the landmark; when Varieties
  is the current section, the plate's ring takes the active treatment (leaf ring + label in
  leaf + `aria-current`). For the four flanking tabs, the 3 px dot is replaced by a **stem
  rule**: a short horizontal rule under the label, in leaf, present only on the active tab —
  a marker with actual width, echoing the site's stem/divider motif, still a shape channel
  alongside colour. Pressed state gets a real treatment (background well darkens on `:active`)
  — the current bar has none.
- **Relationship to the page:** still fixed bottom, still one component — but the plate rises
  above the bar's top edge into the page's space, so the bar stops being a sealed strip and
  starts overlapping the world it navigates. Bar body height can drop slightly (the plate
  carries the visual weight); the scroll-padding and footer-clearance contracts must be
  re-derived from the new geometry, plate included (the plate's overhang must never cover a
  focused element — see §4.2).
- **Scroll behaviour:** unchanged — always visible. The plate makes hide-on-scroll *less*
  attractive, not more: a landmark you can lose is not a landmark.
- **Desktop relationship:** the header is untouched in set and layout (5.3 stands). What
  transfers is the *active-state model*: HeaderNav adopts the stem-rule marker under the
  current link so "you are here" is drawn the same way on both surfaces. Flagged honestly:
  this is an amendment to the shipped 5.3 surface, not a reopening of its destination map —
  one marker rule, no layout change. Dustin's call at the pick (§5, Q4).
- **Identity the structure makes possible:** the plate is a *painting surface*. It is the one
  slot where a small gouache medallion — a bloom, a pod — can live at a size where paint
  survives (≈ 44–52 px disc), drawn in the site's own hand, kin to the favicon/touch-icon
  family Dustin has just commissioned. Mina specs it; Elena paints it (§4/§5 handoffs). The
  flanking icons can stay line-drawn (the tool layer) while the plate carries the art layer —
  the site's existing two-register system (sans tools, painted world) expressed inside one bar.
- **What it costs / forecloses:** the set's faults (B-5) survive — Account still has no tab,
  Crops/Varieties scent is unchanged. The plate is a strong gesture spent on hierarchy, not on
  the set. If Dustin's deepest gripe is the set, this direction answers only half the audit.

### Direction 2 — "The Working Five"

**The idea:** re-derive the set from the jobs, and let the bar be *alive*. The bar stops
being a fixed monument and becomes the shopper's instrument panel: the five jobs a visitor
actually does here, one of which reports back.

- **Set and order (changed):** Home · Varieties · Search · Sellers · **Account**.
  - **Account enters** (slot 5) — the waitlist/alert job gets a persistent door in the thumb
    arc instead of a vanishing header icon. Label: "Account" (matching the header menu's
    "My Account" vocabulary is Mina/Wren's call; structure only fixes the destination).
  - **Crops leaves the bar.** Defence: the crop-browsing job is served three other ways that
    stay — the home page's crop section (links to `/crop` and every crop hub), the desktop
    HeaderNav and the mobile header menu (both keep Crops), and the footer. What the bar
    loses is a *fourth* door to the same hub; what it gains is the *only* persistent door to
    Account. Crops also has the weakest scent of the five (B-5) and its content is reachable
    from inside Varieties' world (crop hubs and variety lists cross-link). This is the
    direction's boldest claim and Dustin's clearest decision (§5, Q2).
  - **Order logic:** Home first (reset, serial position). Varieties second — the catalogue,
    one step from home. Search centre — the highest-intent action gets the most accurate
    thumb position (centre-screen accuracy, Hoober). Sellers fourth. Account last (serial
    position again — the personal destination is remembered at the end, and a badge there is
    seen at every glance at the bar's right end).
- **Active-state model:** the **pressed well**. The active tab's icon + label sit inside a
  sage-tint rounded well (a common region — Gestalt — rather than a dot beside the point).
  It reads at a glance, survives grayscale, and uses the chip language the site already
  speaks (active filter chips are sage-tint + leaf). `aria-current` as today. The no-active
  state disappears as a category: Account is now carried, and the remaining uncarried routes
  (`/about`, `/report`, `/add-your-farm`) are defined as *utility pages* that deliberately
  light no tab — a stated rule, not an omission.
- **The alive part:** the Account tab carries a **count badge** when the signed-in shopper
  has waiting-list alerts (the number of varieties with news). Signed-out, it carries nothing.
  The bar now reflects the visitor's own state — the direct answer to B-6. The badge is a
  number, not a red dot: it must announce politely to assistive tech ("Account, 3 alerts")
  and must never be the only channel for the information (the account page itself lists the
  alerts, as today).
- **Relationship to the page / scroll:** fixed bottom, always visible, same height class as
  today — deliberately. This direction spends its novelty on the set and the state, not the
  geometry, so the scroll-padding/footer contracts survive untouched and the build risk is
  the lowest of the three.
- **Desktop relationship:** desktop keeps its 5.3 set (Crops stays in HeaderNav — the
  no-orphan contract is about the *header*, and the header has room the bar does not).
  The pressed-well active model transfers to HeaderNav so both surfaces draw "current" the
  same way (amendment to 5.3's rendering, as in Direction 1 — flagged, Dustin's call).
  The badge concept transfers to the header's account icon (a count on the person glyph),
  which finally gives that icon a job beyond decoration.
- **Identity the structure makes possible:** quieter than Direction 1, but real: the bar
  becomes a *ledger strip* — five entries in the directory's own book, the active entry
  pressed into the paper, the account entry annotated in the margin with your number. Mina
  can draw that in the Quiet Ledger language the cards already use. What it forecloses: no
  painting surface — identity here is typographic and behavioural, not pictorial. If Dustin
  wants the bar to *show* the garden, this direction won't.

### Direction 3 — "One Rail, One Model" (the conservative control)

**The idea:** the audit's consistency findings (three surfaces, three "you are here"
renderings, no re-tap behaviour, no pressed state, accidental no-active state) are the real
defects; the five-slot pattern itself is what users already know (Jakob's Law) and should be
kept. Spend the redesign budget on *unification and behaviour*, and let the new icon family
(Dustin's parallel commission) carry the freshness inside the existing slots.

- **Set and order:** unchanged on mobile; desktop unchanged. Account stays header-carried —
  stated as an accepted cost, not an oversight: the header icon + menu item are judged
  sufficient doors, and the bar's five stay the five *browsing* destinations.
- **Active-state model:** one model, specified once, implemented on all three surfaces —
  colour + a marker with real width (stem rule, as Direction 1's flanking tabs) + semibold
  label + `aria-current`. The tab bar's 3 px dot is retired everywhere.
- **Behaviour completions:** re-tapping the active tab scrolls to top (and on a section root,
  is a no-op); a pressed treatment on `:active`; the no-active state defined as in Direction 2
  (utility pages light no tab, by rule).
- **Relationship/scroll/desktop:** everything as shipped; the work is the shared model and
  the behaviours.
- **Identity:** forecloses structural identity almost entirely — the bar remains a utility
  rail, distinguished only by better-drawn icons within it. I include this direction because
  an honest structure pass must price the "the pattern is fine" position — but I flag it
  against Dustin's own standard: he called the bar boring and his standing rule is that a
  minor restyle passed off as a redesign is a failed answer. Direction 3 is a *repair*, and
  should only be picked knowingly, as a repair.

### Recommendation (Nadia's — the pick is Dustin's)

**Direction 1's centre plate, carrying Direction 2's set correction.** The plate answers
B-1/B-3/B-4 (template shape, no hierarchy, 3 px jewel) and gives the bar a painting surface
— the only direction that lets the chrome join the site's world. The set correction answers
B-5/B-6/B-7, which the plate alone leaves standing: Account in, Crops out to its three
remaining doors. With the plate fixed at centre, the order runs Home · Sellers ·
**Varieties (plate)** · Search · Account — the two browsing doors (Home, Sellers) grouped
left of the catalogue, the two action/personal doors (Search, Account) right of it, and
Account taking the last, best-remembered slot, its badge where a badge is most visible.
If Dustin will not move Crops, Direction 1 as drawn is my fallback recommendation, with the
Account gap recorded as an accepted cost he chose. Direction 2 alone is the pick if he wants
the set fixed but no raised geometry near the thumb arc.

---

## 3. Settled law this design works within

- **PB-1 (sort default: Name A–Z)** and **PB-2 (Hue multi-select)** — Tranche 3 rulings,
  2026-11-22. Neither touches navigation; neither is engaged or reopened here. PB-2 is cited
  once, as evidence: the filter programme's centre of gravity is `/variety`, which supports
  Varieties' claim to the plate in Direction 1.
- **The 5.3 desktop header (PR #38/#40, Quinn PASS WITH NOTES)** — its destination map and
  the header/footer no-orphan contract are treated as settled. Directions 1 and 2 propose
  amending only the *rendering of the current state* in HeaderNav (marker/well), explicitly
  flagged for Dustin at §5 Q4 — not a reopening of the set, the layout, or the lg takeover.
- **The icon ownership ruling (Dustin, 2026-11-22):** Mina specs icons, Elena creates them.
  Carried into §5's handoffs verbatim.
- **SPEC-CANONICAL.md** governs data/API and carries no navigation-chrome spec; the chrome's
  governing documents are `THEME-ART-DIRECTION.md` §5 (whose tab-bar line — the 3 px jewel —
  this redesign supersedes on Dustin's commission) and the component contracts quoted in §1.

## 4. Constraints register

### 4.1 Touch targets and thumb reach
- House floor: **44 px** minimum on both axes for every tab (playbook standard; WCAG 2.2 AA's
  own floor is 24 px SC 2.5.8, Apple asks 44 pt, Material 48 dp — the house follows the
  platform guidance, and the current bar's ≈ 78 × 64 px cells are the comfort benchmark, not
  the floor). No direction may shrink a flank tab below 44 px in either axis, and adjacent
  targets need clear separation.
- Primary navigation lives in the natural thumb arc at the bottom; nothing frequent moves to
  the top corners. Direction 1's plate rises *upward* from the bar — its tappable area must
  stay centred on the bar's band, and its overhang is visual, not a target floating in the
  content's gesture space.

### 4.2 WCAG 2.2 AA floors (Ada rules formally later; these are the known floors to design within)
- **Focus never obscured (SC 2.4.11):** the `scroll-padding-bottom` contract is derived from
  the bar's height. Any direction that changes bar geometry (Direction 1) must re-derive it
  in the same build, plate overhang included, and the footer's mobile clearance with it.
- **Contrast:** text on the bar's `paper-deep` ground — `ink-soft` measures 7.7:1 on
  paper-deep (token comment, `globals.css`); `leaf` is recorded at 9.4:1 on paper and is the
  darker of the two greens on this ground, but its paper-deep figure is not recorded in the
  tokens — Ada measures it in her pass rather than this pass assuming it. The bar's top rule (`line-strong` on paper-deep)
  sits at **3.0:1 — exactly the SC 1.4.11 floor** for component boundaries (Ada, 2026-11-19).
  There is no contrast headroom to spend on a fainter boundary; if Mina lightens anything,
  Ada measures it.
- **State never by colour alone:** every direction keeps a shape/region channel (rule, well,
  plate ring) beside the colour channel, and `aria-current` in the accessibility tree.
- **Labels always visible:** icon-only tabs are prohibited (playbook + Material); the badge
  in Direction 2 is an addition to a labelled tab, never a replacement for the label.
- **Target size in forced-colors / 200 % text / 320 px width:** the bar must survive all
  three without horizontal scroll or clipped labels; five labelled slots at 320 px is the
  tight case and caps label length (a reason "Account" beats "My Account" in the bar).
- **Motion:** house range 150–220 ms ease-out; the global `prefers-reduced-motion` rule wins;
  no looping animation anywhere in the chrome.

### 4.3 PWA / app-feel standard
- Phone-first; installed (standalone) mode has no browser chrome, so **the bar is the
  primary navigation** — it must be present and functional on every route it serves today,
  including offline shells. No direction may make a destination depend on a panel, sheet, or
  script to reach.
- State preservation across tab switches is carried by URL state (house rule); no direction
  may introduce a tab that resets a shopper's in-progress filters.
- Re-tap behaviour (Directions 2/3 specify it; Direction 1 should adopt it too): re-tapping
  the active tab scrolls to top — the platforms' taught expectation.

### 4.4 No-JS behaviour
- Destinations are plain links today and stay plain links in every direction. The active
  state is progressive decoration on a working link set. Hide-on-scroll, badge counts, and
  any plate behaviour are enhancements layered on a bar that is fully present and usable
  with JavaScript disabled or before hydration. (No direction here proposes hide-on-scroll;
  if Mina's pass raises it, this register is why it needs Dustin's explicit ruling — §5 Q6.)

### 4.5 Keyboard and DOM order
- The bar sits last in the DOM; the header menu (early in DOM, same destinations + Account +
  About) is the keyboard-fast path on mobile. **Set parity between the bar and the header
  menu is therefore an accessibility property, not a nicety** — whichever set Dustin picks
  for the bar, the menu must mirror the primary destinations so no route is keyboard-far.
  (Direction 2 note: if Crops leaves the bar, it stays in the menu — parity means *the menu
  carries at least the bar's set*, and Crops' menu presence keeps it keyboard-near.)

### 4.6 Usage data — stated plainly
- **There is no destination-usage data for the bar.** The codebase contains no tap/click
  instrumentation on any navigation surface (grep of `v2/components/layout/` finds no beacon
  or event call). Cloudflare Web Analytics is enabled zone-wide and yields page *views* per
  path — which cannot distinguish a tab tap from any other arrival, and was not pulled for
  this pass. The `/go` event system tracks outbound listing clicks, not navigation.
- Therefore every set/order argument in §2 is made from the jobs and the routes, labelled as
  reasoning — not from measured use. If Dustin wants measurement before the pick, the honest
  option is a small privacy-respecting tap counter on the current bar for a window before
  build; that is his call (§5 Q5), and the Dec 16 launch date argues against waiting on it.

### 4.7 Route inventory the bar must keep serving
Carried sections: `/`, `/crop` + `/crop/[slug]` + `/series/*`, `/variety` + `/variety/[slug]`,
`/seller` + `/seller/[slug]` + `/state/[state]`, `/search`, `/account` (+ `/account` waitlist
views). Deliberately uncarried (utility) routes — the no-tab-lit rule must be *designed* for
these, not discovered: `/about`, `/report`, `/add-your-farm`, `/admin/*`, `/offline`, `/go/*`.
Match-rule consistency: the tab bar matches by bare prefix (`startsWith("/crop")`) while
HeaderNav/HeaderMenu match by `href + "/"` — one rule, specified once, in the build brief.

---

## 5. Handoffs and Dustin's decisions

### 5.1 What Mina needs from this document (visual-form pass)
1. The picked direction (§2) and Dustin's answers to §5.3 — the set, the order, and the
   active-state model are **fixed by this pass**; Mina designs their form, not their structure.
2. The geometry envelope: bar band 64 px + safe-area inset as the resting height;
   Direction 1's plate may rise above the band and must keep its tappable disc ≥ 44 px,
   centred on the band; flank targets ≥ 44 px both axes at 320 px width.
3. The state inventory to draw: default · active · pressed (`:active`) · focus-visible ·
   no-tab-lit (utility routes) · and, if Direction 2's badge survives the pick, badge
   (signed-in with alerts) vs no-badge — each in light of the token system on `main`
   (`paper-deep`, `leaf`, `petal`, `line-strong` at its 3.0:1 floor).
4. The icon brief is Mina's to write (per Dustin's ownership ruling): which marks, at what
   sizes, in which register (line for tools, paint where the structure gives paint a surface).
   The current five line icons are *not* presumed keepers — B-2 is a finding about them.
5. Desktop scope: HeaderNav's active-state rendering only (marker or well, matching the
   picked model); no desktop layout or set changes without Dustin ruling Q4 the other way.

### 5.2 What Elena would need (under Mina's spec, if the picked direction uses artwork)
- Direction 1 only: **one medallion painting** for the centre plate — a single botanical
  subject (bloom or pod, Mina's spec decides) in gouache, the site's plate hand, composed to
  read at ≈ 44–52 px: one connected mass, silhouette-first (the same discipline Mina's
  favicon spec enforced at 16 px, relaxed to plate size), on a transparent ground —
  **background only transparent; the painting itself full-strength and solid** (Dustin's
  standing transparency ruling from the motif work).
- Deliverables: the master at production multiples, the verbatim generation prompt saved as
  a text file alongside the image (Dustin's standing rule, 2026-11-21), and a grayscale
  proof at final size for Quinn's gate.
- If a direction *without* a plate is picked, Elena's commission is whatever Mina's icon
  spec calls for (painted mini-marks vs line icons is Mina's spec decision); this structure
  pass presumes nothing.

### 5.3 Questions that are Dustin's to decide at the pick
- **Q1 — Direction:** 1 (Center Plate), 2 (Working Five), 3 (One Rail), or the recommended
  synthesis (1's plate + 2's set)?
- **Q2 — The set:** does Account earn a tab? If yes, does Crops leave the bar (my candidate),
  or does another slot give way — and if none may leave, do we accept six unequal slots or
  keep Account out knowingly?
- **Q3 — The crown:** is Varieties the right centre (the catalogue), or is Search the job
  he wants the plate to carry?
- **Q4 — Desktop scope:** unify the active-state *rendering* in the 5.3 header (recommended),
  or leave the shipped header entirely untouched and let the surfaces differ?
- **Q5 — Measurement:** ship the redesign on reasoning alone, or instrument the current
  bar's taps for a window first (launch timing argues against waiting)?
- **Q6 — Scroll behaviour:** the bar stays always-visible in all three directions. If he
  wants hide-on-scroll explored, it needs his explicit word — it is excluded by default
  under §4.4.

---

## Appendix — heuristic walk of the current bar (for the record)

Against the ten usability heuristics, violations found in the *current* bar and recorded per
playbook practice (accepted ones included): **Visibility of system status** — partial: the
active state exists but is sized to near-invisibility (B-4), and whole sections report no
status at all (B-7). **Match between system and real world** — "Crops" vs "Varieties" is the
team's taxonomy, not the shopper's language (B-5). **Consistency and standards** — three
navigation surfaces, three current-state renderings, two destination sets (§1.1).
**Recognition rather than recall** — passes (labels always visible). **Aesthetic and
minimalist design** — passes on restraint, fails on identity: minimalism that removes the
product's own character along with the clutter (B-1/B-2). All other heuristics: no violation
found in the bar itself. Every violation above is addressed by at least one direction in §2;
Direction 3 addresses only the consistency and status items, which is stated in its costing.

*— Nadia, UX Design. Structure pass complete; awaiting Dustin's pick before Mina's visual-form pass.*
