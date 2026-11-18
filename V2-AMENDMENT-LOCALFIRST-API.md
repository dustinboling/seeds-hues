# Amendment to V2-BUILD-SPEC — API-run website, immediate app-store Phase 2, Local-First + WASM

**Owner direction (Dustin, 2026-11-15, supersedes V2-DESIGN-PWA-API.md where they differ):**
1. Phase 2 app-store distribution happens **immediately after website deployment** — it is
   not a later traction phase. API readiness is therefore a Phase 1 launch blocker, not a nicety.
2. **Create the API to run the website from** — the website is API-driven.
3. Local-First + WebAssembly evaluated by Hue (below) — recommended in the "lite" form for v2.

## 1. API runs the website (concrete build terms)

- `/api/v1/*` route handlers + the service/repository layer are the single data path.
- **Client side:** 100% API-driven — search, browse, variety/seller views after first paint,
  PWA offline sync, all fetch `/api/v1/*`. This is the exact surface native apps will use.
- **Server rendering:** Server Components call the *same service layer in-process* (the code
  that implements the API), NOT an HTTP self-call. Reason: an HTTP loopback per page adds
  latency + a failure mode and hurts the SEO/GEO rendering we chose Next for. Data, validation
  (Zod), and response shapes are identical either way — parity is enforced by contract tests
  that run the same fixtures through both the in-process service and the HTTP API.
- API is production-grade at launch (because app-store apps ship right after): versioning,
  cursor pagination, ETag/Cache-Control, CORS for app origins, rate limiting, structured
  errors, OpenAPI 3.1 at `/api/v1/openapi.json`, uptime/cache headers suitable for CDN caching
  of public GETs.
- App-store note (from Hues' earlier app-store research): Apple Developer $99/yr + Google
  Play $25 one-time, in Dustin's name; iOS builds need a Mac/cloud-Mac. Enrolment should start
  IN PARALLEL with the website build so review/enrolment wait doesn't gate Phase 2.

## 2. Local-First + WebAssembly — Hue's evaluation

### Why it fits this app unusually well
- The Phase 1 catalog is **read-only for users and tiny** (<1 MB now; ~tens of MB at thousands
  of varieties). The hard part of local-first — write conflicts / CRDTs — **does not exist yet**.
  What remains is one-way sync: API publishes a versioned catalog snapshot + deltas; the device
  keeps a local replica and reads from it. Instant repeat loads, full offline browsing.
- **SQLite is already the stack on both ends:** D1 (server) is SQLite; the official SQLite
  WASM build (`@sqlite.org/sqlite-wasm`, ~400 KB gz) runs the *same schema and the same FTS5
  trigram search* in the browser, persisted to OPFS from a Web Worker. Search becomes local:
  ~milliseconds, offline, zero API calls per keystroke. Capacitor's native SQLite gives the
  Phase 2 store apps the same schema again — one data model across web, PWA, iOS, Android.
- WASM cost is real but bounded: ~400 KB gz one-time (precached by the service worker),
  2–5× slower than native SQLite on CPU-bound queries — irrelevant at catalog scale
  (FTS5 over 50k docs ~20 ms class).

### The honest risks
- **Safari/OPFS is the weak link:** OPFS sync access handles are Worker-only everywhere and
  Safari's implementation has historically been inconsistent (17.4+ is workable). Required:
  a two-tier design — OPFS where supported, IndexedDB-backed fallback with identical FTS5
  behaviour where not — and real-device testing on Dustin's iPhone before launch.
- **SEO must not depend on it:** crawlers get server-rendered HTML from the service layer.
  Local-first is a post-hydration enhancement layer only. If WASM fails to load, the site
  falls back to API-driven rendering with no visible breakage.
- **Storage eviction:** browsers can evict OPFS/IndexedDB under pressure (esp. iOS for
  non-installed sites). Installed PWA + `navigator.storage.persist()` mitigates; the replica
  is always re-syncable from the API, so eviction = a re-download, never data loss.
- **Full local-first (user writes) is deferred on purpose:** favorites, reviews, orders need
  a sync engine with conflict handling (PowerSync/Electric sync Postgres→SQLite — which pairs
  with the Phase 3 Postgres migration). Building that now, before any user writes exist,
  would be paying distributed-systems complexity for nothing.

### Recommendation written into the spec
- **Adopt local-first-lite in v2:** versioned catalog snapshot + delta sync from `/api/v1`,
  SQLite WASM + OPFS local replica (IndexedDB fallback), local FTS5 search, graceful
  API fallback. No CRDTs, no sync engine, no user-write sync in v2.
- Keep the sync protocol API-based (not D1-specific) so the Phase 3 Postgres move — and a
  future PowerSync adoption — slot in without changing clients.
