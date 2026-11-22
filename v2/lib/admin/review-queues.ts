/**
 * Review queues (Slice A): queue definitions, proposal reading, item labels, decision
 * sentences and status wording. Pure functions only — pages, the decide handler and the
 * services share them. "Now" always arrives as an argument, never from the clock.
 */

export type QueueKey = "duplicates" | "sellers" | "listings" | "reports";

interface QueueDef {
  key: QueueKey;
  /** Pane/list heading. */
  name: string;
  /** One line naming what waits. */
  description: string;
  /** The review item types folded into this queue, in display order. */
  types: string[];
  /** All-clear line (the stem divider + this + the next-queue link). */
  empty: string;
}

/** Fixed decision-urgency order (spec C0): duplicates first, reports last. */
export const QUEUES: readonly QueueDef[] = [
  { key: "duplicates", name: "Duplicate varieties", description: "Possible duplicate varieties held for a decision", types: ["duplicate_hold"], empty: "Nothing waiting in Duplicate varieties." },
  { key: "sellers", name: "Seller candidates", description: "Seller candidates from the hunt and Add Your Farm", types: ["seller_candidate"], empty: "Nothing waiting in Seller candidates." },
  { key: "listings", name: "Queued listings", description: "Shop listings waiting to join a variety page", types: ["listing_match", "new_variety"], empty: "Nothing waiting in Queued listings." },
  { key: "reports", name: "Reports", description: "Visitor reports waiting for a decision", types: ["seller_correction", "removal"], empty: "Nothing waiting in Reports." },
];

export function queueDef(key: string): QueueDef | null {
  return QUEUES.find((q) => q.key === key) ?? null;
}

/** Initial list window (≤ 50); "Show more" appends one window at a time. */
export const QUEUE_WINDOW = 25;
/** Decided-history page size (the site's Pagination component). */
export const DECIDED_PAGE_SIZE = 20;

// ─── Item references (deep links) ────────────────────────────────────────────

type ItemKind = "review" | "farm";

export interface ItemRef {
  kind: ItemKind;
  id: number;
}

/** `review-123` / `farm-5` — every queue item's stable address (`?item=`). */
export function itemRefParam(ref: ItemRef): string {
  return `${ref.kind}-${ref.id}`;
}

export function parseItemRef(value: string | null | undefined): ItemRef | null {
  if (!value) return null;
  const m = /^(review|farm)-(\d{1,12})$/.exec(value.trim());
  if (!m) return null;
  const id = Number(m[2]);
  if (id <= 0) return null;
  return { kind: m[1] as ItemKind, id };
}

// ─── Proposals (untrusted JSON — every access is guarded) ────────────────────

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

/** The queue the item belongs to from its type (farm submissions always ride sellers). */
export function queueForType(type: string): QueueKey | null {
  const q = QUEUES.find((d) => d.types.includes(type));
  return q ? q.key : null;
}

// ─── Labels (never bare log-speak when the proposal carries a label) ─────────

export function reportTarget(p: Record<string, unknown>): { type: string; ref: string } {
  const report = asRecord(p.report);
  const type = asString(report.target_type) ?? (typeof p.seller_slug === "string" ? "seller" : "seller");
  const ref = asString(report.target_ref) ?? asString(p.seller_slug) ?? "";
  return { type, ref };
}

export function reportTitle(p: Record<string, unknown>): string {
  const report = asRecord(p.report);
  const kind = asString(report.type);
  const { type } = reportTarget(p);
  if (kind === "remove") return "Removal request";
  if (kind === "claim") return "Ownership claim";
  if (kind === "correct") return type === "variety" ? "Variety correction" : "Seller correction";
  return "Report";
}

/** Structured correction fields on a report proposal, if any (free-form probe reports carry none). */
export function correctionFields(p: Record<string, unknown>): Record<string, string | string[] | null> {
  const fields = asRecord(p.fields);
  const out: Record<string, string | string[] | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string" || v === null) out[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v;
  }
  return out;
}

export const CORRECTION_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  location: "Location",
  region: "Region",
  homepage: "Website",
  description: "About",
  orderingNotes: "Ordering notes",
  shipsTo: "Ships to",
};

/** The reporter's words in full, when the proposal carries them. */
export function reportMessage(p: Record<string, unknown>): string | null {
  return asString(asRecord(p.report).message);
}

/** A specific listing the report routes to, when the proposal names one. */
export function reportListingId(p: Record<string, unknown>): number | null {
  return asNumber(p.listing_id);
}

