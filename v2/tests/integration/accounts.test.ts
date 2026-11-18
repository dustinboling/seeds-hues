/**
 * Phase 3 on a throwaway D1 + R2 (Miniflare): Turnstile rejection (403) on the real route
 * handlers, account create / session / sign-in / rate limits, ZIP → zone, the shared verification
 * codes (email + alert phone), waiting lists, the publish trigger through the ingest accept path,
 * the outbox drain with a mocked mailer + the mock SMS provider, unsubscribe links, account
 * deletion, Add Your Farm + the admin queue + the farm-owner flag, the Twilio STOP webhook, the
 * cron handler, and the privacy guardrail (no account data in snapshot / sync output).
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
import { mockSmsProvider, MOCK_SMS_OUTBOX, twilioSignature } from "@/lib/sms";
import type { Mailer, OutgoingEmail } from "@/lib/mail";
import { matchWaitlists } from "@/lib/services/waitlist-matcher";
import { readSnapshotRows } from "@/lib/repositories/snapshot";
import { importCatalog } from "@/lib/catalog/importer";
import { loadCatalogJson } from "../helpers/d1";
import { assertFarmOwner } from "@/lib/services/farms";
import { PRIVATE_ACCOUNT_TABLES } from "@/lib/db/schema";
import * as accountRoute from "@/app/api/v1/account/[[...path]]/route";
import * as farmRoute from "@/app/api/v1/farm-submissions/route";
import * as internalRoute from "@/app/api/v1/internal/[...path]/route";
import * as adminRoute from "@/app/api/v1/admin/[...path]/route";
import * as unsubscribeRoute from "@/app/api/v1/unsubscribe/route";
import * as twilioRoute from "@/app/api/v1/webhooks/twilio/sms/route";
import { runScheduled } from "@/lib/jobs/scheduled";

const SITE = "https://seeds.hues.flowers";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"; // what the widget returns with the test site key
const UNSUB_KEY = "test-unsubscribe-key";
const TWILIO_TOKEN = "test-twilio-auth-token";

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
/** siteverify stub: Cloudflare's always-pass test secret accepts any non-empty token. */
const siteverify = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
  const f = init!.body as URLSearchParams;
  return Response.json({ success: f.get("secret") === TURNSTILE_TEST_KEYS.secretKey && Boolean(f.get("response")) });
}) as unknown as typeof fetch;

const raw = (sql: string, ...binds: unknown[]) => t.env.DB.prepare(sql).bind(...binds);
const rows = async <T = Record<string, unknown>>(sql: string, ...binds: unknown[]) => (await raw(sql, ...binds).all<T>()).results;

function build(extra: Partial<Parameters<typeof createServices>[1]> = {}) {
  return createServices(t.db, {
    snapshots: t.env.SNAPSHOTS,
    turnstileSecret: TURNSTILE_TEST_KEYS.secretKey,
    turnstileFetch: siteverify,
    mailer,
    sms: mockSmsProvider(),
    siteUrl: SITE,
    unsubscribeKey: UNSUB_KEY,
    adminNotifyEmail: "dustin@example.com",
    now,
    onCode: (channel, userId, code) => codes.push({ channel, userId, code }),
    ...extra,
  });
}

type Handler = (req: Request, c: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;
let ipN = 0;
async function call(h: Handler, path: string, init: { method?: string; body?: unknown; cookie?: string; ip?: string; headers?: Record<string, string> } = {}) {
  const res = await h(
    new Request(`${SITE}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": init.ip ?? `198.51.100.${++ipN % 250}`,
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    }),
    { params: Promise.resolve({}) },
  );
  const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; code?: string; detail?: string };
  return { status: res.status, headers: res.headers, json };
}
const cookieOf = (r: { headers: Headers }) => /sf_session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![0];

let emailN = 0;
const signup = (over: Record<string, unknown> = {}) => ({
  name: "Ann Gardener",
  email: `ann${++emailN}@example.com`,
  phone: `(541) 555-${String(1000 + emailN).slice(-4)}`,
  zip: "97448",
  turnstile_token: DUMMY_TOKEN,
  ...over,
});
async function createUser(over: Record<string, unknown> = {}) {
  const body = signup(over);
  const r = await call(accountRoute.POST, "/api/v1/account", { body });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  const id = (await rows<{ id: number }>("SELECT id FROM users WHERE email = ?", String(body.email).toLowerCase()))[0]!.id;
  return { id, cookie: cookieOf(r), body, res: r };
}
async function verifyEmail(u: { id: number; cookie: string }) {
  const r = await call(accountRoute.POST, "/api/v1/account/email/verify", { body: { code: lastCode("email", u.id) }, cookie: u.cookie });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
}

// ── ingest fixture: an approved throwaway seller publishing a first listing ──
const SNAPSHOT = `<html><body><h1>Dearest Sunset Zinnia Seeds</h1><p>Zinnia elegans · 50 seeds per packet</p><p class="stock">In stock</p>
<h2>Dearest Bubblegum Zinnia Seeds</h2><p>In stock</p></body></html>`;
let sellerSlug = "";
let sourceId = 0;
function observation(slug: string, name: string, path: string) {
  return {
    schema: "listing_observation/1",
    seller_id: sellerSlug,
    source_id: sourceId,
    product: {
      url: `https://shop.waitlist-farm.example/products/${path}`,
      external_product_id: "unknown",
      variant_key: "",
      title_raw: `${name} Zinnia Seeds`,
      is_seed: { value: "yes", evidence: "50 seeds per packet" },
      crop: { value: "zinnia", evidence: "Zinnia Seeds" },
      variety_name: { value: name, evidence: `${name} Zinnia Seeds` },
      availability: { value: "in_stock", evidence: "In stock" },
    },
    match: { variety_id: slug, method: "exact", confidence: 1 },
  };
}

beforeAll(async () => {
  t = await createTestD1();
  s = build();
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
    sms: { provider: "mock", senderId: null, twilioAuthToken: TWILIO_TOKEN },
  } satisfies RuntimeEnv;
  // Approved seller on a throwaway domain + a human-captured source snapshot.
  const cand = await s.ingest.sellerCandidate({ name: "Waitlist Test Farm", website_url: "https://waitlist-farm.example", evidence: "fixture" });
  const a = await s.admin.approve(cand.review_item_id, {});
  sellerSlug = String(a.data.seller_slug);
  await s.admin.sellerAction(sellerSlug, "approve", {});
  const src = await s.ingest.registerSource({
    url: "https://shop.waitlist-farm.example/products/dearest",
    fetched_at: new Date().toISOString(),
    http_status: 200,
    content_text: SNAPSHOT,
    robots_allowed: true,
    kind: "human",
  });
  sourceId = src.id;
});
afterAll(async () => {
  await t?.dispose();
});
beforeEach(() => resetTokenBuckets());

