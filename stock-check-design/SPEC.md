# Check Stock Now (Programme Item CSN) — Design Specification

**Seat:** Nadia, UX Design (author). Standing collaborators with slots in this spec: Mina (UI design — all visual values of the check slot and its states, §10.1), Wren (copy — every new string except Dustin's fixed link text, §10.2), Ada (accessibility — semantics, focus landing, and target geometry floors, §10.3). Quinn's gate closes on this document (§12).
**Date:** 2026-11-22 · **Status:** Design spec only. No code, no build, no production writes.
**Amendments applied 2026-11-22:** the CSN pre-build amendments **A1–A3 + A5** from Quinn's design gate (`QA-GATE-design.md` §5), in their **Nadia-model form**, per Dustin's three rulings of 2026-11-22 — (1) the couldn't-check window keys on the last *successful* check only, so CSN-10 stands as originally written and S4 takes Wren's marked swap (retry line deleted); (2) OQ-CSN-1 ruled **re-order in place**, against §6.2's hold-position recommendation, which is recorded there as ruled-against; (3) Turnstile **off in v1, behind config**, on the compensating controls named at §8. Amended passages: §§0, 0.2, 1.2, 2.3, 3.1, 4.5, 5.1, 6.2, 6.3, 7.1, 7.2, 8, 12 (CSN-2, CSN-3, CSN-7, CSN-9, CSN-12, CSN-15; CSN-10 verified unchanged), 13 (OQ-CSN-1, OQ-CSN-3), and the register (D-CSN-4 revised; D-CSN-5 amended). A4 and A6 are not in this document — the coordinator's build brief carries them.
**Commission — Dustin, voice call 2026-11-22, verbatim:** "Can we add a small little link that says check stock now that will fire off a little worker to go check it out but then we'll need to cache that information so that multiple people when they click on that link it doesn't require it to run through it every time."
**Governing values (ruled, not re-litigated here):** freshness window **24 hours** everywhere (stale threshold, re-check eligibility, wording); link text is Dustin's own — **"Check stock now"**; there is **no standing full-listing stock crawl** (the hunt is paused at Dustin's word; the scout adds varieties; Quinn's audit samples), so a listing's stock dates from when it was last observed and this feature is the directory's freshness mechanism; **prices are never shown** — a check result is a stock state plus when it was checked, nothing more.
**House standards binding this spec:** phone-first (public surface; the iPad-first rule is admin-only); WCAG 2.2 AA is Ada's floor — this spec states floors and never invents her values; US spelling; no public source attributions beyond the existing "Reviews from Google" exception (a check result is our own observation and is worded accordingly); the Tranche 3 §2 in-place discipline (in-place updates are the house default for local interactions; URL/history as state; focus never dropped; persistent live regions); every surface a PWA; no invented facts anywhere — a state the data cannot support does not render.

---

## 0. The one rule that governs this spec

**The check belongs to the stock line, because the stock line is the fact it re-reads.** Every decision below follows from that: the control sits with the fact it acts on (Gestalt proximity), it appears only when that fact is old enough to be worth re-reading, it reports back into the same line it left from, and it never touches anything else on the card — not the packets, not the notes, not the outbound pill — and it moves no card's position in any list, with the single ruled exception of §6.2 (a section-boundary flip under the shop's grouped sort re-orders in place, by Dustin's ruling on OQ-CSN-1). A check is a local-scope action under the playbook's in-place standard and Tranche 3 §2.5: it updates one card's stock line in place, preserves the page, the place, the scroll position, and the visitor's train of thought, and it is never a navigation, a page view, or a reason for any other card to change.

Three corollaries, stated now because they decide arguments later:

1. **One freshness clock, one source of truth.** Freshness is measured from the listing's `lastCheckedAt` — the last time the listing's stock was observed *by any means* (a crawl observation, the scout, an admin observation, or a check under this feature). There is no separate "CSN clock." A listing crawl-observed two hours ago is fresh; a listing checked under this feature twenty-five hours ago is stale. The state a card is in is a property of its timestamp, never of who produced it.
2. **A check produces exactly two facts: a stock state and a checked-at time.** It does not update packet sizes, notes, titles, or anything else the worker may happen to see, and it never produces a price. If the worker cannot read the seller's page, it produces *no* facts — a failure is never cached as an observation and never moves `lastCheckedAt` (§7.1; wording per Wren PB-W6 / gate Q-D9, amendment A5).
3. **The cache is the feature's promise, and the interface must not pretend otherwise.** Inside the 24-hour window a re-check cannot return anything but the cached answer, so inside the window the design offers no re-check (§4.3). Offering a control that cannot change anything would be a dead control wearing a live one's clothes.

---

## 1. Current state (verified 2026-11-22)

Method: code from `origin/main` via `git show` in the CSN worktree; the shop design read from `shop-design/SPEC.md` and `shop-design/SPEC-GRID-CARD.md` at `origin/main`; the in-place contract read from Tranche 3's SPEC §2.5.

### 1.1 The variety-page listing card (Quiet Ledger, shipped)

The card is `ListingRow` (`v2/components/variety/ListingRow.tsx`), rendered in two contexts from one component. On the variety page it renders in **variety context**: seller name as the `<h3>` heading (linking to the seller page, with the Small Farm badge inline where flagged), location as the subline, then the stock line, then packets/notes, then the wheat-stem hairline, then the footer ("Report a problem" left, "Visit shop →" pill right, `/go/{id}`, new tab, `nofollow noopener noreferrer`).

**The stock line's exact current form** (the element this feature attaches to):

```tsx
<p className="mt-listing-status font-sans text-[13px] text-muted">
  <span aria-hidden="true" className={`…rounded-full… ${tone.dot}`} />
  <span className={`font-semibold ${tone.word}`}>{AVAILABILITY_LABEL[l.availability]}</span>
  {checked ? ` · Checked ${checked}` : " · Not yet checked"}
</p>
```

That is: a colored dot (tone per availability — leaf for in stock, petal for sold out, leaf-600 preorder, muted shop closed, warn unknown), the availability word in the matching tone ("In stock", "Sold out", "Preorder", "Shop closed", "Unknown" — `AVAILABILITY_LABEL`), then a separator and the friendly checked date from `formatCheckedDate`: **"today"**, **"yesterday"**, or **"Mon D"** ("Nov 19") — never an ISO string, never a pill. When `lastCheckedAt` is null the line ends **"· Not yet checked"**. Sold-out dress: the card ground steps down from surface to paper, the shadow softens, and the pill keeps working with its fill removed.

### 1.2 The shop grid's unified variety card (designed, `SPEC-GRID-CARD.md`)

The shop build replaces the seller page's ledger stack with the unified `VarietyCard` in **shop context**, in a 2 / 3 / 4-column product grid. Its anatomy (§3.3 of that spec), top to bottom: art frame; Latin line; variety name as `<h3>` (linking to the variety page — the shop card is *not* a whole-card link, because it carries two destinations plus a utility link); crop common-name line; **stock line — "dot + availability word + friendly checked date, byte-for-byte the ledger's status line"**; packet sizes; listing notes; and an action footer pinned to the card's bottom ("Report a problem" left, "Visit shop →" pill right), with the ledger's sold-out dress transferred whole.

**The shop sort default (OQ-3, ruled 2026-11-22, shop SPEC §7.5):** the grouped order — the **orderable** section (`in_stock`, `preorder`) first, the **not-orderable** section (`unknown`, `shop_closed`, `sold_out`) below, **variety name A–Z as the sole ordering key within each section**. It is the shop's resting order at every size band, and filtered and paginated views inherit it. §6.2 of this spec addresses what a live stock flip does to that order, and records Dustin's ruling on it (2026-11-22: re-order in place).

### 1.3 The timestamp the freshness window runs on

`lastCheckedAt` is a nullable text field validated as `dateish` — an ISO date **or a full timestamp** (`/^\d{4}-\d{2}-\d{2}/`). The shipped display helper `formatCheckedDate` reads only the date part, which is why the stock line speaks in days. Two build inputs follow, stated here so the build does not discover them:

- **A check under this feature must persist the full timestamp of the observation** (date and time), not a date alone. A date-only value cannot support a 24-hour window: a listing "checked Nov 22" would be simultaneously fresh and stale depending on the hour the visitor arrives. The field already accepts a timestamp; nothing in the schema needs to change for this.
- **The fresh state's relative phrasing (§4.3) needs a time-aware sibling of `formatCheckedDate`.** The existing helper's vocabulary ("today" / "yesterday" / "Mon D") stands untouched for the stale and idle states; the relative ladder inside the window is a new formatting slot (§10.2, Wren's wording over the ladder this spec defines).

### 1.4 What does not carry this feature

The unified card's **browse context** (`/variety`, crop, series, and sibling grids) has no stock line and no listing — it carries a seller count. There is no per-listing stock fact on that card to re-read, so **"Check stock now" never renders in browse context**. The feature lives only where a listing's stock line lives: the variety page's Quiet Ledger cards (variety context) and the shop grid's cards (shop context). This is the complete surface list.

---

## 2. Placement (normative)

### 2.1 The ruling — both card types, one position

**The check control sits on the stock line itself, trailing the checked-date segment** — after "· Checked Nov 19" (or after "· Not yet checked"), as the final element of the stock line's paragraph, in the stock line's own text size and voice. Schematically (bracketed wording is a slot, §10.2; the link text is fixed):

- Ledger card, stale: `● In stock · Checked Nov 19 · Check stock now`
- Ledger card, never checked: `● Unknown · Not yet checked · Check stock now`
- Shop grid card, stale: identical line, identical position — the shop card's stock line is the ledger's line byte-for-byte (§1.2), and the slot is part of that line, so it inherits the identity.

**One behavior model across both cards, with no forced difference found.** The two cards differ in what surrounds the stock line (a rail and a text column on the shipped seller-context ledger card's successor surfaces; a full-width art frame and a pinned footer on the grid card), but the stock line itself is one element with one anatomy in both, and the slot is defined on the line, not on the card. Nothing about either card's geometry forces a second placement, and a second placement would charge every visitor a re-learning cost for nothing. The one contextual consequence is absorbed differently and is named in §2.3.

### 2.2 Why here — the reasoning, and the alternatives rejected

1. **Proximity is the label.** The control re-reads exactly one fact: the stock state and date printed immediately to its left. Placed trailing that fact, it needs no explanatory copy — the line reads as one sentence about one thing ("here is the stock, here is when we last saw it, here is how to see it again"). Gestalt proximity does the work a paragraph of help text would otherwise have to do, and the minimalist heuristic is served: zero new visible copy beyond Dustin's four words.
2. **The footer was rejected.** Both cards already carry a two-action footer ("Report a problem" / "Visit shop →"). The footer is card-level administration and outbound commerce; a third element there would (a) separate the control from the fact it refreshes, so a visitor reading "Checked Nov 19" must hunt elsewhere to act on its age; (b) crowd a row whose two occupants are already at opposite ends by design; and (c) put a *reading* action in visual competition with the card's one *buying* action, the pill — the exact two-primary-actions failure the playbook warns against. The pill must stay the card's loudest action; the check must stay quiet and adjacent to its fact.
3. **A line of its own was rejected.** A dedicated row under the stock line costs a full line of card height on every eligible card — and eligible is the common case: with no standing crawl, most listings on most days are past 24 hours or never checked, so most cards would carry the extra row most of the time. On the shop grid that row also lands inside the fact block whose heights Mina balances across a row. Trailing the stock line costs no height in the common case (the line has room; §2.3 covers the wrap case) and keeps the card's silhouette unchanged from the shipped card — a visitor who knows the Quiet Ledger already knows this card.
4. **The heading row and the art frame were rejected without extended argument:** the heading names a different thing (the seller or the variety) and the frame is artwork, which carries no controls anywhere in this directory.

### 2.3 Consequences absorbed, named honestly

- **Wrapping.** At 390px the common lines fit: dot + word + date segment + link is roughly 290px of 13px text against a ~340px text column on the ledger card and a ~160px column on a 2-column phone grid card. **On the shop grid card at phone width the line will usually wrap**, the link landing on the stock line's second visual line, left-aligned under the dot. That alignment sentence is **ledger-scoped** (Mina DR-3, gate §4 disposition, amendment A1): on the grid card the wrapped control follows the grid card's own centered alignment system, as every other wrapped line on that card already does — each card's own alignment governs its wraps, and a left-flushed control under the grid card's centered fact line would be that card's only alignment break. The wrap *behavior* (the link wraps as a unit, never mid-phrase; the separator rhythm survives) is identical on both cards. That is accepted, and it is the one place the two cards *look* different while behaving identically: the ledger's wide column usually holds the line whole; the grid's narrow column wraps it. Wrapping inside the stock line's own paragraph is not a defect — the line is a sentence, sentences wrap — but Mina's slot (§10.1) owns the wrap behavior (the link must never break mid-phrase, and the separator rhythm must survive the wrap), and CSN-2 (§12) measures it.
- **Target geometry.** The visible text is small (the stock line's 13px) and the house floor is a 44px target. The slot therefore carries an expanded hit area (padding inside the line's paragraph; exact geometry is Mina's, floor is Ada's, §10.3). The stock line's line box grows to accommodate the target when the control is present. In a stacked ledger list this is invisible (card heights already vary with packets and notes); in the shop grid the pinned footer (`margin-top: auto`) absorbs the variance exactly as it already absorbs packet and note variance. No other element moves.

### 2.4 What the control is, as an element

Dustin's word was "link," and the design honors what the word carries — small, quiet, text-weight, inline — but the element is an **action, not a navigation**: it fires a worker; it does not take the visitor anywhere. Best practice is unambiguous that actions take button semantics and navigation takes link semantics, and screen-reader users build their expectations on that distinction. The control is therefore specced as a **small text-styled button inside a minimal POST form** (§8 gives the floor this creates), visually dressed as the stock line's trailing text link (Mina's values). This is flagged, not buried: it is the one place this spec departs from the commission's literal wording, it changes nothing the visitor sees, and §13 PB-CSN-2 carries it to Dustin explicitly so he can overrule the semantics if he wants the element itself to be a link.

---

## 3. The behavior model (normative)

### 3.1 Eligibility — one rule

A card offers "Check stock now" **if and only if every term of the single eligibility conjunction holds** (gate Q-D1, in its Nadia form; amendment A1):

- the listing's last observation (`lastCheckedAt`, §0.1) is **24 hours old or older, or does not exist**; **and**
- the listing's last **successful** check is **24 hours old or older, or does not exist** — only a successful check starts the 24-hour clock; a failed attempt starts no window and removes no eligibility (§§4.5, 7.1); **and**
- the listing is **checkable**: its seller's crawl policy is not `manual_only` or `opted_out` (ENGINEERING §2.4), and a product page is present (`product_url` is not null); **and**
- the seller's domain is **not block-listed** (ENGINEERING §5); **and**
- no check for the listing is **in flight** (§3.2 — an in-flight listing renders the checking state, not the control).

This conjunction is the one eligibility rule, stated here so SPEC and ENGINEERING read as one rule: ENGINEERING's window test (§4.2) keys on the last *successful* check under Dustin's ruling, and the observation term (§0.1) keeps a recent observation from any source — crawl, scout, admin, or check — equally binding. Checkability is evaluated **server-side, in ENGINEERING §1.1's order** (listing exists and is publicly visible → seller active → kill switch → crawl policy → product page present → domain not block-listed → in flight → window), because a control offered where a check can never fire promises a check the endpoint will not run (gate Q-D2). On a `not_checkable` or block-listed listing the stock line renders plain — **no control, and no notice** (Wren's ruling, COPY PB-W2/PB-W3: there is no honest wording for a check that can never run, and "We tried to check" must never be printed for a fetch that was never attempted; S4-A is reserved for genuine read failures and the attempt that discovers a block). Eligibility is computed at render time and re-evaluated at every state change. It does not depend on the availability value: a sold-out listing can be re-checked (restock is the highest-value answer this feature can return), a shop-closed listing can be re-checked (shops reopen), and an unknown listing is the most eligible of all. Stock value never gates the control; the clock **and checkability** do.

### 3.2 One check per listing at a time — the shared in-flight rule

At most **one check per listing is ever in flight**, across all visitors. A visitor who activates the control while a check for that listing is already running **joins** that check: no second worker fires, and the joining visitor's card enters the checking state (§4.2) and resolves with the same result at the same moment. A card that is *rendered* while a check for its listing is in flight renders in the checking state from first paint (§4.2) — the in-flight fact is part of the listing's current state, not a private affair of the visitor who started it. Deduplication is per listing: checks on different listings are fully independent and may run concurrently (§7.4).

### 3.3 The result is shared, immediately and for everyone

When a check completes, its two facts (§0.2) become the listing's facts. Every subsequent render — any visitor, any surface carrying that listing — shows the new stock state and the new checked time, and the card sits in the fresh state (§4.3) until the window lapses. The visitor who started or joined the check sees the update **in place** (§5). No render anywhere may show a superseded stock state once a newer observation exists: the cache that spares the worker is the same cache that serves every reader, and the two must never disagree.

### 3.4 No page-level bookkeeping

Activating a check, joining one, and receiving a result are **not page views** and fire no page-view analytics and no view beacon (Tranche 3 §2.5.7, applied). A check creates **no history entry** and changes **no URL**: it is not local-scope *state* a visitor could share or bookmark — it is a fact about the world, and the URL discipline of Tranche 3 §2 exists for view state, not for facts. Back and Forward behave exactly as they did before this feature existed. Whether check activations are logged internally as freshness telemetry is an engineering/admin matter with no visitor-facing surface; this spec neither requires nor forbids it, and it must never render.

---

## 4. The state set (normative)

Every card carrying a stock line is in exactly one of these five states at any moment. Transitions happen only as listed. Wording in brackets is a copy slot (§10.2); behavior is the contract.

| State | Entered when | The control |
|---|---|---|
| (a) Idle | Last observation ≥ 24h old, or never observed | "Check stock now" offered |
| (b) Checking | A check for this listing is in flight | Replaced by a non-interactive checking status |
| (c) Fresh | Last observation < 24h old | Absent — the stock line carries the freshness itself |
| (d) Stale | The fresh window lapses (≥ 24h) | "Check stock now" offered again |
| (e) Couldn't check | An attempt completed without an observation | Previous facts stand; "Check stock now" offered again |

States (a) and (d) are the same rendering reached by different paths — (a) is where a card starts, (d) is where a once-fresh card returns — and they are specified once, at §4.1/§4.4, with the path difference noted where it matters (it matters only to the date segment's wording).

### 4.1 State (a) — Idle: no check inside 24 hours

- **Trigger:** first render of a listing whose `lastCheckedAt` is null or ≥ 24 hours old, where no check is in flight.
- **Renders:** the stock line exactly as shipped — dot, availability word, friendly date ("Checked Nov 19") or "Not yet checked" — with the check slot trailing it: the "Check stock now" control (§2.1, §2.4). Nothing else on the card differs from the shipped card.
- **The visitor can:** activate the control (→ state (b)); use every other element of the card exactly as today. Activation is a single tap with no confirmation — a check is read-only, costs the visitor nothing, and cannot be undone because there is nothing to undo; a confirmation dialog here would be the hostile pattern the playbook forbids for routine actions.
- **Never-checked listings** are idle in their purest form: the line reads "Unknown · Not yet checked" (or whatever availability the listing carries) and the control offers the listing's *first* observation. No special first-run copy, badge, or emphasis is designed in — the line already says the honest thing.

### 4.2 State (b) — Checking: a check is in flight

- **Trigger:** the visitor activates the control (from (a), (d), or (e)); **or** the visitor renders the card while another visitor's check for this listing is in flight (they join it, §3.2); **or** the visitor's own earlier activation is still running when they return to the card.
- **Renders:** the stock line's facts **do not change** — dot, word, and date stay exactly as they were, because until the worker returns they are still the last observation and the card must not pretend otherwise. The check slot's control is replaced in place by a **checking status**: a small activity indicator plus wording [slot S1: a short present-tense phrase, e.g. "Checking…"]. The status is **not a control** — it cannot be activated, and repeated taps on its position do nothing. The rest of the card is untouched and fully usable: the pill, the heading link, and Report all keep working while a check runs. Nothing else on the page changes; no other card is affected.
- **Timing of the status:** the status replaces the control **in the same frame as the tap** (the ~0.1s instantaneous band). A tap that produces no visible change until the worker answers fails the Doherty threshold and reads as a dead control; the status *is* the acknowledgment. There is no skeleton, no dimming of the card, and no spinner anywhere else on the page — the wait is one line's worth of news and is presented at that size.
- **The visitor can:** wait; scroll away (§5.2); use the rest of the card and the page; activate checks on *other* cards (§7.4). They cannot cancel the check — a read-only fetch shared with every other visitor has no meaningful cancel, and a cancel control that stops only the local display while the worker completes anyway would teach a false model. The absence of cancel is deliberate and is recorded here so its absence is a decision, not an omission.
- **Exit:** exactly one of — the worker returns an observation (→ state (c), §5.1, §6); the attempt fails or times out (→ state (e), §4.5). **The checking state always resolves.** A card may never sit in state (b) past the attempt bound (§7.2).

### 4.3 State (c) — Fresh: inside the 24-hour window

- **Trigger:** a render (or an in-place update, §5.1) where `lastCheckedAt` is less than 24 hours old.
- **Renders:** dot and availability word per the current observation; the date segment changes form — inside the window the day-granular phrasing ("Checked today") wastes the precision the visitor actually cares about, so the segment renders in **relative time** [slot S2: a ladder of "just now" / minutes / hours, e.g. "Checked 2 hours ago"], in the site's friendly voice, computed from the full timestamp (§1.3). **The check slot is empty: no control renders.**
- **The link's state in this window — decided: absent.** The three candidates, ruled:
  - *Present-but-inert* is rejected outright. A control that looks tappable and does nothing is a dead control; the house floor forbids dead controls without JavaScript, and it forbids them with JavaScript too — the principle is the visitor's trust, not the mechanism.
  - *Present as the freshness label itself* (the date segment styled or behaving as the control) is rejected. The date segment is a fact, not an action; making a fact secretly tappable hides the one affordance this feature exists to offer, in the states where it *is* offered, behind an identical-looking non-affordance — a consistency failure that teaches visitors to tap dates.
  - *Absent* is the only honest rendering of §0.3: inside the window there is no action to offer, because a re-check would return the cached answer by definition. The freshness the visitor might want to know is already on the line, stated more precisely than at any other time ("Checked 2 hours ago"). When the window lapses the control returns (§4.4) — its return *is* the signal that re-checking has become meaningful, and a control whose presence and absence both tell the truth needs no label explaining either.
- **The visitor can:** read the freshest stock fact the directory holds, with its age stated to the hour; use the card normally. There is nothing to wait for and nothing to re-do.

### 4.4 State (d) — Stale: past 24 hours, re-check offered

- **Trigger:** the listing's last observation crosses 24 hours. Evaluated at render and at any in-place update; **no live countdown or timed re-render is required** — a card rendered fresh at 23 hours 59 minutes does not sprout a control under the visitor's eyes at the boundary, because a control appearing uncaused mid-read is a distraction bought for a one-minute precision nobody needs. The next render or update shows the stale state truthfully.
- **Renders:** identical to state (a) — dot, word, the friendly **day-granular** date (the relative ladder ends at the window's edge; past it, "Checked Nov 21" is the honest precision), and the "Check stock now" control trailing the line.
- **The visitor can:** activate a re-check (→ state (b)). The result, when it lands, replaces the facts in place (§5.1) — including when it contradicts them (§6).

### 4.5 State (e) — Couldn't check: the attempt produced no observation

- **Trigger:** an attempt the visitor started or joined completes without an observation — the seller's page was unreadable or blocked, the request timed out, or the product page was not found (§7.3 separates the not-found case's wording and its internal handling; the visitor-facing state is this one).
- **Renders — the previous facts stand, byte-for-byte.** Dot, availability word, and checked date render **exactly as they did before the attempt**. They are still the last observation, with its true age, and a failed attempt changes neither what we know nor when we learned it. `lastCheckedAt` does not move; the card does **not** become fresh; the failure is **never** rendered as a stock state — no guessed "Sold out," no softened "Unknown," no removed date. Under the stock line, one quiet notice line appears [slot S4: cause-specific plain-language wording, §7.5] stating that the check could not be completed and that the stock shown is from the date on the line. S4 is stated in its Nadia form: **Wren's marked swap is applied — the retry line is deleted** (COPY S4), because there is no retry horizon to state: this attempt started no window. The check slot returns the **"Check stock now"** control — a retry is a new deliberate activation by the visitor, never an automatic loop. UI-DESIGN §8.5 governs this state's presentation under this model (the control returned in the slot; the notice session-scoped); the notice's dress is exactly UI §8's — only its persistence and the control's presence differ from the reconciled design Mina costed.
- **Why the control returns immediately, with no designed cooldown (Dustin's ruling, 2026-11-22 — this model is confirmed, gate Q-D3 / amendment A2):** no observation was made, so §3.1's eligibility never changed; withholding the control would strand the visitor behind a timer the design cannot justify in their terms ("we failed, so you may not try again" is not a reason a visitor can act on). The endpoint's freshness window keys on the last **successful** check only — a failed attempt is recorded as an attempt (ENGINEERING §§3.3, 7) but stamps no window and moves no eligibility term. If engineering needs invisible rate protection against repeated blocked fetches, that is an engineering control (§13 OQ-CSN-3, ruled 2026-11-22: the invisible compensating controls at §8 only), never a visible lockout.
- **The visitor can:** retry (→ state (b)); use the card normally, including the pill — a failed check says something about our reading of the seller's site and nothing about whether the seller's own page will open for the visitor directly; or report the listing through the existing "Report a problem" path.
- **Persistence:** the notice line is a state of the *attempt*, not of the listing. It renders for visitors who started or joined the failed attempt, in place, and on later fresh renders of the card (a new visit, a refresh) the card renders state (a)/(d) plain — a stranger arriving later sees the stock line and its true date, not a scar from someone else's failed check. (The in-flight rule of §3.2 is the exception that proves this: an in-flight check *is* listing state, because its result will shortly be everyone's fact; a completed failure produced no fact, so it belongs to the attempt alone.) **Delivery discipline (Ada):** a participant receives the notice through the announcement path — exactly once, with the S4 text as the announcement content (Ada §2.4) — and the notice is **never announced to a non-participant**: Ada §7.5's non-participant rule applies to this model's delivery in its stronger form, because a non-participant never renders the notice at all, and the build must not insert it into a non-participant's DOM after their live region registers. Same words, one delivery discipline: announced once to participants, absent — never announced — to everyone else.

---

## 5. Timing honesty — the waiting experience (normative)

A check is a network fetch of a third-party page by a worker. It will take seconds, not the sub-second band of the directory's own in-place updates, and the design says so by its shape rather than by apology copy.

### 5.1 Completion updates in place

When the worker returns an observation, **the card updates in place**: stock dot tone, availability word, and date segment swap **once, atomically**, in the same update — never word-then-dot, never a flicker through an intermediate state, never an optimistic pre-commit (the playbook's rule: an optimistic update that silently lies is worse than an honest wait, and here the design cannot even guess which way to lie). The page does not reload; scroll position does not move; no other card's facts change; the checking status (§4.2) is replaced by the fresh rendering (§4.3) in the same swap. (Card *position* is §6.2's subject: under the shop's grouped sort a section-boundary flip re-orders in place, by Dustin's ruling; everywhere else this paragraph's no-move discipline holds whole.) This is Tranche 3 §2.5.3's discipline applied at card scale: prior content visible until the replacement is ready, then one swap.

### 5.2 Scrolling away, completion off-screen, and returning

- A check belongs to the **listing**, not to the viewport. Scrolling away never cancels it, pausing it is not a concept, and its result lands in the card wherever the card currently sits.
- If the result lands while the card is **off-screen**, the update is **silent**: no scroll is performed, no focus moves, no page-level toast or banner appears. A global announcement for one card's stock change would charge every visitor attention for a fact attached to a card they are not looking at. The card itself is the record; when the visitor scrolls back, it shows the fresh state, and the change emphasis of §6.1 does not replay (a returning visitor sees a truthful card, not a re-enactment).
- If the result lands while the card is **on-screen**, §6.1's communication applies (announcement + transient emphasis), because a fact changing silently in front of a reading visitor is change blindness by design.
- **Backgrounding and restoration** follow the house lifecycle rules: if the visitor backgrounds the tab or the installed PWA is killed mid-check, the check still completes server-side (it was never theirs alone); on return, the card renders or updates to the listing's current state — fresh, or plainly stale — never a resurrected checking status for an attempt that has already resolved. A client that cannot learn the outcome (offline on return, §7.6) renders the last facts it truthfully holds.

### 5.3 What the wait never does

No skeleton replaces the card; no progress bar is shown (the worker's progress is not knowable, and an invented percentage would be a fabricated fact); no estimate is printed ("about 10 seconds" is a promise the seller's server keeps or breaks, not us — the checking wording slot S1 carries no number). The one number the design *does* commit to is the attempt bound (§7.2), and it is a bound on the state, not a promise to the visitor.

---

## 6. Contradiction — a fresh check disagrees with the displayed stock (normative)

### 6.1 On the card: what changes, when, and how it is communicated

- **When:** at the moment the result lands, in the §5.1 atomic swap — not before (no optimistic dress), not deferred to the next render. A visitor who asked "is this still true?" and is looking at the card gets the answer on the card, at the moment it exists.
- **What changes:** everything the new fact governs, in the same swap — the availability word, the dot's tone, the date segment (now the relative fresh phrasing), **and the sold-out dress in both directions**: a flip to `sold_out` steps the card ground down, softens the shadow, and removes the pill's fill (the pill keeps working, per the shipped contract); a flip from `sold_out` to an orderable state lifts the dress in the same swap — raised ground, full pill. A card that keeps yesterday's dress over today's word would be two facts disagreeing on one card.
- **How it is communicated** — three channels, because a silent swap in a peripheral card is a change nobody perceives:
  1. **Announcement.** The card's persistent live region (§9) announces the result **once**, in a form that names both facts [slot S3: e.g. "{Variety} at {seller} — was {old state}, now {new state}, checked just now"]. Naming the old state is not nostalgia; it is what makes the announcement *news* rather than a restatement, and it is the only moment the old fact is ever mentioned — the card itself never renders a "previously…" line (a card states current best knowledge, not its own history).
  2. **Transient emphasis.** The stock line carries a brief visual emphasis on swap (Mina's values, §10.1) — enough to draw the eye of a visitor looking at the card, subtle enough to stay inside the Quiet Ledger's register, and **suppressed under `prefers-reduced-motion`** (the announcement still fires; motion is never the only channel). The emphasis is transient and leaves no residue in any later render.
  3. **Nothing else.** No dialog, no badge, no "updated!" marker persisting on the card, no change to the count line or any page-level region. A stock flip is a routine event in a directory whose whole premise is that stock changes; dressing it as an alarm would train visitors to ignore the one channel (the announcement) that also carries real news.
- **The unchanged case is designed too:** when the check confirms the displayed stock, the swap still happens (the date segment refreshes to the relative phrasing, the control leaves) and the announcement fires in its confirming form [slot S3 variant: "still {state}, checked just now"]. A check that returns the same answer is still an answer — the visitor's tap must never resolve into silence, or the next tap on another card starts from doubt.

### 6.2 On the shop grid: the grouped sort and a live flip — designed, with one flag

The shop's resting order is the grouped order (§1.2): orderable section first, not-orderable below, name A–Z within each. A check that flips a card across the section boundary (in stock → sold out, or the reverse) puts the grid in temporary disagreement with its own stated order. The candidates:

- **Re-order in place on completion — RULED (Dustin, 2026-11-22, OQ-CSN-1).** When a check flips a card across the grouped sort's section boundary, the card **re-orders immediately** to its new section, at its variety-name A–Z position within it (and the reverse flip re-orders it back). **Ada §3.5's conditions attach as build requirements:** the flipped card's DOM node is **moved, never remounted** — the same node keeps focus, focus order, and any in-progress interaction; focus resting on any *other* card must not change its element or its position relative to the reader's place; and the behavior ships only on a passing **CSN-15-style keyboard drive across the re-order** at the build gate (CSN-9 carries the check). Absent that proof, hold-position is the only outcome under which Ada's focus guarantee is unconditional — that is the recorded accessibility price of this ruling, stated by Ada as input, not as a veto.
- **Scope of the ruling.** The grouped sort's section boundary is what was ruled. Under "Name A–Z" a flip changes no position in any case. Under "Recently checked" and on the variety page's ledger stack, a check does **not** move its card — those orders were not the ruling's subject, and the original hold behavior stands there until ruled otherwise.
- **Hold position until the next render — this seat's recommendation, recorded as RULED AGAINST, faithfully.** My recommendation was: the flipped card updates its facts (and its dress) in place and keeps its position; the grid re-sorts at its next render for any reason. The reasoning stands on the record: the card the visitor is reading leaves their hand mid-read; every card between its old and new positions shifts by one cell, so the *whole grid* moves to correct *one* card; a focused element that relocates in the DOM risks dropped focus in exactly the interaction §9 works to protect; and Tranche 3 §2.5.2's preservation rule is the house contract for in-place updates. Dustin weighed this and ruled re-order in place. The recommendation is not deleted or softened — it is the ruled-against position, and if the build gate's keyboard drive fails, it is the fallback this record points to.

### 6.3 Everywhere else

The variety page's listing stack does not re-order (it has no stock-based order to violate — §6.2's scoping covers it without exception). Per-option filter counts on the shop, the shop's result count, and the seller-count lines elsewhere are render-time facts: a check does not recompute them in place (stock is not a filter facet, so no count it feeds exists), and they take the new fact at their next render like everything else.

---

## 7. Failure and edge cases (normative)

### 7.1 The failure invariant

A failed attempt — any failure, any cause — **changes nothing the directory states**: availability, `lastCheckedAt`, packets, notes all stand; a failure is never cached as an observation (§0.2); the freshness clock does not move; and **no 24-hour window starts** — the endpoint/freshness window keys on the last **successful** check only (Dustin's ruling, 2026-11-22), so eligibility (§3.1) is unchanged and the control is immediately available again (§4.5). The only things a failure may produce are the §4.5 notice for the attempt's participants and internal telemetry with no public surface.

### 7.2 Timeout

The checking state must resolve. The attempt carries a **bound pair, stated as one rule** (gate Q-D6; CSN-12 as re-pointed): ENGINEERING §1.4's **25-second executor deadline**, at which the attempt records the timed-out outcome (cause: timed out, §4.5), inside a **30-second client polling ceiling**, past which a card never sits in checking. The deadline produces the outcome; the ceiling bounds the wait. A late result arriving after the deadline is handled as what it is, a completed observation: if it arrives while the card still shows the couldn't-check notice from the timed-out attempt, the card updates in place to the fresh state and the notice leaves in the same swap (the §5.1 rule — a newer fact always wins over an older notice). No visitor-facing wording states either number.

### 7.3 The product page is gone (404) — couldn't check, and a signal, never a stock state

A 404 from the listing's product URL is **state (e), couldn't check** — with its own wording slot (§7.5) — and it is **never** evidence of sold out, discontinued, or any other stock state. The reasoning is the directory's no-invention discipline applied to HTTP: a 404 says the *page* is not there. Pages vanish because shops restructure, URLs change, seasonal storefronts close and reopen, and platforms migrate — each fully compatible with the seed being orderable today at a corrected address. Printing "Sold out" from a 404 would be a guessed stock state, which the commission forbids by name. What a 404 *is* evidence of is a suspect product URL, and that signal goes **inward, not outward**: the attempt records it where the directory's data-quality work can see it (the same inward path a "Report a problem" takes), so a listing whose URL has died can be corrected or retired by the processes that own listing data. The visitor is never shown an accusation about the seller ("this seller's page is broken" is not ours to publish from one fetch), and a single 404 changes nothing about the listing's standing. Whether repeated 404s should escalate automatically is flagged as OQ-CSN-2 (§13) with a recommendation.

### 7.4 Many cards, checked in sequence — per-card independence

Each card's slot is its own state machine. A visitor may check card after card down a page: each enters (b) on its own tap, resolves on its own worker, and announces on its own live region (§9), once. Checking one card never disables, dims, or queues another card's control; a page-level "checking…" indicator never appears; the failure of one check touches no other card. Two listings of the *same variety at different sellers* are different listings with different product pages — fully independent checks, and one seller's answer never colors another's card. (The same listing never appears twice on one page in either surface's current composition; if a future surface renders it twice, §3.2's per-listing rule means both instances show the same state and resolve together — the state belongs to the listing, and duplicate renderings of one listing are one state shown twice.)

### 7.5 Cause-specific wording, one state

State (e) is one state with three wording slots [S4], because the visitor's recovery differs by cause and honest wording names the cause we actually observed:

- **Unreadable / blocked** — the seller's site would not let us read the page, or returned something we could not read as a product page.
- **Not found** — the seller's page for this listing could not be found (§7.3).
- **Timed out** — the check took too long and was stopped (§7.2).

Each wording carries the same two obligations: it says the check did not complete, and it points at the stock line's date as the age of what is shown. None of them names a technology, a status code, a worker, or a vendor — plain language, no error codes (the playbook's error-message rule), and no public attribution of the failure to the seller beyond the observable fact.

### 7.6 Offline and connection loss mid-check

If the visitor's connection drops while a check runs, the check itself is unaffected (it is server-side and shared); the *client* may be unable to learn the outcome. On reconnection or next render the card shows the listing's true current state. A client that timed out locally while the worker later succeeded resolves exactly as §7.2's late-result rule states. No "you are offline" state is designed into the card: the card's facts and their dates remain true and readable offline, which is the honest offline behavior for a read-only fact (the playbook's offline rule — say what is available and how old it is; the date segment already does).

### 7.7 The sold-out listing that stays sold out

A check on a sold-out listing that returns sold out is a **success**, rendered as state (c): same word, same dress, fresh relative date, control gone for 24 hours. This is a designed outcome, not a disappointment state — it is the directory telling the truth with a fresh timestamp, and it is what makes the reverse flip (§6.1) believable when it comes. No "still sold out" emphasis, apology, or suggestion copy is added; slot S3's confirming announcement covers the communication.

### 7.8 Listings whose seller is gone or whose listing is retired mid-check

If the listing or seller is removed (the existing 410 path) while a check is in flight, the card's own surface rules govern — the check adds no behavior here. A result that lands for a listing no longer published is simply never rendered. No special state is designed; inventing one would specify behavior for a composition that cannot occur on a rendered page.

---

## 8. The no-JavaScript floor (normative)

The house floor is absolute: **the control must never be a dead control without JavaScript, before hydration, or when hydration fails.** The §2.4 element choice exists to satisfy it:

- **As rendered (no JS):** the control is a submit button inside a minimal form, `method="post"`, whose action is the listing's check endpoint, carrying the originating page and the card's anchor as its return. Activating it **navigates** — that is what a floor is (Tranche 3 §2.6.4's principle: the floor may navigate; it may never present a control that does nothing). The endpoint starts or joins the listing's check (§3.2 applies server-side identically), and returns the visitor to the **same page, anchored to the same card**, where the server renders the card's then-current state: the fresh result if the check completed within the request, the checking state as plain non-interactive text if it is still running (a refresh then shows the outcome), or the §4.5 couldn't-check notice if it failed. A POST is specified, not a GET link, for two reasons: a check is a state-changing action and a GET endpoint would let browser prefetchers and link scanners fire workers nobody asked for; and a form needs no JavaScript to be a real control, which a bare button does.
- **Enhanced (JS present):** the same form's submission is intercepted; the check runs in place under §§4–6 and the page never navigates. The enhanced and floor paths land on identical states — a floor round-trip and an in-place update of the same check produce the same card.
- **Pre-hydration:** a tap that lands before hydration takes the floor path (a real form submission) — there is no dead window at the start of a page's life.
- **In the fresh state** there is no control and therefore no floor question; in the checking state the floor renders the status as text, exactly as the enhanced path does.
- **The endpoint's abuse posture (ruled by Dustin, 2026-11-22):** Turnstile is **off in v1, wired behind config** (ENGINEERING §6.2, Q4 as ruled). The compensating controls that carry v1 are engineering's, and they are the endpoint's whole abuse story: **per-domain pacing** (≥5 seconds between requests to the same host, ENGINEERING §5.1), a **global daily fetch ceiling** (3,000 fetches/day, ENGINEERING §6.4) with the **kill switch** (`STOCK_CHECK_ENABLED`) degrading the endpoint to last-known state with zero fetches, and **numeric-id only** input — the caller supplies only a numeric listing id and the fetch target is read server-side from the catalog row, so the endpoint cannot be aimed at an arbitrary URL (ENGINEERING §6.3). If the check log ever shows trigger abuse, Turnstile is switched on by configuration, without a redesign.

---

## 9. Dynamic accessibility — floors stated for Ada's ruling (normative inputs)

Ada rules on values; these are the structural floors her pass starts from, stated here so the build cannot pre-empt her:

1. **Persistent per-card live region.** Each stock line's wrapper is a live region present in the document from first render, `aria-live="polite"`, `aria-atomic="true"`, never remounted across any state change (the Tranche 3 §2.5.9 pattern, at card scale). Its text changes **once per resolution** — the §6.1 announcement (or its confirming variant) — and **once on entering the checking state**, via the status element's own announcement [S1]. No other transitions announce. A card a visitor never interacts with announces nothing, ever (§4.5, §5.2).
2. **Focus is never dropped and never stolen.** The check slot (§2.1) is a persistent wrapper that never unmounts; only its contents change. On activation, when the control is replaced by the checking status, focus transfers to the status element (`tabindex="-1"`) — this spec's one stated focus exception, on the Tranche 3 §2.6.3 precedent (a control that removes itself lands focus by design, not by accident). On resolution: if focus is still on the status element and the fresh state offers no control, focus lands on the card's heading link — the card's always-present primary control, one stop earlier in the card's tab order; if the visitor has already moved focus elsewhere, **it is never touched**. In state (e) the control returns inside the same slot; focus resting on the status element transfers to it. Ada rules the final landing; the invariant — focus is always *somewhere deliberate inside the same card* — is the floor.
3. **State is never carried by color alone.** The dot already pairs with the availability word (shipped); the checking state pairs its indicator with wording [S1]; the couldn't-check state is a text notice, not a tint. Nothing in this feature's state set is signaled by the dot's color, a background change, or motion alone.
4. **Targets.** The control's hit area meets the 44px house standard (§2.3) in both card types, with clear space from the heading link above and the packet lines below; the status element is not a target and takes no taps. Measured on both axes in the rendered DOM (CSN-11).
5. **Accessible name.** The control's visible text is Dustin's fixed "Check stock now"; its accessible name adds the listing's identity [slot S5: "{variety} at {seller}" pattern], because a variety page carries up to dozens of identically labeled controls and a screen-reader user tabbing them must be able to tell them apart — the name matches the visible label first (label-in-name), then disambiguates.
6. **Motion and reflow.** The §6.1 emphasis honors `prefers-reduced-motion`; no state change shifts layout at 320px width or 200% text resize beyond the stock line's own growth (§2.3); the checking indicator's motion is decorative-redundant (the wording carries the state) and stills under reduced motion.
7. **Semantics.** The control is a button (§2.4); the checking status is a status, not a button and not a link; the couldn't-check notice is plain text in the card flow (it is not an alert — nothing requires the visitor's immediate attention, and `role="alert"` is reserved by house discipline for the filter-failure case of Tranche 3 §2.5.6).

---

## 10. Slots for the collaborator passes

### 10.1 Mina (UI design) — visual values, hers to rule

The slot's dress inside the stock line (weight, tone, underline treatment — it must read as the line's quiet trailing element, never competing with the availability word's tone or the pill); the expanded target's geometry within the line box (§2.3); wrap behavior on the narrow grid column (no mid-phrase break of the link text; separator behavior at the wrap point); the checking indicator's form and motion; the §6.1 transient emphasis values and duration; the couldn't-check notice line's dress (quiet, in the card's muted register); skeleton parity — any skeleton of a listing card gains a slot bar in the trailing position so a loading card promises the control it will carry. No new tokens are proposed by this spec; if her composition needs one, it is flagged in her pass.

### 10.2 Wren (copy) — wording slots, hers to rule

The obligations are this spec's; the words are Wren's. **"Check stock now" is Dustin's fixed text and is not in her scope to change.**

- **S1 — Checking status:** a short present-tense phrase naming the act, no time estimate, no technology (no "worker," no "fetching").
- **S2 — Fresh relative ladder:** the phrasing set for the date segment inside the window — the rungs are "just now" (under a minute), minutes, and hours, up to the 24-hour boundary; sentence rhythm must sit inside the shipped line's pattern ("· Checked {relative}"). The ladder applies to *every* observation inside the window, however produced (§0.1).
- **S3 — Result announcements:** the changed form (names old state, new state, and the check's recency) and the confirming form (names the state as still holding), per §6.1. These are live-region texts; they are not rendered visibly anywhere.
- **S4 — Couldn't-check notices:** three cause variants (§7.5), each carrying the two obligations (check did not complete; the shown stock is as of the date on the line), in plain language with no status codes and no blame assigned to the seller beyond the observable fact.
- **S5 — Accessible name pattern** for the control (§9.5).
- Wren also confirms the stale/idle line still reads as one sentence with the control trailing it, in both card contexts, including the "Not yet checked" form.

### 10.3 Ada (accessibility) — floors stated at §9, values hers

Focus landing on resolution (§9.2); target geometry sign-off (§9.4); the live-region cadence (§9.1 — two announcements per deliberate activation at most, none otherwise); the accessible-name pattern (§9.5, with Wren); forced-colors survival of the slot's states; the checking indicator under reduced motion. Her WCAG 2.2 AA pass runs on the assembled design after Mina, as on every public surface.

---

## 11. Difference register — every rendered difference vs the shipped cards (closed list)

If it is not in this register, it must not change.

| ID | Difference |
|---|---|
| D-CSN-1 | **New:** a check slot trailing the stock line on both listing-card types (variety-page Quiet Ledger, variety context; shop grid card, shop context), rendering per §4's state set. Absent entirely from browse-context variety cards (§1.4). |
| D-CSN-2 | **Changed:** inside the 24-hour window, the stock line's date segment renders in relative time [S2] instead of the shipped day-granular form. This applies to any observation inside the window, however produced — including crawl observations that today would read "Checked today." Outside the window the shipped form is byte-identical. |
| D-CSN-3 | **New:** a checking status (indicator + wording [S1]) that replaces the control in the slot while a check is in flight, including at first paint when a check started by another visitor is running. |
| D-CSN-4 | **New — revised (2026-11-22, per the gate's CSN-17 note, in the form confirmed by Dustin's Nadia-model ruling):** a couldn't-check notice line under the stock line, shown only to an attempt's participants after a failed attempt (§4.5), in one of three cause wordings [S4 in its Nadia form — Wren's marked swap applied, the retry line deleted]. The control returns immediately alongside it (§4.5) — a failed attempt starts no window. Never part of a fresh render; announced exactly once to participants and never announced to a non-participant (§4.5, Ada §§2.4, 7.5). |
| D-CSN-5 | **Changed (behavior, not anatomy):** a card's stock facts and sold-out dress can now change in place, without a page load, when a check resolves (§§5.1, 6.1) — including a transient emphasis on the stock line at the moment of change. A card changes position only under §6.2's ruled exception (a section-boundary flip under the shop's grouped sort re-orders in place — Dustin's OQ-CSN-1 ruling, 2026-11-22, under Ada §3.5's conditions); no other list or sort re-orders as a result of a check. |
| D-CSN-6 | **New (DOM, invisible):** the slot is a minimal POST form (§8); the stock line's wrapper becomes a persistent per-card live region (§9.1). Neither has any visual expression of its own. |
| D-CSN-7 | **Geometry:** the stock line's line box grows to hold the control's 44px target while the control is present (§2.3); in the shop grid the pinned footer absorbs the variance. No other element's geometry changes. |
| D-CSN-8 | **Unchanged, stated to prevent drift:** the stock line's dot, tones, availability words, and day-granular date form outside the window; packets, notes, heading, subline, stem rule, footer, pill contract (`/go/{id}`, new tab, `nofollow`); the variety page's card order; the shop's filters, search, sort controls, counts, applied row, pagination, and thresholds; prices — never shown, and no price enters any check payload or result. |

---

## 12. Acceptance checks — for Quinn's gate (series CSN; all executable)

Run in a fresh scratch worktree per the standing gate approval. Real-browser drives at 390px first, then 820px and 1280px. Fixtures: listings seeded at controlled `lastCheckedAt` values (never checked; 1 hour ago; 23h59m ago; 24h01m ago; 30 days ago), a stub worker that can be made to return each availability value, to hang past the bound, to 404, and to refuse the fetch — because the live catalog cannot be asked to produce these on demand. Test surfaces: a variety page with several sellers' cards, and a shop page under the grouped default sort with cards seeded on both sides of the section boundary.

- **CSN-1 (placement, both cards):** DOM inspection on both surfaces: the control is the final element inside the stock line's paragraph, after the date segment, in idle and stale states; it appears nowhere in the footer, heading row, or art frame; browse-context variety cards on `/variety` contain no check control in any state.
- **CSN-2 (wrap and geometry):** at 390px on the shop grid, a stale card's stock line wraps without breaking "Check stock now" mid-phrase and without horizontal scroll at 320px or clipped text at 200% resize; the control's rendered target measures ≥ 44px tall on both card types (DOM-measured, both axes). **Added case (Ada §7.4, gate §2 re-point):** at 320px on the grid card **with WCAG 1.4.12 text-spacing overrides applied** — the control unit widens to ≈135px in a 108px measure — assert no horizontal scroll and no clipped phrase; if that case fails, the permitted fix is wrap-under-override-conditions only — the design-size `nowrap` stands.
- **CSN-3 (eligibility boundary):** the 23h59m fixture renders fresh (no control, relative date segment); the 24h01m and never-checked fixtures render the control; the 1-hour fixture renders relative phrasing [S2]; a crawl-produced timestamp inside the window behaves identically to a check-produced one (§0.1). **Added fixtures (gate §2, adapted to the confirmed Nadia model, §3.1):** (i) a listing whose last attempt **failed** 1 hour ago, with an old observation (30 days), renders the control **present and retryable** — a failed attempt starts no window — and a fresh render of that card carries no notice (§4.5); (ii) a `not_checkable` listing (a `manual_only` seller's listing; and a null-`product_url` listing) with an observation ≥ 24h old renders **no control and no notice**; (iii) a listing on a **block-listed** domain renders **no control**.
- **CSN-4 (checking state):** tapping the control replaces it with the checking status in the same frame (no perceptible delay, no skeleton, no page spinner); the stock facts on the line do not change while checking; the status is not activatable (taps on it fire nothing — worker invocation count stays 1); the pill, heading link, and Report remain operable throughout.
- **CSN-5 (joining and deduplication):** with a check for a listing held in flight by the stub, a second browser session rendering that card sees the checking state from first paint; activating from a stale render in a third session fires no second worker invocation; all sessions resolve to the same result at the same time.
- **CSN-6 (fresh result):** on completion, the initiating card swaps dot, word, and date segment in one update with no reload (document identity and scroll position verified unchanged); the control is absent; the date segment reads in the relative ladder; a fresh page load in another session renders the identical fresh state server-side.
- **CSN-7 (contradiction, both directions):** stub a flip in-stock → sold-out and, on a second card, sold-out → in-stock: the word, dot tone, and sold-out dress (ground, shadow, pill fill) all change in the same swap; the live region announces once, naming old and new states [S3]; a confirming check (same state returned) announces the confirming form and refreshes the date segment. **Timing and non-persistence (PB-W4; Ada §2.5, gate §2 re-point):** the S3 announcement is inserted **in the same DOM update as the swap it describes**; it is never stored, queued, persisted, server-rendered, or replayed; a fresh render, a reload, and a return visit each contain **no S3 text**.
- **CSN-8 (off-screen completion):** start a check, scroll the card off-screen, let it resolve: scroll position does not move at resolution, no toast/banner/focus change occurs, and scrolling back shows the fresh state with no emphasis replay.
- **CSN-9 (grouped sort re-order — OQ-CSN-1 as ruled by Dustin, 2026-11-22):** on the shop grid under the grouped default, flip a top-section card to sold out: the card updates in place (facts and dress, §6.1) and **re-orders immediately** to the not-orderable section, at its name A–Z position within it; a reverse flip re-orders it back to the orderable section. **Ada §3.5's conditions are part of this check:** the flipped card's DOM node is **moved, never remounted**, and a **CSN-15-style keyboard drive across the re-order** — focus on the flipped card's heading and on its slot, driven across the move in a real browser — **must pass at the build gate**; absent that proof, the re-order does not pass this check. Under "Name A–Z" a flip changes no position; under "Recently checked" and on the variety page's ledger stack, a completed check does not move its card (§6.2's scoping).
- **CSN-10 (couldn't check):** stub a refused fetch: the stock word, dot, and date are byte-identical to before the attempt; `lastCheckedAt` is unchanged (payload-verified); the notice line [S4, unreadable variant] appears under the stock line for the participant; the control is present again immediately; a later fresh visit in a clean session shows no notice.
- **CSN-11 (404 is not a stock state):** stub a 404: the card enters state (e) with the not-found wording; the availability does **not** become sold out or unknown-changed; the previous facts stand; the attempt is recorded on the inward data-quality path (admin/internal surface check, per the build's implementation of §7.3).
- **CSN-12 (timeout and late result):** hold the stub past the **25s executor deadline**: the attempt records the timed-out outcome; the card resolves to state (e) with the timed-out wording [S4-C] **no later than the 30s client polling ceiling** and never sits in checking past it (the bound pair as one rule, §7.2); a server result that lands after a client-side timeout updates the card in place to fresh and removes the notice in the same swap (§§7.2, 7.6).
- **CSN-13 (per-card independence):** on one page, start checks on three cards in sequence: each runs and resolves independently; one stubbed failure among them affects only its own card; no page-level indicator appears; announcements fire once per card, on that card's region only.
- **CSN-14 (no-JS floor):** with JavaScript disabled, the control submits its form and returns to the same page anchored at the same card, rendering the outcome (fresh result, checking-as-text, or couldn't-check notice) server-side; at no point is the control inert; repeat with a pre-hydration tap in an enabled browser (throttled) — the floor path handles it identically.
- **CSN-15 (focus and keyboard):** keyboard-only drive: tab to the control, activate with Enter and with Space; focus lands on the checking status, and on resolution to fresh lands per §9.2 (heading link if it never moved; untouched if the tester moved it during the wait); **state-(e) case, in its Nadia form (Ada §3.3): on resolution to couldn't-check, if focus still rests on the checking status it lands on the returned control inside the same slot; if the tester moved focus during the wait, it is never touched**; focus is never on `body` at any sampled moment; tab order through the rest of the card is unchanged.
- **CSN-16 (bookkeeping and payload hygiene):** network log across a full check cycle shows no page-view beacon and no history entry (history length unchanged; Back behaves as before the feature); the check request and result payloads contain a stock state and a timestamp and **no price field or price string**; no render in any state shows a price.
- **CSN-17 (register audit):** before/after comparison across both surfaces shows exactly D-CSN-1…D-CSN-7 and nothing else — in particular the footer, pill contract, stem rule, packets, counts, and sort controls are unchanged, and no card's position differs between before and after renders at identical data.

---

## 13. Pushback, conflicts, and open questions

### Pushback and flagged conflicts

- **PB-CSN-1 — The 44px target inside a 13px line is a real tension, resolved for the house standard.** Best practice and the house floor agree on the target size; the Quiet Ledger's register is quiet, small text. The slot will make the stock line's box taller whenever the control is present (§2.3, D-CSN-7). I am not shrinking the target to protect the silhouette: a control a cold thumb cannot hit is a control that does not exist, on the surface this directory is phone-first for. Flagged so the cost is seen, not discovered.
- **PB-CSN-2 — Button semantics under Dustin's word "link" (§2.4).** The visible design honors the word completely (small, quiet, inline text). The element is specced as a button-in-form because it performs an action and because the no-JS floor requires a form. If Dustin wants a literal link element, the floor has to be re-cut around a GET endpoint, with the prefetch exposure §8 names — his call to make knowingly, not mine to make silently.
- **PB-CSN-3 — Against ever showing a per-check "last attempted" time.** It will be suggested (it always is) that a failed check should print when it was attempted. Rejected here in advance: two dates on one stock line — observed and attempted — is exactly the two-facts-disagreeing failure §6.1 forbids, and "attempted" is a fact about us, not about the seed. The line carries one date: when the stock was last actually seen.
- **Conflict noted, none unresolved silently:** the playbook's announcement discipline for dynamic regions ("announces no loading or intermediate states") is written for result counts; §9.1 announces the checking state once, because for a *deliberate per-card action* the activation feedback is the SR user's equivalent of the visible status change, and withholding it would leave the tap unacknowledged for seconds. The result-count rule itself is untouched — this feature announces no counts anywhere.

### Open questions for Dustin — each with my recommendation

- **OQ-CSN-1 — Grouped sort vs a live flip (§6.2) — RULED by Dustin, 2026-11-22: re-order in place.** When a check flips a shop card across the grouped sort's section boundary, the card re-orders immediately, under Ada §3.5's conditions (moved, never remounted; a passing CSN-15-style keyboard drive across the re-order at the build gate). §6.2 and CSN-9 are written to the ruling. **My recommendation — hold position until the next render — is recorded at §6.2 as ruled-against, faithfully; it is not the design.**
- **OQ-CSN-2 — Repeated 404s (§7.3).** One 404 records an inward data-quality signal. Should repeated 404s across separate checks (say, three attempts on different days) escalate — flagging the listing for review or correction through the existing admin/report path automatically? **Recommendation: yes, escalate inwardly at three** — never automatically changing anything public; a dead product URL is precisely the stale data this feature exists to surface, and three independent observations is evidence, not noise.
- **OQ-CSN-3 — Retry protection after repeated failures (§4.5) — RULED by Dustin, 2026-11-22.** The visible behavior stands exactly as designed: the control returns immediately after a couldn't-check, with no visible cooldown and no lockout a visitor can see — a visible timer would punish visitors for our failure. Protection is invisible and engineering-side only: the compensating controls at §8 (per-domain pacing, the global daily fetch ceiling, the kill switch, numeric-id only), with Turnstile off in v1 behind config. (Gate disposition: under the confirmed Nadia model this recommendation applies as written; the attempt window is not a protection, because a failed attempt starts no window.)
- **OQ-CSN-4 — Does a check ever refresh anything beyond stock on the card?** The commission's result is stock + time, and §0.2 holds that line. But a worker reading a product page will sometimes see that packet sizes changed too. **Recommendation: not in this programme item** — surfacing packet changes is a second feature with its own truth problems (which reading wins, crawl or check?) and should be commissioned on its own if you want it. Recorded so the boundary is a decision, not an accident of the build.

---

*— Nadia, UX Design. Evidence: playbook `specialist_ux_ui_design/SKILL.md` (heuristics, laws, in-place/dynamic training pass); code from `origin/main` via `git show` in the CSN worktree — `ListingRow.tsx` (stock line anatomy, contexts, sold-out dress, footer contract), `Availability.tsx` (`AVAILABILITY_LABEL`, tones), `lib/format.ts` (`formatCheckedDate` day-granular vocabulary), `lib/validators/index.ts` (`lastCheckedAt: dateish` — ISO date or timestamp), `lib/repositories/ingest.ts` (observation upsert writes `lastCheckedAt` from the observation's `checkedAt`); `shop-design/SPEC-GRID-CARD.md` §3.3 (shop card anatomy — stock line byte-for-byte the ledger's) and `shop-design/SPEC.md` §7.5 (OQ-3 grouped sort: orderable `in_stock`/`preorder` first, not-orderable below, name A–Z within sections) and §3.5 (contact-block conventions, for the footer-competition analysis); Tranche 3 SPEC §2.5 (in-place contract: preservation, budgets, URL/history, live regions, bookkeeping) and §2.6.3 (the focus-landing precedent). No code was written or changed by this spec, and no other specialist was dispatched — Mina, Wren, and Ada hold slots at §10, to be commissioned in sequence.*
