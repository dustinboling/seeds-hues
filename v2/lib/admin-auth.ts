/**
 * Admin section (Slice 0) shared primitives: roles, the admin session cookie, the sign-in
 * code rules (reusing the account code mechanics), navigation by role, and friendly dates.
 * Pure functions only — no Drizzle, no Node built-ins — so pages, routes and tests share it.
 * Role is resolved server-side from the account row; it is never trusted from the client.
 */
import { CODE_MAX_ATTEMPTS, CODE_TTL_MINUTES, RESEND_PER_HOUR, RESEND_PER_MINUTE } from "@/lib/accounts";
import { USER_ROLES } from "@/lib/db/schema";

export type AccountRole = (typeof USER_ROLES)[number];

/** Roles that may hold an admin session. */
export const PRIVILEGED_ROLES: readonly AccountRole[] = ["reviewer", "admin"];

export function isPrivilegedRole(role: string): role is Extract<AccountRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

/** Short role word for chips and prose ("Admin", "Reviewer", "Visitor"). */
export function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "reviewer") return "Reviewer";
  return "Visitor";
}

// ─── Admin session (the elevated layer, distinct from the visitor session) ───

/** Cookie name — distinct from the visitor `sf_session` and the legacy key-paste `sf_admin`. */
export const ADMIN_SESSION_COOKIE = "sf_admin_session";
/** Admin sessions last a week (spec §7A/§8.1: "~1 week", designed as 7 days). */
export const ADMIN_SESSION_DAYS = 7;
export const ADMIN_SESSION_MAX_AGE = ADMIN_SESSION_DAYS * 86_400;

