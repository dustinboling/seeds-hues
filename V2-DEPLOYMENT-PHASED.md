# seeds.hues.flowers v2 — Phased Deployment + Database Plan (Kiro, 2nd consultation)

**Source:** Kiro CLI run 2026-11-15, suggestions only — nothing built. Kiro read PROJECT-BRIEF.md, V2-KIRO-SUGGESTIONS.md, and the v1 data (14 varieties / 9 sellers / 14 listings, <1 MB total).
**Full raw output:** `hidden_files/kiro-v2-deployment-raw.txt`
**Owner requirement driving this plan:** start cheap, transition to something more robust later for the full marketplace.
**Note:** Kiro's web search was blocked in this session, so items marked ⚠️ VERIFY are Kiro claims to check against current vendor docs/pricing before budgeting or building.

## Bottom line — Kiro's phased recommendation

> **The app never moves. Only the database moves.**
> Phase 1–2: Cloudflare Workers + D1. Phase 3 (marketplace): same Workers app, DB migrated to Postgres accessed via Cloudflare Hyperdrive.

| | Phase 1 — Launch | Phase 2 — Traction | Phase 3 — Marketplace |
|---|---|---|---|
| **App** | Cloudflare Workers + OpenNext | Same | Same |
| **DB** | D1 (SQLite) | D1 (SQLite) | Neon Postgres via Hyperdrive (RDS is an alternative) |
| **Search** | FTS5 trigram | FTS5 trigram | Postgres FTS, or Typesense if >5k varieties |
| **Auth / payments** | None | None | Clerk or Auth.js / Stripe |
| **Cost/mo** | **~$0 marginal** (Workers Paid $5 already shared) | **~$5–6** | **~$20–35** |
| **AWS credits used?** | No | No | Optional only |

## 1. Cloudflare vs AWS, per phase (unbiased, with costs)