/** Item label for rows, decisions and history — the proposal's own words first. */
export function itemLabel(type: string, p: Record<string, unknown>, id: number): string {
  switch (type) {
    case "listing_match":
    case "new_variety":
      return asString(p.extracted_name) ?? `${type === "listing_match" ? "listing match" : "new variety"} #${id}`;
    case "seller_candidate":
      return asString(p.name) ?? `seller candidate #${id}`;
    case "seller_correction":
    case "removal": {
      const { ref } = reportTarget(p);
      return ref || `report #${id}`;
    }
    case "duplicate_hold":
      return asString(p.held_name) ?? `duplicate hold #${id}`;
    default:
      return `item #${id}`;
  }
}

/** "Why the machine matched it" in plain words — crop agreement is always stated. */
export function matchLine(p: Record<string, unknown>): string {
  const match = asRecord(p.match);
  const method = asString(match.method);
  const confidence = typeof match.confidence === "number" ? match.confidence : null;
  const candidates = Array.isArray(match.candidates) ? match.candidates.filter((c): c is string => typeof c === "string") : [];
  const crop = asString(p.crop);
  const parts: string[] = [];
  if (method === "model") parts.push("The model matched this listing");
  else if (method === "exact") parts.push("The listing names this variety exactly");
  else if (method === "synonym") parts.push("The listing uses another name for this variety");
  else if (method === "human") parts.push("A person matched this listing");
  else parts.push("The machine matched this listing");
  if (confidence !== null) parts.push(`confidence ${Math.round(confidence * 100)}%`);
  if (crop) parts.push(`the crop agrees (${crop})`);
  else parts.push("the crop could not be checked");
  if (candidates.length > 0) parts.push(`other candidates: ${candidates.slice(0, 3).join(", ")}`);
  return parts.join("; ") + ".";
}

// ─── Decision sentences (home Recent decisions, §7 B) ────────────────────────

const VERBS: Record<string, string> = { approved: "approved", rejected: "declined", merged: "merged" };
const VERBS_CAPITALIZED: Record<string, string> = { approved: "Approved", rejected: "Declined", merged: "Merged" };

/**
 * "{Name} approved {item}" in plain words. Legacy rows (no decider, no label) keep the old
 * honest wording ("Approved seller candidate #12") — never an invented name.
 */
export function decisionSentence(r: { id: number; type: string; proposal: Record<string, unknown>; status: string; decidedByName: string | null }): string {
  const name = r.decidedByName?.trim() || null;
  const lead = (verb: string) => (name ? `${name} ${verb} ` : `${verb[0]!.toUpperCase()}${verb.slice(1)} `);
  if (r.type === "duplicate_hold") {
    const held = asString(r.proposal.held_name) ?? `hold #${r.id}`;
    if (r.status === "merged") {
      const existing = asString(asRecord(r.proposal.candidate).name) ?? "its match";
      return name ? `${name} marked '${held}' a duplicate of '${existing}'` : `Marked '${held}' a duplicate of '${existing}'`;
    }
    return `${lead("added")}'${held}' as its own variety`;
  }
  if (r.type === "seller_correction" && r.status === "approved") {
    const { ref } = reportTarget(r.proposal);
    return `${lead("applied")}a correction to ${ref || `report #${r.id}`}`;
  }
  if (r.type === "removal" && r.status === "approved") {
    const { ref } = reportTarget(r.proposal);
    return `${lead("removed")}${ref || `report #${r.id}`}`;
  }
  const verb = VERBS[r.status] ?? r.status;
  if (!name) return `${VERBS_CAPITALIZED[r.status] ?? r.status} ${itemLabel(r.type, r.proposal, r.id)}`;
  return `${name} ${verb} ${itemLabel(r.type, r.proposal, r.id)}`;
}

export function farmDecisionSentence(r: { farmName: string; status: string; reviewedBy: string | null }): string {
  const name = r.reviewedBy?.trim() || null;
  const verb = r.status === "approved" ? "approved" : "declined";
  return name ? `${name} ${verb} ${r.farmName}` : `${verb[0]!.toUpperCase()}${verb.slice(1)} ${r.farmName}`;
}

/** Decided-segment outcome in plain words. */
export function outcomeLabel(type: string, status: string, p: Record<string, unknown>): string {
  if (type === "duplicate_hold" && status === "merged") {
    const existing = asString(asRecord(p.candidate).name);
    return existing ? `Marked a duplicate of '${existing}'` : "Marked a duplicate";
  }
  if (type === "duplicate_hold" && status === "approved") return "Added as its own variety";
  if (type === "seller_correction" && status === "approved") return "Correction applied";
  if (type === "removal" && status === "approved") return "Removal applied";
  if (type === "farm_submission" || status === "approved") return status === "approved" ? "Approved" : "Declined";
  if (status === "rejected") return "Declined";
  if (status === "merged") return "Merged";
  return status;
}

