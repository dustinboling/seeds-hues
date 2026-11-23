/**
 * Tranche 3.2 (waitlist flip) on a throwaway D1 (Miniflare): the minimal create (contact +
 * channel alone), the recognized-contact contract (unauthenticated code issue WITHOUT a
 * session, under the verification limits — never enforceLimits:false — and session + join at
 * verify time), the finish-profile endpoint, the /account email-code accommodation, and the
 * Turnstile-exempt form-encoded floor endpoints with their redirect-back + fragment semantics.
 * Every test fails on pre-build code (404s on the new routes, 409 email_taken on recognized
 * joins, 400s on minimal creates, no pending-join table).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Services } from "@/lib/services";
import type { RuntimeEnv } from "@/lib/api/runtime-env";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env, runtimeEnvFrom: (e: unknown) => e }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import { resetTokenBuckets } from "@/lib/api/rate-limit";
import { TURNSTILE_TEST_KEYS } from "@/lib/turnstile";
import { mockSmsProvider } from "@/lib/sms";
import type { Mailer, OutgoingEmail } from "@/lib/mail";
import * as accountRoute from "@/app/api/v1/account/[[...path]]/route";

const SITE = "https://seeds.hues.flowers";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const JOIN = "zinnia-dearest-tabita";
const JOIN2 = "zinnia-dearest-ellie";
const LISTED = "sweet-pea-kings-ransom";

let t: TestD1;
let s: Services;
const clock = { t: Date.parse("2026-11-17T10:00:00.000Z") };
const now = () => new Date(clock.t);
const advance = (ms: number) => (clock.t += ms);
const codes: { channel: "email" | "phone"; userId: number; code: string }[] = [];
const lastCode = (channel: "email" | "phone", userId: number) => [...codes].reverse().find((c) => c.channel === channel && c.userId === userId)!.code;
const mails: OutgoingEmail[] = [];
const mailer: Mailer = {
  configured: true,
  send: async (m) => {
    mails.push(m);
    return { ok: true, messageId: `m${mails.length}` };
  },
};
const siteverify = (async (_u: string | URL | Request, init?: RequestInit) => {
  const f = init!.body as URLSearchParams;
  return Response.json({ success: f.get("secret") === TURNSTILE_TEST_KEYS.secretKey && Boolean(f.get("response")) });
}) as unknown as typeof fetch;

const rows = async <T = Record<string, unknown>>(sql: string, ...binds: unknown[]) => (await t.env.DB.prepare(sql).bind(...binds).all<T>()).results;

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
let ipN = 0;
async function call(h: Handler, path: string, init: { method?: string; body?: unknown; cookie?: string; ip?: string; form?: Record<string, string> } = {}) {
  const isForm = init.form !== undefined;
  const res = await h(
    new Request(`${SITE}${path}`, {
      method: init.method ?? (init.body !== undefined || isForm ? "POST" : "GET"),
      headers: {
        "Content-Type": isForm ? "application/x-www-form-urlencoded" : "application/json",
        "cf-connecting-ip": init.ip ?? `198.51.100.${++ipN % 250}`,
        ...(init.cookie ? { Cookie: init.cookie } : {}),
      },
      body: isForm ? new URLSearchParams(init.form).toString() : init.body !== undefined ? JSON.stringify(init.body) : undefined,
    }),
    { params: Promise.resolve({}) },
  );
  const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> & { recognized?: boolean }; code?: string; detail?: string };
  return { status: res.status, headers: res.headers, json };
}
const cookieOf = (r: { headers: Headers }) => /sf_session=[^;]+/.exec(r.headers.get("set-cookie") ?? "")![0];
const locationOf = (r: { headers: Headers }) => r.headers.get("location")!;

let emailN = 0;
const freshEmail = () => `flip${++emailN}@example.com`;

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, {
    snapshots: t.env.SNAPSHOTS,
    turnstileSecret: TURNSTILE_TEST_KEYS.secretKey,
    turnstileFetch: siteverify,
    mailer,
    sms: mockSmsProvider(),
    siteUrl: SITE,
    unsubscribeKey: "test-unsubscribe-key",
    now,
    onCode: (channel, userId, code) => codes.push({ channel, userId, code }),
  });
  ctx.services = s;
  ctx.env = {
    siteUrl: SITE,
    corsOrigins: [SITE],
    rateLimiter: null,
    limiters: { search: null, reports: null, ingest: null },
    snapshots: t.env.SNAPSHOTS,
    revalidateToken: null,
    turnstileSecret: TURNSTILE_TEST_KEYS.secretKey,
    turnstileSiteKey: TURNSTILE_TEST_KEYS.siteKey,
    clickSalt: "test",
    sms: { provider: "mock", senderId: null, twilioAuthToken: null },
  } satisfies RuntimeEnv;
});
afterAll(async () => {
  await t?.dispose();
});
beforeEach(() => resetTokenBuckets());

describe("the minimal create (alert set with contact + channel alone)", () => {
  it("email-only join creates the account with nothing else demanded and records the join", async () => {
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.headers.get("set-cookie")).toMatch(/^sf_session=/);
    const row = (await rows<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", email))[0]!;
    expect(row).toMatchObject({ name: "", phone: "", zip: null, usda_zone: null, farm_owner_declared: 0, alert_phone: null, sms_opt_in: 0, email_verified: 0 });
    expect(await rows("SELECT w.id FROM waitlist_entries w JOIN varieties v ON v.id = w.variety_id WHERE w.user_id = ? AND v.slug = ?", row.id, JOIN)).toHaveLength(1);
    expect(r.json.data).toMatchObject({ waitlist: { variety: JOIN, joined: true }, verification: { email: "sent", phone: null } });
    expect(mails.at(-1)!.to).toBe(email);
    // The verification hold: alerts stay held until the emailed code is entered.
    const me = await call(accountRoute.GET, "/api/v1/account/waitlist?variety=zinnia-dearest-tabita", { cookie: cookieOf(r) });
    expect(me.json.data).toMatchObject({ signed_in: true, on_list: true, user: { email_verified: false, profile_complete: false }, channels: [], held: [expect.stringMatching(/Verify your email/)] });
  });

  it("text-channel join stores the phone, opts texts in with a consent timestamp, and sends both codes", async () => {
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email, phone: "(541) 555-0100", sms_opt_in: true, join_variety: JOIN2, turnstile_token: DUMMY_TOKEN } });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    const row = (await rows<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", email))[0]!;
    expect(row).toMatchObject({ name: "", phone: "5415550100", zip: null, usda_zone: null, alert_phone: "5415550100", sms_opt_in: 1 });
    expect(row.sms_opt_in_at).toBeTruthy();
    expect(r.json.data).toMatchObject({ verification: { email: "sent", phone: "sent" } });
  });

  it("text chosen without a phone → 400 naming phone; an email-only submit ignores a phone it carries", async () => {
    const noPhone = await call(accountRoute.POST, "/api/v1/account", { body: { email: freshEmail(), sms_opt_in: true, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    expect(noPhone.status).toBe(400);
    expect(noPhone.json.detail).toMatch(/^phone:/);
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email, phone: "(541) 555-0100", join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    expect(r.status).toBe(201);
    expect((await rows<Record<string, unknown>>("SELECT phone, alert_phone, sms_opt_in FROM users WHERE email = ?", email))[0]).toEqual({ phone: "5415550100", alert_phone: "5415550100", sms_opt_in: 0 });
  });

  it("the join path still accepts and stores the full set (older clients keep working)", async () => {
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account", {
      body: { name: "Full Set", email, phone: "(541) 555-0101", zip: "97448", farm_owner: false, sms_opt_in: false, join_variety: JOIN, turnstile_token: DUMMY_TOKEN },
    });
    expect(r.status).toBe(201);
    expect((await rows<Record<string, unknown>>("SELECT name, phone, zip, usda_zone FROM users WHERE email = ?", email))[0]).toEqual({
      name: "Full Set",
      phone: "5415550101",
      zip: "97448",
      usda_zone: "8b",
    });
  });

  it("scope guard: the plain create still requires name/phone/ZIP and still 409s a duplicate email", async () => {
    const missing = await call(accountRoute.POST, "/api/v1/account", { body: { email: freshEmail(), turnstile_token: DUMMY_TOKEN } });
    expect(missing.status).toBe(400);
    expect(missing.json.detail).toMatch(/name:/);
    expect(missing.json.detail).toMatch(/phone:/);
    expect(missing.json.detail).toMatch(/zip:/);
    const email = freshEmail();
    expect((await call(accountRoute.POST, "/api/v1/account", { body: { name: "N", email, phone: "(541) 555-0102", zip: "97448", turnstile_token: DUMMY_TOKEN } })).status).toBe(201);
    const dup = await call(accountRoute.POST, "/api/v1/account", { body: { name: "N", email, phone: "(541) 555-0103", zip: "97448", turnstile_token: DUMMY_TOKEN } });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("email_taken");
  });

  it("security fence: Turnstile stays required on the JavaScript join path", async () => {
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email: freshEmail(), join_variety: JOIN } });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("turnstile_failed");
  });
});

describe("recognized contact (inline verify, session at verify time)", () => {
  async function existingUser(over: Record<string, unknown> = {}) {
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { name: "Rita Known", email, phone: "(541) 555-0200", zip: "97448", turnstile_token: DUMMY_TOKEN, ...over } });
    expect(r.status).toBe(201);
    const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", email))[0]!.id;
    advance(61_000); // the recognized submit is a later return, past the 1/min code window
    return { id, email };
  }

  it("an existing email is recognized, never an error: code issued WITHOUT a session, pending join recorded", async () => {
    const u = await existingUser();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data).toMatchObject({ recognized: true, email: u.email, delivery: "sent" });
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(mails.at(-1)!.to).toBe(u.email);
    const pending = await rows<Record<string, unknown>>("SELECT user_id, variety_id, phone, sms_opt_in FROM waitlist_pending_joins WHERE user_id = ?", u.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ user_id: u.id, phone: null, sms_opt_in: 0 });
    // The join is NOT recorded until verification completes it.
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", u.id)).toHaveLength(0);
  });

  it("recognized issuance is rate-limited (the create path's enforceLimits:false is NOT carried over)", async () => {
    const u = await existingUser();
    const first = await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    expect(first.status).toBe(200);
    const second = await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN2, turnstile_token: DUMMY_TOKEN } });
    expect(second.status).toBe(429);
    expect(second.json.code).toBe("resend_too_soon");
  });

  it("verification establishes the session AND completes the pending join in the same step", async () => {
    const u = await existingUser();
    await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    const code = lastCode("email", u.id);
    const r = await call(accountRoute.POST, "/api/v1/account/waitlist/verify", { body: { email: u.email, code } });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data).toMatchObject({ variety: JOIN, joined: true, on_list: true, email_verified: true });
    expect(r.headers.get("set-cookie")).toMatch(/^sf_session=/);
    const cookie = cookieOf(r);
    expect((await call(accountRoute.GET, "/api/v1/account/me", { cookie })).json.data).toMatchObject({ signed_in: true });
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", u.id)).toHaveLength(1);
    expect(await rows("SELECT user_id FROM waitlist_pending_joins WHERE user_id = ?", u.id)).toHaveLength(0);
    expect((await rows<Record<string, number>>("SELECT email_verified AS f FROM users WHERE id = ?", u.id))[0]!.f).toBe(1);
  });

  it("a wrong code fails like every other code check (attempt-limited, join not completed, no session)", async () => {
    const u = await existingUser();
    await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    const code = lastCode("email", u.id);
    const wrong = code === "000000" ? "111111" : "000000";
    const r = await call(accountRoute.POST, "/api/v1/account/waitlist/verify", { body: { email: u.email, code: wrong } });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("code_incorrect");
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", u.id)).toHaveLength(0);
    expect(await rows("SELECT user_id FROM waitlist_pending_joins WHERE user_id = ?", u.id)).toHaveLength(1);
  });

  it("the submitter's text-channel choice is applied at verify time (number set, still unverified)", async () => {
    const u = await existingUser();
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, phone: "541-555-0300", sms_opt_in: true, join_variety: JOIN2, turnstile_token: DUMMY_TOKEN } });
    expect(r.status).toBe(200);
    const v = await call(accountRoute.POST, "/api/v1/account/waitlist/verify", { body: { email: u.email, code: lastCode("email", u.id) } });
    expect(v.status).toBe(200);
    expect((await rows<Record<string, unknown>>("SELECT alert_phone, alert_phone_verified, sms_opt_in FROM users WHERE id = ?", u.id))[0]).toMatchObject({
      alert_phone: "5415550300",
      alert_phone_verified: 0,
      sms_opt_in: 1,
    });
  });

  it("resend needs the pending join (the indirect human gate); then it re-issues under the limits", async () => {
    const u = await existingUser();
    const bare = await call(accountRoute.POST, "/api/v1/account/waitlist/code", { body: { email: u.email } });
    expect(bare.status).toBe(409);
    expect(bare.json.code).toBe("no_pending_join");
    await call(accountRoute.POST, "/api/v1/account", { body: { email: u.email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    const immediate = await call(accountRoute.POST, "/api/v1/account/waitlist/code", { body: { email: u.email } });
    expect(immediate.status).toBe(429);
    expect(immediate.json.code).toBe("resend_too_soon");
  });
});

describe("the finish-profile endpoint", () => {
  it("saves the deferred fields together; unknown ZIP fails field-mapped; blanks are no-ops", async () => {
    const email = freshEmail();
    const created = await call(accountRoute.POST, "/api/v1/account", { body: { email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    const cookie = cookieOf(created);
    const bad = await call(accountRoute.POST, "/api/v1/account/profile", { body: { name: "Ada", zip: "00000" }, cookie });
    expect(bad.status).toBe(422);
    expect(bad.json.code).toBe("unknown_zip");
    const ok = await call(accountRoute.POST, "/api/v1/account/profile", { body: { name: "Ada R", zip: "97448", farm_owner: true }, cookie });
    expect(ok.status, JSON.stringify(ok.json)).toBe(200);
    expect(ok.json.data).toMatchObject({ user: { name: "Ada R", usda_zone: "8b", farm_owner_declared: true } });
    const st = await call(accountRoute.GET, "/api/v1/account/waitlist?variety=zinnia-dearest-tabita", { cookie });
    expect(st.json.data).toMatchObject({ user: { profile_complete: true } });
    const noop = await call(accountRoute.POST, "/api/v1/account/profile", { body: { name: "", zip: "" }, cookie });
    expect(noop.status).toBe(200);
    expect((await rows<Record<string, unknown>>("SELECT name, zip FROM users WHERE email = ?", email))[0]).toEqual({ name: "Ada R", zip: "97448" });
  });

  it("requires a session", async () => {
    const r = await call(accountRoute.POST, "/api/v1/account/profile", { body: { name: "X" } });
    expect(r.status).toBe(401);
  });
});

describe("the /account email-code accommodation (§11.1)", () => {
  it("a phone-less account is emailed a code and the code signs it in (email verified too)", async () => {
    const email = freshEmail();
    const created = await call(accountRoute.POST, "/api/v1/account", { body: { email, join_variety: JOIN, turnstile_token: DUMMY_TOKEN } });
    const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", email))[0]!.id;
    expect(cookieOf(created)).toBeTruthy();
    advance(61_000); // past the 1/min code window the flip create's own code opened
    const issue = await call(accountRoute.POST, "/api/v1/account/sign-in/code", { body: { email, turnstile_token: DUMMY_TOKEN } });
    expect(issue.status, JSON.stringify(issue.json)).toBe(200);
    expect(issue.json.data).toMatchObject({ delivery: "sent" });
    const verify = await call(accountRoute.POST, "/api/v1/account/sign-in/verify", { body: { email, code: lastCode("email", id) } });
    expect(verify.status, JSON.stringify(verify.json)).toBe(200);
    expect(verify.headers.get("set-cookie")).toMatch(/^sf_session=/);
    expect((await call(accountRoute.GET, "/api/v1/account/me", { cookie: cookieOf(verify) })).json.data).toMatchObject({ signed_in: true });
    expect((await rows<Record<string, number>>("SELECT email_verified AS f FROM users WHERE id = ?", id))[0]!.f).toBe(1);
  });

  it("accounts with a phone keep the pair; unknown emails 404; issue needs Turnstile", async () => {
    const email = freshEmail();
    await call(accountRoute.POST, "/api/v1/account", { body: { name: "P", email, phone: "(541) 555-0400", zip: "97448", turnstile_token: DUMMY_TOKEN } });
    const hasPhone = await call(accountRoute.POST, "/api/v1/account/sign-in/code", { body: { email, turnstile_token: DUMMY_TOKEN } });
    expect(hasPhone.status).toBe(409);
    expect(hasPhone.json.code).toBe("has_phone");
    const unknown = await call(accountRoute.POST, "/api/v1/account/sign-in/code", { body: { email: "nobody-here@example.com", turnstile_token: DUMMY_TOKEN } });
    expect(unknown.status).toBe(404);
    expect(unknown.json.code).toBe("no_account");
    const noToken = await call(accountRoute.POST, "/api/v1/account/sign-in/code", { body: { email } });
    expect(noToken.status).toBe(403);
  });
});

describe("the no-JS form endpoints (Turnstile-exempt, redirect-back with the fragment)", () => {
  it("plain join creates the minimal account with NO Turnstile and 303s to the verify floor", async () => {
    const email = freshEmail();
    const r = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN, email, channel: "email", phone: "" } });
    expect(r.status).toBe(303);
    expect(locationOf(r)).toBe(`/variety/${JOIN}?waitlist=verify#waitlist-block`);
    expect(r.headers.get("set-cookie")).toMatch(/^sf_session=/);
    const row = (await rows<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", email))[0]!;
    expect(row).toMatchObject({ name: "", phone: "", zip: null, usda_zone: null });
  });

  it("plain join for an existing email is recognized (no session) and the plain code form completes it", async () => {
    const email = freshEmail();
    await call(accountRoute.POST, "/api/v1/account", { body: { name: "N", email, phone: "(541) 555-0500", zip: "97448", turnstile_token: DUMMY_TOKEN } });
    const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", email))[0]!.id;
    advance(61_000);
    const join = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN2, email, channel: "email", phone: "" } });
    expect(join.status).toBe(303);
    expect(locationOf(join).startsWith(`/variety/${JOIN2}?waitlist=recognized`)).toBe(true);
    expect(locationOf(join)).toContain("email=");
    expect(locationOf(join).endsWith("#waitlist-block")).toBe(true);
    expect(join.headers.get("set-cookie")).toBeNull();
    const verify = await call(accountRoute.POST, "/api/v1/account/waitlist/verify-form", { form: { variety: JOIN2, email, code: lastCode("email", id) } });
    expect(verify.status).toBe(303);
    expect(locationOf(verify).startsWith(`/variety/${JOIN2}?waitlist=active`)).toBe(true);
    expect(locationOf(verify)).toContain("channels=email");
    expect(locationOf(verify).endsWith("#waitlist-block")).toBe(true);
    expect(verify.headers.get("set-cookie")).toMatch(/^sf_session=/);
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", id)).toHaveLength(1);
  });

  it("sessioned plain code form reaches the joined state; a wrong code returns to verify with the error", async () => {
    const email = freshEmail();
    const join = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN, email, channel: "email", phone: "" } });
    const cookie = cookieOf(join);
    const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", email))[0]!.id;
    const code = lastCode("email", id);
    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await call(accountRoute.POST, "/api/v1/account/waitlist/verify-form", { form: { variety: JOIN, code: wrong }, cookie });
    expect(bad.status).toBe(303);
    expect(locationOf(bad)).toBe(`/variety/${JOIN}?waitlist=verify&cerr=code_incorrect#waitlist-block`);
    expect((await rows<Record<string, number>>("SELECT email_verified AS f FROM users WHERE id = ?", id))[0]!.f).toBe(0);
    const good = await call(accountRoute.POST, "/api/v1/account/waitlist/verify-form", { form: { variety: JOIN, code }, cookie });
    expect(good.status).toBe(303);
    expect(locationOf(good)).toBe(`/variety/${JOIN}?waitlist=active&channels=email#waitlist-block`);
    expect((await rows<Record<string, number>>("SELECT email_verified AS f FROM users WHERE id = ?", id))[0]!.f).toBe(1);
  });

  it("error floors preserve entered values + channel and never strand (3.2-G)", async () => {
    const badEmail = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN, email: "not-an-email", channel: "sms", phone: "5415550600" } });
    expect(badEmail.status).toBe(303);
    const loc = locationOf(badEmail);
    expect(loc).toContain("waitlist=error");
    expect(loc).toContain("err=email_invalid");
    expect(loc).toContain("channel=sms");
    expect(loc).toContain("phone=5415550600");
    expect(loc.endsWith("#waitlist-block")).toBe(true);
    const badBoth = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN, email: "bad", channel: "sms", phone: "xx" } });
    expect(locationOf(badBoth)).toContain("err=email_invalid%2Cphone_invalid");
    const listed = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: LISTED, email: freshEmail(), channel: "email", phone: "" } });
    expect(locationOf(listed)).toContain("err=already_listed");
    expect(locationOf(listed).endsWith("#waitlist-block")).toBe(true);
  });

  it("a signed-in visitor's floor submission joins directly (the floor is correct for every session)", async () => {
    const email = freshEmail();
    const created = await call(accountRoute.POST, "/api/v1/account", { body: { name: "S", email, phone: "(541) 555-0700", zip: "97448", turnstile_token: DUMMY_TOKEN } });
    const cookie = cookieOf(created);
    const r = await call(accountRoute.POST, "/api/v1/account/waitlist/join-form", { form: { variety: JOIN2, email: "other@example.com", channel: "email", phone: "" }, cookie });
    expect(r.status).toBe(303);
    expect(locationOf(r)).toBe(`/variety/${JOIN2}?waitlist=verify#waitlist-block`);
    const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", email))[0]!.id;
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", id)).toHaveLength(1);
  });
});
