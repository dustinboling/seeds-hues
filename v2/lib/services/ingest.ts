/**
 * Ingest service (R10, canonical §4). Agents propose, the server decides:
 *
 *   validation, in this exact order —
 *   (1) schema + enums legal                      → schema_invalid
 *   (2) seller exists / approved / crawl policy   → seller_not_found | seller_not_approved |
 *                                                   crawl_opted_out | crawl_manual_only
 *   (3) product host on the seller's domain,
 *       domain not blocked                        → off_domain | blocked_domain
 *   (4) source exists, fetched ≤ 7 days, HTTP 200 → source_not_found | source_stale | source_not_ok
 *   (5) every non-"unknown" value's evidence is
 *       found verbatim in the stored snapshot     → evidence_not_found
 *   (6) upsert key (seller, URL, variant)
 *
 * Only an exact/synonym match (the extracted name normalizes to the variety's primary name or a
 * known alias) for a seed product from an approved seller publishes. Everything else queues.
 * The server never fetches anything: snapshots are text the agent posted to /ingest/sources.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { AVAILABILITY, CRAWL_POLICY, FETCH_KIND } from "@/lib/db/schema";
import * as ingest from "@/lib/repositories/ingest";
import { insertReviewItem } from "@/lib/repositories/admin";
import { hostOf, hostOnDomain, normalizeName } from "@/lib/names";
import { sha256Hex } from "@/lib/api/http";
import { matchWaitlists } from "./waitlist-matcher";

export const MAX_OBSERVATIONS = 100;
export const SOURCE_MAX_AGE_DAYS = 7;
export const MAX_SNAPSHOT_CHARS = 2_000_000;

const ref = z.union([z.number().int().positive(), z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160)]);
const url = z
  .string()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//.test(u), "http(s) URL");

/** An extraction is a value plus the verbatim quote it came from; "unknown" needs no quote. */
const hasEvidence = (e: { value: unknown; evidence: string | null }) =>
  e.value === "unknown" || (typeof e.evidence === "string" && e.evidence.trim().length > 0);
const EVIDENCE_RULE = { message: 'every value other than "unknown" needs an evidence quote' };
/** An extraction is a value plus the verbatim quote it came from; "unknown" needs no quote. */
const extraction = <T extends z.ZodType<string>>(value: T) =>
  z.strictObject({ value, evidence: z.string().max(500).nullable() }).refine((e) => hasEvidence(e as { value: unknown; evidence: string | null }), EVIDENCE_RULE);

const anyExtraction = extraction(z.string().min(1).max(200));

