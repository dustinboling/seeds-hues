/**
 * No-JS waitlist floor: the redirect-back URL vocabulary shared by the
 * form-encoded endpoints (which build these URLs) and the variety page
 * (which parses them back into the floor state the block
 * server-renders). Ported from v2/lib/waitlist-floor.ts (Tranche 3.2,
 * SPEC §3.4.2 / Ada Ruling 9) — pure string logic, no Node, no Drizzle.
 *
 * Vocabulary (names and values are the builder's per §3.4.2; the states
 * and copy obligations are the contract's):
 *   ?waitlist=verify                                  joined-and-verify (plain code form, sessioned)
 *   ?waitlist=verify&cerr=<code-error>                verify state with a code error stated
 *   ?waitlist=recognized&email=<addr>                 recognized-contact code state (no session yet)
 *   ?waitlist=recognized&email=<addr>&cerr=<code>     recognized state with a code error stated
 *   ?waitlist=active&channels=<csv>                   joined-and-active
 *   ?waitlist=active&held=1                        joined but held (alerts off at the account)
 *   ?waitlist=error&err=<csv>&email=&channel=&phone=  join error state, entered values preserved
 *
 * Every redirect-back URL ends with #waitlist-block (Ruling 9): failed and
 * successful floor submissions alike land with the block in the initial
 * viewport, no scrolling. `err` carries one or two join-field errors
 * (email_invalid, phone_invalid) so a double failure renders the summary
 * box at the block's head exactly like the enhanced form; single-error
 * codes (already_listed, rate_limited, account_inactive) render as the
 * form-level message.
 */

export const WAITLIST_BLOCK_ID = "waitlist-block";
export const WAITLIST_PARAM = "waitlist";

/** Join-error codes the floor can render (a subset is also API-visible). */
export type FloorJoinError = "email_invalid" | "phone_invalid" | "already_listed" | "rate_limited" | "account_inactive";

/** Code-error codes the floor code forms can render (the API's code vocabulary, floor-side). */
export type FloorCodeError = "code_invalid" | "code_incorrect" | "code_expired" | "code_dead" | "no_code" | "no_pending_join";

export type FloorChannel = "email" | "sms";

export type FloorState =
  | { kind: "resting" }
  | { kind: "verify"; codeError: FloorCodeError | null }
  | { kind: "recognized"; email: string; codeError: FloorCodeError | null }
  | { kind: "active"; channels: FloorChannel[]; held: boolean }
  | { kind: "error"; errors: FloorJoinError[]; email: string; channel: FloorChannel; phone: string };

export const RESTING_FLOOR: FloorState = { kind: "resting" };

const JOIN_ERRORS: readonly FloorJoinError[] = ["email_invalid", "phone_invalid", "already_listed", "rate_limited", "account_inactive"];
const CODE_ERRORS: readonly FloorCodeError[] = ["code_invalid", "code_incorrect", "code_expired", "code_dead", "no_code", "no_pending_join"];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function csv<T extends string>(raw: string | undefined, allow: readonly T[]): T[] {
  if (!raw) return [];
  const out: T[] = [];
  for (const part of raw.split(",")) {
    const v = part.trim() as T;
    if (allow.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

function emailOrEmpty(raw: string | undefined): string {
  const v = (raw ?? "").trim().slice(0, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
}

/**
 * Parse the waitlist floor state back out of a variety page's query
 * string. Unknown values degrade to the resting floor — a hand-typed URL
 * can never produce a broken or misleading state, and the listing-state
 * gate (block only on zero-seller pages) still applies at render.
 */
export function parseFloorState(sp: Record<string, string | string[] | undefined>): FloorState {
  const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
  const kind = first(sp[WAITLIST_PARAM]);
  if (kind === "verify") {
    const cerr = csv(first(sp.cerr), CODE_ERRORS);
    return { kind: "verify", codeError: cerr[0] ?? null };
  }
  if (kind === "recognized") {
    const email = emailOrEmpty(first(sp.email));
    if (!email) return RESTING_FLOOR;
    const cerr = csv(first(sp.cerr), CODE_ERRORS);
    return { kind: "recognized", email, codeError: cerr[0] ?? null };
  }
  if (kind === "active") {
    const channels = csv(first(sp.channels), ["email", "sms"] as const);
    const held = first(sp.held) === "1";
    return { kind: "active", channels, held };
  }
  if (kind === "error") {
    const errors = csv(first(sp.err), JOIN_ERRORS);
    if (!errors.length) return RESTING_FLOOR;
    const channel = first(sp.channel) === "sms" ? "sms" : "email";
    return {
      kind: "error",
      errors,
      email: (first(sp.email) ?? "").slice(0, 320),
      channel,
      phone: (first(sp.phone) ?? "").slice(0, 32),
    };
  }
  return RESTING_FLOOR;
}

function floorQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Build a redirect-back URL for a floor outcome. The variety slug must be
 * slug-shaped; anything else falls back to the site root (a garbage slug
 * has no page to land on, and the visitor must never be stranded on an
 * error page).
 */
export function floorRedirect(varietySlug: string, params: Record<string, string | undefined> & { waitlist: string }): string {
  if (!SLUG.test(varietySlug)) return "/";
  return `/variety/${varietySlug}${floorQuery(params)}#${WAITLIST_BLOCK_ID}`;
}

/**
 * The joined-and-active floor redirect, carrying the true channels. When
 * no channel is active (alerts off at the account — the only way a
 * verified join lands channelless), the held flag rides along so the
 * floor states the hold instead of claiming an alert.
 */
export function activeFloorRedirect(varietySlug: string, channels: readonly string[]): string {
  const csvChannels = channels.filter((c): c is FloorChannel => c === "email" || c === "sms");
  return floorRedirect(varietySlug, { waitlist: "active", channels: csvChannels.join(","), held: csvChannels.length ? undefined : "1" });
}

/** The join-error floor redirect, preserving the entered values and channel selection. */
export function joinErrorRedirect(
  varietySlug: string,
  errors: FloorJoinError[],
  values: { email?: string; channel?: FloorChannel; phone?: string },
): string {
  return floorRedirect(varietySlug, {
    waitlist: "error",
    err: errors.join(","),
    email: values.email ?? "",
    channel: values.channel ?? "email",
    phone: values.phone ?? "",
  });
}
