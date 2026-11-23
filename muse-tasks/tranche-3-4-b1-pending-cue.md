# Tranche 3 — D-B1-2 pending cue build (the deviation is struck; build the real cue)

## Provenance — READ BEFORE writing code

- **Ruling:** Dustin, 2026-11-23 14:42 PT: **"Build the pending cue."** The registered deviation D-B1-2 is **struck**. This is a small, single-purpose follow-up build.
- **Evidence:** Hue's B-1 return-condition drive on the live site (2026-11-23, PR #60 live; record in `QUINN-GATE-tranche-3-4-b1-pr60.md`'s drive section): in-place swaps (sort from page 2, reverse sort) took ~0.5–2s, and at 0.4–0.5s after the tap the ONLY feedback was the sort button's pressed state — no visible cue, no dimming, no `aria-busy` observed on the main region. The mechanism, title sync, availability order, and Clear All all PASS; this build changes only the pending feedback.
- **Normative text:** SPEC `backlog-2026-11-21/tranche-3/SPEC.md` §2.5.3 **as amended 2026-11-23** (the amendment paragraph is part of the clause — read it in the living SPEC; it is also committed with the Tranche 3 design record). §2.5.9 (the count line announces no loading/intermediate states) is NOT amended and stands.
- **What exists today (PR #60, on main):** `pendingCue` in the shared in-place browse hook (`useInPlaceBrowse`): a ~1s timer arms on pending, cleared synchronously on every settle path; surfaces render one conditional `opacity-50` class on the six in-place results regions; `aria-busy` is set in flight (`pending === null ? undefined : true`) and removed on settle; resting markup is byte-identical when not pending. The hook carries removal instructions for the deviation-era cue — this build REPLACES that cue with the real one; it does not stack a second mechanism on top.

## The build

On every in-place browse swap the shared hook drives — sort change, filter change, pagination within the in-place model, Clear All — on `/variety` and on every other surface consuming the same hook/regions (the six regions PR #60 touched; if you find another consumer of the hook, include it and say so in the PR body):

1. **A perceptible visible cue on the results region for the actual fetch duration.** A visible treatment on the region itself, in the site's design language and tokens (Mina's UI standards govern: the Tranche 2 token layer, no new reference colors, no spinner clichés, no skeleton swap, no layout shift). The treatment must be unmistakable at a glance on a phone — the drive's complaint was that a shopper sees *nothing happen*; a treatment too subtle to notice fails this brief the same way the dim did.
2. **Timing bound (normative, from the SPEC amendment):** the cue is perceptible by **~0.4s** into a pending update and stays for the remainder of the fetch, clearing on swap (and on every settle path — success, failure, adoption, superseding tap). An appearance delay up to ~250ms to avoid flashing on instant updates is within bounds; the current ~1s delay is not.
3. **Assistive tech:** the results region carries `aria-busy="true"` while pending, removed on settle (verify the shipped behavior actually lands on the region element in the rendered DOM during a swap — the drive could not observe it). The pending state must be conveyed to AT; if your design adds a dedicated visually-hidden status for it, it must NOT make the count line announce loading states (§2.5.9 stands — the count line's text still changes exactly once per deliberate change, in step with the results). State your choice and its §2.5.9 reasoning in the PR body.
4. **Resting state unchanged:** when not pending, every region's markup is byte-identical to today's resting markup. No payload, URL, history, title, count, or sort behavior changes — PR #60's verified behaviors (title sync, distinct-seller availability key, counts consolidation, Clear All sort preservation) are out of scope and must not move.

## Tests

- Update the D-B1-2 DOM test(s) in `tests/dom/variety-browse.test.tsx` to the new contract: cue present by the timing bound during a controlled slow fetch (both sort directions), `aria-busy` on the region in flight and removed after, cue cleared on settle, no cue in resting markup. Keep every other assertion in the file intact.
- T-A: the updated/new cue assertions must fail on pre-build code (PR #60's state) and pass on yours — demonstrate both directions and report it.
- Full `npm run verify` green. (Known flake class: synchronous focus/timing assertions in DOM tests can fail intermittently under parallel load — if you hit one, re-run the file in isolation and report the evidence rather than re-running the whole suite silently.)

## PR body (the workflow's stub is not acceptable — write the full accounting)

Provenance (this brief, the ruling, the SPEC amendment); what the cue is (treatment, tokens used, timing mechanism, the aria-busy/status decision + §2.5.9 reasoning); per-surface disposition (every region the hook drives); T-C (no payload field added — state it explicitly); T-A both directions; the drive conditions for Hue's return-condition re-drive (cue visible mid-swap in both sort directions on the live site).

## Boundaries

- No changes to sort keys, title builders, counts, Clear All semantics, or any payload shape.
- No new reference colors; consume the token layer.
- Quinn gates this PR (usability drive at DOM fidelity + the live-drive return condition owned by Hue). Do not merge or deploy.
