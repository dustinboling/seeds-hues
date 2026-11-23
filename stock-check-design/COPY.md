# Check Stock Now — Copy (all wording for Programme Item CSN)

**Seat:** Wren, Copywriting / Storytelling (author). Slots defined by Nadia's UX spec
(`SPEC.md` §10.2, slots S1–S5); outcome taxonomy per Priya's engineering design
(`ENGINEERING.md` §§1.2, 2.3–2.4, 4.2).
**Date:** 2026-11-22 · **Status:** Final strings for build. No code, no commit by this pass.
**Fixed text, not in my scope:** the control's visible text is Dustin's own words —
**"Check stock now"** — and appears verbatim wherever the control appears. Nothing
below rewords it.

**Register:** the site's friendly-date voice (Tranche 1.4, shipped in `formatCheckedDate`
and the stock line): "today", "yesterday", "Mon D" ("Nov 19") — never an ISO string,
never a clock time. Plain, friendly, exact. US spelling. No prices anywhere in this
feature. No public source attributions. No machinery words (worker, fetch, cache,
robots, server, status codes) in any public string.

---

## 0. Conventions used in this document

- `{Variety}` and `{Seller}` are the listing's variety name and seller name as already
  rendered on the card. `{Mon D}` is a friendly date in the shipped form ("Nov 19").
  `{n}` is a numeral.
- **Display labels** (shipped, unchanged) are title case on the stock line: "In stock",
  "Sold out", "Preorder", "Shop closed", "Unknown".
- **Prose forms** are used inside sentences and announcements, sentence case:
  `in_stock` → "in stock"; `sold_out` → "sold out"; `preorder` → "available for
  preorder"; `shop_closed` → "shop closed" (old state only — a check never produces
  it, per ENGINEERING §2.2); `unknown` → "unknown" (old state only — a check never
  produces it; a decisive reading is one of the first three).
- Line fragments (the stock line and its slot) take no terminal period. Announcements
  and notices are complete sentences and end with a period, so screen readers give
  them sentence prosody.

---

## 1. The slots

### S0 — The control in idle (a) and stale (d): no variant (confirmation, not a slot)

The control's text is fixed, and it is **identical in state (a) idle and state (d)
stale**:

> **Check stock now**

I considered and rejected a stale-state variant ("Check again"): the visitor reading
a stale card usually did not perform the earlier check, so "again" would state
something false about them; a second wording for one action charges a re-learning
cost for nothing (the same consistency argument Nadia makes for one placement,
SPEC §2.1); and the text is Dustin's, fixed in both states. The assembled lines read
as one sentence each, in both card contexts, including the never-checked form:

- `● In stock · Checked Nov 19 · Check stock now`
- `● Unknown · Not yet checked · Check stock now`

No first-run copy is needed for never-checked listings — the line already says the
honest thing (endorsing SPEC §4.1).

**Under the reconciled model (§3 of this document), state (e) shows no control
inside the 24-hour attempt window** — this is the one place this document departs
from SPEC §4.5 as written. See S4 and pushback PB-W1.

### S1 — Checking status (state b)

Serves: the slot while a check is in flight, whether the visitor started it, joined
it, or rendered the card mid-flight (SPEC §§4.2, 3.2). Visible text and the
live-region announcement on entering the state are the same string (§9.1 of the
spec: one announcement on entering checking).

> **Checking…**

Exact form: the word "Checking" plus a single ellipsis character (…), no period, no
trailing space. Assembled line during a check:

- `● In stock · Checked Nov 19 · Checking…`

Why this and nothing longer: the act is already named by the control the visitor
just pressed and by the stock line the status sits in; "Checking stock…" repeats
the line's own subject, and any time estimate ("Checking… about 10 seconds") would
be a promise the seller's server keeps or breaks, not us (SPEC §5.3 forbids it).
The status is not a control and takes no accessible name of its own.

**No-JS floor variant (words differ here, and only here):** on the floor path the
visitor returns to the page by navigation and nothing updates in place, so a bare
"Checking…" would strand them. The floor renders, as plain text in the slot:

> **Checking… Reload this page to see the result.**

The enhanced path never shows the second sentence. No time is promised in either
path.

### S2 — Fresh relative ladder (state c, the date segment inside the 24-hour window)

