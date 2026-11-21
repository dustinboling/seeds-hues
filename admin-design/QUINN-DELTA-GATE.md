# Quinn Delta Re-Gate — Seed Directory Admin Spec (amendments)

**Deliverable gated:** `~/workspace/seeds-hues/admin-design/SPEC.md` as amended by Nadia (518 lines), specifically the amendments from the design gate.
**Standard:** `~/workspace/seeds-hues/admin-design/QUINN-GATE.md` — RA-1, RA-2, RA-3 and Findings 2–8, plus Dustin's rulings as recorded in `~/workspace/seeds-hues/ADMIN-SECTION.md`.
**Method:** each amendment read in its amended sections and quoted below; a full-spec grep sweep for the superseded phrasings; regression checks on the text immediately around each amendment (the matrix rows, the confirm pattern, the screens that reuse the changed boundaries). Delta scope only — sections the amendments did not touch were not re-gated.

## VERDICT: PASS WITH NOTES

All three required amendments and all seven Minor fixes are present, in the sections the gate specified, and say what the gate and the rulings required. No stale text survives anywhere in the spec contradicting an amendment. One Minor copy note remains — the G2 role-card wording, ruled on in §10 below — which is a one-line copy amendment, not a design change and not a blocker.

**The spec is cleared for build briefs.** The G2 copy line in §10 is to be applied as specified there (Hue confirms on sight; it does not need another delta gate).

---

## 1. RA-1 — Decision-created aliases are not removable — VERIFIED

**Required:** §7 F2 and §15.4(a) amended so a duplicate decision's guarantee cannot be silently voided — decision-created aliases either not removable, or removable only under a confirm naming the scout re-proposal consequence.

**Found (§7 F2):** *"Exception (RA-1, gate Finding 1): an alias added by a duplicate decision has no remove control — it is not removable in admin, by either role."* The alias carries its label in the same paragraph: *"an alias added by a C4 decision is labeled 'Added from a duplicate decision · {date} · by {name}'."*

**Corroborated in §11:** the matrix carries the dedicated row *"Alternate names — remove a name added by a duplicate decision (F2; not removable, RA-1)"* — **Absent for Admin and Reviewer alike**. §15.4(a) records the amendment and its source.

**The other half of the gate's fix direction also landed:** manually added aliases remain removable, and their confirm now names the full consequence — *"This name will stop finding this variety in search, and the scout may propose this variety again under it."*

