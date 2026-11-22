# Tranche 3 — Decisions for Dustin

Six decisions from the Tranche 3 design phase (Nadia's SPEC, Quinn design gate PASS after amendments A-1…A-7; Mina's field-states design with Ada's rulings). Each brief is self-contained: the question, the options, the team's recommendation and reasoning, and what the ruling gates. Hue presents them one at a time; nothing these decisions gate builds until Dustin rules.

Sources: `SPEC.md` (Nadia), `FIELD-STATES-DESIGN.md` (Mina), `ADA-RULINGS-3-3.md` (Ada), `QA-GATE-design.md` (Quinn) — all in this folder.

---

## 1. PB-1 — The sort default (Nadia)

**Question:** When the new sort control ships on `/variety` and crop pages, what order should a visitor see before they touch anything?

**Options:**
- **(a) "Most sellers first" becomes the default** — varieties with in-stock listings first, then varieties with listings, then varieties with none; within a tier, more listings first, then name. "Name A–Z" and "Recently checked" stay one tap away.
- **(b) Keep "Name A–Z" as the default** — the control is added, the resting order doesn't change.

**Team recommendation: (a).** Nadia's finding (UX-03): the harm was never the missing control — it's the default. Alphabetical order buries buyable varieties under unavailable ones on the directory's core lists (a Zinnia page still leads with varieties nobody sells). A control most visitors never touch doesn't fix a default every visitor meets. The cost is stated plainly: every list's first page changes visibly, count lines stop saying "alphabetical" at rest, and anyone who learned the current order relearns it. Option (b) is fully designed as a fallback (§5.2.5) — the build differs by one parameter's meaning, so either ruling costs no rework.

**What it gates:** Item 3.4's §5.2 sort build only. The rest of Tranche 3 proceeds either way.

**RULING — 2026-11-22 (Dustin, via Hue): (b) "Keep Name A–Z as the default."** Ruled against Nadia's recommendation. §5.2 builds on the §5.2.5 fallback: the sort control ships with all three options and the full `sort` parameter vocabulary; only the absent-parameter meaning and the resting count-line phrase differ — the resting order stays Name A–Z.

---

## 2. PB-2 — Hue becomes a multi-select filter (Nadia)

**Question:** Should the Hue (color) filter let a shopper pick more than one color at once — "pink or peach zinnias" — while every other filter group stays single-select?

**Options:**
- **(a) Multi-select Hue** — independent toggles; any set of hues, OR within Hue, AND across the other groups; one remover chip per selected hue; per-option counts computed as "results if this hue were toggled."
- **(b) Hue stays single-select** like every other group.

**Team recommendation: (a).** Every other group is genuinely single-valued in the data (a variety has one season, one life cycle), but Hue is the exception in the data and in the shopper: a gardener shops a palette. Baymard's filter research (Nadia's playbook) finds multi-select within a category is what users expect; single-select forces friction and abandonment. The service layer already accepts a list for `colorFamily`, so the machinery costs nothing extra. If Dustin declines, Hue ships single-select on identical machinery — the difference is contained to the group's selection logic.

**What it gates:** Item 3.1a — the in-place filter core on `/variety`, the tranche's first and riskiest build. It does not start until PB-2 is ruled.

**RULING — 2026-11-22 (Dustin, via Hue): (a) "Multi-select Hue"** — Nadia's recommendation adopted. Hue ships as independent toggles: any set of hues, OR within Hue, AND across the other groups; one remover chip per selected hue; per-option counts per SPEC §2.4.5 ("results if this hue were toggled"). Item 3.1a is un-gated and builds in programme order.

---

## 3. §11.1 — Sign-in for accounts created without a phone (Nadia)

**Question:** The waitlist flip (Item 3.2) creates accounts with email alone — no phone. Sign-in today is email + phone. How does the owner of a phone-less account sign in later on `/account`?

**Options:**
- **(a) Recommended default:** when sign-in's email+phone pair matches an account with no phone on file, the form offers "Email me a code instead" and completes sign-in by the email-code path the product already trusts.
- **(b) Leave `/account` as-is** — phone-less accounts verify in place on the variety page (already fully specified) but get no `/account` sign-in path until they add a phone.

**Team recommendation: (a).** Such an account must never be a dead end; the code path already exists and is already trusted elsewhere in the product. It's carried to Dustin explicitly because it amends the credential model he approved in the Phase 3 account spec — the same class of decision as the waitlist flip itself, which he ruled on personally.

**What it gates:** Nothing in the build sequence — open by design. The waitlist build is fully specified without it; the ruling decides whether the `/account` accommodation is added to 3.2's scope.

**RULING — 2026-11-22 (Dustin, via Hue): (a) "Offer 'Email me a code instead'"** — the team's recommendation adopted. The `/account` email-code accommodation for phone-less accounts is IN Item 3.2's scope.

