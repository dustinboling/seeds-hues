# SPA browse/search Worker render crashes — cross-request promise chain in the shared catalog client

**Lane:** Seed Directory SPA conversion. **Dispatch:** fresh (eleventh conversion
coordinator, 2026-11-26). **Blocks:** preview acceptance and Slice 9 cutover
(Quinn's return condition 2 stays open until this ships and the deployed
preview passes the interactive acceptance drive).

## The symptom (deployed preview, real-browser acceptance drive, 2026-11-26 ~03:43 PT)

Preview: https://seeds-hues-preview.dustin-boling.workers.dev (Worker
`seeds-hues-preview` v8bc31250, merged main `88d0e71`, F2 fix included):

- `/variety`: loads unfiltered (831). Tapping ANY Hue chip (White, Yellow
  tested) navigates to `?color_family=…` and the page is replaced by the error
  boundary ("This page could not be loaded." / "Something went wrong").
  Reloading the filtered URL crashes identically.
- `/search?q=zinnia` (and `?q=rose`): the results page NEVER renders — direct
  open and in-app submit both land on the error boundary. The empty `/search`
  page loads fine.
- `/crop/snapdragon`: works end to end (71 → White → "5 varieties match",
  pressed chip, applied row, Clear All restores 71).
- Once observed: navigating BACK to unfiltered `/variety` briefly showed the
  error before a reload cleared it.
- The data layer is PROVEN correct on the deployed Worker (F2, PR #86):
  warm-then-filtered `pageContext.json` totals equal SSR on all four surfaces
  (831→125, 71→5, 199→28, 51→2). SSR HTML of the crashing URLs is correct.
  The defect is in the Worker render path, not the data.

## Root cause (PROVEN — do not re-diagnose; confirm the red reproduction, then fix)

`app/src/data/api.ts` — `createCatalogApi()` serializes every read through a
client-level promise chain:

```ts
let chain: Promise<void> = Promise.resolve();
const run = chain.then(() => fetchImpl(...));
chain = run.then(() => sleep(paceMs), () => sleep(paceMs)); // paceMs = 350
```

`app/server/worker.ts` keeps ONE catalog client per isolate (`IsolateShared`),
shared by every request that isolate serves. The chain's tail is a promise
that settles via a `setTimeout` 350 ms after the fetch — i.e. almost always
AFTER the response has completed and the originating request has ended.
Under workerd's `handle_cross_request_promise_resolution` (in force at the
Worker's compatibility_date 2026-11-01), a promise created by a request that
has since ended can never settle: the trailing sleep's settlement is dropped,
the shared chain is dead, and the NEXT request on that isolate whose render
needs an uncached API read either hangs on the dead chain (Vike's 30 s
data-hook timeout) or throws:

> Error: This promise was created by a request that has since ended, so it
> can never settle. With the handle_cross_request_promise_resolution
> compatibility flag, a promise can only settle in the request that created
> it, and settling it after that request ends is dropped.

→ the `+data` load throws → Vike renders the error page (HTTP 500). The
isolate stays poisoned for every fresh API read until it is recycled.

Why every earlier gate missed it: Node serve and the Node-run suites have no
cross-request promise rule, so the chain works there (Quinn's Stage 1 drive
ran on Node serve and passed). Why the deployed symptoms looked
route-specific: the per-isolate data cache (1 h TTL) serves warm renders
without touching the client, and isolate churn keeps landing requests on
healthy isolates — the crash only bites when a render needs a FRESH API read
on an isolate a previous request already poisoned. A filtered combination or
a search query is exactly such a read; `/crop/snapdragon`'s drive happened to
stay on healthy paths. The back-navigation observation is the same cause (the
back-nav data request hit a poisoned isolate; a reload hit a healthy one) —
no router-cache defect; do not change router code.

**Local reproduction (evidence, eleventh coordinator, 2026-11-26):** the
merged tree served by `wrangler dev -c wrangler.preview.jsonc` (local
workerd, same build as the deployed preview):

- Run A: `GET /` → 200 (home uses the shared client). Then `GET /variety` →
  the `+data` hook TIMED OUT after 30 s awaiting the dead chain; every
  subsequent API-backed page (`/variety`, `/crop/snapdragon`,
  `/search?q=zinnia`) → immediate 500 with the cross-request error above.
- Run B (fresh isolate, `/variety` as the first request): same 30 s timeout
  then fast 500s; a `/variety/index.pageContext.json?color_family=white`
  request answered 200 only because its data was already in the data cache.

## The fix

Remove cross-request promise state from the shared catalog client. After your
change, **no promise stored on the shared client — or on any per-isolate
singleton — may be created by one request and awaited by another.** Any wait
must be created inside the call that awaits it. Acceptable shapes (your
choice; hold the invariants):

- Timestamp pacing on the client: record slot times as plain numbers; each
  `getRaw` computes its slot, awaits a `sleep()` created within its own call
  for the remainder, then fetches. Fetches still start ≥ `paceMs` apart per
  client; concurrent callers take successive slots.
- A request-scoped pacer, or no chain pacing in the Worker runtime with
  Node/build pacing preserved — if you take this shape, say explicitly in the
  PR summary how build-time sweeps still pace themselves.

Invariants (do not trade these away):

- The 429 handling is unchanged: Retry-After backoff, max retries, error
  mapping. (A backoff sleep awaited within the request that received the 429
  is legal and stays.)
- Sweep pacing survives in effect: the chain exists because build/prerender
  sweeps share the live API's per-IP rate budget. Fetches from one client
  still start at least `paceMs` apart, in every runtime.
- The data cache (`app/src/data/cache.ts`), the edge mock
  (`app/src/server/edge-cache.ts`, including F2's `.pageContext.json`
  bypass), and all route/render code are untouched unless the grep sweep
  below indicts them.
- No changes under `v2/`; no workflow files; production is never deployed
  from this run.

**Grep sweep (required):** search the whole app server surface (`app/src`,
`app/server`, `app/pages`) for any OTHER cross-request promise state —
module-level or singleton-held promises, `.then` chains, memoized in-flight
promises, queues. For each hit: fix it the same way, or clear it in the PR
summary with the reason it cannot span requests (e.g. it stores values, not
promises; or it is created and settled inside one call). The PR summary must
carry this list.

## Tests first (state starting-red in the PR summary)

1. **Pacing-contract unit tests** (fake fetch + fake timers, in
   `app/tests/`): pin (a) fetch starts from one client are spaced ≥ paceMs,
   including under concurrent calls; (b) the 429 retry still waits and
   retries; (c) THE discriminating case — a call issued after a previous call
   has fully completed is not gated on any promise from the earlier call:
   simulate the earlier call's trailing wait NEVER settling (workerd's
   dropped settlement) and prove the later call still fetches and resolves.
   Case (c) must be red on the starting tree (hang/timeout or failed
   assertion) and green after the fix — run it against the starting tree and
   paste the red output in the PR summary.
