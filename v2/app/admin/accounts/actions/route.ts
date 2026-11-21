/**
 * POST /admin/accounts/actions — every Accounts write (Slice C, G2 roles + farm owner).
 * Admin only: reviewers never reach the effects (the page-level NoAccess stands and this
 * handler refuses them too). Otherwise the sellers actions route pattern: origin checks,
 * native form posts 303 back with the status wording, fetch callers (the role/farm
 * sheets) send/accept JSON with structured field errors. Failures resolve to friendly
 * lines — never a raw error (§10.2).
 */
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { ServiceError } from "@/lib/services/ingest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { AccountValidationError, type AccountContext } from "@/lib/admin/account-service";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const forbiddenPage = (back: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>Your reviewer role doesn't include account settings.</p><p><a href="${back}">Back to admin home</a></p></main></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

interface ListContext {
  account: string | null;
  q: string | null;
  show: string | null;
}

function backTo(ctx: ListContext, extra: Record<string, string | null>, hash = ""): string {
  const params = new URLSearchParams();
  if (ctx.account) params.set("account", ctx.account);
  if (ctx.q) params.set("q", ctx.q);
  if (ctx.show && ctx.show !== "50") params.set("show", ctx.show);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return `/admin/accounts${query ? `?${query}` : ""}${hash}`;
}

function textOf(v: FormDataEntryValue | unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Friendly one-liners per failure code (§10.2 — nothing raw, no HTTP status shown). */
function friendlyError(err: unknown): string {
  if (err instanceof ServiceError) {
    if (err.code === "account_not_found") return "That account is gone.";
    if (err.code === "seller_not_found") return "That seller is gone.";
    if (err.code === "self_role_change") return "You can't change your own role.";
    if (err.code === "last_admin") return "That account is the last admin — give someone else the admin role first.";
    if (err.code === "invalid_fields") return "Something needs attention before continuing.";
  }
  return "That didn't go through. Nothing was changed — try again.";
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const wantsJson = req.headers.get("accept")?.includes("application/json") ?? false;
  const failJson = (err: unknown, status: number) =>
    json(err instanceof AccountValidationError ? { ok: false, message: err.message, errors: err.fields } : { ok: false, message: friendlyError(err) }, status);

  let raw: Record<string, unknown> = {};
  let action: string | null = null;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && typeof body === "object") {
      raw = body;
      action = typeof body.action === "string" ? body.action : null;
    }
  } else {
    const form = await req.formData().catch(() => null);
    if (form) {
      for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = v;
      action = textOf(form.get("action"));
    }
  }
  const ctx: ListContext = {
    account: typeof raw.account === "string" && /^\d{1,12}$/.test(raw.account.trim()) ? raw.account.trim() : null,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim().slice(0, 120) : null,
    show: typeof raw.show === "string" ? raw.show : null,
  };
  const failed = backTo(ctx, { status: "save_failed" });

  const services = await getServices();
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const user = await services.adminAuth.userForAdminSession(token);
  const deepNext = backTo(ctx, {});
  if (!user) {
    if (wantsJson) return json({ ok: false, code: "signed_out", message: "Your admin session ended. Sign in again to pick up where you left off.", signin: `/admin/sign-in?next=${encodeURIComponent(deepNext)}` }, 401);
    return redirect(`/admin/sign-in?next=${encodeURIComponent(deepNext)}`);
  }
  if (user.role !== "admin") {
    if (wantsJson) return json({ ok: false, message: user.role === "reviewer" ? "Your reviewer role doesn't include account settings." : "This account doesn't have admin access." }, 403);
    return user.role === "reviewer" ? forbiddenPage("/admin") : redirect("/admin/no-access");
  }
  const c: AccountContext = { role: user.role, decider: { userId: user.id, name: user.name } };

  if (!action || !ctx.account) {
    if (wantsJson) return json({ ok: false, message: friendlyError(null) }, 400);
    return redirect(failed);
  }
  const done = (extra: Record<string, string | null>, hash = "") => backTo(ctx, extra, hash);

  try {
    switch (action) {
      case "role_save": {
        const r = await services.adminAccounts.setRole(raw, c);
        const to = r.changed ? done({ status: "role_changed", name: r.name, role: r.toRole }, "#role") : done({ status: "role_unchanged" }, "#role");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "farm_grant": {
        const r = await services.adminAccounts.grantFarmOwner(raw, c);
        const to = done({ status: "farm_granted", name: r.name, seller: r.sellerName }, "#farm");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "farm_revoke": {
        await services.adminAccounts.revokeFarmOwner(raw, c);
        const to = done({ status: "farm_revoked" }, "#farm");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      default: {
        if (wantsJson) return json({ ok: false, message: friendlyError(null) }, 400);
        return redirect(failed);
      }
    }
  } catch (err) {
    if (err instanceof ServiceError && err.status === 403) {
      if (wantsJson) return json({ ok: false, message: friendlyError(err) }, 403);
      return forbiddenPage(backTo(ctx, {}));
    }
    if (err instanceof AccountValidationError) {
      if (wantsJson) return failJson(err, 422);
      return redirect(failed);
    }
    if (err instanceof ServiceError && wantsJson) return failJson(err, err.status >= 500 ? 500 : err.status);
    return redirect(failed);
  }
}