Serves: the date segment of the stock line whenever the last observation is less
than 24 hours old, however that observation was produced — a check under this
feature, a crawl observation, the scout, an admin observation (SPEC §0.1: one
freshness clock). The segment keeps the shipped pattern "· Checked {relative}".
Rungs are computed from the full timestamp (SPEC §1.3) using **completed units —
always floor, never round up** — so a 23-hour-59-minute observation never reads
"24 hours ago" inside the window.

| Age of observation | Exact segment |
|---|---|
| Under 1 minute | `Checked just now` |
| 1 minute | `Checked 1 minute ago` |
| 2–59 minutes | `Checked {n} minutes ago` |
| 1 hour | `Checked 1 hour ago` |
| 2–23 hours | `Checked {n} hours ago` |

Rules inside the ladder:

- Counts are numerals with the full unit word — "2 hours ago", never "2h ago",
  never "a couple of hours ago". Singular and plural are exact ("1 minute",
  "2 minutes").
- "Just now" is a rung label for an observation under a minute old, not a claim
  about liveness; it is used only inside that bound (see rule R10, §4).
- At exactly 24 hours the card leaves the fresh state and the segment returns to
  the shipped day-granular form byte-for-byte ("Checked today", "Checked
  yesterday", "Checked {Mon D}") — outside the window nothing in this document
  rewords the shipped line (SPEC D-CSN-2, D-CSN-8).

### S3 — Result announcements (live region only; never rendered visibly)

Serves: SPEC §6.1 — when a check the visitor started or joined resolves while the
card is on-screen, the card's persistent live region announces the result **once**.
The card itself never renders an old state; the announcement is the only place an
old state is ever named. No cheerleading, no alarm, no exclamation. All forms name
the listing (a page can carry dozens of cards), state the outcome plainly, and end
"checked just now" — which is literally true only because the announcement fires
at the moment of completion; the build must not queue or replay it later (see
PB-W4). An off-screen completion announces nothing (SPEC §5.2).

**Confirming form** (new state = displayed state):

> `{Variety} at {Seller} — still {prose form}, checked just now.`

Shape: "Variety at Seller — still in stock, checked just now."

**Flipped to in stock:**

> `{Variety} at {Seller} — was {old prose form}, now in stock, checked just now.`

Shape: "Variety at Seller — was sold out, now in stock, checked just now."

**Flipped to sold out:**

> `{Variety} at {Seller} — was {old prose form}, now sold out, checked just now.`

Shape: "Variety at Seller — was in stock, now sold out, checked just now."

**Flipped to preorder** (the remaining decisive outcome a check can return;
included so the set is complete):

> `{Variety} at {Seller} — was {old prose form}, now available for preorder, checked just now.`

A check on a sold-out listing that returns sold out is a confirming announcement,
not a disappointment state (SPEC §7.7) — same form, same plain tone.

### S4 — Couldn't-check notices (state e) — ★ MARKED SLOT: RECONCILED MODEL ★

**★ This slot is written to the coordinator's reconciled model, which overrules
SPEC §4.5 as written.** The model: the 24-hour window keys on the last check
**attempt**, whatever its outcome (ENGINEERING §4.2). After a couldn't-check, no
new check fires for 24 hours from that attempt, so **no control is shown with this
notice**; the notice itself must carry three things — that checking was tried, what
is still known (the last-observed stock and its date, which stay displayed on the
stock line, unchanged), and when it can be tried again.

**★ The one-line swap:** every variant below is built as [cause sentence] +
[still-known sentence] + **[retry line]**. If Dustin overrules and restores
Nadia's immediate retry (SPEC §4.5), the change is exactly one line per variant:
**delete the retry line (sentence 3) and restore the "Check stock now" control in
the slot.** Sentences 1 and 2 do not change, and no other slot in this document is
touched.

The notice renders under the stock line, for the attempt's participants, in place
(SPEC §4.5). The previous facts on the stock line stand byte-for-byte; the failure
is never rendered as a stock state, and `lastCheckedAt` does not move (ENGINEERING
§3.3). Wording contains no status code, no technology, and no blame: in every
variant the actor who failed is "we", never the seller.

**Cause variants — sentence 1** (one is selected by the observed cause,
SPEC §7.5 / ENGINEERING §2.3):

- **S4-A — Unreadable / blocked** (the seller's page could not be read; also serves
  the engineering outcomes `blocked` and `robots_denied` — in all three, the true
  public fact is the same: we could not read the page):
  > We tried to check, but we couldn't read the seller's page.
- **S4-B — Not found** (the listing's product page was not there; SPEC §7.3 —
  a 404 is a missing page, never evidence of a stock state):
  > We tried to check, but we couldn't find the seller's page for this listing.
- **S4-C — Timed out** (the attempt bound, SPEC §7.2, was reached):
  > We tried to check, but the check took too long to finish.
- **S4-G — Generic fallback** (any other non-result with no honest specific cause,
  e.g. an executor error — the build maps unlisted causes here rather than forcing
  them into a cause sentence that would not be true):
  > We tried to check, but the check didn't finish.

**Still-known sentence — sentence 2.** Because a check is only offered when the
last observation is 24 hours old or older (or absent), the date named here is
always in the shipped day-granular form:

- Prior observation exists:
  > The stock shown is what we last saw: {prose form}, checked {friendly date}.
- Never observed (the failed attempt was the listing's first check):
  > We have not seen this listing's stock yet.

**★ Retry line — sentence 3 (the swappable line):**

> You can try again on {Mon D}.

`{Mon D}` is the calendar date 24 hours after the attempt, in the shipped friendly
form. Naming the date rather than saying "tomorrow" keeps the sentence true at
every moment inside the window: an attempt late at night opens again late the
next day, and a visitor reading the notice the following morning is still inside
the window — "tomorrow" would then promise the wrong day. The date promises the
day, not the hour; the control returns at the exact 24-hour mark (the same
day-level precision the stock line itself already uses).

**Assembled examples** (schematic dates; an attempt on Nov 22 reopens Nov 23):

- S4-A, prior observation:
  "We tried to check, but we couldn't read the seller's page. The stock shown is
  what we last saw: in stock, checked Nov 19. You can try again on Nov 23."
- S4-B, never observed:
  "We tried to check, but we couldn't find the seller's page for this listing. We
  have not seen this listing's stock yet. You can try again on Nov 23."
- S4-C, prior observation:
  "We tried to check, but the check took too long to finish. The stock shown is
  what we last saw: sold out, checked Nov 19. You can try again on Nov 23."

Two deliberate choices to note. First, sentence 2 **repeats** the state and date
instead of only pointing at the line above it (SPEC §7.5's minimum obligation):
the notice must stand alone for a screen-reader user moving through the card and
on the no-JS floor, and the repetition is one short clause. Second, no sentence
uses participant-only language ("you just tried…") — the wording stays true for
any reader inside the window, which matters for PB-W5 below.

**No-JS floor variant:** the notice strings are **identical** on the floor path —
they are server-rendered in both paths, and they were written with no spatial
references ("above", "below") for exactly this reason. The only floor difference
in this feature's copy is the S1 checking sentence (§1, S1).

**When the window lapses:** the notice leaves and the card returns to state (d)
plain — stock line in day-granular form, "Check stock now" restored. The notice
never becomes part of a later fresh render as a permanent scar (SPEC §4.5's
persistence rule stands for visitors who were not participants; see PB-W5 for
the one case the reconciled model reopens).

### S5 — Accessible name for the control

Serves: SPEC §9.5 — a variety page carries up to dozens of identically labeled
controls; a screen-reader user must be able to tell them apart. The name starts
with the visible label (label-in-name), then disambiguates. Visible text is
unchanged.

> **Check stock now for {Variety} at {Seller}**

Shape: "Check stock now for Variety at Seller".

One pattern in both contexts. On the shop page the seller named is the page's own
seller, which reads slightly redundantly — consistency wins anyway: a visitor who
learns the name pattern on one surface should not meet a different one on the
other (the same argument as SPEC §2.1's one placement). The checking status (S1)
and the couldn't-check notice (S4) are not controls and take no accessible name.

---

## 2. Engineering outcome → public words (coverage table)

Every outcome in ENGINEERING §§1.2, 2.3–2.4 lands on exactly one public rendering.
Internal outcome names never appear in public copy.

| Engineering outcome | Public rendering |
|---|---|
| `ok` — in stock / sold out / preorder | Fresh state: S2 segment; S3 announcement (confirming or flipped form) |
| `couldnt_check` — unreadable page, no decisive signal, conflicting signals, network failure | S4-A |
| `couldnt_check` — product page 404 / 410 | S4-B |
| `couldnt_check` — timeout / deadline | S4-C |
| `error` — lease expired, executor failure, any unlisted cause | S4-G |
| `blocked` — 401 / 403 / 429, challenge page | S4-A |
| `robots_denied` | S4-A |
| `deferred` — domain pacing, no fetch spent, window not burned | No notice and no S4: the card stays in checking until the bound, then returns to idle/stale plain with the control. No failure occurred and no wording may imply one. |
| `not_checkable` — `manual_only` / `opted_out` seller, or no product page | No control is offered and no notice is shown — see PB-W2. There is no honest wording for a check that can never run, so the copy offers none. |
| `disabled` — kill switch off | No control site-wide, no notice. The stock line and its true date remain the whole statement. |

---

## 3. Microcopy rules this feature sets (for every future state)

- **R1 — Person.** The directory speaks as "we" for its own acts ("We tried to
  check", "what we last saw"). The visitor is "you" only where they act next:
  the imperative "Check stock now" and the retry line. The seller is never the
  subject of a failure verb — pages "couldn't be read", sellers never "refused",
  "blocked", or "broke" anything in public words.
- **R2 — Tense.** Observations are past ("checked", "we last saw"); the displayed
  stock state is present; checking is a present-tense fragment; the retry is a
  dated future ("on {Mon D}"), never a duration ("in 24 hours").
- **R3 — Numbers.** Numerals appear only as counts in the S2 ladder, always with
  the full unit word and exact singular/plural. No other numbers in this
  feature's copy: no wait estimates, no attempt counts, no percentages, no
  bounds. (The 30-second attempt bound and the 24-hour window are facts of the
  system; the window reaches the visitor only as the retry **date**.)
- **R4 — Dates.** Friendly forms only — "today", "yesterday", "{Mon D}". Never
  ISO, never a weekday name, never a clock time, in any state.
- **R5 — One date per fact.** The stock line carries exactly one date: when the
  stock was last actually seen (endorsing SPEC PB-CSN-3 — an "attempted" date
  never joins the line). The retry date is a different fact and lives only in
  the S4 notice, never on the stock line.
- **R6 — Never said.** Never "real-time", "live", "instant", or
  "up-to-the-minute". Never a stock promise or guarantee — a check reports what
  was seen, with its date; it does not warrant what the seller's page will show
  the visitor. Never a seller platform named. Never machinery: worker, fetch,
  cache, robots, server, queue, HTTP codes. Never blame assigned to the seller.
  Never the words "error" or "failed" as labels. Never a price, in any state,
  including failure states. Never a source attribution ("according to the
  seller's site") — a result is our observation and is worded as ours.
- **R7 — History lives only in announcements.** An old stock state is named
  exactly once, in the S3 live-region announcement at the moment it is replaced.
  No card ever renders "previously…", a change badge, or an "updated" marker.
- **R8 — Punctuation.** The ellipsis appears only in S1. Exclamation marks appear
  nowhere in this feature. Announcements and notices end with a period; line
  fragments do not.
- **R9 — Capitalization.** Display labels keep their shipped title case on the
  stock line; inside sentences and announcements the prose forms (§0) are used.
  The control's text is exactly "Check stock now", sentence case, everywhere.
- **R10 — Every string stays true for its whole lifetime.** Wording is written
  for the last moment it can be read, not the first: "just now" only under its
  one-minute bound, the retry date computed from the attempt (never a static
  "tomorrow"), and no deictic references to a tap the current reader may not
  have made.

---

## 4. Pushback — where I judge the spec's assumed wording or model wrong

Specialists push back; Dustin decides. Items are ordered by how much they move
the build.

- **PB-W1 — SPEC §4.5 (immediate retry) conflicts with ENGINEERING §4.2
  (attempt-based window), and the copy follows engineering.** Nadia's §4.5
  returns the control immediately after a couldn't-check, on the reasoning that
  eligibility never changed; Priya's §4.2 keys the 24-hour window on the last
  attempt of any outcome, so eligibility *did* change — the attempt spent it.
  Both cannot ship. This document is written to the reconciled model
  (attempt-based; S4 carries the retry date; no control inside the window), per
  the coordinator's ruling, flagged here for Dustin as the decision of record.
  Consequences Dustin should see: (a) SPEC §4.5, §7.1's "eligibility is
  unchanged" sentence, and open question OQ-CSN-3 need amending to match, or
  reversing if he rules the other way; (b) acceptance check **CSN-10 as written
  will fail against the reconciled build** — it asserts "the control is present
  again immediately" after a failed attempt. Quinn needs CSN-10 re-pointed:
  after a stubbed failure, assert the facts are byte-identical, S4 shows with
  the correct retry date, **no control is present**, and the control returns
  only at the 24-hour boundary (a new fixture: failed attempt 1 hour ago →
  no control; 24h01m ago → control, no notice). If Dustin overrules, the swap
  is the one line marked in S4 and CSN-10 stands as written.
- **PB-W2 — SPEC §3.1's clock-only eligibility contradicts the engineering
  policy gate, and no copy can cure it.** The spec offers the control "if and
  only if" the last observation is 24 hours old or absent. Engineering §2.4
  adds listings that can *never* be checked (seller `manual_only` / `opted_out`,
  or no product page — ENGINEERING Q11 notes this may be a large share on day
  one). A control rendered on such a listing invites a tap whose only possible
  answer is refusal; wording that result honestly would require explaining
  consent and crawl policy in public, which R6 forbids. My ruling for copy:
  `not_checkable` listings render the stock line plain — no control, no notice
  (§2 table). The render rule itself is Nadia's and Dustin's to settle, but it
  must be settled before build: §3.1 as written promises checks the policy
  forbids.
- **PB-W3 — A known-blocked domain has the same problem one level up.** Once a
  domain is on the block list (ENGINEERING §5.2, 7 days), a click is answered
  from cache without a fetch — but under a clock-only render rule the control
  still shows, and every participant gets S4-A for a check that was never
  attempted. "We tried to check" would be false. Recommendation: while a domain
  is blocked, its listings render no control (as PB-W2); S4-A is reserved for
  the attempt that *discovered* the block and for genuine read failures. If
  the control is kept during a block, sentence 1 of S4-A needs a blocked-only
  variant — I would rather fix the render rule than word around it.
- **PB-W4 — S3's "checked just now" is true only at the instant of firing.**
  Nadia's example wording (§6.1) is right, with a build constraint the spec
  does not state: the announcement must fire in the same update as the swap
  (§5.1) and must never be stored, queued, or replayed — a "checked just now"
  announced a minute later is a false statement in the site's own voice. The
  spec's off-screen rule (§5.2, no replay) already implies this; I am naming
  it as a testable constraint for Quinn (CSN-7's announcement assertion should
  check timing, not only text).
- **PB-W5 — The reconciled model reopens §4.5's persistence rule for
  non-participants.** Nadia designed the couldn't-check notice as a scar shown
  only to the attempt's participants; everyone else arriving later sees a plain
  stale card. Under the attempt-based window, that later arrival *also* gets no
  control for up to 24 hours — but control-absence already means "fresh" in
  state (c), so the same absence would carry two opposite meanings on cards
  that look alike except for the date's form. The S4 strings were deliberately
  written without participant-only language so they can serve any reader
  inside the window. Recommendation, for Nadia and Dustin: render S4 (with its
  retry date) to any visitor while a listing sits inside a failed attempt's
  window — it is a current fact about the listing ("we tried; here is what we
  know; try again on this date"), not a scar. If they hold the participants-only
  rule, the copy still works unchanged; the ambiguity is a UX cost, not a
  wording defect, and it should be accepted knowingly.
- **PB-W6 — SPEC §0.2's "a failure is never cached as a result" should be
  reworded before it misleads the build.** Engineering *does* cache the attempt
  (that is what the window keys on); what it never caches is an *observation*.
  Nadia's sentence is true in intent, but a builder reading §0.2 against
  ENGINEERING §4.1 could implement either. Suggested spec wording: "a failure
  is never cached as an observation and never moves `lastCheckedAt`." No public
  copy turns on this; it is a spec-clarity fix only.

---

*— Wren, Copywriting / Storytelling. Sources worked from: `SPEC.md` (Nadia, UX —
§§0–13, slots §10.2, state set §4, timing honesty §5, contradiction §6, failure
wording obligations §7.5, live-region and naming floors §9); `ENGINEERING.md`
(Priya, catalog/data — response contract §1.2, parse-confidence discipline §2.3,
never-fetched sellers §2.4, couldn't-check rule §3.3, attempt-based 24-hour rule
§4.2, block handling §5); the shipped stock line and friendly-date vocabulary as
documented in SPEC §1.1/§1.3. No code was written or changed, and nothing was
committed — the coordinator commits.*
