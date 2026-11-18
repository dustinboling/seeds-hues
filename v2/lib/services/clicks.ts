/**
 * Outbound clicks + views (canonical §5 "Outbound link tracking", R7, R14).
 *
 *  - /go/{listing_id}: writes a click_events row and answers 302 to the farm's page with UTM tags.
 *    No cookies; the IP is read transiently to build a daily-rotating salted hash and is never
 *    stored.
 *  - POST /api/track {type:"view", varietySlug} → variety_view_counts.
 *  - POST /api/track {seller, variety, href} (legacy beacon) → outbound_clicks, unchanged.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { listingForGo } from "@/lib/repositories/catalog-read";
import { findListingForClick, insertOutboundClick } from "@/lib/repositories/catalog-write";
import { activeVarietyIdBySlug, bumpVarietyView, insertClickEvent } from "@/lib/repositories/events";
import { sha256Hex } from "@/lib/api/http";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const ClickPayloadSchema = z.strictObject({
  seller: slug.max(120),
  variety: slug.max(160).nullable().optional(),
  href: z.string().url().max(2000),
});
export const ViewPayloadSchema = z.strictObject({ type: z.literal("view"), varietySlug: slug.max(160) });
export type ClickPayload = z.infer<typeof ClickPayloadSchema>;

export const UTM = { utm_source: "seedfinder", utm_medium: "referral" } as const;
export const DEV_CLICK_SALT = "seedfinder-dev-salt-not-secret";

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|curl|wget|python-requests|httpx|go-http-client|okhttp|java\/|headless|phantom|lighthouse|scrapy|axios|node-fetch|undici/i;

export function isBotUserAgent(ua: string | null): boolean {
  return !ua || BOT_UA.test(ua);
}

/** A coarse client label: X-Client wins ("web/1.0.0", "ios/1.2.0"), else the UA family. */
export function clientLabel(xClient: string | null, ua: string | null): string {
  const x = xClient?.trim();
  if (x && /^[\w.\-/]{1,40}$/.test(x)) return x;
  if (!ua) return "unknown";
  if (isBotUserAgent(ua)) return "bot";
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

/** page_type from the Referer path on our own site; "external" / "direct" otherwise. */
export function pageType(referer: string | null, ownHosts: string[]): string {
  if (!referer) return "direct";
  let u: URL;
  try {
    u = new URL(referer);
  } catch {
    return "direct";
  }
  if (!ownHosts.includes(u.host)) return "external";
  const seg = u.pathname.split("/")[1] ?? "";
  if (seg === "") return "home";
  return ["variety", "seller", "crop", "series", "search"].includes(seg) ? seg : "other";
}

export function referrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host || null;
  } catch {
    return null;
  }
}

/** Append utm_source/utm_medium, keeping any query string; an existing utm_source is kept. */
export function withUtm(target: string): string {
  const u = new URL(target);
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", UTM.utm_source);
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", UTM.utm_medium);
  return u.toString();
}

export async function visitorDayHash(salt: string, ip: string, at: Date): Promise<string> {
  return sha256Hex(`${salt}|${ip}|${at.toISOString().slice(0, 10)}`);
}

export interface GoRequest {
  listingId: number;
  ip: string | null;
  userAgent: string | null;
  xClient: string | null;
  referer: string | null;
  ownHosts: string[];
  salt: string;
}

export type GoOutcome = { status: 302; location: string } | { status: 404 } | { status: 410 };

export function createClickService(db: Db) {
  return {
    /** /go/{id}: 404 unknown/unpublished, 410 seller removed, else log + 302. */
    async go(r: GoRequest, at = new Date()): Promise<GoOutcome> {
      const l = await listingForGo(db, r.listingId);
      if (!l) return { status: 404 };
      if (l.sellerEligibility === "removed_by_request" || l.sellerListingPolicy === "removed") return { status: 410 };
      const published = (l.status === "active" || l.status === "published") && !l.deletedAt;
      const sellerOk = l.sellerEligibility === "approved" && l.sellerStatus === "active";
      if (!published || !sellerOk || l.varietyStatus !== "active") return { status: 404 };
      const target = l.productUrl ?? l.sellerHomepage;
      if (!target) return { status: 404 };
      try {
        await insertClickEvent(db, {
          at: at.toISOString(),
          listingId: l.id,
          varietyId: l.varietyId,
          sellerId: l.sellerId,
          availabilityAtClick: l.availability,
          pageType: pageType(r.referer, r.ownHosts),
          referrerHost: referrerHost(r.referer),
          client: clientLabel(r.xClient, r.userAgent),
          visitorDayHash: await visitorDayHash(r.salt, r.ip ?? "unknown", at),
          isBot: isBotUserAgent(r.userAgent),
        });
      } catch (err) {
        // Logging must never block the redirect.
        console.error("click_events insert failed", err);
      }
      return { status: 302, location: withUtm(target) };
    },

    /** Variety page view beacon. Returns true when counted. */
    async view(varietySlug: string, at = new Date()): Promise<boolean> {
      const id = await activeVarietyIdBySlug(db, varietySlug);
      if (id === null) return false;
      await bumpVarietyView(db, at.toISOString().slice(0, 10), id);
      return true;
    },

    /** Legacy beacon: written only when href equals the listing's product URL or the seller homepage. */
    async record(payload: ClickPayload): Promise<boolean> {
      const target = await findListingForClick(db, payload.seller, payload.variety ?? null);
      if (!target) return false;
      if (!target.urls.includes(payload.href)) return false;
      await insertOutboundClick(db, {
        sellerId: target.sellerId,
        listingId: target.listingId,
        targetUrl: payload.href,
        createdAt: new Date().toISOString(),
      });
      return true;
    },
  };
}
