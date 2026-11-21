# Quinn Design Gate — Seed Directory Admin Spec

**Deliverable gated:** `~/workspace/seeds-hues/admin-design/SPEC.md` (Nadia, UX/UI — 492 lines)
**Criteria:** Dustin's settled decisions in `~/workspace/seeds-hues/ADMIN-SECTION.md` (the acceptance criteria for this gate), the spec's own §2 principles and §14 checklist claims, Ada's accessibility floor (WCAG 2.2 AA + meaning-map), Iris's color discipline.
**Method:** the spec text itself, read in full, checked section by section against the decisions; §14's checked boxes verified against the spec text, not taken on faith; §3.1 contrast ratios independently recomputed (spot-check — see §5 below). Nothing is built yet, so nothing rendered was inspected; this is a design gate, and the report says so wherever that limits a claim.

## VERDICT: PASS WITH NOTES

The spec satisfies every settled decision in ADMIN-SECTION.md, carries all three of Dustin's directives (polished dashboard, iPad primary, no open forms) from principle into screens, and flags its ambiguities instead of guessing them. Three **required amendments** (§1 below) must land in the spec and return for a delta re-gate before a build brief is written from the affected sections. None of the three is a design failure: one is a defect this gate caught (Finding 1), two are referred questions that have now been answered (§15.8 by this gate, §15.2 by Dustin). Seven Minor notes follow.

---

## 1. Required amendments (delta re-gate before build)

### RA-1 — Alias removal must not silently void the duplicate guarantee (from Finding 1, Major)
Amend §7 F2 and §15.4(a) per Finding 1 below: decision-created alternate names are either not removable, or their removal confirm names the scout re-proposal consequence in the same plain terms C4 promises the decider.

### RA-2 — Destructive confirms take a dedicated admin danger token (from the §15.8 ruling, §2 below)
Amend §3.1 and §10.1: the verb button in destructive confirms is filled with the new admin-only danger token defined in the ruling, not ink. No layout changes.

### RA-3 — Reviewer approval of a seller-correction report applies it immediately (Dustin's ruling, 2026-11-20)
Dustin ruled, verbatim: "No, that's their job, so right away." This overrides the spec where they conflict. Amend:
- **§7 C5:** delete the "Verified — waiting for an admin" two-step for seller-correction reports. A Reviewer approving a structured correction applies it immediately, exactly as an Admin's approval does. The application records the reporter and the approving reviewer in the audit trail (the spec already records "verified by {name}" — it now records "applied on approval by {name}").
- **§11 matrix:** the row "Reports — apply correction / route to retire (C5) — Reviewer Absent" splits in two: *apply a structured seller correction* becomes **Live** for Reviewer; *route to retire* stays **Absent** (see scope note).
- **§5 role summary:** phrase the exception so the boundary stays legible — a Reviewer never opens a seller edit form; approving a structured correction payload inside the report flow is the one bounded exception.

**Scope note (binding on the amendment):** the ruling covers *structured corrections via the report flow only*. Free-form seller editing (D3), classification (D4), and all removals remain Admin-only, per settled decision 1. **"Route to retire" stays Admin-only:** retiring a listing is a removal, and removals are Admin-only under the same settled decision — the ruling speaks to corrections, not retirements. The current C5 text lumps the two actions into one decision bar without separating them for the Reviewer; the amendment must state the separation explicitly so the builder cannot read the ruling as covering retire.

This is recorded as an amendment from Dustin's ruling, **not** a design defect: Nadia flagged the ambiguity in §15.2 and designed the conservative interim rather than guessing. That was the correct call, and the gate record should say so.

---

## 2. Ruling on §15.8 — destructive-button color

**RULING: A dedicated admin danger token. The ink-filled button as designed does not stand; the refusal to give petal a fifth meaning does stand.**

The amended design: a new token, admin-only, warm vermilion-red family, used for exactly one job — the verb button inside destructive confirms (§10.1) — always paired with its verb label ("Remove seller"), never used for errors or caution (ochre keeps those), never used anywhere else in admin or on the public site. Measured candidate for Iris to confirm or adjust in her token pass: **#8F1D12** — white label text on it computes to **8.93:1** (WCAG 1.4.3, needs 4.5:1); its boundary against paper computes to **7.93:1** (1.4.11, needs 3:1); its relative luminance (0.068) sits a clear step below ochre's (0.134), so the danger/caution distinction survives color-vision deficiency on lightness after hue is gone. Iris sets the final value; Ada verifies the built pairs.

**Reasoning, from the two seats this was referred to:**

