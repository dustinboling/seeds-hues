/**
 * Listings section — ported from v2/lib/admin/listings.ts (Slice C): status words, list params, event words, retire reasons and
 * status wording. Pure functions only — pages, the actions handler, services and tests
 * share them. "Now" always arrives as an argument, never from the clock.
 */

export type ListingChip = "all" | "active" | "sold_out" | "retired";

/** Initial list window (≤ 50); "Show more" appends one window at a time. */
export const LISTING_WINDOW = 50;

export interface ListingVisibility {
  status: string;
  availability: string | null;
  deletedAt: string | null;
  sellerEligibility: string;
  sellerStatus: string;
  sellerListingPolicy: string;
  sellerDeletedAt: string | null;
}

/**
 * Publicly visible — the listing's own predicate (catalog-read's visibleListing) AND the
 * seller's (visibleSeller): a published listing from an inactive seller is not visible.
 */
export function isListingPubliclyVisible(l: ListingVisibility): boolean {
  if (l.status !== "active" && l.status !== "published") return false;
  if (l.deletedAt !== null) return false;
  return l.sellerEligibility === "approved" && l.sellerStatus === "active" && l.sellerListingPolicy !== "removed" && l.sellerDeletedAt === null;
}

/**
 * A listing's status word (Hue resolution 5): removed → "Retired"; publicly visible +
 * availability sold_out → "Sold out"; publicly visible → "Active"; otherwise the status
 * in plain words.
 */
export function statusWordForListing(l: ListingVisibility): string {
  if (l.status === "removed") return "Retired";
  const availability = l.availability ?? "unknown";
  if (isListingPubliclyVisible(l)) return availability === "sold_out" ? "Sold out" : "Active";
  return l.status ? l.status[0]!.toUpperCase() + l.status.slice(1) : "Unknown";
}

export interface ListingListParams {
  q: string | null;
  chip: ListingChip;
  seller: string | null;
  variety: string | null;
  show: number;
}

export function parseListingChip(v: string | null | undefined): ListingChip {
  return v === "active" || v === "sold_out" || v === "retired" ? v : "all";
}

function parseSlug(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().slice(0, 160);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t) ? t : null;
}

export function parseListingListParams(sp: { q?: string | null; chip?: string | null; seller?: string | null; variety?: string | null; show?: string | null }): ListingListParams {
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 120) : null;
  const n = /^\d{1,4}$/.test(sp.show ?? "") ? Number(sp.show) : LISTING_WINDOW;
  const show = Math.min(500, Math.max(LISTING_WINDOW, Math.ceil(n / LISTING_WINDOW) * LISTING_WINDOW));
  return { q, chip: parseListingChip(sp.chip), seller: parseSlug(sp.seller), variety: parseSlug(sp.variety), show };
}

// ─── E2 history (resolution 4: plain words + actor + reason) ─────────────────

export interface ListingHistoryEvent {
  event: string;
  reason: string | null;
  actor: string | null;
}

/** first_seen → "Published", sold_out → "Marked sold out", restocked → "Back in stock", gone → "Retired", restored → "Restored". */
export function listingEventWord(event: string): string {
  switch (event) {
    case "first_seen":
      return "Published";
    case "sold_out":
      return "Marked sold out";
    case "restocked":
      return "Back in stock";
    case "gone":
      return "Retired";
    case "restored":
      return "Restored";
    default:
      return event ? event[0]!.toUpperCase() + event.slice(1) : "Unknown";
  }
}

/**
 * One history line — "{Word} {friendly date/time}" plus "· by {actor}" when an actor is
 * recorded and "— reason: {reason}" on gone events that carry one. The date/time arrives
 * pre-formatted (Pacific, friendly) so this stays clock-free.
 */
export function listingEventLine(e: ListingHistoryEvent, dateTime: string): string {
  let line = `${listingEventWord(e.event)} ${dateTime}`;
  if (e.actor) line += ` · by ${e.actor}`;
  if (e.event === "gone" && e.reason) line += ` — reason: ${e.reason}`;
  return line;
}

// ─── E2 retire (resolution 8) ───────────────────────────────────────────────

export const RETIRE_REASONS = ["Wrong variety", "Not seed", "Dead link", "Duplicate listing", "Other"] as const;

export type RetireReason = (typeof RETIRE_REASONS)[number];

export function isRetireReason(v: unknown): v is RetireReason {
  return typeof v === "string" && (RETIRE_REASONS as readonly string[]).includes(v);
}

/** The stored reason: the chosen label, with the note appended as "{label} — {note}". */
export function composeRetireReason(label: RetireReason, note: string | null | undefined): string {
  const t = typeof note === "string" ? note.trim() : "";
  return t ? `${label} — ${t}` : label;
}

/** The §10.1 consequence copy (resolution 8 — names the variety the listing leaves). */
export function retireConsequence(varietyName: string): string {
  return `This listing will come off '${varietyName}'s page. The seller's other listings stay.`;
}

// ─── Listing status lines (§10.4 — the actions handler only emits known codes) ─

export type ListingStatusKind = "retired" | "restored" | "restore_skipped" | "save_failed";

export interface ListingStatusLine {
  kind: ListingStatusKind;
  text: string;
}

export function listingStatusLine(params: { status?: string | null; variety?: string | null }): ListingStatusLine | null {
  const kind = params.status as ListingStatusKind | null;
  if (!kind) return null;
  const variety = params.variety?.trim() ? params.variety.trim() : null;
  switch (kind) {
    case "retired":
      return { kind, text: variety ? `Retired — it is off '${variety}'s page.` : "Listing retired." };
    case "restored":
      return { kind, text: variety ? `Restored — it is back on '${variety}'s page.` : "Listing restored." };
    case "restore_skipped":
      return { kind, text: "That listing wasn't retired — nothing was changed." };
    case "save_failed":
      return { kind, text: "That didn't go through. Nothing was changed — try again." };
    default:
      return null;
  }
}