---

## 4. §11.4 — Turnstile exemption for the no-JS waitlist endpoint (Nadia; security)

**Question:** The no-JS fallback for the waitlist flip is a plain form POST. Turnstile tokens are minted by Cloudflare's JavaScript widget and verification fails closed without one — so a no-JS submission can never pass Turnstile. May the non-JS form-encoded create-and-join endpoint be exempt from Turnstile?

**Options:**
- **(a) Exempt that one endpoint**, with compensating controls: (i) alerts stay held until the email is confirmed by the inline verification code — an unverified submission activates nothing; (ii) the site's existing rate limiting applies to the endpoint; (iii) Turnstile remains required on the JavaScript path exactly as today. The exemption covers only the form-encoded no-JS endpoint.
- **(b) Decline the exemption** — then a different human-verification mechanism for the no-JS path must be designed before Item 3.2 can build. Silence is not an available disposition; the flow cannot succeed without one.

**Team recommendation: (a).** The abuse ceiling is bounded by design rather than by hope: nothing activates without email verification, and rate limiting still applies. But this is a security posture decision — weakening bot protection on an account-creation endpoint, even a bounded, hold-gated one — and the spec deliberately does not take it on its own authority.

**What it gates:** Item 3.2 (waitlist flip + no-JS fallback) does not start until this is ruled. The rest of Tranche 3 is unaffected.

**RULING — 2026-11-22 (Dustin, via Hue): (a) "Exempt the no-JS endpoint, with the verification hold + rate limiting"** — the team's recommendation adopted. The exemption covers only the form-encoded no-JS create-and-join endpoint, with the compensating controls exactly as specified: alerts stay held until the email is confirmed by the inline verification code, the site's existing rate limiting applies to the endpoint, and Turnstile remains required on the JavaScript path exactly as today. Item 3.2 is un-gated and builds in programme order, with the §11.1 email-code accommodation in its scope and Ada's Ruling 9 (the no-JS redirect-back URL carries the waitlist block's fragment; Quinn check 3.2-G) carried in its brief.

---

## 5. PB-A — The filled-state field border (Mina)

**Question:** In Mina's field-state design, should a field that holds a value look different from an empty one?

**Options:**
- **(a) Ink-soft border** — a filled field's border darkens from line-strong to ink-soft (#4A4438; Ada-verified 9.49:1 on surface, 8.58:1 on paper). No validity color is spent on mere presence; the field reads as a line written into the ledger. Leaf stays the living signal (selected/succeeded), warn ochre stays the warning signal — filled borrows the ink register instead, so the state also survives grayscale and color-vision deficiency.
- **(b) No filled treatment** — filled fields keep the resting border; the content itself is the only filled signal. Fully designed fallback, one line to apply.

**Team recommendation: (a).** Mina: a state set that leaves "filled" undrawn invites engineering to invent it. The cost, stated plainly: on a nearly complete form, most borders read darker — the form visibly *fills up* as it's worked, which Mina judges satisfying ledger feedback and Dustin may judge heaviness.

**What it gates:** Item 3.3's build (field states). The rest of the field-state set is untouched by either ruling.

**RULING — 2026-11-22 (Dustin, via Hue): (a) "Ink-soft border on filled fields"** — Mina's recommendation adopted. A filled field's border darkens from line-strong to ink-soft (#4A4438, Ada-verified). Item 3.3's build carries it in its field-state set.

---

## 6. PB-B — Leaf accent on native checkboxes and radios (Mina)

**Question:** Native radio buttons and checkboxes currently render their checked mark in each browser's default accent — an off-palette blue on the main engines, the only foreign hue inside any public form. Should the site set `accent-color` to leaf green for these controls?

**Options:**
- **(a) Leaf accent** — one CSS declaration (`component.field.accent`), tokenized, instantly reversible; Ada-verified (leaf on surface 10.42:1, on paper 9.42:1). Size, position, and platform behavior unchanged; forced-colors mode still lets the OS draw the mark.
- **(b) Leave the browser default.**

**Team recommendation: (a).** No audit finding named this — Mina flags it rather than letting it ride silently inside "field states," because it's the one place the design alters something the visitor's *browser* was drawing. The argument against is real: visitors know the blue mark from every other site, and familiarity is a usability asset. For it: on the site's most trust-sensitive surfaces (account creation, consent), a blue check on a warm-paper catalog page reads as a widget that wandered in from another product.

**What it gates:** Item 3.3's build (one declaration inside the field-state set).

---

*Assembled by the backlog coordinator (continuation #9), 2026-11-22, from the design records above. No decision here is pre-empted; builds gated above wait for Dustin's rulings via Hue.*
