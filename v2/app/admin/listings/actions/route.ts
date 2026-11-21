/**
 * POST /admin/listings/actions — every Listings write (Slice C, E2 retire + restore).
 * The admin-session-authorized route-handler pattern from the sellers actions route, with
 * origin checks and server-side role enforcement: native form posts 303 back to the
 * listing with the status wording; fetch callers (the retire sheet) send/accept JSON and
 * get structured field errors. Failures resolve to friendly lines — never a raw error
 * (§10.2).
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getServices } from "@/lib/services/context";
import { withVariantPaths } from "@/lib/api/revalidate";
import { ServiceError } from "@/lib/services/ingest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { ListingValidationError, type ListingContext } from "@/lib/admin/listing-service";

export const dynamic = "force-dynamic";

const redirect = (to: string) => new Response(null, { status: 303, headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

const forbiddenPage = (back: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not included | Seed Directory admin</title></head><body><main><h1>Not included in your role</h1><p>Your reviewer role doesn't include that action.</p><p><a href="${back}">Back to Listings</a></p></main></body></html>`,
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );

interface ListContext {
  listing: string | null;
  q: string | null;
  chip: string | null;
  seller: string | null;
  variety: string | null;
  show: string | null;
}

function backTo(ctx: ListContext, extra: Record<string, string | null>, hash = ""): string {
  const params = new URLSearchParams();
  if (ctx.listing) params.set("listing", ctx.listing);
  if (ctx.q) params.set("q", ctx.q);
  if (ctx.chip && ctx.chip !== "all") params.set("chip", ctx.chip);
  if (ctx.seller) params.set("seller", ctx.seller);
  if (ctx.variety) params.set("variety", ctx.variety);
  if (ctx.show && ctx.show !== "50") params.set("show", ctx.show);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return `/admin/listings${query ? `?${query}` : ""}${hash}`;
}

function textOf(v: FormDataEntryValue | unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** Friendly one-liners per failure code (§10.2 — nothing raw, no HTTP status shown). */
function friendlyError(err: unknown): string {
  if (err instanceof ServiceError) {
    if (err.code === "listing_not_found") return "That listing is gone.";
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
    json(err instanceof ListingValidationError ? { ok: false, message: err.message, errors: err.fields } : { ok: false, message: friendlyError(err) }, status);

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
    listing: typeof raw.listing === "string" && /^\d{1,12}$/.test(raw.listing.trim()) ? raw.listing.trim() : null,
    q: typeof raw.q === "string" && raw.q.trim() ? raw.q.trim().slice(0, 120) : null,
    chip: typeof raw.chip === "string" ? raw.chip : null,
    seller: typeof raw.seller === "string" && raw.seller ? raw.seller.slice(0, 160) : null,
    variety: typeof raw.variety === "string" && raw.variety ? raw.variety.slice(0, 160) : null,
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
  const c: ListingContext = { role: user.role, decider: { userId: user.id, name: user.name } };

  if (!action || !ctx.listing) {
    if (wantsJson) return json({ ok: false, message: friendlyError(null) }, 400);
    return redirect(failed);
  }
  const done = (extra: Record<string, string | null>, hash = "") => backTo(ctx, extra, hash);

  try {
    switch (action) {
      case "retire": {
        const r = await services.adminListings.retire(raw, c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const detail = await services.adminListings.detail(Number(ctx.listing));
        const to = done({ status: "retired", ...(detail ? { variety_name: detail.varietyName } : {}) });
        if (wantsJson) return json({ ok: true, redirect: to });
        return redirect(to);
      }
      case "restore": {
        const r = await services.adminListings.restore(raw, c);
        for (const p of withVariantPaths(r.revalidate)) revalidatePath(p);
        const detail = await services.adminListings.detail(Number(ctx.listing));
        const restored = (r.data.restored ?? false) as boolean;
        const to = done({ status: restored ? "restored" : "restore_skipped", ...(detail ? { variety_name: detail.varietyName } : {}) });
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
    if (err instanceof ListingValidationError) {
      if (wantsJson) return failJson(err, 422);
      return redirect(failed);
    }
    if (err instanceof ServiceError && wantsJson) return failJson(err, err.status >= 500 ? 500 : err.status);
    return redirect(failed);
  }
}
