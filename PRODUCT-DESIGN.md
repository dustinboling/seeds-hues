# Seed Directory — Product Design (consolidated)

**Status:** canonical product reference alongside `SPEC-CANONICAL.md` (which governs the directory data, ingest discipline, and launch gates). This document governs the product experience: doors, accounts, alerts, the assistant, and the knowledge system.
**Provenance:** consolidates the 2026-11-16 evening design session (Dustin + Hue) — the Phase 2 filters, the seller batch, accounts + waiting lists (`USER-ACCOUNTS-DESIGN.md`), the farm-owner model, Add Your Farm, email/SMS delivery, the AI assistant (chat + phone), the knowledge base, zones + personalized timing, and the MCP server. Where a fragment from that session conflicts with another, this document flags it and states the proposed consistent rule (§3) rather than silently choosing.
**Rename note:** the product is **Seed Directory** (renamed from "Seed Finder" 2026-11-16); domain seeds.hues.flowers unchanged.

---

## 1. Product map — four doors, one core

Everything is built on one core; each door is a rendering of it, never a separate system.

**The core**
- **Catalog** — plants, varieties, sellers, listings; evidence-based ingest only (source quote per listing, hand approval, `/go/{id}` tracked outbound links, prices captured but NEVER shown in Phase 1).
- **Fact base / knowledge base** — sourced per-crop and per-variety facts (season class, sowing method, hue, role, difficulty, zones, timing rules — `VARIETY-FACTS-SCHEMA.md`), each fact carrying its source.
- **Accounts** — one account model (name + email + phone + ZIP, no password, no sign-in codes), with verification state per channel.
- **Inquiries + alerts** — one record type for "find this for me": web waitlist joins, IVR asks, chat requests, and (later) MCP captures are all inquiries; the account's **Alerts section** is the list of them with live status; notifications (text primary, email secondary) are the outbound echo of changes to that list.

**The doors**
1. **Website** (seeds.hues.flowers) — browse/search with combinable filters (season × sowing method × hue, zone to come), variety/seller/crop/state pages, the ZIP box, accounts, Add Your Farm.
2. **Chat assistant** — a chat bubble on the site; the shared assistant brain over the same API.
3. **Phone IVR** — an AI-run conversational phone service on the same number that sends the text alerts; free-form speech, no menu tree.
4. **MCP server** — other people's AI assistants query the directory directly; a thin MCP layer over the existing `/api/v1` (no second data path), so the Seed Directory becomes the cited source when any assistant answers "where can I buy variety X?"

**Phases, in dependency order**
- **Phase 1 — Site + catalog.** LIVE. Directory, seller pages, `/go` tracking, ingest discipline, launch Dec 16, 2026.
- **Phase 2 — Filters + facts.** LIVE 2026-11-16. Season / sowing-method / hue filters from sourced classifications; seller summaries, imported Google ratings, state pages in the same batch.
- **Phase 3 — Accounts + alerts.** Signup (ZIP required) + verification codes, waiting lists/inquiries, the notification pipeline (SMS + email), Add Your Farm + the farm-owner flag, the header CTA + account icon. Design: `USER-ACCOUNTS-DESIGN.md`.
- **Phase 4 — The assistant + knowledge surfaces.** One assistant brain serving chat and phone; the knowledge base; variety requests + the hunt; the smart-link flow; zone filter, ZIP box, frost-date blurbs, personalized timing blocks.
- **Phase 5 — MCP server.** The assistant's tool layer exposed externally (same tool definitions, used twice: internal + MCP). After the core API + accounts stabilize.

## 2. User journeys

