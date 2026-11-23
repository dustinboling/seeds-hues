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
  ProfileSchema,
  SignInSchema,
  UnauthedCodeIssueSchema,
  UnauthedCodeVerifySchema,
  VarietyRefSchema,
} from "@/lib/services/accounts";
import type { UserRow } from "@/lib/repositories/accounts";
import { ServiceError } from "@/lib/services/ingest";
import { joinErrorRedirect } from "@/lib/waitlist-floor";
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
    // Create account (also the signed-out waiting-list join: pass join_variety). A join for an
    // existing email is the recognized-contact path: 200 with no session, never a 409.
    method: "POST",
    pattern: "",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const r = await ctx.services.accounts.create(parseBody(CreateAccountSchema, ctx.body ?? {}), ipOf(ctx.req));
      if (!r.session) return { data: r.data };
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
  {
    // The /account sign-in accommodation for phone-less accounts (§11.1): email a code instead.
    method: "POST",
    pattern: "sign-in/code",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const body = parseBody(UnauthedCodeIssueSchema, ctx.body ?? {});
      const data = await ctx.services.accounts.issueSignInCode(body.email, body.turnstile_token, ipOf(ctx.req));
      return { data };
    },
  },
  {
    method: "POST",
    pattern: "sign-in/verify",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const body = parseBody(UnauthedCodeVerifySchema, ctx.body ?? {});
      const r = await ctx.services.accounts.verifySignInCode(body.email, body.code);
      return { data: r.data, headers: cookieFor(r.session.token) };
    },
  },
  authed("profile", (u, ctx) => ctx.services.accounts.updateProfile(u, parseBody(ProfileSchema, ctx.body ?? {}))),
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
  {
    // Recognized-contact resend (unauthenticated): a fresh code for the pending join's email.
    method: "POST",
    pattern: "waitlist/code",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const body = parseBody(UnauthedCodeIssueSchema, ctx.body ?? {});
      const data = await ctx.services.accounts.resendWaitlistCode(body.email);
      return { data };
    },
  },
  {
    // Recognized-contact verify (unauthenticated): establishes the session at verify time and
    // completes the pending join in the same step.
    method: "POST",
    pattern: "waitlist/verify",
    scope: null,
    bucket: "public",
    handler: async (ctx) => {
      assertSameOrigin(ctx);
      const body = parseBody(UnauthedCodeVerifySchema, ctx.body ?? {});
      const r = await ctx.services.accounts.verifyWaitlistCode(body.email, body.code);
      return { data: r.data, headers: cookieFor(r.session.token) };
    },
  },
  {
    // The no-JS floor's plain join form (form-encoded, Turnstile-exempt per §11.4 with §3.4.5's
    // compensating controls; the same public rate-limit bucket as the create path). Every
    // outcome is a 303 redirect-back with the block's fragment — never a JSON error page.
    method: "POST",
    pattern: "waitlist/join-form",
    scope: null,
    bucket: "public",
    handler: async (ctx) => formRedirect(ctx, (raw, user) => ctx.services.accounts.joinFromForm(raw, user)),
  },
  {
    // The no-JS floor's plain code form (form-encoded; Turnstile never applied to code
    // verification). Every outcome is a 303 redirect-back with the block's fragment.
    method: "POST",
    pattern: "waitlist/verify-form",
    scope: null,
    bucket: "public",
    handler: async (ctx) => formRedirect(ctx, (raw, user) => ctx.services.accounts.verifyFromForm(raw, user)),
  },
];

/**
 * Run a no-JS form submission and wrap its outcome as a 303. The service methods already
 * redirect every expected failure back to the floor; this net catches only the unexpected
 * ServiceErrors (a variety deleted mid-submit, a code service outage) and lands those on the
 * variety page too — rate limits and listed races as the matching floor error, anything else
 * on the bare page (which 404s on its own for an unknown variety). A visitor is never
 * stranded on a JSON error page. Genuine bugs (non-ServiceError throws) still 500 — loudly.
 */
async function formRedirect(
  ctx: WriteContext,
  run: (raw: Record<string, unknown>, user: UserRow | null) => Promise<{ redirect: string; sessionToken: string | null }>,
): Promise<{ data: unknown; redirect: string; headers?: Record<string, string> }> {
  assertSameOrigin(ctx);
  const raw = (ctx.body ?? {}) as Record<string, unknown>;
  const variety = typeof raw.variety === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.variety) ? raw.variety : null;
  try {
    const r = await run(raw, await sessionUser(ctx));
    return { data: null, redirect: r.redirect, ...(r.sessionToken ? { headers: cookieFor(r.sessionToken) } : {}) };
  } catch (err) {
    if (!(err instanceof ServiceError) || !variety) throw err;
    if (err.status === 429) {
      return { data: null, redirect: joinErrorRedirect(variety, ["rate_limited"], { email: typeof raw.email === "string" ? raw.email : "" }) };
    }
    if (err.code === "already_listed") {
      return { data: null, redirect: joinErrorRedirect(variety, ["already_listed"], { email: typeof raw.email === "string" ? raw.email : "" }) };
    }
    return { data: null, redirect: `/variety/${variety}` };
  }
}
