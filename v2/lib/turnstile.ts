/**
 * Cloudflare Turnstile, server side (USER-ACCOUNTS-DESIGN §3): every human-only form (account
 * creation, sign-in, waiting-list signup, Add Your Farm) POSTs its token to siteverify before
 * anything is processed. A missing or invalid token is a 403.
 *
 * Keys: the secret is the Worker secret TURNSTILE_SECRET_KEY (`wrangler secret put`, or
 * .dev.vars locally) — never in the repo. For local dev + tests use Cloudflare's documented
 * public always-pass TEST keys (TURNSTILE_TEST_KEYS below; they are not credentials).
 *
 * If the secret is unset, verification FAILS CLOSED — except under `next dev`
 * (NODE_ENV=development), where it passes as "dev_bypass" so the forms can be exercised without
 * a widget. A built Worker (preview or production) always runs with NODE_ENV=production.
 *
 * (The Phase 1 /report form keeps its own documented "verify only when configured" rule in
 * lib/services/reports.ts.)
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's published always-pass test keys (developers.cloudflare.com/turnstile/troubleshooting/testing/). */
export const TURNSTILE_TEST_KEYS = {
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
} as const;

export type TurnstileOutcome = "verified" | "dev_bypass";

export interface TurnstileConfig {
  secret: string | null;
  fetchFn?: typeof fetch;
  /** Defaults to NODE_ENV === "development". */
  localDev?: boolean;
}

const isLocalDev = () => typeof process !== "undefined" && process.env.NODE_ENV === "development";

/** Raw check: true only when siteverify answers success for this token. */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null, cfg: TurnstileConfig): Promise<boolean> {
  return (await turnstileOutcome(token, ip, cfg)) !== null;
}

/** "verified" | "dev_bypass" when the submission may proceed, null when it must be refused. */
export async function turnstileOutcome(token: string | null | undefined, ip: string | null, cfg: TurnstileConfig): Promise<TurnstileOutcome | null> {
  if (!cfg.secret) return (cfg.localDev ?? isLocalDev()) ? "dev_bypass" : null;
  if (!token || token.length > 2048) return null;
  const form = new URLSearchParams({ secret: cfg.secret, response: token });
  if (ip) form.set("remoteip", ip);
  try {
    const res = await (cfg.fetchFn ?? fetch)(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const out = (await res.json().catch(() => ({}))) as { success?: boolean };
    return out.success === true ? "verified" : null;
  } catch {
    return null;
  }
}

/** The friendly, accessible refusal text (design §3). */
export const TURNSTILE_REFUSAL = "We couldn’t verify that you’re a person — please try again.";