describe("Turnstile on the Phase 3 forms (403 without a valid token)", () => {
  it("POST /api/v1/account without a token → 403, nothing created", async () => {
    const body = signup({ turnstile_token: undefined });
    const r = await call(accountRoute.POST, "/api/v1/account", { body });
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ code: "turnstile_failed", detail: "We couldn’t verify that you’re a person — please try again." });
    expect(await rows("SELECT id FROM users WHERE email = ?", body.email)).toHaveLength(0);
  });

  it("a token siteverify rejects → 403; no secret configured (outside next dev) → 403 (fail closed)", async () => {
    const rejecting = build({ turnstileFetch: (async () => Response.json({ success: false })) as unknown as typeof fetch });
    await expect(rejecting.accounts.create({ ...signup(), farm_owner: false, sms_opt_in: false }, null)).rejects.toMatchObject({ status: 403 });
    const unconfigured = build({ turnstileSecret: null });
    await expect(unconfigured.accounts.create({ ...signup(), farm_owner: false, sms_opt_in: false }, null)).rejects.toMatchObject({ status: 403 });
  });

  it("with Cloudflare's test keys the flow succeeds (siteverify gets the test secret + token)", async () => {
    const u = await createUser();
    const lastCall = (siteverify as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    const sent = lastCall[1].body as URLSearchParams;
    expect(sent.get("secret")).toBe(TURNSTILE_TEST_KEYS.secretKey);
    expect(sent.get("response")).toBe(DUMMY_TOKEN);
    expect(u.res.json.data).toMatchObject({ turnstile: "verified" });
  });
});

