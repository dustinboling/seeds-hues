/**
 * Revalidation HTTP handler — the request path for Bea §9 invalidation.
 *
 * Mount contract (production Worker, Slice 9 cutover): POST
 * /internal/revalidate with `Authorization: Bearer <shared secret>` and a
 * JSON body of `{ tags?: string[]; paths?: string[] }` calls
 * handleRevalidateHttpRequest with the Worker's secret and the shared data
 * cache's invalidatePaths; the Worker then purges the edge cache for the
 * returned `paths` and regenerates the affected machine files via
 * generateMachineFiles. The tag taxonomy is v2's, so existing write paths
 * keep working unmodified until cutover.
 *
 * This slice proves the loop end to end in tests/invalidation-loop.test.ts:
 * a catalog write → stale reads → this handler → purged keys → fresh reads
 * and regenerated segments, with no rebuild.
 */
import {
  RevalidateAuthError,
  handleRevalidateRequest,
  type RevalidateResult,
} from "../data/revalidate";

export { RevalidateAuthError };

export interface RevalidateHttpRequest {
  /** Raw Authorization header value (null when absent). */
  authorization: string | null;
  /** Parsed JSON body. */
  body: unknown;
}

export interface RevalidateHandlerOptions {
  expectedSecret: string;
  invalidatePaths: (paths: string[]) => string[];
}

export async function handleRevalidateHttpRequest(
  request: RevalidateHttpRequest,
  options: RevalidateHandlerOptions,
): Promise<RevalidateResult> {
  return handleRevalidateRequest(
    { authorization: request.authorization, body: request.body },
    { expectedSecret: options.expectedSecret, invalidatePaths: options.invalidatePaths },
  );
}
