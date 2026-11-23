# Tranche 3, Item 3.3 — The Public Field-State Set: Design

**Seat:** Mina, UI Design (author). Standing collaborators applied throughout: Iris (color theory — feeling only; every feeling call below is hers in substance), Thea (typography — no type value is invented here; see §0.3), Ada (accessibility — WCAG 2.2 AA floor; her A4 pattern is adopted verbatim where the contract adopts it, and every new contrast pair this design creates is computed in §9 for her sign-off, which has **not** yet been given).
**Date:** 2026-11-22 · **Status:** Design only. No code, no build. Written so the 3.3 build brief can be lifted from it verbatim, to the standard of the Tranche 2 SPEC.
**Brief source:** Nadia's Tranche 3 SPEC §4 — §4.2 is the normative 10-clause behavior contract this design is designed *to*, §4.3 is the complete form inventory it must cover, §4.4 flags the Ada rulings this design must not assume. Quinn's design gate on that spec cleared Item 3.3's design to proceed on the current spec (her record: `tranche-3/QA-GATE-design.md` §2, §5). Source findings: F-20 and F-22 (`full-audit-2026-11-21/sections/mina-ui.md`), Ada A4 and W-2 (`sections/ada-accessibility.md` §6, §8), Quinn U6.2 / U6.3 / U7.1 / U7.2 (`sections/quinn-usability.md`, folded into §4.2's contract). Code truth: `origin/main` via `git show` only — the working tree sits on a stale branch and was never read. Token truth: `origin/main`'s `v2/design-tokens/tokens.json` and `v2/app/globals.css` as shipped by Tranche 2.

**House standards binding this design:** US spelling throughout. Prices are never shown — no form in the §4.3 inventory displays one, and nothing in this set may ever carry one. Phone-first for public surfaces, every surface a PWA. Admin is iPad-first and is **not** designed here (§1.2). One design thread: this set is designed once, as a system, and applied per form in §8 — no form invents its own treatment.

---

## 0. The three rules that govern this design

### 0.1 The admin pattern, translated — not copied, not a stranger

§4.1 of Nadia's spec establishes the fact this design starts from: the correct pattern already exists in-house. The admin sheets (`seller-sheets.tsx`, `variety-sheets.tsx`) ship per-field `aria-invalid` + `aria-describedby` wired to per-field error ids, an inline error line (ochre text, warning glyph, words), and a summary box whose entries anchor to fields. A4's fix is a port, not an invention.

But the admin sheets speak **admin dialect**: dense, sans throughout, Dustin's own daily tool. The public forms are the catalog's front door — visited once, by older gardeners, on paper grounds, inside the Print Edition's serif-and-paper world. A copy-paste would import the admin's chrome into the catalog; a fresh invention would make the two halves of one product feel like two products. This design therefore translates, under one stated rule, applied everywhere below:

> **What travels:** the pattern's structure and its tool-layer treatments — the id scheme, the describedby composition, the inline error line's construction (sans 14px, warning glyph, 6px gap), the summary box's construction (warn-50 ground, line-strong border, control radius), the focus discipline. **What stays public:** everything the visitor already reads — labels, hints, success leads, and body text keep the exact rendered type and wording they have today; grounds stay the public grounds (paper, surface); the one treatment the admin does *not* have — an error border on the field itself — is added for the public set, for the reason §5.2 states, and the divergence is named there rather than hidden.

### 0.2 No new reference color; every new pair computed

This set introduces **no new reference or system color token**. Every treatment below is built from the shipped palette (`tokens.json` color group, transcribed unchanged). What is new is *component* tokens (§4) and the contrast pairs those treatments create. Every such pair is computed in §9 by the WCAG relative-luminance method (linearize sRGB, weight 0.2126 / 0.7152 / 0.0722, (L1 + 0.05) / (L2 + 0.05)), unrounded value deciding, floors 4.5:1 normal text and 3:1 non-text per WCAG 2.2 AA 1.4.3 / 1.4.11 — and every one of them is **flagged as Ada's to rule** (§9, §12). My computations say they pass; her sign-off is a separate, later step, and §4.4 of the behavior spec reserves it to her. Nothing in this design is "Ada-approved" and nothing below claims it is.

### 0.3 No type value is invented

Thea's type scale is unformalized (Tranche 2 SPEC, Pushback P-1 — the type literals wait for her pass, and this item does not smuggle a decision past her). This set therefore takes its type values only from values already rendered in the product:

- **New tool-layer elements** (the error line, the summary box) take the admin reference pattern's shipped values exactly: error line sans 14px / 20px regular; summary heading sans 16px / 24px semibold; summary entries sans 14px. (The admin summary's entry list renders at its de facto 15px; the public set uses 14px, the size every public form element already speaks — a dialect difference, recorded here, not a new step.)
- **Existing public content** (labels, hints, success leads, field values) keeps its current rendered values untouched. `.field` already sets the sans tool family for entered text; labels and hints keep whatever family and size they render in today, form by form. If that inconsistency is ever to be fixed, it is Thea's pass that fixes it, not this one.

---

## 1. How to read this design / what it does not decide

- §2 is the anatomy every field group in the set shares. §3 is the state set itself — the deliverable's core. §§5–7 expand the three treatments that need full specification (error, success, busy/disabled). §8 applies the set to every form in the §4.3 inventory. §9 is Ada's hand-off table. §10 is the change register (the T-B discipline: the complete, closed list of rendered differences this design would introduce). §11 is the acceptance checklist Quinn executes. §12 is pushback and open rulings. §13 is what was left undecided, and why.
- Class names, token names, id schemes, and file paths in §§2–8 are normative — the brief copies them unchanged. Copy *wording* is not designed here: where a treatment needs words (summary headings, hint-stated rules, the CodeEntry lifetime line), this design fixes the slot, the construction, and the obligation, and names Wren as the wording's owner, exactly as Nadia's spec does.
- **The service and flow behavior is Nadia's contract, already settled.** This design decides how the contract *looks and presents*. Where the contract and good field design appeared to conflict, the conflict is recorded as a pushback in §12 — the flow was not quietly redesigned anywhere in §§2–8.
- **Out of the set, explicitly** (per §4.3): admin forms — they hold the reference pattern; this design consumes them in exactly one place (CodeEntry, §8.5, by consumption) and redesigns nothing admin. SearchBox — a search control, not a data form; its states are Item 3.4's (§5.3 of Nadia's spec). The waitlist's *flow* — Item 3.2's; this design covers the waitlist form *as rebuilt by §3 of Nadia's spec*, because §9 of that spec sequences the 3.3 build before 3.2 precisely so the rebuilt form is born inside this set.

---

## 2. Anatomy of a field group (normative)

Every data field in the set — text input, textarea, native select, the code field — is one **field group**: a vertical stack of named parts, in this order, with these gaps. The stack's gaps come from the spacing scale (4px steps) and match the majority construction already shipped (`gap-1` stacks in SignInForm / SignupFields / AddYourFarmForm's field helper; the admin EditField's 4px label margin).

| Part | Gap above | Treatment (summary — full spec in §3) |
|---|---|---|
| Label (or group legend) | — | Unchanged from today: same element, same words, same rendered type. "(optional)" suffix in muted regular weight remains the only optionality mark in the set (§3.10) |
| Field (`.field`) | 4px | §3 states. Min height `size.target` (44px), radius `radius.field` (10px), padding 8px block / 12px inline, ground `color.surface`, value text `color.ink` in the sans tool family — all as `.field` already renders |
| Hint / description (`.field-hint`) | 4px | §3.9. Present only when the field has one; never moves when an error appears |
| Error line (`.field-error`) | 4px | §5. Present only in the error state; sits *below* the hint when both exist, so the hint never changes position and the reading order matches the describedby order (§2.1) |

**Textarea** is the same group with the field's shipped textarea geometry (`min-height: 6rem`). **Native select** is the same group with the platform's behavior and rendering (§4.2.9 of the contract — the native select stays native; `.field` dresses its box, the OS draws its arrow and menu; no custom chevron is designed or permitted).

### 2.1 The id and association scheme (Ada's A4 pattern, adopted verbatim)

The mechanics are the contract's (§4.2.1), which adopts Ada's prescription exactly; this design fixes the naming so every form builds the same way the admin sheets already do:

