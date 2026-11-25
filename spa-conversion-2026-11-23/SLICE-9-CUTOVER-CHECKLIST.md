# Slice 9 — Cutover execution checklist (PREPARED 2026-11-25, sixth coordinator — NOT RUN)

Prepared from `muse-tasks/spa-slice-9-cutover.md`, the ARCHITECTURE-BRIEF
cutover section, Bea's PRERENDER-CONTENT-AUDIT §8.2/§8.4/§10, and the
Slice 8 gate records' final carry list. **Nothing in this checklist has
been executed.** The switch runs only on Dustin's explicit go (requested
by Hue 2026-11-25). Precondition states verified at preparation are in
PROGRAM.md's 2026-11-25 Slice 9 prep entry; re-verify any state that can
move (catalog seq, production Worker version, Verify conclusions) at
execution time.

Standing constraints (brief): the old Worker stays deployable for the
full sign-off window; rollback is a Worker redeploy of the v2 build,
never a code change under pressure; Bea §5.3 rollback triggers are
binding — **if a trigger fires, roll back first, diagnose second.**
Migrations, if any, apply to production D1 explicitly and are verified
BEFORE the switch (none expected in this slice). Prices never shown
anywhere. US spelling. The backend (D1, /api/v1, ingest, admin auth)
does not change.

## Phase A — Preconditions gate (every item green or explicitly waived by Dustin before Phase B)

- [ ] **Dustin's cutover go on record** (brief precondition 2). Q4
      soft-stagger check at go time: hues.flowers has not cut over and
      seeds is ready well first → the "does not wait" limb applies; no
      stagger delay.
- [ ] **C4 recorded or waived:** the Tailwind Plus admin standard's
      application to the converted admin surfaces (the admin was built
      as a faithful v2 port before the 2026-11-25 standard; the
      standard is non-retroactive per Quinn's Slice 7 carry). Dustin
      records the application or waives it for cutover.
- [ ] **404-title delta ruled or waived:** the app's 404 document title
      is "Page not found"; the live site falls through to the home
      title. Bea's ruling if exactness is required, or Dustin's waiver.
- [ ] **Search Console baseline (Bea §10) captured for seeds** through
      the browser route under Dustin's own sign-in (the hues.flowers
      Domain property covers seeds.hues.flowers; property-level
      starting line captured 2026-11-24). Capture, windows printed
      beside the figures: Performance 28-day + 90-day (clicks,
      impressions, CTR, avg position — total, per page for the §8.2 hub
      set, per-family rollups variety-listed / variety-zero-seller /
      seller / crop / series / state; top 50 queries); Generative AI
      performance report if present (else record the absence); Page
      Indexing snapshot (indexed count + every non-indexed reason with
      counts — the listed/zero-seller cohort split is possible only
      after the §8.2 segmented sitemaps are submitted, so pre-switch
      capture takes the totals and the cohort split joins at day 0/7);
      Core Web Vitals field data (mobile) for seeds; the AI answer
      panel (Technique 8 set) on ChatGPT / Perplexity / Google AI with
      mention, citation, accuracy, engines and date printed. Bea's
      formal in-console grant (Settings → Users and permissions)
      remains Dustin's action — flagged, tracked separately; it does
      not gate this capture, which runs through the owner sign-in.
      Also confirm both current sitemaps are submitted in the property
      (hues.flowers' was submitted 2026-11-24, 16 pages discovered;
      submit seeds' current flat sitemap if absent).
- [ ] **Merge tree green:** at prep, merge-commit Verify on main HEAD
      31651cc (run 45610976021) concluded SUCCESS, as did PR #82's own
      Verify 45608475922. If main has moved since, the new HEAD's
      merge-commit Verify must also read SUCCESS before Phase B.
- [ ] **Rollback target recorded:** the current production Worker
      version id written into the execution record BEFORE any deploy
      step (at prep: 90ef9130-dd88-4e94-9121-5be8c7f6edda, deployed
      2026-11-25T00:35Z — re-read at execution; v2 ships may have moved
      it).

## Phase B — Step 1: the three internal mounts (HARD blockers)

Mount in the production Worker, from D1, exactly as the app expects
them, preserving the R6/R12 positive behavior baseline and the pinned
degradation contracts as fallback. Each mount gets its live-data proof
re-run against the MOUNTED endpoint before the switch (prep-stage
proofs against D1 + the live backend are in PROGRAM.md, 2026-11-25):

- [ ] `GET /api/internal/variety-status/[slug]` — always 200
      `{status, merged_into}`. Proofs: a real active slug (e.g.
      snapdragon-cool-crimson → active/null); an unknown slug →
      unknown/null (never a 500, never a wrong 404/301); a soft-deleted
      slug (sweet-pea-luminosity-mix) → unknown class. NOTE: the merged
      class is empty in production D1 today (0 rows) — no real merged
      slug exists to exercise; the branch is proven by contract (stub +
      Slice 3/8 gates) and its first live exercise comes with the first
      decided duplicate hold. Record that plainly in the execution
      summary; do not manufacture a merge to test it.
- [ ] `GET /api/internal/unsubscribe/describe?token=` — 200 with
      `{kind, variety}` for a valid token; invalid → the app's
      invalid-link state (no scope). Proofs: token of the real shape
      (`u{id}.v{id}` / `u{id}.all` + 43-char base64url HMAC,
      UNSUBSCRIBE_SIGNING_KEY — confirmed set on the production
      Worker); the "all" scope answers with no D1 read; the variety
      scope's positive naming proof needs a real issued token (they
      exist only in recipients' mail — notification_outbox stores no
      bodies) → obtain one through the mailbox route at execution, or
      record the leg as carried to the C3 drive. waitlist_entries is
      empty in production today, so variety:null is the correct live
      answer for any entry-less scope.
