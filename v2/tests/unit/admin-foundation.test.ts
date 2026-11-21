/**
 * Slice 0 (admin foundation) without a database: the 7-day admin session cookie (distinct
 * from the visitor and legacy cookies), the reused code constants, roles + navigation by
 * role, return-path validation, friendly dates, and the rendered shell / cards / shared
 * patterns. Children ride as trailing createElement arguments, never as props.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MINUTES, RESEND_PER_HOUR, RESEND_PER_MINUTE, SESSION_COOKIE } from "@/lib/accounts";
import { ADMIN_COOKIE } from "@/lib/admin-session";
import {
  ADMIN_CODE_MAX_ATTEMPTS,
  ADMIN_CODE_TTL_MINUTES,
  ADMIN_RESEND_PER_HOUR,
  ADMIN_RESEND_PER_MINUTE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DAYS,
  adminSessionCookie,
  clearAdminSessionCookie,
  firstParam,
  formatAdminDate,
  isPrivilegedRole,
  navFor,
  oldestLine,
  roleLabel,
  safeAdminNext,
  timeAgo,
} from "@/lib/admin-auth";
import { ADMIN_CODE_MESSAGES } from "@/lib/services/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { NoAccess } from "@/components/admin/NoAccess";
import { QueueCard } from "@/components/admin/QueueCard";
import { Sheet } from "@/components/admin/Sheet";
import { StatsSnapshot } from "@/components/admin/StatsSnapshot";

const REVIEWER = { name: "Rae Reviewer", email: "rae@example.com", role: "reviewer" };
const ADMIN = { name: "Ann Admin", email: "ann@example.com", role: "admin" };

const pad = (x: number) => String(x).padStart(2, "0");
/** Local-noon ISO for the local day `offset` days from `now` (TZ-robust day math). */
function dayIso(now: Date, offset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
}

