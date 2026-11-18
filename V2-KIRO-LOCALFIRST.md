# seeds.hues.flowers v2 — Kiro on Local-First + WASM and the API-run website (distilled)

**Source:** Kiro CLI run 2026-11-15, suggestions only — nothing built.
**Full raw output:** `hidden_files/kiro-v2-localfirst-raw.txt`
**Input critiqued:** Hue's position in `V2-AMENDMENT-LOCALFIRST-API.md` (local-first-lite with
SQLite WASM/OPFS, in-process SSR service layer, sync engine deferred).
**Distilled by:** Hue. ⚠️ VERIFY items are Kiro claims to check against current docs/devices at build time.

## Bottom line

> **ADOPT WITH CHANGES.** Kiro agrees with Hue on the in-process SSR layer, the deferred sync
> engine, and the Capacitor plan — but **disagrees on shipping SQLite WASM in v2**: at
> 22 varieties / <1 MB it calls WASM premature, and prescribes SW-cached JSON + in-memory
> search for v2 with the sync protocol *designed* WASM-ready so the replica slots in later
> at a concrete threshold.

---

## Where Kiro AGREES with Hue ✅

- **SSR in-process, not HTTP self-call (question e).** Kiro is emphatic: on Cloudflare Workers
  a self-fetch is **not** a loopback — it traverses Cloudflare's network, adds real latency,
  and can need explicit routing. Contract tests (same fixtures through service layer and HTTP
  handler) are the correct parity enforcement — but they must cover serialization edge cases
  (null vs undefined, date formats, pagination), not just happy paths, because SSR otherwise
  won't catch HTTP-only bugs that store apps would hit.
- **"The API runs the website" definition:** the `/api/v1` HTTP contract is canonical; Server
  Components call the same logic without HTTP overhead; web + native clients use the contract.
- **Defer the sync engine (question g)** — no user writes = no conflict resolution = no value,
  only operational complexity and schema constraints carried for nothing.
- **opfs-sahpool is the right VFS** if/when WASM ships: no SharedArrayBuffer, so **no
  COOP/COEP headers required** (avoids cross-origin-isolation side effects on Workers).
- **Security of a downloadable catalog .sqlite: no new risk** — the same public data is already
  scrapeable via the JSON API. One discipline rule: if non-public data (wholesale margins,
  unpublished tables) ever enters the DB, the export must use an **allowlist** of exported
  tables, enforced at generation time, never a denylist.
- **Two-tier instinct, sync-as-cache framing, eviction = re-sync** — directionally right
  (with harder iOS constraints, below).

## Where Kiro DISAGREES / changes Hue's position ❌

### 1. Don't ship SQLite WASM in v2 (question a) — the headline change
- At <1 MB, option (i) — **service-worker-cached `/api/v1` JSON + in-memory search** (linear
  scan / ~50-line trigram index over plain objects) — is fast enough at <500 varieties with
  ~0 KB extra bundle. Dexie/IndexedDB (option ii) adds persistence complexity for no
  measurable benefit at this scale either.
- **Kiro's adoption threshold for SQLite WASM — ship it when ANY of:**
  - ≥ **1,000 varieties**, AND payload ≥ **2 MB compressed**, AND queries need real joins
    (e.g. filter by seller AND trait AND region simultaneously), **OR**
  - offline **write** capability is added (favorites, lists).
- The FTS5-parity-with-D1 argument is "compelling once the data size justifies it — not before."
- **Design now, ship later:** the service layer + sync protocol should be built *as if* the
  SQLite replica slots in (same schema, same versioning contract) so adoption is a drop-in,
  not a redesign. Production-grade API at launch means the API anticipates sync — not that
  the client runs SQLite on day one.

### 2. iOS/WKWebView may invert the tier order (question c) ⚠️
- Kiro's sharpest new risk: **as of iOS 17, OPFS exists in Safari but NOT in WKWebView** —
  and WKWebView is what Capacitor renders in. If still true on current iOS/Capacitor, the
  WASM+OPFS tier is *unavailable in the store apps*, making IndexedDB the primary iOS path,
  not the fallback. ⚠️ VERIFY iOS 18 / Capacitor 6 status before designing around OPFS.
- Corollary Kiro raises: **Capacitor's native SQLite plugin** (native SQLite, no WASM at all)
  may be the better native-tier choice — an implementation detail inside the sync layer,
  invisible to app code. ⚠️ VERIFY at Phase 2 build time.
- iOS eviction detail: non-installed Safari-tab storage can be evicted after ~7 days idle;
  installed PWA storage is sturdier but not guaranteed; WKWebView/app-container storage is
  actually the *safest* (lives while the app is installed). Loading UX must treat
  cold-start-after-eviction as a normal state (re-sync spinner), never an error.
- Required pre-launch testing: real devices (not simulator — OPFS differs) on iOS 16/17/18
  Safari **and** the Capacitor build; explicit fallback-path tests (fallbacks bit-rot when
  the happy path always works in dev); eviction simulation via `navigator.storage.estimate()`
  + manual site-data clears.