- Hint id: `{fieldId}-hint` — the scheme the public forms already use where hints exist today (AddYourFarmForm, SignupFields) and the admin sheets use. No hint id changes anywhere.
- Error id: `{fieldId}-error` — the admin sheets' scheme (`edit-{field}-error`, `alias-name-error`).
- `aria-describedby` composition, in this order, always: hint first, error second — `"{fieldId}-hint {fieldId}-error"` when both exist; the single id when only one exists; the attribute absent when neither exists. (§4.2.1: when an error shows, the describedby includes both, in that order.)
- `aria-invalid="true"` is present on a field **only** while that field is in the error state — present-true or absent, never `"false"` (the admin sheets' exact convention).
- CodeEntry is the one named exception in spelling, because Ada prescribed its ids literally (W-2): error id `{idPrefix}-code-error`, on the error paragraph, with `aria-invalid` + `aria-describedby` on the input. Its describedby composition when the lifetime hint (§8.5) is also present is flagged for Ada in §12 — her literal prescription names the error id alone, the contract's §4.2.1 composition rule says hint-then-error, and her ruling governs.
- **Choice groups** (§4.2.8): the error attaches to the group's `<fieldset>`. Group error id: `{groupId}-error`, where `groupId` is the fieldset's stem (e.g. `create-account-type`, `waitlist-channel`). The fieldset carries `aria-describedby` pointing to it; the error line renders directly under the legend, before the options (§5.4). A single required checkbox (Add Your Farm's authorization) is a single control, not a group: its error line sits below its row, describedby on the checkbox itself.

### 2.2 The classes the set adds (all in `globals.css` `@layer components`)

| Class | Role |
|---|---|
| `.field` (existing, extended) | Gains state rules only: `[aria-invalid="true"]`, `:disabled`, and the filled modifier below. Its resting rule does not change by a single computed value |
| `.field-filled` (modifier, never alone) | The filled treatment (§3.4), carried with `.field` — the `.chip-removable` precedent: a modifier class that only ever accompanies its base |
| `.field-hint` | Class-ifies the hint spans forms already render. Sets no family and no size beyond what those spans already compute (§0.3) — the migration is computed-identical; the class exists so the slot has a name the set can point at |
| `.field-error` | The inline error line (§5.1) |
| `.field-summary` | The form-head alert / summary box (§5.3) — one component, two contents (multi-error summary; form-level message) |
| `.field-success` | The success panel (§6) — the `.card` construction plus a headed title row |
| `.field-option` (+ `.field-option-selected`) | Selectable-card dress for weighty choice groups (§3.8) — Report's intent cards, Create's account-type cards. Compact rows do **not** take this class (§3.8) |

No other class is created. In particular there is no `.field-label` — labels are not restyled by this set.

---

## 3. The state set

One line per state, then the full specification. All color values are shipped tokens; all pairs are computed in §9.

> - **Resting** — surface ground, 1px line-strong border, ink value text: the field as it already renders, unchanged.
> - **Hover** — no treatment for text fields, textareas, and selects (deliberate, §3.2); selectable cards take the chip system's hover (leaf-600 border on leaf-50).
> - **Focus** — the global ring, unchanged: 3px focus outline, 2px offset, on every state, composing with — never replacing — the state's own border.
> - **Filled** — border darkens to full ink-soft: the entry reads as written into the ledger; no validity hue is spent on mere presence.
> - **Error** — warn border on the field, warn error line with warning glyph below hint-or-field, summary at the form head when errors are plural or form-level.
> - **Success** — no per-field success dress exists (deliberate, §3.6); success is a headed panel state at the form level, leaf check glyph, card construction.
> - **Disabled** — paper ground, line border, muted value text, muted label: visibly off, still legible, and never used to strand a submission (§7).
> - **Busy** — fields keep their exact resting/filled faces; only the submit control changes, by label and by the loss of its inset edge (§7).
> - **Hint / description** — muted 14px below the field, first in the describedby, unmoving in every state including error.
> - **Checked / selected (choices)** — native mark in leaf via the accent token; selectable cards additionally take the chip system's selected dress (leaf border, leaf-50 ground, leaf semibold label).

### 3.1 Resting

Exactly `.field` as shipped: `background: var(--color-surface)`, `border: 1px solid var(--color-line-strong)`, `border-radius: var(--radius-field)`, `min-height: var(--size-target)`, padding 8px / 12px, sans tool family, value text `color.ink` (14.02:1 on surface — existing pair, not new). The resting border already clears the non-text floor against both grounds a field sits on (line-strong on surface 3.72:1, on paper 3.36:1 — existing pairs, Ada's shipped Tranche 1.3 values). **This design changes no resting computed value on any field.** A set that moved the resting face would be a redesign wearing a state set's clothes.

### 3.2 Hover

Text fields, textareas, and native selects: **no hover treatment, deliberately.** The resting border is already a full-strength, floor-passing boundary — the field does not need a hover to be findable — and a hover border change would fight the two borders that carry meaning (filled, error) on the pointer's behalf. The cursor carries the affordance (`text` over inputs, platform default over selects). Selectable **cards** (§3.8) do take hover, because a card is a control surface, not a field: fine-pointer only, `border-color: var(--color-leaf-600)`, `background: var(--color-leaf-50)`, text stays ink — the `.chip-filter` hover values, reused exactly.

### 3.3 Focus

The global `:focus-visible` treatment, **unchanged and unreplaced**: `outline: 3px solid var(--color-focus)`, `outline-offset: 2px`, corner `radius.bar`. It composes with every state in this set:

- Focus draws *outside* the field's border (outline + offset), so the state border — resting, filled, or error — remains fully visible inside it. Focus + error is therefore a two-ring read: warn border at the field's edge, umber ring 2px beyond it. Both pairs pass independently (§9).
- The ring needs 5px of clear space around the field (3px outline + 2px offset). Field stacks have no clipping ancestor in any §4.3 form (no `overflow: hidden` wraps a field group — verified in the inventory files); §11's rendered proof checks the ring unclipped at 390px on an error field, the tightest composition.
- The two programmatic focus targets this set creates — the summary box (§5.3) and the success heading (§6) — receive the same ring under plain `:focus`, not only `:focus-visible`: they are focused by script after a submit, and their focus must be *seen*, whatever the browser's focus-visible heuristic decides. Same values (3px / 2px / focus token), applied by rules on `.field-summary:focus` and the success heading's tabindex target. Focus ring pairs on the new grounds: on warn-50 7.14:1, on leaf-50 6.75:1, on paper-deep 6.65:1 — all §9.

### 3.4 Filled

A field with a committed value — rendered with one (a default, a prefill), or holding one on blur / after entry — takes the modifier `.field-filled`:

- `border-color: var(--color-ink-soft)` at the same 1px. Every other computed value is the resting value: ground surface, radius field, value text ink. The control does not change size, shape, or position (the in-place visual standard).
- **Feeling call (Iris, in substance):** the three chromatic signals in a form must stay three different *kinds* of signal. Leaf is the living signal (selected, succeeded, on); warn ochre is the taught warning signal; neither may be spent on the neutral fact that a field has something in it. Filled instead borrows the catalog's *ink* register — the same register the Protection notice uses for "a record has been made" (Tranche 2 §3.5): a filled field reads as a line written into the ledger, darker because it is inked, not because it is approved. Value does the work (ink-soft is the darkest warm neutral in the palette), hue does none — which is also why the state survives grayscale and every color-vision deficiency intact.
- Filled is a **content state, not a validity state**, and the design says so in the token file (§4) so no future builder "improves" it into a check mark or a green border. A field returning from error to valid returns to filled (or resting, if emptied) — the error treatment clears whole, it does not convert to a success treatment (§3.6).
- Composition: filled + focus = ink-soft border inside the focus ring. Filled + error is impossible (error replaces filled's border with warn; when the error clears, filled returns if a value remains). Filled + disabled: disabled wins (§3.7).
- Mechanism is the builder's (a class applied wherever the form knows the field has a value — render-time for defaults/prefills, on change/blur for typed entry); the computed values above are the contract. §11 render-proofs filled against resting side by side.

### 3.5 Error

Specified in full in §5. In the state table: field border → `color.warn` 1px (all other field values resting); error line appears (§5.1); summary appears when the contract requires it (§5.3); focus moves per §4.2.2 of the contract. The field's hint does not move, change color, or disappear.

### 3.6 Success — a form-level state, and no per-field success dress

**There is no success treatment for an individual field, and that is a designed decision, not an omission.** §4.2.7 of the contract defines success as a headed confirmation in place — a property of the *form's* outcome, not of any field's validity. A per-field success border (the green-field pattern) would spend leaf — the system's selected/succeeded signal — on every correctly filled field of every long form, teaching visitors that a plain field is somehow unproven and flooding Add Your Farm's 17 fields with validity noise the contract never asks for. The field-level expression of "that was accepted" is simply the error treatment clearing (§3.4).

What success *is*, visually, is specified in §6: a headed panel in the `.card` construction with a leaf check glyph — the dress the site's praised successes (Add Your Farm, the waitlist states) already wear, unified. The verified-status words inside AccountPanel ("verified" in leaf, "not verified yet" in warn, both semibold inline text) are existing rendered treatments that already meet the standard; this set keeps them exactly and does not promote them into a component.

### 3.7 Disabled

For a field that is genuinely unavailable (never for a data-bearing field during a submission — §7):

- Field: `background: var(--color-paper)` (the field's fill steps down to the page ground — the control visibly switches off), `border: 1px solid var(--color-line)`, value text `color.muted`, `cursor: not-allowed`.
- Label: `color.muted`. Hint: unchanged muted — and a disabled field **must** carry its reason in its hint (a design rule of this set: an unexplained disabled field is a defect, whoever builds the form).
- Honesty about the numbers: muted text on paper computes 5.56:1 — it passes the normal-text floor outright, so a disabled field remains fully legible to the older audience. The border (line on paper, 1.30:1) does **not** pass 3:1; disabled components are exempt from the 1.4.11 boundary floor, and the exemption — not a rounding — is what this treatment rests on. It is flagged for Ada's confirmation in §9 / §12, with the fallback stated there (line-strong border, 3.36:1 on paper, if she does not accept the exemption reading). Nothing else in this design rests on an exemption.
- No §4.3 form renders a disabled data field today; this state exists so the first one is designed rather than improvised. (Disabled *options* inside a native select — the "Choose a state" placeholder option — are platform rendering, not this state.)

### 3.8 Checked / selected — choice groups

Two weights of choice, two treatments, per the contract's standing split (§4.2.8):

- **All native radio / checkbox controls in the §4.3 forms** render their checked mark in `color.leaf` via the CSS `accent-color` property, tokenized as `component.field.accent: {color.leaf}`. Today these controls render in each browser's default accent (an off-palette blue on the main engines) — the only place in the public product where a foreign hue appears inside a form. Leaf's checked mark against its adjacencies: on surface 10.42:1, on paper 9.42:1 (§9). The control's size, position, and platform behavior do not change; under forced-colors mode the OS draws the mark, as it should. This is a rendered difference and is registered (D-7, §10).
- **Selectable cards** (weighty choices: Report's intent group; Create's account type — §8.3) take `.field-option`: the `.card` construction they already wear (surface ground, line border, radius card, shadow card), plus —
  - *hover* (fine pointer): §3.2's card hover (leaf-600 border, leaf-50 ground, ink text).
  - *selected* (`.field-option-selected`, applied to the checked option's card): `border-color: var(--color-leaf)`, `background: var(--color-leaf-50)`, the option's label line in `color.leaf` semibold; any hint line inside the card stays `color.muted` (5.08:1 on leaf-50, §9). This is the `.chip-filter` selected dress translated to a card — border + ground + weight, never color alone, and the native radio mark inside the card also checks, so the state has three channels.
  - *focus*: the radio inside the card takes the global ring (§3.3); the card itself is a label, not a focus target.
- **Compact rows** (waitlist channel choice, waitlist finish-step account type, wholesale, the SMS opt-in row, AccountPanel's rows) take **no container dress**: no border, no ground, no padding change, in any state. Their checked signal is the native mark in leaf (above) and their label text stays ink. A compact row that grew a card's dress would re-impose the account burden Item 3.2 exists to remove (§3.2.1 of Nadia's spec: compact rows in that flow, never selectable cards) — the lightness is the point.

### 3.9 Hint / description

- Construction: the `.field-hint` element (§2.2), rendered below its field in the stack (§2), text `color.muted` at the size the form already renders it (14px everywhere it exists today). Pairs: muted on paper 5.56:1, on surface 6.15:1, on paper-deep 5.00:1 — existing pairs, all passing, none created by this design.
- The hint is **load-bearing copy space**, per §4.2.4 of the contract: every rule a field enforces is stated in its hint *as a rule* before any failure. §8's per-form tables name each field where today's hint describes but does not state the rule (the ZIP's 5 digits; Add Your Farm's 10-character About minimum and one-per-line Varieties format) — those hints gain the rule in their text. Wording is Wren's; the obligation and the slot are this design's.
- The hint never changes in any state. In error it stays, in its place, muted, with the error line below it (§2). In disabled it carries the reason (§3.7). A form may not hide, recolor, or replace a hint to make room for an error — that swap is the exact failure §4.2.1's describedby composition exists to prevent.

### 3.10 Labels and requiredness — deliberately unchanged

Labels keep their elements, words, and rendered type (§0.3). The optionality convention stays as shipped: fields are required unless the label says "(optional)" in muted regular weight (Add Your Farm's `opt()` pattern); no asterisk system is introduced, no required-field legend is added. Requiredness is carried by the native `required` attribute, by hint-stated rules (§3.9), and by error copy that names the fix (§4.2.5 of the contract). Introducing asterisks across seven forms would be the largest rendered change in this item and no finding asks for it; it is recorded here as considered-and-kept, not overlooked.

### 3.11 Placeholder text

Fields that carry a placeholder (the URL fields' `https://` and handle examples) render it in `color.muted` on the field's surface ground (6.15:1, §9) via `.field::placeholder`. Today the placeholder renders in each browser's default gray — an unnamed, uncomputed value inside a named system. Muted is the hint tone, which is what a placeholder is: a hint that lives inside the field until typing replaces it. No placeholder text changes; no field gains or loses a placeholder.

---

## 4. Component tokens (normative — the `tokens.json` additions)

All tokens below are **component tokens** in the DTCG file (`component.field.*`), referencing the shipped reference tokens by alias — the Tranche 2 file's own convention. **No new CSS variable in `@theme` is required**: the `globals.css` state rules consume the existing color/radius variables directly, exactly as `.chip-filter`'s state rules do. The token-sync test's discipline applies unchanged: a value in this table and a different value in CSS is a build failure.

| DTCG token | Value (alias) | Role / usage rule |
|---|---|---|
| `component.field.border.resting` | `{color.line-strong}` | Resting border. Already the rendered value; tokenized by this set |
| `component.field.border.filled` | `{color.ink-soft}` | Filled only (§3.4). Never a validity signal |
| `component.field.border.error` | `{color.warn}` | Error only (§5.2). Full strength — never an alpha blend (§5.2 gives the computed reason) |
| `component.field.border.disabled` | `{color.line}` | Disabled only (§3.7); rests on the disabled exemption, flagged for Ada (§9) |
| `component.field.background` | `{color.surface}` | Resting / filled / error ground |
| `component.field.background.disabled` | `{color.paper}` | Disabled ground |
| `component.field.text` | `{color.ink}` | Value text, all non-disabled states |
| `component.field.text.disabled` | `{color.muted}` | Disabled value text and disabled label color |
| `component.field.hint.color` | `{color.muted}` | Hint / description text (§3.9) |
| `component.field.placeholder.color` | `{color.muted}` | Placeholder text (§3.11) |
| `component.field.accent` | `{color.leaf}` | Native radio/checkbox checked mark (§3.8) |
| `component.field.error.color` | `{color.warn}` | Error line text and glyph (§5.1) |
| `component.field.error.icon-size` | `16px` | Warning glyph rendered size (§5.1) |
| `component.field.error.gap` | `6px` | Glyph-to-text gap in the error line (the admin line's shipped value) |
| `component.field.summary.background` | `{color.warn-50}` | Summary / form-alert box ground (§5.3) |
| `component.field.summary.border` | `{color.line-strong}` | Summary box border (the admin box's shipped value) |
| `component.field.summary.radius` | `{radius.control}` | 12px (the admin box's shipped radius) |
| `component.field.summary.padding` | `16px` (`space.16`) | Summary box padding (the admin box's shipped `p-4`) |
| `component.field.summary.heading.color` | `{color.warn}` | Summary heading text (§5.3) |
| `component.field.success.icon.color` | `{color.leaf}` | Success check glyph (§6) |
| `component.field.success.icon-size` | `20px` | Success glyph rendered size (§6) |
| `component.field.option.hover.border` | `{color.leaf-600}` | Selectable-card hover (§3.8) — the chip hover value |
| `component.field.option.selected.border` | `{color.leaf}` | Selectable-card selected border (§3.8) — the chip selected value |
| `component.field.option.selected.background` | `{color.leaf-50}` | Selectable-card selected ground |
| `component.field.option.selected.text` | `{color.leaf}` | Selectable-card selected label line |
| `component.code-entry.width` | `176px` (`11rem`) | CodeEntry field max-width (§8.5) — widened from today's 144px for the spaced-paste case, with the arithmetic in §8.5 |

State-rule mechanics for `globals.css` (computed values normative, selector shape the builder's within these rules): the error border applies under `.field[aria-invalid="true"]` — keyed to the accessibility attribute itself, so the visual state and the programmatic state can never drift apart (a field cannot look invalid without being announced invalid, or the reverse). The filled treatment applies under `.field-filled`. Disabled applies under `.field:disabled`. Border-color transitions, where a builder adds them, use the system's shipped 160ms ease-out (the chip/button transition value); no new duration or easing token is created, and under `prefers-reduced-motion` the global rule already collapses transitions.

---

## 5. Error treatment (full specification)

### 5.1 The inline error line (`.field-error`)

The admin `FieldErrorLine`, translated (§0.1). Construction, complete:

- Element: a `<p>` carrying the error id (§2.1), placed in the field stack below the hint (§2). It carries **no** `role` — announcement comes from the focus move and the summary where one exists (the admin line's exact discipline; a line that also announced itself would double-announce beside the summary).
- Layout: flex row, align start, gap 6px (`component.field.error.gap`). Text: sans, 14px / 20px, regular weight, `color.warn`. Regular, not medium: warn on its grounds passes at full strength without weight (§9), and the admin line — the pattern being ported — is regular.
- Text content: the field's mapped message (§4.2.5 of the contract — names the subject in the visitor's words, states the problem, states the fix). Where a summary also exists, the summary entry for this field is **character-identical** to this line's text (§4.2.2 of the contract) — one string, two renderings, never a paraphrase.
- The line appears and disappears whole with the error state; it is never rendered empty as a spacer, and no space is reserved for it at rest. A form growing downward by one 20px line (plus 4px gap) under the failing field is the accepted, standard behavior (the GOV.UK pattern the contract cites); reserving permanent empty slots under every field would tax every correct form for an error most never show.

### 5.2 The error border — and why it is full-strength warn

- The invalid field's border becomes `1px solid var(--color-warn)`. Thickness does not change (1px in every state), so the field's box does not move by a pixel when the state lands.
- **Full strength, never a blend.** The badge family's alpha-blend borders (Tranche 2 §3.2) were the obvious candidate language, and they fail here, computed: warn blended at 75% over surface gives a border at 3.36:1 against its own ground but only **3.04:1** against the paper a form actually sits on; at 70% it falls to **2.76:1** against paper — below the 3:1 non-text floor against one of its two adjacencies. A field border touches two grounds (its own surface fill inside, the page ground outside) and must pass against both. Full-strength warn passes both outright: 5.60:1 on surface, 5.06:1 on paper (§9). The badge blends survive because a badge border touches one ground; a field border touches two. Same system, different geometry, different answer — stated here so the inconsistency reads as arithmetic, not taste.
- **Why the public set has an error border when the admin sheets do not.** Nadia's §4.4 names "error border tone" as one of the new treatments this design is expected to introduce — the public set was commissioned with it in view. The substantive reason: an admin sheet is a bounded panel Dustin works in daily, where the summary sits at the sheet's head in his eyeline; a public form is a long page a first-time visitor may be partway down, on a phone, where the single-error case has *no* summary (contract §4.2.2) and focus lands on a field that must identify itself as the problem at a glance, in bright outdoor light, before a word is read. Border + glyph + text is three channels; the admin makes do with two inside its smaller room. The divergence is deliberate, bounded to this one treatment, and flagged to Ada with the rest of §9.

### 5.3 The summary box (`.field-summary`)

One component, the form-head box, with two contents. Construction (the admin summary box's values, §0.1):

- Box: `background: var(--color-warn-50)`, `border: 1px solid var(--color-line-strong)`, `border-radius: var(--radius-control)`, padding 16px. Placement: the first element inside the form, before the first field group. It renders only when it has content; it is never an empty frame.
- Focus: the box carries `tabIndex={-1}` and receives focus in the cases §4.2.2 / §5.3.1 assign it; its focused ring is §3.3's programmatic-target rule.
- **Content A — the multi-error summary** (two or more field errors; contract §4.2.2): a heading line — warning glyph (§5.5) at 16px + a semibold sans 16px heading in `color.warn` (wording Wren's; the admin's construction is "Some fields need attention before saving." — the public heading follows that construction with the form's own verb) — then the entry list, 8px below the heading, entries 4px apart: each entry is a link, sans 14px, `color.link`, underlined (hover `color.leaf` — the global link hover), whose text is character-identical to the field's inline message and whose activation moves focus to that field (an anchor to the field's id, per the admin box's shipped mechanism). The box carries `role="alert"` (the admin box's role).
- **Content B — the form-level message** (a failure that belongs to no field: a Turnstile failure, a connection failure, a server refusal the mapping assigns to the form): the same box, heading line only — glyph + the mapped message itself as the heading text — `role="alert"`, focus moves to the box. This replaces today's form-level `role="alert"` paragraph after the submit button on every §4.3 form: the message moves to the form's head, where the contract's focus discipline puts the visitor's eye first. Registered as D-5 (§10).
- **The single-field-error case has no box** (contract §4.2.2): focus goes to the field, the inline line is the whole treatment. A form-level message *plus* field errors shows Content A with the form-level message as its heading (the admin box's exact composition: `formError ??` the generic heading).

### 5.4 Group errors

Per §2.1: the error line (`.field-error`, identical construction) renders directly under the group's legend, inside the fieldset, before the options. No border is drawn around the group, and no option card or row changes dress — for card groups, drawing warn borders around every card would shout; the line, the describedby, and focus to the group's first control (the contract's focus rule for groups) carry it. When the group also appears in a summary, its entry's text is identical to the group line's text, and activating the entry focuses the group's first control.

### 5.5 Iconography — the warning glyph

- Subject: a warning triangle containing an exclamation mark — the same subject the admin line carries, so the two dialects read as one system's mark.
- Drawing: to the **public** icon family's rules (the `icons.tsx` discipline: 24px grid, 20px live area, stroke 1.8, `currentColor`, no fill), *not* a copy of the admin glyph's path — the admin's is a privately inlined 16px-grid filled path (F-10's lone admin glyph), a different hand. Same subject, same rendered size, same color, same placement; each surface's family hand. It lives in `v2/components/layout/icons.tsx` with the family, named `FieldErrorIcon`, rendered at 16px, `aria-hidden="true"`, `focusable="false"`, aligned to the error text's first line with a 2px top offset (the admin line's shipped optical alignment).
- The glyph is a **redundant channel**: the word "error" is never carried by it — the message text names the problem in words, the border marks the field, the glyph marks the line. As a graphic it computes 5.60:1 on surface / 5.06:1 on paper against the 3:1 floor (§9).
- Fallback (the ProtectionIcon precedent, Tranche 2 §3.5): if the drawn glyph fails Quinn's visual check against the family hand, the set ships **without** the glyph rather than with a borrowed or filled one — text + border pass every floor alone; the glyph is finish, not function.
- No other icon appears in the error treatment. In particular: no icon inside the field, no icon on the summary entries (the heading's glyph is the box's one mark), and no emoji anywhere.

### 5.6 Error state under platform stress

- **Forced-colors mode:** borders are real borders (resting, filled, error, summary, selected) and survive as system borders; grounds may be remapped by the OS. The error state still reads: `aria-invalid` is programmatic, the message is text, the glyph is decoration. Pass condition is the Tranche 2 protection-notice condition: message legible, field boundary present, state identifiable without color.
- **200% text resize:** the error line and summary are growing text blocks with no fixed height anywhere in the set; nothing clips. The field's 44px is a *minimum* height.
- **Reduced motion:** the set introduces no motion. Border-color transitions, if built, are collapsed by the global reduced-motion rule.

---

## 6. Success treatment (`.field-success`)

The form-level success state, unified from the successes the audit already praised (§4.2.7 of the contract: the existing praised successes are the standard; the rest are brought to it).

- Container: the `.card` construction the praised successes already wear — surface ground, line border, radius card (18px), shadow card — with padding 16px and an internal stack gap of 8px (Add Your Farm's shipped success geometry). Class `.field-success` names the composition; computed values are the card's, unchanged.
- Title row: a check glyph + the success heading. The glyph: a check inside a circle outline, drawn to the public family rules (24px grid, stroke 1.8, `currentColor`), named `FieldSuccessIcon` in `icons.tsx`, rendered at 20px in `color.leaf`, `aria-hidden` — the label text carries the meaning alone, and as a graphic it computes 10.42:1 on the panel's surface ground (§9). It is **not** the Protection seal (shield + check): that glyph belongs to a legal claim and is never reused as a generic check. Fallback, same precedent as §5.5: if the glyph fails Quinn's family check, ship the panel without it.
- Heading: the form's existing success lead, at its existing rendered size and wording (Add Your Farm's 18px semibold lead is the reference; the waitlist's celebration heading keeps its own larger leaf treatment — §8.6 — because that state machine is the site's best and is not redesigned). Where a form's success today has **no** heading (Report's single status paragraph), the existing sentence becomes the heading — its words do not change — and the panel gains the title row. Registered as D-6 (§10).
- Body: what happens next and when, in the form's existing body text (unchanged values). Then the way back or onward, where the form has one (Add Your Farm's "Browse the sellers already listed" stands as the model). The one form whose success has neither body nor onward today is Report; §8.1 specifies its onward slot and §12 flags its destination for Nadia's confirmation.
- Focus and announcement: the panel's heading carries `tabIndex={-1}` and receives focus on success, per the waitlist's existing discipline (focus moves only after a user action in this session, never on load) — with §3.3's programmatic ring. The panel carries `role="status"` where it replaces the form in place (Add Your Farm's shipped pattern).
- Sign-in is the named exception: its success is a navigation to `/account`, whose page heading is the headed post-submit state (the BusyForm criteria's accepted alternative, §4.2.6 of the contract). No success panel is designed for it, and none should be interposed before the navigation.

---

## 7. Busy and disabled-submit treatment

The visual half of §4.2.6 of the contract (the BusyForm criteria, adopted there as gate-checked properties):

- **Fields never change face during a submission.** No fieldset of data-bearing controls is disabled, greyed, faded, or remounted while a submit is in flight — not as a "busy look," not briefly. Entered data stays editable-visible at its resting or filled treatment for the whole flight (§4.2.6: "greyed is a treatment; gone is a breach" — this set goes one step further and designs *no* grey: the visitor's words stay exactly as they left them).
- **The form exposes busy programmatically**: `aria-busy="true"` on the form element for the flight's duration (the shipped BusyForm pattern), removed on resolution.
- **The submit control is the only element that changes**, and it changes in exactly three ways:
  1. Its label swaps to the form's busy verb — the verbs already shipped, kept verbatim per form ("Sending…", "Creating…", "Signing in…", "Joining…", the admin pattern's "Saving…"). The label swap is the busy state's primary *visual* signal, as it already is across the product (the audit found this pattern consistent and honest; this set keeps it and designs around it rather than inventing a spinner the product has never had).
  2. It becomes disabled (the submit control only — disabled controls are excluded from submission data, which is precisely why the prohibition in the first bullet exists for every *other* control).
  3. Its letterpress edge comes off: `.btn-primary:disabled` loses `shadow.button-inset`. The ground does **not** change — leaf stays leaf, and the white-on-leaf pair stays at its recorded 10.60:1 (§9) — because a faded or greyed primary would drop a computed pair this set has promised to hold, and would teach "grey = broken" for what is a one-second wait. State is carried by label + disabled semantics + the lost edge, not by a color failure.
- **Disabled buttons generally** (`.btn:disabled`, `.btn-secondary:disabled` — action buttons disabled by a shared busy flag, CodeEntry's buttons in flight): same rule — colors hold at their resting computed values, inset edge off on primary, `cursor: not-allowed`. No opacity reduction anywhere in this set, on any control, in any state.
- **Focus is never dropped.** If the focused control is the submit and it disables, focus handling is the contract's (§4.2.6: never to `<body>` without a destination); visually, the resolved state — error summary, error field, or success heading — is a §3.3 ring target, so the visitor's eye is never left on an unmarked page.
- CodeEntry's in-flight treatment is specified with its component in §8.5.

---

## 8. Per-form application — the §4.3 inventory, complete

Every public form in the inventory, on the set. "Error slot" means the §2 stack position and §2.1 ids for that field; every field named below gets one whether or not it can fail today — a slot that exists only for fields someone remembered to wire is how A4 happened.

### 8.1 Report a problem — `v2/components/report/ReportForm.tsx`

| Element | Application |
|---|---|
| Intent group (fieldset, "What would you like to do?") | Selectable **cards** (§3.8): the three `.card` labels take `.field-option`; the checked intent's card takes `.field-option-selected`. Group error line under the legend (§5.4) if the group ever fails server-side |
| About (native select, `target_type`) | `.field` — its longhand field classes are **retired** (F-22, contract §4.2.9): the select consumes `.field` and its states like every other field. Native behavior unchanged |
| Variety/seller slug (`target_ref`) | `.field` (longhand retired). Stack gap 8px → 4px (§2) |
| Message (textarea) | `.field` (longhand retired) |
| Contact email | `.field` (longhand retired) |
| Form-level failures (incl. the Turnstile-pending message) | `.field-summary` Content B at the form head (§5.3), replacing the after-submit paragraph |
| Success | `.field-success` (§6): today's single status sentence becomes the heading (words unchanged); onward slot: a link back to the page the report was about — the form already holds `target_type` / `target_ref` as props. **Destination flagged for Nadia's confirmation, §12** |

After this item, ReportForm contains no hand-rolled field class string (contract §4.2.9's grep-zero rule).

### 8.2 Add Your Farm — `v2/components/farm/AddYourFarmForm.tsx`

The longest form, and the set's stress test. Its `field()` helper already builds the §2 stack (label / field / hint with `{id}-hint` ids); the set adds the error slot to the same helper, so all 17 fields inherit the treatment from one place:

- Fields: farm name, city, state (native select), website, business phone, about, varieties, contact name, contact email, Google Business Profile link, Instagram, TikTok, Facebook, notes — each `.field` + error slot; prefilled fields (contact name/email from defaults) render `.field-filled` at rest, correctly announcing themselves as already written in.
- **Hint-stated rules (§3.9 obligations):** *About* — its hint must state the 10-character minimum as a rule (today it describes: "A few sentences…"); *Varieties* — its hint already gives the one-per-line format; it is restated as the rule the validation enforces (U6.2's two live cases, closed here). Website and business phone hints stand as they are.
- Wholesale group (fieldset, compact rows): no container dress (§3.8); group error under its legend if it ever fails.
- Authorization checkbox (single required control): error line below its row, describedby on the checkbox (§2.1).
- Form-level failures: `.field-summary` Content B. (Its mapping layer already exists — Tranche 1.5 — and is untouched; this item gives its form-level messages the box, and its field-level messages somewhere to go.)
- Success: the shipped card becomes `.field-success` — glyph + title row added; heading, body, and onward link wording unchanged.

### 8.3 Create account — `v2/components/account/CreateAccountForm.tsx` + `SignupFields.tsx`

- Name, email: `.field` + error slot. Phone: hint stands ("US number. Your email + phone are how you sign in…"); error slot below the hint. ZIP: its hint **gains the rule** — the 5-digit requirement stated in the hint text (§3.9; today the hint explains the zone and never states the format the `pattern` enforces — a §4.2.4 breach this item closes). Wording is Wren's; "5-digit" must appear in it (the contract's own example).
- **Account type group becomes selectable cards.** The contract's split ruling (§4.2.8) names account type at create as a card-weight choice, but `SignupFields` renders it today as compact rows. Under this set, the create context renders the two options as `.field-option` cards (the farm-owner card carries its existing explanation text as its in-card hint, muted; selected dress per §3.8). This is a rendered difference, registered as D-8 (§10). The waitlist finish step (§8.6) renders the same group as compact rows — the ruling's other half — so `SignupFields` gains a presentation variant by context; the fields, names, values, and default do not change.
- SMS opt-in does not appear on this form (waitlist contexts only) — unchanged.
- Form-level failures (raw API copy today): mapped per §4.2.5 of the contract + `.field-summary` Content B.
- Success: the shipped code-step card takes `.field-success` dress for its head (glyph + its existing "Your account is ready and you're signed in." as heading); the CodeEntry inside it is §8.5; the skip link stands as the onward.

### 8.4 Sign in — `v2/components/account/SignInForm.tsx`

- Email, phone: `.field` + error slot + stack as §2 (its stacks already match).
- **Credential failure is a form-level error, by design.** A failed sign-in must not disclose which half of the email + phone pair failed — attaching that failure to the email field or the phone field would leak exactly that. So: format and empty-field failures (the visitor's own fixable, per-field facts) render as field errors; the pair-mismatch failure renders as `.field-summary` Content B with the mapped, pair-neutral message. This is a presentation rule with a security reason, stated here so no builder "helpfully" fields it later.
- Success: navigation (§6's named exception). No panel.

### 8.5 Code entry — `v2/components/account/CodeEntry.tsx` (the component touch: W-2 + U7.1 + U7.2)

One component, every context it serves — on `origin/main` its consumers are the waitlist block, the create-account code step, and the account panel (email and phone instances). Per §4.2.10 the treatment also travels to the admin sign-in code context by consumption; §12 records a code-truth note about that page for Nadia. The touch, complete:

| Aspect | Specification |
|---|---|
| Association (W-2, Ada's exact prescription) | On failure: the input carries `aria-invalid="true"` and `aria-describedby` pointing to the error paragraph, which carries `id="{idPrefix}-code-error"` — her words, her ids, verbatim. Describedby composition with the lifetime hint: §12 flags it for her ruling (contract §4.2.1's hint-then-error vs her literal error-only string) |
| Error line | The §5.1 line (`.field-error`, glyph + mapped text), replacing today's `role="alert"` paragraph after the buttons. The line sits in the component's stack below the hint (below) |
| Lifetime copy (U7.1) | A `.field-hint` line in the stack, below the input row: it states the code's lifetime, following the admin code page's construction ("It works for {N} minutes."). **The number is rendered from the shared TTL constant the code service already uses** (`CODE_TTL_MINUTES`, 30 today — the same constant the admin page renders as its TTL), never a typed numeral in the component, so the copy cannot drift from the code's real life. Present in every context, at rest, not only after a failure |
| Paste with spaces (U7.2) | The `maxLength={6}` attribute is **removed** — no length cap on the input at all. A pasted spaced code ("123 456", "1 2 3 4 5 6") enters whole and is stripped on submit, as the existing handler already strips. Nothing truncates before the strip |
| Width for the spaced case | `max-w-[9rem]` (144px) → the `component.code-entry.width` token, 176px (`11rem`). Arithmetic: the field renders mono at the inherited 17px with 0.2em tracking ≈ 13.6px per glyph; the widest spaced form, 11 glyphs ("1 2 3 4 5 6"), needs ≈ 150px + 24px field padding = 174px ≤ 176px — every digit of a spaced paste stays visible. A plain 6-digit code leaves the extra width empty; the field does not stretch to it (max-width, as today). Registered as D-9 (§10) |
| Kept exactly | `font-mono` + `tracking-[0.2em]` dress, `inputMode="numeric"`, `autoComplete="one-time-code"`, the two-button row, the delivery-note slot (`role="status"`) above the label |
| Busy | Verify and Send a new code both disable in flight (today's behavior). Exposure per §7: the Verify button's label swaps to "Verifying…" while a verification is in flight (new, registered as D-10); a resend's exposure is its result landing in the note slot (`role="status"`) — the announcement channel the component already owns — with its button disabled during the flight |
| Verified | Verification hands off to the parent's success state (the waitlist's States A–D, create's redirect, the panel's status line) — CodeEntry grows no success dress of its own |

### 8.6 Waitlist — `v2/components/variety/WaitlistBlock.tsx`, as rebuilt by Item 3.2

Designed against Nadia's §3 target contract (the form the 3.3 build will meet when 3.2 builds last, per her §9 sequence):

- **Alert step:** Email — `.field` + error slot, on the block's card ground (surface; all §9 pairs computed for it). Channel group — fieldset ("How should we tell you?"), **compact rows** (§3.8: no container dress; native marks in leaf), rows ≥44px tall, label-clickable (Nadia §3.5). Phone (revealed by the text channel) — `.field` + its existing explanation as its hint (the "Your email + phone are how you sign in" text travels with the rebuilt flow) + the SMS consent copy beside the channel choice it describes; error slot below the hint. The phone field's appearance changes no other treatment; focus never moves on reveal (Nadia §3.2.2).
- **Recognized-contact state:** CodeEntry in-block, §8.5 in full — the block's copy transition is Nadia's §3.2.4; the code field's dress, association, lifetime line, and paste behavior are this set's, identical to every other context. No second code treatment is built for the waitlist (Nadia §3.5's sequence rule).
- **Finish-your-account step:** name, ZIP (hint states the 5-digit rule, §8.3's ZIP treatment), account type as **compact rows** (§8.3's ruling) — all `.field` + error slots, inside a dismissible step that is visually subordinate to the success state above it: it takes no `.field-success` dress and no card of its own beyond the next-step card it lives in (Nadia §3.2.5 places it in that card's area). Its optionality is stated in its heading copy (Wren's); the set adds no "optional" badge or muted demotion beyond that — a step that looks disabled would read as broken, and §3.7's dress is reserved for actual disabled controls.
- **No-JS floor form (§3.4 of Nadia's spec):** the same fields, server-rendered. When a plain-POST submission fails, the re-rendered page carries the same treatments server-side — error borders via `aria-invalid`, error lines with their ids, the summary box at the form's head for multiple errors — because the set is computed values and ids, not client behavior. A floor error state that looked different from the enhanced one would be a second dialect; it is designed as the same one. (Quinn's amended check 3.2-G drives exactly this.)
- **Success states A–D:** unchanged. Nadia §3.1 records them as the best state design on the site; this set touches none of their dress, headings, or focus discipline, and §11 regression-checks them as untouched.

### 8.7 Account panel actions — `v2/components/account/AccountPanel.tsx` + siblings

The panel's inline forms, one by one:

- **Change email:** email `.field` + error slot (its explanatory line below — "A new address needs its own 6-digit code…" — is a hint by construction and takes `.field-hint` placement in the stack). Its CodeEntry follow-on is §8.5. The verified / not-verified status words keep their existing leaf / warn semibold dress (§3.6).
- **Alert phone:** phone `.field` + error slot; its "Starts as your account phone…" line takes the hint slot. SMS opt-in checkbox row: compact row (§3.8), error (if the group ever fails) below the row. Its CodeEntry follow-on is §8.5.
- **Preferences (alerts on/off toggle):** a button action, not a data form — the panel's status line remains its feedback, unchanged. It takes no field treatment and its `aria-pressed` dress is the button system's, untouched.
- **Delete account:** the confirm form's text field ("Type DELETE to confirm") is a field in this set: `.field` + error slot. Its known failure — a confirmation typed wrong — is a **field** error under this set ("Type DELETE (in capitals) to confirm." becomes the field's mapped inline message, focus to the field), replacing today's routing of that message to the panel-head line. Server failures on delete remain form-level: they render in a `.field-summary` Content B box *inside the delete form*, not at the panel head. The ConfirmDialog discipline the delete flow already follows is Nadia's record and is not redesigned; the danger button's dress is the button system's (`.btn-danger`), untouched.
- **Panel-head message line:** what remains on it after this item is only the non-field actions' feedback (leave-a-list confirmations, preferences confirmations, sign-out-adjacent statuses) in its current dress (`role="status"` / `role="alert"` paragraph, warn for alerts). Field-tied messages no longer route there from any sub-form — that rerouting is the panel's whole change under this item, registered as D-11 (§10).

### 8.8 What does not move

For the avoidance of doubt: no label's words, no field's name / type / `autoComplete` / `inputMode`, no form's field order, no submit button's resting dress, no success wording, and no admin form's anything. `SignupFields` keeps its props and its body-building helper; it gains a presentation variant (§8.3) and error slots, nothing else.

---

## 9. Contrast pairs handed to Ada (computed, hers to rule)

Method: WCAG relative luminance, unrounded values decide; I computed every value below from the shipped hexes for this design (not copied from audits). Floors: 4.5:1 normal text, 3:1 non-text (boundaries, meaningful graphics, focus). **Status of this table: my computations, offered for Ada's sign-off under §4.4 of Nadia's spec. Her ruling governs; if she fails a pair, the fix is the nearest passing value of the same color, proposed by her — this design does not pre-propose alternates for any pair except the one flagged exemption in row 14, where the fallback is stated.**

| # | Pair (foreground on ground) | Where it occurs | Computes | Floor | My verdict |
|---|---|---|---|---|---|
| 1 | `warn` #8A5E08 on `surface` #FFFDF6 | Error text, error glyph, error border (vs field fill) — card-ground forms | **5.5988:1** | 4.5 text / 3 non-text | Pass |
| 2 | `warn` on `paper` #F8F1E1 | Same, page-ground forms (Report, Add Your Farm, account forms) | **5.0636:1** | 4.5 / 3 | Pass |
| 3 | `warn` on `paper-deep` #F0E5CB | Same treatments if a form ever renders on a recessed band — no §4.3 form is known to today; computed because the components are portable | **4.5520:1** | 4.5 / 3 | Pass — **closest text pair in the set (margin 0.052)**; flagged for Ada's particular attention |
| 4 | `warn` border on `paper` (outer adjacency) | Error border against the page outside the field | **5.0636:1** | 3 | Pass |
| 5 | `line-strong` #91825C on `warn-50` #F7EDD3 | Summary box border vs its own ground | **3.2440:1** | 3 | Pass |
| 6 | `line-strong` on `paper` / on `surface` | Summary box border vs the ground it sits on | **3.3613:1 / 3.7166:1** | 3 | Pass |
| 7 | `warn` on `warn-50` | Summary heading text | **4.8868:1** | 4.5 | Pass |
| 8 | `link` #1F5C3D on `warn-50`; hover `leaf` #1E4634 on `warn-50` | Summary entry links | **6.7793:1 / 9.0916:1** | 4.5 | Pass |
| 9 | `ink-soft` #4A4438 on `surface`; on `paper` | Filled border (vs field fill; vs page) | **9.4858:1 / 8.5791:1** | 3 | Pass |
| 10 | `leaf` on `leaf-50` #E3EAD8 | Selected card border vs its ground; selected label text | **8.5957:1** | 3 / 4.5 | Pass |
| 11 | `muted` #6A5F4C on `leaf-50` | In-card hint line on a selected card | **5.0765:1** | 4.5 | Pass |
| 12 | `leaf-600` #2E6B4F on `leaf-50`; `ink` on `leaf-50` | Card hover border vs its ground; card text on hover ground | **5.1099:1 / 11.5701:1** | 3 / 4.5 | Pass |
| 13 | `leaf` on `surface`; on `paper` | Native checked mark (accent) against field/page grounds | **10.4162:1 / 9.4205:1** | 3 | Pass |
| 14 | `muted` on `paper`; `line` #E0D5B8 on `paper` | Disabled value text + label; disabled border | **5.5636:1 / 1.2977:1** | 4.5 (passes outright) / 3 — **border rests on the disabled-component exemption from 1.4.11** | Text passes; **border flagged for Ada's ruling on the exemption** — fallback if she declines it: `line-strong` border (3.3613:1 on paper), one token value changes, nothing else in §3.7 moves |
| 15 | `focus` #7A3E10 on `warn-50` / `leaf-50` / `paper-deep` | Programmatic focus ring on the summary box; card focus inside selected grounds; ring on recessed bands | **7.1350:1 / 6.7459:1 / 6.6461:1** | 3 | Pass (ring on paper 7.3932:1 and surface 8.1745:1 are existing recorded pairs) |
| 16 | `leaf` on `surface`; `ink` on `surface` | Success glyph (graphic); success heading (existing pair) | **10.4162:1 / 14.0205:1** | 3 / 4.5 | Pass |
| 17 | `muted` on `surface` | Placeholder text; CodeEntry lifetime hint on card grounds (on paper: 5.5636:1, row 14) | **6.1516:1** | 4.5 | Pass |
| 18 | White #FFFFFF on `leaf` | Busy / disabled primary submit — the resting pair, deliberately **held** by §7 (no fade, no grey) | **10.6015:1** | 4.5 | Pass, unchanged from today |

Pairs this design does **not** create and does not touch: every resting pair (§3.1), the badge/chip pairs (Tranche 2 §3.2 / §4.2), the focus ring's existing grounds (row 15's last clause). If the build's CSS produces a pair not in this table and not in that sentence, it is a new pair — it goes back to Ada before it ships, not after.

---

## 10. Change register — the complete list of rendered differences this design would introduce

The 3.3 build is correct on rendering if and only if a before/after comparison shows **these differences and no others** (read with Nadia's B-10, which this register itemizes — B-10 is the tranche-level entry; D-1…D-12 are its complete expansion for the field set):

| ID | Change | Where |
|---|---|---|
| D-1 | Fields in the error state gain a 1px warn border; an inline error line (glyph + sans 14px warn text) appears below hint-or-field on failed fields | All §4.3 forms |
| D-2 | Filled fields' borders darken from line-strong to ink-soft | All §4.3 forms, fields holding a value |
| D-3 | A summary box (warn-50 ground, line-strong border, 12px radius, 16px padding) appears at the form head on multi-error failures | All §4.3 forms |
| D-4 | Hint texts gain their enforced rules as stated text (ZIP "5-digit"; Add Your Farm About minimum and Varieties format restated as rules); CodeEntry gains a lifetime hint line | SignupFields ZIP (create + waitlist finish step), AddYourFarmForm, CodeEntry (all contexts) |
| D-5 | Form-level error messages move from an after-submit paragraph to the §5.3 box at the form head; AccountPanel field-tied messages move inline (D-11) | All §4.3 forms |
| D-6 | Success states gain the §6 title row (leaf check glyph + existing heading); Report's success gains the panel construction and an onward link (§8.1, §12) | Report, Add Your Farm, Create (code-step head). The waitlist's success States A–D are untouched (§8.6) |
| D-7 | Native radio/checkbox checked marks render in leaf instead of the browser default accent | All §4.3 forms' choice controls |
| D-8 | Create's account-type group renders as selectable cards; checked cards (there and in Report's intent group) gain the leaf selected dress; card hover gains the leaf-600 / leaf-50 treatment | CreateAccountForm (via SignupFields create context), ReportForm intent group |
| D-9 | CodeEntry's field max-width grows 144px → 176px; its `maxLength` cap is removed (no visible change until a spaced code is pasted, when all digits now stay visible) | CodeEntry, all contexts |
| D-10 | CodeEntry's Verify button reads "Verifying…" during a verification flight; busy submits across the set lose the primary button's inset edge (ground and label colors unchanged) | CodeEntry; all §4.3 forms' submit buttons |
| D-11 | AccountPanel: change-email, alert-phone, and delete-confirm failures render inline at their fields (delete's server failures in a box inside the delete form); the panel-head line keeps only non-field actions' feedback | AccountPanel |
| D-12 | ReportForm's four longhand fields consume `.field` (computed values identical except its field-stack gaps tighten 8px → 4px); placeholder text across the set renders in muted instead of the browser default gray | ReportForm; URL/handle fields with placeholders |

Everything else — every label, hint (except D-4's named additions), field geometry at rest, button resting dress, success wording, waitlist success states, and the entire admin — renders as on pre-build `origin/main`. In particular: no resting computed value changes (§3.1), no type value changes (§0.3), and Tranche 2's token values are untouched (§4 adds component tokens that alias them).

---

## 11. Acceptance checks — for Quinn's gate (all executable)

Run in a fresh scratch worktree per the standing gate approval, against the build and against pre-build `origin/main` for every before/after comparison. Real-browser drives are usability gates: drive the built forms as a visitor with a goal, at 390px first, then 820px and 1280px. **States a test would otherwise only string-assert are render-proofed here** — a check that reads classes where a screenshot can be taken is marked as insufficient in its own text.

**The set, as a system**

- **3.3-V1 (resting equality):** computed `background`, `border`, `border-radius`, `min-height`, `padding`, and value-text color of one `.field` per §4.3 form are identical before/after at 390px. Any resting difference outside §10 is a FAIL.
- **3.3-V2 (error, rendered — the core visual check):** on Add Your Farm at 390px, submit with two invalid fields and screenshot the result: the summary box renders at the form head with its ring on it (focus is on the box); each invalid field shows a full-strength warn border and an error line with glyph below its hint; valid fields show neither. Repeat with exactly one invalid field: no box, focus on the field, its ring fully visible and unclipped in the screenshot (not inferred from classes). Repeat the one-error drive on Report and on the waitlist alert step (email only).
- **3.3-V3 (filled vs resting, rendered):** on Create, screenshot the empty form, then type into Name and blur: the field's border computes to ink-soft while Email's stays line-strong, and neither field's box has moved (same bounding rects as at rest). Prefill case: Add Your Farm with defaults shows its contact fields filled-dressed on first paint.
- **3.3-V4 (choice dress, rendered):** on Report, select each intent in turn: the checked card computes leaf border / leaf-50 ground / leaf semibold label, the radio mark renders leaf, and the other cards are untouched; keyboard-focus the radio — the ring renders on the control. On the compact rows — the waitlist channel group, Add Your Farm's wholesale group, the SMS opt-in rows: no container dress appears in any state (computed background stays transparent) — the compact-row lightness is checked, not assumed.
- **3.3-V5 (cards for account type):** Create's account type renders as two cards with the §3.8 dress; the waitlist finish step renders the same group as compact rows. Both keep identical names, values, and defaults (form-data comparison on submit).
- **3.3-V6 (busy, rendered mid-flight):** throttle the network, submit Add Your Farm and the waitlist join, and screenshot *during* the flight: every field keeps its resting/filled face (no grey, no fade, no disabled field), the submit reads its busy verb, the primary's inset edge is gone, and its ground still computes to leaf. Focus is not on `<body>` at any sampled moment.
- **3.3-V7 (platform stress):** the V2 error screenshot retaken (a) at 200% text resize — nothing clips, the error line and summary grow; (b) in forced-colors mode — error message legible, field boundary present, state identifiable without color; (c) in grayscale — filled, error, and selected states still distinguishable from resting (border value steps + glyph + weight).

**Error mechanics (with Nadia's §8 checks 3.3-A…E, which stand and are not repeated here)**

- **3.3-V8 (summary identity):** every summary entry's text matches its inline line character-for-character (string comparison is correct *here* — the contract's property is textual identity), and activating an entry moves focus to its field / group's first control, ring rendered.
- **3.3-V9 (sign-in non-disclosure):** a wrong-pair sign-in renders the form-level box and **no** field error on either field; a malformed email renders a field error on Email only.
- **3.3-V10 (delete rerouting):** a mistyped DELETE renders the inline field error with focus on the field, and the panel-head line shows nothing; a non-field panel action (leave a list) still confirms on the panel-head line.

**CodeEntry (the touch)**

- **3.3-V11 (paste, rendered):** paste `1 2 3 4 5 6` into the code field (account-panel context, 390px): the screenshot shows all six digits and their spaces inside the field — nothing clipped — and submission verifies as the 6-digit code. Paste `123 456` likewise.
- **3.3-V12 (lifetime + association):** the lifetime line renders in all consuming contexts at rest, and its number equals the TTL the issued code email states (drive one real code issue and compare — the copy and the constant are checked against each other, not against this document); a wrong code produces W-2's association (Nadia's check 3.3-D) *and* the §5.1 line treatment in the screenshot.

**Register and scope**

- **3.3-V13 (change-register audit):** the before/after rendered comparison across §8's forms shows exactly D-1…D-12 and nothing else. A thirteenth difference is a FAIL until reverted or carried back as a register amendment.
- **3.3-V14 (grep-zero, F-22):** no public form file contains a hand-rolled field class string (the ReportForm longhand pattern: `rounded-field border border-line-strong bg-surface` spelled out on a control); every public data field consumes `.field`.
- **3.3-V15 (Ada's pairs, recomputed):** Quinn recomputes §9's rows 1–13 and 15–18 from the built CSS (expected values as tabled; any pair below its floor is a FAIL) and confirms row 14's disposition matches Ada's ruling (§12) as built.

---

## 12. Pushback and open rulings — for Hue to carry

**Pushbacks (Mina's, for Dustin via Hue):**

- **PB-A — The filled border (D-2) is this set's largest new visual signal, and it is a judgment call, not a floor.** Nothing in F-20, A4, or the contract requires a filled treatment at all; I have designed one (ink-soft, §3.4) because a state set that leaves "filled" undrawn invites engineering to invent it, and because the ink register gives presence a signal that spends no validity hue. The cost, stated plainly: on a form a visitor has mostly completed, most borders read darker — the form visibly *fills up* as it is worked, which I judge as satisfying ledger feedback and Dustin may judge as heaviness. The fallback is fully designed and one line long: delete `component.field.border.filled` and the `.field-filled` rule, and filled fields keep the resting border (content itself is the only filled signal — several mature systems ship exactly that). Everything else in this set is untouched by either ruling. My recommendation stands with the ink: a directory built as a ledger should let a visitor see what they have written in.
- **PB-B — The leaf checked mark (D-7) changes a platform surface the findings never named.** No audit finding complains about the browsers' default blue radio/checkbox marks; I am flagging the change rather than letting it ride silently inside "field states," because it is the one place this set alters something a visitor's *browser*, not the site, was drawing. The argument for it: it is the only foreign hue inside any public form, on the site's most trust-sensitive surfaces (account creation, consent). The argument against: visitors know the blue mark from every other site, and familiarity is a usability asset. My recommendation: take it — accent-color in leaf is one declaration, instantly reversible, and a consent checkbox that checks in the browser's blue on a warm-paper catalog page reads as a widget that wandered in from another product. But Dustin should rule it knowingly, as he ruled PB-1 / PB-2 in Nadia's spec.

**Open rulings (not pushbacks — decisions that belong to named owners, flagged per §4.4's discipline):**

- **Ada — all of §9.** Her sign-off on the computed pairs is reserved to her (Nadia §4.4). Two rows need her judgment, not just her arithmetic: row 3 (warn on paper-deep, margin 0.052 — she may prefer to rule the summary/success components off paper-deep grounds instead of accepting the pair) and row 14 (the disabled-border exemption, with its stated fallback).
- **Ada — CodeEntry's describedby composition.** Her W-2 prescription names `aria-describedby="{idPrefix}-code-error"`; §4.2.1 of the contract composes hint-then-error where a hint exists, and U7.1 gives CodeEntry a hint (the lifetime line). This design builds describedby as `"{idPrefix}-code-hint {idPrefix}-code-error"` under the contract's rule and flags it: if Ada rules her literal string governs, the build drops the hint id from the attribute (the line still renders) and this document is amended to match. Hers to sign, per §4.4.
- **Nadia — Report's onward link (§8.1).** The success panel's onward slot is designed; its destination (the reported variety/seller page, from the form's own props) is a flow fact I have proposed, not verified against her intent. If she judges it outside B-10's letter, the slot ships empty for Report and §6's heading + body still stand.
- **Nadia — a code-truth note on §4.2.10's third CodeEntry context.** On `origin/main`, the admin sign-in code page (`v2/app/admin/sign-in/code/page.tsx`) hand-renders its own field inside a BusyForm; it does not consume `CodeEntry`. §8.5 is written so the treatment travels to whichever surface consumes the component, and the admin page's own field is untouched (admin is out of the set, §1.2). If the build intends that page to *adopt* the component, that is an admin-surface change outside this item's inventory and needs its own line in the register.
- **Wren — wording slots this design creates:** the public summary heading construction (§5.3), the ZIP / About / Varieties hint rules (D-4 — the rules are the contract's; the sentences are hers), and Report's onward link text if §8.1's slot is confirmed. No wording in those slots is finalized by this document.

---

## 13. Left undecided — and why (complete list)

1. **Thea's type scale.** Labels, hints, and success leads keep their current rendered values (§0.3). Formalizing the public type scale — including the label-family inconsistency between forms that this design deliberately did not touch — is her pass, already recorded as owed since Tranche 2's P-1. Nothing in this set blocks it or is blocked by it.
2. **Admin dialect unification.** The admin sheets keep their own treatments (including their borderless error fields and their filled warning glyph). Whether the two dialects ever converge further is a future item's question; this design's job was that they read as one system, and §0.1's rule is the extent of the convergence commissioned here.
3. **A per-field success treatment.** Decided *against*, with reasoning, in §3.6 — listed here so the absence reads as a decision in the undecided section's terms as well: if Dustin ever wants validated-field dress, it is a new design item against §3.6's argument, not an extension of this set.
4. **Nothing else.** In particular: every state, token, id, class, placement, and pair in §§2–9 is decided, subject only to the named owners' rulings in §12 (Ada's pairs and CodeEntry composition, Nadia's two notes, Wren's wording slots) and Dustin's PB-A / PB-B.

---

*— Mina, UI Design. Collaborators' positions applied: Iris (feeling and meaning — the ink/leaf/warn signal separation in §§3.4–3.6, the card dress translation in §3.8), Thea (type ownership respected — §0.3, §13.1), Ada (A4 pattern adopted verbatim — §2.1; W-2 ids verbatim — §8.5; her sign-offs reserved, not assumed — §9, §12), Nadia (behavior contract §4.2 as the design's constitution; inventory §4.3 as its scope; sequence per her §9). Evidence: `origin/main` via `git show` (tokens.json, globals.css, ReportForm, AddYourFarmForm, CreateAccountForm, SignInForm, SignupFields, CodeEntry, WaitlistBlock, AccountPanel, the admin seller/variety sheets' reference pattern, BusyForm, the admin sign-in code page, icons.tsx), the full-audit section files for Mina and Ada, Nadia's Tranche 3 SPEC §4, and Quinn's design-gate record for that spec. All contrast values computed for this design from the shipped hexes. No code was written or changed by this design.*