// ─── Friendly ages ("3 days" — never ISO) ────────────────────────────────────

function ymd(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Whole calendar days from the ISO day to `now`'s local day ("3 days", "today"). */
export function ageWords(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const d = ymd(iso);
  if (!d) return "";
  const DAY_MS = 86_400_000;
  const thenDay = Math.floor(Date.UTC(d.year, d.month - 1, d.day) / DAY_MS);
  const todayDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
  const n = Math.max(0, todayDay - thenDay);
  if (n === 0) return "today";
  return n === 1 ? "1 day" : `${n} days`;
}

// ─── Verified / seen lines ───────────────────────────────────────────────────

export function verifiedLine(name: string | null | undefined): string | null {
  return name ? `Verified by ${name} — waiting for an admin` : null;
}

// ─── Status lines (decisions resolve to these, role="status") ─────────────────

type StatusKind =
  | "seller_created"
  | "candidate_declined"
  | "farm_declined"
  | "published"
  | "listing_rejected"
  | "duplicate_kept"
  | "variety_added"
  | "hold_skipped"
  | "correction_applied"
  | "report_dismissed"
  | "report_verified"
  | "removal_applied"
  | "listing_retired"
  | "already_decided"
  | "stale_candidate"
  | "failed";

export interface StatusLine {
  kind: StatusKind;
  text: string;
  /** Deep link rendered beside the line (the Sellers handoff). */
  href?: string;
  hrefLabel?: string;
}

/**
 * Status wording from the redirect params (the decide handler only ever emits known codes
 * with plain labels — nothing raw reaches the pane, §10.2).
 */
export function statusLine(params: Record<string, string | null | undefined>): StatusLine | null {
  const kind = params.status as StatusKind | null;
  if (!kind) return null;
  const q = (k: string) => params[k] ?? "";
  switch (kind) {
    case "seller_created":
      return { kind, text: "Seller created — finish their details in Sellers", href: "/admin/sellers", hrefLabel: "Open Sellers" };
    case "candidate_declined":
      return { kind, text: q("name") ? `Declined ${q("name")}. The reason is kept on the record.` : "Candidate declined. The reason is kept on the record." };
    case "farm_declined":
      return { kind, text: q("name") ? `Declined ${q("name")}. The reason is kept on the record.` : "Submission declined. The reason is kept on the record." };
    case "published":
      return { kind, text: q("variety") ? `Published on ${q("variety")}'s public page.` : "Listing published." };
    case "listing_rejected":
      return { kind, text: "Listing rejected. The reason is kept on the record." };
    case "duplicate_kept":
      return { kind, text: q("existing") ? `Kept as another name for '${q("existing")}'.` : "Kept as another name." };
    case "variety_added":
      return { kind, text: q("held") ? `Added '${q("held")}' as its own variety.` : "Added as its own variety." };
    case "hold_skipped":
      return { kind, text: "Skipped for now — still waiting." };
    case "correction_applied":
      return { kind, text: q("seller") ? `Correction applied to ${q("seller")}.` : "Correction applied." };
    case "report_dismissed":
      return { kind, text: "Report dismissed. The reason is kept on the record." };
    case "report_verified":
      return { kind, text: `Verified — waiting for an admin.` };
    case "removal_applied":
      return { kind, text: q("seller") ? `Removed ${q("seller")} from the directory.` : "Seller removed." };
    case "listing_retired":
      return { kind, text: q("variety") ? `Listing retired from '${q("variety")}'s page.` : "Listing retired." };
    case "already_decided":
      return q("name") ? { kind, text: `That one was already decided by ${q("name")}.` } : { kind, text: "That one was already decided." };
    case "stale_candidate":
      return { kind, text: "That variety changed while you were deciding — here is the latest." };
    case "failed":
      return { kind, text: "That didn't go through. Try again." };
    default:
      return null;
  }
}

// ─── Reason sheets ───────────────────────────────────────────────────────────

/** The C3/C5 reason selects (kept on the record with the decision). */
export const LISTING_REJECT_REASONS = ["Wrong variety", "Not seed", "Dead link", "Other"] as const;
export const RETIRE_REASONS = ["Wrong variety", "Not seed", "Dead link", "Duplicate listing", "Other"] as const;

/** One record line from a select value + an optional note ("Wrong variety — sold as …"). */
export function composeReason(select: string | null | undefined, note: string | null | undefined): string | null {
  const s = select?.trim() || null;
  const n = note?.trim() || null;
  if (s && n) return `${s} — ${n}`.slice(0, 500);
  return (s ?? n)?.slice(0, 500) ?? null;
}
