/**
 * 120 requests / minute / client IP across /api/v1/* (spec §4.2). Canonical §3 adds buckets:
 * search 60/min/IP, POST /reports 3/min/IP, ingest 600/min/key (see LIMITS).
 * Primary: Workers rate-limiting binding (`ratelimits` in wrangler.jsonc, VERIFICATION-LOG V17).
 * Fallback (binding absent, e.g. plain `next start`): per-isolate token bucket.
 */
export const RATE_LIMIT_PER_MINUTE = 120;
export const RETRY_AFTER_SECONDS = 60;
export const LIMITS = { public: 120, search: 60, reports: 3, ingest: 600 } as const;
export type LimitBucket = keyof typeof LIMITS;

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function tokenBucketAllow(key: string, now = Date.now(), perMinute = RATE_LIMIT_PER_MINUTE): boolean {
  const refillPerMs = perMinute / 60_000;
  const b = buckets.get(key) ?? { tokens: perMinute, updated: now };
  b.tokens = Math.min(perMinute, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;
  const allowed = b.tokens >= 1;
  if (allowed) b.tokens -= 1;
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }
  buckets.set(key, b);
  return allowed;
}

export function resetTokenBuckets(): void {
  buckets.clear();
}

export function clientKey(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function allowRequest(req: Request, limiter: RateLimit | null): Promise<boolean> {
  return allowKeyed(clientKey(req), limiter, "public");
}

/** One bucket: the Workers binding when present, else a per-isolate token bucket. */
export async function allowKeyed(key: string, limiter: RateLimit | null, bucket: LimitBucket): Promise<boolean> {
  if (limiter) {
    try {
      const { success } = await limiter.limit({ key });
      return success;
    } catch {
      // Binding failure must not take the API down; fall through to the isolate bucket.
    }
  }
  return tokenBucketAllow(bucket === "public" ? key : `${bucket}:${key}`, Date.now(), LIMITS[bucket]);
}
