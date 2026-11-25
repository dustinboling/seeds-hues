/**
 * Browser-side JSON calls to /api/v1 for the account, waiting-list,
 * report, unsubscribe, and Add Your Farm forms. Ported from
 * v2/components/account/api.ts — same-origin relative paths (the app
 * Worker relays /api/* to the backend), same problem+json reading.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

export async function callApi<T = Record<string, unknown>>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; code?: string; detail?: string };
    if (res.ok) return { ok: true, data: json.data as T };
    return { ok: false, status: res.status, code: json.code ?? "error", message: json.detail ?? `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach Seed Directory. Check your connection and try again." };
  }
}

/** Human wording for a code-delivery outcome. */
export function deliveryNote(d: string | null | undefined, channel: "email" | "phone"): string | null {
  if (!d) return null;
  if (d === "sent") return channel === "email" ? "We’ve emailed you a 6-digit code." : "We’ve texted a 6-digit code to your alert number.";
  if (d === "mail_not_configured" || d === "sms_not_configured")
    return channel === "email"
      ? "We couldn’t send the code email just now (email sending isn’t switched on yet). Use “Send a new code” a little later."
      : "We couldn’t send the text just now (texting isn’t switched on yet). Use “Send a new code” a little later.";
  return "We couldn’t send the code just now — use “Send a new code” to try again.";
}