- *Ada's floor:* both options pass every number. White on ink #2E2A23 computes to 14.27:1; white on petal would compute to 8.07:1. No criterion decides this — which is exactly why the spec was right to refer it rather than settle it on contrast. What Ada's discipline does decide: the **meaning map**. Petal #8E2A52 already means *sold out, protection badge, required field,* and *active tab* on the public site (Ada's opening case file; a use-of-color audit is already owed on it). A fifth job — *destructive* — is the textbook cognitive failure her playbook names: a hue carrying a negative state, a neutral marker, and a formality cannot be learned. The spec's refusal of petal is correct and is upheld. Her cognitive rules then ask that states be *plain, not subtle* — and on that test ink is the weaker carrier (below).
- *Iris's discipline:* semantic colors are assigned sparingly and consistently — one hue, one meaning, across the whole product. A single-job danger token is that rule applied, not an exception to it. Her evidence file is specific about red: it is a *learned signal* — errors, stops, warnings are read instantly because they were taught — and her standing instruction is to specify red deliberately wherever a signal is intended. A destructive confirm is the one moment in admin where a signal is most intended. Her chroma rule points the same way: reserve the highest chroma for the single most important element; inside a destructive confirm, the destructive verb *is* that element. Ink-filled spends no signal there.
- *The point the spec missed about its own choice:* the spec refuses petal a fifth job, then quietly gives **ink a second one**. Ink is the product's primary text color — it means "ordinary content" on every screen. As a button fill it does not read as *dangerous*; it reads as *prominent*. Severity in the as-designed dialog rests entirely on the words and the interruption. Words are present and good — but this spec's own practice everywhere else (§3.1 status chips, §7H deltas) is that color is kept as a redundant second channel precisely because it is the fastest one. Removing the hue channel at the single highest-stakes moment is inconsistent with the spec's own redundancy standard (§2 principle 9).
- *Why not the lighter red:* a brighter candidate (#B3271E, white text 6.51:1 — passes) was computed and rejected: its luminance (0.111) sits too close to ochre's (0.134), so under deuteranopia the danger button and a caution element separate by hue alone — the failure mode both playbooks ban. The ruled value's darker step is what makes the token safe, and any value Iris substitutes must preserve that lightness separation from ochre.

**Disposition:** amend §3.1 (add the token, one job, admin-only) and §10.1 (verb button = danger token). The dialog anatomy, the verb labels, Cancel's initial focus, and the consequence copy are unchanged and were not in dispute.

---

## 3. Findings

Severity scale per the QA playbook: Blocker / Critical / Major / Minor / Trivial. Ordered by severity — Finding 1 is the vital one; the rest are Minor and must not bury it.

### Finding 1 — MAJOR — Admin alias removal silently voids the duplicate decision's guarantee
**Where:** spec §7 F2 (alternate-name remove control), §15.4(a). **Standard violated:** ADMIN-SECTION.md decision 1 — when a hold is judged a duplicate, the held name is kept as an alternate name so "it still turns up in search, and the scout never proposes it again. Never just discard it."
**Evidence:** §7 C4's consequence panel promises the decider, in the product's own words, that after a duplicate decision "the scout won't propose it again." That promise is kept by exactly one mechanism: the alternate name persisting on the existing variety, where the scout's duplicate check matches against it. §7 F2 then gives Admin a per-alias **remove** control (§10.1 confirm), and §15.4(a) flags alias management as beyond the decisions — but neither place discloses the interaction: removing a decision-created alias deletes the very record the guarantee rests on. The confirm's stated consequence is "removing an alias can orphan a search term" — it names the search effect and omits the scout effect entirely. A duplicate Dustin's team already decided can therefore be re-proposed by the scout, land back in the C4 queue as new work, and — decided differently a second time — enter the catalog as the duplicate C4 exists to prevent.
**Why Major, not Minor:** the failure voids a settled decision's stated guarantee through a path the spec itself built, with consequence copy that understates the consequence on precisely the point the decision cares about. It is Admin-only and behind a confirm, which is why it is not Critical; a workaround exists (never remove decision-created aliases), which is why it is not a Blocker. **Fix direction (maker's to design):** aliases labeled "Added from a duplicate decision" (F2 already labels them) are either excluded from removal, or their confirm names the full consequence — the name stops finding the variety in search *and* the scout may propose the variety again. RA-1 carries this into the delta re-gate.

