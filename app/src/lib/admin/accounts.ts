/**
 * Accounts section — ported from v2/lib/admin/accounts.ts (Slice C): list params, shown names, the G2 role copy (spec §7 G2,
 * quoted exactly), confirm lines, and status wording. Pure functions only — pages, the
 * actions handler, services and tests share them. "Now" always arrives as an argument,
 * never from the clock.
 */

/** Initial list window (≤ 50); "Show more" appends one window at a time. */
export const ACCOUNT_WINDOW = 50;

export interface AccountListParams {
  q: string | null;
  show: number;
}

export function parseAccountListParams(sp: { q?: string | null; show?: string | null }): AccountListParams {
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 120) : null;
  const n = /^\d{1,4}$/.test(sp.show ?? "") ? Number(sp.show) : ACCOUNT_WINDOW;
  const show = Math.min(500, Math.max(ACCOUNT_WINDOW, Math.ceil(n / ACCOUNT_WINDOW) * ACCOUNT_WINDOW));
  return { q, show };
}

/** Shown name = displayName, else name, else the email (resolution 13). */
export function shownName(u: { displayName: string | null; name: string | null; email: string }): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  if (u.name?.trim()) return u.name.trim();
  return u.email;
}

// ─── G2 role panel (spec §7 G2 — the radio cards quote the spec exactly) ─────

export const ACCOUNT_ROLES = ["visitor", "reviewer", "admin"] as const;

export type AccountRoleValue = (typeof ACCOUNT_ROLES)[number];

export function isAccountRole(v: unknown): v is AccountRoleValue {
  return v === "visitor" || v === "reviewer" || v === "admin";
}

export const ROLE_CARDS: readonly { value: AccountRoleValue; title: string; words: string }[] = [
  { value: "admin", title: "Admin", words: "Everything: edit sellers, classify, remove, manage roles." },
  {
    value: "reviewer",
    title: "Reviewer",
    words: "Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything — except approving a seller correction, which applies the fix right away.",
  },
  { value: "visitor", title: "Visitor", words: "No admin access. A normal Seed Directory account." },
];

/** The current role as a word: "Visitor — no admin access" / "Reviewer" / "Admin". */
export function currentRoleWords(role: string): string {
  if (role === "visitor") return "Visitor — no admin access";
  if (role === "reviewer") return "Reviewer";
  if (role === "admin") return "Admin";
  return role ? role[0]!.toUpperCase() + role.slice(1) : "Unknown";
}

/** "Admin" / "Reviewer" / "Visitor" for status lines. */
export function roleWord(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "reviewer") return "Reviewer";
  if (role === "visitor") return "Visitor";
  return role ? role[0]!.toUpperCase() + role.slice(1) : "Unknown";
}

/**
 * The panel's history line reads the audit back: "{Role} since {friendly date} · set by
 * {actor}". With no audit row (never changed), the role dates from signup. Dates arrive
 * pre-formatted (Pacific, friendly) so this stays clock-free.
 */
export function roleHistoryLine(entry: { toRole: string; createdAt: string; actor: string } | null, friendlyDate: string | null, joinedDate: string, currentRole: string): string {
  if (entry && friendlyDate) return `${roleWord(entry.toRole)} since ${friendlyDate} · set by ${entry.actor}`;
  return `${roleWord(currentRole)} since ${joinedDate}`;
}

/** The Grant Admin §10.1 confirm names the consequence (resolution 12). */
export function grantAdminConsequence(name: string): string {
  return `${name} will be able to edit and remove sellers and give other people roles.`;
}

/** Self-view: the role controls are absent and this line explains why. */
export const SELF_ROLE_LINE = "You can't change your own role.";

// ─── G2 farm-owner panel ─────────────────────────────────────────────────────

/** The revoke confirm carries the legacy wording (resolution 13). */
export const REVOKE_FARM_OWNER_CONSEQUENCE = "Revoking keeps the account and its waiting lists.";

/** The grant confirm names who becomes whose owner. */
export function grantFarmOwnerConsequence(accountName: string, sellerName: string): string {
  return `${accountName} will be marked as the owner of ${sellerName}.`;
}

/** The account's status in words — display only (resolution 13). */
export function accountStatusWord(status: string): string {
  if (status === "active") return "Active";
  if (status === "banned") return "Banned";
  return status ? status[0]!.toUpperCase() + status.slice(1) : "Unknown";
}

// ─── Account status lines (§10.4 — the actions handler only emits known codes) ─

export type AccountStatusKind = "role_changed" | "role_unchanged" | "farm_granted" | "farm_revoked" | "save_failed";

export interface AccountStatusLine {
  kind: AccountStatusKind;
  text: string;
}

export function accountStatusLine(params: { status?: string | null; name?: string | null; role?: string | null; seller?: string | null }): AccountStatusLine | null {
  const kind = params.status as AccountStatusKind | null;
  if (!kind) return null;
  const name = params.name?.trim() ? params.name.trim() : "This account";
  switch (kind) {
    case "role_changed":
      return { kind, text: params.role ? `${name} is now ${roleWord(params.role)}.` : `${name}'s role was changed.` };
    case "role_unchanged":
      return { kind, text: "No changes to save." };
    case "farm_granted":
      return { kind, text: params.seller ? `${name} is now the owner of ${params.seller}.` : `${name} is now a farm owner.` };
    case "farm_revoked":
      return { kind, text: "Farm-owner status removed. The account and its waiting lists stay." };
    case "save_failed":
      return { kind, text: "That didn't go through. Nothing was changed — try again." };
    default:
      return null;
  }
}
