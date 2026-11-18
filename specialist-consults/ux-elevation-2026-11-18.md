# UX Elevation Consultation — Seed Directory (seeds.hues.flowers)

**From:** UX/UI specialist · **Date:** 2026-11-18 · **Type:** Consultation only — no code changed, nothing deployed.
**Brief:** Dustin asked (voice call, 2026-11-18) how small elements might elevate how the site *feels*.

**Method & evidence limits:** Read of the v2 codebase (components, globals.css, SW, PWA registration), served production HTML for /, /variety, /crop, /crop/zinnia, a variety page, a seller page, /search, /add-your-farm, /account (all 200; full-HTML responses 33–274 KB, 1.3–2.6 s from this VM), and the theme-preview screenshots (some predate the current header/tab build — where a screenshot and the code disagree, the code wins). This VM's headless browser cannot reach production through Cloudflare, so no DOM measurements or device passes were possible; every proposal below needs the playbook's rendered-surface verification when built. Settled decisions (grids, no seller counts on crop cards, new-tab outbound links, no displayed attributions, prices never shown) were not relitigated.

**What's already good (keep, don't spend here):** designed 404 / offline / zero-result states with their own art; search autocomplete as a proper ARIA combobox with live status announcements; one-click waitlist join for signed-in users; a real thank-you state on Add Your Farm; global `prefers-reduced-motion` handling; strong focus-visible treatment with scroll-padding so focus is never hidden behind the tab bar; card frames that reserve their aspect ratio (no layout shift); the tab bar's reserved active dot. The bones are unusually sound. What follows is feel, not repair.

---

## 1. Audit — the five roughest feel-moments today

**R1. Every filter tap is a blind, full-page reload — and the skeleton that would soften it exists but is never used.**
Filter chips and pagination are plain links to server-rendered pages. There is no `loading.tsx` anywhere in the app (verified), and the `.skeleton` style defined in `globals.css` is referenced by zero components. So the site's core loop — tap a Hue chip, tap a Season, turn a page — gives the visitor *no feedback at all* for the length of a server round-trip, then hard-repaints and returns them to the top of the page, away from the grid they were studying. This breaks the Doherty Threshold (respond within ~400 ms or show progress) and the visible-system-status heuristic on the single most repeated interaction on the site.

**R2. The waitlist join — the site's one real conversion — ends flat.**
For a signed-in visitor, tapping "Join the waiting list" disables the button, waits, and the block quietly re-renders as "You're on the waiting list." No peak, no confirmation moment, no "here's what happens next" beyond a channels line. For a signed-out visitor the emotional beat is worse: they finish a form and land on a 6-digit code step, so the experience *ends* on homework instead of on "you're on the list." The Peak-End Rule says this ending is what they'll remember of the whole visit. The block's loading state is also a bare text "Loading…" while the rest of the site has a skeleton vocabulary.

**R3. Paintings pop in instead of arriving.**
Card and hero images are plain `<img>` with no load transition. The frames reserve space (so nothing jumps — good), but on any real-world connection the grids sit as flat paper rectangles and then each painting snaps in at full opacity, one by one. It reads as breakage for a beat, then as cheapness. Perceived performance, not actual performance, is the problem.

**R4. A PWA update can reload the page out from under a half-finished form.**
`PwaRegister` reloads the page on `controllerchange`, and the worker checks for updates on load, on tab-visible, and hourly. That auto-reload was a deliberate fix for the stale-shell incident (a visitor stranded on a mixed old/new shell), and it works — but its cost is that a new deploy can vaporize an in-progress Add Your Farm submission, signup, or code entry with no warning. Losing a user's input to an update is the exact failure the app-lifecycle guidance warns against. (Conflict flagged — see §3.)

**R5. Nothing remembers where you've been, so comparison shopping starts over every time.**
The core journey is comparative: open a variety, visit two or three farm shops (each in its own tab, per the settled new-tab rule), come back, compare again. On return, the variety page is pristine — no marker on the listing you already visited, no "recently viewed" anywhere on the site. Every return is a cold re-orientation. Recognition-over-recall is the principle; the fix is small (P5/P6).

*Also noted, smaller:* on mobile the home hero still stacks art → headline → intro copy → search, so the site's primary job (search) sits roughly a full screen down on a phone (desktop's two-column hero is fine). Guide-tab panels switch instantly with no transition — correct, but a beat of polish is available cheaply. The hamburger menu would normally draw a discoverability flag from me; here the visible mobile tab bar carries the primary destinations, so the risk is already mitigated by design — no action proposed.

---

## 2. Proposals — ranked, top 3 first