export const ObservationSchema = z.strictObject({
  schema: z.literal("listing_observation/1"),
  seller_id: ref,
  source_id: z.number().int().positive(),
  source: z.record(z.string(), z.unknown()).optional(),
  product: z
    .looseObject({
      url,
      external_product_id: z.string().max(200).default("unknown"),
      variant_key: z.string().max(200).default(""),
      title_raw: z.string().max(500).nullable().default(null),
      is_seed: extraction(z.enum(["yes", "no", "unknown"])),
      crop: extraction(z.string().min(1).max(100)),
      variety_name: extraction(z.string().min(1).max(200)),
      availability: extraction(z.enum(AVAILABILITY)),
    })
    .superRefine((p, ctx) => {
      // Any extra extraction (e.g. `organic`) must also be a well-formed {value, evidence} pair.
      for (const [k, v] of Object.entries(p)) {
        if (["url", "external_product_id", "variant_key", "title_raw", "is_seed", "crop", "variety_name", "availability"].includes(k)) continue;
        if (!anyExtraction.safeParse(v).success) ctx.addIssue({ code: "custom", path: [k], message: "must be an extraction {value, evidence}" });
      }
    }),
  match: z.strictObject({
    variety_id: ref.nullable(),
    method: z.enum(["exact", "synonym", "model", "none"]),
    confidence: z.number().min(0).max(1),
    candidates: z.array(z.unknown()).max(10).optional(),
  }),
  agent: z.record(z.string(), z.unknown()).optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ObservationsBodySchema = z.strictObject({
  observations: z.array(z.unknown()).min(1).max(MAX_OBSERVATIONS),
  agent_run_id: z.number().int().positive().optional(),
});

export const SourceBodySchema = z.strictObject({
  url,
  fetched_at: z.iso.datetime({ offset: true }),
  http_status: z.number().int().min(100).max(599),
  content_text: z.string().min(1).max(MAX_SNAPSHOT_CHARS),
  robots_allowed: z.boolean(),
  kind: z.enum(FETCH_KIND),
});

export const SellerCandidateBodySchema = z.strictObject({
  name: z.string().trim().min(2).max(200),
  website_url: url,
  evidence: z.string().trim().min(1).max(2000),
  source_id: z.number().int().positive().optional(),
});

export const LeaseBodySchema = z.strictObject({
  count: z.number().int().min(1).max(50),
  agent: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  prompt_version: z.string().max(100).optional(),
});

export type ObservationResult =
  | { index: number; status: "published"; observation_id: number; listing_id: number; variety_slug: string; created: boolean; event: string | null }
  | { index: number; status: "queued"; observation_id: number; review_item_id: number; reason: string }
  | { index: number; status: "rejected"; observation_id: number | null; reason: string; detail?: string };

export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Every non-"unknown" extraction value with its evidence quote. */
function evidenceQuotes(p: Observation["product"]): { field: string; quote: string }[] {
  const out: { field: string; quote: string }[] = [];
  for (const [field, v] of Object.entries(p)) {
    if (!v || typeof v !== "object" || !("value" in v)) continue;
    const e = v as { value: unknown; evidence: string | null };
    if (e.value !== "unknown" && e.evidence) out.push({ field, quote: e.evidence });
  }
  return out;
}

export interface IngestDeps {
  snapshots: R2Bucket | null;
  now?: () => Date;
}

export function createIngestService(db: Db, deps: IngestDeps) {
  const now = deps.now ?? (() => new Date());
  const snapshotCache = new Map<string, string | null>();

  async function snapshotText(key: string): Promise<string | null> {
    if (snapshotCache.has(key)) return snapshotCache.get(key)!;
    const obj = deps.snapshots ? await deps.snapshots.get(key) : null;
    const text = obj ? await obj.text() : null;
    snapshotCache.set(key, text);
    return text;
  }

  async function validateOne(raw: unknown, index: number, agentRunId: number | null): Promise<ObservationResult> {
    const at = now().toISOString();
    const reject = async (reason: string, detail: string, extra: { sellerId?: number | null; sourceId?: number | null } = {}) => {
      const observationId = await ingest.insertObservation(db, {
        fetchSourceId: extra.sourceId ?? null,
        agentRunId,
        sellerId: extra.sellerId ?? null,
        payload: JSON.stringify(raw).slice(0, 20_000),
        status: "rejected",
        reason: `${reason}: ${detail}`.slice(0, 500),
        createdAt: at,
      });
      return { index, status: "rejected" as const, observation_id: observationId, reason, detail };
    };

    // (1) schema + enums
    const parsed = ObservationSchema.safeParse(raw);
    if (!parsed.success) {
      return reject("schema_invalid", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 400));
    }
    const o = parsed.data;
    const source = await ingest.fetchSourceById(db, o.source_id);
    const sourceId = source?.id ?? null;

    // (2) seller exists, approved, crawl policy allows this fetch
    const seller = await ingest.sellerByRef(db, o.seller_id);
    if (!seller || seller.deletedAt) return reject("seller_not_found", String(o.seller_id), { sourceId });
    const ctx = { sellerId: seller.id, sourceId };
    if (seller.eligibility !== "approved") return reject("seller_not_approved", `${seller.slug} is ${seller.eligibility}`, ctx);
    const policy = seller.crawlPolicy as (typeof CRAWL_POLICY)[number];
    if (policy === "opted_out") return reject("crawl_opted_out", `${seller.slug} opted out of crawling`, ctx);
    if (policy === "manual_only" && source?.kind !== "human") {
      return reject("crawl_manual_only", `${seller.slug} is manual_only; the source must be a human capture (kind "human")`, ctx);
    }

    // (3) product host on the seller's domain; domain not blocked
    const productHost = hostOf(o.product.url);
    if (!hostOnDomain(productHost, seller.domain)) return reject("off_domain", `${productHost} is not on ${seller.domain ?? "(no domain on file)"}`, ctx);
    if (await ingest.isBlockedDomain(db, [productHost ?? "", seller.domain ?? ""])) return reject("blocked_domain", `${productHost} is blocked`, ctx);

    // (4) source exists, fetched in the last 7 days (and answered 200)
    if (!source) return reject("source_not_found", `source ${o.source_id}`, ctx);
    const ageMs = now().getTime() - Date.parse(source.fetchedAt);
    if (!(ageMs <= SOURCE_MAX_AGE_DAYS * 86_400_000)) return reject("source_stale", `fetched ${source.fetchedAt}`, ctx);
    if (source.httpStatus !== 200) return reject("source_not_ok", `HTTP ${source.httpStatus}`, ctx);

    // (5) every evidence quote appears verbatim (whitespace-collapsed) in the stored snapshot
    const text = await snapshotText(source.snapshotKey);
    if (text === null) return reject("evidence_not_found", `snapshot ${source.snapshotKey} is missing`, ctx);
    const haystack = collapse(text);
    for (const { field, quote } of evidenceQuotes(o.product)) {
      if (!haystack.includes(collapse(quote))) return reject("evidence_not_found", `${field}: "${quote.slice(0, 80)}" is not in the snapshot`, ctx);
    }

    // (6) matching → publish or queue (keyed by seller, URL, variant)
    const extractedName = o.product.variety_name.value;
    const variety = o.match.variety_id !== null ? await ingest.varietyForMatch(db, o.match.variety_id) : null;
    const cropName = variety?.commonName ?? null;
    const normalized = normalizeName(extractedName, cropName ?? (o.product.crop.value !== "unknown" ? o.product.crop.value : null));
    const listingFields = {
      sellerId: seller.id,
      productUrl: o.product.url,
      variantKey: o.product.variant_key,
      externalProductId: o.product.external_product_id === "unknown" ? null : o.product.external_product_id,
      titleRaw: o.product.title_raw,
      availability: o.product.availability.value,
      sourceUrl: source.url,
      checkedAt: source.fetchedAt,
    };

    let queueReason: string | null = null;
    let nameMatched = false;
    if (o.product.is_seed.value !== "yes") queueReason = "not_seed";
    else if (extractedName === "unknown") queueReason = "no_name";
    else if (o.match.method === "model") queueReason = "model_match";
    else if (o.match.method === "none" || o.match.variety_id === null) queueReason = "no_match";
    else if (!variety || variety.status !== "active") queueReason = "variety_not_found";
    else {
      const cropOk =
        o.product.crop.value === "unknown" ||
        [variety.plantSlug, normalizeName(variety.commonName)].includes(normalizeName(o.product.crop.value)) ||
        normalizeName(variety.commonName).includes(normalizeName(o.product.crop.value));
      const known = new Set([
        normalizeName(variety.name, variety.commonName),
        ...variety.names.map((n) => n.normalized || normalizeName(n.alias, variety.commonName)),
      ]);
      nameMatched = known.has(normalized);
      if (!cropOk) queueReason = "crop_mismatch";
      else if (!nameMatched) queueReason = "name_mismatch";
    }

    if (queueReason === null && variety) {
      const r = await ingest.upsertObservedListing(db, {
        ...listingFields,
        varietyId: variety.id,
        matchMethod: o.match.method === "synonym" ? "synonym" : "exact",
        confidence: 1,
      });
      const observationId = await ingest.insertObservation(db, {
        fetchSourceId: source.id,
        agentRunId,
        sellerId: seller.id,
        payload: JSON.stringify(o),
        status: "published",
        reason: null,
        createdAt: at,
      });
      return { index, status: "published", observation_id: observationId, listing_id: r.listingId, created: r.created, event: r.event, variety_slug: variety.slug };
    }

    const observationId = await ingest.insertObservation(db, {
      fetchSourceId: source.id,
      agentRunId,
      sellerId: seller.id,
      payload: JSON.stringify(o),
      status: "queued",
      reason: queueReason,
      createdAt: at,
    });
    const isNew = !variety && (o.match.method === "none" || o.match.variety_id === null);
    const reviewItemId = await insertReviewItem(db, {
      type: isNew ? "new_variety" : "listing_match",
      groupKey: normalized,
      proposal: {
        observation_id: observationId,
        seller_id: seller.id,
        seller_slug: seller.slug,
        variety_id: variety?.id ?? null,
        crop: variety?.plantSlug ?? (o.product.crop.value !== "unknown" ? o.product.crop.value : null),
        extracted_name: extractedName,
        normalized_name: normalized,
        listing: listingFields,
        match: o.match,
      },
      reason: queueReason,
      confidence: o.match.confidence,
      at,
    });
    return { index, status: "queued", observation_id: observationId, review_item_id: reviewItemId, reason: queueReason ?? "review" };
  }

  return {
    async lease(body: z.infer<typeof LeaseBodySchema>) {
      const at = now();
      const agentRunId = body.agent
        ? await ingest.insertAgentRun(db, { agent: body.agent, model: body.model ?? null, promptVersion: body.prompt_version ?? null, at: at.toISOString() })
        : null;
      const jobs = await ingest.leaseJobs(db, body.count, at);
      return {
        agent_run_id: agentRunId,
        jobs: jobs.map((j) => ({ id: j.id, type: j.type, target: j.target, attempts: j.attempts, lease_expires_at: j.leaseExpiresAt })),
      };
    },

    async completeJob(id: number) {
      const r = await ingest.completeJob(db, id, now().toISOString());
      if (!r) throw new ServiceError(409, "job_not_leased", `job ${id} is not leased`);
      return { id: r.id, status: r.status };
    },

    async failJob(id: number) {
      const r = await ingest.failJob(db, id, now());
      if (!r) throw new ServiceError(409, "job_not_leased", `job ${id} is not leased`);
      return { id: r.id, status: r.status, attempts: r.attempts, next_run_at: r.nextRunAt };
    },

    async registerSource(body: z.infer<typeof SourceBodySchema>) {
      const host = hostOf(body.url);
      if (await ingest.isBlockedDomain(db, [host ?? ""])) throw new ServiceError(422, "blocked_domain", `${host} is blocked`);
      if (!body.robots_allowed && body.kind === "web") {
        throw new ServiceError(422, "robots_disallowed", "robots.txt disallowed this fetch; it must not be used");
      }
      if (!deps.snapshots) throw new ServiceError(503, "snapshots_unavailable", "SNAPSHOTS bucket is not bound");
      const hash = await sha256Hex(body.content_text);
      const key = `fetch/${hash}.txt`;
      if (!(await deps.snapshots.head(key))) {
        await deps.snapshots.put(key, body.content_text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
      }
      const { row, created } = await ingest.upsertFetchSource(db, {
        url: body.url,
        fetchedAt: new Date(body.fetched_at).toISOString(),
        httpStatus: body.http_status,
        contentHash: hash,
        snapshotKey: key,
        robotsAllowed: body.robots_allowed,
        kind: body.kind,
        createdAt: now().toISOString(),
      });
      return { id: row.id, url: row.url, content_hash: `sha256:${row.contentHash}`, snapshot_key: row.snapshotKey, created };
    },

    async observations(body: z.infer<typeof ObservationsBodySchema>) {
      const results: ObservationResult[] = [];
      for (const [i, raw] of body.observations.entries()) results.push(await validateOne(raw, i, body.agent_run_id ?? null));
      // Publish trigger (Phase 3): queue waiting-list alerts for varieties this batch published.
      const published = [...new Set(results.flatMap((r) => (r.status === "published" ? [r.variety_slug] : [])))];
      if (published.length) await notifyWaitlists(db, published, now());
      const tally = (s: string) => results.filter((r) => r.status === s).length;
      return { results, summary: { published: tally("published"), queued: tally("queued"), rejected: tally("rejected") } };
    },

    async sellerCandidate(body: z.infer<typeof SellerCandidateBodySchema>) {
      const domain = hostOf(body.website_url);
      if (!domain) throw new ServiceError(400, "validation_error", "website_url has no host");
      if (await ingest.isBlockedDomain(db, [domain])) throw new ServiceError(422, "blocked_domain", `${domain} is blocked`);
      const existing = await ingest.sellerByDomain(db, domain);
      if (existing) throw new ServiceError(409, "seller_exists", `${domain} is already ${existing.slug} (${existing.eligibility})`);
      const id = await insertReviewItem(db, {
        type: "seller_candidate",
        groupKey: domain,
        proposal: { name: body.name, website_url: body.website_url, domain, evidence: body.evidence, source_id: body.source_id ?? null },
        reason: "seller_candidate",
        confidence: null,
        at: now().toISOString(),
      });
      return { review_item_id: id, status: "pending" };
    },

    async matchContext(crop: string) {
      const r = await ingest.matchContextRows(db, crop);
      if (!r) return null;
      return {
        crop: { slug: r.plant.slug, name: r.plant.commonName },
        varieties: r.varieties.map((v) => ({
          id: v.id,
          slug: v.slug,
          name: v.name,
          name_normalized: normalizeName(v.name, r.plant.commonName),
          aliases: v.names.filter((n) => n.kind !== "primary").map((n) => ({ name: n.alias, normalized: n.normalized, kind: n.kind })),
        })),
      };
    },
  };
}

export type IngestService = ReturnType<typeof createIngestService>;

/**
 * Run the waiting-list matcher after a publish. The publish has already happened, so a matcher
 * failure is logged, not thrown — the drain's sweep (matchWaitlists(db, null)) catches it up.
 */
export async function notifyWaitlists(db: Db, varietyRefs: (number | string)[], at: Date): Promise<void> {
  try {
    const ids: number[] = [];
    for (const ref of varietyRefs) {
      if (typeof ref === "number") ids.push(ref);
      else {
        const v = await ingest.varietyForMatch(db, ref);
        if (v) ids.push(v.id);
      }
    }
    if (ids.length) await matchWaitlists(db, ids, { now: at });
  } catch (err) {
    console.error("waitlist matcher failed after publish", err instanceof Error ? err.message : err);
  }
}
