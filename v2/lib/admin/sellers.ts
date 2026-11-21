/**
 * Sellers section (Slice B): status words, list params, ships-to parsing and status wording.
 * Pure functions only — pages, the actions handler and the services share them. "Now" always
 * arrives as an argument, never from the clock.
 */

export type BadgeFilter = "all" | "small" | "not_small";
export type ListingStateFilter = "all" | "active" | "not_active";
export type SellerSort = "name" | "listings" | "updated";

/** A row's status word (Hue resolution 3): Candidate / Active / Not active. */
export type SellerStatusWord = "Candidate" | "Active" | "Not active";

export interface SellerVisibility {
  eligibility: string;
  status: string;
  listingPolicy: string;
  deletedAt: string | null;
}

/**
 * Publicly listed — the exact public predicate (catalog-read's visibleSeller): approved AND
 * active AND not removed AND not deleted. D1's Active chip and the Active status word both
 * key off this; a status → inactive flip hides the seller through this same predicate
 * (Hue resolution 2), with no public-layer change.
 */
export function isPubliclyListed(s: SellerVisibility): boolean {
  return s.eligibility === "approved" && s.status === "active" && s.listingPolicy !== "removed" && s.deletedAt === null;
}

/** Resolution 3: Candidate (eligibility candidate — "not listed publicly"); Active (publicly listed); Not active (everyone else not publicly listed). */
export function statusWordFor(s: SellerVisibility): SellerStatusWord {
  if (s.eligibility === "candidate") return "Candidate";
  return isPubliclyListed(s) ? "Active" : "Not active";
}

export interface SellerListParams {
  q: string | null;
  badge: BadgeFilter;
  state: ListingStateFilter;
  sort: SellerSort;
}

export function parseBadgeFilter(v: string | null | undefined): BadgeFilter {
  return v === "small" || v === "not_small" ? v : "all";
}

export function parseListingStateFilter(v: string | null | undefined): ListingStateFilter {
  return v === "active" || v === "not_active" ? v : "all";
}

export function parseSellerSort(v: string | null | undefined): SellerSort {
  return v === "listings" || v === "updated" ? v : "name";
}

export function parseSellerListParams(sp: { q?: string | null; badge?: string | null; state?: string | null; sort?: string | null }): SellerListParams {
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 120) : null;
  return { q, badge: parseBadgeFilter(sp.badge), state: parseListingStateFilter(sp.state), sort: parseSellerSort(sp.sort) };
}

// ─── Ships to (resolution 6: one text field of comma-separated region codes) ──

/** "US, CA" → ["US", "CA"]; empty → ["unknown"] (the stored JSON convention). */
export function parseShipsTo(text: string): string[] {
  const codes = text
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((c) => c.slice(0, 10));
  return codes.length > 0 ? [...new Set(codes)].slice(0, 60) : ["unknown"];
}

/** The stored JSON back to field text: ["unknown"] shows as an empty field. */
export function formatShipsTo(stored: string | null | undefined): string {
  if (!stored) return "";
  try {
    const v: unknown = JSON.parse(stored);
    if (!Array.isArray(v)) return "";
    const codes = v.filter((c): c is string => typeof c === "string");
    if (codes.length === 0 || (codes.length === 1 && codes[0] === "unknown")) return "";
    return codes.join(", ");
  } catch {
    return "";
  }
}

/** "US, CA" / "Unknown" for the read-only definition list. */
export function shipsToWords(stored: string | null | undefined): string {
  const text = formatShipsTo(stored);
  return text ? text : "Unknown";
}

const PLATFORM_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", squarespace: "Squarespace", other: "Other" };

/** "Shopify" / … — the raw value when the record carries something unexpected. */
export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return "Not set";
  return PLATFORM_LABELS[platform] ?? platform;
}

/** "Admin" / "Reviewer" — the note author line. Unknown roles render raw, never blank. */
export function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "reviewer") return "Reviewer";
  return role ? role[0]!.toUpperCase() + role.slice(1) : "Unknown";
}

// ─── D3 changed-field status lines (§10.4, built from the changed-field list) ─

/** The general admin update's field set (resolution 1): CORRECTABLE plus type, platform, country, contactEmail. */
export const SELLER_UPDATE_FIELDS = ["name", "type", "platform", "homepage", "contactEmail", "location", "region", "country", "shipsTo", "description", "orderingNotes"] as const;

export type SellerUpdateField = (typeof SELLER_UPDATE_FIELDS)[number];

export const SELLER_FIELD_LABELS: Record<SellerUpdateField, string> = {
  name: "Name",
  type: "Seller type",
  platform: "Platform",
  homepage: "Website",
  contactEmail: "Contact email",
  location: "Location",
  region: "Region",
  country: "Country",
  shipsTo: "Ships to",
  description: "Description",
  orderingNotes: "Ordering notes",
};

function displayValue(field: SellerUpdateField, value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = field === "shipsTo" ? formatShipsTo(value) : value.trim();
  if (!v) return null;
  return v.length > 120 ? `${v.slice(0, 120)}…` : v;
}

/**
 * "Location updated to Greenwood, SC." — one field names its new value; several name
 * themselves ("Name, Location updated."); none is the no-op save ("No changes to save.").
 * `values` carries the saved raw values keyed by field (shipsTo as stored JSON).
 */
export function editStatusLine(changed: string[], values: Record<string, string | null | undefined>): string {
  const known = changed.filter((f): f is SellerUpdateField => f in SELLER_FIELD_LABELS);
  if (known.length === 0) return "No changes to save.";
  if (known.length === 1) {
    const field = known[0]!;
    const label = SELLER_FIELD_LABELS[field];
    const display = displayValue(field, values[field]);
    return display ? `${label} updated to ${display}.` : `${label} updated.`;
  }
  return `${known.map((f) => SELLER_FIELD_LABELS[f]).join(", ")} updated.`;
}

/** D4 success: the panel line, plus the public-listing line when a candidate completes (resolution 4). */
export function classificationStatusLine(isSmallFarm: boolean, publishedName: string | null): string {
  const base = isSmallFarm ? "Classified as a small farm — the badge is showing." : "Classified as not a small farm — no badge is shown.";
  return publishedName ? `${base} ${publishedName} is now publicly listed.` : base;
}

// ─── Seller status lines (the actions handler only ever emits known codes) ────

export type SellerStatusKind = "note_added" | "reactivated" | "removed" | "save_failed";

export interface SellerStatusLine {
  kind: SellerStatusKind;
  text: string;
}

export function sellerStatusLine(params: Record<string, string | null | undefined>): SellerStatusLine | null {
  const kind = params.status as SellerStatusKind | null;
  if (!kind) return null;
  const q = (k: string) => params[k] ?? "";
  switch (kind) {
    case "note_added":
      return { kind, text: "Note added." };
    case "reactivated":
      return { kind, text: "Seller reactivated — their page and listings are back on the public site." };
    case "removed":
      return { kind, text: q("name") ? `Removed ${q("name")} from the directory.` : "Seller removed from the directory." };
    case "save_failed":
      return { kind, text: "That didn't go through. Nothing was changed — try again." };
    default:
      return null;
  }
}