### P1. Route loading skeletons, built from the skeleton style that already exists ★
- **What/where:** Add `loading.tsx` for the main routes (/variety, /crop, /crop/[slug], /variety/[slug], /seller/[slug], /search), each a quiet paper-deep pulse in the *exact* shapes the real page will occupy — filter strips, card grid at the real column counts, listing rows. The `.skeleton` class and its keyframes are already in `globals.css`, unused.
- **Why:** Doherty Threshold + visible system status. The wait doesn't get shorter; it stops being blind. A skeleton that matches the layout also promises the right shape, so the content landing feels instant rather than jarring.
- **Effort:** S–M (one shared skeleton kit, then per-route assembly).
- **Risk:** A skeleton shown for a sub-300 ms load flashes and makes a fast page feel unstable — delay the pulse's visibility slightly (~200 ms fade-in) so fast navigations stay silent. Pulse is already flattened under `prefers-reduced-motion` by the global rule. Skeletons must be `aria-hidden` with a polite live announcement of loading for screen readers.

### P2. Keep the visitor's place when filters and pages change ★
- **What/where:** On /variety, /crop/[slug], /search: filter chips and pagination stop bouncing the visitor to the top of the page. Preserve scroll (Next's `scroll={false}` on those links), and when the grid's top has scrolled off-screen, return the visitor to the grid's heading — not the page top. Make the existing result-count line ("42 varieties match · …") a polite `aria-live` region so screen-reader users hear the new count without re-navigating.
- **Why:** User control and freedom + recognition over recall. Filtering is a conversation with the list; resetting the room after every sentence is what makes the current browse feel laborious despite being fast enough.
- **Effort:** M (link props + a scroll/focus decision per template + live-region wiring).
- **Risk:** If a filter shrinks results to one page, a preserved deep scroll can strand the visitor in empty space — mitigate by clamping to the results heading when the previous position no longer exists. Focus must never be moved in a way that traps or disorients keyboard users; announce, don't yank.

### P3. Give the waitlist join a real ending ★
- **What/where:** The `WaitlistBlock` success state becomes a designed moment: the stem motif, "You're on the waiting list for {Variety}," and one plain sentence of what happens next ("We'll text you the moment a farm lists it — one alert, that's all"). For signed-out joiners, lead with that confirmation and frame the code step *under* it as "One last step so your alerts can actually reach you," instead of the code step being the whole story. Swap the block's "Loading…" text for a small skeleton in the card's shape.
- **Why:** Peak-End Rule. Joining a waiting list is the one act of trust the site asks for; its ending is currently the flattest moment on the page.
- **Effort:** S (state markup + copy in one component).
- **Risk:** Honesty is the constraint — alerts are *held* until email/phone verification, and the copy must never claim alerts are live before they are. The existing held-state logic already knows the truth; the celebration copy must be wired to it, not pasted over it. No motion beyond the existing 160 ms fades; nothing here needs animation to work.

### P4. Let paintings fade in as they load
- **What/where:** Card and below-fold illustrations (variety/crop card images, pod motifs) start at opacity 0 and fade to 1 over ~250 ms when the image actually loads, over the paper ground already behind them. Hero/LCP images are excluded — they should be instant, never faded.
- **Why:** Perceived performance. The grid stops looking broken-then-sudden and starts looking *printed* — which is the whole Illustrated Seed Catalogue idea.
- **Effort:** S (one client wrapper or an `onLoad` class swap on the shared image components).
- **Risk:** Must degrade to fully visible with JS off or image error (never trap a painting at opacity 0 — tie the reveal to the load event with a no-JS-visible default). Global reduced-motion rule already zeroes the transition. Keep it off the LCP path.

### P5. A "Pick up where you left off" rail
- **What/where:** The last ~6 variety/crop pages a visitor opened, kept in `localStorage` on their device only, shown as a small card rail on the home page (and the empty-search state) once at least two exist. Label in plain words: "Pick up where you left off."
- **Why:** Recognition over recall + the Serial Position Effect (the last things seen are the ones remembered). It directly serves the compare-farms loop in R5 and gives returning visitors a warm first screen instead of a cold one.
- **Effort:** M (a tiny client recorder on variety/crop pages + one rail component).
- **Risk:** Privacy posture — device-local only, never sent to the server, never tied to the account, and it must have a quiet "Clear" so a shared family tablet can wipe it. Hide entirely until it has content (no empty rail, ever).

### P6. A "Visited" marker on listing rows you've opened
- **What/where:** When a visitor clicks a Shop button, that listing row quietly gains a small "Visited" note (session-scoped, client-side) when they come back to the variety or seller page.
- **Why:** Recognition over recall, aimed at the exact comparison task: "which of these three farms did I already check?" Currently unanswerable without re-clicking.
- **Effort:** S.
- **Risk:** The marker must say nothing about stock or freshness — it records *your* visit, not the farm's state, and the copy must keep that distinction clean so nobody reads "Visited" as "checked by us."

### P7. A polite PWA update notice instead of a mid-task reload
- **What/where:** Keep the self-updating worker exactly as is, but when an update arrives while a form on the page is dirty or a field is focused, hold the reload and show a slim, dismissible notice above the tab bar: "A new version of the Seed Directory is ready — tap to update." If nothing is in progress, reload immediately as today.
- **Why:** The app-lifecycle rule (never discard in-progress work) without giving up the anti-stale guarantee that fixed a real incident.
- **Effort:** M (dirty-form detection + a deferred-reload path in `PwaRegister`).
- **Risk:** The notice must persist until applied — a stranded old shell is the original bug and must not come back. **Conflict flagged (§3):** this softens a house behavior Dustin chose after being burned; if he prefers the guaranteed reload, the house call stands and this proposal dies quietly.

### P8. Get search into the first mobile screen on the home page
- **What/where:** Mobile only: shrink the hero art's height (a wider, shorter crop of the same painting) and move the search box directly under the headline, above the intro paragraph. Desktop's two-column hero is untouched.
- **Why:** First-success-fast. Search is the site's front door; on a phone it currently opens a full scroll down, past the art and the explanation.
- **Effort:** M (a responsive treatment of one section — the art direction belongs to the art director; I flag the *space*, they own the *picture*).
- **Risk:** The hero painting is the brand's first impression; a clumsy crop would cost more than the scroll does. Needs the art director's hand and a 390 px screenshot check before it ships. Two real designs under one URL is house standard, so a mobile-specific hero is legitimate, not a hack.

### P9. One-tap "Clear all filters" + a count that speaks
- **What/where:** When two or more filter groups are active on /variety or a crop page, a single "Clear all filters" chip appears at the end of the filter area (today, clearing means un-tapping every chip one by one). Pairs with P2's live-region count.
- **Why:** Error recovery + Hick's Law. Getting *out* of an over-filtered corner (the "No varieties match" dead end) should be one tap, not four.
- **Effort:** S.
- **Risk:** Only appear when it can do something (≥2 active, or ≥1 outside the crop page's own context); a permanent dead chip is worse than none.

### P10. A small transition on the grower-guide tabs
- **What/where:** A 150 ms opacity/translate fade when a guide tab's panel changes (post-hydration enhancement only; the SSR no-JS rendering of all panels stays exactly as is).
- **Why:** Aesthetic-usability effect — the one place on the site where content swaps in place currently blinks. It makes the guides feel like turning a catalogue page.
- **Effort:** S.
- **Risk:** Keep it transform/opacity only, and the global reduced-motion rule already handles the rest. Do not animate panel heights (layout work, jank).

### P11. A Share button on variety pages
- **What/where:** One quiet secondary action beside the variety name: the platform share sheet (`navigator.share`) with a copy-link fallback and a brief "Link copied" confirmation.
- **Why:** Gardeners trade variety names constantly; today sharing means copying from the address bar — which, in the installed PWA, doesn't exist. This removes a real friction for the app-feel surface specifically.
- **Effort:** S.
- **Risk:** One primary action per screen is house law — Shop / Join the waiting list stays primary; Share is text-link weight, never a second filled button.

### P12. A slim sticky action bar on long variety pages (mobile)
- **What/where:** On mobile only, once the page's main action scrolls out of view, a slim bar appears above the tab bar: variety name + the page's primary action (Shop at the first seller, or Join the waiting list). It hides again when the real action is on screen (IntersectionObserver).
- **Why:** Fitts's Law + thumb reach. On a variety with six listing rows, the action a visitor came for shouldn't require a scroll back to the top.
- **Effort:** M.
- **Risk:** Sticky chrome is a documented failure mode when it covers content — the bar must respect the existing scroll-padding, never overlap the tab bar, and never appear on desktop (proper desktop design has the action in reach already).

---

## 3. Conflicts flagged (house rule wins; Hue/Dustin decide)

1. **P7 vs. the auto-reload behavior.** Best practice says never force a reload that can discard user input. The current auto-reload exists because Dustin was personally stranded on a stale shell — a house decision made from a real incident. P7 is written as a thread between the two (reload immediately unless work is in progress; persistent notice otherwise). If Dustin prefers the guarantee absolute, P7 should be dropped, not diluted.
2. **P1 skeletons vs. "show nothing for very short waits."** Field guidance says a loading indicator that flashes for a fraction of a second makes a fast app feel *less* stable. Mitigation is built into P1 (delayed fade-in of the skeleton), but if production round-trips prove consistently fast after P2, P1's value shrinks — measure first, then decide how much skeleton each route really needs.
3. **No conflict found** between the remaining proposals and house standards: all motion is ≤300 ms, opacity/transform only, and covered by the existing global reduced-motion rule; all targets stay ≥44 px; no proposal adds a second primary action, a seller count, a price, or an attribution.

## 4. Suggested sequence
P1 + P2 together (they're the same journey), then P3 (one component, highest emotional return per hour), then P4/P9/P10 as a polish batch, P5/P6 as a pair, P8 with the art director, P7 only on Dustin's ruling, P11/P12 as time allows. Every item ships with the playbook's verification: rendered screenshots at 390 px and desktop, keyboard walk of the primary flow, 320 px / 200% text check, and a throttled-connection pass on the states each item touches.