### 3. Service worker must NOT independently cache catalog data (question d)
- The double-caching pitfall is the most likely stale-data bug: SW caches `/api/v1` JSON
  *and* a replica syncs from those responses → the replica silently ingests stale data.
- Kiro's division of labour: **SW owns app shell + assets only.** Once a replica exists, the
  SW becomes a *router* for data requests (replica if ready, network-first if not), never a
  second cache. The version-check request is **never cached**. A coordination protocol
  (replica-ready flag via IDB/BroadcastChannel) must be designed *before* either worker is
  implemented. Single client source of truth = the replica, once populated.
- Note: this applies in softened form even to Kiro's own v2 recommendation — SW-cached JSON
  (option i) must be version-aware (see §Sync below), not a naive cache-first store.

## Kiro's sync protocol design (question b)

- **Full snapshot every sync while compressed payload < ~500 KB** — deltas are merge-logic
  complexity for negligible savings. Design the delta boundary now, implement later.
- **Versioning: a monotonic integer catalog version**, bumped on any server write, checked via
  a lightweight `GET /api/v1/catalog/version` → `{ version, snapshot_url }`. Not per-entity
  `updated_at` (misses deletions, high-water-mark bookkeeping) and not content hashes
  (whole-dataset hashing to detect change). Server schema still carries
  `created_at` / `updated_at` / `deleted_at` soft-delete per entity for future delta correctness.
- **Staleness checks:** on app foreground, every 15 min while active, and on first API request
  after a >5 min background gap. No WebSockets for a read-only catalog.
- **Payload evolution:** JSON from `/api/v1` now → add a **prebuilt `.sqlite` snapshot download
  when the full snapshot exceeds ~2 MB compressed** (cold-start optimization for first install;
  versioned filename, CDN-cacheable, client drops+replaces). JSON deltas layer on top of the
  .sqlite base thereafter. The two paths coexist by design.

## Other risks / specifics Kiro raised (question f)

- **WASM loading discipline is architectural, not a note:** worker-only, initiated after
  `load` / `requestIdleCallback`, readiness signalled via BroadcastChannel, transparent API
  fallback until ready. "~400 KB gz is acceptable *if loaded correctly*" — and it will regress
  under time pressure if not enforced structurally.
- **Two workers need one designed message protocol** (service worker + sync/SQLite worker);
  for a read-only catalog, **combine sync + SQLite in a single worker** — no reason to split.
- **Turbopack ⚠️:** Next 16/Turbopack WASM asset handling is not at webpack parity;
  `@sqlite.org/sqlite-wasm` loads its `.wasm` as a URL (`new URL(..., import.meta.url)`
  patterns behave differently). Kiro's safe path when WASM ships: **load the WASM binary from
  a CDN URL inside the worker**, bypassing the bundler for the binary (cost: a CDN dependency).
  ⚠️ VERIFY Turbopack's current WASM handling in Next 16.4 first.
- OPFS trigram-index build time on iOS at ~5k varieties should be measured (iOS OPFS is
  slower than Chrome/desktop) — irrelevant at launch scale.

## Sync engine, when the time comes (question g)

- Defer — agreed. But Kiro names the future pick: **Electric SQL over PowerSync** when user
  writes arrive, because its model fits Postgres + Cloudflare (the Phase 3 stack), its sync
  layer separates cleanly from app logic, and its partial-sync "shapes" map to per-user
  catalog subscriptions. PowerSync is more mature today — re-evaluate when the decision is live.
  ⚠️ VERIFY Electric's production readiness at that future point.

## ⚠️ VERIFY list (consolidated)

1. OPFS availability in WKWebView on current iOS / Capacitor 6+ (gates the whole tier order).
2. `@capacitor/sqlite` native plugin vs WASM-in-WebView for the store apps.
3. Turbopack (Next 16.4) WASM asset handling for `@sqlite.org/sqlite-wasm`; CDN-load workaround.
4. `@sqlite.org/sqlite-wasm` default VFS + opfs-sahpool behaviour; COOP/COEP servability on
   Cloudflare Workers if the threaded VFS is ever needed.
5. Electric SQL production readiness — only at the future sync-engine decision point.
6. Kiro's numeric thresholds (1,000 varieties / 2 MB / 500 KB delta boundary) are reasoned
   estimates, not measurements — revisit against real catalog growth and payload sizes.

## What this changes in the v2 spec (if Dustin accepts Kiro's change)

- §PWA/sync: replace "SQLite WASM replica in v2" with "SW-cached, version-aware JSON +
  in-memory search in v2; sync protocol (`/api/v1/catalog/version`, snapshot envelope with
  `{version, since, entities[]}` shape) built WASM-ready."
- Add server schema discipline now: per-entity `created_at`/`updated_at`/`deleted_at`,
  monotonic catalog version counter bumped on any catalog write.
- Add acceptance tests: version-check never cached; eviction/cold-start re-sync state;
  fallback-path test on a real iPhone (Safari + later Capacitor build).
