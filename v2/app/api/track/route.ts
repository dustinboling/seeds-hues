/**
 * POST /api/track — internal beacon (FINAL §3.4, extended by R14). No cookies, always 204 so a
 * beacon can never affect navigation.
 *   {type:"view", varietySlug}   → variety_view_counts (variety page view beacon)
 *   {seller, variety, href}      → outbound_clicks (legacy click beacon; shop buttons now use /go)
 */
import { ClickPayloadSchema, ViewPayloadSchema } from "@/lib/services/clicks";
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { allowRequest } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const noContent = () =>
  new Response(null, { status: 204, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });

export async function POST(req: Request): Promise<Response> {
  try {
    const env = await getRuntimeEnv();
    if (!(await allowRequest(req, env.rateLimiter))) return noContent();
    const text = await req.text();
    if (text.length > 4096) return noContent();
    const json: unknown = JSON.parse(text);
    const services = await getServices();
    const view = ViewPayloadSchema.safeParse(json);
    if (view.success) {
      await services.clicks.view(view.data.varietySlug);
      return noContent();
    }
    const click = ClickPayloadSchema.safeParse(json);
    if (click.success) await services.clicks.record(click.data);
  } catch {
    // Measurement must never fail loudly.
  }
  return noContent();
}

const notAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: "POST", "X-Robots-Tag": "noindex" } });
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
