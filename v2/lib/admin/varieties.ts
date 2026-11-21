/**
 * Varieties section (Slice C): list params, alias labels, danger-zone and confirm copy,
 * and status wording. Pure functions only — pages, the actions handler, services and
 * tests share them. "Now" always arrives as an argument, never from the clock.
 */

export type VarietyTab = "varieties" | "crops";

/** Initial list window (≤ 50); "Show more" appends one window at a time. */
export const VARIETY_WINDOW = 50;

export interface VarietyListParams {
  tab: VarietyTab;
  q: string | null;
  crop: string | null;
  show: number;
}

function parseSlug(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().slice(0, 160);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t) ? t : null;
}

export function parseVarietyListParams(sp: { tab?: string | null; q?: string | null; crop?: string | null; show?: string | null }): VarietyListParams {
  const tab: VarietyTab = sp.tab === "crops" ? "crops" : "varieties";
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 120) : null;
  const n = /^\d{1,4}$/.test(sp.show ?? "") ? Number(sp.show) : VARIETY_WINDOW;
  const show = Math.min(500, Math.max(VARIETY_WINDOW, Math.ceil(n / VARIETY_WINDOW) * VARIETY_WINDOW));
  return { tab, q, crop: parseSlug(sp.crop), show };
}

// ─── F2 aliases (resolution 11; RA-1) ────────────────────────────────────────

export interface AliasLabelInput {
  source: string | null;
  decidedByName: string | null;
}

/**
 * A decision alias is labeled "Added from a duplicate decision · {friendly date} · by
 * {decidedByName}"; every other alias is "another name for this variety". The date arrives
 * pre-formatted (Pacific, friendly) so this stays clock-free.
 */
export function aliasLabel(a: AliasLabelInput, friendlyDate: string | null): string {
  if (a.source === "duplicate_decision") {
    const when = friendlyDate ? ` · ${friendlyDate}` : "";
    const by = a.decidedByName ? ` · by ${a.decidedByName}` : "";
    return `Added from a duplicate decision${when}${by}`;
  }
  return "another name for this variety";
}

/** The add sheet's consequence line (spec F2). */
export const ADD_ALIAS_CONSEQUENCE = "This name will find this variety in search.";

/** The manual-remove §10.1 confirm names the full consequence (resolution 11). */
export const REMOVE_ALIAS_CONSEQUENCE = "This name will stop finding this variety in search, and the scout may propose this variety again under it.";

// ─── F2 danger zone: variety remove (resolutions 1–3) ────────────────────────

/** The block line names the live-listing count (resolution 3's definition). */
export function varietyRemoveBlockLine(liveListings: number): string {
  return liveListings === 1 ? "This variety has 1 live listing. Retire it before removing the variety." : `This variety has ${liveListings} live listings. Retire them before removing the variety.`;
}

/**
 * The remove §10.1 consequence: the page comes off, the name stops resolving, the record
 * stays untouched — and the §10.1 honesty line about Hue-from-the-record reversal.
 */
export function varietyRemoveConsequence(varietyName: string): string {
  return `'${varietyName}'s public page will come off the site, and the name will stop resolving in search. Its listings, other names, and waitlist entries stay in the record untouched. This can be undone by Hue from the record, not from this screen.`;
}

// ─── Variety status lines (§10.4 — the actions handler only emits known codes) ─

export type VarietyStatusKind = "alias_added" | "alias_removed" | "variety_removed" | "save_failed";

export interface VarietyStatusLine {
  kind: VarietyStatusKind;
  text: string;
}

export function varietyStatusLine(params: { status?: string | null; name?: string | null }): VarietyStatusLine | null {
  const kind = params.status as VarietyStatusKind | null;
  if (!kind) return null;
  const name = params.name?.trim() ? params.name.trim() : null;
  switch (kind) {
    case "alias_added":
      return { kind, text: name ? `'${name}' now finds this variety in search.` : "Another name added." };
    case "alias_removed":
      return { kind, text: name ? `'${name}' no longer finds this variety in search.` : "That name no longer finds this variety in search." };
    case "variety_removed":
      return { kind, text: name ? `Removed '${name}' — its page is off the public site.` : "Variety removed — its page is off the public site." };
    case "save_failed":
      return { kind, text: "That didn't go through. Nothing was changed — try again." };
    default:
      return null;
  }
}
