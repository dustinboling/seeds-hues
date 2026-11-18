/**
 * GET /go/{listing_id} (R7, canonical §3/§5): log the click, 302 to the farm's product page (or
 * homepage) with utm_source=seedfinder&utm_medium=referral, keeping any existing query string.
 * 404 unknown/unpublished, 410 seller removed. Always Cache-Control: no-store. Outside /api.
 */
import { getServices } from "@/lib/services/context";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { DEV_CLICK_SALT } from "@/lib/services/clicks";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^\d{1,12}$/.test(id)) return text(404, "Listing not found");
  const [env, { clicks }] = await Promise.all([getRuntimeEnv(), getServices()]);
  const url = new URL(req.url);
  const out = await clicks.go({
    listingId: Number(id),
    // Read transiently for the daily visitor hash only — never stored.
    ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
    xClient: req.headers.get("x-client"),
    referer: req.headers.get("referer"),
    ownHosts: [url.host, new URL(env.siteUrl).host],
    salt: env.clickSalt ?? DEV_CLICK_SALT,
  });
  if (out.status === 404) return text(404, "Listing not found");
  if (out.status === 410) return text(410, "This seller asked to be removed from the directory.");
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: out.location, "Referrer-Policy": "origin" } });
}