describe("accounts + sessions", () => {
  it("create → sf_session cookie (HttpOnly, Secure, Lax, 30 d), token stored only as a hash; ZIP → zone", async () => {
    const u = await createUser({ email: "Mixed.Case@Example.com", phone: "+1 (541) 555-7777", zip: "97448" });
    const setCookie = u.res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^sf_session=[\w-]{43}; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/);
    const row = (await rows<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", u.id))[0]!;
    expect(row).toMatchObject({ email: "mixed.case@example.com", phone: "5415557777", zip: "97448", usda_zone: "8b", email_verified: 0, is_farm_owner: 0, alert_phone: "5415557777", sms_opt_in: 0 });
    const sess = await rows<{ token_hash: string }>("SELECT token_hash FROM sessions WHERE user_id = ?", u.id);
    expect(sess).toHaveLength(1);
    expect(sess[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(setCookie).not.toContain(sess[0]!.token_hash);
    const me = await call(accountRoute.GET, "/api/v1/account/me", { cookie: u.cookie });
    expect(me.json.data).toMatchObject({ signed_in: true, user: { email: "mixed.case@example.com", usda_zone: "8b", email_verified: false } });
    expect(JSON.stringify(me.json)).not.toContain("97448"); // ZIP is never echoed back
    expect((await call(accountRoute.GET, "/api/v1/account/me")).json.data).toEqual({ signed_in: false });
    // The verification email went out with the 6-digit code.
    expect(mails.at(-1)).toMatchObject({ to: "mixed.case@example.com", subject: "Your Seed Directory verification code" });
    expect(mails.at(-1)!.text).toContain(lastCode("email", u.id));
  });

  it("unknown ZIP → 422 friendly error; malformed ZIP → 400; duplicate email → 409", async () => {
    const unknown = await call(accountRoute.POST, "/api/v1/account", { body: signup({ zip: "00000" }) });
    expect(unknown.status).toBe(422);
    expect(unknown.json).toMatchObject({ code: "unknown_zip" });
    expect((await call(accountRoute.POST, "/api/v1/account", { body: signup({ zip: "9744" }) })).status).toBe(400);
    const u = await createUser();
    const dup = await call(accountRoute.POST, "/api/v1/account", { body: { ...signup(), email: u.body.email } });
    expect(dup.status).toBe(409);
  });

  it("sign-in with the email + phone pair (no password, no code); wrong phone → generic error", async () => {
    const u = await createUser();
    const ok = await call(accountRoute.POST, "/api/v1/account/sign-in", { body: { email: String(u.body.email).toUpperCase(), phone: u.body.phone, turnstile_token: DUMMY_TOKEN } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/^sf_session=/);
    const bad = await call(accountRoute.POST, "/api/v1/account/sign-in", { body: { email: u.body.email, phone: "541-555-0000", turnstile_token: DUMMY_TOKEN } });
    expect(bad.status).toBe(401);
    expect(bad.json.detail).toBe("We couldn’t find that email + phone pair");
    const noUser = await call(accountRoute.POST, "/api/v1/account/sign-in", { body: { email: "nobody@example.com", phone: u.body.phone, turnstile_token: DUMMY_TOKEN } });
    expect(noUser.json.detail).toBe(bad.json.detail);
    const noToken = await call(accountRoute.POST, "/api/v1/account/sign-in", { body: { email: u.body.email, phone: u.body.phone } });
    expect(noToken.status).toBe(403);
  });

  it("rate limit: the 6th failure from one IP within 15 min → 429; the pair locks out too", async () => {
    const u = await createUser();
    const ip = "203.0.113.77";
    for (let i = 0; i < 5; i++) {
      const r = await call(accountRoute.POST, "/api/v1/account/sign-in", { ip, body: { email: u.body.email, phone: "541-555-0000", turnstile_token: DUMMY_TOKEN } });
      expect(r.status).toBe(401);
    }
    const blocked = await call(accountRoute.POST, "/api/v1/account/sign-in", { ip, body: { email: u.body.email, phone: u.body.phone, turnstile_token: DUMMY_TOKEN } });
    expect(blocked.status).toBe(429);
    // A different IP still hits the per-pair lockout for that wrong pair …
    const pair = await call(accountRoute.POST, "/api/v1/account/sign-in", { ip: "203.0.113.78", body: { email: u.body.email, phone: "541-555-0000", turnstile_token: DUMMY_TOKEN } });
    expect(pair.status).toBe(429);
    // … but the right pair from a fresh IP signs in.
    expect((await call(accountRoute.POST, "/api/v1/account/sign-in", { ip: "203.0.113.79", body: { email: u.body.email, phone: u.body.phone, turnstile_token: DUMMY_TOKEN } })).status).toBe(200);
    // The attempt log stores hashes only.
    const keys = await rows<{ key_hash: string }>("SELECT key_hash FROM auth_attempts");
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k.key_hash).toMatch(/^[0-9a-f]{64}$/);
    advance(16 * 60_000);
    expect((await call(accountRoute.POST, "/api/v1/account/sign-in", { ip, body: { email: u.body.email, phone: u.body.phone, turnstile_token: DUMMY_TOKEN } })).status).toBe(200);
  });

  it("sign-out deletes the session row and clears the cookie; a cross-site Origin is refused", async () => {
    const u = await createUser();
    const cross = await call(accountRoute.POST, "/api/v1/account/sign-out", { body: {}, cookie: u.cookie, headers: { Origin: "https://evil.example" } });
    expect(cross.status).toBe(403);
    const r = await call(accountRoute.POST, "/api/v1/account/sign-out", { body: {}, cookie: u.cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/^sf_session=; Path=\/; Max-Age=0/);
    expect(await rows("SELECT id FROM sessions WHERE user_id = ?", u.id)).toHaveLength(0);
    expect((await call(accountRoute.GET, "/api/v1/account/me", { cookie: u.cookie })).json.data).toEqual({ signed_in: false });
  });

  it("the farm-owner flag is never user-settable (declaration only records intent)", async () => {
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { ...signup(), farm_owner: true, is_farm_owner: true } });
    expect(r.status).toBe(400); // strict schema: unknown keys refused
    const u = await createUser({ farm_owner: true });
    expect(u.res.json.data).toMatchObject({ next: "/add-your-farm" });
    expect((await rows("SELECT farm_owner_declared, is_farm_owner, seller_id FROM users WHERE id = ?", u.id))[0]).toEqual({ farm_owner_declared: 1, is_farm_owner: 0, seller_id: null });
  });
});

describe("verification codes — one machinery, email + alert phone", () => {
  for (const channel of ["email", "phone"] as const) {
    const verifyPath = channel === "email" ? "/api/v1/account/email/verify" : "/api/v1/account/alert-phone/verify";
    const resendPath = channel === "email" ? "/api/v1/account/email/resend" : "/api/v1/account/alert-phone/resend";
    const flag = channel === "email" ? "email_verified" : "alert_phone_verified";
    const table = channel === "email" ? "email_verification_codes" : "phone_verification_codes";
    const make = async () => {
      const u = await createUser(channel === "phone" ? { sms_opt_in: true } : {});
      return u;
    };

    it(`${channel}: happy path; stored hashed with a salt, never in clear`, async () => {
      const u = await make();
      const code = lastCode(channel, u.id);
      const stored = (await rows<{ code_hash: string; salt: string }>(`SELECT code_hash, salt FROM ${table} WHERE user_id = ?`, u.id))[0]!;
      expect(stored.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(JSON.stringify(stored)).not.toContain(code);
      const r = await call(accountRoute.POST, verifyPath, { body: { code }, cookie: u.cookie });
      expect(r.status).toBe(200);
      expect((await rows<Record<string, number>>(`SELECT ${flag} AS f FROM users WHERE id = ?`, u.id))[0]!.f).toBe(1);
      expect((await call(accountRoute.POST, verifyPath, { body: { code }, cookie: u.cookie })).json.code).toBe("no_code"); // consumed
    });

    it(`${channel}: 5 wrong attempts kill the code (the right code then fails)`, async () => {
      const u = await make();
      const code = lastCode(channel, u.id);
      const wrong = code === "000000" ? "111111" : "000000";
      for (let i = 1; i <= 4; i++) {
        const r = await call(accountRoute.POST, verifyPath, { body: { code: wrong }, cookie: u.cookie });
        expect(r.json.code).toBe("code_incorrect");
      }
      expect((await call(accountRoute.POST, verifyPath, { body: { code: wrong }, cookie: u.cookie })).json.code).toBe("code_dead");
      expect((await call(accountRoute.POST, verifyPath, { body: { code }, cookie: u.cookie })).json.code).toBe("code_dead");
    });

    it(`${channel}: an expired code (30 min) is rejected with a resend offer`, async () => {
      const u = await make();
      const code = lastCode(channel, u.id);
      advance(31 * 60_000);
      const r = await call(accountRoute.POST, verifyPath, { body: { code }, cookie: u.cookie });
      expect(r.status).toBe(410);
      expect(r.json).toMatchObject({ code: "code_expired" });
      expect(r.json.detail).toMatch(/ask for a new one/);
    });

    it(`${channel}: resend issues a fresh code and invalidates the old one; 1/min limit`, async () => {
      const u = await make();
      const old = lastCode(channel, u.id);
      expect((await call(accountRoute.POST, resendPath, { body: {}, cookie: u.cookie })).status).toBe(429); // < 1 min after signup
      advance(61_000);
      const r = await call(accountRoute.POST, resendPath, { body: {}, cookie: u.cookie });
      expect(r.status).toBe(200);
      const fresh = lastCode(channel, u.id);
      const live = await rows(`SELECT id FROM ${table} WHERE user_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL`, u.id);
      expect(live).toHaveLength(1);
      if (fresh !== old) expect((await call(accountRoute.POST, verifyPath, { body: { code: old }, cookie: u.cookie })).json.code).toBe("code_incorrect");
      expect((await call(accountRoute.POST, verifyPath, { body: { code: fresh }, cookie: u.cookie })).status).toBe(200);
    });
  }

  it("email change resets verification and re-runs the code flow to the new address", async () => {
    const u = await createUser();
    await verifyEmail(u);
    const r = await call(accountRoute.POST, "/api/v1/account/email", { body: { email: "New.Address@example.com" }, cookie: u.cookie });
    expect(r.json.data).toMatchObject({ email: "new.address@example.com", email_verified: false, delivery: "sent" });
    expect((await rows("SELECT email, email_verified, email_verified_at FROM users WHERE id = ?", u.id))[0]).toEqual({ email: "new.address@example.com", email_verified: 0, email_verified_at: null });
    expect(mails.at(-1)!.to).toBe("new.address@example.com");
    await verifyEmail(u);
  });

  it("phone change resets alert-number verification; a code only proves the number it was sent to", async () => {
    const u = await createUser({ sms_opt_in: true });
    const firstCode = lastCode("phone", u.id);
    expect(MOCK_SMS_OUTBOX.at(-1)!.body).toContain(firstCode);
    expect((await call(accountRoute.POST, "/api/v1/account/alert-phone/verify", { body: { code: firstCode }, cookie: u.cookie })).status).toBe(200);
    const r = await call(accountRoute.POST, "/api/v1/account/alert-phone", { body: { alert_phone: "541-555-4242", sms_opt_in: true }, cookie: u.cookie });
    expect(r.json.data).toMatchObject({ alert_phone: "5415554242", alert_phone_verified: false, delivery: "sent" });
    expect((await rows("SELECT alert_phone, alert_phone_verified FROM users WHERE id = ?", u.id))[0]).toEqual({ alert_phone: "5415554242", alert_phone_verified: 0 });
    expect(MOCK_SMS_OUTBOX.at(-1)!.to).toBe("+15415554242");
    expect((await call(accountRoute.POST, "/api/v1/account/alert-phone/verify", { body: { code: lastCode("phone", u.id) }, cookie: u.cookie })).status).toBe(200);
  });

  it("boundary: no code is ever involved in signing in", async () => {
    const u = await createUser();
    const before = codes.length;
    const r = await call(accountRoute.POST, "/api/v1/account/sign-in", { body: { email: u.body.email, phone: u.body.phone, turnstile_token: DUMMY_TOKEN } });
    expect(r.status).toBe(200);
    expect(codes.length).toBe(before);
  });
});

describe("waiting lists, the publish trigger and the drain", () => {
  it("join twice → one entry; a variety that already has sellers refuses joins (first-found only)", async () => {
    const u = await createUser();
    for (let i = 0; i < 2; i++) {
      const r = await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-tabita" }, cookie: u.cookie });
      expect(r.status).toBe(200);
    }
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ?", u.id)).toHaveLength(1);
    const listed = await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "sweet-pea-kings-ransom" }, cookie: u.cookie });
    expect(listed.status).toBe(409);
    expect(listed.json.code).toBe("already_listed");
    const st = await call(accountRoute.GET, "/api/v1/account/waitlist?variety=zinnia-dearest-tabita", { cookie: u.cookie });
    expect(st.json.data).toMatchObject({ signed_in: true, on_list: true, held: [expect.stringMatching(/Verify your email/)], turnstile_site_key: TURNSTILE_TEST_KEYS.siteKey });
    const leave = await call(accountRoute.POST, "/api/v1/account/waitlist/leave", { body: { variety: "zinnia-dearest-tabita" }, cookie: u.cookie });
    expect(leave.json.data).toMatchObject({ left: true });
  });

  it("signed-out mini-form: one submission creates the account AND joins", async () => {
    const r = await call(accountRoute.POST, "/api/v1/account", { body: { ...signup(), join_variety: "zinnia-dearest-ellie" } });
    expect(r.status).toBe(201);
    expect(r.json.data).toMatchObject({ waitlist: { variety: "zinnia-dearest-ellie", joined: true } });
    const id = (await rows<{ id: number }>("SELECT id FROM users ORDER BY id DESC LIMIT 1"))[0]!.id;
    expect(await rows("SELECT w.id FROM waitlist_entries w JOIN varieties v ON v.id = w.variety_id WHERE w.user_id = ? AND v.slug = 'zinnia-dearest-ellie'", id)).toHaveLength(1);
  });

  it("publishing a first listing → one outbox row per eligible waiter per channel; held users get none until they verify", async () => {
    mails.length = 0;
    MOCK_SMS_OUTBOX.length = 0;
    // A: verified email, waits on BOTH varieties.  B: verified email, opted out of all alerts.
    // C: unverified email (held).  D: verified email + SMS opted in + verified number.
    // E: verified email + SMS opted in, number NOT verified.  F: verified email, SMS unchecked.
    const A = await createUser({ name: "Alice Waits" });
    const B = await createUser();
    const C = await createUser();
    const D = await createUser({ sms_opt_in: true });
    const E = await createUser({ sms_opt_in: true });
    const F = await createUser();
    for (const u of [A, B, D, E, F]) await verifyEmail(u);
    expect((await call(accountRoute.POST, "/api/v1/account/alert-phone/verify", { body: { code: lastCode("phone", D.id) }, cookie: D.cookie })).status).toBe(200);
    expect((await call(accountRoute.POST, "/api/v1/account/preferences", { body: { notify_opt_out: true }, cookie: B.cookie })).status).toBe(200);
    for (const u of [A, B, C, D, E, F]) await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-sunset" }, cookie: u.cookie });
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-bubblegum" }, cookie: A.cookie });
    // Nothing is listed yet → the matcher queues nothing.
    expect((await matchWaitlists(t.db, null)).queued).toEqual({ email: 0, sms: 0 });

    // The ingest accept path publishes Sunset AND Bubblegum (each crosses 0 → 1).
    const pub = await s.ingest.observations({ observations: [observation("zinnia-dearest-sunset", "Dearest Sunset", "dearest-sunset"), observation("zinnia-dearest-bubblegum", "Dearest Bubblegum", "dearest-bubblegum")] });
    expect(pub.summary).toEqual({ published: 2, queued: 0, rejected: 0 });

    const ob = await rows<{ user_id: number; channel: string; status: string; slug: string }>(
      "SELECT o.user_id, o.channel, o.status, v.slug FROM notification_outbox o JOIN varieties v ON v.id = o.variety_id WHERE o.user_id IN (?, ?, ?, ?, ?, ?) ORDER BY o.user_id, v.slug, o.channel",
      A.id, B.id, C.id, D.id, E.id, F.id,
    );
    const by = (id: number) => ob.filter((o) => o.user_id === id).map((o) => `${o.slug}:${o.channel}`);
    expect(by(A.id)).toEqual(["zinnia-dearest-bubblegum:email", "zinnia-dearest-sunset:email"]);
    expect(by(B.id)).toEqual(["zinnia-dearest-sunset:email"]); // queued; the drain suppresses (opt-out)
    expect(by(C.id)).toEqual([]); // held: unverified email, no SMS
    expect(by(D.id)).toEqual(["zinnia-dearest-sunset:email", "zinnia-dearest-sunset:sms"]);
    expect(by(E.id)).toEqual(["zinnia-dearest-sunset:email"]); // opted in but number unverified → no SMS row
    expect(by(F.id)).toEqual(["zinnia-dearest-sunset:email"]); // SMS unchecked → no SMS row

    // Idempotent: re-running the matcher or re-publishing the same listings adds nothing.
    expect((await matchWaitlists(t.db, null)).queued).toEqual({ email: 0, sms: 0 });
    const before = (await rows("SELECT id FROM notification_outbox")).length;
    await s.ingest.observations({ observations: [observation("zinnia-dearest-sunset", "Dearest Sunset", "dearest-sunset"), observation("zinnia-dearest-bubblegum", "Dearest Bubblegum", "dearest-bubblegum")] });
    expect((await rows("SELECT id FROM notification_outbox")).length).toBe(before);

    // Drain: one email per user (A's covers both varieties), B suppressed, D's text via the mock provider.
    const report = await s.notifications.drain();
    expect(report.email).toMatchObject({ status: "ok", emails: 4, suppressed: 1 });
    expect(report.sms).toMatchObject({ status: "ok", sent: 1 });
    const found = (to: unknown) => mails.filter((m) => m.to === to && /found/.test(m.subject));
    const toA = found(A.body.email);
    expect(toA).toHaveLength(1);
    expect(toA[0]!.subject).toBe("Good news — 2 of your varieties were found");
    expect(toA[0]!.html).toContain("Dearest Sunset");
    expect(toA[0]!.html).toContain("Dearest Bubblegum");
    expect(toA[0]!.html).toMatch(/https:\/\/seeds\.hues\.flowers\/go\/\d+/);
    expect(toA[0]!.html).toContain(`${SITE}/brand/hues-dahlia-mark.png`);
    expect(toA[0]!.text).toContain("93485 River Road, Junction City, OR");
    expect(toA[0]!.headers).toMatchObject({ "List-Unsubscribe": expect.stringMatching(/^<https:\/\/seeds\.hues\.flowers\/api\/v1\/unsubscribe\?token=u\d+\.all\./), "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(found(B.body.email)).toHaveLength(0);
    expect(found(F.body.email)[0]!.subject).toBe("Good news — Dearest Sunset seeds found");
    expect(MOCK_SMS_OUTBOX.filter((m) => !/code is/.test(m.body))).toEqual([expect.objectContaining({ to: `+1${String(D.body.phone).replace(/\D/g, "")}`, body: `Seed Directory: Dearest Sunset (Zinnia) is now listed by Waitlist Test Farm — ${SITE}/variety/zinnia-dearest-sunset` })]);
    expect((await rows("SELECT status, detail FROM notification_outbox WHERE user_id = ?", B.id))[0]).toEqual({ status: "suppressed", detail: "notify_opt_out" });
    expect(await rows("SELECT id FROM waitlist_entries WHERE user_id = ? AND notified_at IS NULL", A.id)).toHaveLength(0);

    // A second drain sends nothing new.
    const again = await s.notifications.drain();
    expect(again.email.emails + again.sms.sent).toBe(0);

    // Held → active: C verifies, and the found variety's alert queues by itself (no re-join).
    await verifyEmail(C);
    expect((await rows("SELECT channel FROM notification_outbox WHERE user_id = ?", C.id)).map((r) => r.channel)).toEqual(["email"]);
    await s.notifications.drain();
    expect(mails.filter((m) => m.to === C.body.email && /seeds found/.test(m.subject))).toHaveLength(1);

    // The Alerts section shows the live derived status.
    const alerts = await call(accountRoute.GET, "/api/v1/account/alerts", { cookie: A.cookie });
    expect((alerts.json.data as unknown as { status: { state: string; seller: { name: string } } }[]).map((a) => [a.status.state, a.status.seller.name])).toEqual([
      ["found", "Waitlist Test Farm"],
      ["found", "Waitlist Test Farm"],
    ]);
  });

  it("drain without the mail binding → mail_not_configured, rows stay queued; no SMS provider → sms_not_configured", async () => {
    const u = await createUser({ sms_opt_in: true });
    await verifyEmail(u);
    expect((await call(accountRoute.POST, "/api/v1/account/alert-phone/verify", { body: { code: lastCode("phone", u.id) }, cookie: u.cookie })).status).toBe(200);
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-kaleidoscope" }, cookie: u.cookie });
    // A listing made visible by a path with no hook (raw SQL): the drain's sweep must catch it.
    const v = (await rows<{ id: number }>("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-kaleidoscope'"))[0]!.id;
    const seller = (await rows<{ id: number }>("SELECT id FROM sellers WHERE slug = ?", sellerSlug))[0]!.id;
    await raw(
      "INSERT INTO listings (variety_id, seller_id, source_id, product_url, status, availability, created_at, updated_at) VALUES (?, ?, (SELECT min(id) FROM sources), 'https://shop.waitlist-farm.example/products/k', 'published', 'in_stock', ?, ?)",
      v, seller, now().toISOString(), now().toISOString(),
    ).run();
    const unbound = build({ mailer: { configured: false, send: async () => ({ ok: false, status: "mail_not_configured" }) }, sms: null });
    const r = await unbound.notifications.drain(); // the sweep queues the rows first
    expect(r.matched).toEqual({ email: 1, sms: 1 });
    expect(r.email).toMatchObject({ status: "mail_not_configured", sent: 0, remaining: 1 });
    expect(r.sms).toMatchObject({ status: "sms_not_configured", sent: 0, remaining: 1 });
    expect((await rows("SELECT status FROM notification_outbox WHERE user_id = ?", u.id)).map((x) => x.status)).toEqual(["queued", "queued"]);
    // Admin-gated endpoint: no key → 401; admin key → the same drain (now with mail) sends.
    expect((await call(internalRoute.POST, "/api/v1/internal/notifications/drain", { body: {} })).status).toBe(401);
    const { token } = await s.auth.mint("drain-test", ["admin"]);
    const ok = await call(internalRoute.POST, "/api/v1/internal/notifications/drain", { body: {}, headers: { Authorization: `Bearer ${token}` } });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ email: { status: "ok", emails: 1 }, sms: { status: "ok", sent: 1 } });
  });

  it("unsubscribe links: per-variety leaves that list; global sets notify_opt_out; forged tokens fail", async () => {
    const u = await createUser();
    await verifyEmail(u);
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-orange-creamsicle" }, cookie: u.cookie });
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-joanna-lavender-frost" }, cookie: u.cookie });
    const { signUnsubscribe } = await import("@/lib/accounts");
    const vId = (await rows<{ id: number }>("SELECT id FROM varieties WHERE slug = 'zinnia-dearest-orange-creamsicle'"))[0]!.id;
    const per = await signUnsubscribe(UNSUB_KEY, { kind: "variety", userId: u.id, varietyId: vId });
    expect(await s.accounts.describeUnsubscribe(per)).toEqual({ kind: "variety", variety: { name: "Dearest Orange Creamsicle", slug: "zinnia-dearest-orange-creamsicle" } });
    const r = await unsubscribeRoute.POST(new Request(`${SITE}/api/v1/unsubscribe?token=${per}`, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    expect(r.status).toBe(200);
    expect((await rows("SELECT variety_id FROM waitlist_entries WHERE user_id = ?", u.id)).map((x) => x.variety_id)).not.toContain(vId);
    const all = await signUnsubscribe(UNSUB_KEY, { kind: "all", userId: u.id });
    expect((await unsubscribeRoute.POST(new Request(`${SITE}/api/v1/unsubscribe?token=${all}`, { method: "POST" }))).status).toBe(200);
    expect((await rows("SELECT notify_opt_out FROM users WHERE id = ?", u.id))[0]).toEqual({ notify_opt_out: 1 });
    const forged = await signUnsubscribe("wrong-key", { kind: "all", userId: u.id });
    expect((await unsubscribeRoute.POST(new Request(`${SITE}/api/v1/unsubscribe?token=${forged}`, { method: "POST" }))).status).toBe(400);
  });

  it("Twilio STOP webhook (signed) clears sms_opt_in for that alert number; unsigned → 403", async () => {
    const u = await createUser({ sms_opt_in: true });
    const from = `+1${String(u.body.phone).replace(/\D/g, "")}`;
    const params = { From: from, Body: "STOP", To: "+18005550100" };
    const url = `${SITE}/api/v1/webhooks/twilio/sms`;
    const unsigned = await twilioRoute.POST(new Request(url, { method: "POST", body: new URLSearchParams(params) }));
    expect(unsigned.status).toBe(403);
    const sig = await twilioSignature(TWILIO_TOKEN, url, params);
    const ok = await twilioRoute.POST(new Request(url, { method: "POST", headers: { "X-Twilio-Signature": sig }, body: new URLSearchParams(params) }));
    expect(ok.status).toBe(200);
    expect((await rows("SELECT sms_opt_in FROM users WHERE id = ?", u.id))[0]).toEqual({ sms_opt_in: 0 });
  });

  it("delete account removes user, sessions, codes, waitlist and outbox rows", async () => {
    const u = await createUser();
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-karens-fave-color-mix" }, cookie: u.cookie });
    expect((await call(accountRoute.POST, "/api/v1/account/delete", { body: { confirm: "nope" }, cookie: u.cookie })).status).toBe(400);
    const r = await call(accountRoute.POST, "/api/v1/account/delete", { body: { confirm: "DELETE" }, cookie: u.cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    for (const tbl of ["users WHERE id", "sessions WHERE user_id", "waitlist_entries WHERE user_id", "notification_outbox WHERE user_id", "email_verification_codes WHERE user_id"]) {
      expect(await rows(`SELECT 1 FROM ${tbl} = ?`, u.id), tbl).toHaveLength(0);
    }
  });

  it("the cron handler runs the same drain from raw bindings", async () => {
    const report = await runScheduled({ ...t.env, SITE_URL: SITE });
    expect(report).toHaveProperty("email.status", "mail_not_configured"); // no EMAIL binding in the test env
    expect(report).toHaveProperty("sms.status", "sms_not_configured");
  });
});

describe("Add Your Farm + admin queue + farm-owner flag", () => {
  const farm = (over: Record<string, unknown> = {}) => ({
    farm_name: "Fixture Flower Farm",
    contact_name: "Fran Farmer",
    contact_email: "fran@fixture-farm.example",
    city: "Junction City",
    state: "OR",
    website: "https://fixture-farm.example",
    about: "We grow cut flowers and save our own seed.",
    varieties: "Zinnia — Dearest Sunset\nCosmos — Cupcakes Blush",
    authorized: true,
    business_phone: "(541) 555-0199",
    instagram_url: "https://instagram.com/fixturefarm",
    wholesale: "yes",
    turnstile_token: DUMMY_TOKEN,
    ...over,
  });

  it("without a Turnstile token → 403; with → pending row + queued draft job + admin notice", async () => {
    const no = await call(farmRoute.POST, "/api/v1/farm-submissions", { body: farm({ turnstile_token: undefined }) });
    expect(no.status).toBe(403);
    expect(await rows("SELECT id FROM farm_submissions")).toHaveLength(0);
    expect((await call(farmRoute.POST, "/api/v1/farm-submissions", { body: farm({ authorized: false }) })).status).toBe(400);
    const u = await createUser({ email: "fran@fixture-farm.example", farm_owner: true });
    const ok = await call(farmRoute.POST, "/api/v1/farm-submissions", { body: farm(), cookie: u.cookie });
    expect(ok.status, JSON.stringify(ok.json)).toBe(201);
    expect(ok.json.data).toMatchObject({ status: "pending", turnstile: "verified", admin_notice: "sent" });
    const row = (await rows<Record<string, unknown>>("SELECT * FROM farm_submissions WHERE id = ?", ok.json.data!.id))[0]!;
    expect(row).toMatchObject({ user_id: u.id, city: "Junction City", state: "OR", website: "https://fixture-farm.example", authorized: 1, business_phone: "5415550199", wholesale: 1, status: "pending", draft_status: "pending" });
    expect(await rows("SELECT id FROM crawl_jobs WHERE type = 'farm_summary' AND target = ?", String(row.id))).toHaveLength(1);
    expect(mails.at(-1)).toMatchObject({ to: "dustin@example.com", subject: "New Add Your Farm submission: Fixture Flower Farm" });
    // The ingest agents never lease farm_summary jobs.
    const leased = await s.ingest.lease({ count: 50 });
    expect(leased.jobs.filter((j) => j.type === "farm_summary")).toHaveLength(0);
  });

  it("the admin view lists it; approval with a seller sets is_farm_owner + seller_id + an audit row; revoke keeps the account", async () => {
    const { token } = await s.auth.mint("admin-test", ["admin"]);
    const auth = { Authorization: `Bearer ${token}` };
    const view = await call(adminRoute.GET, "/api/v1/admin/waitlist", { headers: auth });
    expect(view.status).toBe(200);
    const subs = (view.json.data as unknown as { farm_submissions: { id: number; farmName: string; status: string }[]; varieties: { slug: string; waiters: number }[]; totals: { accounts: number } }).farm_submissions;
    expect(subs.map((x) => x.farmName)).toContain("Fixture Flower Farm");
    expect((view.json.data as unknown as { totals: { accounts: number } }).totals.accounts).toBeGreaterThan(0);
    const id = subs.find((x) => x.farmName === "Fixture Flower Farm")!.id;
    expect((await call(adminRoute.POST, `/api/v1/admin/farm-submissions/${id}/approve`, { body: { seller: "no-such-seller" }, headers: auth })).status).toBe(404);
    const ap = await call(adminRoute.POST, `/api/v1/admin/farm-submissions/${id}/approve`, { body: { seller: sellerSlug }, headers: auth });
    expect(ap.status).toBe(200);
    expect(ap.json.data).toMatchObject({ status: "approved", seller: sellerSlug, farm_owner: { seller: sellerSlug } });
    const userId = (ap.json.data!.farm_owner as { user_id: number }).user_id;
    const sid = (await rows<{ id: number }>("SELECT id FROM sellers WHERE slug = ?", sellerSlug))[0]!.id;
    expect((await rows("SELECT is_farm_owner, seller_id FROM users WHERE id = ?", userId))[0]).toEqual({ is_farm_owner: 1, seller_id: sid });
    expect(await rows("SELECT actor, action, seller_id FROM farm_owner_audit WHERE user_id = ?", userId)).toEqual([{ actor: "admin-test", action: "granted", seller_id: sid }]);
    // The designed permission check (no consumers yet): flag AND matching seller.
    const owner = { isFarmOwner: true, sellerId: sid, status: "active" as const };
    expect(() => assertFarmOwner(owner, sid)).not.toThrow();
    expect(() => assertFarmOwner(owner, sid + 1)).toThrow();
    expect(() => assertFarmOwner({ ...owner, isFarmOwner: false }, sid)).toThrow();
    const rv = await call(adminRoute.POST, "/api/v1/admin/farm-owners/revoke", { body: { user: userId }, headers: auth });
    expect(rv.json.data).toMatchObject({ is_farm_owner: false });
    expect((await rows("SELECT is_farm_owner FROM users WHERE id = ?", userId))[0]).toEqual({ is_farm_owner: 0 });
    expect((await rows("SELECT action FROM farm_owner_audit WHERE user_id = ? ORDER BY id", userId)).map((r) => r.action)).toEqual(["granted", "revoked"]);
    const gr = await call(adminRoute.POST, "/api/v1/admin/farm-owners/grant", { body: { user: userId, seller: sellerSlug }, headers: auth });
    expect(gr.json.data).toMatchObject({ is_farm_owner: true });
    expect((await call(adminRoute.POST, `/api/v1/admin/farm-submissions/${id}/reject`, { body: {}, headers: auth })).status).toBe(409);
  });
});

describe("bulk catalog import is a publish path too", () => {
  it("import blast → the matcher runs once over the full set; one email per user; account data survives the re-import", async () => {
    mails.length = 0;
    const G = await createUser({ name: "Gail Import" });
    await verifyEmail(G);
    // G waited on two varieties before the import listed them (simulated: rows written directly).
    const ids = (await rows<{ id: number }>("SELECT id FROM varieties WHERE slug IN ('sweet-pea-kings-ransom', 'snapdragon-rembrandt') ORDER BY slug")).map((r) => r.id);
    for (const id of ids) await raw("INSERT INTO waitlist_entries (user_id, variety_id, created_at) VALUES (?, ?, ?)", G.id, id, now().toISOString()).run();
    const usersBefore = (await rows("SELECT id FROM users")).length;
    const r = await importCatalog(t.db, loadCatalogJson());
    expect(r.counts).toMatchObject({ plants: 124, varieties: 778, sellers: 25, listings: 17 });
    expect((await rows("SELECT id FROM users")).length).toBe(usersBefore); // the full-replace import never touches accounts
    expect((await rows("SELECT channel FROM notification_outbox WHERE user_id = ?", G.id)).map((x) => x.channel)).toEqual(["email", "email"]);
    await importCatalog(t.db, loadCatalogJson()); // re-run: dedupe holds
    expect(await rows("SELECT id FROM notification_outbox WHERE user_id = ?", G.id)).toHaveLength(2);
    await s.notifications.drain();
    const toG = mails.filter((m) => m.to === G.body.email && /found/.test(m.subject));
    expect(toG).toHaveLength(1);
    expect(toG[0]!.subject).toBe("Good news — 2 of your varieties were found");
  });
});

describe("privacy guardrail: account data never reaches snapshot / sync output", () => {
  it("no private table or sentinel value in the snapshot rows, /sync/snapshot or /sync/changes", async () => {
    const sentinel = await createUser({ name: "Sentinel Zzyzx", email: "sentinel-zzyzx@example.com", phone: "(541) 555-9876" });
    await call(accountRoute.POST, "/api/v1/account/waitlist/join", { body: { variety: "zinnia-dearest-joanna-lavender-frost" }, cookie: sentinel.cookie });
    const snap = await readSnapshotRows(t.db);
    for (const tbl of PRIVATE_ACCOUNT_TABLES) expect(Object.keys(snap)).not.toContain(tbl);
    const outputs = [JSON.stringify(snap), JSON.stringify(await s.sync.snapshot()), JSON.stringify(await s.sync.changes(0, 1000))];
    for (const out of outputs) {
      for (const needle of ["sentinel-zzyzx", "Sentinel Zzyzx", "5415559876", "97448", "token_hash", "waitlist", "notification_outbox", "farm_submissions", "usda_zone", "is_farm_owner"]) {
        expect(out, needle).not.toContain(needle);
      }
    }
  });
});