**(a) Web visitor → signup → waitlist → text alert → farm.**
A visitor browses varieties (filters on), lands on a variety with no sellers: "No sellers yet — currently unavailable" + "Join the waiting list." Joining asks for the account in one flow (name, email, phone, ZIP, Turnstile) — the zone is derived from the ZIP automatically. Two one-time verifications gate notifications, not the account: a 6-digit email code, and (for texts) an explicit opt-in checkbox + a one-time SMS code to the alert number. Their Alerts section shows the variety as *waiting*. The moment a listing for that variety is published at any farm, the matcher queues one alert: a short text (primary) + the full email (secondary), each linking to the variety page, which now shows the farm and its tracked `/go` buy link. One alert per variety per user — deduped, digest-grouped per drain run, unsubscribable per list and globally.

**(b) Caller → phone-only starter account → held inquiry → smart-link signup → their variety → alerts live.**
A gardener calls the toll-free number. The AI host answers conversationally (recognising a completed account's caller ID with a first-name greeting). They ask for a variety in their own words. The system creates a **starter account keyed to their caller ID** (verbal consent captured and logged first) and records an **inquiry** for that variety — status HELD. The AI says, in one breath: *"I'm texting you a link — it'll have you finish your account first, then take you straight to that variety."* The text carries **one smart link** (tokenised, tied to account + inquiry, variety as destination). Tapping it lands on the finish-setup page (name confirmation, email + its one-time code, SMS opt-in, ZIP — no dictating emails by voice); the instant setup completes, the inquiry activates and the site **redirects to the variety page** — already showing live status (found at a farm, or waiting with alerts on). If they never finish setup, the account still works when they call again, but nothing is ever sent to it.

**(c) Farm owner: declare → Add Your Farm → review → verified flag → (future) owner tools.**
At signup (or later) a user declares "I'm a farm owner" (`farm_owner_declared` — intent only, grants nothing). They get a **normal, fully functional account immediately** and are routed into the Add Your Farm details (locked field list: farm name, contact name/email prefilled, city, state — prefilled when arriving from a state page — website/shop URL, business phone *required and never prefilled*, about, varieties wanted, authorization checkbox; optional GBP/socials/wholesale/notes; Turnstile). Submission creates a review-queue item pre-linked to the account **and emails Dustin immediately** — verification never waits for him to open the queue. An automated job drafts the farm's profile summary from its own website under evidence discipline (every claim backed by a stored quote; draft only, never auto-published) plus machine-suggested structured values shown beside the submitted ones. On approval, ONE action: seller record created/linked, `is_farm_owner = true` + `seller_id` set, audit row written, summary draft approved/edited. On decline, the account stays a normal gardener account, declaration noted. Revocation flips the flag (audit row) and unlinks owner access without touching the account or its alerts. Owner tools themselves are future work; the permission rule is designed now: owner surfaces require `is_farm_owner = true` AND target seller = the account's `seller_id`, checked server-side every time.

**(d) Chat visitor asking for an unlisted variety → hunt → review → alert.**
A visitor opens the chat bubble and asks for a variety. The assistant searches the catalog first: found → farms/links, or zero-seller status + one-tap waitlist. Not in the catalog (or no sellers) → the assistant captures a **variety request as an inquiry** on their account (anonymous chatters get the same smart-link finish-setup flow as callers, held until complete) and says honestly: "Not found yet — you're on the list and we're hunting." The request triggers **the hunt**: the agent scours the web for farms selling that variety through the ingest discipline only — evidence-quote validation, candidates land in Dustin's review queue, **nothing auto-publishes**, new varieties become catalog-expansion candidates. Hunt jobs are queued by demand (waitlist counts rank them) and count against the spec's agent spend cap ($150/mo) and daily review budget. When a find is verified and published, the normal alert fires (text primary) to everyone waiting on that variety.

## 3. Account lifecycle — one state model, every door

| State | How you get here | What works | What the user sees |
| --- | --- | --- | --- |
| **Anonymous** | Arriving anywhere | Browse, search, filters, ZIP box lookup, chat/phone questions | Prompts to join a list / finish setup when they ask for something |
| **Starter (held)** | IVR call (caller-ID account) or an anonymous chat request | Calling/chatting again (recognised), finish-setup via smart link | "We'll hold your request — finish your profile from the text we're sending, and your alerts switch on." |
| **Complete** | Web signup (all fields up front) or finish-setup completed | Waiting lists, Alerts section, favorites, personalization (zone-aware pages + assistant), Add Your Farm | Alerts live; per-channel delivery depends on that channel's verification (below) |
| **Farm owner** | Complete + Dustin's approval of an Add Your Farm submission | Everything above + (future) owner tools for their linked seller only | Farm-owner status shown on the account; tools unlock after review — stated at declaration time |

**The one activation rule (proposed, resolving the fragments):** an inquiry is **ACTIVE** when (1) its account is *complete* (name + ZIP + at least one verified contact channel), and (2) the delivery channel for the alert is itself verified + consented — email verified for email alerts; SMS opt-in + alert number verified for texts. Otherwise the inquiry is **HELD**: recorded, attached, visible in the Alerts section with its status and what will switch it on — and it activates automatically the moment the conditions are met. Notifications are only ever sent for ACTIVE inquiries.

> **Conflict flagged (2026-11-16 fragments):** the web design (§2a/§4 of the accounts design) describes unverified web users' waitlist entries as "inactive until they verify," with the account otherwise complete at signup; the IVR design describes starter-account inquiries as HELD until the account is "finished fully," with a distinct completion step web users never see. These are the same behaviour with two vocabularies and two completion definitions. **Proposed consistent rule:** the state model + activation rule above, applied verbatim at every door. Web signups are complete-by-construction except channel verification (name + ZIP are collected at signup); IVR starters are incomplete until finish-setup supplies the same fields. One rule set, one vocabulary (held/active), no door-specific exceptions. The single designed exception: the smart-link text to a starter account is the *completion invitation itself*, not a notification, so it may be sent to a held account.

## 4. The knowledge system — one truth, three renderings

**Fact schema → knowledge base → surfaces.** Facts live in the catalog's fact base (`VARIETY-FACTS-SCHEMA.md`): the original 30 attributes plus the 2026-11-16 additions — `season_class` and `sowing_methods` (live), `color_family` (live), `role_use` (focal / filler / spike-or-line / foliage / texture), `difficulty` (easy / moderate / finicky), `usda_zone_min/max`, and `timing_rules` (frost-offset sowing/transplant windows). Reference datasets sit beside them: the self-hosted ZIP→zone table (current USDA Plant Hardiness Zone Map, half-zones) and ZIP→frost-dates (NOAA climate normals: average last spring frost, average first fall frost, frost-free season length).

**Three renderings of the same truth:** (1) **filters + pages** — the Phase 2 filter family, fact rows on variety/crop pages, the zone filter, and the personalized timing block computed from the gardener's ZIP; (2) **the assistant** — chat and IVR answer growing questions and give suggestions (role + season + difficulty + context) from the KB only, landing on real catalog entries (sellers → links; none → waitlist offer); (3) **MCP tools** — `get_growing_facts` returns the same facts (ZIP-personalized where a ZIP is supplied). A date-computation layer turns timing rules + a ZIP's frost dates into concrete calendar dates; pages and assistant quote the SAME computed dates — one computation service, no divergent answers.

**Sourcing + governance.** Every fact is empty unless a real source states it, and carries its source (Floret reference text, TGW's published collections, seller/seed-house data). `difficulty` and `role_use` additionally accept a Dustin-reviewed rating where no source states one — flagged as reviewed, never extractor-inferred. Facts enter through the same evidence discipline as listings; coverage is reported per build (how many crops have sourced zone data vs queued, etc.). The assistant answers ONLY from the KB + catalog and says "I don't know yet" outside it — it never improvises agronomy, listings, prices, or availability. Floret's text and photos remain private reference, never published.

## 5. UX principles

- **One tap / one breath.** Every flow explains itself in a single sentence at the moment of action ("I'm texting you a link — it'll have you finish your account first, then take you straight to that variety"). If a step needs a paragraph, the step is wrong.
- **Nothing asked twice.** Prefill from the account (contact name/email on Add Your Farm), from context (state prefilled from the state page), and from the channel (caller ID recognition; ZIP → zone derived, never re-typed). A variety asked for on any door is already in the Alerts section on every door.
- **Every answer ends somewhere actionable.** A found variety → the farm's buy link. A missing one → a waitlist join or a hunt request. Advice → real catalog entries. A held request → the finish-setup link. No dead ends, no dead buttons (CTAs ship only with their destinations).
- **Averages labelled as averages.** Frost dates are 50%-probability averages; computed sowing dates are planning dates, not guarantees; imported Google ratings are labelled as Google's, never blended into our own "Not yet rated."
- **Honesty as a feature.** The assistant never invents listings, prices, availability, or facts; "not found yet — you're on the list and we're hunting" is a complete answer. The AI identifies itself honestly if asked.
- **Accessibility is a design constraint, not a patch.** WCAG 2.2 AA from the first sketch: swatches always carry text labels, shapes never carry information alone (state outlines sit beside state names), ≥44px targets, real labels and error text, Turnstile's accessible widget, and a voice door that serves gardeners who don't live on the web.
- **Brand discipline.** The header brand mark is the site's home button (links to `/` — corrected 2026-11-16); Hues Floral Park is credited in the lockup line and linked from the footer attribution. Never hotlink assets; everything self-hosted.

## 6. Open decisions for Dustin (with recommendations)

1. **SMS + voice provider: Twilio vs AWS End User Messaging.** *Recommendation: Twilio.* The Phase 4 plan (ConversationRelay + our own LLM) is Twilio-shaped; one vendor for texts + voice keeps consent records, the toll-free registration, and STOP/HELP handling in one place. Pinpoint's FREE-plan availability is still unverified (AWS session needs your re-login code) — Twilio makes that moot.
2. **Sender registration path: verified toll-free number vs 10DLC brand+campaign.** *Recommendation: verified toll-free.* Lightest path for our volume; the same number sends alerts and takes IVR calls.
3. **MCP write access in v1: read-only vs adding `variety_request` capture behind auth.** *Recommendation: read-only v1.* Ship the five read tools (search_varieties, get_variety, get_seller, lookup_zone, get_growing_facts) once the API + accounts stabilize; add authenticated request capture in v1.1 after the chat door's abuse controls (Turnstile-equivalent + rate limits + demand queueing) are proven. Prices are never exposed through MCP either way, and every response carries canonical seeds.hues.flowers URLs + freshness timestamps.
4. **MCP access model: open + rate-limited vs API keys.** *Recommendation: API keys (self-serve, revocable) with generous rate limits.* The data is public, but keys give us abuse control and a usage picture; OAuth is overkill until writes exist.
5. **"N gardeners are waiting" social proof on zero-seller pages.** *Recommendation: show it only at ≥3 waiters.* Below that it reads as an empty room; at 3+ it's genuine demand signal and encourages joins. (Flagged as your call in the accounts design; needs a ruling before Phase 3 copy is final.)
6. **Difficulty + role ratings where no source states them.** *Recommendation: you review a one-page crop list (93 crops, ~15 minutes) once the sourced pass lands.* The assistant may not quote an unreviewed rating, so this list is the gate on the advisory feature's coverage.

---

*Detail documents: `SPEC-CANONICAL.md` (directory spec + launch gates) · `USER-ACCOUNTS-DESIGN.md` (accounts, alerts, Add Your Farm, Phase 4 assistant detail) · `VARIETY-FACTS-SCHEMA.md` (fact attributes incl. zones + timing) · `DELTA-PLAN-DEC16.md` (launch plan).*
