# Tab bar build — D1 "The Center Plate" with hide-on-scroll (Item TAB)

**STATUS: BRIEF WRITTEN, HELD FOR ITS QUEUE TURN.** Dispatch only after the Item SI build ships (programme order: … → SHOP → CSN → SI → TAB). Do not dispatch early.

## What ships

Dustin's complete pick set (2026-11-22, all ruled by him):
- Direction **D1 "The Center Plate"** as drawn (tab-bar-redesign/UX-STRUCTURE.md + UI-DESIGN.md, design gate QA-GATE-design.md — all directions FIT WITH NOTES; Bar B ruled for 200% text).
- Set: **Home · Varieties · Crops (plate) · Sellers · Search** — Crops crowned at centre (Q3); Account stays OUT (Q2; no badge anywhere in this bar).
- The plate carries **Elena's three-seeds icon art** (icon-redo-2026-11-22/b-sown-seeds/ — the same art as the shipped favicon/touch icon), composed for the 56 px plate under UI-DESIGN.md §6 discipline as adapted in HIDE-BEHAVIOR-UI.md §1.3. **The painted medallion is OUT (Dustin's ruling) — do not build it; its M4 keyline condition has LAPSED.**
- **Hide-on-scroll (Q6):** the mobile bar hides on scroll down, returns on scroll up, per HIDE-BEHAVIOR-UX.md (Nadia) + HIDE-BEHAVIOR-UI.md (Mina) + ADA-RULINGS-HIDE.md (Ada), delta-gated PASS WITH NOTES (QA-GATE-delta-hide.md).
- **Desktop header (Q4):** adopts the stem-rule active treatment ("After A"); **the header NEVER hides** — Q6 is mobile-bar only (assertion D-H1 tests this).
- Ship on design reasoning (Q5) — no tap instrumentation, no measurement gate.

## Binding conditions from the delta gate (QA-GATE-delta-hide.md) — all four are conditions of the gate's verdict

1. **Dwell = 220 ms** (Mina's longer show transit governs; Nadia's 150 ms figure is superseded — her amendment is owed to the record but the governing value is 220). Assertion **D-H2** (dwell boundary test distinguishing 150 vs 220) is part of the build gate.
2. **AH8 verbatim as a trigger requirement:** a hide may not begin during an active press on any tab or the plate.
3. **The build-gate assertion list is the original design gate's §6 list AS AMENDED in QA-GATE-delta-hide.md §4**, including **AH1–AH9** (Ada), **H1–H19** (Nadia), **D-H1** (desktop no-hide), **D-H2** (dwell boundary). Normative source: the delta gate record §4 — lift it whole; do not re-derive.
4. **Clearance is a formula, never constants:** permanent shown-state clearance (scroll-padding AND footer) = measured obstruction H + 28 px + safe-area, identical in shown and hidden states (AH1); at 200% text and under 1.4.12 spacing overrides the formula follows measured H with **no cap** (A-H2 condition 3). AH4's mechanism is two-branch: CSS transitions under the global reduced-motion rule AND any WAAPI/rAF-driven transit gated on `matchMedia` itself, gate-verified ≤0.01 ms under emulation.

## Standing build-gate obligations

- Quinn build gate with the **human-interaction browser drive, owed in full** (it has never run for this surface), real-render proof, the AH1 proof run **VISIBLE at 100% + 200%**, forced-colors renders of **both** visibility states (AH7), D-H1, D-H2, the plate link + `aria-current` assertions and the A3 tree assertions extended to both states (per the amended §6 list).
- Line-strong in this component is **#91825C** (A-H6: measured 3.0217:1 on paper-deep; #97865F fails there and survives only as the frozen shadow/stem literal — never as a boundary here).
- Focus-forced show **snaps with no transition at every motion setting** (A-H3); the hidden state is transform-only (tabs stay in tab order and the accessibility tree — no inert/aria-hidden/visibility/display).
- Full `npm run verify` green; rendered differences confined to the tab bar + the desktop header's active treatment.

## Out of scope

No other navigation surface changes; no set changes (Account does not enter); no medallion; no header hide; no instrumentation.
