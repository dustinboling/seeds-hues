/**
 * Account primitives shared by the services and route layers (USER-ACCOUNTS-DESIGN §2/§2a/§5).
 * Pure functions + WebCrypto only (no Node built-ins), so all of it runs in the Worker.
 *
 * Sign-in model (locked): an account is name + email + phone (+ ZIP). Sign-in is the email +
 * phone pair — NO password and NO sign-in codes. The 6-digit codes here are ONLY the one-time
 * email / alert-number ownership checks and never take part in signing in.
 */
import { sha256Hex } from "@/lib/api/http";

export const SESSION_COOKIE = "sf_session";
export const SESSION_DAYS = 30;
export const CODE_TTL_MINUTES = 30;
export const CODE_MAX_ATTEMPTS = 5;
/** Resend limits per user and channel: 1 per minute, 5 per hour (codes issued, incl. the first). */
export const RESEND_PER_MINUTE = 1;
export const RESEND_PER_HOUR = 5;
/** Sign-in failures: 5 per 15 min per IP; per pair, a lockout that doubles from 15 min. */
export const SIGNIN_IP_LIMIT = 5;
export const SIGNIN_WINDOW_MINUTES = 15;
export const SIGNIN_PAIR_FREE_FAILURES = 5;

export const SIGNIN_GENERIC_ERROR = "We couldn’t find that email + phone pair";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** US numbers only: digits, a leading country code 1 dropped → exactly 10 digits, else null. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return d;
}

/** "(541) 555-0123" for the account owner's own view (never public). */
export function formatPhone(d: string): string {
  return /^\d{10}$/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}

/** Last two digits only, for messages that confirm a number ("ending in 23"). */
export const phoneTail = (d: string) => d.slice(-2);

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A raw 256-bit session token (the cookie value). Only sha256Hex(token) is stored. */
export function newSessionToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}
export const hashSessionToken = (token: string) => sha256Hex(`session:${token}`);
export const isSessionTokenShape = (t: string | null | undefined): t is string => typeof t === "string" && /^[\w-]{43}$/.test(t);

export function sessionCookie(token: string, maxAgeSeconds = SESSION_DAYS * 86_400): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}

/** Uniform crypto-random 6-digit code (rejection sampling, no modulo bias). */
export function newVerificationCode(): string {
  const buf = new Uint32Array(1);
  const limit = 4_294_000_000; // largest multiple of 1e6 below 2^32
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return String(buf[0]! % 1_000_000).padStart(6, "0");
  }
}
export function newSalt(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const hashCode = (salt: string, code: string) => sha256Hex(`${salt}:${code}`);

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** sha256 key for rate-limit rows — never the IP / phone itself. */
export const attemptKey = (kind: "ip" | "pair", value: string) => sha256Hex(`attempt:${kind}:${value}`);

// ─── Signed unsubscribe tokens (no sign-in needed) ──────────────────────────

export type UnsubscribeScope = { kind: "variety"; userId: number; varietyId: number } | { kind: "all"; userId: number };

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

/** `u{userId}.v{varietyId}|all` + "." + base64url HMAC-SHA256. */
export async function signUnsubscribe(key: string, s: UnsubscribeScope): Promise<string> {
  const body = s.kind === "all" ? `u${s.userId}.all` : `u${s.userId}.v${s.varietyId}`;
  return `${body}.${b64url(await hmac(key, `unsubscribe:${body}`))}`;
}

export async function verifyUnsubscribe(key: string, token: string): Promise<UnsubscribeScope | null> {
  const m = /^u(\d{1,12})\.(all|v(\d{1,12}))\.([\w-]{43})$/.exec(token.trim());
  if (!m) return null;
  const body = `u${m[1]}.${m[2]}`;
  const expected = b64url(await hmac(key, `unsubscribe:${body}`));
  const given = fromB64url(m[4]!);
  if (!given || !sameDigest(expected, m[4]!)) return null;
  const userId = Number(m[1]);
  return m[2] === "all" ? { kind: "all", userId } : { kind: "variety", userId, varietyId: Number(m[3]) };
}

/** Dev/test signing key when UNSUBSCRIBE_SIGNING_KEY is unset. Production mail requires the real secret. */
export const DEV_UNSUBSCRIBE_KEY = "seeds-dev-unsubscribe-key-not-secret";
