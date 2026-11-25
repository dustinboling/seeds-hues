/**
 * Browser-side JSON calls to the app's own admin handlers (the
 * sign-in, review-decide, and per-section action endpoints). Same-origin
 * relative paths, the admin session cookie attached, no-store. The
 * handlers answer v2's sheet-JSON vocabulary ({ok, redirect?, message?,
 * errors?}) — the forms follow `redirect` on success and render
 * `message` with values preserved on failure.
 */
export type AdminResult = { ok: true; redirect: string } | { ok: false; status: number; code: string; message: string };

export async function callAdmin(path: string, body: Record<string, unknown>): Promise<AdminResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; code?: string; message?: string };
    if (res.ok && json.ok === true) return { ok: true, redirect: typeof json.redirect === "string" ? json.redirect : "" };
    return { ok: false, status: res.status, code: json.code ?? "error", message: json.message ?? `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach Seed Directory. Check your connection and try again." };
  }
}

export type AdminGetResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

export async function getAdmin<T = Record<string, unknown>>(path: string): Promise<AdminGetResult<T>> {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { data?: T; code?: string; detail?: string };
    if (res.ok) return { ok: true, data: json.data as T };
    return { ok: false, status: res.status, code: json.code ?? "error", message: json.detail ?? `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach Seed Directory. Check your connection and try again." };
  }
}