- [ ] `/api/internal/admin/*` — the admin relay endpoints (session +
      role enforced by the service from the forwarded cookie; absolute
      7-day expiry, NO idle timeout). Proofs: signed-out → refusal with
      no data; `GET /api/internal/admin/me` with a real admin session
      cookie → 200 `signed_in` (session class exists in production D1:
      user id 1, role admin; unexpired sessions on record) — the cookie
      comes from the browser/mailbox route at execution; reviewer-class
      refusals per the Slice 7 role matrix. Backend data path already
      proven live at prep (key-API health + waitlist 200s with real
      data).

## Phase C — Step 2: pre-switch rehearsal on live data

- [ ] Serve the built app against the live API (production serving
      mode, mounts live from Phase B). Re-run the parity crawl against
      this surface: full §8.2 sitemap list — every canonical 200, every
      §8.4 redirect row one hop, unknown paths true 404, per-template
      raw-HTML JS-disabled contract checks (§3–§7).
- [ ] **Lastmod real emission:** regenerate the cache against the live
      API (`cd app && npm run gen:sitemap-lastmod` — at prep the
      committed cache sits at catalog_seq 4748 vs live 4769, and the 7
      Cool snapdragon varieties have no entries); commit the refreshed
      file through the normal gate path; then sample emitted `<lastmod>`
      values from the rehearsal sitemap against production D1
      `updated_at` for the same slugs (exact-match samples: one variety,
      one seller). Zero emission on verified rows is a STOP.
- [ ] **Lab-JS watch re-measure:** Lighthouse against the live-data
      build; /variety and /seller lab transfer vs the 150 KB ceiling
      (prep state: 1.8% / 2.9% headroom on LHCI run 45608475941; static
      sums 88.7% / 88.3%). Any regression past the ceiling is a STOP.
- [ ] **Legacy service worker supersession:** a client holding the v2
      SW lands on the new app cleanly (new SW scope/version, old caches
      purged on activate) — drive in the rehearsal browser session.