2. **Scripted workerd regression** (attach the script + outputs to the PR
   summary): serve the built app with `wrangler dev -c
   wrangler.preview.jsonc` on a fresh isolate and run, in order, against the
   SAME isolate: `GET /` (200) → `GET /search?q=<unique-token>` (200,
   zero-results state — pre-fix this leg hangs to the 30 s data-hook timeout
   or 500s with the cross-request error; record the red output before fixing)
   → `GET /variety?color_family=white` (200, "125 varieties"). Use generous
   client timeouts: cold-cache catalog walks from this runner are slow for
   egress reasons unrelated to this defect; the search leg is the
   discriminating one.
3. Full app verify green: `cd app && npm run verify` (lint + typecheck +
   vitest). Do not weaken any existing test.

## Acceptance (Quinn's gate, after your PR opens)

- Quinn reproduces the suite, re-runs the workerd regression script green on
  a fresh isolate, and re-runs the discriminating unit test's starting-red.
- Browser drive of the acceptance script (locally served Worker build or the
  redeployed preview): `/variety` White tap → 125 in place, Clear All → 831;
  `/search?q=zinnia` renders ~51 results, White filter → 2;
  `/crop/snapdragon` 71 → 5 → 71; after a filtered view, back-navigation to
  the unfiltered page shows no error. All surfaces green is the only pass.
- Builder accounting appended to the PR body before merge (C1 mechanism).

## Explicitly out of scope (dispositions already recorded — do not "fix")

- **Chip count label:** in the filtered `/crop/snapdragon` view the White
  chip reads "71 varieties". This MATCHES production v2 exactly — production
  SSR of the identical URL renders the White chip as "(71)" alongside
  "5 varieties match" (verified 2026-11-26 against
  https://seeds.hues.flowers/crop/snapdragon?color_family=white). Facet
  counts are computed against the set filtered by the OTHER groups. Do not
  change facet-count semantics in this run.
- Slice 9 cutover, the C4 Tailwind-Plus admin question, and the 404-title
  disposition are untouched by this run.
