/**
 * Slice 8 error monitoring: client + server error capture to the
 * configured sink (SEEDS_ERROR_SINK_URL), with PII, price, account, and
 * credential data redacted before anything leaves the process and payloads
 * bounded. The sink receives facts about failures — never user data.
 *
 * Redaction coverage (all tested): email addresses, phone-number shapes,
 * one-time codes, tokens/secrets/session cookies, price-shaped strings
 * ($ amounts, price* keys), and account/contact keys at any depth.
 * Packet sizes ("25 seeds") are not prices and pass through.
 */
export const ERROR_REPORT_MAX_BYTES = 8192;
const MAX_STRING = 2000;
const MAX_DEPTH = 6;
const MAX_KEYS = 50;

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Loose phone shapes (E.164-ish, NANP with separators, bare 10-digit runs are left alone). */
const PHONE_PATTERNS = [/\+?\d[\d .()/-]{7,}\d/g];
/** `code=VALUE` first (so "verify code=…" redacts the value, not the word "code"). */
const CODE_EQUALS_PATTERN = /\b(code|otp)\s*[=:]\s*['"]?[A-Za-z0-9-]{4,}['"]?/gi;
const CODE_BARE_PATTERN = /\bverify\s+['"]?[A-Za-z0-9-]{4,}['"]?/gi;
const TOKEN_PATTERN = /\b(token|secret|session|password|authorization)[=: ]\s*['"]?[^\s'";,}]+['"]?/gi;
const COOKIE_PATTERN = /\b[a-zA-Z_][a-zA-Z0-9_]*session[a-zA-Z0-9_]*=[^\s;,}]+/gi;
const PRICE_PATTERN = /\$\d[\d,]*(?:\.\d+)?/g;
const PRICE_KEY_PATTERN = /\b[a-zA-Z_]*price[a-zA-Z_]*[=:]\s*['"]?[^\s'";,}]+['"]?/gi;

/** Redact PII/credential/price substrings in free text (messages, stacks). */
export function redactErrorText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[email]")
    .replace(CODE_EQUALS_PATTERN, "[code]")
    .replace(CODE_BARE_PATTERN, "[code]")
    .replace(TOKEN_PATTERN, "[credential]")
    .replace(COOKIE_PATTERN, "[session]")
    .replace(PRICE_PATTERN, "[amount]")
    .replace(PRICE_KEY_PATTERN, "[price]")
    .replace(PHONE_PATTERNS[0]!, (m) => (/[()]/.test(m) || m.replace(/\D/g, "").length >= 10 ? "[phone]" : m));
}

const SENSITIVE_KEY = /(email|e-mail|phone|mobile|sms|address|zip|postal|token|secret|session|password|passwd|auth|code|otp|price|cost|amount|payment|card|account|user_?name|first_?name|last_?name)/i;

/** Deep-redact structured data: sensitive keys → [redacted], strings truncated + text-redacted, cycles safe. */
export function redactErrorData(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") {
    const cut = value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
    return redactErrorText(cut);
  }
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item) => redactErrorData(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value).slice(0, MAX_KEYS);
    for (const [key, entry] of entries) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactErrorData(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  return "[value]";
}

export interface ErrorReportInput {
  name: string;
  message: string;
  stack?: string;
}

export interface ErrorReportContext {
  /** Request path or client URL — the query is stripped (tokens live there). */
  url: string;
  userAgent?: string;
  extra?: unknown;
}

export interface ErrorReport {
  name: string;
  message: string;
  stack: string | null;
  url: string;
  userAgent: string | null;
  extra: unknown;
  timestamp: string;
}

/** Build the bounded, redacted report object (never throws on hostile input). */
export function buildErrorReport(input: ErrorReportInput, ctx: ErrorReportContext): ErrorReport {
  let report: ErrorReport;
  try {
    const path = ctx.url.split("?")[0] ?? ctx.url;
    report = {
      name: String(input.name ?? "Error").slice(0, 120),
      message: redactErrorText(String(input.message ?? "").slice(0, MAX_STRING)),
      stack: input.stack ? redactErrorText(String(input.stack).slice(0, MAX_STRING)) : null,
      url: path.slice(0, 500),
      userAgent: ctx.userAgent ? String(ctx.userAgent).slice(0, 300) : null,
      extra: ctx.extra === undefined ? null : redactErrorData(ctx.extra),
      timestamp: new Date().toISOString(),
    };
  } catch {
    report = {
      name: "Error",
      message: "[unbuildable]",
      stack: null,
      url: "/",
      userAgent: null,
      extra: null,
      timestamp: new Date().toISOString(),
    };
  }
  // Bound the serialized payload: trim the stack first, then the message.
  let serialized = JSON.stringify(report);
  if (serialized.length > ERROR_REPORT_MAX_BYTES && report.stack) {
    report.stack = `${report.stack.slice(0, Math.max(0, ERROR_REPORT_MAX_BYTES - 1024))}…`;
    serialized = JSON.stringify(report);
  }
  if (serialized.length > ERROR_REPORT_MAX_BYTES) {
    report.message = `${report.message.slice(0, 500)}…`;
    report.stack = null;
    report.extra = null;
  }
  return report;
}

/**
 * POST the report to the configured sink. Resolves true on 2xx, false on
 * anything else — and never throws (monitoring must not break serving).
 */
export async function postErrorReport(sinkUrl: string, report: ErrorReport, opts?: { timeoutMs?: number }): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 3000);
    try {
      const res = await fetch(sinkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        signal: controller.signal,
      });
      return res.status >= 200 && res.status < 300;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/**
 * The app's own 500 page for catastrophic failures (renderPage itself
 * throwing — past Vike's _error handling): the same copy as the _error
 * page's generic form, as static HTML. US spelling; no prices; no PII.
 */
export function own500Html(): string {
  return [
    "<!doctype html>",
    '<html lang="en-US">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Something went wrong | seeds.hues.flowers</title>",
    '<meta name="robots" content="noindex">',
    "</head>",
    "<body>",
    "<main>",
    "<h1>Seed Directory</h1>",
    "<p>This page could not be loaded.</p>",
    '<p><a href="/">Back to the start</a></p>',
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
