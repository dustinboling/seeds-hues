/**
 * Two jobs, by path:
 *
 * 1. /seller/{slug} — removed sellers answer a true HTTP 410 (R8, canonical §5 "410 on removed
 *    sellers"; design D4). A page cannot set its own status, so this middleware asks the Worker
 *    (via the WORKER_SELF_REFERENCE service binding when present, else a same-origin fetch) for
 *    the seller's state through /api/internal/seller-status/{slug}. Any failure falls through to
 *    the page.
 *
 * 2. /variety/{slug}?small_farm=true — the "Small farms only" view of a variety page (Open
 *    Directory, ux-spec §4.2). Variety pages are ISR, and an ISR page never sees its query string,
 *    so the narrowed view is a separate route: this rewrites the public URL onto the internal path
 *    /variety/{slug}/small-farms, which has its own ISR cache entry. Exactly `small_farm=true` is
 *    on; anything else (absent, "false", garbage, repeated) is off and is not rewritten — the
 *    forgiving parse of ux-spec §3.2. A direct request for the internal path is redirected (308)
 *    to the public URL, so the internal path is never a second public address for the view.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SMALL_FARM_PARAM, SMALL_FARM_VARIANT_SEGMENT, parseSmallFarmParam, smallFarmVariantPath } from "@/lib/small-farm";

export const config = { matcher: ["/seller/:slug", "/variety/:slug", "/variety/:slug/small-farms"] };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Seller removed | seeds.hues.flowers</title></head><body><main><h1>This seller has been removed</h1><p>This seller asked to be removed from the directory, and its listings have been taken down.</p><p><a href="/seller">Browse other sellers</a></p></main></body></html>`;

export async function middleware(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/");
  if (parts[1] === "variety") return varietyRoute(req, parts);
  return sellerRoute(req, parts[2] ?? "");
}

function varietyRoute(req: NextRequest, parts: string[]): NextResponse {
  const slug = parts[2] ?? "";
  if (!SLUG.test(slug)) return NextResponse.next();
  // ["", "variety", slug, "small-farms"]: an outside request for the internal path.
  if (parts.length === 4 && parts[3] === SMALL_FARM_VARIANT_SEGMENT) {
    const url = req.nextUrl.clone();
    url.pathname = `/variety/${slug}`;
    url.searchParams.set(SMALL_FARM_PARAM, "true");
    return NextResponse.redirect(url, 308);
  }
  if (parts.length !== 3) return NextResponse.next();
  const values = req.nextUrl.searchParams.getAll(SMALL_FARM_PARAM);
  if (!parseSmallFarmParam(values.length === 1 ? values[0] : values)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = smallFarmVariantPath(slug);
  return NextResponse.rewrite(url);
}

async function sellerRoute(req: NextRequest, slug: string): Promise<NextResponse> {
  if (!SLUG.test(slug)) return NextResponse.next();
  try {
    const statusUrl = new URL(`/api/internal/seller-status/${slug}`, req.nextUrl.origin);
    let res: Response;
    try {
      const { env } = await getCloudflareContext({ async: true });
      const self = (env as { WORKER_SELF_REFERENCE?: Fetcher }).WORKER_SELF_REFERENCE;
      res = self ? await self.fetch(statusUrl.toString()) : await fetch(statusUrl);
    } catch {
      res = await fetch(statusUrl);
    }
    if (res.ok) {
      const body = (await res.json()) as { status?: string };
      if (body.status === "gone") {
        return new NextResponse(GONE_HTML, {
          status: 410,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
        });
      }
    }
  } catch {
    // Never block the page on the status check.
  }
  return NextResponse.next();
}
