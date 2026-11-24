# Open Questions for Dustin — seeds SPA conversion

**Date:** 2026-11-23 · Design questions only. Technical/additive items follow standing rules and are NOT queued here (workflow standard, token mapping, cache machinery — all in the briefs). Each question carries the team's recommendation; Hue brings these one at a time with tappable options.

## Q1 — Admin session idle timeout (plan addendum A11y #14 requires the pick to be stated once)

The new admin needs its session rule written down: today sessions last ~a week with no idle timeout.
- **(a) Keep no idle timeout (deliberate)** — the admin is a single-operator tool on Dustin's own devices; a timeout adds friction and a lost-work risk on long review sessions.
- **(b) Idle timeout with a 20-second warning, one-tap extend, and work preserved.**
- **Team recommendation: (a).** The threat model is Dustin's own iPad; the reviewer accounts are the only other seats, and their sessions can be revoked from Accounts. If a designee pool ever grows, revisit.

## Q2 — UI sans face for seeds (typography-visible change)

Program foundation decision 4 already approved Source Sans 3 as the UI sans (Inter retired); seeds' tool layer currently uses the system-ui stack, with Fraunces/Newsreader as its editorial faces.
- **(a) Adopt Source Sans 3 for seeds' UI layer** (forms, admin, chips, buttons) via @hues/fonts; Fraunces + Newsreader stay for display and prose.
- **(b) Keep the system-ui stack** — one less download, but seeds drifts from the program's one-stack typography.
- **Team recommendation: (a)** — it's the already-approved program decision; Thea verifies the rendering at the gate either way.

## Q3 — The one deliberate color delta: warmed ground

Foundation decision 3 (Iris) approved warming seeds' ground a half-step toward the family ground; `@hues/tokens`' theme.seeds.json already encodes it. Everything else about seeds' palette ports untouched.
- **(a) Take the warmed ground in the conversion** (Iris + Ada re-verify every affected contrast pair before the slice ships).
- **(b) Port the current paper `#f8f1e1` exactly** and defer the warming to a later, separate change.
- **Team recommendation: (a)** — approved at program level, and the conversion is the cheapest moment to make exactly one color change with a full contrast re-verification attached.

## Q4 — Cutover timing relative to hues.flowers

Dustin ruled (2026-11-23 ~21:56 PT) that seeds converts now, in parallel, superseding hues-first. The remaining choice is only about the cutover *moments*:
- **(a) Each property cuts over the moment its own gate passes**, even if that's the same week — the stacks share nothing at runtime, so neither cutover can break the other.
- **(b) Stagger the two cutovers by at least a week** so any lesson from the first (redirects, SW supersession, indexing wobble) lands in the second's day-0 checklist.
- **Team recommendation: (b), softly** — build in parallel at full speed; if both gates pass in the same week, seeds cuts second by a few days. The cost is days; the benefit is one property's day-0 surprises never repeat on the other.

## RULINGS — Dustin, 2026-11-23 22:06–22:08 PT (all four decided; recorded by the conversion build coordinator)

- **Q1 — Admin session idle timeout: RULED (a) — KEEP NO IDLE TIMEOUT, deliberately.** Sessions stay ~a week with no idle timeout; the admin is a single-operator tool and reviewer sessions remain revocable from Accounts. Slice 7's brief carries this as the stated session rule (plan addendum A11y #14 discharged).
- **Q2 — UI sans: RULED (a) — ADOPT Source Sans 3** for seeds' UI layer (forms, admin, chips, buttons) via @hues/fonts; Fraunces (display) + Newsreader (prose) stay as the editorial faces. Thea verifies rendering at the relevant gates.
- **Q3 — Warmed ground: RULED (a) — TAKE THE WARMED GROUND in the conversion** (theme.seeds.json's ground value, the conversion's single deliberate color delta). Iris + Ada re-verify every affected contrast pair at the gate before the slice carrying it ships.
- **Q4 — Cutover stagger: RULED (b), SOFTLY** — build in parallel at full speed; if both properties' gates pass the same week, seeds cuts over a few days AFTER hues.flowers so hues' day-0 lessons land in seeds' checklist. If seeds is ready well first, it does not wait.
- **GO — Dustin, 2026-11-23 22:08 PT: "Go — start the conversion builds."** BUILD-SEQUENCE.md Slices 0–9 execute in order under the conversion build coordinator.

## Carried dependencies (not questions — recorded so they're visible)

- **Bea's Search Console read access** (hues.flowers Domain property → Settings → Users and permissions) is still Dustin's to grant; the pre-cutover baseline (Bea §5.2) captures the day it lands. The conversion does not block on it, but cutting over without a baseline means flying without instruments (Bea risk 10) — Hue will flag it again before Slice 9.
- **Dustin's admin-queue taps** (review item 1232 rejection; duplicate hold 1269; GeoSeed location edit) are unaffected by the conversion and stay on his list; the admin they happen in converts around them.
- **The nine-plate cache purge** (stale derivatives at the image CDN) remains a Dustin-dashboard item, unrelated to the conversion.
