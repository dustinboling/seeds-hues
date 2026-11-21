/**
 * POST /admin/varieties/actions — every Varieties write (Slice C, F2 aliases + variety
 * remove). The admin-session-authorized route-handler pattern from the sellers actions
 * route, with origin checks and server-side role enforcement: native form posts 303 back
 * with the status wording; fetch callers (the add-name sheet) send/accept JSON and get
 * structured field errors. Failures resolve to friendly lines — never a raw error
 * (§10.2).
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { withVariantPaths } from "@/lib/api/revalidate";
import { ServiceError } from "@/lib/services/ingest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { VarietyValidationError, type VarietyContext } from "@/lib/admin/variety-service";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const forbiddenPage = (back: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>Your reviewer role doesn't include that action.</p><p><a href="${back}">Back to Varieties</a></p></main></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

interface ListContext {
  variety: string | null;
  tab: string | null;
  q: string | null;
  crop: string | null;
  show: string | null;
}

function backTo(ctx: ListContext, extra: Record<string, string | null>, hash = ""): string {
  const params = new URLSearchParams();
  if (ctx.tab && ctx.tab !== "varieties") params.set("tab", ctx.tab);
  if (ctx.variety) params.set("variety", ctx.variety);
  if (ctx.q) params.set("q", ctx.q);
  if (ctx.crop) params.set("crop", ctx.crop);
  if (ctx.show && ctx.show !== "50") params.set("show", ctx.show);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return `/admin/varieties${query ? `?${query}` : ""}${hash}`;
}

function textOf(v: FormDataEntryValue | unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Friendly one-liners per failure code (§10.2 — nothing raw, no HTTP status shown). */
function friendlyError(err: unknown): string {
  if (err instanceof ServiceError) {
    if (err.code === "variety_not_found") return "That variety is gone.";
    if (err.code === "alias_not_found") return "That name is gone.";
    if (err.code === "alias_protected") return "Names added from a duplicate decision stay on the variety.";
    if (err.code === "variety_has_listings") return "That variety still has live listings — retire them before removing it.";
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
    json(err instanceof VarietyValidationError ? { ok: false, message: err.message, errors: err.fields } : { ok: false, message: friendlyError(err) }, status);

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
    variety: typeof raw.variety === "string" && raw.variety ? raw.variety.slice(0, 160) : null,
    tab: typeof raw.tab === "string" ? raw.tab : null,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim().slice(0, 120) : null,
    crop: typeof raw.crop === "string" && raw.crop ? raw.crop.slice(0, 160) : null,
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
  if (user.role !== "admin" && user.role !== "reviewer") {
    if (wantsJson) return json({ ok: false, message: "This account doesn't have admin access." }, 403);
    return redirect("/admin/no-access");
  }
  const c: VarietyContext = { role: user.role, decider: { userId: user.id, name: user.name } };

  if (!action || !ctx.variety) {
    if (wantsJson) return json({ ok: false, message: friendlyError(null) }, 400);
    return redirect(failed);
  }
  const ref = ctx.variety;
  const done = (extra: Record<string, string | null>, hash = "") => backTo(ctx, extra, hash);

  try {
    switch (action) {
      case "alias_add": {
        const r = await services.adminVarieties.addAlias(ref, raw, c);
        const to = done({ status: "alias_added", name: r.alias }, "#names");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "alias_remove": {
        const r = await services.adminVarieties.removeAlias(ref, raw, c);
        const to = done({ status: "alias_removed", name: r.alias }, "#names");
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "variety_remove": {
        const before = await services.adminVarieties.detail(ref);
        const r = await services.adminVarieties.removeVariety(ref, c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const to = backTo({ ...ctx, variety: null }, { status: "variety_removed", ...(before ? { name: before.name } : {}) });
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
      if (wantsJson) return json({ ok: false, message: err.code === "alias_protected" ? friendlyError(err) : "Your reviewer role doesn't include that action." }, 403);
      return forbiddenPage(backTo(ctx, {}));
    }
    if (err instanceof VarietyValidationError) {
      if (wantsJson) return failJson(err, 422);
      return redirect(failed);
    }
    if (err instanceof ServiceError && wantsJson) return failJson(err, err.status >= 500 ? 500 : err.status);
    return redirect(failed);
  }
}
