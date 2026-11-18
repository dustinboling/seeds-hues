/**
 * Removed sellers answer a true HTTP 410 on /seller/{slug} (R8, canonical §5 "410 on removed
 * sellers"; design D4). A page cannot set its own status, so this middleware asks the Worker
 * (via the WORKER_SELF_REFERENCE service binding when present, else a same-origin fetch) for the
 * seller's state through /api/internal/seller-status/{slug}. Any failure falls through to the page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const config = { matcher: ["/seller/:slug"] };

const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Seller removed | seeds.hues.flowers</title></head><body><main><h1>This seller has been removed</h1><p>This farm asked to be removed from the directory, and its listings have been taken down.</p><p><a href="/seller">Browse other small-farm sellers</a></p></main></body></html>`;

export async function middleware(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.next();
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
