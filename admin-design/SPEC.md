# Seed Directory Admin — Design Spec

**Surface:** seeds.hues.flowers/admin — the official admin section for the whole Seed Directory.
**Designer:** Nadia (UX/UI). **Standing collaborators applied:** Iris (color), Thea (typography), Ada (accessibility floor, WCAG 2.2 AA).
**Source of scope:** `~/workspace/seeds-hues/ADMIN-SECTION.md` — Dustin's decisions of 2026-11-20 are binding; this spec does not relitigate them. Ambiguities found are listed in §15, flagged, not silently guessed.
**Status:** Design only. No code. Quinn design gate (2026-11-20): **PASS WITH NOTES** — required amendments RA-1–RA-3 and Minor Findings 2–8 applied in the amendment pass (see the Amendments log at the end of this spec); next is Quinn's delta re-gate, then build via Muse / GitHub Actions.
**Companion files:** none — this spec is self-contained (screen inventory, flows, states, components, role matrix, handoff).

---

## 1. Audit of the current surface (what exists, what is broken)

Per the UX playbook, the audit comes before the design. Ground truth from the v2 tree, 2026-11-20:

1. **There is no admin section.** One page exists, `/admin/waitlist`, gated by pasting an admin-scope API key into a password field (8-hour cookie, `lib/admin-session.ts`). It crams four unrelated jobs onto one scrolling page: site totals, a most-waited-varieties table, the Add Your Farm review queue, and farm-owner flag forms. It is a tool Hue uses, not a surface Dustin can work in.
2. **The review queues have no screen at all.** `review_items` (types: `listing_match`, `new_variety`, `seller_candidate`, `seller_correction`, `removal`) sit in the database behind the admin API; the admin review-list endpoint returns an arbitrary capped 500 rows with no working pagination. Scout POSSIBLE-DUPLICATE holds live in a markdown file (`VARIETY-PROPOSALS.md`). Dustin's originating question — "where do I see these to review?" — has no answer today.
3. **Seller management is API-only.** Editing a seller, flipping the Small Farm classification, correcting GeoSeed's location — all require Hue at a terminal. The classification record lives in a code file (`v2/lib/catalog/small-farm-classification.ts`).
4. **The farm-owner flag is set by raw-ID forms** ("Account (id or email)" + slug text fields) — exactly the always-open, error-prone form pattern Dustin has now banned (§2, principle 6).
5. **The statistics data already exists but has no presentation.** The schema already captures all four popularity signals — `variety_view_counts` (daily views per variety), `click_events` / `outbound_clicks` / `daily_stats` (outbound clicks per variety/seller/day), waitlist memberships (the legacy page's `demandView` already ranks most-waited varieties), and `search_events` (normalized query, result count, clicked variety). The statistics section is a presentation build, not a data-capture build — with one exception: raw site *visitor* counts (see §15.5).
6. **What is worth keeping:** the visual system (tokens in `app/globals.css` — paper ground, Fraunces, leaf/sage), the `.card` / `.btn` / `.field` / `.chip` / `.skeleton` component layer, the `CodeEntry` component (single paste-friendly code field, `autocomplete="one-time-code"`), `SmallFarmBadge`, the Quiet Ledger listing-card anatomy, and the legacy page's one genuinely good pattern — the Add Your Farm **submitted-vs-suggested comparison table** with evidence, which this spec generalizes to all review detail views.

---

## 2. Design principles (gate-able — Quinn checks against these)

1. **"A very polished dashboard." (Dustin, verbatim, 2026-11-20.)** The polish bar is dashboard-grade, not a bare utilitarian panel. Queue counts and the stats snapshot are composed as refined dashboard surfaces — cards, rankings, trends — with the care of a finished analytics product, inside the seed site's own visual system. Polish is structural: spacing rhythm, a disciplined type scale, states that look intentional, microcopy that was written (not defaulted), color used sparingly and semantically. **Polish never trades away the accessibility floor.**
2. **iPad is the primary surface. (Dustin, 2026-11-20; his MacBook is inoperable — the iPad is his working machine.)** The admin is designed so it feels *best* on an iPad: tablet viewport first, touch-first, generous targets, layouts that use the width — queue list and detail side by side for review work. Phone and desktop must still work well; **when a layout choice trades off, iPad wins.** Key screens are specified at iPad dimensions first (§4) and the verification checklist (§14) checks iPad sizes explicitly.
3. **Same product, working room.** The admin reuses the public site's visual system — paper ground `#F8F1E1`, Fraunces display type, sage/leaf accents, the card and button layer — adapted for a working tool: quieter, denser, no storefront decoration. A user who knows the public site should feel the admin is its back room, not a different product.
4. **Queues first.** The admin exists because things wait for decisions. The home leads with what is waiting; every queue shows its count and its oldest item's age, because a queue nobody sees is a queue that rots.
5. **One job per screen.** Every screen has a single primary job; controls that compete with it are cut or moved behind the navigation.
6. **No open forms. (Dustin, verbatim, 2026-11-20 — the same ruling he made for the ops dashboard.)** No always-open forms sit on any admin page. Creation and editing happen behind a button that opens a focused pop-up, sheet, or dedicated edit view, so every page leads with its content and stays clean. This covers: add/edit seller, the note composer (behind "Add note"), role designation, the listing-retire reason (inside the confirm dialog), account edits, and any filter/search configuration beyond a simple search field. Exceptions and boundary calls are stated in §10.3 — the sign-in code field is a *flow*, not an open form; a single search field is a field, not a form.
7. **Role is structure, not decoration.** Two levels (Admin, Reviewer) are enforced by what is *rendered*, per the rendering rules in §5 — never by greying out the whole product. The signed-in person always sees who they are and what their role is.
8. **Decisions state their consequences before they are taken.** Every approve / decline / publish / duplicate / retire action shows, in plain words, what will happen — before the tap, beside the button. Destructive actions additionally get the "Are you sure?" confirm (§10.1).
9. **Numbers are data, words are meaning.** Counts and statistics use tabular figures; dates are always friendly ("Nov 20, 2026", "3 days ago") — never a raw ISO stamp anywhere in admin (the Quiet Ledger rule, applied site-wide here). No state is carried by color alone: every status pairs its color with a word or an icon (Ada's floor, and her standing finding that petal and ochre are already semantically overloaded on the public site — admin adds no new meanings to either; §3.1).
10. **Every state is designed.** Empty, loading, error, offline, success, expired-session, wrong-role — each is specified per screen in §7. A state that is not in this spec does not ship by accident.

---

## 3. Foundations

### 3.1 Color (Iris's pass — the site's tokens, plus one ruled addition)

The admin builds on the site's measured tokens (`app/globals.css`) and adds **exactly one new token** — `danger`, ruled at the design gate for a single job (the petal paragraph below; §15.8, resolved). Ratios are the site's recorded measurements (THEME-REPORT.md), Ada's case-file values, and the gate's computations for the new token.

| Token | Value | Job in admin | Measured pairs |
|---|---|---|---|
| paper | `#F8F1E1` | Page ground | — |
| paper-deep | `#F0E5CB` | Rail ground, recessed bands, table header row | ink-soft on it 7.7:1 |
| surface | `#FFFDF6` | Cards, sheets, dialogs, inputs | ink on it 14.0:1 |
| ink | `#2E2A23` | Primary text, headings | 12.7:1 on paper |
| ink-soft | `#4A4438` | Secondary text | 8.6:1 on paper |
| muted | `#6A5F4C` | Captions, metadata, timestamps | 5.6:1 on paper, 6.2:1 on surface |
| line | `#E0D5B8` | Hairlines, card borders (decorative edge) | — |
| line-strong | `#97865F` | Control boundaries, field borders | 3.2:1 on paper, 3.5:1 on surface |
| leaf | `#1E4634` | Primary actions, active navigation, positive delta | white text on it 10.6:1; leaf on paper 9.4:1 |
| leaf-600 | `#2E6B4F` | Hover/pressed for leaf surfaces | white on it 6.3:1 |
| leaf-50 | `#E3EAD8` | Sage tint: selected rows, badge ground, trend bars' track | leaf on it 8.6:1 |
| link | `#1F5C3D` | Text links | 7.0:1 on paper |
| warn (ochre) | `#8A5E08` | **Errors and caution states only** — always with icon + words | 5.1:1 on paper |
| warn-50 | `#F7EDD3` | Error/caution panel ground | warn on it 4.9:1 |
| danger (admin only) | `#8F1D12` — gate-measured candidate; **final value confirmed by Iris in her token pass** | **One job only:** the verb button inside destructive confirms (§10.1), always paired with its verb label. Never for errors or caution (ochre keeps those); never anywhere else in admin or on the public site | white label text on it 8.93:1; boundary against paper 7.93:1 (gate-computed) |
| petal | `#8E2A52` | **Reserved.** Carries no new meaning in admin (see below) | 7.2:1 on paper |
| focus (umber) | `#7A3E10` | Focus indicator, 3px outline + 2px offset (site standard, unchanged) | 7.4:1 on paper, 8.2:1 on surface |

**Chroma budget (Iris):** admin runs quieter than the storefront. Leaf is the only saturated voice in admin's ordinary surfaces, reserved for the primary action on a screen, the active nav item, and trend-bar fills. Everything else is paper, ink, and hairlines. Saturation is spent where a decision is made, nowhere else. The single exception is the `danger` token inside destructive confirms (§10.1): there the destructive verb *is* the decision, and it carries the signal color — danger appears nowhere else in admin.

**The petal question (referred to Ada + Iris; ruled at the gate, §15.8):** destructive confirms conventionally want a red-family button. Ada's opening case file records petal already meaning *sold out, protection badge, required field,* and *active tab* on the public site. This spec therefore does **not** give petal a fifth job — upheld at the gate. The gate also rejected this spec's interim answer, ink-filled buttons: ink already means "ordinary content" on every screen, so as a button fill it reads as *prominent*, not *dangerous*. **Ruled design:** destructive confirm buttons are filled with the dedicated **`danger` token** — a new token used *only* for the verb button inside destructive confirms in admin, always paired with its verb label ("Remove seller"). Severity reads from the words, the dialog's interruption, *and* the one signal color — the same redundancy standard the rest of this spec applies (§2 principle 9).

**Status colors:** queue/status chips never rely on color alone — each is a word in a chip ("Waiting", "Sold out", "Retired", "Verified"), with tint as a redundant second channel only: Waiting = surface chip, line-strong border; Decided/positive = leaf-50 ground, leaf text; Caution = warn-50 ground, warn text; Retired/removed = paper-deep ground, ink-soft text.

**Dark mode:** the public site ships no dark theme; admin follows suit (one theme, measured). Forced-colors survival is specified in §12.

### 3.2 Type (Thea's pass)

Faces are the site's own: **Fraunces** (display/headings), **Newsreader** (serif — short explanatory and empty-state copy, so admin prose still feels like the catalogue), **system sans** (the site's existing "tool layer": all controls, labels, tables, and data). Numbers everywhere use **tabular figures** (`font-variant-numeric: tabular-nums` in the sans; the mono stack is reserved for the sign-in code field, matching `CodeEntry`).

| Role | Face / weight | Size / line-height | Tracking | Used for |
|---|---|---|---|---|
| Display | Fraunces 600 | 28 / 1.15 | −0.01em | Screen titles (one per screen) |
| Section head | Fraunces 600 | 20 / 1.2 | −0.01em | Card and section headings |
| Card head | Sans 600 | 16 / 1.4 | 0 | Queue-card names, panel titles |
| Body (tool) | Sans 400 | 16 / 1.5 | 0 | Table cells, field values, list rows |
| Body (prose) | Newsreader 400 | 17 / 1.6 | 0 | Empty-state and explainer paragraphs only |
| Small | Sans 400 | 14 / 1.45 | 0 | Secondary facts, evidence text |
| Caption | Sans 400 | 13 / 1.4 | 0 | Timestamps, counts under headings, chart summaries |
| Eyebrow | Sans 700 | 12 / 1.45 | +0.09em, uppercase | Panel eyebrows incl. "INTERNAL — NEVER PUBLIC" |
| Stat number | Sans 600 | 32 / 1.1, tabular | 0 | Statistics values |
| Code | Mono 400 | 20 / 1.4 | +0.2em | The 6-digit code field (as `CodeEntry`) |

Rules: sentence case for all headings and buttons (site voice); no all-caps except the eyebrow style; no text below 13px; layouts must survive 200% text resize and the WCAG 1.4.12 spacing overrides without clipping — no fixed-height text containers anywhere in admin.

### 3.3 Spacing, radius, elevation

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48. Card padding 16 (phone) / 20 (iPad, desktop). Vertical rhythm between sections: 24; between a heading and its content: 8–12.
- Radius: cards 18px, buttons 12px, fields 10px, chips full — the site's existing values, unchanged.
- Elevation: the site's single card shadow only. Sheets and dialogs take one stronger shadow (builder: extend `--shadow-card` one step; no new shadow language beyond that).
- All interactive targets ≥ 44×44px, with ≥ 8px clear space between adjacent targets (house standard; WCAG 2.5.8 floor is 24 — admin designs to 44 throughout because iPad touch is the primary input).

### 3.4 Motion

The site's 160ms ease-out for hover/state transitions; sheets slide/fade ≤ 240ms. Everything collapses under `prefers-reduced-motion` via the site's existing global rule. No auto-moving content anywhere in admin. Loading feedback follows the site's skeleton rule: skeletons stay invisible for the first ~200ms (`.skeleton-delayed`), then pulse; reduced-motion gets a static skeleton.

---

## 4. Layout system — iPad first

**Breakpoints** (content-driven, matching the site's Tailwind setup):

| Band | Width | Shell | Content |
|---|---|---|---|
| Phone | < 744px | Bottom tab bar (5 destinations) | Single column, max-width none, 16px gutters |
| **iPad (primary)** | **744–1180px** | **Left rail, 216px** | **Master–detail where the work is comparison or processing (§6); content max 1080px** |
| Desktop | ≥ 1181px | Left rail, 232px | Content max 1280px; dashboard grid widens, tables gain columns |

**The iPad decisions that make it feel best there:**
- **Master–detail is the default iPad pattern** for Review, Sellers, Listings, Varieties, and Accounts: a 340–360px list column (search field + rows, independently scrolling) and a detail pane that fills the remaining width. Processing a queue on iPad never requires a back-and-forth navigation per item — decide, and the next item is already in the list beside you, selected. This is the single biggest iPad win and it is specified for every queue in §7.
- Phone degrades master–detail to the familiar push pattern (list → detail screen → back), with the decision advancing to the next item in place ("Next" replaces the detail content) so phone processing still flows.
- Desktop keeps master–detail and spends extra width on the detail pane (comparison tables side by side, wider stat grids) — never on a third column of chrome.
- iPad portrait (768/820px) keeps the rail (icons + labels, it fits) and master–detail with a narrower list (320px). iPad landscape (1024/1180px) is the reference composition; key screens are described at 1180×820 in §7.
- **Boundary ownership:** 1180px belongs to the iPad band. A current iPad in landscape is exactly 1180 CSS px wide, and it lands in the iPad shell (216px rail, 1080px content cap) its screens were composed in; the desktop shell begins at 1181px. The band table above, the §7 compositions, and §14's reference viewports all read the boundary this way (gate Finding 4).
- The rail and the phone tab bar are the *same* navigation model (§6) at two sizes — one IA, two shells. Nothing is reachable in one shell and hidden in the other.
- Sticky elements: the rail (full height), list-column headers (search stays put while rows scroll), and the phone tab bar. Sticky save/decision bars appear only inside sheets and edit views (§10.3), never floating over content pages. Focus is never obscured: admin inherits the site's `scroll-padding` behavior, extended to the rail layout.

**Reference viewports for verification (§14):** iPad 1180×820 and 820×1180 (primary), iPhone 390×844, desktop 1440×900, plus the 320px reflow check.

---

## 5. Role model in the UI

Two levels, per Dustin's decisions:

- **Admin** (Dustin): everything — queues, seller editing, classification, removals, listings retire/restore, role designation, farm-owner flag, notes, statistics.
- **Reviewer** (designees): review and approve queues (including duplicate decisions), read and add internal notes, browse sellers/listings/varieties read-only, view statistics. **No** seller editing — a Reviewer never opens a seller edit form; the one bounded exception is approving a structured correction payload inside the report flow (C5), which applies that correction on approval (Dustin's ruling, 2026-11-20) — a queue decision, not seller editing. **No** classification changes, **no** removals or retire/restore, **no** account/role management.

**Rendering rules (binding — the answer to "absent vs disabled"):**

1. **Act = absent.** A control the role can never use is not rendered at all — no disabled buttons, no greyed toggles. Disabled controls fail contrast expectations, invite "why won't it work" confusion, and leak the shape of powers the person doesn't have. Reviewers never see Edit, classification, Remove, Retire, Restore, or role controls.
2. **View = read-only render.** Information a reviewer legitimately needs as context *is* rendered — as text, in the same layout position the Admin sees the control. The classification appears to a Reviewer as the `SmallFarmBadge` or the words "Not a small farm" (exactly as the public sees it); seller fields appear as a definition list where the Admin sees the same list plus an "Edit" button. Same screen, same structure — the difference is the presence of the action, never a degraded layout.
3. **Sections outside the role are absent from navigation.** Accounts (role management) does not appear in a Reviewer's rail or tab bar at all. A Reviewer following a stray link to it lands on the wrong-role state for that section (§7, A4 pattern) — the URL is not a secret, the data simply is not rendered.
4. **Busy is not permission.** The only disabled states in admin are transient busy states (a button while its own request is in flight), which restore or resolve to a status message. There are no permanent disabled controls.
5. **Identity is always visible.** The rail (iPad/desktop) and the More screen (phone) show the signed-in name, email, and a role chip — "Admin" (leaf-50 ground, leaf text) or "Reviewer" (surface, line-strong border, ink text) — text, not color alone. The admin home header repeats the role chip, so a shared screenshot can never be mistaken for the other role's view.

The full control-by-control matrix is §11.

---

## 6. Information architecture and navigation

**Root:** `/admin` (noindex, as the legacy page already is). The legacy `/admin/waitlist` is retired into this section (§13.3).

**Sections (rail order = tab order = decision priority):**

| # | Section | Route | Job | Phone tab |
|---|---|---|---|---|
| 1 | Home | `/admin` | What needs a decision + how the site is doing | Home |
| 2 | Review | `/admin/review` | Work the four queues | Review (with total-waiting badge) |
| 3 | Sellers | `/admin/sellers` | Find, inspect, edit, classify sellers | Sellers |
| 4 | Listings | `/admin/listings` | Find, inspect, retire, restore listings | More |
| 5 | Varieties | `/admin/varieties` | Browse varieties, alternate names, crops | More |
| 6 | Statistics | `/admin/statistics` | Site stats + variety popularity | Stats |
| 7 | Accounts | `/admin/accounts` | Roles + farm-owner flag (Admin only) | More (Admin only) |
| — | More | (phone only) | Listings, Varieties, Accounts, identity, sign out | More |

- **Labels are the user's words:** "Review", "Sellers", "Listings", "Varieties", "Statistics", "Accounts" — never internal names (`review_items`, `is_small_farm`).
- **The Review tab/rail item carries a count badge** with the total waiting across all queues (number + the accessible name "Review, 12 waiting"). The badge is the one piece of chrome that updates live as decisions are made.
- **Search** exists inside Sellers, Listings, Varieties, Accounts (a single search field per list — a field, not a form; §10.3). There is no global admin search in v1.
- **Deep links land properly:** every queue item, seller, listing, variety, and account has a stable URL; a link pasted to a colleague opens that exact item (after sign-in, via the return-path flow, §8.1), with a sensible back path to its list.
- **Sign out** lives in the rail foot / More screen, labeled "Sign out of admin". Signing out of admin does not sign the person out of their public visitor account (the admin session is the elevated layer — §8.1); the sign-out confirmation says exactly that.

---

## 7. Screen inventory and per-screen spec

Conventions: every screen lists its **job**, its **layout** (iPad first, then phone/desktop deltas), **content**, and **states**. States not listed for a screen inherit the cross-cutting patterns in §10. "Both roles" means the screen renders for Admin and Reviewer; role differences are stated where they exist.

### A. Sign-in and session

#### A1 — Admin sign-in, step 1: email
- **Job:** identify the person. **Route:** `/admin` when signed out (and the target of every expired/deep-link redirect).
- **Layout:** a single centered card on the paper ground (max 420px, all viewports — a flow, not a page). The public site header/footer are absent; the card carries the wordmark line "Seed Directory" + divider-stem-mini (the site's own device) so the surface is recognizably the same product.
- **Content:** Display heading "Admin sign-in"; one prose line: "Sign in with the email on your Seed Directory account."; email field (`.field`, `autocomplete="email"`); primary button "Email me a code"; a quiet link "Back to seeds.hues.flowers".
- **States:** *Busy* — button shows "Sending…" and disables (transient). *Error* — unknown email and known email behave identically (no account enumeration): the flow always advances to A2 with the same copy. A transport failure shows the §10.2 error pattern with Retry; the typed email is preserved.

#### A2 — Admin sign-in, step 2: code entry
- **Job:** prove the email. Reuses the site's `CodeEntry` component pattern unchanged (single field, mono, paste-friendly, `autocomplete="one-time-code"` — WCAG 2.2 §3.3.8 satisfied by paste + autofill, no memory test beyond transcription).
- **Content:** heading "Enter your code"; prose: "We sent a 6-digit code to **{email}**. It works for 15 minutes." (the expiry figure is the builder's to confirm against the existing code TTL — the copy pattern must state the real one); code field + "Verify" primary; "Send a new code" secondary; "Use a different email" text link back to A1.
- **States:** *Wrong code* — inline error beside the field (ochre + icon + words: "That code doesn't match. Check the email and try again."), field value preserved, focus moves to the error summary. *Expired code* — distinct message with one-tap resend: "That code has expired. Send a new code." *Too many attempts* — plain-language lockout state naming the wait, no codes or jargon. *Success* — advances to the return path (A5) or the admin home.
- **Session note (binding decision):** a successful admin sign-in creates the **~1-week admin session** (Dustin: "the session last very long time like a week"). The visitor session underneath is untouched. If the account has no admin role, sign-in still succeeds as a *visitor* — and the person lands on A4, not in admin.

#### A3 — Expired admin session
- **Job:** welcome back without losing the thread. Shown when a request finds an expired/revoked admin session.
- **Content:** the A1 card with a status panel above the email field: "Your admin session ended — admin sessions last a week. Sign in again to pick up where you left off." The email is prefilled from the account. After sign-in, the person returns to **the exact screen and item they were on** (return path preserved through the flow). Unsaved sheet/edit content is preserved where the builder can hold it client-side (§15.9); at minimum, the destination is never lost.
- **Distinct from A1:** never a bare redirect to a sign-in form with no explanation (the legacy key page's failure mode).

#### A4 — Wrong-role landing
- **Job:** tell a signed-in person, plainly, that they don't have admin access — and give them a way out. Shown when a visitor or farm-owner account (no Admin/Reviewer role) reaches any `/admin` URL, and when a Reviewer reaches an Admin-only section.
- **Content:** heading "This is the admin section"; prose naming what happened in the person's terms: "You're signed in as {name} ({email}), and this account doesn't have admin access. If Dustin has given you a reviewer or admin role, check you're using the email he set it up for."; primary action "Go to the Seed Directory" (public home); secondary "Sign in with a different email". **No queue counts, no section names beyond the generic, no data of any kind is rendered** — the page confirms nothing about what admin contains.
- **Reviewer variant** (Reviewer → Admin-only section): "Your reviewer role doesn't include account settings. You can work the review queues and seller notes from the sections in your menu." + "Back to admin home".

#### A5 — Return-path interstitial
- Not a visible screen in the happy path: after A2 success, route to the stored destination. If the stored destination no longer exists (item decided meanwhile), land on its queue with a status line: "That one was already decided by {name}." — recognition, not an error.

### B. Admin home — the dashboard

- **Job:** answer two questions in one glance — *what needs a decision?* and *how is the site doing?* **Route:** `/admin`.
- **Layout (iPad, the reference composition):** header row (Display "Admin home", role chip, friendly date). Below: a **"Needs a decision"** band of four queue cards in a 2×2 grid (full-width rows of 2; landscape may run 4 across at desktop widths, ≥1181px), then a **"How the site is doing"** band: four stat snapshot cards in a row of 4 (2×2 in portrait), then a two-column band: **Most wanted** (top 5 varieties by waitlist, mini-ranking) beside **Recent decisions** (latest 6 decisions across all queues, with who decided). Phone: everything stacks in the same order — queues, stats, most wanted, recent decisions. Desktop: as iPad landscape with the wider grid.
- **Queue cards** (the dashboard's heart — composed, not listed): queue name (Card head), the count as a Stat number, one line naming what waits ("Seller candidates from the hunt and Add Your Farm"), the oldest item's age ("Oldest: 6 days"), and the whole card is the tap target to that queue. **Zero state is designed, not empty:** count 0 renders "All clear" in place of the number, with the same card anatomy — a dashboard that looks finished when there is nothing to do (Peak-End: an all-clear home should feel like a small reward, in words: "Nothing waiting. The directory is up to date.").
- **Stat snapshot cards:** label, Stat number (tabular), delta vs the previous 7 days (▲/▼ + percent + the word "up"/"down" — never color alone; up = leaf, down = ink-soft), and a 7-bar mini trend (leaf bars on a leaf-50 track, today full-strength, prior days 55% — with a visually-hidden data table and a one-line summary in the card's accessible name). Tapping a card goes to Statistics with the matching signal selected. The four: **Visitors (7 days)**, **New accounts**, **Waitlist signups**, **Clicks to sellers**.
- **Recent decisions:** rows of "{Name} approved {item}" / "{Name} marked 'Chantilly Purple' a duplicate of 'Chantilly Light Purple'" + friendly time. This is Dustin's oversight of reviewer work, and the reviewers' own record — plain words, no log-speak.
- **States:** *Loading* — skeleton of the exact grid (delayed-reveal rule). *Partial error* — each band fails independently: a band that fails shows its §10.2 error card with Retry; the rest of the dashboard still works. A whole-page error state is a defect. *First-run* (no decisions ever, no stats yet) — queues read "All clear", stats cards show the composed no-data state ("No visits recorded yet — stats begin with the first full day."), recent decisions shows "Decisions your team makes will appear here."

### C. Review queues

#### C0 — Review index
- **Job:** choose a queue. On phone this is the Review tab's landing; on iPad/desktop the Review section opens directly into C1 with the queue switcher as the list column's header (see C1), and C0 exists as the phone surface and the deep-link target.
- **Content:** four queue rows (card anatomy): name, waiting count, oldest age, one-line description. Order is fixed by decision urgency: **Duplicate varieties** (catalog correctness), **Seller candidates**, **Queued listings**, **Reports**. A queue at zero shows "All clear" and remains tappable (its Decided history lives there).
- Queues: seller candidates includes **Add Your Farm submissions** as a source-labeled stream within the same queue (§15.6); reports are `/report` submissions (`seller_correction` and other types).

#### C1 — Queue workspace (one pattern, four queues)
- **Job:** process one queue to zero. **Layout (iPad/desktop): master–detail.** List column (340px): queue switcher (segmented list of the four queues with counts — switching queues never leaves the workspace), then the item rows (independently scrolling). Detail pane: the selected item's decision view (C2–C5 per type). **Phone:** list screen → tap → detail screen; deciding advances the detail to the next waiting item in place.
- **List rows:** the item's name in Card head weight (variety/seller/report title — the loudest element, Quiet Ledger precedent), one line of key facts, age ("3 days"), and a source/confidence line where the data carries it ("From the scout · looks like a match for 'Chantilly Light Purple'"). Sort: **oldest first** — the queue is a fairness device; nothing silently sinks. A "Decided" segment at the list head switches the column to decision history (who, what, when; read-only).
- **Progress:** the detail pane header carries "3 of 8" so a processing session has a visible shape (Hick/Miller: one decision at a time, the count chunked).
- **States:** *Empty queue* — the detail pane shows the composed all-clear state (stem divider, "Nothing waiting in {queue}.", link to the next non-empty queue). *Loading* — list skeletons + detail skeleton. *Error* — §10.2 pattern per pane. *Decision success* — the item leaves the list with the §10.4 status pattern; the detail advances; the Review badge count decrements; a brief **Undo** is offered where the backend can reverse the decision (§15.10).

#### C2 — Seller candidate decision view
- **Job:** decide whether this seller joins the directory. Generalizes the legacy page's proven pattern.
- **Content:** candidate name (Display in the pane header) + source line ("Add Your Farm submission · Nov 18" / "Found by the hunt · {site}"). A **comparison table — Submitted | Suggested from their site** — for the fields the legacy page already drafts (city, state, website, phone, socials, wholesale), each suggested value labeled "(suggested)". Below: **Evidence** — the auto-drafted summary panel (leaf-50 ground, labeled "Draft summary — never published automatically") with its claims and quoted sources, exactly as the legacy page presents them. Links to the candidate's site open in a new tab (site rule).
- **Decision bar** (foot of the pane, both roles): primary **Approve**; secondary **Decline**; the consequence line above the bar is **role-aware** — a consequence must be true for the person reading it (§2 principle 8; gate Finding 2). Admin reads: "Approving creates this seller. They aren't listed publicly until you finish their details and Small Farm classification in Sellers." Reviewer reads: "Approving creates this seller. They aren't listed publicly until an admin finishes their details and Small Farm classification in Sellers." Decline opens the §10.1-style sheet asking an optional reason (a field inside the pop-up — not an open form) — the reason is kept for the record, never sent anywhere automatically.
- **Add Your Farm nuance:** approving a farm submission links it to the seller record once created (the legacy "seller slug" hand-off). In this design the approve action creates the seller in a *candidate* state. **Candidate state, defined (gate Finding 8): a candidate-state seller is not publicly listed — no public page, absent from the directory and from search — until an Admin completes its details and classification in Sellers (D2–D4). Nothing half-finished reaches the public site.** (A designed rule, flagged in §15.13 for Dustin to override.) The detail pane confirms: "Seller created — finish their details in Sellers" with a deep link. The raw slug text field of the legacy page is gone (no open forms; the system proposes the slug).

#### C3 — Queued listing decision view (model matches)
- **Job:** decide whether this product listing attaches to this variety.
- **Content:** two stacked fact blocks with a visible "matched to" connector: **The listing** (seller name + badge if any, product title as listed, product URL with outbound link, packet sizes if captured) and **The variety** (name, crop, series, current seller count, link to its admin variety view and its public page). A **Why the machine matched it** line carries the match evidence in plain words ("The product title names this variety; the crop agrees. Matched as a model match, so a person checks it.") — crop agreement is the directory's known failure class and is always stated.
- **Decision bar** (both roles): primary **Publish listing**; secondary **Reject**. Consequence line: "Publishing puts this listing on {variety}'s public page, linking to the seller's product page." Reject asks an optional reason in its sheet (wrong variety / not seed / dead link / other) — the reason feeds the hunt's learning and the record.

#### C4 — Duplicate variety decision view (dedicated)
- **Job:** decide whether the held variety is the same variety as an existing one. This is the scout's POSSIBLE-DUPLICATE hold, and the decision view the whole admin was commissioned for.
- **Layout:** two variety panels in the detail pane — **side by side on iPad landscape and desktop** (the comparison *is* the job), stacked on phone and iPad portrait with a sticky mini-summary ("Comparing: 'Chantilly Purple' ↔ 'Chantilly Light Purple'") pinned while scrolling. Left/first panel is always **The held variety**; right/second is **The variety already in the directory**. Panel order never swaps.
- **Each panel:** variety name (Section head), crop + series line, botanical name where the catalog carries it, who sells it (seller names + listing evidence: product titles and links), and for the existing variety: its seller count, its current alternate names, and a link to its public page.
- **The comparison strip** between/below the panels: three plain verdicts with icons — "Same crop: Snapdragons" / "Names differ by one word" / "Sold by 2 of the same sellers" — the facts a decider actually weighs, computed from the record, stated neutrally. The design takes no side.
- **Decision (both roles — binding):** two **equal-weight secondary buttons**, deliberately neither one primary — the interface must not bias a judgment call: **"It's a duplicate"** and **"Not a duplicate"**. Tapping either opens its consequence inline (an expanding panel in the pane, not a modal — the comparison must stay visible): for Duplicate — "'Chantilly Purple' will be kept as another name for 'Chantilly Light Purple'. It will still turn up in search, its listings move to that variety, and the scout won't propose it again." + **Confirm: mark as duplicate** (primary weight now — the judgment is made, the confirm is execution) + "Back". For Not a duplicate — "'Chantilly Purple' will be added as its own variety, with its listings. It gets its own public page." + **Confirm: add the variety** + "Back". A **Skip for now** text link under the pair leaves the hold waiting and advances — skipping is a legitimate reviewer act and is recorded as seen, not decided.
- **States:** *Success* — §10.4 pattern naming the outcome in the same words as the consequence panel ("Kept as another name for 'Chantilly Light Purple'"), then advance to the next hold. *Edge: the existing variety was itself merged/renamed meanwhile* — the pane reloads with a status line and the fresh candidate match; never a dead end.

#### C5 — Report decision view
- **Job:** act on a `/report` submission. **Content:** report type as the pane title ("Seller correction", "Listing problem", …), the reporter's words in full, what it concerns (seller/variety/listing card with links), submitted-vs-current comparison when the report carries a structured correction (the GeoSeed "Clinton, SC → Greenwood, SC" shape: **Reported** | **Currently shown**).
- **Decision bar:** **Dismiss** for both roles. The primary action depends on the report type, and the roles differ by type:
  - **Structured seller correction** — **Apply the correction**, identical for Admin and Reviewer: approving the report applies the correction immediately (Dustin's ruling, 2026-11-20 — "that's their job, so right away"). There is no verify-then-wait state for corrections. The audit trail records the reporter and "applied on approval by {name}".
  - **Listing problem** — **Retire the listing** routes to the listing's retire confirm: **Admin only** (retiring is a removal, and removals are Admin-only); the action is absent for a Reviewer. A Reviewer's **Confirm report** (records "verified by {name}") leaves the report visibly waiting for an admin, so a verified problem is never lost.
  (§15.2, resolved by Dustin's ruling; the earlier verify-then-admin-applies two-step for corrections is deleted.)
- Dismiss asks an optional reason in its sheet, as C2/C3.

### D. Sellers

#### D1 — Seller list
- **Job:** find a seller. **Layout:** master–detail on iPad/desktop (list column 360px + D2 in the pane); list screen on phone.
- **List column:** search field (name — a field, not a form); filter chips row: **All / Small farm / Not small farm** and **Active / Not active** (two chip groups, single-select each — chips are the site's own pattern; anything more complex would go behind a Filters sheet per §10.3, and v1 needs nothing more). Sort: name A–Z default; a sort menu (button → menu pop-up) offers "Most listings" and "Recently updated".
- **Rows:** seller name (Card head — loudest), `SmallFarmBadge` inline when classified (the real badge component, as on the Quiet Ledger card), location line, "{n} listings · {status word}". Count line above the rows: "84 sellers".
- **States:** *No results* — "No sellers match '{query}'." + "Clear search" button. *Loading/error* — standard patterns.

#### D2 — Seller detail
- **Job:** know this seller; (Admin) change this seller. One screen, both roles — the Reviewer sees the identical layout with actions absent (§5 rule 2).
- **Header:** seller name (Display), badge or "Not a small farm" text, status word, "View public page" outbound link.
- **Sections, in order:**
  1. **Information** — a definition list of the record's public facts: website, location, region, country, ships to, contact email, seller type, platform, description, ordering notes. **Admin** gets an **Edit** button at the section head → the edit sheet (D3). **Reviewer** sees the list alone.
  2. **Classification** — the Small Farm call, given its own panel because it is the decision Dustin named. Shows the current classification exactly as the public sees it (badge, or the words "Not a small farm — no badge is shown"). **Admin only:** a **Change** button → the classification sheet (D4). Reviewer: panel without the button.
  3. **Internal notes** — §7.D5. Both roles read and add.
  4. **Listings** — count + the seller's first listings (Quiet Ledger anatomy, read-only here) + "See all in Listings" (deep link, seller filter applied).
  5. **Danger zone (Admin only, absent for Reviewer):** at the foot, separated by whitespace and a hairline — **Deactivate seller** (reversible; hides the seller and its listings from the public site) and **Remove seller** (the harder action), each an outline button opening its §10.1 confirm naming the consequence and the listing count it affects.
- **States:** *Just edited* — returning from D3/D4 shows a §10.4 status line at the head of the relevant section ("Location updated to Greenwood, SC."). *Seller deactivated* — a caution banner (warn-50, icon + words) heads the screen for both roles: "This seller is deactivated — their page and listings are hidden from the public site." with Admin's **Reactivate** button in the banner.

#### D3 — Edit seller (sheet / dedicated view)
- **Job:** change a seller's information. **Opened by:** D2's Edit button — never an open form on D2 (principle 6).
- **Form factor:** iPad/desktop — a large right-side sheet (560px) over the dimmed detail; phone — a full-screen view. Title "Edit {seller}".
- **Fields, grouped (Miller: chunks, not one long scroll of equals):** *Identity* — name, (slug shown read-only with the line "The web address doesn't change, so links keep working."), seller type (select), platform (select); *Contact & links* — website, contact email; *Location* — location text, region, country, ships to; *About* — description (textarea), ordering notes (textarea). Classification is **not** in this form — it has its own sheet (D4) because it is a judgment, not data entry. Status is not here either (Danger zone owns it).
- **Save bar:** sticky at the sheet's foot — primary **Save changes**, secondary **Cancel**. *Dirty state:* Cancel with unsaved changes asks "Discard your changes?" (a confirm for the user's own work — error prevention, not a destructive-system action). *Validation:* inline at the field (ochre + icon + words), values always preserved, error summary at the sheet head for 2+ errors with links to fields. *Success:* sheet closes, D2 shows the status line, the changed values are already rendered (optimistic with honest reversal on failure per §10.5).

#### D4 — Classification sheet
- **Job:** make the Small Farm vs large broker call. Opened by D2's Change button (Admin only).
- **Content:** the question in Dustin's own framing — "Is {seller} a small farm, or a larger operation?" — as a two-option radio card group (recognition, not recall): **Small farm** ("Shows the Small farm badge on their page and listings, and includes them in the Small farms filter.") / **Not a small farm** ("No badge is shown. They're listed like any other seller."). The current value is pre-selected. A line beneath: "This is a judgment call — there's no size test. When in doubt, leave the badge off." (the house standard from the badge review, in the interface where the call is made). Optional note field ("Why — kept with the internal notes") that files into D5 on save, so the reasoning lives with the seller.
- **Save:** primary **Save classification** in the sheet's foot; no confirm dialog (reversible, non-destructive — principle: confirmations are for destructive actions only). Success: D2's classification panel and badge update with a status line.

#### D5 — Internal notes (on D2)
- **Job:** the team's private memory about a seller. **Never public — the design makes that unmistakable in three independent ways:** (1) the panel's eyebrow reads **"INTERNAL NOTES — NEVER SHOWN ON THE PUBLIC SITE"** with a lock icon; (2) the panel ground is paper-deep with a line-strong border — visually distinct from every public-style card on the screen, a "back room" surface; (3) the panel exists only inside the authenticated admin, and the spec's handoff (§13) requires the notes data to be served only by admin-authorized endpoints, never the public API.
- **Content:** notes newest-first: body text (Newsreader prose size — notes are reading matter), author name + role, friendly timestamp ("Nov 20, 2026 · 2:14 PM"). Both roles read all notes. **Add note** button at the panel head (both roles) → composer sheet (textarea, "Add note" primary) — the composer is never an open box on the page (principle 6).
- **v1 scope:** notes are append-only in the UI — no edit, no delete (§15.7). An erroneous note is corrected by adding another note; the record stays honest.
- **States:** *Empty* — "No notes yet. Notes are only visible inside admin — add anything the team should know about this seller." *Error posting* — composer keeps the text, §10.2 pattern.

### E. Listings

#### E1 — Listing list
- **Job:** find a listing. Master–detail on iPad/desktop; list on phone. Search field (product title, variety, or seller name); filter chips: **Active / Sold out / Retired** and an optional seller filter carried from D2's deep link (shown as a removable chip: "Seller: GeoSeed ×"). Rows: product title (Card head), variety name, seller name, status word + friendly "checked {date}" (never ISO). Count line: "1,792 listings" filtered counts update in words.
- *No results / loading / error* — standard patterns.

#### E2 — Listing detail
- **Job:** inspect one listing; (Admin) retire or restore it.
- **Content:** product title (Section head); the outbound product URL as a link (new tab); seller (link to D2) and variety (link to F2); status; packet sizes as captured; **History** — the listing's event trail in plain words ("Published Nov 19, 2026 · Retired Nov 20, 2026 by Hue — reason: not seed"), which is where a retirement reason lives permanently.
- **Actions (Admin only; absent for Reviewer):** **Retire listing** → §10.1 confirm dialog **containing the reason select** (Wrong variety / Not seed / Dead link / Duplicate listing / Other + optional note field) — the reason lives inside the confirm, per Dustin's directive, never in an open form on the page. Retiring is reversible: a retired listing's detail shows the caution banner + **Restore listing** button. **Consequence copy** in the confirm names the variety page it leaves: "This listing will come off '{variety}'s page. The seller's other listings stay."

### F. Varieties and crops

#### F1 — Variety list
- **Job:** find a variety in admin. Master–detail on iPad/desktop; list on phone. Search field (name, including alternate names — searching an alias finds its variety, labeled "Matched another name: 'Chantilly Purple'"); crop filter chips (single-select, horizontally scrolling chip strip — the site's FilterStrip pattern; the strip never wraps). Rows: variety name (Card head), crop, "{n} sellers · {n} other names". Count line. *No results* — "No varieties match '{query}'." + **Clear search** button (the D1 pattern). *Loading/error* — standard patterns.

#### F2 — Variety detail (admin view)
- **Job:** see a variety as the team sees it — public facts plus the machinery underneath.
- **Content:** name (Display) + crop/series/botanical line + "View public page" link; **Listings** summary (count by status + link to Listings filtered); **Waitlist** count (links to Statistics, Waitlist signal); **Other names (alternate names)** — the alias list with each alias's kind in words ("another name for this variety"), because this is where duplicate decisions land: an alias added by a C4 decision is labeled "Added from a duplicate decision · {date} · by {name}". **Admin only:** an **Add another name** button → small sheet (one field + consequence line "This name will find this variety in search.") and a remove control per alias → §10.1 confirm. **Exception (RA-1, gate Finding 1): an alias added by a duplicate decision has no remove control — it is not removable in admin, by either role.** The duplicate decision's promise ("the scout won't propose it again") is kept by that name staying on the variety; a control that could delete it would let one later tap silently void a decision the team already made. If a duplicate decision itself was wrong, that is a decision to reverse, not a name to delete — Hue corrects it from the record (the §10.1 honesty pattern). Manually added aliases stay removable; their confirm names the full consequence: "This name will stop finding this variety in search, and the scout may propose this variety again under it." (§15.4: alias management is proposed, not in Dustin's decisions; the decision-created protection is the gate's amendment.)
- **Reviewer:** fully read-only render; no add/remove controls (absent).

#### F3 — Crops
- **Job:** orientation only in v1. A simple list within the Varieties section (segmented head: **Varieties | Crops**): crop name, variety count, seller count; tapping a crop filters F1 to it. No crop editing is designed (not in the decisions — §15.4).

### G. Accounts (Admin only — absent from Reviewer navigation)

#### G1 — Account list
- **Job:** find a visitor account. Master–detail on iPad/desktop; list on phone. Search field (name or email). Rows: name (Card head), email, "Joined {friendly date}", and flag chips where true — **Admin** / **Reviewer** / **Farm owner** — as words in chips (never color alone). Count line. *No results* — "No accounts match '{query}'." + **Clear search** button (the D1 pattern); *loading/error* — standard patterns. *Privacy note:* this list exists to manage roles; it shows no browsing, order, or message data, because there is none to show.

#### G2 — Account detail
- **Job:** manage what this account is allowed to do.
- **Content:** name, email, phone (as given at signup), joined date, waitlist count, account status. Two management panels, each action behind its own button (principle 6 — the legacy page's raw ID-and-slug forms are abolished):
  1. **Role** — current role as a word ("Visitor — no admin access" / "Reviewer" / "Admin"). **Change role** button → role sheet: three radio cards in Dustin's terms — **Admin** ("Everything: edit sellers, classify, remove, manage roles."), **Reviewer** ("Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything — except approving a seller correction, which applies the fix right away."), **Visitor** ("No admin access. A normal Seed Directory account."). Granting **Admin** requires the §10.1 confirm naming the consequence ("{Name} will be able to edit and remove sellers and give other people roles."); demoting the last Admin is prevented with a plain explanation (the system must never lock Dustin out of his own site — error prevention). Every change writes to the audit trail, shown in the panel's history line ("Reviewer since Nov 20, 2026 · set by Dustin").
  2. **Farm owner** — current state in words; **Set as farm owner** → sheet with a seller picker (search field + result list — never a typed slug) → confirm; **Remove farm-owner status** → confirm (consequence copy inherited from the legacy page's honest wording: "Revoking keeps the account and its waiting lists."). Audit history listed beneath (the schema already keeps this trail).
- **States:** *Self-view* — Dustin viewing his own account: role controls absent for his own Admin role (he cannot demote himself by accident); a line explains why. *Error* — standard patterns.

### H. Statistics

- **Job:** show how the site is doing and **which varieties are popular** — the section Dustin named. A finished data product, not a table dump.
- **Route:** `/admin/statistics`. **Layout:** iPad/desktop — a two-column grid of cards under the section header band; phone — one column, same order. The header band is **not sticky** (decided, gate Finding 7): it scrolls away with the page. §4's sticky list is exhaustive — rail, list-column headers, phone tab bar — and this band is not on it; the time range the band carries is restated in every card's caption, so nothing is lost when it scrolls off. Recognition is carried by the captions, not by pinned chrome, and no focus-obscured obligation arises.
- **Time-range control (designed, not defaulted):** a segmented control — **7 days · 30 days · 12 weeks** — sitting in the section header with the resulting range restated in words beside it ("Nov 14 – Nov 20, 2026"). It governs the whole page; every card caption restates the range so a screenshot is self-explaining (recognition over recall). Switching ranges keeps all cards' scroll positions and shows the skeleton only if the fetch passes the 200ms rule. (Custom ranges are not in v1 — §15.5.)
- **Site stat cards** (the home snapshot, grown up): **Visitors**, **New accounts**, **Waitlist signups**, **Clicks to sellers**. Each: Stat number (tabular), delta vs the previous equal period (arrow + percent + word), and a **trend chart**: daily bars (leaf on leaf-50 track) for 7/30 days, weekly bars for 12 weeks. Every chart ships with (a) a one-sentence summary in plain words ("Visits peaked on Tuesday, Nov 18, with 214."), and (b) a visually-hidden data table — the chart is never the only carrier of its numbers.
- **Variety popularity — the centerpiece.** A segmented signal switcher: **Views · Clicks to sellers · Waitlist · Searches**. One ranking table per signal (on desktop, ≥1181px, Views and Clicks may sit side by side; the switcher still governs the phone/iPad composition — consistency over cleverness):
  - **Ranking table anatomy:** rank (tabular), variety name (link to F2; public-page link icon beside it), crop, the signal value (tabular, right-aligned), and **movement** vs the previous period (▲ 2 / ▼ 1 / "New" — arrows + words/numbers, ink-soft for down, leaf for up; never color alone). Top 10 by default with a **Show top 25** button (in place, no page change).
  - **Views:** from `variety_view_counts`. **Clicks:** from `click_events`/`daily_stats`, with the sold-out-click share shown as a caption where it matters ("18% of clicks were on sold-out listings" — demand the directory can't yet serve). **Waitlist:** the most-waited ranking (the legacy `demandView`, promoted): variety, waiters (verified count in words), seller count — the hunting-priority list, unchanged in meaning.
  - **Searches:** two tables — **Top searches** (term as typed-normalized, searches, "usually finds {variety}" where a click followed) and **Searches with no results** (term, count) — the second is editorially precious: it is the scout's shopping list, and it gets its own card with the line "People looked for these and found nothing."
- **States:** *Thin data* — the directory is young; a card with fewer than a full period of data shows totals without deltas and says so ("Only 4 days of data so far — comparisons start after the first full week."). Zero is a designed state, never a blank card. *Loading* — skeleton cards matching the grid. *Error* — per-card §10.2 pattern; one card's failure never blanks the section.
- **Out of scope here:** per-seller popularity is visible through the Clicks ranking's seller column data in F2/D2 summaries; a dedicated seller-stats page is not in the decisions and is not designed.

---

## 8. Flows

### 8.1 Sign-in and return path
Signed-out → any `/admin` URL → A1 (destination stored) → A2 → role check → destination (or A4 if no role; or A3's explanation if the session expired). Session: ~1 week for the admin layer. Revocation (role removed in G2) takes effect on the person's next request: they land on A4 with the reviewer/visitor wording that fits — never a raw error.

### 8.2 Process the duplicate queue (the flagship flow)
Review (badge: 8) → Duplicate varieties → list selects the oldest hold → C4 comparison → "It's a duplicate" → consequence panel → Confirm → status line names the outcome → pane advances to the next hold, "2 of 8" → … → last one → all-clear state with a link to the next non-empty queue. Total chrome between decisions: zero navigations on iPad.

### 8.3 Classify a seller
Sellers → search → D2 → Classification panel → Change → D4 sheet → choose → Save → panel updates with badge + status line. From a queue: C2's approval success links straight to D2, so classification happens in the same sitting.

### 8.4 Retire and restore a listing
Listings → E2 → Retire listing → confirm with reason → listing retired, history records reason + who → banner offers Restore. The variety's public page updates; the retired listing remains findable in admin under the Retired filter forever (nothing is hard-deleted from the team's view).

### 8.5 Designate a reviewer
Accounts → G2 → Change role → Reviewer → confirm → audit line updates → the person's next sign-in lands in admin with the Reviewer shell. Dustin can verify the result immediately: the home header's Recent decisions will carry their work from their first decision.

### 8.6 Add an internal note
D2 → Internal notes → Add note → composer sheet → Add → note appears at the head of the list with author + time. Identical for both roles.

---

## 9. Component inventory

**Reused as-is (site components/classes):** `.btn` / `.btn-primary` / `.btn-secondary`, `.field`, `.card`, `.chip` (+ its `aria-current` selected state), `.eyebrow`, `.skeleton` + `.skeleton-delayed`, `CodeEntry` (A2), `SmallFarmBadge` (D1, D2, C3), `Pagination` (long decided-history lists), the FilterStrip scroll pattern (F1 crop chips), the divider-stem motif (empty states, A1 card), friendly-date formatting from the Quiet Ledger work (no ISO anywhere).

**New (builder creates to this spec):**
| Component | Used by | Notes |
|---|---|---|
| AdminShell (rail + tab bar + identity block) | all | One IA, two shells (§4, §6) |
| QueueCard | B, C0 | Count, oldest age, all-clear state |
| StatCard (snapshot) | B | Number, delta, mini trend + hidden table |
| TrendBars | B, H | Bars + sentence summary + visually-hidden table |
| RankingTable | H | Rank/value/movement anatomy (§7H) |
| TimeRangeControl | H | Segmented 7d/30d/12w with range restated in words |
| MasterDetail layout | C1, D1, E1, F1, G1 | List column + pane; phone push fallback |
| DecisionBar | C2–C5 | Consequence line + actions, pane foot |
| ComparePanel (×2) + ComparisonStrip | C4 | Held vs existing variety |
| ConsequencePanel | C4 | Inline expanding confirm under a chosen outcome |
| Sheet (modal) | D3, D4, D5 composer, G2, declines | Bottom sheet on phone; right sheet / centered on iPad/desktop; focus trap, returns focus to opener |
| ConfirmDialog | §10.1 uses | Names item + consequence; verb-labeled buttons |
| ClassificationControl | D4 | Two radio cards + house-standard line |
| NotesPanel | D5 | Paper-deep ground, lock eyebrow, append-only list |
| StatusBanner | D2, E2, B | role="status" confirmation / caution variants |
| RoleChip | shell, B, G1 | Words, not color alone |
| StickyActionBar | sheets only | Save/Cancel at sheet foot; never over content pages |

---

## 10. Cross-cutting patterns

### 10.1 Destructive confirm ("Are you sure?")
Reserved for genuinely destructive or privilege-changing actions: Remove seller, Deactivate seller, Retire listing, Remove alternate name, Grant Admin, Revoke farm owner, Discard unsaved edits. Never for routine decisions (approvals, classifications, publishes get consequence lines + status feedback instead — dialog fatigue is a documented failure mode). Anatomy: title = the action in words ("Remove {seller}?"); body = the concrete consequence with real numbers ("Their page and 23 listings will come off the public site. This can be undone by Hue from the record, not from this screen." — honesty about reversibility, stated per action); buttons: **Cancel** (secondary, initial focus — the safe choice) and the **verb button** (filled with the admin `danger` token, §3.1: "Remove seller"). The retire reason select lives inside this dialog (E2). Focus is trapped, Esc cancels, focus returns to the invoking button.

### 10.2 Errors
Plain language, no codes, cause + fix, beside what caused it. Page/section failures: an error card in place of the failed band only, with **Retry**. Form failures: summary at the sheet head (2+ errors) + inline at each field, values preserved, focus to the summary. Nothing in admin ever shows a raw API message or an HTTP status to Dustin or a reviewer.

### 10.3 The no-open-forms rule — mechanics and exceptions
**Rule (Dustin, 2026-11-20):** no always-open forms on any admin page. **Mechanics:** every create/edit lives in a Sheet, a dedicated edit view, or inside a ConfirmDialog, opened by a labeled button ("Edit", "Add note", "Change", "Change role", "Set as farm owner"). Pages lead with content: queues, sellers, stats. **Exceptions (stated, per the directive's own boundary):** (1) the sign-in flow A1/A2 — a flow, not a form on a page; (2) a single search field at the head of a list — a field, not a form; (3) filter chips and the sort menu — controls, not forms; anything beyond them (a future advanced filter set) goes behind a **Filters** button → sheet; (4) decision bars in queue detail panes — the pane *is* the focused work surface, not a form sitting on a content page; (5) the decline/report reason fields — inside their pop-ups, as the directive specifies for the retire reason.

### 10.4 Decision feedback
Every decision resolves to a `role="status"` line in the pane (the site's existing pattern) naming the outcome in the consequence panel's own words, the item's removal from the list, the badge-count update, and — where reversible — an **Undo** action in the status line for the length of the session on that queue. Completions are composed (Peak-End): finishing a queue lands on the all-clear state, not a void.

### 10.5 Saving and freshness
Sheet saves are optimistic with honest reversal: on failure the sheet reopens with the values intact and the §10.2 error at its head — never a silent lie. Data freshness is stated where it matters: queue lists show "Updated just now / 2 min ago" in the list head, because two people (Dustin + a reviewer, or Hue via the API) can work the same queue; an item decided by someone else while it sits open resolves through A5's wording, not an error.

### 10.6 Offline and connection
Admin is a working tool on farm Wi-Fi; treat connectivity as a spectrum. Read surfaces render from the app shell with a quiet banner when offline ("You're offline — showing the last data this device loaded. Changes need a connection."); write actions attempted offline are held with the values intact and a plain explanation, never lost and never silently queued for a system whose effects (publishing, removing) must be witnessed. (Write-queueing for admin is deliberately not designed — §15.11.)

### 10.7 Session behavior in the shell
The admin layer's ~1-week session is independent of the visitor session. Expiry mid-work → A3 with destination + (where held) form content preserved. There is no idle timeout inside the week. The shell always shows who is signed in (§5 rule 5), so an expired-and-replaced session can never masquerade as the previous person.

---

## 11. Role-permission UI matrix

Rendering key: **Live** = control rendered and operable · **Read-only** = information rendered as text, with no control that changes data (view controls — a search field, filter chips, a sort menu — may still be present; they change the view, never the data) · **Absent** = not rendered at all (§5 rules).

| Surface / control | Admin | Reviewer |
|---|---|---|
| Admin sign-in (A1/A2), expired (A3) | Live | Live |
| Home dashboard (B) | Live | Live (identical content) |
| Review queues — decide (C2 approve/decline, C3 publish/reject) | Live | Live |
| Duplicate decision (C4) | Live | Live |
| Reports — dismiss, confirm/verify (C5) | Live | Live |
| Reports — apply a structured seller correction (C5) | Live | Live (applies on approval — Dustin's ruling) |
| Reports — route to retire a listing (C5) | Live | Absent (removals are Admin-only) |
| Seller list + detail (D1/D2) | Live | Read-only |
| Edit seller (D3) | Live | Absent |
| Classification (D4) | Live | Read-only (badge/words render; no Change button) |
| Internal notes — read (D5) | Live | Live |
| Internal notes — add (D5) | Live | Live |
| Deactivate / remove seller (D2 danger zone) | Live | Absent (whole section) |
| Listing detail (E2) | Live | Read-only |
| Retire / restore listing (E2) | Live | Absent |
| Variety detail (F2) | Live | Read-only |
| Alternate names — add / remove a manually added name (F2) | Live | Absent |
| Alternate names — remove a name added by a duplicate decision (F2; not removable, RA-1) | Absent | Absent |
| Accounts section (G1/G2) | Live | Absent (nav + section) |
| Role designation (G2) | Live | Absent |
| Farm-owner flag (G2) | Live | Absent |
| Statistics (H) | Live | Live (identical content) |
| Visitor / farm-owner account reaching /admin | A4 landing | A4 landing |

---

## 12. Accessibility conformance notes (Ada's floor)

- All text/UI pairs are the site's measured tokens (§3.1): body text ≥ 5.6:1 worst case (muted on paper), primary text 12.7:1 — above the floor toward the house's 7:1 aim for an older audience; control boundaries (line-strong) ≥ 3.2:1; focus umber 3px at 7.4:1, never obscured (scroll-padding extended to the rail shell).
- Targets ≥ 44×44 throughout (house standard, above the 2.5.8 floor) — sized for iPad touch and arthritic hands alike.
- No meaning by color alone: statuses are words in chips; deltas are arrow + number + word; classification is a badge with live text or explicit words; queue urgency is an age in words, never a reddening number.
- Authentication (WCAG 3.3.8): the code is transcribed, not recalled; paste and `one-time-code` autofill are supported (the existing `CodeEntry` behavior); no password exists to remember.
- Tables are real tables with scoped headers; on phone, ranking/stat tables reflow to stacked rows — no horizontal scrolling at 320px, no content loss at 200% text or under 1.4.12 spacing overrides (no fixed-height text containers in admin).
- Charts: every TrendBars/ranking visualization carries a sentence summary and a visually-hidden data table; bars are decorative redundancies over numbers that are always present as text.
- Dialogs/sheets: focus trapped inside, labelled by their title, Esc closes, focus returns to the opener; the safe action takes initial focus in destructive confirms.
- Motion: reduced-motion collapses all transitions (site global rule); nothing auto-moves; nothing flashes.
- Forced colors: boundaries are real borders (line-strong), focus is an outline, the notes panel's privacy is carried by its words and lock icon — not by its ground color, which forced-colors will strip. The badge keeps its border + text.
- Screen-reader specifics: the Review nav badge's count is in the accessible name; decision outcomes are announced via the `role="status"` pattern; master–detail selection uses `aria-current` on the active row; the comparison strip's verdicts are text, not icon-only.
- **Honest status (Ada's rule):** this spec is *designed to* WCAG 2.2 AA with measured token pairs inherited from the audited public theme. It is not a conformance claim — the built admin needs Ada's own pass (keyboard walk, VoiceOver on iPad — the primary surface — forced-colors, 200%/320px checks) before anyone calls it conforming, and certification remains a specialist-firm matter, as everywhere on this site.

---

## 13. Builder handoff note

1. **Stack reality:** Next.js in `~/workspace/seeds-hues/v2` is *not* the Next.js of training data — `v2/AGENTS.md` requires reading the guides in `node_modules/next/dist/docs/` before writing code. Heed it.
2. **Build on the existing layer:** tokens, `.card/.btn/.field/.chip/.skeleton`, `CodeEntry`, `SmallFarmBadge`, `Pagination`, FilterStrip — extend, don't fork. New components are listed in §9; keep their class/token discipline identical.
3. **Legacy absorption:** `/admin/waitlist` and its key-paste gate (`lib/admin-session.ts`, 8-hour cookie) are replaced by this section. Its four jobs land as follows: totals → B/H; most-waited varieties → H (Waitlist signal, `demandView` already computes it); Add Your Farm queue → C2 within Seller candidates; farm-owner flag → G2 (keep the existing audit-trail writes). Retire the route once the new section is live; do not leave two admin surfaces.
4. **Data that already exists:** all four popularity signals (`variety_view_counts`, `click_events`, `outbound_clicks`, `daily_stats`, `search_events`, waitlist memberships), `review_items` with its type/status enums, `variety_aliases` for C4 outcomes, `listing_events` for E2 history, the farm-owner audit trail. **Data that must be created:** an account role field (visitor/reviewer/admin) on `users`; the ~1-week admin session layer distinct from the visitor session; a seller internal-notes store (author, role, timestamp, body) served **only** through admin-authorized endpoints — notes must never appear in any public API response, the public seller page's rendered HTML, any search-index payload built from seller records, the sitemap, or any sync payload (test each named surface explicitly); a decisions/audit read for B's Recent decisions (farm-owner audit is the precedent).
5. **Scout holds feed:** C4 assumes duplicate holds arrive as structured queue items (held variety, matched existing variety, evidence). Today they are rows in `VARIETY-PROPOSALS.md` — wiring that feed is build work, and the scout's writer must target the same queue (§15.3).
6. **Deploy discipline (house rules):** ship verified slices as separate deploys, never batched; verify live on production after each; production is unreachable from this VM's headless Chromium (Cloudflare) — verify via local renders of the production build plus API-level checks, and put the iPad eyeball on Dustin's list.
7. **No public copy changes.** Nothing in this build alters any public page, the public API's shape, or the badge's public behavior. The only public-side effect of admin actions is the data they already intend (a published listing appears; a retired one disappears).

---

## 14. Verification — design-time checklist (Nadia's playbook)

Design-proof obligations split honestly: this pass verifies the *design* against the playbooks on paper; the *rendered* proofs (screenshots at 390px and desktop from the real surface, DOM measurements, keyboard and screen-reader walks) are the builder's + Quinn's gate duties at build time, listed here so they cannot be skipped.

- [x] Audit of the current surface written before designing (§1).
- [x] Ten-heuristics walk of this design: status visible (counts, ages, status lines everywhere); user's language (section names, consequence copy, no internal terms); control & freedom (Skip, Undo where reversible, return paths, sign-out that explains itself); consistency (site tokens/components, one decision pattern across four queues); error prevention (confirms only where destructive, last-Admin lockout protection, dirty-sheet guard); recognition over recall (role chip, range restated per card, comparison stays visible during C4 confirm); flexibility (master–detail processing flow for experts, guided panes for first-timers); minimalist (one job per screen, no open forms, chrome is one rail); error recovery (plain language, values preserved, per-band retry); help (consequence lines and the classification standard teach in place — no manual needed).
- [x] Role matrix complete; absent-vs-read-only rule stated and applied uniformly (§5, §11).
- [x] Every screen carries empty / loading / error / success states (§7, §10).
- [x] iPad-primary: key screens composed at 1180×820 and 820×1180 (master–detail decisions, §4); phone 390 and desktop 1440 compositions stated per screen; 320px reflow + 200% text + 1.4.12 overrides designed for (§12).
- [ ] **Owed at build:** rendered screenshots at iPad (both orientations), 390px phone, desktop; DOM target measurements (44px, both axes); keyboard-only walk of sign-in → C4 decision → D4 classification; VoiceOver pass on iPad (the primary surface); forced-colors and reduced-motion views; live production check after deploy. Owner: builder, gated by Quinn (design) and Ada (floor).

---

## 15. Ambiguities and flagged decisions (for Hue / Dustin — flagged, not guessed)

1. **Sign-in mechanism conflict.** ADMIN-SECTION.md decision 2 says admin sign-in is "same as visitors — email + 6-digit code". The live visitor sign-in is actually **email + phone number, no code** (`SignInForm.tsx`); 6-digit codes exist only to *verify* an email/alert number (`CodeEntry.tsx`). This spec follows the brief (email → code → ~1-week admin session, §7A) because a code step is the stronger and simpler admin gate — but "same as visitors" and the built reality disagree. **Needs a ruling:** admin uses a code sign-in that visitors don't have (as designed), or admin literally reuses email+phone sign-in (A2 is then replaced by a phone field; the ~1-week session decision is unaffected).
2. **What a Reviewer's approval does to a seller-correction report — RESOLVED by Dustin's ruling (2026-11-20): "No, that's their job, so right away."** A Reviewer's approval of a structured seller-correction report **applies the correction immediately**, exactly as an Admin's approval does; the interim proposal (Reviewer verifies, Admin applies) is overridden and deleted from §7 C5 (RA-3). The application records "applied on approval by {name}" in the audit trail. **Scope:** structured corrections via the report flow only — free-form seller editing (D3), classification (D4), and all removals remain Admin-only; in particular **route-to-retire stays Admin-only**, because retiring is a removal and the ruling speaks to corrections, not retirements. §11's matrix row is split to state the separation explicitly, and §5 phrases the bounded exception (a Reviewer never opens a seller edit form; approving a structured correction payload inside the report flow is the one exception).
3. **Duplicate holds' data home.** The scout's holds live in `VARIETY-PROPOSALS.md`; C4 assumes they become structured queue items with the matched variety and evidence attached. Whoever builds the feed (scout writer → `review_items` or an equivalent) must confirm the payload can carry: held variety name/crop, candidate existing variety, seller/listing evidence, and the comparison facts in C4's strip.
4. **Designed beyond the letter of the decisions (small, flagged):** (a) Admin management of alternate names on F2 (add/remove) — the natural companion to C4, not in the decisions; **amended at the gate (Finding 1, RA-1): aliases added by a duplicate decision are labeled "Added from a duplicate decision" and are not removable in admin by either role — the duplicate guarantee rests on them; manually added aliases remain removable under the §10.1 confirm, whose consequence now names the scout re-proposal effect as well as the search effect.** (b) crops as browse-only (F3) — crop *editing* is not designed; if Dustin wants crop edits, they follow the D3 sheet pattern. (b) remains cheap to extend at the gate.
5. **Visitors statistic source.** Views/clicks/waitlist/searches are first-party data the schema already holds. Raw *visitor* counts are not in the app's tables — ADMIN-SECTION.md's note proposes Cloudflare Web Analytics. H designs the Visitors card with a composed no-data state; **if Web Analytics is not wired at build time, that one card ships dark with its designed empty state** while the other three site stats (accounts, waitlist signups, clicks) are fully live. Custom date ranges are likewise deferred; v1 ships the 7d / 30d / 12w presets.
6. **Add Your Farm inside Seller candidates.** The legacy data keeps farm submissions in their own table/status, separate from hunt `seller_candidate` items. C0/C2 present them as one queue with a source label — a presentation unification the builder must honor in the query layer (or the queue splits into two sibling queues with identical detail patterns; the design survives either way, the count on the home card must be the sum).
7. **Internal notes are append-only in v1** (no edit/delete UI designed) and there is no designed path for Hue's API-side notes or the badge-review reasoning file to appear in D5. If Hue wants the existing classification reasoning visible as first notes, that's a data decision for the build brief, not a design change.
8. **Destructive color — RESOLVED at the Quinn design gate (2026-11-20), ruled under Ada's meaning-map and Iris's color discipline (RA-2).** Destructive confirms take a **dedicated admin-only danger token**: a warm vermilion-red used for exactly one job — the verb button inside destructive confirms (§10.1) — always paired with its verb label, and never used for errors or caution (ochre keeps those) or anywhere else in admin or on the public site. Gate-measured candidate **#8F1D12** (white label text 8.93:1; boundary against paper 7.93:1; its lightness sits a clear step below ochre's, so danger and caution stay distinguishable when hue is lost); **the final value is confirmed by Iris in her token pass**, and any substitute she sets must preserve that lightness separation from ochre. Petal gets no fifth meaning (this spec's refusal stands); the ink-filled interim does not stand — ink already means "ordinary content", so as a fill it signals prominence, not danger. §3.1 and §10.1 amended; no layout changed.
9. **Unsaved-work preservation across session expiry** (A3) is specified to the level of "destination always; sheet contents where the builder can hold them client-side". Full draft persistence is a build-scope decision for Hue.
10. **Undo for decisions** (§10.4) is designed as a pattern; which decisions are backend-reversible (declines and duplicate decisions are state changes; a *published* listing has public side effects) is for the builder to confirm per queue. Where undo doesn't exist, the status line omits it — the design never promises a reversal the system can't perform.
11. **Offline writes are blocked, not queued** (§10.6) — a deliberate honesty choice for actions with public side effects. If Dustin wants queued offline decisions, that's a new design pass, not a toggle.
12. **Session length precision:** "~1 week" is designed as 7 days for both Admin and Reviewer admin-layer sessions. If Dustin wants Reviewer sessions shorter, only the constant changes — no design impact.
13. **Approved-seller visibility — a designed rule, flagged for Dustin to override.** Quinn's gate (Finding 8) found C2's "candidate state" undefined for public visibility. The rule designed in: **an approved seller is not publicly listed — no public page, absent from the directory and from search — until an Admin completes its details and classification in Sellers (D2–D4).** Nothing half-finished reaches the public site. This is a design rule, not one of Dustin's settled decisions, and it cuts against the directory's hunt posture (sellers go live on approval; Dustin disqualifies afterward). If Dustin prefers live-on-approval, only C2's candidate-state definition and consequence copy change.


---

## Amendments — Quinn gate, 2026-11-20

Applied by Nadia (UX/UI) after Quinn's design gate returned **PASS WITH NOTES** (`QUINN-GATE.md`). Each line names the finding and the sections touched; nothing beyond the findings was redesigned. The amended sections return to Quinn for a delta re-gate before any build brief is written from them.

- **RA-1 (Finding 1, Major)** — §7 F2, §11, §15.4(a): alternate names added by a duplicate decision are labeled "Added from a duplicate decision" and are **not removable in admin by either role** — the stronger of the gate's two options, chosen because the duplicate guarantee ("the scout won't propose it again") must not rest on a confirm dialog being read; if a duplicate decision itself was wrong, Hue reverses it from the record rather than anyone deleting the name. Manually added aliases remain removable, and their §10.1 confirm now names the full consequence (search + scout re-proposal).
- **RA-2 (§15.8 ruling)** — §3.1, §10.1, §15.8: destructive confirm verb buttons take a new admin-only **danger** token (warm vermilion-red; gate-measured candidate #8F1D12; final value confirmed by Iris in her token pass) — one job only, always paired with its verb label, never for errors or caution. Petal gets no fifth meaning; the ink-filled interim is withdrawn.
- **RA-3 (Dustin's ruling on §15.2)** — §5, §7 C5, §11, §15.2: a Reviewer's approval of a structured seller-correction report applies it immediately, recorded as "applied on approval by {name}" in the audit trail; the verify-then-wait two-step for corrections is deleted. The §11 row splits: apply a structured correction — Reviewer **Live**; route to retire — Reviewer **Absent**, stated explicitly (removals stay Admin-only). §5 phrases the bounded exception: a Reviewer never opens a seller edit form; approving a structured correction payload inside the report flow is the one exception.
- **Finding 2 (Minor)** — §7 C2: the approval consequence line is role-aware (Admin: "until you finish their details and Small Farm classification"; Reviewer: "until an admin finishes…").
- **Finding 3 (Minor)** — §13.4: the notes-privacy test list now names the public seller page's rendered HTML and any search-index payload built from seller records, alongside the public API response, sitemap, and sync payload — each named surface tested explicitly.
- **Finding 4 (Minor)** — §4, §7 B, §7 H: the 1180px boundary belongs to the iPad band (a real iPad in landscape is exactly 1180 CSS px and lands in the iPad shell it was composed for); the desktop band begins at 1181px. Band table, reference viewports, and §14 now agree.
- **Finding 5 (Minor)** — §7 F1, §7 G1: no-results search states specified ("No varieties match '{query}'." / "No accounts match '{query}'." + Clear search — the D1 pattern).
- **Finding 6 (Minor)** — §11: the rendering key's Read-only now reads "no control that changes data" (view controls — search, filter chips, sort — may still be present).
- **Finding 7 (Minor)** — §7 H: the statistics header band is decided — **not sticky**; it scrolls with the page, §4's sticky list stands exhaustive, and the range restated on every card's caption carries recognition instead. No focus-obscured obligation arises.
- **Finding 8 (Minor)** — §7 C2, §15.13 (new): C2's candidate state is defined — **an approved seller is not publicly listed until its details and classification are completed** (no public page, absent from directory and search). Flagged in §15.13 as a designed rule Dustin can override.