### Phase 1 — Launch (<1k visits/mo)
- **Cloudflare: ~$0 marginal.** Workers Paid already active for other Hues apps; D1 within free tier (5M reads/day, 100k writes/day); R2 ~$0; egress free.
- **AWS OpenNext via SST (Lambda + CloudFront + S3): ~$0–2/mo** within free tier — viable, but adds SST/IaC complexity for no benefit at this traffic.
- **AWS App Runner / Fargate: ~$5–7/mo floor** (always-on) — over-provisioned for launch.
- **AWS DB options if on AWS:** RDS t4g.micro Postgres ~$12/mo, no resume latency. Aurora Serverless v2: ~$43–44/mo floor at 0.5 ACU; the 0-ACU auto-pause option ⚠️ VERIFY for this project/region, and its 20–30s resume would be catastrophic for a first visitor after idle.
- **Amplify: likely disqualified.** ⚠️ VERIFY — Kiro (and Hue's earlier check) found Amplify docs listing Next.js 12–15 only, with no on-demand ISR/streaming. Do not assume Next 16.4 support.
- **Verdict: Cloudflare wins Phase 1 by a large margin** — cost and ops simplicity.

### Phase 2 — Traction (10k–100k visits/mo)
- **Cloudflare: ~$5–6/mo** (Workers Paid + ~$0.50 KV ISR cache; D1 still within free tier; egress $0).
- **AWS OpenNext/SST: ~$18–28/mo** (Lambda/CloudFront ~$5–15 + RDS ~$12 + S3 ~$1).
- Latency: both globally adequate; Cloudflare has more PoPs, CloudFront is fine for US/PNW-heavy traffic. **Verdict: Cloudflare still wins, mainly on cost.**

### Phase 3 — Marketplace (accounts, reviews, orders, payments)
- **Cloudflare path: ~$10–15/mo staying on D1, or ~$20–30/mo with Hyperdrive + Neon Postgres.**
- **AWS path: ~$52–115/mo** (OpenNext/CloudFront/Lambda $20–50 + RDS t4g.small/medium $25–50 + S3/media $5–10 + SQS/workers $2–5).
- Capability split is real: Postgres gives ACID row locking (`SELECT FOR UPDATE`), better native FTS, no storage ceiling. D1 gives SQLite transactions (adequate at modest volume) but a hard **10 GB/db ceiling** and no row-level locking — 1M reviews ≈ 500 MB, 100k orders ≈ 50–100 MB, so the ceiling becomes *tight*, not immediate.
- **Verdict: even in Phase 3, Kiro does NOT recommend moving the app to AWS.** Migrate only the DB, via Hyperdrive, and stay on Workers.

## 2. Database per phase + the exact D1 → Postgres transition

**Per phase:** D1 in Phase 1, D1 in Phase 2, Postgres at the marketplace trigger.

### What breaks / must change (SQLite → Postgres)
| Area | Change |
|---|---|
| PK autoincrement | `INTEGER PRIMARY KEY` → `SERIAL` / identity — Drizzle schema change only |
| Booleans | stored 0/1 → native `BOOLEAN`; any raw `=== 1` SQL breaks — stay in Drizzle operators |
| Timestamps | TEXT/INTEGER → `TIMESTAMPTZ`; convert values on load |
| JSON | TEXT → `JSONB`; raw `json_extract()` calls break |
| **FTS (hardest piece)** | **FTS5 virtual table + trigram + sync triggers → generated `tsvector` column + GIN index + `plainto_tsquery`; add `pg_trgm` extension for mid-word/partial matches. Query function rewritten. 4–8 hrs incl. testing.** |
| `LIKE` semantics | SQLite case-insensitive → Postgres case-sensitive (`ILIKE`) — audit all uses |
| Init/DDL | Remove `PRAGMA`s and `AUTOINCREMENT` from any raw SQL (Drizzle abstracts both) |
| Drizzle dialect | `drizzle-orm/sqlite-core` (`sqliteTable`, `integer/text/blob`) → `drizzle-orm/pg-core` (`pgTable`, `serial/boolean/timestamp/jsonb`) — schema file replacement, 2–4 hrs |

### Migration steps
1. Stand up Postgres alongside D1; swap Drizzle schema dialect.
2. Export D1 (`wrangler d1 export` → CSV/JSON); transform booleans/timestamps (prices stay integer cents — no change).
3. Load via `psql \copy` or a one-off Drizzle/pg script; `tsvector` generated column populates automatically.
4. Validate: row counts, orphan joins = 0, spot checks (e.g. GeoSeed × Katz Mix packet prices), search queries.
5. Cut over: point `DATABASE_URL` / Hyperdrive config at Postgres, redeploy. Simple maintenance window is fine — Phases 1–2 have no user-generated writes, so no dual-write needed.
- **Downtime: 15–60 min maintenance window** (or ~0 user-facing with blue/green + read-only stale window).
- **Total effort: 1.5–3 days focused engineering, including testing and cutover.**

### Do NOW in v2 to make that transition cheap
- **Repository abstraction:** all DB access through `lib/repositories/*.ts`; no Drizzle calls elsewhere. Migration replaces those files' internals only.
- **Isolate FTS** in a single `searchVarieties(q)` function — the one function that gets rewritten.
- Use **Drizzle operators, not raw SQL**, everywhere except FTS.
- **Portable column semantics:** booleans via Drizzle boolean mode, timestamps as ISO/`mode:'date'` text, JSON via `text(..., {mode:'json'})` — all emit the same TS types on both dialects.
- **Integer cents** for prices (already planned); **slugs as public identity**, integer PKs internal — no URL changes on migration.
- **Single portable schema** with a dialect flag + portable type wrappers, not dual schemas.
- **Avoid:** `env.DB` outside DB-client init, FTS5 SQL (`MATCH`/`bm25()`) scattered in code, `PRAGMA` in app startup, hand-written `AUTOINCREMENT`, and D1 `db.batch()` (no Postgres equivalent — use Drizzle transactions).

### Transition triggers (feature-driven, NOT traffic-driven — D1 handles reads fine)
Migrate when **any two** are true:
- D1 size exceeds **5 GB** (half the ceiling — don't wait for the wall)
- **Checkout/orders** are being built (need row-level locking)
- Reviews exceed **50,000 rows**
- Seller self-service sustains **>500 writes/day**
- A Postgres-only feature is actually needed: `pg_vector` semantic search, PostGIS location search, `LISTEN/NOTIFY`

## 3. Alternative phased paths Kiro weighed

- **(a) Postgres from day 1 (Neon): genuinely good alternative.** Neon free has ~500ms cold starts on idle; Neon Launch ~$19/mo = ~$228/yr vs 1.5–3 days of migration engineering later. Better FTS immediately, no migration ever, no D1 ceiling. Tradeoff: paying before the site earns anything. **Kiro's rule: if marketplace is 3–6 months away, start on Postgres; if 6–18+ months away, start on D1.**
- **(b) Stay on D1 through marketplace: possible at modest scale** (hundreds of sellers, thousands of orders) but an active liability once checkout consistency matters or data nears 10 GB; sharding past the ceiling forces app-level joins.
- **(c) Move app, keep DB / keep app, move DB:** App on AWS + D1 via HTTP API is the worst mix (pays both, loses D1's 1–5ms native binding, gains ~20–80ms). **App on Cloudflare + Postgres via Hyperdrive is the best mix** — pooled edge connections, ~12–20ms queries ⚠️ VERIFY Hyperdrive pricing (~$7/mo per Kiro).
- **(d) Kiro's preferred hybrid = the recommendation above:** Workers throughout; D1 → Hyperdrive + Neon Postgres in Phase 3. App migration, if ever needed, is 3–5 days of infra config (SST/IAM/DNS), ~0 user downtime — not a code rewrite.

## 4. Do the AWS $100 credits / us-east-2-only constraint change the answer?

**No.** Credit burn rates:
| AWS option | Burn | $100 lasts |
|---|---|---|
| OpenNext only, no DB | ~$2–5/mo | 20–50 mo (outlives early phase) |
| OpenNext + RDS t4g.micro | ~$14–17/mo | ~6 mo — just to the May 2027 expiry |
| OpenNext + Aurora 0.5 ACU | ~$47–55/mo | ~2 mo |
| App Runner + RDS | ~$18–25/mo | ~4–5 mo |

$100 is not a runway on any AWS option with a persistent DB, and $0/mo (Cloudflare marginal) beats subsidized $14/mo. **Region:** us-east-2 origin doesn't materially matter behind CloudFront (Ohio→PNW ~50–70ms only on cache misses); DB must be co-located with the app region if on AWS. One real edge difference: Workers execute *at* the Seattle PoP for PNW users; Lambda@Edge placement ⚠️ VERIFY. Minor for a read-heavy SSG site.
**DynamoDB verdict (asked, answered): poor fit** — relational many-to-many + ad-hoc search would force single-table contortions; not recommended in any phase.

## 5. Where Kiro agrees / disagrees with Hue's interim take

- **Agrees:** Cloudflare wins the traffic phase on cost/edge; Drizzle + OpenNext portability is the strongest argument for phasing; DB depth is what eventually forces a move.
- **Disagrees / refines:** Hue's "AWS + Aurora wins the marketplace end-state" is **overclaimed**. Aurora Serverless v2's floor is expensive and overkill at Dustin's likely scale for 2–3 years — Neon or RDS Postgres behind Hyperdrive, with the app staying on Cloudflare, is the better Phase 3. Hue also **undersold Hyperdrive**, which removes the main reason to move the app at all.
- **Kiro's specific call for Dustin:** Start on D1. If in 12 months the marketplace is still 12+ months away, ~$200 saved. If in 6 months checkout is imminent, migrate then — with the repository layer + portable schema, it's a known-scope 1.5–3 day project, not a surprise rewrite.

## ⚠️ VERIFY before building/budgeting
1. Amplify's current Next.js version support (16.x?) and on-demand ISR/streaming support.
2. Aurora Serverless v2 0-ACU auto-pause availability for this AWS project in us-east-2, and its resume latency.
3. Cloudflare Hyperdrive current pricing (Kiro used ~$7/mo from prior knowledge).
4. D1 10 GB limit — any increase path on non-Enterprise plans.
5. Lambda@Edge region placement for PNW dynamic requests on the AWS path.
6. OpenNext Cloudflare adapter KV-ISR + `getCloudflareContext` API (carried over from V2-KIRO-SUGGESTIONS.md).
7. All per-phase dollar figures are Kiro estimates, not vendor-quoted — sanity-check Workers/D1, Lambda/CloudFront, RDS, and Neon pricing pages at spec time.
