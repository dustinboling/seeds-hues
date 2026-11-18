/**
 * /api/v1/account/* — the Seed Directory account, alerts and waiting-list endpoints used by the
 * site's own forms (Phase 3; not part of the documented public API). JSON in, the usual
 * { data, meta } envelope out, application/problem+json errors, every response no-store.
 *
 * Session: the `sf_session` cookie (raw 256-bit token, HttpOnly, Secure, SameSite=Lax, 30 days;
 * only its SHA-256 is stored). Cookie-authenticated POSTs also refuse a cross-site Origin.
 * Human check: Turnstile on create, sign-in and the signed-out waiting-list join (which is a
 * create with join_variety).
 */
import { SESSION_COOKIE, SESSION_DAYS, clearSessionCookie, readCookie, sessionCookie } from "@/lib/accounts";
import {
  AlertPhoneSchema,
  ChangeEmailSchema,
  CodeSchema,
  CreateAccountSchema,
  DeleteAccountSchema,
  PreferencesSchema,
  SignInSchema,
  VarietyRefSchema,
} from "@/lib/services/accounts";
import type { UserRow } from "@/lib/repositories/accounts";
import { Problem } from "./problem";
import { clientKey } from "./rate-limit";
import { parseBody, type RouteSpec, type WriteContext } from "./write-route";

const ipOf = (req: Request) => {
  const ip = clientKey(req);
  return ip === "unknown" ? null : ip;
};

/** Refuse cookie-authenticated writes from another site (defence in depth beside SameSite=Lax). */
export function assertSameOrigin(ctx: Pick<WriteContext, "req" | "url" | "env">): void {
  const origin = ctx.req.headers.get("origin");
  if (!origin) return;
  if (origin === ctx.url.origin || origin === ctx.env.siteUrl || ctx.env.corsOrigins.includes(origin)) return;
  throw new Problem(403, "cross_origin", "This request must come from the Seed Directory site.");
}

export async function sessionUser(ctx: Pick<WriteContext, "req" | "services">): Promise<UserRow | null> {
  return ctx.services.accounts.userForSession(readCookie(ctx.req.headers.get("cookie"), SESSION_COOKIE));
}

async function requireUser(ctx: WriteContext): Promise<UserRow> {
  assertSameOrigin(ctx);
  const u = await sessionUser(ctx);
  if (!u) throw new Problem(401, "signed_out", "Please sign in first.");
  return u;
}

const cookieFor = (token: string) => ({ "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86_400) });

const authed = (pattern: string, handler: (u: UserRow, ctx: WriteContext) => Promise<unknown>, method: "GET" | "POST" = "POST"): RouteSpec => ({
  method,
  pattern,
  scope: null,
  bucket: "public",
  handler: async (ctx) => ({ data: await handler(await requireUser(ctx), ctx) }),
});

export const ACCOUNT_ROUTES: RouteSpec[] = [
  {
    // Create account (also the signed-out waiting-list join: pass join_variety).
    method: "POST",
    pattern: "",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const r = await ctx.services.accounts.create(parseBody(CreateAccountSchema, ctx.body ?? {}), ipOf(ctx.req));
      return { status: 201, data: r.data, headers: cookieFor(r.session.token) };
    },
  },
  {
    method: "POST",
    pattern: "sign-in",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const r = await ctx.services.accounts.signIn(parseBody(SignInSchema, ctx.body ?? {}), ipOf(ctx.req));
      return { data: r.data, headers: cookieFor(r.session.token) };
    },
  },
  {
    method: "POST",
    pattern: "sign-out",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const data = await ctx.services.accounts.signOut(readCookie(ctx.req.headers.get("cookie"), SESSION_COOKIE));
      return { data, headers: { "Set-Cookie": clearSessionCookie() } };
    },
  },
  {
    method: "GET",
    pattern: "me",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      const u = await sessionUser(ctx);
      return { data: u ? { signed_in: true, user: ctx.services.accounts.me(u) } : { signed_in: false } };
    },
  },
  authed("alerts", (u, ctx) => ctx.services.accounts.alerts(u), "GET"),
  authed("email", (u, ctx) => ctx.services.accounts.changeEmail(u, parseBody(ChangeEmailSchema, ctx.body ?? {}))),
  authed("email/verify", (u, ctx) => ctx.services.accounts.verifyEmail(u, parseBody(CodeSchema, ctx.body ?? {}))),
  authed("email/resend", (u, ctx) => ctx.services.accounts.resendEmail(u)),
  authed("alert-phone", (u, ctx) => ctx.services.accounts.setAlertPhone(u, parseBody(AlertPhoneSchema, ctx.body ?? {}))),
  authed("alert-phone/verify", (u, ctx) => ctx.services.accounts.verifyPhone(u, parseBody(CodeSchema, ctx.body ?? {}))),
  authed("alert-phone/resend", (u, ctx) => ctx.services.accounts.resendPhone(u)),
  authed("preferences", (u, ctx) => ctx.services.accounts.setPreferences(u, parseBody(PreferencesSchema, ctx.body ?? {}))),
  {
    method: "POST",
    pattern: "delete",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      const u = await requireUser(ctx);
      parseBody(DeleteAccountSchema, ctx.body ?? {});
      const data = await ctx.services.accounts.deleteAccount(u);
      return { data, headers: { "Set-Cookie": clearSessionCookie() } };
    },
  },
  {
    // The variety page's waiting-list block (the page itself stays ISR-cached).
    method: "GET",
    pattern: "waitlist",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      const variety = ctx.url.searchParams.get("variety") ?? "";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variety)) throw new Problem(400, "validation_error", "variety must be a variety slug");
      const status = await ctx.services.accounts.waitlistStatus(await sessionUser(ctx), variety);
      return { data: { ...status, turnstile_site_key: ctx.env.turnstileSiteKey ?? null } };
    },
  },
  authed("waitlist/join", (u, ctx) => ctx.services.accounts.join(u, parseBody(VarietyRefSchema, ctx.body ?? {}))),
  authed("waitlist/leave", (u, ctx) => ctx.services.accounts.leave(u, parseBody(VarietyRefSchema, ctx.body ?? {}))),
];