### Finding 2 — MINOR — C2's consequence copy is role-blind and promises Reviewers actions their role does not have
**Where:** spec §7 C2 (decision bar, "both roles"). **Standard:** spec §5/§11 (Reviewer: no seller editing, no classification) read against §2 principle 8 (decisions state their consequences — the consequence must be true for the person reading it).
**Evidence:** the consequence line above the shared decision bar reads: "Approving adds this seller to the directory. You'll set their details and Small Farm classification in Sellers." A Reviewer approving a candidate cannot set details or classification — both controls are correctly absent for the role. The copy addresses both roles with Admin-only next steps. No permission leaks (the controls are right); the words are wrong for half the bar's audience. Make the line role-aware ("An admin sets their details and classification in Sellers" for Reviewers).

### Finding 3 — MINOR — The notes-privacy test requirement omits the public seller page itself
**Where:** spec §13.4. **Standard:** ADMIN-SECTION.md decision 6 — notes "never shown to the public: not on public pages, not in any public API response."
**Evidence:** the requirement itself is present and explicit — notes served only through admin-authorized endpoints, "never appear in any public API response, sitemap, or sync payload (test this explicitly)." That is the right requirement and this gate confirms it is there. The enumeration, however, lists API response, sitemap, and sync payload — and omits the surface the decision names first: the **public seller page's rendered HTML** (server-rendered from seller data; a future join could leak notes without touching any API), and any search-index payload built from seller records. Extend the required test list to name the public seller page HTML and the search index explicitly, so the builder's test cannot pass while the named surface is unchecked.

### Finding 4 — MINOR — The 1180px breakpoint boundary contradicts the spec's own primary reference viewport
**Where:** spec §4 (band table vs reference viewports), §14. **Standard:** boundary discipline — the edge value belongs to exactly one band; the spec's own verification claims must be checkable against its own tables.
**Evidence:** §4's band table assigns 744–1179px to iPad and ≥1180px to Desktop. The same section names **1180×820** as the iPad landscape *reference composition*, and §14 claims key screens "composed at 1180×820 and 820×1180" as the iPad-primary proof. A current iPad's landscape width is exactly 1180 CSS px — the primary device sits on the boundary and, read literally, the band table gives it the desktop shell (232px rail, 1280px content cap) while the composition text designs it as iPad (216px rail, 1080px cap). Practical harm is small — master–detail applies in both bands — which is why this is Minor; but a builder implementing the table literally and a gate checking the compositions will disagree about what shipped. Resolve the edge: state which band owns 1180px and make the table, the reference viewports, and §14 agree.

### Finding 5 — MINOR — Two search lists lack the no-results state their sibling screens specify
**Where:** spec §7 F1 (Variety list), §7 G1 (Account list). **Standard:** spec §2 principle 10 ("A state that is not in this spec does not ship by accident") and §14's claim that every screen carries its states.
**Evidence:** §7 D1 specifies its no-results state in words ("No sellers match '{query}'." + Clear search); §7 E1 references the standard patterns. §7 F1 and §7 G1 specify search fields, rows, and count lines — and no no-results state at all. §7's inheritance convention points unlisted states at §10, but §10 defines no generic empty-search pattern to inherit. The pattern exists one screen away, so the builder will likely copy it — but by the spec's own principle, an unspecified state is a gap, and §14's blanket claim overreaches on these two screens. Specify both (D1's wording adapts directly).

### Finding 6 — MINOR — The role matrix's key overstates "read-only" in a way the builder's contract should not
**Where:** spec §11 (rendering key). **Standard:** spec §5 rule 2 — the rule itself is applied uniformly (verified, §4 below); this finding is about the key's wording only.
**Evidence:** the key defines Read-only as "information rendered as text, no control." But the Reviewer's read-only screens (D1, E1, F1) correctly include live controls that change nothing — search fields, filter chips, sort menus. Read strictly, the key contradicts the screens; read as intended, "no control" means "no control that changes data." One clause fixes it, and the matrix is the builder's permission contract, where exact wording is the whole point.

### Finding 7 — MINOR — "Sticky-ish" is an uncheckable word in a spec that otherwise bans them
**Where:** spec §7 H ("a two-column grid of cards under a sticky-ish header band"). **Standard:** checkable criteria — a requirement that cannot be answered yes or no with evidence is itself a finding.
**Evidence:** §4's sticky list is exact (rail, list-column headers, phone tab bar) and the statistics header band is not on it; "sticky-ish" neither adds it nor excludes it, and if the band *is* sticky it inherits §12's focus-not-obscured obligation, which §7 H does not mention. Resolve to sticky or not; if sticky, add the band to §4's list and §12's checks.