- [ ] **C3 real-browser drive** (owed since Slice 6; this is its gate):
      - Browser-session legs (any real browser session): real form
        construction on /report, /add-your-farm, /account (the browser
        builds the submissions the jsdom suites approximate); rendered
        admin sign-in surface at iPad dimensions (1024×768 / 1180×820).
      - Human/mailbox legs (name them in the summary as such):
        Turnstile-bearing submit completions (Turnstile does not pass
        in automated browsers — established); client-side route change
        with a LIVE session (visitor sign-in; admin sign-in code goes
        to Dustin's mailbox — the mailbox route Hue used 2026-11-21 —
        or Dustin's own signed-in browser); the rendered signed-in
        admin check at iPad size; the admin /me relay proof from
        Phase B if it rides this session.
      - Any test accounts created are deleted with all their data when
        the drive ends (standing rule).

## Phase D — Step 3: the switch + day-0

- [ ] Freeze note: catalog writes (scout, ingest, admin) continue
      against the unchanged backend throughout; no data freeze is
      needed. Record the switch timestamp (PT + UTC) in PROGRAM.md +
      SEASON-FILTER-REPORT.md the same hour.
- [ ] **Atomic switch** of the `seeds-hues` Worker to the Vike app per
      the ARCHITECTURE-BRIEF cutover sequence (@cloudflare/vite-plugin
      + Workers Static Assets; one Worker, whole property — never
      page-by-page). Record the new Worker version id.
- [ ] **Day-0 crawl of the LIVE new site** vs the Phase A baseline:
      full-sitemap crawl — status / canonical / title / JSON-LD per
      URL; tally stated as URLs / exact matches / mismatches with
      dispositions. Redirect uniformity asserted: 301, one hop,
      everywhere (no 308 mixture).
- [ ] **Robots diff** against the pre-change file: any unlisted
      difference is a STOP (rehearsed-clean delta = exactly the 3
      sanctioned parameter disallows).
- [ ] **Spot checks:** one variety with sellers; one zero-seller
      variety; one shop; one crop hub; one state page 2; admin sign-in
      (full flow if the Phase C session is live). URL Inspection
      spot-checks in Console (variety with sellers, zero-seller
      variety, one seller, one crop hub — confirm Google renders the
      SSR content).
- [ ] **Sitemap resubmission** in Search Console via the browser route:
      submit the new segmented sitemap index
      (https://seeds.hues.flowers/sitemap.xml) to the hues.flowers
      Domain property; record status + discovered counts.
- [ ] **Dates recorded at switch time:** day-7 alarm check date
      (switch + 7) and day-28 sign-off date (switch + 28), named in the
      project records with an owner (the coordinator on duty reports to
      Hue; Hue reports to Dustin).

## Phase E — Days 1–7 watch + rollback triggers

- [ ] Daily: Page Indexing + crawl-stats watch in Console (browser
      route). Day-7: alarm check only (performance judged in weeks,
      per Google's guidance) — report to Dustin either way at day 7.
- [ ] **Rollback triggers (Bea §5.3, binding):** indexed-page drop
      > 10% unexplained by the §8.2 map, OR any §8.2 canonical falling
      out of the index → **roll back first** (redeploy the Phase A
      rollback-target Worker version — the pre-SPA v2 build), diagnose
      second, same day. A rollback is reported as a rollback with its
      trigger named.

## Phase F — Day-28 sign-off

- [ ] Full comparison against the Phase A baseline (performance,
      indexing incl. the cohort split now readable via the segmented
      sitemaps, CWV, AI panel re-run). Record the verdict in PROGRAM.md.
- [ ] On sign-off: the pre-SPA Worker may be retired; the conversion
      closes. On a failed sign-off: the old Worker stays deployable
      and the lane reports the gap to Dustin with a plan.
- [ ] Post-cutover resumption order (standing, Dustin 2026-11-23):
      wishlist → CSN (fresh dispatch of its preserved brief) → state
      icons (SI) → tab bar (TAB) → seller tags. Nothing resumes before
      the sign-off unless Dustin directs it.

## Execution summary must state (brief)

Each precondition's verification result; each mount's live-data proof;
the day-0 crawl tally (URLs, exact matches, mismatches with
dispositions) and the rollback-trigger status; the C3 drive result with
its human/mailbox legs named; the sign-off dates recorded; anything
that deviated and why — plainly. A rollback, if one happens, is
reported as a rollback with its trigger named.
