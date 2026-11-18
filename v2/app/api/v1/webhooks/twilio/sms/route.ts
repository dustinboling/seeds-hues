/**
 * POST /api/v1/webhooks/twilio/sms — Twilio's inbound-message webhook. Twilio itself handles
 * STOP/HELP replies (Advanced Opt-Out); this route ALSO clears sms_opt_in for every account using
 * that alert number the moment a STOP keyword arrives, so no further text is queued. Requests
 * must carry a valid X-Twilio-Signature (HMAC-SHA1 with TWILIO_AUTH_TOKEN); otherwise 403.
 * START/UNSTOP do not re-enable alerts here — re-opting in happens on the account page.
 */
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import { getServices } from "@/lib/services/context";
import { STOP_KEYWORDS, twilioSignature } from "@/lib/sms";
import { timingSafeEqual } from "@/lib/api/revalidate";

export const dynamic = "force-dynamic";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(req: Request): Promise<Response> {
  const env = await getRuntimeEnv();
  const authToken = env.sms?.twilioAuthToken;
  if (!authToken) return new Response("SMS webhook not configured", { status: 503, headers: { "Cache-Control": "no-store" } });
  const form = new URLSearchParams(await req.text());
  const params: Record<string, string> = {};
  for (const [k, v] of form) params[k] = v;
  const given = req.headers.get("x-twilio-signature") ?? "";
  const url = `${env.siteUrl}${new URL(req.url).pathname}`;
  if (!given || !timingSafeEqual(given, await twilioSignature(authToken, url, params))) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const word = (params.Body ?? "").trim().toUpperCase();
  if (STOP_KEYWORDS.includes(word) && params.From) {
    const { accounts } = await getServices();
    await accounts.smsStop(params.From);
  }
  return new Response(EMPTY_TWIML, { status: 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } });
}