### Finding 8 — MINOR — An approved seller's "candidate state" is never defined for public visibility
**Where:** spec §7 C2. **Standard:** §2 principle 8 (consequences stated before the action) — the approver cannot be told the consequence if the state is undefined.
**Evidence:** C2's approval "creates the seller in a *candidate* state," after which details are finished in Sellers — while its own consequence line says "Approving adds this seller to the directory." The spec never states whether a candidate-state seller is publicly listed (visible on the public site with whatever fields exist) or held invisible until finished. The two readings produce opposite public behavior, §15 does not flag the question, and the builder will have to guess the one that puts data on the public site. State it in one sentence in C2. (The directory's settled posture — sellers go live on approval and Dustin disqualifies afterward — suggests "live on approval" is the intended reading; the spec, not this gate, must say it.)

---

## 4. What was checked and held

Checked against ADMIN-SECTION.md decision by decision; the following held exactly, with no narrowing found:

- **Reviewer powers (§5, §11, and every screen):** decide all queues incl. duplicates — Live; notes read + add — Live; seller edit — Absent; classification — read-only render, no Change control; deactivate/remove seller — Absent (whole danger zone); retire/restore — Absent; alternate-name add/remove — Absent; Accounts section — Absent from navigation and from the section itself, with the A4 wrong-role landing rendering no data. The §5 rendering rules (Act = absent, View = read-only render, no permanent disabled controls) are stated once and applied uniformly across C, D, E, F, and G — verified screen by screen, including the classification appearing to a Reviewer as the public badge/words in the same layout position.
- **Duplicate outcome (C4):** two outcomes only, plus Skip. Duplicate keeps the held name as an alternate name on the existing variety, moves its listings, states the scout consequence — never a discard path anywhere in the flow. The two outcome buttons are deliberately equal-weight so the interface takes no side in a judgment call; panel order never swaps. (Finding 1 concerns a *different* screen's later removal path, not C4.)
- **Internal notes (D5):** unmistakable three independent ways — the "INTERNAL NOTES — NEVER SHOWN ON THE PUBLIC SITE" eyebrow with lock icon, the visually distinct paper-deep panel, and admin-only existence — with privacy carried by words and icon, not color alone (forced-colors survival, §12). Both roles read and add; the composer sits behind "Add note," never open on the page. §13.4's explicit never-in-a-public-response test requirement is present (Finding 3 extends its surface list).
- **Statistics (§7 H, §7 B):** site stats — Visitors, New accounts, Waitlist signups, Clicks to sellers; popularity by **all four** settled signals — Views, Clicks to sellers, Waitlist joins, Searches — including the no-results searches table. Every chart carries a sentence summary and a hidden data table; deltas are arrow + number + word, never color alone; thin-data and zero states are designed, not blank.
- **Sessions and sign-in (§7 A):** ~1-week admin session as decided; expiry lands on A3 with the destination preserved, never a bare form; wrong-role landing (A4) renders no counts, no section inventory, no data.
- **Dustin's three directives:** *Polish* — §2 principle 1 is carried into composed surfaces (queue cards with oldest-age and designed all-clear states, stat cards with trends and deltas, Recent decisions in plain words), not left as an aspiration. *iPad-first* — §4's master–detail default, portrait/landscape treatment, and per-screen iPad-first layouts in §7, with iPad viewports named first in §14's owed proofs (Finding 4 is a boundary wording slip inside this, not a failure of the directive). *No open forms* — §10.3 mechanizes the rule (every create/edit behind a labeled button into a sheet, dedicated view, or confirm) and states its exceptions openly. The gate examined the exceptions for loopholes: the sign-in flow is a flow, not a form on a content page; the single search field and the filter chips / sort menu are controls carrying no data entry and no submit; the decision bars contain no fields at all (decline and retire reasons sit inside their pop-ups, exactly as the directive specifies for the retire reason). **The exceptions are honest; none is a loophole.** The legacy page's raw-ID open forms are explicitly abolished (§13.3, G2).
- **§14 checklist claims:** verified against the spec text — the §1 audit precedes the design; the heuristics walk's claims (Skip, Undo-where-reversible, last-Admin lockout protection, dirty-sheet guard, per-band retry on the home dashboard) each trace to a specified mechanism in §7/§10; the role-matrix claim holds subject to Finding 6's wording; the states claim holds subject to Finding 5. The "Owed at build" box is **honestly left unchecked** — rendered screenshots, DOM measurements, keyboard and VoiceOver walks are owed by the builder and gated later, and the spec does not pretend otherwise. That honesty is noted in the spec's favor.

## 5. Spot-check evidence (§3.1 ratios)

Recomputed from the hex values by the WCAG relative-luminance formula: ink on paper 12.68:1 (spec: 12.7), muted on paper 5.56:1 (spec: 5.6), ochre on paper 5.06:1 (spec: 5.1), line-strong on paper 3.17:1 (spec: 3.2 — passes the 3:1 non-text floor unrounded). The spec's recorded measurements are honest. Full pair verification on the built surface remains Ada's build-time pass, as §12 itself states.

## 6. §15 ambiguity assessments

Nadia flagged twelve items rather than guessing them. The flagging itself is correct on all twelve. Interim assumptions assessed individually:

- **15.1 Sign-in mechanism — RESOLVED BY DUSTIN'S RULING (2026-11-20):** admin sign-in is deliberately different from and more secure than the visitor sign-in — email + code for the admin side, as §7A designs it. The conflict with "same as visitors" is resolved in the spec's favor. **No finding; no amendment needed.**
- **15.2 Reviewer correction approvals — RESOLVED BY DUSTIN'S RULING (2026-11-20):** reviewer approval applies the correction right away. See RA-3 — a required amendment arising from the ruling, not from a design error.
- **15.3 Duplicate-hold data feed:** correctly flagged; the interim (design C4 against the structured payload, contents enumerated) is the only workable assumption and is safe — the dependency is named for the build brief, and if the feed cannot carry the payload, C4's build stops visibly rather than degrading silently.
- **15.4 Beyond-the-letter designs:** correctly flagged. (b) Crops browse-only is the safe direction (builds less than the maximum, contradicts nothing). (a) Alias management is where Finding 1 lives — the flag discloses the feature but not its interaction with decision 1.
- **15.5 Visitors source:** correctly flagged; the interim (composed no-data state; 7d/30d/12w presets; custom ranges deferred) is safe and honest — no invented numbers anywhere. *Process note for Hue, not a finding:* the build brief should wire Cloudflare Web Analytics as part of the statistics slice, so the Visitors card Dustin named does not ship dark by default merely because the wiring was nobody's task.
- **15.6 Add Your Farm unification:** correctly flagged; the interim (one queue, source label, home count = the sum) is safe — the design survives either query-layer outcome, and the count rule is stated where a builder could otherwise ship the smaller number.
- **15.7 Notes append-only:** correctly flagged; append-only is the conservative interim and keeps the record honest. Safe.
- **15.8 Destructive color:** referred to this gate; ruled in §2 above (RA-2).
- **15.9 Unsaved-work preservation:** correctly flagged; the interim (destination always preserved; sheet contents where the builder can hold them) never promises data the design cannot guarantee. Safe.
- **15.10 Undo scope:** correctly flagged; the interim (the status line omits Undo wherever the backend cannot reverse) is the honest pattern — the design never advertises a reversal the system cannot perform. Safe.
- **15.11 Offline writes blocked, not queued:** correctly flagged as a deliberate choice; for actions with public side effects, witnessed-or-blocked is the safe interim. Safe.
- **15.12 Session length = 7 days, both roles:** correctly flagged; 7 days is Dustin's "like a week" in a constant, and the flag notes the Reviewer-session variant costs one constant if he wants it. Safe.

## 7. Coverage and limits of this gate

**Covered:** the full spec text against every settled decision in ADMIN-SECTION.md; the three directives as design principles and as mechanized in screens; the §5/§11 role model screen by screen; §14's claims against the spec's own text; §15 in full; §3.1's ratios by independent recomputation (spot-check, §5 above); the §15.8 question under both referred playbooks, with candidate values computed.
**Not covered:** the spec's claims about the existing codebase (schema tables, component inventory, the legacy page's behavior) — these are the designer's audit statements, used consistently inside the spec; the build gate must confirm them against the tree. Nothing rendered exists yet, so no viewport, keyboard, screen-reader, or forced-colors claim was tested — §14's owed-at-build list stands as the build gate's charter, with Ada's own pass still required before any conformance sentence is made about the built admin. This gate certifies the design against its criteria; it does not certify the product.

## 8. Disposition

- **Returns to Nadia:** RA-1, RA-2, RA-3 amendments; Findings 2–8 fixes (all are spec-text amendments; none changes the architecture). Delta comes back to Quinn for confirmation before the build brief is written from the amended sections.
- **Can proceed in parallel:** build-brief preparation for every surface the amendments do not touch; the §15.3 scout-feed payload confirmation; the Web Analytics wiring task (§15.5 note).
- **With Dustin:** nothing outstanding from this gate — §15.1 and §15.2 were ruled on 2026-11-20 and are folded in above.

— Quinn Assurance, design gate, 2026-11-20