**Judgment on Nadia's choice (non-removable over the full-consequence confirm):** the gate offered either option; she took the stronger one, and the reasoning recorded in F2 and the amendment log is sound — *"a control that could delete it would let one later tap silently void a decision the team already made."* A confirm is the weakest guard in this spec's own pattern language (§10.1 exists for actions a person means to take; a settled decision is not one person's later tap to undo). The escape path is also specified and honest: a duplicate decision that was itself wrong *"is a decision to reverse, not a name to delete — Hue corrects it from the record."* **This satisfies Dustin's decision 1** ("it still turns up in search, and the scout never proposes it again. Never just discard it") in full: the name persists, search keeps finding it, and the scout's duplicate check keeps matching against it, with no admin path that deletes the record the guarantee rests on.

## 2. RA-2 — Dedicated admin danger token — VERIFIED

**Required:** §3.1 and §10.1 amended — destructive confirm verb buttons filled with the new admin-only danger token, not ink; petal gets no fifth meaning.

**Found (§3.1, token table):** *"danger (admin only) | `#8F1D12` — gate-measured candidate; **final value confirmed by Iris in her token pass** | **One job only:** the verb button inside destructive confirms (§10.1), always paired with its verb label. Never for errors or caution (ochre keeps those); never anywhere else in admin or on the public site"* — with the gate's computed pairs carried into the table (white label text 8.93:1; boundary against paper 7.93:1).

**Found (§10.1):** *"buttons: **Cancel** (secondary, initial focus — the safe choice) and the **verb button** (filled with the admin `danger` token, §3.1: "Remove seller")."*

§3.1's petal paragraph records the ruling correctly in both directions — petal's fifth job refused, the ink-filled interim rejected (*"as a button fill it reads as *prominent*, not *dangerous*"*) — and the chroma budget names danger as the single exception, inside destructive confirms only. §15.8 is marked resolved with the ruling and its reasoning, including the constraint on any value Iris substitutes (the lightness separation from ochre must be preserved). No layout changed, as the ruling required.

## 3. RA-3 — Reviewer approval of a structured correction applies it immediately — VERIFIED

**Required (Dustin's ruling, 2026-11-20):** §7 C5's verify-then-wait two-step for corrections deleted; §11's combined row split (apply correction → Reviewer Live; route to retire → stays Absent, stated explicitly); §5 phrases the bounded exception; audit trail records "applied on approval by {name}". Scope: structured corrections via the report flow only.

**Found (§7 C5):** *"**Structured seller correction** — **Apply the correction**, identical for Admin and Reviewer: approving the report applies the correction immediately (Dustin's ruling, 2026-11-20 — "that's their job, so right away"). There is no verify-then-wait state for corrections. The audit trail records the reporter and "applied on approval by {name}"."* C5 closes the point explicitly: *"(§15.2, resolved by Dustin's ruling; the earlier verify-then-admin-applies two-step for corrections is deleted.)"*

**Found (§11):** the combined row is split exactly as required —
*"Reports — apply a structured seller correction (C5) | Live | Live (applies on approval — Dustin's ruling)"* and *"Reports — route to retire a listing (C5) | Live | Absent (removals are Admin-only)"*.

**Found (§5):** *"**No** seller editing — a Reviewer never opens a seller edit form; the one bounded exception is approving a structured correction payload inside the report flow (C5), which applies that correction on approval (Dustin's ruling, 2026-11-20) — a queue decision, not seller editing."*

**Scope discipline — checked, holds:** the exception is bounded to structured corrections in the report flow everywhere it appears. C5's listing-problem path keeps the separation the gate demanded: Retire routes to the retire confirm, **Admin only**, the action absent for a Reviewer; a Reviewer's Confirm report on a listing problem records "verified by {name}" and leaves the report visibly waiting — so the one surviving "waiting for an admin" in the spec (see §9) sits in the listing-problem flow, where waiting is correct, not in the corrections flow, where the ruling deleted it. §15.2 records the resolution and the scope note verbatim, including *"route-to-retire stays Admin-only, because retiring is a removal and the ruling speaks to corrections, not retirements."* D3, D4, and all removals remain Admin-only in §5, §11, and the screens.

## 4. Finding 2 — C2 consequence copy is role-aware — VERIFIED

**Found (§7 C2):** *"the consequence line above the bar is **role-aware** — a consequence must be true for the person reading it (§2 principle 8; gate Finding 2). Admin reads: "Approving creates this seller. They aren't listed publicly until you finish their details and Small Farm classification in Sellers." Reviewer reads: "Approving creates this seller. They aren't listed publicly until an admin finishes their details and Small Farm classification in Sellers.""* Both variants present; neither promises a Reviewer an action their role does not have. (The new copy also retires the old line's other defect — "Approving adds this seller to the directory" — which contradicted the candidate state Finding 8 was about; the grep sweep confirms that sentence is gone.)

## 5. Finding 3 — Notes-privacy test list extended — VERIFIED

**Found (§13, builder handoff item 4):** the notes store is to be *"served **only** through admin-authorized endpoints — notes must never appear in any public API response, the public seller page's rendered HTML, any search-index payload built from seller records, the sitemap, or any sync payload (test each named surface explicitly)"*. Both surfaces the finding named — the public seller page's rendered HTML and the search index — are now in the required test list, alongside the three the original text carried. The builder's test cannot pass while a named surface is unchecked, which is what the finding required.

## 6. Finding 4 — The 1180px boundary belongs to the iPad band — VERIFIED

**Found (§4):** the band table now reads iPad **744–1180px** (216px rail, 1080px content cap) and Desktop **≥ 1181px**; the boundary is stated as a rule — *"**Boundary ownership:** 1180px belongs to the iPad band. A current iPad in landscape is exactly 1180 CSS px wide, and it lands in the iPad shell (216px rail, 1080px content cap) its screens were composed in; the desktop shell begins at 1181px."* The amendment propagated consistently beyond §4: §7 B's layout note and §7 H's side-by-side provision both use ≥1181px for desktop, and §14's reference viewports agree. The old boundary (744–1179) appears nowhere in the spec (grep, §9). A real iPad at 1180px now gets exactly one shell, and the table, the compositions, and the verification list all name the same one.

## 7. Finding 5 — No-results states for F1 and G1 — VERIFIED

**Found (§7 F1):** *"*No results* — "No varieties match '{query}'." + **Clear search** button (the D1 pattern)."* **Found (§7 G1):** *"*No results* — "No accounts match '{query}'." + **Clear search** button (the D1 pattern)"*. Both screens now specify the state in words, adapted from D1 as the finding directed; §14's blanket states claim no longer overreaches on these two screens.

## 8. Finding 6 — §11 key: "no control that changes data" — VERIFIED

**Found (§11):** *"**Read-only** = information rendered as text, with no control that changes data (view controls — a search field, filter chips, a sort menu — may still be present; they change the view, never the data)"*. The key no longer contradicts the Reviewer's read-only screens, whose live search/filter/sort controls are view controls. The builder's permission contract now reads the way it is applied.

## 9. Finding 7 — Statistics header band decided: not sticky — VERIFIED

**Found (§7 H):** *"The header band is **not sticky** (decided, gate Finding 7): it scrolls away with the page. §4's sticky list is exhaustive — rail, list-column headers, phone tab bar — and this band is not on it; the time range the band carries is restated in every card's caption, so nothing is lost when it scrolls off."* The word "sticky-ish" appears nowhere in the spec. Because the band is not sticky, no §12 focus-obscured obligation arises — the amendment says so, correctly discharging the conditional half of the finding.

## 10. Finding 8 — Candidate state defined; §15.13 flag is honest — VERIFIED, with the G2 ruling below

**Found (§7 C2):** *"**Candidate state, defined (gate Finding 8): a candidate-state seller is not publicly listed — no public page, absent from the directory and from search — until an Admin completes its details and classification in Sellers (D2–D4). Nothing half-finished reaches the public site.**"* The rule is stated unambiguously — three named surfaces (public page, directory, search), one named completion condition (details + classification, by an Admin, in D2–D4), no reading left open for the builder to guess.

**The §15.13 flag is honest.** It labels the rule *"a designed rule, flagged for Dustin to override"*, states plainly that it *"is not one of Dustin's settled decisions"*, and — the part that makes the flag honest rather than decorative — it names the tension against Dustin's own known posture: *"it cuts against the directory's hunt posture (sellers go live on approval; Dustin disqualifies afterward). If Dustin prefers live-on-approval, only C2's candidate-state definition and consequence copy change."* The flag discloses the conflict and prices the override. Confirmed as required; the decision itself is Dustin's, and nothing in this gate pre-empts it.

### Ruling on the open G2 flag — the amendment extends to G2 (Minor, non-blocking)

**The flag:** §7 G2's Reviewer radio-card copy still reads *"Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything."* RA-3's scope did not include G2. Nadia flagged it rather than silently editing beyond her brief — correct.

**Ruling: the copy is true in the form sense and imprecise in the decision sense, and the amendment should extend to G2.** In the form sense it holds: a Reviewer never opens a seller edit form, never sees a classification Change control, never sees a remove control — §5's framing ("a queue decision, not seller editing") is accurate about the mechanics. But G2's radio cards are not mechanics; they are the role definitions Dustin reads at the moment he grants the role, set side by side with the Admin card ("Everything: edit sellers, classify, remove, manage roles"). Read as a boundary statement — which is how the person granting the role will read it — "Can't edit sellers" says a Reviewer can never cause a seller's record to change, and after Dustin's ruling that is not so: approving a correction report changes the seller's record, immediately, by design. Everywhere else the amended spec states this boundary (§5, §15.2, §11), it phrases the bounded exception in the same breath, precisely so the boundary stays legible. G2 is the one boundary statement that omits it.

**Severity: Minor, copy-only.** No permission is misstated — §11, the builder's contract, is exact, and no control is wrongly granted, hidden, or described in any screen's behavior. The defect is confined to one summary sentence on an Admin-only screen. **It does not block build briefs.**

**Specified fix (apply verbatim; no further delta gate — Hue confirms on sight):** the Reviewer radio card becomes — *"Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything — except approving a seller correction, which applies the fix right away."*

## 11. Stale-text sweep — clean

Full-spec grep for the superseded phrasings; every hit is the amendment's own record of what was replaced, or a correct surviving use:

- **"waiting for an admin"** — one hit (§7 C5, listing-problem flow): a Reviewer's verified listing problem waits for an Admin because retiring is Admin-only. That is the amended design working as specified, not the deleted corrections two-step. The corrections flow carries the opposite words: *"There is no verify-then-wait state for corrections."*
- **Ink-filled destructive buttons** — three hits (§3.1, §15.8, amendment log), all in the rejected/withdrawn framing. The operative texts (§3.1 token row, §10.1) specify the danger token.
- **Old §4 boundary (744–1179 / desktop ≥1180)** — no hits; 1180/1181 usage is uniform across §4, §7 B, §7 H, and §14.
- **Old §11 key ("rendered as text, no control")** — replaced; the only "no control" phrasing in the spec is the amended "no control that changes data."
- **"sticky-ish"** — no hits. **"Approving adds this seller to the directory"** (old C2) — no hits.

## 12. Regression check — the neighborhoods of the amendments

Amendments change text around them; the joins were checked:

- **§10.1 still lists "Remove alternate name"** among confirm-worthy actions — consistent with RA-1, not contrary to it: manually added aliases remain removable through that confirm (F2); RA-1 removes the control only for decision-created aliases, which never reach the confirm.
- **§11's "Reports — dismiss, confirm/verify (C5): Live | Live"** row coexists correctly with the split rows beneath it: the Confirm report action survives in C5 for listing problems (both roles), while corrections and retire have their own rows with their own role values.
- **C2's role-aware consequence lines and the candidate-state definition agree** — both say the seller is created on approval and listed only after details + classification; the approval-success line ("Seller created — finish their details in Sellers") matches.
- **C4's promise and F2's protection agree** — C4 still promises the decider *"the scout won't propose it again"*; F2 now guarantees the mechanism behind the promise cannot be deleted in admin.
- No amendment introduced a new token, layout, or permission beyond its finding: the danger token is confined to §3.1/§10.1 and its §15.8 record; the boundary change is confined to band ownership; RA-3's exception appears only in §5, C5, §11, and §15.2.

## 13. Coverage and limits of this delta gate

**Covered:** RA-1, RA-2, RA-3 and Findings 2–8, each against the amended spec text in the sections the gate specified; the amendment log against the sections it claims to have touched (all claims verified in place); a full-spec stale-phrasing sweep; the joins between amended and unamended text listed in §12; the G2 flag, ruled in §10.
**Not covered:** sections the amendments did not touch were not re-gated (the original gate's verdict on them stands); the spec's codebase claims remain the designer's audit statements for the build gate to confirm; nothing is rendered yet, so §14's owed-at-build proofs (screenshots, DOM measurements, keyboard and VoiceOver walks, Ada's floor pass) remain owed exactly as before. This delta gate certifies the amendments, not the product.

## 14. Disposition

- **Cleared:** build briefs may be written from the amended spec, including the amended sections — the delta condition from the design gate is discharged.
- **One copy amendment to Nadia (Minor, non-blocking):** the G2 Reviewer radio-card line, replaced verbatim per §10. Hue confirms on sight; no further delta gate.
- **Still with Dustin (unchanged by this gate):** the §15.13 designed rule — approved sellers stay unlisted until details + classification are complete — is flagged for his override if he prefers live-on-approval; §15's other interim assumptions stand as the design gate assessed them.
- **Carried to the build gate, unchanged:** Iris confirms the danger token's final value in her token pass; Ada verifies the built pairs; the §15.3 scout-feed payload confirmation remains a build-brief dependency.

— Quinn Assurance, delta re-gate, 2026-11-20
