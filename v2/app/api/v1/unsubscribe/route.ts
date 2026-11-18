/**
 * POST /api/v1/unsubscribe?token=… — RFC 8058 one-click unsubscribe (the List-Unsubscribe
 * target in every alert email; the mail client POSTs "List-Unsubscribe=One-Click" as a form).
 * Signed token, no sign-in. The human page with a confirm button is /unsubscribe.
 */
import { problemResponse } from "@/lib/api/problem";
import { baseHeaders, CACHE_NO_STORE } from "@/lib/api/http";
import { getServices } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/ingest";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || token.length > 200) return problemResponse(400, "invalid_token", "This unsubscribe link is not valid.");
  try {
    const { accounts } = await getServices();
    const data = await accounts.unsubscribe(token);
    return new Response(JSON.stringify({ data, meta: { generated_at: new Date().toISOString() } }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": CACHE_NO_STORE, ...baseHeaders() },
    });
  } catch (err) {
    if (err instanceof ServiceError) return problemResponse(err.status, err.code, err.message);
    console.error("unsubscribe error", err);
    return problemResponse(500, "internal", "Internal error");
  }
}

const notAllowed = () => problemResponse(405, "method_not_allowed", "use POST", { Allow: "POST" });
export { notAllowed as GET, notAllowed as PUT, notAllowed as PATCH, notAllowed as DELETE };
