/**
 * POST /admin/sellers/actions — every Sellers write (Slice B). The admin-session-authorized
 * route-handler pattern from Slice A's decide route, with origin checks and server-side
 * role enforcement: native form posts 303 back to the seller (or the list) with the status
 * wording; fetch callers (the D3/D4/composer sheets) send/accept JSON and get structured
 * field errors. Failures resolve to friendly lines — never a raw error (§10.2).
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { withVariantPaths } from "@/lib/api/revalidate";
import { ServiceError } from "@/lib/services/ingest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { SellerValidationError, type SellerContext } from "@/lib/admin/seller-service";
import { SELLER_FIELD_LABELS } from "@/lib/admin/sellers";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const forbiddenPage = (back: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>Your reviewer role doesn't include that action.</p><p><a href="${back}">Back to Sellers</a></p></main></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

interface ListContext {
  seller: string | null;
  q: string | null;
  badge: string | null;
  state: string | null;
  sort: string | null;
}

function backTo(ctx: ListContext, extra: Record<string, string | null>, hash = ""): string {
  const params = new URLSearchParams();
  if (ctx.seller) params.set("seller", ctx.seller);
  if (ctx.q) params.set("q", ctx.q);
  if (ctx.badge && ctx.badge !== "all") params.set("badge", ctx.badge);
  if (ctx.state && ctx.state !== "all") params.set("state", ctx.state);
  if (ctx.sort && ctx.sort !== "name") params.set("sort", ctx.sort);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return `/admin/sellers${query ? `?${query}` : ""}${hash}`;
}

function textOf(v: FormDataEntryValue | unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Friendly one-liners per failure code (§10.2 — nothing raw, no HTTP status shown). */
function friendlyError(err: unknown): string {
  if (err instanceof ServiceError) {
    if (err.code === "seller_not_found") return "That seller is gone.";
    if (err.code === "seller_removed") return "That seller was removed from the directory.";
    if (err.code === "invalid_fields") return "Some fields need attention before saving.";
  }
  return "That didn't go through. Nothing was changed — try again.";
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const wantsJson = req.headers.get("accept")?.includes("application/json") ?? false;
  const failJson = (err: unknown, status: number) =>
    json(err instanceof SellerValidationError ? { ok: false, message: err.message, errors: err.fields } : { ok: false, message: friendlyError(err) }, status);

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
    seller: typeof raw.seller === "string" && raw.seller ? raw.seller.slice(0, 160) : null,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim().slice(0, 120) : null,
    badge: typeof raw.badge === "string" ? raw.badge : null,
    state: typeof raw.state === "string" ? raw.state : null,
    sort: typeof raw.sort === "string" ? raw.sort : null,
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
  if (user.role !== "admin" && user.role !== "reviewer") {
    if (wantsJson) return json({ ok: false, message: "This account doesn't have admin access." }, 403);
    return redirect("/admin/no-access");
  }
  const c: SellerContext = { role: user.role, decider: { userId: user.id, name: user.name } };

  if (!action || !ctx.seller) {
    if (wantsJson) return json({ ok: false, message: friendlyError(null) }, 400);
    return redirect(failed);
  }
  const ref = ctx.seller;
  const done = (extra: Record<string, string | null>, hash = "") => backTo(ctx, extra, hash);

  try {
    switch (action) {
      case "edit_save": {
        const r = await services.adminSellers.updateSeller(ref, raw, c);
        const changed = (r.data.changed ?? []) as string[];
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        // The status line names the new value for a single changed field (read back off the
        // saved record — honest); several fields name themselves.
        let extra: Record<string, string | null> = { updated: changed.join(",") || null };
        if (changed.length === 1 && changed[0]! in SELLER_FIELD_LABELS) {
          const d = await services.adminSellers.detail(ref);
          const value = d?.[changed[0] as keyof typeof d];
          if (typeof value === "string" && value.trim() && value.length <= 160) extra = { ...extra, updated_to: value };
        }
        const to = done(extra, "#info");
        if (wantsJson) return json({ ok: true, redirect: to, changed });
        return redirect(to);
      }
      case "classify": {
        const r = await services.adminSellers.classifySeller(ref, raw, c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const to = done({ classified: r.data.is_small_farm ? "small" : "not", ...(r.data.published ? { published: "1" } : {}) }, "#classification");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "add_note": {
        await services.adminSellers.addNote(ref, raw, c);
        const to = done({ status: "note_added" }, "#notes");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "deactivate": {
        const r = await services.adminSellers.setStatus(ref, "inactive", c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const to = done({});
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "reactivate": {
        const r = await services.adminSellers.setStatus(ref, "active", c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const to = done({ status: "reactivated" });
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "remove": {
        const before = await services.adminSellers.detail(ref);
        const r = await services.adminSellers.removeSeller(ref, c, typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim().slice(0, 500) : undefined);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const to = backTo({ ...ctx, seller: null }, { status: "removed", ...(before ? { name: before.name } : {}) });
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
      if (wantsJson) return json({ ok: false, message: "Your reviewer role doesn't include that action." }, 403);
      return forbiddenPage(backTo(ctx, {}));
    }
    if (err instanceof SellerValidationError) {
      if (wantsJson) return failJson(err, 422);
      return redirect(failed);
    }
    if (err instanceof ServiceError && wantsJson) return failJson(err, err.status >= 500 ? 500 : err.status);
    return redirect(failed);
  }
}
