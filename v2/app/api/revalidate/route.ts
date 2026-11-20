/**
 * POST /api/revalidate — internal, token-protected (spec §4.3). Not part of the public API.
 *   Authorization: Bearer <REVALIDATE_TOKEN>   (Worker secret / .dev.vars)
 *   { "tags": ["variety:stock-katz-mix"], "paths": ["/variety/stock-katz-mix"] }
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { jsonError } from "@/lib/api/http";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { pathsForTag, RevalidateBodySchema, timingSafeEqual, withVariantPaths } from "@/lib/api/revalidate";

export const dynamic = "force-dynamic";

const headers = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };

export async function POST(req: Request): Promise<Response> {
  const env = await getRuntimeEnv();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!env.revalidateToken || !token || !timingSafeEqual(token, env.revalidateToken)) {
    return jsonError(401, "unauthorized", "Missing or invalid bearer token", { "WWW-Authenticate": "Bearer" });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "validation_error", "Body must be JSON");
  }
  const parsed = RevalidateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  const tags = parsed.data.tags ?? [];
  const paths = new Set(parsed.data.paths ?? []);
  for (const t of tags) for (const p of pathsForTag(t)) paths.add(p);
  // A variety page's "Small farms only" view is its own ISR entry: invalidate it alongside.
  const all = withVariantPaths(paths);
  for (const t of tags) revalidateTag(t, { expire: 0 });
  for (const p of all) revalidatePath(p);
  return Response.json(
    { data: { revalidated: true, tags, paths: [...all].sort() }, meta: null, error: null },
    { status: 200, headers },
  );
}

const notAllowed = () =>
  jsonError(405, "method_not_allowed", "Use POST", { Allow: "POST" });
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