export function adminSessionCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; Max-Age=${ADMIN_SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

const ADMIN_COOKIE_CLEAR = `${ADMIN_SESSION_COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const clearAdminSessionCookie = () => ADMIN_COOKIE_CLEAR;

// ─── Admin sign-in codes (spec §7A): the account code mechanics, reused ───────

/**
 * Code lifetime, attempt limit and resend limits are the account code values — one
 * machinery, so the sign-in copy states these constants (never a hardcoded figure).
 */
export const ADMIN_CODE_TTL_MINUTES = CODE_TTL_MINUTES;
export const ADMIN_CODE_MAX_ATTEMPTS = CODE_MAX_ATTEMPTS;
export const ADMIN_RESEND_PER_MINUTE = RESEND_PER_MINUTE;
export const ADMIN_RESEND_PER_HOUR = RESEND_PER_HOUR;

// ─── Navigation (spec §6; Statistics arrives in Slice D) ─────────────────────

export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
  /** True when the item renders for admins only (absent for reviewers, never disabled). */
  adminOnly: boolean;
}

/** Rail order = tab order = decision priority. Reviewers never see Accounts. */
export const ADMIN_SECTIONS: readonly AdminNavItem[] = [
  { key: "home", label: "Home", href: "/admin", adminOnly: false },
  { key: "review", label: "Review", href: "/admin/review", adminOnly: false },
  { key: "sellers", label: "Sellers", href: "/admin/sellers", adminOnly: false },
  { key: "listings", label: "Listings", href: "/admin/listings", adminOnly: false },
  { key: "varieties", label: "Varieties", href: "/admin/varieties", adminOnly: false },
  { key: "accounts", label: "Accounts", href: "/admin/accounts", adminOnly: true },
];

/** Phone-only destination holding Listings, Varieties, Accounts, identity and sign-out. */
export const ADMIN_MORE: AdminNavItem = { key: "more", label: "More", href: "/admin/more", adminOnly: false };

export type AdminSectionKey = "home" | "review" | "sellers" | "listings" | "varieties" | "accounts" | "more";

/** Role rendering rule (§11): Act = absent — items outside the role are not returned at all. */
export function navFor(role: string): AdminNavItem[] {
  return ADMIN_SECTIONS.filter((s) => !s.adminOnly || role === "admin");
}

// ─── Search params ───────────────────────────────────────────────────────────

/** First value of a query param (Next hands `string | string[] | undefined`). */
export function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ─── Return path ─────────────────────────────────────────────────────────────

/**
 * Accept only internal admin return paths (no open redirect): exactly "/admin" or under
 * "/admin/", with no protocol or backslash. Returns the safe path or null.
 */
export function safeAdminNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return null;
  if (value.includes("\\") || value.includes("://")) return null;
  if (value === "/admin") return value;
  if (value.startsWith("/admin/")) return value;
  return null;
}

// ─── Friendly dates (never an ISO stamp in admin, §2 principle 9) ────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function ymd(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Admin date-times render in the farm's timezone (America/Los_Angeles), via
 * Intl.DateTimeFormat with an explicit timeZone — deterministic across server and
 * client, unlike the local zone. Parsing is manual (never Date.parse on a zone-less
 * string, which the platform reads in its own local zone): an explicit offset wins,
 * and a bare timestamp is read as UTC, the stored convention.
 */
const PT_DATE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });
const PT_TIME = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", hour12: true });

/** Epoch ms for a full timestamp. Null unless the value carries usable time parts. */
function instantMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  let ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const off = m[7];
  if (off && off !== "Z") {
    const sign = off[0] === "+" ? 1 : -1;
    const digits = off.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2, 4));
    if (oh > 23 || om > 59) return null;
    ms -= sign * (oh * 3_600_000 + om * 60_000);
  }
  return ms;
}

/**
 * "Nov 20, 2026" — a full timestamp renders its Pacific calendar day (an afternoon
 * action stays on its own day); a bare date renders as written (it is not an instant).
 * Falls back for a missing or unparseable value.
 */
export function formatAdminDate(iso: string | null | undefined, fallback = ""): string {
  if (!iso) return fallback;
  const ms = instantMs(iso);
  if (ms !== null) return PT_DATE.format(new Date(ms));
  const d = ymd(iso);
  if (!d) return fallback;
  return `${MONTHS[d.month - 1]} ${d.day}, ${d.year}`;
}

/**
 * "Nov 20, 2026 · 2:14 PM" — the admin timestamp (spec D5). Rendered in Pacific from
 * the stored instant; falls back to the date alone when the time part is missing, and
 * to `fallback` when nothing parses.
 */
export function formatAdminDateTime(iso: string | null | undefined, fallback = ""): string {
  if (!iso) return fallback;
  const ms = instantMs(iso);
  if (ms === null) {
    const d = ymd(iso);
    if (!d) return fallback;
    return `${MONTHS[d.month - 1]} ${d.day}, ${d.year}`;
  }
  const at = new Date(ms);
  return `${PT_DATE.format(at)} · ${PT_TIME.format(at)}`;
}

/** Whole calendar days from the ISO day to `now`'s local day (negative → 0). */
function daysSince(iso: string, now: Date): number | null {
  const d = ymd(iso);
  if (!d) return null;
  const DAY_MS = 86_400_000;
  const thenDay = Math.floor(Date.UTC(d.year, d.month - 1, d.day) / DAY_MS);
  const todayDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  return Math.max(0, todayDay - thenDay);
}

/** Queue-card age line: "Oldest: today" / "Oldest: 1 day" / "Oldest: 6 days". Null when unknown. */
export function oldestLine(oldest: string | null | undefined, now: Date = new Date()): string | null {
  if (!oldest) return null;
  const n = daysSince(oldest, now);
  if (n === null) return null;
  if (n === 0) return "Oldest: today";
  return n === 1 ? "Oldest: 1 day" : `Oldest: ${n} days`;
}

/** Friendly relative time for decision rows ("just now", "3 days ago", "Nov 20, 2026"). */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const diffMs = Math.max(0, now.getTime() - at);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = daysSince(iso, now);
  if (days === null) return "";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatAdminDate(iso);
}
