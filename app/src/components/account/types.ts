/**
 * The account wire shapes the app's surfaces consume, ported from
 * v2/lib/services/accounts.ts (PublicUser, AlertItem, AlertStatus, and
 * the profile-completeness rule). The backend owns these shapes; the
 * app reads them, never redefines their meaning.
 */

export interface AccountPublicUser {
  name: string;
  email: string;
  phone: string;
  phone_display: string;
  usda_zone: string | null;
  email_verified: boolean;
  notify_opt_out: boolean;
  farm_owner_declared: boolean;
  is_farm_owner: boolean;
  alert_phone: string | null;
  alert_phone_display: string | null;
  alert_phone_verified: boolean;
  sms_opt_in: boolean;
}

export type AlertStatus =
  | { state: "found"; seller: { name: string; slug: string }; listing_id: number; seller_count: number; alerted: boolean }
  | { state: "waiting"; channels: ("email" | "sms")[] }
  | { state: "held"; reasons: string[] };

export interface AlertItem {
  variety: { slug: string; name: string; crop: string };
  joined_at: string;
  notified_at: string | null;
  status: AlertStatus;
}

/**
 * Whether the deferred profile is complete (Tranche 3.2, §3.2.5): a name
 * is set and a ZIP set the zone. The empty-string sentinel counts as
 * unset everywhere it surfaces; email and phone are never re-asked, so
 * neither gates completion. Flip-created accounts start incomplete.
 */
export function isProfileComplete(name: string, usdaZone: string | null): boolean {
  return name !== "" && usdaZone !== null;
}