describe("admin session cookie", () => {
  it("is a distinct 7-day HttpOnly Secure SameSite=Lax cookie scoped to /admin", () => {
    expect(ADMIN_SESSION_DAYS).toBe(7);
    expect(ADMIN_SESSION_COOKIE).toBe("sf_admin_session");
    expect(ADMIN_SESSION_COOKIE).not.toBe(SESSION_COOKIE);
    expect(ADMIN_SESSION_COOKIE).not.toBe(ADMIN_COOKIE);
    expect(adminSessionCookie("tok")).toBe("sf_admin_session=tok; Path=/admin; Max-Age=604800; HttpOnly; Secure; SameSite=Lax");
    expect(clearAdminSessionCookie()).toBe("sf_admin_session=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  });
});

describe("admin code rules reuse the account code mechanics", () => {
  it("lifetime, attempt limit and resend limits are the shared constants (copy states these, never a hardcoded figure)", () => {
    expect(ADMIN_CODE_TTL_MINUTES).toBe(CODE_TTL_MINUTES);
    expect(ADMIN_CODE_MAX_ATTEMPTS).toBe(CODE_MAX_ATTEMPTS);
    expect(ADMIN_RESEND_PER_MINUTE).toBe(RESEND_PER_MINUTE);
    expect(ADMIN_RESEND_PER_HOUR).toBe(RESEND_PER_HOUR);
  });

  it("wrong/expired code copy is the spec's §7A wording", () => {
    expect(ADMIN_CODE_MESSAGES.code_incorrect).toBe("That code doesn’t match. Check the email and try again.");
    expect(ADMIN_CODE_MESSAGES.code_expired).toBe("That code has expired. Send a new code.");
  });
});

describe("roles and navigation by role", () => {
  it("only reviewer/admin are privileged; labels are the spec's words", () => {
    expect(isPrivilegedRole("reviewer")).toBe(true);
    expect(isPrivilegedRole("admin")).toBe(true);
    expect(isPrivilegedRole("visitor")).toBe(false);
    expect(isPrivilegedRole("")).toBe(false);
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("reviewer")).toBe("Reviewer");
    expect(roleLabel("visitor")).toBe("Visitor");
  });

  it("Accounts is absent from reviewer navigation (Act = absent), present for admin", () => {
    expect(navFor("reviewer").map((i) => i.label)).toEqual(["Home", "Review", "Sellers", "Listings", "Varieties"]);
    expect(navFor("admin").map((i) => i.label)).toEqual(["Home", "Review", "Sellers", "Listings", "Varieties", "Accounts"]);
    expect(navFor("reviewer").some((i) => i.href === "/admin/accounts")).toBe(false);
  });
});

describe("admin shell rendering by role", () => {
  const shell = (viewer: typeof REVIEWER, reviewTotal = 0) => renderToStaticMarkup(createElement(AdminShell, { viewer, section: "home", reviewTotal }, createElement("p", null, "body")));

  it("reviewer output has no Accounts anywhere (nav, tabs, More); admin output links it", () => {
    const reviewer = shell(REVIEWER);
    expect(reviewer).not.toContain("Accounts");
    expect(reviewer).not.toContain("/admin/accounts");
    expect(reviewer).toContain("/admin/review");
    const admin = shell(ADMIN);
    expect(admin).toContain("Accounts");
    expect(admin).toContain('href="/admin/accounts"');
  });

  it("shows identity + role chip, the Review waiting badge, and the admin sign-out", () => {
    const html = renderToStaticMarkup(createElement(AdminShell, { viewer: REVIEWER, section: "review", reviewTotal: 12 }, createElement("p", null, "body")));
    expect(html).toContain("Rae Reviewer");
    expect(html).toContain("rae@example.com");
    expect(html).toContain("Reviewer");
    expect(html).toContain('aria-label="Review, 12 waiting"');
    expect(html).toContain('action="/admin/sign-in/sign-out"');
    expect(html).toContain("Sign out of admin");
    const quiet = shell(REVIEWER, 0);
    expect(quiet).not.toContain("waiting");
  });
});

describe("dashboard pieces", () => {
  it("queue cards show the count + oldest age, or the designed All clear", () => {
    const waiting = renderToStaticMarkup(createElement(QueueCard, { name: "Reports", description: "Visitor reports waiting for a decision", count: 3, oldest: "Oldest: 6 days", href: "/admin/review" }));
    expect(waiting).toContain("Reports");
    expect(waiting).toContain(">3<");
    expect(waiting).toContain("Oldest: 6 days");
    expect(waiting).toContain('href="/admin/review"');
    const clear = renderToStaticMarkup(createElement(QueueCard, { name: "Reports", description: "Visitor reports waiting for a decision", count: 0, oldest: null, href: "/admin/review" }));
    expect(clear).toContain("All clear");
    expect(clear).not.toContain("Oldest:");
  });

  it("the stats snapshot renders the composed no-data state (four cards, no invented numbers)", () => {
    const html = renderToStaticMarkup(createElement(StatsSnapshot));
    for (const label of ["Visitors", "New accounts", "Waitlist signups", "Clicks to sellers"]) expect(html).toContain(label);
    expect(html).toContain("No visits recorded yet — stats begin with the first full day.");
    expect(html).toContain("No account stats yet — they begin with the first full day.");
    expect(html).toContain("No waitlist stats yet — they begin with the first full day.");
    expect(html).toContain("No click stats yet — they begin with the first full day.");
    expect(html).not.toContain("tabular-nums");
  });
});

describe("wrong-role landing", () => {
  it("renders the spec's A4 copy and both ways out, with no admin data", () => {
    const html = renderToStaticMarkup(createElement(NoAccess, { variant: "no-role", name: "Viv Visitor", email: "viv@example.com" }));
    expect(html).toContain("This is the admin section");
    expect(html).toContain("Viv Visitor (viv@example.com), and this account doesn’t have admin access");
    expect(html).toContain("Go to the Seed Directory");
    expect(html).toContain("Sign in with a different email");
    expect(html).not.toContain("/admin/accounts");
  });

  it("reviewer variant names the limit and goes back home", () => {
    const html = renderToStaticMarkup(createElement(NoAccess, { variant: "reviewer-accounts" }));
    expect(html).toContain("Your reviewer role doesn’t include account settings");
    expect(html).toContain("Back to admin home");
    expect(html).not.toContain("Go to the Seed Directory");
  });
});

describe("shared sheet and confirm patterns", () => {
  it("the sheet is a labelled modal dialog with a close action", () => {
    const html = renderToStaticMarkup(createElement(Sheet, { title: "Edit seller", onClose: vi.fn() }, createElement("p", null, "fields")));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Edit seller");
    expect(html).toContain("fields");
    expect(html).toContain('aria-label="Close"');
  });

  it("the confirm pairs Cancel with the danger-filled verb button", () => {
    const html = renderToStaticMarkup(createElement(ConfirmDialog, { title: "Remove seller?", consequence: "Their page comes off the public site.", verb: "Remove seller", onConfirm: vi.fn(), onCancel: vi.fn() }));
    expect(html).toContain("Remove seller?");
    expect(html).toContain("Their page comes off the public site.");
    expect(html).toContain("Cancel");
    expect(html).toContain("btn btn-danger");
    expect(html).toContain(">Remove seller<");
  });
});

describe("return path validation", () => {
  it("accepts internal admin paths, rejects everything else (no open redirect)", () => {
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin/review")).toBe("/admin/review");
    expect(safeAdminNext("/admin/review?x=1")).toBe("/admin/review?x=1");
    for (const bad of [null, undefined, "", 42, "/variety/x", "https://evil.test/admin", "//evil.test/admin", "/admin\\evil", "/administrator/x", "/ admin", "javascript:alert(1)"]) {
      expect(safeAdminNext(bad)).toBeNull();
    }
  });

  it("reads the first query value", () => {
    expect(firstParam(undefined)).toBeNull();
    expect(firstParam("a")).toBe("a");
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam([])).toBeNull();
  });
});

describe("friendly admin dates", () => {
  const now = new Date(2026, 10, 21, 12, 0, 0);

  it("formats calendar dates, never ISO", () => {
    expect(formatAdminDate("2026-11-20T03:14:00.000Z")).toBe("Nov 20, 2026");
    expect(formatAdminDate("2026-11-21T12:00:00")).toBe("Nov 21, 2026");
    expect(formatAdminDate(null)).toBe("");
    expect(formatAdminDate("garbage")).toBe("");
  });

  it("writes the queue-card age line", () => {
    expect(oldestLine(null, now)).toBeNull();
    expect(oldestLine(dayIso(now, 0), now)).toBe("Oldest: today");
    expect(oldestLine(dayIso(now, -1), now)).toBe("Oldest: 1 day");
    expect(oldestLine(dayIso(now, -6), now)).toBe("Oldest: 6 days");
  });

  it("writes relative times for decision rows", () => {
    expect(timeAgo(new Date(now.getTime() - 30_000).toISOString(), now)).toBe("just now");
    expect(timeAgo(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe("3 hours ago");
    expect(timeAgo(dayIso(now, -1), now)).toBe("yesterday");
    expect(timeAgo(dayIso(now, -3), now)).toBe("3 days ago");
    expect(timeAgo(dayIso(now, -30), now)).toBe(formatAdminDate(dayIso(now, -30)));
    expect(timeAgo(null, now)).toBe("");
  });
});
