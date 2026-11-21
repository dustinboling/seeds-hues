# Task: Statistics Visitors card — wire the Web Analytics read path (Slice D follow-up; admin spec §7 + §15 item 5)

Slice D shipped the admin Statistics Visitors card DARK by design: its
designed no-data state, no number rendered, because at build time Web
Analytics wiring was missing. That blocker is now cleared — **Web Analytics
is already enabled** for the hues.flowers zone (site_tag
`ae44dc0d0d524ddaa5a485bc5e62e7ff`, auto-installed by Cloudflare, verified
collecting for seeds.hues.flowers). Do NOT add a beacon snippet anywhere —
the zone already auto-installs it; a manual snippet would double-count.

## What to do

1. **Read path.** Query Cloudflare's GraphQL Analytics API
   (`https://api.cloudflare.com/client/v4/graphql`) for the RUM pageload
   dataset (`rumPageloadEventsAdaptiveGroups`, account node for account
   `51080ac04974bef5a30d7ceb5b79e9e2`), filtered by BOTH:
   - `siteTag: "ae44dc0d0d524ddaa5a485bc5e62e7ff"`, AND
   - `requestHost: "seeds.hues.flowers"`.
   Both filters are mandatory: the site tag is zone-wide (all of
   hues.flowers), and presenting zone-wide traffic as directory visitors
   would be a blended falsehood — the exact failure Slice D shipped dark to
   avoid. Aggregate counts per day over the Statistics page's selected
   range (the page's existing 7 days / 30 days / 12 weeks segmented
   control), plus the previous equal period for the delta.
2. **Credential.** Read the API token from a Worker secret named
   `CF_ANALYTICS_API_TOKEN` (it will be set on the Worker before this
   deploys; it is never in code, config, or tests). If the secret is absent,
   or the API errors/times out, the card falls back to its existing designed
   no-data state — no number, no error page, the rest of Statistics
   unaffected. Bound the fetch with a timeout.
3. **The card.** Keep the spec §7 anatomy exactly: stat number (tabular),
   delta vs the previous equal period (arrow + percent + word), trend bars,
   a one-sentence plain-words summary, and the visually-hidden data table.
   Caption the number honestly with what it counts and its source
   (pageloads from Cloudflare Web Analytics for seeds.hues.flowers) — one
   source per number, as everywhere else in Statistics. Thin-data rules
   from Slice D apply unchanged (totals without deltas + the thin-data line
   when a full period isn't available).
4. Nothing else in Statistics changes. No other card's source, caption, or
   math is touched. No public-site change. No beacon, no client-side
   analytics code.

## Tests (required, non-vacuous)

- With a mocked GraphQL response, the card renders the aggregated number,
  the correct delta direction/percent, and per-day trend values; a fixture
  whose rows include OTHER hosts under the same site tag must NOT be
  counted (prove the query carries both filters — assert on the request
  payload the code sends).
- Secret absent → designed no-data state, no digit rendered anywhere in the
  card (extend Slice D's existing assertion style).
- GraphQL error/timeout → same no-data fallback; the rest of the Statistics
  page still renders.
- State in your finish summary how you proved the new tests fail on the old
  code (stash/revert check).

## Constraints

- Admin Statistics only. No migration. No new public surface.
- The token value must never appear in code, tests, fixtures, logs, or the
  PR. Tests mock the GraphQL endpoint.
- US spelling in any text you touch. Follow the repo's standing code
  constraints.

## Finish-line summary (use this as the PR title)

"Statistics Visitors card live: Web Analytics read path (GraphQL RUM pageloads, site tag + seeds.hues.flowers host filter only)"
