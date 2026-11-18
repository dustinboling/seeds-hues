/**
 * Internal: is a seller visible ("ok"), removed at its request ("gone"), or unknown ("missing")?
 * Called by middleware.ts (via the WORKER_SELF_REFERENCE binding) so /seller/{slug} can answer a
 * true HTTP 410 for removed sellers (design D4). Not part of the public API; not rate limited
 * per IP because the caller is the Worker itself.
 */
import { getServices } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Content-Type": "application/json" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) return new Response('{"status":"missing"}', { headers });
  const { catalog } = await getServices();
  return new Response(JSON.stringify({ status: await catalog.sellerStatus(slug) }), { headers });
}
