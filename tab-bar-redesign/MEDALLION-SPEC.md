# MEDALLION SPEC — seeds.hues.flowers tab bar centre plate

**Author:** Mina, UI Design (icon / design-system seat)
**Creator of the artwork:** Elena, Art Direction & Illustration — she creates to this spec.
**Ownership (Dustin, 2026-11-22):** Mina specs, Elena creates. This spec is not artwork,
and Mina does not paint any part of the medallion.
**Parent document:** `UI-DESIGN.md` §2/§3/§6 (Direction 1 and the D1+D2 hybrid). This spec
is live only if Dustin picks a plate direction; if he picks D2 or D3, this file is
retired with the direction, not repurposed.
**Form precedent:** this seat's favicon SPEC (`icon-redo-2026-11-22/SPEC.md`). The
discipline is the same; the numbers are re-derived for a 56 px plate, not copied from
16 px favicon rules.
**Not in this spec:** the painted medium (Elena's seat — gouache, the site's plate hand),
colour feeling (Iris's seat — her consult is in `UI-DESIGN.md` §8.1), the WCAG floor
(Ada's seat — flagged items in `UI-DESIGN.md` §9), and the final gate (Quinn's seat).

---

## 1. What ships — the plate assembly

| Part | Spec | Owner |
|---|---|---|
| Disc | Ø **56 px** CSS, circular, flat `paper` `#F8F1E1` fill, 2 px `line-strong` ring at rest / 3 px `leaf` ring when Varieties is active, `shadow-listing-flat` under the lower arc | Build, to `UI-DESIGN.md` §2 |
| Painting | Elena's medallion (§2), centred in the disc, rendered at Ø 56 px, its subject inside the **Ø 48 px safe disc** | Elena, to this spec |
| File | One PNG, transparent ground (§3, G-rules), self-hosted on the site's own assets — never hotlinked | Build |

The painting is **never cropped, never stretched, never recoloured for state**
(handling rule for all site artwork). Active/inactive is carried by the ring and the
label, never by the painting.

## 2. What Elena delivers

1. **One master:** `medallion-poppy-pod-master.png`, **1024 × 1024 px**, transparent
   ground (§3), the subject composed for a circular crop-free fit — the painting is
   placed whole inside the disc; nothing of the subject may depend on the square
   corners of the master.
2. **The verbatim generation prompt** (plus any fix-pass prompts that shaped the
   final) saved as `PROMPT.md` alongside the master — house rule, Dustin 2026-11-21.
3. **A grayscale proof** of the master, same size, for the acceptance set (§5).

One painting, one subject. No options round is commissioned inside this spec: the
subject is decided here (§3), the acceptance set (§5) is where it is judged, and a
failed acceptance returns to Elena as a re-composition under the same numbered rules —
the spec does not bend to the painting.

## 3. Subject and silhouette discipline

**Subject (decided by this spec, per Nadia's §5.2 handoff):** a **single upright
poppy seed pod** — plump ribbed body, closed flat lid/crown — the same subject as the
shipped seed-pod favicon/touch mark, painted at plate scale in the site's gouache
plate hand. Rationale, stated once: the plate crowns **Varieties**, and the pod is the
directory's own emblem (seed, not bloom — the catalogue is a seed catalogue); kinship
with the home-screen icon makes the bar's centre and the phone's icon one family.
A bloom subject is **not** commissioned: two subjects would be two commissions, and
the bloom glyph already exists in the flank family for D2/D3.

All measurements are taken on the rendered file at the stated size, never estimated
from the master. "Disc" = the Ø 56 px plate; sizes below are also given at the
**48 px acceptance render** (the safe-disc size, the judging size).

- **M1 — One dominant mass.** At 48 px the subject is **one connected component**.
  No detached element (leaf, stem stub, speckle, seed dot) floats free: secondary
  elements overlap or touch the main mass in the painting itself.
- **M2 — At most three primary masses.** The subject resolves into **≤ 3 value
  masses** (expected: body / lid / keyline-shadow). Everything else is gouache
  texture inside a mass and must disappear cleanly into it at 48 px — never
  half-survive as noise.
- **M3 — Value separation carries the read.** Adjacent primary masses differ by
  **ΔL\* ≥ 20** (CIELAB). The read survives the grayscale proof unchanged: masses
  that separate only by hue are one mass for M2.
- **M4 — Exterior contour.** The subject's outer edge contrasts with the disc's
  paper ground by **ΔL\* ≥ 40 along at least 90 % of its perimeter** at 48 px.
  A pale passage may touch the ground only where a dark keyline encloses it on
  every side. (The pod mark's known failure — pale body vanishing against paper —
  is the exact defect this rule exists to prevent at plate size.)
- **M5 — Minimum feature size.** No load-bearing feature is narrower than
  **3 px at 48 px** (= 64 px on the 1024 master). Ribs, lid teeth, seam lines and
  pore texture below that width are decoration: the subject must read identically
  with them removed.
- **M6 — No enclosed holes.** Any transparent/paper hole fully enclosed by the
  subject is either **≥ 4 px across at 48 px** or filled.
- **M7 — Fill and margins.** Subject bounding box: **78–88 % of the disc diameter**
  in height, **≥ 65 %** in width, centred on the disc's centre within ±2 px at
  56 px. Every non-transparent pixel of the subject sits inside the Ø 48 px safe
  disc at render — the ring is never touched, overlapped, or painted under.
- **M8 — No text, no cultivar claim.** No lettering anywhere. The pod is a generic
  poppy pod, not a named variety's portrait: it must not match any single listed
  variety's plate closely enough to read as that variety (the plate crowns the
  whole catalogue, not one entry in it).
- **M9 — Banned carriers.** The "seed pod" read may not be carried by: a thin stem
  (vanishes, leaving a floating head that reads as a flower), a radial ray crown
  (reads as a flower head), or fine rib hatching (averages to mud). The lid is a
  **closed flat cap** mass, per the shipped pod mark's solution.

## 4. Ground and colour rules

- **G1 — Transparent ground, opaque painting.** The master carries alpha **only**
  outside the subject. The painting itself is **full-strength and solid — never
  faded, never translucent** (Dustin's standing transparency ruling, from the motif
  work, applied verbatim). No drop shadow is painted in; the disc's shadow is the
  build's token, not the artwork's.
- **G2 — Token families.** The subject's dominant masses sit in the site's token
  families (per Iris's pod-mark consult): body in the `leaf` / `leaf-600` greens
  (`#1E4634` / `#2E6B4F` family), lid in the marigold family named in
  THEME-ART-DIRECTION §1 for illustration use. Painted intermediate tones inside a
  mass are Elena's, as in every plate on the site; no *new* dominant hue enters.
- **G3 — The disc is the tile.** The painting ships only on the `paper` disc
  (§1) — never extracted bare onto the bar's `paper-deep` ground, and the
  acceptance set (§5) proves the read on both the disc-on-paper-deep assembly and
  the dark proof ground, because the tile, not the chrome, is the ground.

## 5. Acceptance presentation — how the medallion is shown, and what "pass" means

Assembled by Mina into the presentation set (`UI-DESIGN.md` §7); Elena supplies the
master, its prompt file, and the grayscale proof.

- **A1 — Sizes.** The painting rendered at true 1:1 file pixels at **56, 48, and
  44 px**, each shown set in the full plate assembly (disc + ring) — the actual
  rendered assembly, not the master scaled in a document.
- **A2 — Grounds.** Each size shown with the bar's `paper-deep` ground behind the
  disc, and once on dark `#20241F` (the icon family's proof ground).
- **A3 — Grayscale.** The 48 px assembly rendered from Elena's grayscale proof,
  holding the same read (M3).
- **A4 — Zooms labelled.** A nearest-neighbour zoom (×8) of the 48 px render may
  accompany it, labelled "inspection only — judge the 1:1 assembly."
- **A5 — Mechanical checks reported with the set** (measured, not eyeballed):
  subject bounding box % (M7), connected-component count at 48 px (M1),
  primary-mass count and minimum adjacent ΔL\* (M2/M3), minimum perimeter
  ΔL\* share (M4), safe-disc containment (M7), alpha present only outside the
  subject (G1).
- **A6 — Order of judgement.** Judge 48 px first (the safe disc — the size the
  painting must survive), then 56 (as shipped), then 44 (the stress size — the
  smallest tappable-disc render). A painting that only works at 56 is a plate
  that fails its own spec.

## 6. Verification checklist

- [x] Subject, sizes, and safe disc derived from the plate geometry in
      `UI-DESIGN.md` §2, not copied from favicon numbers
- [x] Silhouette, value, and containment rules stated as measurable requirements
      (M1–M9)
- [x] Transparency ruling carried verbatim (G1); token families named (G2)
- [x] Acceptance presentation and pass criteria defined for Elena, Dustin, Quinn (§5)
- [ ] Deliberately unchecked by this seat: the painting itself, its colour feeling,
      and the floor — Elena's, Iris's, and Ada's calls; Quinn design-gates the
      finished medallion before any build

— Mina, UI Design · 2026-11-22
