/**
 * Slice 0 on a throwaway D1 (Miniflare): the email + code admin sign-in (reviewer/admin
 * complete it, visitors are refused, unknown emails advance without a code), the distinct
 * 7-day admin session layer, code expiry / attempt death / resend limits, roles + the
 * role audit trail, and the dashboard's queue counts + recent decisions.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const guardCtx = vi.hoisted(() => ({ cookie: null as string | null, services: null as unknown }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (name === "sf_admin_session" && guardCtx.cookie ? { value: guardCtx.cookie } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => guardCtx.services }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services } from "@/lib/services";
import { requireAdmin } from "@/lib/admin-current-user";
import * as accountsRepo from "@/lib/repositories/accounts";
import * as adminRepo from "@/lib/repositories/admin-auth";
import * as reviewRepo from "@/lib/repositories/admin";
import * as farmRepo from "@/lib/repositories/farm-submissions";
import { hashSessionToken, isSessionTokenShape, newSessionToken } from "@/lib/accounts";
import { ADMIN_SESSION_DAYS } from "@/lib/admin-auth";
import type { Mailer, OutgoingEmail } from "@/lib/mail";
import { ServiceError } from "@/lib/services/ingest";

const SITE = "https://seeds.hues.flowers";

let t: TestD1;
let s: Services;
const clock = { t: Date.parse("2026-11-21T10:00:00.000Z") };
const now = () => new Date(clock.t);
const advance = (ms: number) => {
  clock.t += ms;
};
const codes: { userId: number; code: string }[] = [];
const lastCode = (userId: number) => [...codes].reverse().find((c) => c.userId === userId)!.code;
const mails: OutgoingEmail[] = [];
const mailer: Mailer = {
  configured: true,
  send: async (m) => {
    mails.push(m);
    return { ok: true, messageId: `m${mails.length}` };
  },
};

let visitorId = 0;
let reviewerId = 0;
let adminId = 0;
let coderId = 0;
let extraId = 0;
let expiredToken = "";

async function makeUser(email: string, role: "visitor" | "reviewer" | "admin", name: string): Promise<number> {
  const u = await accountsRepo.insertUser(t.db, { email, name, phone: "5415550123", zip: "97448", usdaZone: "8b", role });
  return u!.id;
}

async function sessionCount(): Promise<number> {
  const r = await t.env.DB.prepare("SELECT COUNT(*) AS n FROM admin_sessions").all<{ n: number }>();
  return r.results[0]?.n ?? -1;
}

beforeAll(async () => {
  t = await createTestD1({ seed: false });
  s = createServices(t.db, { mailer, siteUrl: SITE, now, onAdminCode: (userId, code) => codes.push({ userId, code }) });
  visitorId = await makeUser("visitor@example.com", "visitor", "Viv Visitor");
  reviewerId = await makeUser("reviewer@example.com", "reviewer", "Rae Reviewer");
  adminId = await makeUser("admin@example.com", "admin", "Ann Admin");
  coderId = await makeUser("coder@example.com", "reviewer", "Cod Ey");
  extraId = await makeUser("extra@example.com", "visitor", "Ex Tra");
  await makeUser("resend@example.com", "reviewer", "Re Send");
}, 180_000);

afterAll(async () => {
  await t.dispose();
});

describe("unknown emails advance without a code (no enumeration)", () => {
  it("request succeeds, nothing is issued or sent, and no code verifies", async () => {
    const before = codes.length;
    const mailsBefore = mails.length;
    await expect(s.adminAuth.requestCode("nobody@example.com")).resolves.toEqual({ delivery: "sent" });
    expect(codes.length).toBe(before);
    expect(mails.length).toBe(mailsBefore);
    await expect(s.adminAuth.verifyCode("nobody@example.com", "123456")).resolves.toEqual({ ok: false, code: "no_code" });
  });
});

describe("reviewer/admin complete the email + code flow; visitors are refused", () => {
  it("reviewer: wrong code fails with tries left, the right code opens the session", async () => {
    await expect(s.adminAuth.requestCode("reviewer@example.com")).resolves.toEqual({ delivery: "sent" });
    const code = lastCode(reviewerId);
    expect(code).toMatch(/^\d{6}$/);
    await expect(s.adminAuth.verifyCode("reviewer@example.com", "000000")).resolves.toEqual({ ok: false, code: "code_incorrect", attemptsLeft: 4 });
    const issuedAt = clock.t;
    const r = await s.adminAuth.verifyCode("reviewer@example.com", code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isSessionTokenShape(r.session.token)).toBe(true);
    expect(r.session.expiresAt).toBe(new Date(issuedAt + ADMIN_SESSION_DAYS * 86_400_000).toISOString());
    expect(r.role).toBe("reviewer");
    const u = await s.adminAuth.userForAdminSession(r.session.token);
    expect(u?.email).toBe("reviewer@example.com");
    expect(u?.role).toBe("reviewer");
  });

  it("admin: the code email is the admin template, and the session resolves", async () => {
    await s.adminAuth.requestCode("admin@example.com");
    const code = lastCode(adminId);
    const mail = mails[mails.length - 1]!;
    expect(mail.to).toBe("admin@example.com");
    expect(mail.subject).toBe("Your admin sign-in code");
    expect(mail.text).toContain(code);
    expect(mail.text).not.toContain("never need a code to sign in");
    const r = await s.adminAuth.verifyCode("admin@example.com", code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await s.adminAuth.userForAdminSession(r.session.token))?.role).toBe("admin");
  });

  it("visitor: a correct code is refused with no_role and creates no session", async () => {
    await s.adminAuth.requestCode("visitor@example.com");
    const before = await sessionCount();
    const r = await s.adminAuth.verifyCode("visitor@example.com", lastCode(visitorId));
    expect(r).toEqual({ ok: false, code: "no_role", name: "Viv Visitor", email: "visitor@example.com" });
    expect(await sessionCount()).toBe(before);
  });
});

describe("the admin session is distinct from the visitor session", () => {
  it("a valid visitor cookie resolves as a visitor but never as an admin (and vice versa)", async () => {
    advance(61_000);
    await s.adminAuth.requestCode("reviewer@example.com");
    const adminToken = (await s.adminAuth.verifyCode("reviewer@example.com", lastCode(reviewerId))) as { ok: true; session: { token: string } };
    expect(adminToken.ok).toBe(true);
    const visitorToken = newSessionToken();
    const at = now().toISOString();
    await accountsRepo.insertSession(t.db, {
      userId: reviewerId,
      tokenHash: await hashSessionToken(visitorToken),
      createdAt: at,
      expiresAt: new Date(clock.t + 30 * 86_400_000).toISOString(),
      lastSeenAt: at,
    });
    expect((await s.accounts.userForSession(visitorToken))?.email).toBe("reviewer@example.com");
    expect(await s.adminAuth.userForAdminSession(visitorToken)).toBeNull();
    expect(await s.accounts.userForSession(adminToken.session.token)).toBeNull();
  });
});

describe("code expiry, attempt death, and resend limits", () => {
  it("codes expire after the shared TTL", async () => {
    await s.adminAuth.requestCode("coder@example.com");
    const code = lastCode(coderId);
    advance(31 * 60_000);
    await expect(s.adminAuth.verifyCode("coder@example.com", code)).resolves.toEqual({ ok: false, code: "code_expired" });
  });

  it("five wrong tries kill the code; the right code no longer works afterwards", async () => {
    await s.adminAuth.requestCode("coder@example.com");
    const code = lastCode(coderId);
    for (let left = 4; left >= 0; left--) {
      const r = await s.adminAuth.verifyCode("coder@example.com", "111111");
      if (left === 0) expect(r).toEqual({ ok: false, code: "code_dead" });
      else expect(r).toEqual({ ok: false, code: "code_incorrect", attemptsLeft: left });
    }
    await expect(s.adminAuth.verifyCode("coder@example.com", code)).resolves.toEqual({ ok: false, code: "code_dead" });
  });

  it("resends are limited to 1/minute and 5/hour", async () => {
    await s.adminAuth.requestCode("resend@example.com");
    await expect(s.adminAuth.requestCode("resend@example.com")).rejects.toMatchObject({ status: 429, code: "resend_too_soon" });
    for (let i = 0; i < 4; i++) {
      advance(61_000);
      await s.adminAuth.requestCode("resend@example.com");
    }
    advance(61_000);
    await expect(s.adminAuth.requestCode("resend@example.com")).rejects.toMatchObject({ status: 429, code: "resend_limit" });
  });
});

describe("7-day expiry, the expired-session email, and sign-out", () => {
  it("sessions live exactly 7 days, then resolve to null with the email kept for the welcome back", async () => {
    await s.adminAuth.requestCode("admin@example.com");
    const issuedAt = clock.t;
    const r = (await s.adminAuth.verifyCode("admin@example.com", lastCode(adminId))) as { ok: true; session: { token: string; expiresAt: string } };
    expect(r.session.expiresAt).toBe(new Date(issuedAt + 7 * 86_400_000).toISOString());
    expiredToken = r.session.token;
    clock.t = issuedAt + 7 * 86_400_000 + 1;
    expect(await s.adminAuth.userForAdminSession(r.session.token)).toBeNull();
    expect(await s.adminAuth.expiredAdminSessionEmail(r.session.token)).toBe("admin@example.com");
    expect(await s.adminAuth.expiredAdminSessionEmail(newSessionToken())).toBeNull();
  });

  it("sign-out drops the session", async () => {
    await s.adminAuth.requestCode("reviewer@example.com");
    const r = (await s.adminAuth.verifyCode("reviewer@example.com", lastCode(reviewerId))) as { ok: true; session: { token: string } };
    expect(await s.adminAuth.userForAdminSession(r.session.token)).not.toBeNull();
    await expect(s.adminAuth.signOut(r.session.token)).resolves.toEqual({ signed_out: true });
    expect(await s.adminAuth.userForAdminSession(r.session.token)).toBeNull();
  });
});

describe("roles resolve server-side; changes append the audit trail", () => {
  it("defaults to visitor; setAccountRole records from/to/actor in order", async () => {
    await expect(s.adminAuth.roleOf(extraId)).resolves.toBe("visitor");
    await expect(s.adminAuth.setAccountRole(extraId, "reviewer", "Ann Admin")).resolves.toEqual({ user_id: extraId, from_role: "visitor", to_role: "reviewer" });
    await expect(s.adminAuth.roleOf(extraId)).resolves.toBe("reviewer");
    await s.adminAuth.setAccountRole(extraId, "admin", "Ann Admin");
    const trail = await adminRepo.roleAuditFor(t.db, extraId);
    expect(trail.map((r) => [r.actor, r.fromRole, r.toRole])).toEqual([
      ["Ann Admin", "reviewer", "admin"],
      ["Ann Admin", "visitor", "reviewer"],
    ]);
  });

  it("unknown roles and accounts are refused", async () => {
    await expect(s.adminAuth.setAccountRole(extraId, "superadmin", "Ann Admin")).rejects.toBeInstanceOf(ServiceError);
    await expect(s.adminAuth.setAccountRole(999999, "admin", "Ann Admin")).rejects.toMatchObject({ status: 404 });
  });
});

describe("page guard (requireAdmin)", () => {
  it("signed-out → /admin/sign-in with the return path preserved", async () => {
    guardCtx.services = s;
    guardCtx.cookie = null;
    await expect(requireAdmin("/admin/review")).rejects.toThrow("REDIRECT /admin/sign-in?next=%2Fadmin%2Freview");
  });

  it("expired session → welcome back with the email prefilled", async () => {
    guardCtx.cookie = expiredToken;
    await expect(requireAdmin("/admin/sellers")).rejects.toThrow("REDIRECT /admin/sign-in?next=%2Fadmin%2Fsellers&expired=1&email=admin%40example.com");
  });

  it("a demoted account's live session lands on the wrong-role page (revocation bites on the next request)", async () => {
    await s.adminAuth.setAccountRole(extraId, "visitor", "Ann Admin");
    const token = newSessionToken();
    const at = now().toISOString();
    await adminRepo.insertAdminSession(t.db, {
      userId: extraId,
      tokenHash: await hashSessionToken(token),
      createdAt: at,
      expiresAt: new Date(clock.t + 7 * 86_400_000).toISOString(),
      lastSeenAt: at,
    });
    guardCtx.cookie = token;
    await expect(requireAdmin("/admin")).rejects.toThrow("REDIRECT /admin/no-access");
  });

  it("a live reviewer session returns the viewer", async () => {
    advance(61_000);
    await s.adminAuth.requestCode("reviewer@example.com");
    const r = await s.adminAuth.verifyCode("reviewer@example.com", lastCode(reviewerId));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    guardCtx.cookie = r.session.token;
    await expect(requireAdmin("/admin/review")).resolves.toEqual({ id: reviewerId, name: "Rae Reviewer", email: "reviewer@example.com", role: "reviewer" });
  });
});

describe("dashboard home reads the existing queues", () => {
  it("queue cards carry real counts + oldest age; duplicates honestly read zero", async () => {
    const at = (daysAgo: number) => new Date(clock.t - daysAgo * 86_400_000).toISOString();
    const item = (type: "seller_candidate" | "listing_match" | "new_variety" | "seller_correction" | "removal", daysAgo: number) =>
      reviewRepo.insertReviewItem(t.db, { type, groupKey: `${type}-${daysAgo}`, proposal: {}, reason: null, confidence: null, at: at(daysAgo) });
    await item("seller_candidate", 6);
    await item("seller_candidate", 1);
    await item("listing_match", 2);
    await item("new_variety", 3);
    await item("seller_correction", 4);
    await item("removal", 5);
    await farmRepo.insertFarmSubmission(t.db, {
      farmName: "Test Farm",
      contactName: "F Ann",
      contactEmail: "fann@example.com",
      city: "Springfield",
      state: "OR",
      website: "https://example.com",
      growsText: "grows",
      varietiesText: "v",
      authorized: true,
      businessPhone: "5415550199",
      turnstile: "dev_bypass",
      createdAt: at(0),
    });
    const { cards, totalWaiting } = await s.adminAuth.queueCards();
    const byKey = new Map(cards.map((c) => [c.key, c]));
    expect(byKey.get("duplicates")).toMatchObject({ count: 0, oldest: null });
    expect(byKey.get("sellers")).toMatchObject({ count: 3, oldest: at(6) });
    expect(byKey.get("listings")).toMatchObject({ count: 2, oldest: at(3) });
    expect(byKey.get("reports")).toMatchObject({ count: 2, oldest: at(5) });
    expect(totalWaiting).toBe(7);
    for (const c of cards) expect(c.href).toBe("/admin/review");
  });

  it("recent decisions merge queue outcomes with the role trail, newest first", async () => {
    advance(1000);
    const id = await reviewRepo.insertReviewItem(t.db, { type: "seller_candidate", groupKey: "decided-1", proposal: {}, reason: null, confidence: null, at: now().toISOString() });
    await reviewRepo.resolveReviewItem(t.db, id, "approved", now().toISOString());
    const decisions = await s.adminAuth.recentDecisions(6);
    expect(decisions[0]?.text).toBe(`Approved seller candidate #${id}`);
    expect(decisions.map((d) => d.text)).toContain("Ann Admin changed extra@example.com from Reviewer to Admin");
    const ats = decisions.map((d) => d.at);
    expect([...ats].sort().reverse()).toEqual(ats);
  });
});
